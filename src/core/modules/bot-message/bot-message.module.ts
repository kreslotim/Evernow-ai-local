import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BotMessageService } from './bot-message.service';
import { FileModule } from '../file/file.module';

/**
 * Модуль для управления сообщениями бота
 * Предоставляет централизованную систему для работы с сообщениями
 * с приоритетом БД над локалями
 */
@Module({
  imports: [PrismaModule, FileModule],
  providers: [BotMessageService],
  exports: [BotMessageService],
})
export class BotMessageModule { }
