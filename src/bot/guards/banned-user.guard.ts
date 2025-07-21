import { Injectable, Logger } from '@nestjs/common';
import { Context } from 'telegraf';
import { I18nService } from '../i18n/i18n.service';
import { UserService } from 'src/core/modules/user/user.service';
import { getLocaleFromLanguage } from '../utils/language';
import { Language } from '@prisma/client';

@Injectable()
export class BannedUserGuard {
  private readonly logger = new Logger(BannedUserGuard.name);

  constructor(
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
  ) {}

  createMiddleware() {
    return async (ctx: Context, next: () => Promise<void>) => {
      try {
        // Always allow /start command for banned users to show ban message
        const message = ctx.message || (ctx.callbackQuery as any)?.message;
        const command = (message as any)?.text;

        const userId = ctx.from?.id?.toString();
        if (!userId) {
          return next();
        }

        const user = await this.userService.findUserInfoByTeleramId(userId);

        if (user?.isBanned) {
          const locale = getLocaleFromLanguage(user.language || Language.RU);
          const banMessage = this.i18nService.t('errors.account_banned', locale, {
            supportLink: `@${process.env.TELEGRAM_SUPPORT_USERNAME}`,
          });

          await ctx.reply(banMessage, { parse_mode: 'HTML' });

          this.logger.warn(`Banned user ${userId} attempted to use bot: ${command || 'unknown action'}`);
          return; // Don't call next() - stop execution
        }

        return next();
      } catch (error) {
        this.logger.error(`Error in banned user middleware: ${error.message}`, error.stack);
        return next(); // Continue on error to avoid breaking the bot
      }
    };
  }
}
