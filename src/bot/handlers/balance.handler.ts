import { Injectable, Logger } from '@nestjs/common';
import { Context, Markup } from 'telegraf';
import { Language } from '@prisma/client';
import { I18nService } from '../i18n/i18n.service';
import { UserService } from 'src/core/modules/user/user.service';
import { ReferralService } from 'src/core/modules/referral/referral.service';
import { getLocaleFromLanguage, mapLanguageCode } from '../utils/language';

let PackageHandlerRef: any;

export interface BalanceContext extends Context {
  user?: any;
  scene?: {
    enter: (sceneId: string) => Promise<void>;
    leave: () => Promise<void>;
  };
  session?: any;
}

@Injectable()
export class BalanceHandler {
  private readonly logger = new Logger(BalanceHandler.name);

  constructor(
    private readonly i18nService: I18nService,
    private readonly userService: UserService,
    private readonly referralService: ReferralService,
  ) {}

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

  setPackageHandler(packageHandler: any): void {
    PackageHandlerRef = packageHandler;
  }

  async showBalanceInfo(ctx: BalanceContext): Promise<void> {
    const locale = this.getUserLocale(ctx);

    try {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) {
        await ctx.reply(this.i18nService.t('errors.general', locale));
        return;
      }

      const user = await this.userService.findUserInfoByTeleramId(telegramId);
      if (!user) {
        await ctx.reply(this.i18nService.t('errors.not_registered', locale));
        return;
      }

      const referralCount = await this.getReferralCount(user.id);
      const remainingGenerations = user.analysisCredits || 0;
      const hasActiveSubscription =
        user.subscriptionActive && user.subscriptionExpiry && user.subscriptionExpiry > new Date();

      let balanceInfo: string;
      if (hasActiveSubscription) {
        const expiryDate = user.subscriptionExpiry!.toLocaleDateString('ru-RU');
        balanceInfo = this.i18nService.t('scenes.balance.infoWithSubscription', locale, {
          remainingGenerations: remainingGenerations.toString(),
          referrals: referralCount.toString(),
          subscriptionExpiry: expiryDate,
        });
      } else {
        balanceInfo = this.i18nService.t('scenes.balance.info', locale, {
          remainingGenerations: remainingGenerations.toString(),
          referrals: referralCount.toString(),
        });
      }

      const keyboard = this.getBalanceKeyboard(locale);

      // Удаляем предыдущее сообщение перед отправкой информации о балансе
      await this.safeDeletePreviousMessage(ctx);

      await ctx.reply(balanceInfo, {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup,
      });
    } catch (error) {
      this.logger.error(`Error showing balance info: ${error.message}`, error.stack);
      await ctx.reply(this.i18nService.t('errors.general', locale));
    }
  }

  async handleBalanceAction(ctx: BalanceContext, action: string): Promise<void> {
    const locale = this.getUserLocale(ctx);

    try {
      await ctx.answerCbQuery();

      switch (action) {
        case 'balance_buy_credits':
          await this.showPackagesScene(ctx);
          break;
        default:
          this.logger.warn(`Unknown balance action: ${action}`);
      }
    } catch (error) {
      this.logger.error(`Error handling balance action ${action}: ${error.message}`, error.stack);
      await ctx.reply(this.i18nService.t('errors.general', locale));
    }
  }

  private async getReferralCount(userId: string): Promise<number> {
    try {
      const stats = await this.referralService.getReferralStats(userId);
      return stats.totalReferrals;
    } catch (error) {
      this.logger.warn(`Failed to get referral count for user ${userId}: ${error.message}`);
      return 0;
    }
  }

  private async showPackagesScene(ctx: BalanceContext): Promise<void> {
    if (PackageHandlerRef) {
      await PackageHandlerRef.showPackages(ctx);
    } else {
      this.logger.error('PackageHandler not set - cannot show packages scene');
      const locale = this.getUserLocale(ctx);
      await ctx.reply(this.i18nService.t('errors.general', locale));
    }
  }

  private getBalanceKeyboard(locale: string): any {
    return Markup.inlineKeyboard([
      [Markup.button.callback(this.i18nService.t('scenes.balance.buy_credits_button', locale), 'balance_buy_credits')],
    ]);
  }

  private getUserLocale(ctx: BalanceContext): string {
    const userLanguage = ctx.user?.language || mapLanguageCode(ctx.from?.language_code);
    return getLocaleFromLanguage(userLanguage);
  }
}
