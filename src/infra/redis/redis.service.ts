import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

export interface VectorSearchDocument {
  id: string;
  text: string;
  score?: string;
}

export interface VectorSearchResult {
  total: number;
  documents: VectorSearchDocument[];
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client?: RedisClientType;

  constructor(private readonly configService: ConfigService) {}

  private async getClient(): Promise<RedisClientType> {
    if (this.client?.isOpen) {
      return this.client;
    }

    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 1000, 10000),
      },
    });

    this.client.on('error', (error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });

    await this.client.connect();
    this.logger.log(`Redis connected. url=${redisUrl}`);

    return this.client;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const client = await this.getClient();

    if (ttl) {
      await client.set(key, value, { EX: ttl });
      return;
    }

    await client.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    const client = await this.getClient();
    return await client.get(key);
  }

  async del(key: string): Promise<void> {
    const client = await this.getClient();
    await client.del(key);
  }

  async createVectorIndex(indexName: string, dimension = 1536): Promise<void> {
    const client = await this.getClient();

    try {
      await client.sendCommand([
        'FT.CREATE',
        indexName,
        'ON',
        'JSON',
        'PREFIX',
        '1',
        'doc:',
        'SCHEMA',
        '$.text',
        'AS',
        'text',
        'TEXT',
        '$.vector',
        'AS',
        'vector',
        'VECTOR',
        'HNSW',
        '6',
        'TYPE',
        'FLOAT32',
        'DIM',
        String(dimension),
        'DISTANCE_METRIC',
        'COSINE',
      ]);

      this.logger.log(`Redis vector index created. index=${indexName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('Index already exists')) {
        this.logger.log(`Redis vector index already exists. index=${indexName}`);
        return;
      }

      throw error;
    }
  }

  async addVectorData(key: string, vector: number[], text: string): Promise<void> {
    const client = await this.getClient();

    await client.sendCommand([
      'JSON.SET',
      key,
      '$',
      JSON.stringify({
        text,
        vector,
      }),
    ]);

    this.logger.debug(`RAG document stored. key=${key}`);
  }

  async searchVector(indexName: string, vector: number[], limit = 5): Promise<VectorSearchResult> {
    const client = await this.getClient();
    const query = `*=>[KNN ${limit} @vector $vector AS score]`;

    const rawResult = (await client.sendCommand([
      'FT.SEARCH',
      indexName,
      query,
      'PARAMS',
      '2',
      'vector',
      Buffer.from(new Float32Array(vector).buffer),
      'SORTBY',
      'score',
      'RETURN',
      '2',
      'text',
      'score',
      'DIALECT',
      '2',
    ])) as Array<string | number | Array<string>>;

    return this.parseVectorSearchResult(rawResult);
  }

  async resetVectorIndex(indexName: string, dimension = 1536): Promise<void> {
    const client = await this.getClient();

    const indices = (await client.sendCommand(['FT._LIST'])) as string[];

    if (indices.includes(indexName)) {
      await client.sendCommand(['FT.DROPINDEX', indexName, 'DD']);
      this.logger.log(`Redis vector index dropped. index=${indexName}`);
    }

    const keys = await client.keys('doc:*');

    if (keys.length > 0) {
      await client.del(keys);
      this.logger.log(`RAG document keys deleted. count=${keys.length}`);
    }

    await this.createVectorIndex(indexName, dimension);
  }

  private parseVectorSearchResult(rawResult: Array<string | number | Array<string>>): VectorSearchResult {
    const total = Number(rawResult[0] || 0);
    const documents: VectorSearchDocument[] = [];

    for (let index = 1; index < rawResult.length; index += 2) {
      const id = String(rawResult[index]);
      const fields = rawResult[index + 1] as Array<string> | undefined;
      const document: VectorSearchDocument = { id, text: '' };

      if (Array.isArray(fields)) {
        for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 2) {
          const fieldName = fields[fieldIndex];
          const fieldValue = fields[fieldIndex + 1];

          if (fieldName === 'text') {
            document.text = fieldValue;
          }

          if (fieldName === 'score') {
            document.score = fieldValue;
          }
        }
      }

      if (document.text) {
        documents.push(document);
      }
    }

    return { total, documents };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit();
    }
  }
}
