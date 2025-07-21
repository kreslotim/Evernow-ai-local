import { Injectable, Logger } from '@nestjs/common';
import { Context } from 'telegraf';
import { UserService } from 'src/core/modules/user/user.service';
import { I18nService } from '../i18n/i18n.service';
import { KeyboardService } from '../services/keyboard.service';
import { getLocaleFromLanguage } from '../utils/language';
import { SkipAllGuards } from '../decorators/skip-guards.decorator';
import { OnboardingHandler } from './onboarding.handler';
import { WelcomePhotoService } from 'src/core/modules/welcome-photo/welcome-photo.service';
import * as path from 'path';
import { FunnelState, UserPipelineState } from '@prisma/client';

export interface StartContext extends Context {
  user?: any;
  isNewUser?: boolean;
  referralResult?: any;
}

@SkipAllGuards()
@Injectable()
export class StartHandler {
  private readonly logger = new Logger(StartHandler.name);

  constructor(
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
    private readonly keyboardService: KeyboardService,
    private readonly onboardingHandler: OnboardingHandler,
    private readonly welcomePhotoService: WelcomePhotoService,
  ) { }

  /**
   * Безопасно удаляет предыдущее сообщение перед отправкой нового
   * @param ctx - Контекст Telegram
   */
  private async safeDeletePreviousMessage(ctx: Context): Promise<void> {
    try {
      if (ctx.callbackQuery && 'message' in ctx.callbackQuery && ctx.callbackQuery.message) {
        // Если это callback query, удаляем сообщение с кнопкой
        await ctx.deleteMessage();
        this.logger.log('Previous message deleted successfully (callback)');
      }
    } catch (error) {
      // Ошибки удаления не критичны - сообщение могло быть уже удалено
      this.logger.warn(`Failed to delete previous message: ${error.message}`);
    }
  }

  /**
   * Обрабатывает команду /start
   * Использует user и referralResult из контекста, установленные UserMiddleware
   * @param ctx - контекст с пользователем из middleware
   * @param payload - дополнительный payload (не используется, так как middleware уже обработал)
   */
  async handleStartCommand(ctx: StartContext, payload?: string): Promise<void> {
    try {
      this.logger.log('Start command received');

      if (!ctx.from) {
        this.logger.error('No user information in context');
        const errorMessage = await this.i18nService.translateAsync('errors.general', 'ru');
        await ctx.reply(errorMessage);
        return;
      }

      // Используем user из контекста, установленный UserMiddleware
      let user = ctx.user;
      const isNewUser = ctx.isNewUser || false;
      const referralResult = ctx.referralResult || null;

      // Fallback: если middleware не сработал, создаем пользователя вручную
      if (!user) {
        this.logger.warn('User not found in context, creating manually');
        const telegramId = ctx.from.id.toString();

        user = await this.userService.createOrFindUser({
          telegramId,
          telegramUsername: ctx.from.username,
          telegramChatId: ctx.chat?.id?.toString(),
          language: 'RU',
        });
      }

      this.logger.log(
        `User ${user.id} accessed start command. New user: ${isNewUser}. Referral result: ${!!referralResult}`,
      );

      // Логируем реферальную информацию если есть
      if (referralResult && referralResult.bonusGranted) {
        this.logger.log(
          `User ${user.id} was referred by user ${referralResult.referrer.id}. Bonus granted: ${referralResult.referrerBonusGranted}`,
        );
      }

      // Отправляем приветственное сообщение
      await this.sendWelcomeMessage(ctx, user, isNewUser, referralResult);
    } catch (error) {
      this.logger.error(`Error in handleStartCommand: ${error.message}`, error.stack);

      // При ошибке отправляем базовое сообщение
      const errorMessage = await this.i18nService.translateAsync('errors.general', 'ru');
      await ctx.reply(errorMessage);
    }
  }

  /**
   * Отправляет приветственное сообщение пользователю
   * @param ctx - контекст Telegram
   * @param user - объект пользователя
   * @param isNewUser - новый ли пользователь
   * @param referralResult - результат обработки реферала (если есть)
   */
  private async sendWelcomeMessage(
    ctx: StartContext,
    user: any,
    isNewUser: boolean,
    referralResult: any,
  ): Promise<void> {
    try {
      // Проверяем состояние пользователя для восстановления онбординга
      if (user.pipelineState && user.pipelineState !== 'ONBOARDING_COMPLETE') {
        this.logger.log(`User ${user.id} has active pipeline state: ${user.pipelineState}, resuming onboarding`);
        await this.onboardingHandler.resumeOnboarding(ctx, user);
        return;
      }

      // Если пользователь новый или завершил онбординг - отправляем обычное приветствие
      const name =
        user.telegramUsername ||
        (await this.i18nService.translateAsync('common.default_user', getLocaleFromLanguage(user.language)));
      const locale = getLocaleFromLanguage(user.language);

      // Удаляем предыдущее сообщение если это не новый пользователь
      if (!isNewUser) {
        await this.safeDeletePreviousMessage(ctx);
      }

      let message: string;
      let extraMessage = '';

      // Базовое приветственное сообщение
      message = await this.i18nService.tAsync('greeting.auto_registered', locale, {
        name,
      });

      // Добавляем сообщение о реферальном бонусе если есть
      if (referralResult && referralResult.bonusGranted) {
        const referralBonusMessage = await this.i18nService.tAsync('greeting.referral_bonus', locale);
        extraMessage += '\n\n' + referralBonusMessage;

        this.logger.log(`Added referral bonus message for user ${user.id}`);
      }

      // Устанавливаем состояние пользователя - ожидание фотографий (только для новых/завершивших)
      if (!user.pipelineState || user.pipelineState === 'ONBOARDING_COMPLETE') {
        await this.userService.updateUser(user.id, {
          pipelineState: 'WAITING_PHOTOS',
        });
        this.logger.log(`Set pipeline state to WAITING_PHOTOS for user ${user.id}`);
      }

      message += extraMessage;

      // Загружаем активные фотографии приветствия
      try {
        const welcomePhotos = await this.welcomePhotoService.getActiveWelcomePhotos();


        if (welcomePhotos.length === 0) {
          // Нет фотографий - отправляем только текст
          await ctx.reply(message, {
            parse_mode: 'HTML',
          });
          this.logger.log(`Отправлено приветственное сообщение без фотографий пользователю ${user.id}`);
        } else if (welcomePhotos.length === 1) {
          // Одна фотография - отправляем её с приветственным текстом как caption
          const photo = welcomePhotos[0];
          const absolutePath = path.resolve(process.cwd(), photo.filePath);

          await ctx.replyWithPhoto(
            { source: absolutePath },
            {
              caption: message,
              parse_mode: 'HTML',
            },
          );
          this.logger.log(`Отправлено приветственное сообщение с одной фотографией пользователю ${user.id}`);
        } else {
          // Несколько фотографий - отправляем как media group с приветственным текстом в первой фотографии
          const mediaGroup = welcomePhotos.map((photo, index) => ({
            type: 'photo' as const,
            media: { source: path.resolve(process.cwd(), photo.filePath) },
            caption: index === 0 ? message : undefined, // Только первая фотография имеет caption
            parse_mode: 'HTML' as const,
          }));

          await ctx.replyWithMediaGroup(mediaGroup);
          this.logger.log(
            `Отправлено приветственное сообщение с ${welcomePhotos.length} фотографиями как media group пользователю ${user.id}`,
          );
        }
      } catch (photosError) {
        this.logger.error(
          `Ошибка загрузки или отправки фотографий приветствия для пользователя ${user.id}: ${photosError.message}`,
          photosError.stack,
        );

        // При ошибке с фотографиями отправляем хотя бы текстовое сообщение
        await ctx.reply(message, {
          parse_mode: 'HTML',
        });
        this.logger.log(`Отправлено запасное приветственное сообщение без фотографий пользователю ${user.id}`);
      }
    } catch (error) {
      this.logger.error(`Error in sendWelcomeMessage: ${error.message}`, error.stack);

      // При ошибке отправляем базовое сообщение
      const locale = getLocaleFromLanguage(user.language);
      const errorMessage = await this.i18nService.tAsync('errors.general', locale);
      await ctx.reply(errorMessage);
    }
  }
}
