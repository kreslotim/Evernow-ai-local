import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { PromptService } from './prompt.service';

/**
 * Модуль для управления промптами LLM сервисов
 */
@Module({
  imports: [PrismaModule],
  providers: [PromptService],
  exports: [PromptService],
})
export class PromptModule {}
