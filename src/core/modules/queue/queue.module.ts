import { forwardRef, Global, Inject, Module } from '@nestjs/common';
import { BullModule, BullRootModuleOptions } from '@nestjs/bull';
import { ConfigService } from '../config/config.service';
import { QueueService } from './services/queue.service';
import { PhotoAnalysisProcessor } from './processors/photo-analysis.processor';
import { QueueNames } from '../../../common/enums/queue-names.enum';
import { OpenAIModule } from '../llm/openai/openai.module';
import { AnalyzeModule } from '../analyze/analyze.module';
import { TelegramModule } from '../telegram/telegram.module';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';
import { I18nModule } from '../../../bot/i18n/i18n.module';
import { ImageProcessingModule } from '../image-processing/image-processing.module';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): BullRootModuleOptions => ({
        url: configService.getRedisUrl(),
      }),
    }),
    BullModule.registerQueue({
      name: QueueNames.PHOTO_ANALYSIS,
    }),
    OpenAIModule,
    TelegramModule,
    NotificationModule,
    I18nModule,
    forwardRef(() => UserModule),
    forwardRef(() => AnalyzeModule),
    ImageProcessingModule,
  ],
  providers: [QueueService, PhotoAnalysisProcessor],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
