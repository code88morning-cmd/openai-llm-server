import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenaiController } from './openai.controller';
import { OpenaiService } from './openai.service';

@Module({
  imports: [ConfigModule],
  controllers: [OpenaiController],
  providers: [OpenaiService],
  exports: [OpenaiService],
})
export class OpenaiModule {}
