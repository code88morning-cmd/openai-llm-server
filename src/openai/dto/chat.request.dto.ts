import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMessageDto {
  @IsString()
  @IsIn(['system', 'user', 'assistant'])
  role: 'system' | 'user' | 'assistant';

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}

export class ChatRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @IsOptional()
  @IsString()
  model?: string;
}
