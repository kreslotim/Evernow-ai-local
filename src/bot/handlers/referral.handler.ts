import { Injectable, Logger } from '@nestjs/common';
import { Context, Markup } from 'telegraf';
import { I18nService } from '../i18n/i18n.service';
import { UserService } from 'src/core/modules/user/user.service';
import { ReferralService } from 'src/core/modules/referral/referral.service';
import { SubscriptionService } from '../services/subscription.service';
import { ConfigService } from 'src/core/modules/config/config.service';
import { getLocaleFromLanguage, mapLanguageCode } from '../utils/language';

export interface ReferralContext extends Context {
  user?: any;
  scene?: {
    enter: (sceneId: string) => Promise<void>;
    leave: () => Promise<void>;
  };
  session?: any;
}

@Injectable()
export class ReferralHandler {
  private readonly logger = new Logger(ReferralHandler.name);

  constructor(
    private readonly i18nService: I18nService,
    private readonly userService: UserService,
    private readonly referralService: ReferralService,
    private readonly subscriptionService: SubscriptionService,
    private readonly configService: ConfigService,
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

  async showReferralInfo(ctx: ReferralContext): Promise<void> {
    const locale = this.getUserLocale(ctx);

    try {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) {
        await ctx.reply(this.i18nService.t('errors.general', locale));
        return;
      }

      const user = await this.userService.findUserByTelegramId(telegramId);
      if (!user) {
        await ctx.reply(this.i18nService.t('errors.not_registered', locale));
        return;
      }

      const referralStats = await this.referralService.getReferralStats(user.id);
      const referralCount = referralStats.totalReferrals;

      const botUsername = this.configService.getBotUsername();
      const referralLink = this.createReferralLink(botUsername, user.referralCode);

      const referralBonus = process.env.REFERRAL_BONUS || '1';

      const referralInfo = `${this.i18nService.t('scenes.referral.info', locale, {
        count: referralCount.toString(),
        code: user.referralCode,
        link: referralLink,
        referralBonus,
      })}${this.i18nService.t('scenes.referral.earn_token_message', locale)}`;

      const keyboard = this.getReferralKeyboard(user, locale);

      // Удаляем предыдущее сообщение перед отправкой информации о рефералах
      await this.safeDeletePreviousMessage(ctx);

      await ctx.reply(referralInfo, {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup,
        link_preview_options: {
          is_disabled: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error showing referral info: ${error.message}`, error.stack);
      await ctx.reply(this.i18nService.t('errors.general', locale));
    }
  }

  async handleReferralAction(ctx: ReferralContext, action: string): Promise<void> {
    const locale = this.getUserLocale(ctx);

    try {
      await ctx.answerCbQuery();

      switch (action) {
        case 'referral_earn_token':
          await this.showSubscriptionPrompt(ctx, locale);
          break;
        case 'referral_check_subscription':
          await this.checkSubscription(ctx, locale);
          break;
        default:
          this.logger.warn(`Unknown referral action: ${action}`);
      }
    } catch (error) {
      this.logger.error(`Error handling referral action ${action}: ${error.message}`, error.stack);
      await ctx.reply(this.i18nService.t('errors.general', locale));
    }
  }

  private async showSubscriptionPrompt(ctx: ReferralContext, locale: string): Promise<void> {
    try {
      const subscriptionPrompt = this.i18nService.t('scenes.referral.subscription_prompt', locale);
      const channelButtons = this.subscriptionService.getChannelButtons(locale);

      const keyboard = [];

      // Add channel buttons
      for (const button of channelButtons) {
        keyboard.push([Markup.button.url(button.text, button.url)]);
      }

      // Add check subscription button
      keyboard.push([
        Markup.button.callback(
          this.i18nService.t('scenes.referral.check_subscription_button', locale),
          'referral_check_subscription',
        ),
      ]);

      // Редактируем текущее сообщение вместо удаления (для callback query)
      await ctx.editMessageText(subscriptionPrompt, {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup,
      });
    } catch (error) {
      this.logger.error(`Error showing subscription prompt: ${error.message}`, error.stack);
      await ctx.reply(this.i18nService.t('errors.general', locale));
    }
  }

  private async checkSubscription(ctx: ReferralContext, locale: string): Promise<void> {
    try {
      const result = await this.subscriptionService.checkChannelSubscriptions(ctx, locale);

      if (result.bonusGranted && result.message) {
        await ctx.editMessageText(result.message, { parse_mode: 'HTML' });

        // Show referral info again after bonus is granted
        setTimeout(async () => {
          await this.showReferralInfo(ctx);
        }, 1000);
      } else if (result.message) {
        await ctx.answerCbQuery(result.message);

        if (!result.isSubscribed) {
          return;
        } else {
          await this.showReferralInfo(ctx);
        }
      }
    } catch (error) {
      this.logger.error(`Error checking subscription: ${error.message}`, error.stack);
      await ctx.answerCbQuery(this.i18nService.t('errors.general', locale));
    }
  }

  private getReferralKeyboard(user: any, locale: string): any {
    const buttons = [];

    // Всегда показываем кнопку заработка токенов
    buttons.push([
      Markup.button.callback(this.i18nService.t('scenes.referral.earn_token_button', locale), 'referral_earn_token'),
    ]);

    return Markup.inlineKeyboard(buttons);
  }

  private createReferralLink(botUsername: string, referralCode: string): string {
    return `https://t.me/${botUsername}?start=${referralCode}`;
  }

  private getUserLocale(ctx: ReferralContext): string {
    const userLanguage = ctx.user?.language || mapLanguageCode(ctx.from?.language_code);
    return getLocaleFromLanguage(userLanguage);
  }
}
