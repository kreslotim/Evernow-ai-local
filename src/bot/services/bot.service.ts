import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { ConfigService } from '../../core/modules/config/config.service';
import { StartHandler } from '../handlers/start.handler';
import { AnalyzeHandler } from '../handlers/analyze.handler';
import { KeyboardHandlerMiddleware } from '../middleware/keyboard-handler.middleware';
import { NotificationService, NotificationMessage } from '../../core/modules/notification/notification.service';
import { NotificationHandlerService } from './notification-handler.service';
import { ReferralHandler } from '../handlers/referral.handler';
import { BannedUserGuard } from '../guards/banned-user.guard';
import { OnboardingMiddleware } from '../middleware/onboarding.middleware';
import { UserService } from '../../core/modules/user/user.service';
import { OnboardingHandler } from '../handlers/onboarding.handler';
import { UserMiddleware } from '../middleware/user.middleware';
import { SubscriptionHandler } from '../handlers/subscription.handler';

@Injectable()
export class BotService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BotService.name);
  private bot: Telegraf;

  constructor(
    private readonly configService: ConfigService,
    private readonly startHandler: StartHandler,
    private readonly analyzeHandler: AnalyzeHandler,
    private readonly keyboardHandlerMiddleware: KeyboardHandlerMiddleware,
    private readonly notificationService: NotificationService,
    private readonly notificationHandlerService: NotificationHandlerService,
    private readonly referralHandler: ReferralHandler,
    private readonly bannedUserGuard: BannedUserGuard,
    private readonly onboardingMiddleware: OnboardingMiddleware,
    private readonly userService: UserService,
    private readonly onboardingHandler: OnboardingHandler,
    private readonly userMiddleware: UserMiddleware,
    private readonly subscriptionHandler: SubscriptionHandler,
  ) { }

  async onApplicationBootstrap() {
    this.initializeBotAsync();
    this.setupNotificationListener();
  }

  private initializeBotAsync(): void {
    Promise.resolve().then(async () => {
      try {
        await this.initializeBot();
      } catch (error) {
        this.logger.error('Failed to initialize bot:', error);
      }
    });
  }

  private async initializeBot(): Promise<void> {
    const token = this.configService.getBotToken();

    if (!token) {
      throw new Error('BOT_TOKEN is required');
    }

    this.logger.log('Initializing Telegram bot...');
    this.bot = new Telegraf(token);

    this.bot.use(this.bannedUserGuard.createMiddleware());

    // Middleware для обработки команды /start и установки startPayload
    this.bot.use((ctx, next) => {
      // Устанавливаем startPayload для команды /start перед UserMiddleware
      if (ctx.message && 'text' in ctx.message && ctx.message.text?.startsWith('/start')) {
        const payload = this.extractStartPayload(ctx.message.text);
        (ctx as any).startPayload = payload;
        this.logger.log(`Set startPayload in context: "${payload}"`);
      }
      return next();
    });

    this.bot.use(this.userMiddleware.getMiddleware());
    this.bot.use(this.onboardingMiddleware.use());
    // this.bot.use(this.keyboardHandlerMiddleware.getMiddleware());

    this.setupBasicHandlers();

    if (this.configService.isDevelopment()) {
      await this.startPolling();
    } else {
      await this.setupWebhook();
    }

    this.logger.log('Bot initialization completed successfully');
  }

  private setupBasicHandlers() {
    this.bot.start(async (ctx) => {
      // Payload уже установлен в middleware, просто извлекаем его
      const payload = (ctx as any).startPayload || null;
      await this.startHandler.handleStartCommand(ctx, payload);
    });

    // Единый пайплайн - убираем команду /analyze, так как процесс автоматический
    // Оставляем только для совместимости (если кто-то введёт команду)
    this.bot.command('analyze', async (ctx) => {
      await this.analyzeHandler.handleAnalyzeCommand(ctx);
    });

    // Команды управления подписками
    this.bot.command(['subscription', 'sub'], async (ctx) => {
      this.logger.debug(`Subscription status command from user ${ctx.from?.id}`);
      await this.subscriptionHandler.handleSubscriptionStatus(ctx);
    });

    this.bot.command('plans', async (ctx) => {
      this.logger.debug(`Subscription plans command from user ${ctx.from?.id}`);
      await this.subscriptionHandler.handleSubscriptionPlans(ctx);
    });

    // Analysis type selection callbacks
    this.bot.action(/^analyze_(.+)$/, async (ctx) => {
      const action = ctx.match[1];
      await ctx.answerCbQuery();

      // Пока что просто обрабатываем как команду анализа
      // Поскольку у нас только один тип анализа, все действия ведут к нему
      await this.analyzeHandler.handleAnalyzeCommand(ctx);
    });

    // Onboarding analysis type selection callbacks
    this.bot.action(/^onboarding_analyze_(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      // Упрощено — просто начинаем анализ
      await this.analyzeHandler.handleAnalyzeCommand(ctx);
    });

    this.bot.action('add_more_photos', async (ctx) => {
      await ctx.answerCbQuery();
      // Этот метод был упрощён, пока что заглушка
      await ctx.reply('📷 Отправьте следующее фото');
    });

    this.bot.action('start_analysis', async (ctx) => {
      await ctx.answerCbQuery();
      // Этот метод был упрощён, пока что заглушка
      await ctx.reply('🔄 Анализ запущен');
    });

    // Couple analysis callback
    this.bot.action('skip_second_photo', async (ctx) => {
      await ctx.answerCbQuery();
      // Этот метод был упрощён, пока что заглушка
      await ctx.reply('⏩ Пропущено второе фото');
    });

    // Make another analysis callback
    this.bot.action('make_another_analysis', async (ctx) => {
      await ctx.answerCbQuery();
      await this.analyzeHandler.handleAnalyzeCommand(ctx);
    });

    this.bot.action(/^ask_ai_(.+)$/, async (ctx) => {
      const analysisType = ctx.match[1] as any;
      await ctx.answerCbQuery();
      await this.notificationHandlerService.handleAskAiCallback(this.bot, ctx.from?.id?.toString() || '', analysisType);
    });

    // Onboarding button handlers
    this.bot.action('onboarding_buy_more', async (ctx) => {
      await ctx.answerCbQuery();
      try {
        // Create proxy context that forces new messages instead of editing
        const proxyCtx = new Proxy(ctx, {
          get(target, prop) {
            if (prop === 'callbackQuery') {
              return undefined; // Force new message mode
            }
            return target[prop];
          },
        });

        await this.referralHandler.showReferralInfo(proxyCtx);
      } catch (error) {
        this.logger.error(`Error showing referral info from onboarding: ${error.message}`);
        await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
      }
    });

    this.bot.action('face_back', async (ctx) => {
      if (!ctx.from?.id) return;
      await ctx.answerCbQuery();
      await ctx.deleteMessage();
      await this.onboardingHandler.handleBackStartSurvey(ctx);
      this.analyzeHandler.clearUserSession(ctx.from.id.toString());
    })

    this.bot.action('onboarding_get_free', async (ctx) => {
      await ctx.answerCbQuery();
      try {
        // Create proxy context that forces new messages instead of editing
        const proxyCtx = new Proxy(ctx, {
          get(target, prop) {
            if (prop === 'callbackQuery') {
              return undefined; // Force new message mode
            }
            return target[prop];
          },
        });

        await this.referralHandler.showReferralInfo(proxyCtx);
      } catch (error) {
        this.logger.error(`Error showing referral info from onboarding: ${error.message}`);
        await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
      }
    });

    // Continue to mini app callback
    this.bot.action('continue_to_miniapp', async (ctx) => {
      await ctx.answerCbQuery();
      const userId = ctx.from?.id?.toString();
      if (userId) {
        const user = await this.userService.findUserInfoByTeleramId(userId);
        if (user) {
          await this.onboardingHandler.handleContinueToMiniApp(ctx, user.id);
        }
      }
    });

    this.bot.action('send_miniapp_finish', async (ctx) => {
      await ctx.answerCbQuery();
      const userId = ctx.from?.id?.toString();
      if (userId) {
        const user = await this.userService.findUserInfoByTeleramId(userId);
        if (user) {
          await this.onboardingHandler.handleMiniAppFinish(ctx, user.id);
        }
      }
    });

    // Final message action handlers
    this.bot.action('final_ready', async (ctx) => {
      await ctx.answerCbQuery();
      const userId = ctx.from?.id?.toString();
      if (userId) {
        const user = await this.userService.findUserInfoByTeleramId(userId);
        if (user) {
          await this.onboardingHandler.sendFinalChoicesMessage(ctx, user.id);
        }
      }
    });

    this.bot.action('onboarding_share', async (ctx) => {
      await ctx.answerCbQuery();
      await this.onboardingHandler.handleShareWithFriends(ctx);
    });

    this.bot.action('onboarding_repost', async (ctx) => {
      await ctx.answerCbQuery();
      await this.onboardingHandler.handleMakeRepost(ctx);
    });

    this.bot.action('onboarding_purchase', async (ctx) => {
      await ctx.answerCbQuery();
      await this.onboardingHandler.handlePurchaseParticipation(ctx);
    });

    this.bot.action('repost_check', async (ctx) => {
      await ctx.answerCbQuery();
      await this.onboardingHandler.handleRepostCheck(ctx);
    });

    this.bot.action('action_back', async (ctx) => {
      await ctx.answerCbQuery();
      await this.onboardingHandler.handleBackButton(ctx);
    });

    // Обработчики callback queries для подписок
    this.bot.action('subscription_plans', async (ctx) => {
      await ctx.answerCbQuery();
      this.logger.debug(`Subscription plans callback from user ${ctx.from?.id}`);
      await this.subscriptionHandler.handleSubscriptionPlans(ctx);
    });

    this.bot.action('subscription_status', async (ctx) => {
      await ctx.answerCbQuery();
      this.logger.debug(`Subscription status callback from user ${ctx.from?.id}`);
      await this.subscriptionHandler.handleSubscriptionStatus(ctx);
    });

    // Обработчик создания подписки с планом
    this.bot.action(/^create_subscription:(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const planId = ctx.match[1];
      this.logger.debug(`Create subscription callback from user ${ctx.from?.id} with plan ${planId}`);
      await this.subscriptionHandler.handleCreateSubscription(ctx, planId);
    });

    // Обработчик отмены подписки
    this.bot.action(/^cancel_subscription:(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const subscriptionId = ctx.match[1];
      this.logger.debug(`Cancel subscription callback from user ${ctx.from?.id} for subscription ${subscriptionId}`);
      await this.subscriptionHandler.handleCancelSubscription(ctx, subscriptionId);
    });

    // Обработчик подтверждения отмены подписки
    this.bot.action(/^confirm_cancel_subscription:(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const subscriptionId = ctx.match[1];
      this.logger.debug(
        `Confirm cancel subscription callback from user ${ctx.from?.id} for subscription ${subscriptionId}`,
      );
      await this.subscriptionHandler.handleConfirmCancelSubscription(ctx, subscriptionId);
    });

    // Обработчик приостановки подписки
    this.bot.action(/^pause_subscription:(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const subscriptionId = ctx.match[1];
      this.logger.debug(`Pause subscription callback from user ${ctx.from?.id} for subscription ${subscriptionId}`);
      await this.subscriptionHandler.handlePauseSubscription(ctx, subscriptionId);
    });

    // Обработчик возобновления подписки
    this.bot.action(/^resume_subscription:(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const subscriptionId = ctx.match[1];
      this.logger.debug(`Resume subscription callback from user ${ctx.from?.id} for subscription ${subscriptionId}`);
      await this.subscriptionHandler.handleResumeSubscription(ctx, subscriptionId);
    });

    // Обработчик кнопки "Назад" в подписках
    this.bot.action('subscription_back', async (ctx) => {
      await ctx.answerCbQuery();
      // Возвращаемся к главному меню или просто показываем помощь
      await ctx.reply('Главное меню');
    });

    // Обработчики кнопок пропуска фотографий
    this.bot.action('skip_palms', async (ctx) => {
      this.logger.log(`skip_palms callback received from user ${ctx.from?.id}`);
      await ctx.answerCbQuery();

      try {
        await this.analyzeHandler.handleSkipPalms(ctx);
        this.logger.log(`skip_palms callback completed for user ${ctx.from?.id}`);
      } catch (error) {
        this.logger.error(`Error in skip_palms callback for user ${ctx.from?.id}: ${error.message}`, error.stack);
      }
    });

    this.bot.action('survey_restart', async (ctx) => {
      await ctx.answerCbQuery();

      try {
        return await this.onboardingHandler.handleBackStartSurvey(ctx);
      } catch (e) {
        this.logger.error(`Start survey error: ${e}`);
      }
    })

    this.bot.action('complete_analysis', async (ctx) => {
      this.logger.log(`complete_analysis callback received from user ${ctx.from?.id}`);
      await ctx.answerCbQuery();

      try {
        await this.analyzeHandler.handleCompleteAnalysis(ctx);
        this.logger.log(`complete_analysis callback completed for user ${ctx.from?.id}`);
      } catch (error) {
        this.logger.error(
          `Error in complete_analysis callback for user ${ctx.from?.id}: ${error.message}`,
          error.stack,
        );
      }
    });

    this.bot.action('send_second_palm', async (ctx) => {
      this.logger.log(`send_second_palm callback received from user ${ctx.from?.id}`);
      await ctx.answerCbQuery();
      // Этот action означает что пользователь хочет отправить вторую ладонь
      // Просто удаляем сообщение с кнопками и ждем следующее фото
      try {
        await ctx.deleteMessage();
      } catch (error) {
        // Игнорируем ошибки удаления
      }
      await ctx.reply('📷 Отправь фото второй ладони');
      this.logger.log(`send_second_palm callback completed for user ${ctx.from?.id}`);
    });

    // Survey question handlers
    this.bot.action(/^survey_q(\d+)_(\d+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const questionNumber = parseInt(ctx.match[1]);
      const answerIndex = parseInt(ctx.match[2]);

      const userId = ctx.from?.id?.toString();
      if (userId) {
        const user = await this.userService.findUserInfoByTeleramId(userId);
        if (user) {
          await this.onboardingHandler.handleSurveyAnswer(ctx, user.id, questionNumber, answerIndex, false);
        }
      }
    });

    // Survey navigation back handlers
    this.bot.action(/^survey_back_to_q(\d+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const targetQuestionNumber = parseInt(ctx.match[1]);

      const userId = ctx.from?.id?.toString();
      if (userId) {
        const user = await this.userService.findUserInfoByTeleramId(userId);
        if (user) {
          this.logger.log(`Survey back navigation: user ${userId} going back to question ${targetQuestionNumber}`);
          await this.onboardingHandler.handleSurveyBackNavigation(ctx, user.id, targetQuestionNumber);
        }
      }
    });

    // Ready to start survey handler
    this.bot.action('ready_to_start_survey', async (ctx) => {
      await ctx.answerCbQuery();
      this.logger.log(`Ready to start survey callback from user ${ctx.from?.id}`);
      await this.onboardingHandler.handleReadyToStartSurvey(ctx);
    });

    // Analysis timeout recovery handlers
    this.bot.action('retry_photo_analysis', async (ctx) => {
      await ctx.answerCbQuery();
      this.logger.log(`Retry photo analysis callback from user ${ctx.from?.id}`);
      await this.onboardingHandler.handleRetryPhotoAnalysis(ctx);
    });

    this.bot.action('continue_without_analysis', async (ctx) => {
      await ctx.answerCbQuery();
      this.logger.log(`Continue without analysis callback from user ${ctx.from?.id}`);
      await this.onboardingHandler.handleContinueWithoutAnalysis(ctx);
    });

    // Photo message handler
    this.bot.on(['photo', 'document'], async (ctx) => {
      const userId = ctx.from?.id?.toString();
      if (userId) {
        const user = await this.userService.findUserInfoByTeleramId(userId);
        this.logger.log(`Photo received from user ${userId}, pipelineState: ${user?.pipelineState}`);

        if (user && user.pipelineState === 'WAITING_PHOTOS') {
          await this.analyzeHandler.handlePhotoMessage(ctx);
        } else {
          this.logger.log(
            `Photo ignored from user ${userId} - not in WAITING_PHOTOS state (current: ${user?.pipelineState})`,
          );
        }
      }
    });

    // Text message handler (disabled during survey, except custom answers and voice survey)
    this.bot.on('text', async (ctx) => {
      const userId = ctx.from?.id?.toString();
      if (userId) {
        const user = await this.userService.findUserInfoByTeleramId(userId);

        // Обрабатываем текстовые сообщения в состоянии WAITING_VOICE_SURVEY как альтернативу голосовым
        if (user && (user.pipelineState as any) === 'WAITING_VOICE_SURVEY' && 'text' in ctx.message) {
          this.logger.log(`Text message received in WAITING_VOICE_SURVEY from user ${userId}: ${ctx.message.text}`);

          // Обрабатываем текст как чувства (альтернатива голосовому сообщению)
          const textFeelings = ctx.message.text;

          // Устанавливаем состояние воронки "поделился чувствами"
          await this.userService.markFeelingsShared(user.id);

          // Завершаем опрос с текстовыми чувствами
          await this.onboardingHandler.completeSurvey(ctx, user.id, textFeelings);
          return;
        }

        // Во время опроса остальные текстовые сообщения игнорируются (только кнопки)
        // Исключение: состояния ожидания кастомных ответов обрабатываются через middleware
        if (
          user &&
          ((user.pipelineState as any) === 'SURVEY_IN_PROGRESS' ||
            (user.pipelineState as any)?.startsWith('WAITING_CUSTOM_ANSWER_Q'))
        ) {
          // Обработка через middleware - здесь просто игнорируем
        }
      }
    });

    // Voice message handler for survey final question
    this.bot.on('voice', async (ctx) => {
      const userId = ctx.from?.id?.toString();
      if (userId) {
        const user = await this.userService.findUserInfoByTeleramId(userId);
        if (user && (user.pipelineState as any) === 'WAITING_VOICE_SURVEY') {
          await this.onboardingHandler.handleSurveyVoice(ctx, user.id);
        }
      }
    });

    this.bot.help((ctx) => {
      ctx.reply('Help message here');
    });
  }

  private async startPolling() {
    this.logger.log('Starting bot in polling mode (development)');
    await this.bot.launch();
    this.logger.log('Bot started successfully in polling mode');

    process.once('SIGINT', () => {
      this.logger.log('Received SIGINT, stopping bot...');
      this.bot.stop('SIGINT');
    });
    process.once('SIGTERM', () => {
      this.logger.log('Received SIGTERM, stopping bot...');
      this.bot.stop('SIGTERM');
    });
  }

  private async setupWebhook() {
    const webhookUrl = this.configService.getBotWebhookUrl();
    const webhookPath = this.configService.getBotWebhookPath();
    const webhookSecret = this.configService.getBotWebhookSecret();

    if (!webhookUrl || !webhookSecret) {
      throw new Error('Webhook URL and secret are required for production');
    }

    this.logger.log('Setting up webhook for production mode');

    await this.bot.telegram.deleteWebhook({
      drop_pending_updates: false,
    });
    await this.bot.telegram.setWebhook(`${webhookUrl}${webhookPath}`, {
      drop_pending_updates: false,
      max_connections: 10000,
      secret_token: webhookSecret,
    });

    const webhookInfo = await this.bot.telegram.getWebhookInfo();
    this.logger.log('Webhook info:', {
      url: webhookInfo.url,
      has_custom_certificate: webhookInfo.has_custom_certificate,
      pending_update_count: webhookInfo.pending_update_count,
    });

    this.logger.log(`Webhook set up successfully: ${webhookUrl}${webhookPath}`);
  }

  getBot(): Telegraf {
    return this.bot;
  }

  async handleWebhookUpdate(update: any) {
    if (this.configService.isProduction()) {
      await this.bot.handleUpdate(update);
    }
  }

  private async setupNotificationListener() {
    try {
      await this.notificationService.subscribeToNotifications(async (message: NotificationMessage) => {
        await this.handleNotificationMessage(message);
      });
    } catch (error) {
      this.logger.error(`Failed to set up notification listener: ${error.message}`, error.stack);
    }
  }

  private async handleNotificationMessage(message: NotificationMessage): Promise<void> {
    await this.notificationHandlerService.handleNotificationMessage(this.bot, message);
  }

  /**
   * Извлекает payload из команды /start
   * Telegram отправляет команды в формате "/start payload" или "/start"
   * @param messageText - полный текст сообщения
   * @returns payload или null если его нет
   */
  private extractStartPayload(messageText: string): string | null {
    if (!messageText || !messageText.startsWith('/start')) {
      return null;
    }

    // Разделяем команду и параметры
    const parts = messageText.trim().split(' ');

    // Если есть только "/start" без параметров
    if (parts.length < 2) {
      return null;
    }

    // Возвращаем все после "/start " как payload
    const payload = parts.slice(1).join(' ').trim();

    this.logger.log(`Extracted payload from start command: "${payload}"`);

    return payload || null;
  }
}
