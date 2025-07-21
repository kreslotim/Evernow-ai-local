import { Module } from '@nestjs/common';
import { I18nService } from './i18n/i18n.service';
import { KeyboardService } from './services/keyboard.service';
import { KeyboardHandlerMiddleware } from './middleware/keyboard-handler.middleware';
import { BotService } from './services/bot.service';
import { StartHandler } from './handlers/start.handler';
import { UserModule } from 'src/core/modules/user/user.module';
import { ReferralModule } from 'src/core/modules/referral/referral.module';
import { AnalyzeModule } from 'src/core/modules/analyze/analyze.module';
import { ImageProcessingModule } from 'src/core/modules/image-processing/image-processing.module';
import { QueueModule } from 'src/core/modules/queue/queue.module';
import { BannedUserGuard } from './guards/banned-user.guard';
import { APP_GUARD } from '@nestjs/core';
import { SupportHandler } from './handlers/support.handler';
import { PaymentService } from './services/payment.service';
import { ReferralHandler } from './handlers/referral.handler';
import { AnalyzeHandler } from './handlers/analyze.handler';
import { SubscriptionService } from './services/subscription.service';
import { SubscriptionHandler } from './handlers/subscription.handler';
import { AnalysisCheckMiddleware } from './middleware/analysis-check.middleware';
import { OnboardingMiddleware } from './middleware/onboarding.middleware';
import { NotificationHandlerService } from './services/notification-handler.service';
import { BotController } from './bot.controller';
import { OnboardingHandler } from './handlers/onboarding.handler';
import { UserInfoModule } from 'src/core/modules/user-info/user-info.module';
import { TimerModule } from 'src/core/modules/timer/timer.module';
import { TelegramModule } from 'src/core/modules/telegram/telegram.module';
import { DeepSeekModule } from 'src/core/modules/llm/deepseek/deepseek.module';
import { OpenAIModule } from 'src/core/modules/llm/openai/openai.module';
import { WhisperModule } from 'src/core/modules/llm/whisper/whisper.module';
import { UserMiddleware } from './middleware/user.middleware';
import { TypingStatusUtil } from './utils/typing-status.util';
import { BotMessageModule } from 'src/core/modules/bot-message/bot-message.module';
import { UserInfoService } from 'src/core/modules/user-info/user-info.service';
import { WelcomePhotoModule } from 'src/core/modules/welcome-photo/welcome-photo.module';

@Module({
  imports: [
    UserModule,
    ReferralModule,
    AnalyzeModule,
    ImageProcessingModule,
    QueueModule,
    UserInfoModule,
    TimerModule,
    WhisperModule,
    DeepSeekModule,
    OpenAIModule,
    TelegramModule,
    BotMessageModule,
    WelcomePhotoModule,
  ],
  providers: [
    I18nService,
    KeyboardService,
    PaymentService,
    SubscriptionService,
    SubscriptionHandler,
    KeyboardHandlerMiddleware,
    NotificationHandlerService,
    BotService,
    StartHandler,
    SupportHandler,
    ReferralHandler,
    AnalyzeHandler,
    OnboardingHandler,
    AnalysisCheckMiddleware,
    OnboardingMiddleware,
    BannedUserGuard,
    UserMiddleware,
    TypingStatusUtil,
    UserInfoService,
  ],
  controllers: [BotController],
  exports: [I18nService, KeyboardService, KeyboardHandlerMiddleware, BotService],
})
export class BotModule {}
