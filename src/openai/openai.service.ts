import { Injectable, InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatMessage } from './interfaces/chat-message.interface';
import { LlmResponse } from './interfaces/llm-response.interface';

@Injectable()
export class OpenaiService {
  private readonly logger = new Logger(OpenaiService.name);
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      throw new UnauthorizedException('OPENAI_API_KEY is required. Check your .env file.');
    }

    this.client = new OpenAI({ apiKey });
    this.defaultModel = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
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
