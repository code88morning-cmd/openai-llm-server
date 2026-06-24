import { Body, Controller, Get, Post } from '@nestjs/common';
import { ChatCompletionDto } from './dto/chat.completion.dto';
import { ChatPromptDto } from './dto/chat.prompt.dto';
import { ChatRequestDto } from './dto/chat.request.dto';
import { RagRequestDto } from './dto/rag.request.dto';
import { RagResponse } from './interfaces/rag-response.interface';
import { OpenaiService } from './openai.service';

@Controller('openai')
export class OpenaiController {
  constructor(private readonly openaiService: OpenaiService) {}

  @Get('status')
  getStatus(): { status: string; provider: string; features: string[] } {
    return {
      status: 'ready',
      provider: 'OpenAI',
      features: ['chat', 'chat-json', 'chat-messages', 'rag', 'redis-vector-search'],
    };
  }

  @Post('chat')
  async generateText(@Body() chatPrompt: ChatPromptDto): Promise<string> {
    return await this.openaiService.generateText(chatPrompt.prompt);
  }

  @Post('chat-json')
  async generateTextJson(@Body() chatPrompt: ChatPromptDto): Promise<ChatCompletionDto> {
    const response = await this.openaiService.generateCompletion(chatPrompt.prompt);

    return {
      id: response.id,
      model: response.model,
      prompt: chatPrompt.prompt,
      answer: response.answer,
      createdAt: response.createdAt,
    };
  }

  @Post('chat-messages')
  async generateFromMessages(@Body() chatRequest: ChatRequestDto): Promise<string> {
    return await this.openaiService.generateFromMessages(chatRequest.messages, chatRequest.model);
  }

  @Post('rag')
  async generateTextWithRag(@Body() ragRequest: RagRequestDto): Promise<RagResponse> {
    const result = await this.openaiService.generateTextWithRag(ragRequest.prompt, ragRequest.topK ?? 5);

    return {
      success: true,
      message: result.answer,
      sources: result.sources,
    };
  }

  @Post('reset-rag')
  async resetRag(): Promise<{ message: string }> {
    await this.openaiService.resetRagSystem();

    return {
      message: 'RAG system has been reset successfully.',
    };
  }
}
