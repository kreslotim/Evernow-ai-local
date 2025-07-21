import { Injectable, Logger } from '@nestjs/common';
import { Telegraf, Markup } from 'telegraf';
import { NotificationMessage } from '../../core/modules/notification/notification.service';
import { UserService } from '../../core/modules/user/user.service';
import { I18nService } from '../i18n/i18n.service';
import { getLocaleFromLanguage } from '../utils/language';
import { AnalyzeType, Language, UserFunnelAction } from '@prisma/client';
import { AnalyzeHandler } from '../handlers/analyze.handler';
import { isCoupleAnalyze } from '../utils/analysis.util';
import { AnalyzeService } from '../../core/modules/analyze/analyze.service';
import { KeyboardService } from './keyboard.service';
import { formatQuote } from '../utils/telegram-formatting.util';
import { UserInfoService } from '../../core/modules/user-info/user-info.service';
import { OnboardingHandler } from '../handlers/onboarding.handler';

@Injectable()
export class NotificationHandlerService {
  private readonly logger = new Logger(NotificationHandlerService.name);

  // Telegram message length limit
  private readonly TELEGRAM_MESSAGE_LIMIT = 3800;

  constructor(
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
    private readonly analyzeHandler: AnalyzeHandler,
    private readonly analyzeService: AnalyzeService,
    private readonly keyboardService: KeyboardService,
    private readonly userInfoService: UserInfoService,
    private readonly onboardingHandler: OnboardingHandler,
  ) {}

  /**
   * Escapes HTML entities to prevent parsing errors
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Splits a long message into equal-sized parts for better presentation
   */
  private splitLongMessage(text: string, maxLength: number = this.TELEGRAM_MESSAGE_LIMIT): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    // Calculate how many parts we need and target size for each part
    const partsCount = Math.ceil(text.length / maxLength);
    const targetPartSize = Math.floor(text.length / partsCount);

    const parts: string[] = [];
    let remainingText = text;

    for (let i = 0; i < partsCount - 1; i++) {
      // Find the best split point around the target size
      let splitPoint = targetPartSize;

      // Look for paragraph break within reasonable range
      const searchStart = Math.max(targetPartSize * 0.7, targetPartSize - 500);
      const searchEnd = Math.min(targetPartSize * 1.3, targetPartSize + 500);

      const paragraphBreak = remainingText.lastIndexOf('\n\n', searchEnd);
      if (paragraphBreak >= searchStart) {
        splitPoint = paragraphBreak;
      } else {
        // Fall back to sentence break
        const sentenceBreak = remainingText.lastIndexOf('. ', searchEnd);
        if (sentenceBreak >= searchStart) {
          splitPoint = sentenceBreak + 1; // Include the period
        }
      }

      // Extract the part and add to results
      parts.push(remainingText.substring(0, splitPoint).trim());
      remainingText = remainingText.substring(splitPoint).trim();
    }

    // Add the remaining text as the last part
    if (remainingText.length > 0) {
      parts.push(remainingText);
    }

    return parts;
  }

  async handleNotificationMessage(bot: Telegraf, message: NotificationMessage): Promise<void> {
    try {
      const { type, chatId, data, analysisType } = message;

      // Get user language from database using telegram chat ID
      const userLanguage = await this.getUserLanguageFromChatId(chatId);
      const locale = getLocaleFromLanguage(userLanguage);

      switch (type) {
        case 'analysis_complete':
          await this.handleAnalysisComplete(bot, { chatId, data, analysisType, locale });
          break;

        case 'analysis_failed':
          await this.handleAnalysisFailed(bot, { chatId, data, locale });
          break;

        case 'new_referral':
          await this.handleNewReferral(bot, { chatId, data, locale });
          break;

        case 'referral_bonus':
          await this.handleReferralBonus(bot, { chatId, data, locale });
          break;

        case 'payment_success':
          await this.handlePaymentSuccess(bot, { chatId, data, locale });
          break;

        case 'payment_failed':
          await this.handlePaymentFailed(bot, { chatId, data, locale });
          break;

        case 'face_not_detected':
          await this.handleFaceNotDetected(bot, { chatId, analysisType, locale });
          break;

        case 'ai_analysis_refusal':
          await this.handleAiAnalysisRefusal(bot, { chatId, analysisType, locale });
          break;

        case 'funnel_message':
          await this.handleFunnelMessage(bot, { chatId, data, locale, userId: message.userId });
          break;

        case 'mini_app_closed':
          await this.handleMiniAppClosed(bot, { chatId, data, locale });
          break;

        default:
          this.logger.warn(`Unknown notification type: ${type}`);
      }

      this.logger.debug(`Notification handled: ${type} for chat ${chatId}`);
    } catch (error) {
      this.logger.error(`Failed to handle notification: ${error.message}`, error.stack);
    }
  }

  /**
   * Получает язык пользователя по chatId
   * @param chatId - ID чата (обычно равен telegramId для приватных чатов)
   * @returns Язык пользователя или RU по умолчанию
   */
  private async getUserLanguageFromChatId(chatId: string): Promise<Language> {
    try {
      // Проверяем валидность chatId
      if (!chatId || chatId === 'null' || chatId === 'undefined') {
        this.logger.warn(`Invalid chatId provided: "${chatId}", using default language`);
        return Language.RU;
      }

      // Convert chatId back to telegramId for user lookup
      // This assumes chatId is the same as telegramId, which is typical for private chats
      return await this.userService.getUserLanguage(chatId);
    } catch (error) {
      this.logger.error(`Failed to get user language for chat ${chatId}: ${error.message}`);
      return Language.RU; // Default fallback
    }
  }

  private async handleAnalysisComplete(
    bot: Telegraf,
    params: { chatId: string; data: any; analysisType: string; locale: string },
  ): Promise<void> {
    const { chatId, data, analysisType, locale } = params;

    // Получаем пользователя
    const user = await this.userService.findUserInfoByTeleramId(chatId);
    if (!user) {
      this.logger.error(`User not found for chatId ${chatId}`);
      return;
    }

    // Проверяем, что пользователь в правильном состоянии для получения результатов анализа
    const validStatesForAnalysis = ['PHOTOS_RECEIVED', 'WAITING_PHOTOS', 'ANALYSIS_COMPLETED'];

    if (user.pipelineState && !validStatesForAnalysis.includes(user.pipelineState)) {
      this.logger.warn(
        `User ${user.id} received analysis completion but is in unexpected state: ${user.pipelineState}. Proceeding anyway.`,
      );
    }

    try {
      // Сохраняем информацию в UserInfo
      const existingUserInfo = await this.userInfoService.getLatest(user.id);

      if (existingUserInfo) {
        // Обновляем существующую запись
        await this.userInfoService.update(existingUserInfo.id, {
          description: data?.description,
        });
        this.logger.log(`Updated existing UserInfo for user ${user.id}`);
      } else {
        // Создаём новую запись
        await this.userInfoService.create({
          userId: user.id,
          analysisId: data?.analyzeId,
          description: data?.description,
        });
        this.logger.log(`Created new UserInfo for user ${user.id}`);
      }

      // Обновляем состояние пользователя
      await this.userService.updateUser(user.id, {
        pipelineState: 'ANALYSIS_COMPLETED',
      });

      this.logger.log(`Updated user ${user.id} pipeline state to ANALYSIS_COMPLETED`);
    } catch (error) {
      this.logger.error(`Failed to save analysis results for user ${user.id}: ${error.message}`, error.stack);

      // При ошибке всё равно продолжаем, чтобы не потерять пользователя
      try {
        await this.userService.updateUser(user.id, {
          pipelineState: 'ANALYSIS_COMPLETED',
        });
      } catch (updateError) {
        this.logger.error(`Failed to update user state after error: ${updateError.message}`);
      }
    }

    this.logger.log(
      `✅ Analysis results saved in background for user ${user.id}. User has already continued onboarding.`,
    );
  }

  /**
   * Обрабатывает ошибку анализа
   * Возвращает пользователя в состояние ожидания фотографий для повторной попытки
   * @param bot - экземпляр Telegram бота
   * @param params - параметры обработки ошибки анализа
   */
  private async handleAnalysisFailed(
    bot: Telegraf,
    params: { chatId: string; data: any; locale: string },
  ): Promise<void> {
    const { chatId, data, locale } = params;

    try {
      // Находим пользователя для обновления состояния
      const user = await this.userService.findUserInfoByTeleramId(chatId);
      if (!user) {
        this.logger.error(`User not found for chatId: ${chatId} during analysis failure`);
        return;
      }

      // Отправляем сообщение об ошибке анализа
      const errorMessage = this.i18nService.t('scenes.analysis.error', locale, {
        error: data?.error || 'Unknown error occurred',
      });
      await bot.telegram.sendMessage(chatId, errorMessage);

      // ВАЖНО: Возвращаем пользователя в состояние ожидания фотографий для повторной попытки
      await this.userService.updateUser(user.id, {
        pipelineState: 'WAITING_PHOTOS',
      });

      // Очищаем сессию фотографий для чистого старта
      this.analyzeHandler.clearUserSession(chatId);

      // Отправляем сообщение с просьбой прислать новые фотографии
      const retryMessage = this.i18nService.t('scenes.analysis.send_photos', locale);
      await bot.telegram.sendMessage(chatId, retryMessage, {
        parse_mode: 'HTML',
      });

      this.logger.log(`User ${user.id} state reset to WAITING_PHOTOS after analysis failure`);
    } catch (error) {
      this.logger.error(`Failed to handle analysis failure: ${error.message}`, error.stack);

      // При ошибке всё равно пытаемся отправить базовое сообщение
      try {
        const fallbackMessage = this.i18nService.t('errors.general', locale);
        await bot.telegram.sendMessage(chatId, fallbackMessage);
      } catch (fallbackError) {
        this.logger.error(`Failed to send fallback message after analysis failure: ${fallbackError.message}`);
      }
    }
  }

  private async handleNewReferral(bot: Telegraf, params: { chatId: string; data: any; locale: string }): Promise<void> {
    const { chatId, data, locale } = params;

    const referralMessage = this.i18nService.t('notifications.new_referral', locale, {
      referralCount: data?.referralCount,
    });

    await bot.telegram.sendMessage(chatId, referralMessage);
  }

  private async handleReferralBonus(
    bot: Telegraf,
    params: { chatId: string; data: any; locale: string },
  ): Promise<void> {
    const { chatId, data, locale } = params;

    const bonusMessage = this.i18nService.t('notifications.referral_bonus', locale, {
      bonusCredits: data?.bonusCredits,
      referralCount: data?.referralCount,
    });

    await bot.telegram.sendMessage(chatId, bonusMessage);
  }

  private async handlePaymentSuccess(
    bot: Telegraf,
    params: { chatId: string; data: any; locale: string },
  ): Promise<void> {
    const { chatId, data, locale } = params;

    const paymentMessage = this.i18nService.t('notifications.payment_success', locale, {
      generationsAdded: data?.generationsAdded,
      amount: data?.amount,
    });

    await bot.telegram.sendMessage(chatId, paymentMessage);
  }

  private async handlePaymentFailed(
    bot: Telegraf,
    params: { chatId: string; data: any; locale: string },
  ): Promise<void> {
    const { chatId, data, locale } = params;

    const failedMessage = this.i18nService.t('notifications.payment_failed', locale, {
      error: data?.error || 'Payment processing failed',
    });

    await bot.telegram.sendMessage(chatId, failedMessage);
  }

  private async handleFaceNotDetected(
    bot: Telegraf,
    params: { chatId: string; analysisType: AnalyzeType; locale: string },
  ): Promise<void> {
    const { chatId, analysisType, locale } = params;

    try {
      // Обработка неудачных попыток фото упрощена
      const shouldDeductToken = false; // временно отключено
      const shouldWarn = false; // временно отключено
      const attemptCount = 1;
      const user = await this.userService.findUserInfoByTeleramId(chatId);

      if (!user) {
        this.logger.error(`User not found for chatId: ${chatId}`);
        return;
      }

      if (shouldDeductToken) {
        // Deduct 1 token from user on 5th failed attempt
        if (user.analysisCredits > 0) {
          try {
            await this.userService.deductCredits(user.id, 1);

            // Отправка сообщения о списании токена упрощена
            const deductedMessage = this.i18nService.t('errors.photo_token_deducted', locale);
            await bot.telegram.sendMessage(chatId, deductedMessage);
          } catch (error) {
            this.logger.error(`Failed to deduct credits: ${error.message}`);
            // Send regular error message if deduction fails
            const isCoupleAnalysis = isCoupleAnalyze(analysisType);
            let messageKey: string;
            if (isCoupleAnalysis) {
              messageKey = 'scenes.analysis.couple_faces_not_detected';
            } else {
              // KINETIC_ANALYZE и другие типы больше не поддерживаются
              messageKey = 'scenes.analysis.face_not_detected';
            }
            const message = this.i18nService.t(messageKey, locale);
            await bot.telegram.sendMessage(chatId, message);
          }
        } else {
          // User has no tokens, send regular error message
          const isCoupleAnalysis = isCoupleAnalyze(analysisType);
          let messageKey: string;
          if (isCoupleAnalysis) {
            messageKey = 'scenes.analysis.couple_faces_not_detected';
          } else {
            // KINETIC_ANALYZE и другие типы больше не поддерживаются
            messageKey = 'scenes.analysis.face_not_detected';
          }
          const message = this.i18nService.t(messageKey, locale);
          await bot.telegram.sendMessage(chatId, message);
        }

        // Сброс счётчика неудач временно отключён
        this.logger.debug('Photo failures reset and session set for retry');
        return;
      }

      if (shouldWarn) {
        // Отправка предупреждения упрощена
        const warningMessage = this.i18nService.t('errors.photo_token_warning', locale, {
          attempt: attemptCount,
          maxAttempts: 5,
        });
        await bot.telegram.sendMessage(chatId, warningMessage);
      } else {
        // First attempt or other cases - send regular error message
        const isCoupleAnalysis = isCoupleAnalyze(analysisType);
        let messageKey: string;
        if (isCoupleAnalysis) {
          messageKey = 'scenes.analysis.couple_faces_not_detected';
        } else {
          // KINETIC_ANALYZE и другие типы больше не поддерживаются
          messageKey = 'scenes.analysis.face_not_detected';
        }
        const message = this.i18nService.t(messageKey, locale);
        await bot.telegram.sendMessage(chatId, message);
      }

      // ВАЖНО: Возвращаем пользователя в состояние ожидания фотографий для повторной попытки
      await this.userService.updateUser(user.id, {
        pipelineState: 'WAITING_PHOTOS',
      });

      // Очищаем сессию фотографий для чистого старта
      this.analyzeHandler.clearUserSession(chatId);

      // Отправляем сообщение с просьбой прислать новые фотографии
      const retryMessage = this.i18nService.t('scenes.analysis.send_photos', locale);
      await bot.telegram.sendMessage(chatId, retryMessage, {
        parse_mode: 'HTML',
      });

      this.logger.log(`User ${user.id} state reset to WAITING_PHOTOS after face not detected`);
      this.logger.debug('Session set for retry');
    } catch (error) {
      this.logger.error(`Error handling face not detected: ${error.message}`, error.stack);

      try {
        // При ошибке тоже нужно найти пользователя и сбросить состояние
        const user = await this.userService.findUserInfoByTeleramId(chatId);
        if (user) {
          const isCoupleAnalysis = isCoupleAnalyze(analysisType);
          let messageKey: string;
          if (isCoupleAnalysis) {
            messageKey = 'scenes.analysis.couple_faces_not_detected';
          } else {
            // KINETIC_ANALYZE и другие типы больше не поддерживаются
            messageKey = 'scenes.analysis.face_not_detected';
          }
          const message = this.i18nService.t(messageKey, locale);
          await bot.telegram.sendMessage(chatId, message);

          // Сбрасываем состояние для повторной попытки
          await this.userService.updateUser(user.id, {
            pipelineState: 'WAITING_PHOTOS',
          });

          // Очищаем сессию фотографий для чистого старта
          this.analyzeHandler.clearUserSession(chatId);

          // Отправляем сообщение с просьбой прислать новые фотографии
          const retryMessage = this.i18nService.t('scenes.analysis.send_photos', locale);
          await bot.telegram.sendMessage(chatId, retryMessage, {
            parse_mode: 'HTML',
          });

          this.logger.log(`User ${user.id} state reset to WAITING_PHOTOS after error in face detection`);
        }
      } catch (fallbackError) {
        this.logger.error(`Failed to reset user state in error handler: ${fallbackError.message}`);
      }

      // Установка сессии для повтора временно отключена (catch block)
      this.logger.debug('Session set for retry in error handler');
    }
  }

  private async handleFunnelMessage(
    bot: Telegraf,
    params: { chatId: string; data: any; locale: string; userId: string },
  ): Promise<void> {
    const { chatId, data, userId } = params;

    try {
      const parseMode = data?.parseMode === 'HTML' ? 'HTML' : undefined;
      await bot.telegram.sendMessage(chatId, data?.message || '', {
        parse_mode: parseMode as any,
      });

      this.logger.debug(`Funnel message sent successfully to user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to send funnel message to ${chatId}: ${error.message}`);

      // Check if user blocked the bot
      if (error.response?.error_code === 403) {
        try {
          await this.userService.updateUser(userId, {
            botBlockedAt: new Date(), // отмечаем время блокировки
          });
          this.logger.log(`Marked user ${userId} as blocked bot`);
        } catch (updateError) {
          this.logger.error(`Failed to mark user as blocked: ${updateError.message}`);
        }
      }
    }
  }

  async handleAskAiCallback(bot: Telegraf, chatId: string, analysisType: AnalyzeType): Promise<void> {
    try {
      // Статистика AI чатов временно отключена
      this.logger.debug('AI chat request registered');

      // Get user language
      const userLanguage = await this.getUserLanguageFromChatId(chatId);
      const locale = getLocaleFromLanguage(userLanguage);

      const developmentMessage = this.i18nService.t('notifications.ai_feature_development', locale);

      await bot.telegram.sendMessage(chatId, developmentMessage, {
        parse_mode: 'HTML',
      });
    } catch (error) {
      this.logger.error(`Failed to handle ask AI callback: ${error.message}`, error.stack);

      try {
        const userLanguage = await this.getUserLanguageFromChatId(chatId);
        const locale = getLocaleFromLanguage(userLanguage);
        const developmentMessage = this.i18nService.t('notifications.ai_feature_development', locale);

        await bot.telegram.sendMessage(chatId, developmentMessage, {
          parse_mode: 'HTML',
        });
      } catch (fallbackError) {
        this.logger.error(`Failed to send fallback message: ${fallbackError.message}`);
      }
    }
  }

  /**
   * Обрабатывает отказ ИИ анализировать фотографии
   * Возвращает пользователя в состояние ожидания фотографий для повторной попытки
   * @param bot - экземпляр Telegram бота
   * @param params - параметры обработки отказа ИИ
   */
  private async handleAiAnalysisRefusal(
    bot: Telegraf,
    params: { chatId: string; analysisType: AnalyzeType; locale: string },
  ): Promise<void> {
    const { chatId, analysisType, locale } = params;

    try {
      // Находим пользователя для обновления состояния
      const user = await this.userService.findUserInfoByTeleramId(chatId);
      if (!user) {
        this.logger.error(`User not found for chatId: ${chatId} during AI analysis refusal`);
        return;
      }

      // Отправляем сообщение об отказе ИИ
      const refusalMessage = this.i18nService.t('errors.ai_analysis_failed', locale);
      await bot.telegram.sendMessage(chatId, refusalMessage, {
        parse_mode: 'HTML',
      });

      // ВАЖНО: Возвращаем пользователя в состояние ожидания фотографий для повторной попытки
      await this.userService.updateUser(user.id, {
        pipelineState: 'WAITING_PHOTOS',
      });

      // Очищаем сессию фотографий для чистого старта
      this.analyzeHandler.clearUserSession(chatId);

      // Отправляем сообщение с просьбой прислать новые фотографии
      const retryMessage = this.i18nService.t('scenes.analysis.send_photos', locale);
      await bot.telegram.sendMessage(chatId, retryMessage, {
        parse_mode: 'HTML',
      });

      this.logger.log(`User ${user.id} state reset to WAITING_PHOTOS after AI analysis refusal`);
    } catch (error) {
      this.logger.error(`Failed to handle AI analysis refusal: ${error.message}`, error.stack);

      // При ошибке всё равно пытаемся отправить базовое сообщение
      try {
        const fallbackMessage = this.i18nService.t('errors.general', locale);
        await bot.telegram.sendMessage(chatId, fallbackMessage);
      } catch (fallbackError) {
        this.logger.error(`Failed to send fallback message after AI refusal: ${fallbackError.message}`);
      }
    }
  }

  /**
   * Обрабатывает закрытие мини-приложения и запускает следующий этап онбординга
   */
  private async handleMiniAppClosed(
    bot: Telegraf,
    params: { chatId: string; data: any; locale: string },
  ): Promise<void> {
    const { chatId, data, locale } = params;

    try {
      this.logger.log(`Processing mini app closure for user ${data?.userId}`);

      // Создаём контекст для OnboardingHandler
      const proxyCtx = {
        reply: async (text: string, options?: any) => {
          return bot.telegram.sendMessage(chatId, text, options);
        },
        telegram: bot.telegram,
        from: { id: parseInt(chatId) },
        chat: { id: parseInt(chatId) },
      } as any;

      // Переходим к финальному сообщению после закрытия мини-аппа
      if (data?.userId && data?.nextAction === 'PROCEED_TO_FINAL_MESSAGE') {
        await this.onboardingHandler.handleMiniAppFinish(proxyCtx, data.userId);
        this.logger.log(`Proceeding to final message for user ${data.userId}`);
      } else {
        this.logger.warn(`Invalid data for mini app closure: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle mini app closure: ${error.message}`, error.stack);

      // Отправляем сообщение об ошибке пользователю
      try {
        const errorMessage = this.i18nService.t('errors.general', locale);
        await bot.telegram.sendMessage(chatId, errorMessage);
      } catch (sendError) {
        this.logger.error(`Failed to send error message: ${sendError.message}`);
      }
    }
  }
}
