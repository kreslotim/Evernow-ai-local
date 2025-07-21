import { Injectable, Logger } from '@nestjs/common';
import { Context } from 'telegraf';
import { UserService } from '../../core/modules/user/user.service';
import { mapLanguageCode } from '../utils/language';
import { ReferralService } from '../../core/modules/referral/referral.service';

/**
 * Middleware для обработки пользователя при первом контакте
 * - Находит или создаёт пользователя в БД
 * - Обрабатывает реферальную ссылку
 * - Добавляет user и isNewUser в контекст
 */
@Injectable()
export class UserMiddleware {
  private readonly logger = new Logger(UserMiddleware.name);

  constructor(
    private readonly userService: UserService,
    private readonly referralService: ReferralService,
  ) {}

  getMiddleware() {
    return async (ctx: any, next: () => Promise<void>) => {
      try {
        if (!ctx.from) return next();

        const telegramId = ctx.from.id.toString();

        let user = await this.userService.findUserInfoByTeleramId(telegramId);
        let isNewUser = false;

        if (!user) {
          isNewUser = true;
          const referralCode = this.extractReferralCode(ctx.startPayload);

          user = await this.userService.createOrFindUser({
            telegramId,
            telegramUsername: ctx.from.username,
            telegramChatId: ctx.chat?.id?.toString(), // Добавляем telegramChatId для уведомлений
            language: mapLanguageCode(ctx.from.language_code),
            referralCode,
          });

          // Обработка реферальной ссылки если есть
          if (referralCode) {
            try {
              const referralResult = await this.referralService.processReferral(referralCode, user.id);
              ctx.referralResult = referralResult;
            } catch (error) {
              this.logger.warn(`Failed to process referral code ${referralCode}: ${error.message}`);
            }
          }
        }

        ctx.user = user;
        ctx.isNewUser = isNewUser;
      } catch (error) {
        this.logger.error(`Error in UserMiddleware: ${error.message}`, error.stack);
      }

      return next();
    };
  }

  /**
   * Извлекает реферальный код из payload
   * Поддерживает форматы:
   * - Прямой код: "ABCD1234" (из ссылок типа ?start=ABCD1234)
   * - С префиксом: "ref_ABCD1234" (для обратной совместимости)
   * @param payload - payload из команды /start
   * @returns реферальный код или null
   */
  private extractReferralCode(payload: string): string | null {
    if (!payload) {
      return null;
    }

    const trimmedPayload = payload.trim();

    // Формат с префиксом ref_ (обратная совместимость)
    if (trimmedPayload.startsWith('ref_')) {
      const code = trimmedPayload.substring(4);
      this.logger.log(`Extracted referral code with ref_ prefix: "${code}"`);
      return code;
    }

    // Прямой формат (основной) - проверяем что это похоже на реферальный код
    // Реферальные коды состоят из букв и цифр, длина 10 символов
    if (/^[A-Z0-9]{10}$/.test(trimmedPayload)) {
      this.logger.log(`Extracted referral code (direct format): "${trimmedPayload}"`);
      return trimmedPayload;
    }

    this.logger.debug(`Payload "${trimmedPayload}" does not match referral code format`);
    return null;
  }
}
