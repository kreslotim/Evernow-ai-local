import { Module } from '@nestjs/common';
import { ImageProcessingService } from './image-processing.service';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [TelegramModule],
  providers: [ImageProcessingService],
  exports: [ImageProcessingService],
})
export class ImageProcessingModule {}
