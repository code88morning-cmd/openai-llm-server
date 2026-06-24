import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChatPromptDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(2000)
  prompt: string;
}
