import { Module } from '@nestjs/common';
import { DeepSeekService } from './deepseek.service';
import { ConfigModule } from '../../config/config.module';
import { PromptModule } from '../prompt/prompt.module';

@Module({
  imports: [ConfigModule, PromptModule],
  providers: [DeepSeekService],
  exports: [DeepSeekService],
})
export class DeepSeekModule {}
