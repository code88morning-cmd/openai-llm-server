import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import OpenAI from 'openai';
import { RedisService, VectorSearchDocument } from '../infra/redis/redis.service';
import { ChatMessage } from './interfaces/chat-message.interface';
import { LlmResponse } from './interfaces/llm-response.interface';

@Injectable()
export class OpenaiService implements OnModuleInit {
  private readonly logger = new Logger(OpenaiService.name);
  private readonly client: OpenAI;
  private readonly defaultModel: string;
  private readonly embeddingModel: string;
  private readonly ragIndexName: string;
  private readonly ragDocsPath: string;
  private readonly embeddingDimension: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      throw new UnauthorizedException('OPENAI_API_KEY is required. Check your .env file.');
    }

    this.client = new OpenAI({ apiKey });
    this.defaultModel = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
    this.embeddingModel = this.configService.get<string>('OPENAI_EMBEDDING_MODEL') || 'text-embedding-3-small';
    this.ragIndexName = this.configService.get<string>('RAG_INDEX_NAME') || 'my-tech-chatbot';
    this.ragDocsPath = this.configService.get<string>('RAG_DOCS_PATH') || 'src/rag';
    this.embeddingDimension = Number(this.configService.get<string>('OPENAI_EMBEDDING_DIMENSION')) || 1536;
  }

  async onModuleInit(): Promise<void> {
    const autoIndex = this.configService.get<string>('RAG_AUTO_INDEX') ?? 'false';

    if (autoIndex !== 'true') {
      this.logger.log('RAG auto indexing is disabled. Use POST /openai/reset-rag to build the index.');
      return;
    }

    try {
      await this.initializeRagIndex();
    } catch (error) {
      this.logger.warn(
        `RAG auto indexing skipped. Redis Stack may not be running. reason=${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async generateText(prompt: string): Promise<string> {
    const response = await this.createResponse(prompt, this.defaultModel);
    return response.answer;
  }

  async generateCompletion(prompt: string): Promise<LlmResponse> {
    return await this.createResponse(prompt, this.defaultModel);
  }

  async generateFromMessages(messages: ChatMessage[], model?: string): Promise<string> {
    const input = messages.map((message) => `${message.role}: ${message.content}`).join('\n');
    const response = await this.createResponse(input, model || this.defaultModel);
    return response.answer;
  }

  async generateTextWithRag(prompt: string, topK = 5): Promise<{ answer: string; sources: VectorSearchDocument[] }> {
    try {
      this.logger.log(`RAG request started. promptLength=${prompt.length}, topK=${topK}`);

      const questionEmbedding = await this.createEmbedding(prompt);
      const searchResult = await this.redisService.searchVector(this.ragIndexName, questionEmbedding, topK);
      const context = this.buildRagContext(searchResult.documents);

      const ragPrompt = [
        'You are a helpful assistant for a RAG-based chatbot.',
        'Answer the question using the provided context first.',
        'If the context is insufficient, say that the provided documents do not contain enough information.',
        '',
        '[Context]',
        context || 'No relevant context was found.',
        '',
        '[Question]',
        prompt,
      ].join('\n');

      const response = await this.createResponse(ragPrompt, this.defaultModel);

      this.logger.log(`RAG request completed. sourceCount=${searchResult.documents.length}`);

      return {
        answer: response.answer,
        sources: searchResult.documents,
      };
    } catch (error) {
      this.logger.error('RAG request failed.', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Failed to generate answer with RAG. Check Redis Stack and RAG index.');
    }
  }

  async initializeRagIndex(directoryPath = this.ragDocsPath): Promise<void> {
    this.logger.log(`RAG index initialization started. docsPath=${directoryPath}`);

    await this.redisService.createVectorIndex(this.ragIndexName, this.embeddingDimension);
    await this.loadAndIndexDocuments(directoryPath);

    this.logger.log('RAG index initialization completed.');
  }

  async resetRagSystem(directoryPath = this.ragDocsPath): Promise<void> {
    this.logger.log(`RAG reset started. docsPath=${directoryPath}`);

    await this.redisService.resetVectorIndex(this.ragIndexName, this.embeddingDimension);
    await this.loadAndIndexDocuments(directoryPath);

    this.logger.log('RAG reset completed.');
  }

  private async loadAndIndexDocuments(directoryPath: string): Promise<void> {
    const resolvedPath = path.resolve(process.cwd(), directoryPath);
    const files = await fs.readdir(resolvedPath);
    const textFiles = files.filter((file) => file.endsWith('.txt'));

    for (const file of textFiles) {
      const filePath = path.join(resolvedPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const chunks = this.splitDocument(content, 600);

      for (const [index, chunk] of chunks.entries()) {
        const embedding = await this.createEmbedding(chunk);
        const documentKey = `doc:${path.basename(file, '.txt')}:${index}`;

        await this.redisService.addVectorData(documentKey, embedding, chunk);
      }

      this.logger.log(`RAG document indexed. file=${file}, chunkCount=${chunks.length}`);
    }
  }

  private async createEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: text,
    });

    return response.data[0].embedding;
  }

  private buildRagContext(documents: VectorSearchDocument[]): string {
    return documents
      .map((document, index) => {
        const score = document.score ? ` score=${document.score}` : '';
        return `[Source ${index + 1}] id=${document.id}${score}\n${document.text}`;
      })
      .join('\n\n');
  }

  private splitDocument(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';
    const sentences = text.split(/(?<=[.!?。！？])\s+/);

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= chunkSize) {
        currentChunk += `${currentChunk ? ' ' : ''}${sentence}`;
        continue;
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }

      currentChunk = sentence;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private async createResponse(prompt: string, model: string): Promise<LlmResponse> {
    try {
      this.logger.log(`OpenAI request started. model=${model}, promptLength=${prompt.length}`);

      const response = await this.client.responses.create({
        model,
        input: prompt,
      });

      const answer = response.output_text?.trim();

      if (!answer) {
        throw new InternalServerErrorException('OpenAI response text is empty.');
      }

      this.logger.log(`OpenAI request completed. responseId=${response.id}`);

      return {
        id: response.id,
        model,
        answer,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('OpenAI request failed.', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Failed to generate answer from OpenAI API.');
    }
  }
}
