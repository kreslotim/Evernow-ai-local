import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenAIService } from './openai.service';
import { PromptModule } from '../prompt/prompt.module';

@Module({
  imports: [ConfigModule, PromptModule],
  providers: [OpenAIService],
  exports: [OpenAIService],
})
export class OpenAIModule {}
