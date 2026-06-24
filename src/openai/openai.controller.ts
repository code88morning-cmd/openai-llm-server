import { Body, Controller, Get, Post } from '@nestjs/common';
import { ChatCompletionDto } from './dto/chat.completion.dto';
import { ChatPromptDto } from './dto/chat.prompt.dto';
import { ChatRequestDto } from './dto/chat.request.dto';
import { OpenaiService } from './openai.service';

@Controller('openai')
export class OpenaiController {
  constructor(private readonly openaiService: OpenaiService) {}

  @Get('status')
  getStatus(): { status: string; provider: string } {
    return {
      status: 'ready',
      provider: 'OpenAI',
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
}
