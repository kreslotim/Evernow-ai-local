import { Injectable, Logger } from '@nestjs/common';
import { Context } from 'telegraf';
import { OnboardingHandler } from '../handlers/onboarding.handler';
import { UserService } from 'src/core/modules/user/user.service';
import { I18nService } from '../i18n/i18n.service';
import { getLocaleFromLanguage } from '../utils/language';

/**
 * OnboardingMiddleware
 * --------------------
 * Middleware для автоматического восстановления онбординга пользователей.
 * Перехватывает сообщения пользователей в активном онбординге и направляет их
 * к соответствующим обработчикам состояний.
 *
 * Обеспечивает безопасную сеть для предотвращения случайного прерывания
 * процесса онбординга пользователями.
 */
@Injectable()
export class OnboardingMiddleware {
  private readonly logger = new Logger(OnboardingMiddleware.name);

  constructor(
    private readonly onboardingHandler: OnboardingHandler,
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
  ) {}

  /**
   * Основной middleware для проверки состояния онбординга
   * @returns Функция middleware для Telegraf
   */
  use() {
    return async (ctx: Context, next: () => Promise<void>) => {
      try {
        // Пропускаем callback queries (inline кнопки) - они обрабатываются отдельно
        if (ctx.callbackQuery) {
          return next();
        }

        // Пропускаем команды - они обрабатываются в своих handlers
        if (ctx.message && 'text' in ctx.message && ctx.message.text?.startsWith('/')) {
          return next();
        }

        // Получаем пользователя из контекста (должен быть установлен user.middleware)
        const user = (ctx as any).user;
        if (!user) {
          return next();
        }

        // Проверяем, находится ли пользователь в активном онбординге
        if (!this.isUserInActiveOnboarding(user)) {
          return next();
        }

        this.logger.log(`User ${user.id} is in active onboarding state: ${user.pipelineState}`);

        // Обрабатываем сообщения в зависимости от состояния
        const handled = await this.handleOnboardingMessage(ctx, user);

        if (handled) {
          // Сообщение обработано middleware, не передаем дальше
          return;
        }

        // Если не обработано, передаем дальше в цепочку
        return next();
      } catch (error) {
        this.logger.error(`Error in onboarding middleware: ${error.message}`, error.stack);
        // При ошибке продолжаем нормальную обработку
        return next();
      }
    };
  }

  /**
   * Проверяет, находится ли пользователь в активном онбординге
   * @param user - Объект пользователя
   * @returns true, если пользователь в активном онбординге
   */
  private isUserInActiveOnboarding(user: any): boolean {
    return user.pipelineState && user.pipelineState !== 'ONBOARDING_COMPLETE' && user.pipelineState !== null;
  }

  /**
   * Обрабатывает сообщения пользователей в онбординге
   * @param ctx - Контекст Telegram
   * @param user - Объект пользователя
   * @returns true, если сообщение было обработано
   */
  private async handleOnboardingMessage(ctx: Context, user: any): Promise<boolean> {
    try {
      const message = ctx.message;
      if (!message) {
        return false;
      }

      const userId = user.id;
      const currentState = user.pipelineState;

      // Обрабатываем сообщения в зависимости от текущего состояния
      switch (currentState) {
        case 'WAITING_PHOTOS':
          // В состоянии ожидания фото принимаем только фотографии
          if ('photo' in message) {
            // Пропускаем фото дальше для обработки в photo handlers
            return false;
          } else {
            // Напоминаем о необходимости отправить фото
            await this.onboardingHandler.resumeOnboarding(ctx, user);
            return true;
          }

        case 'SURVEY_IN_PROGRESS':
          // В состоянии опроса принимаем как callback кнопки, так и текстовые сообщения как кастомные ответы
          if ('text' in message) {
            // Обрабатываем текстовое сообщение как кастомный ответ на текущий вопрос
            this.logger.log(`Text message in SURVEY_IN_PROGRESS for user ${userId}: ${message.text}`);
            await this.onboardingHandler.processSurveyCustomAnswer(ctx, userId, message.text);
            return true;
          } else {
            // Другие типы сообщений - восстанавливаем состояние
            await this.onboardingHandler.resumeOnboarding(ctx, user);
            return true;
          }

        case 'WAITING_VOICE_SURVEY':
          // В состоянии ожидания голосового принимаем только голосовые сообщения
          this.logger.log(`WAITING_VOICE_SURVEY: message type check for user ${userId}:`, {
            hasVoice: 'voice' in message,
            hasText: 'text' in message,
            messageKeys: Object.keys(message),
            messageType: message.constructor.name,
          });

          if ('voice' in message) {
            // Пропускаем голосовое дальше для обработки
            this.logger.log(`Voice message detected for user ${userId}, passing to handler`);
            return false;
          } else if ('text' in message) {
            // Напоминаем что нужно голосовое (но пользователь может отправить и текст)
            this.logger.log(`Text message in WAITING_VOICE_SURVEY for user ${userId}, allowing it to pass through`);
            // Текстовые сообщения тоже разрешаем - пользователь может написать чувства текстом
            return false;
          } else {
            // Другие типы сообщений - восстанавливаем состояние
            this.logger.log(`Other message type in WAITING_VOICE_SURVEY for user ${userId}, resuming onboarding`);
            await this.onboardingHandler.resumeOnboarding(ctx, user);
            return true;
          }

        case 'ANALYSIS_COMPLETED_PENDING_TRANSITION':
          // Специальное состояние для media groups - пользователь готов к переходу
          // Переводим к следующему этапу при любом взаимодействии
          this.logger.log(`User ${userId} in pending transition state, moving to next onboarding step`);

          // Обновляем состояние на ANALYSIS_COMPLETED
          await this.userService.updateUser(userId, {
            pipelineState: 'ANALYSIS_COMPLETED' as any,
          });

          // Переходим к следующему этапу
          await this.onboardingHandler.sendNextOnboardingMessage(ctx, userId);
          return true;

        case 'PHOTOS_RECEIVED':
        case 'ANALYSIS_COMPLETED':
        case 'MINI_APP_OPENED':
        case 'FINAL_MESSAGE_SENT':
          // В этих состояниях любые сообщения кроме inline кнопок
          // могут мешать процессу - восстанавливаем состояние
          await this.onboardingHandler.resumeOnboarding(ctx, user);
          return true;

        default:
          // Неизвестное состояние - пропускаем дальше
          return false;
      }
    } catch (error) {
      this.logger.error(`Error handling onboarding message: ${error.message}`, error.stack);
      return false;
    }
  }
}
