import { Injectable, Logger } from '@nestjs/common';
import { Context } from 'telegraf';
import { ConfigService } from 'src/core/modules/config/config.service';
import { UserService } from 'src/core/modules/user/user.service';
import { I18nService } from '../i18n/i18n.service';
import { PaymentService, Subscription, SubscriptionPlan } from './payment.service';
// UserFunnelAction больше не используется

export interface SubscriptionResult {
  isSubscribed: boolean;
  bonusGranted: boolean;
  message?: string;
}

/**
 * Результат проверки платной подписки
 */
export interface PaidSubscriptionResult {
  isActive: boolean;
  subscription?: Subscription;
  expiryDate?: Date;
  daysRemaining?: number;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * Проверка подписки на каналы Telegram (существующий функционал)
   * @param ctx Контекст Telegram
   * @param locale Язык пользователя
   * @returns Результат проверки подписки на каналы
   */
  async checkChannelSubscriptions(ctx: Context, locale: string): Promise<SubscriptionResult> {
    const userId = ctx.from?.id;
    if (!userId) {
      return { isSubscribed: false, bonusGranted: false };
    }

    try {
      const requiredChannels = this.configService.getRequiredChannels();
      if (!requiredChannels.length) {
        return { isSubscribed: true, bonusGranted: false }; // No channels configured
      }

      const user = await this.userService.findUserByTelegramId(userId.toString());
      if (!user) {
        return { isSubscribed: false, bonusGranted: false };
      }

      const subscriptionResults = [];
      for (const channelId of requiredChannels) {
        try {
          const normalizedChannelId = this.normalizeChannelId(channelId);
          const member = await ctx.telegram.getChatMember(normalizedChannelId, userId);
          const isSubscribed = ['creator', 'administrator', 'member'].includes(member.status);
          subscriptionResults.push({ channelId: normalizedChannelId, isSubscribed });
        } catch (error) {
          this.logger.warn(`Failed to check subscription for channel ${channelId}: ${error.message}`);
          subscriptionResults.push({ channelId, isSubscribed: false });
        }
      }

      const isSubscribedToAll = subscriptionResults.every((result) => result.isSubscribed);

      if (isSubscribedToAll) {
        // Упрощённая логика: всегда даём бонус при подписке на каналы
        await this.userService.addCredits(user.id, 1);

        return {
          isSubscribed: true,
          bonusGranted: true,
          message: this.i18nService.t('scenes.referral.subscription_success', locale),
        };
      } else {
        return {
          isSubscribed: false,
          bonusGranted: false,
          message: this.i18nService.t('scenes.referral.subscription_incomplete', locale),
        };
      }
    } catch (error) {
      this.logger.error(`Error checking channel subscriptions: ${error.message}`, error.stack);
      return { isSubscribed: false, bonusGranted: false };
    }
  }

  /**
   * Проверка платной подписки пользователя
   * @param userId ID пользователя в Telegram
   * @returns Результат проверки платной подписки
   */
  async checkPaidSubscription(userId: string): Promise<PaidSubscriptionResult> {
    try {
      this.logger.debug(`Checking paid subscription for user ${userId}`);

      const subscription = await this.paymentService.getSubscriptionStatus(userId);

      if (!subscription) {
        this.logger.debug(`No paid subscription found for user ${userId}`);
        return { isActive: false };
      }

      const now = new Date();
      const expiryDate = new Date(subscription.endDate);
      const isActive = subscription.status === 'ACTIVE' && expiryDate > now;

      let daysRemaining = 0;
      if (isActive) {
        daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      this.logger.debug(
        `Paid subscription check for user ${userId}: active=${isActive}, days remaining=${daysRemaining}`,
      );

      return {
        isActive,
        subscription,
        expiryDate,
        daysRemaining,
      };
    } catch (error) {
      this.logger.error(`Error checking paid subscription for user ${userId}:`, error.message);
      return { isActive: false };
    }
  }

  /**
   * Проверяет требуется ли подписка для продолжения и показывает соответствующее сообщение
   * @param ctx Контекст Telegram
   * @returns true если можно продолжать, false если нужна подписка
   */
  async requiresSubscription(ctx: Context): Promise<boolean> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return false;
    }

    try {
      const locale = ctx.from?.language_code === 'ru' ? 'ru' : 'en';

      // Проверяем платную подписку
      const paidSubscriptionResult = await this.checkPaidSubscription(userId);

      if (paidSubscriptionResult.isActive) {
        this.logger.debug(`User ${userId} has active paid subscription, allowing access`);
        return true;
      }

      // Если платной подписки нет, показываем сообщение с предложением оформить подписку
      const message = this.i18nService.t('subscription.required_message', locale);
      const planButton = this.i18nService.t('subscription.view_plans_button', locale);

      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [[{ text: planButton, callback_data: 'subscription_plans' }]],
        },
      });

      return false;
    } catch (error) {
      this.logger.error(`Error in requiresSubscription for user ${userId}:`, error.message);
      return false;
    }
  }

  /**
   * Получение доступных тарифных планов
   * @param botName Имя бота
   * @returns Список тарифных планов
   */
  async getSubscriptionPlans(botName?: string): Promise<SubscriptionPlan[]> {
    try {
      const defaultBotName = botName || this.configService.getSubscriptionBotName();
      return await this.paymentService.getSubscriptionPlans(defaultBotName);
    } catch (error) {
      this.logger.error(`Error fetching subscription plans:`, error.message);
      return [];
    }
  }

  /**
   * Форматирование информации о подписке для отображения пользователю
   * @param subscription Данные подписки
   * @param locale Язык пользователя
   * @returns Отформатированное сообщение
   */
  formatSubscriptionInfo(subscription: Subscription, locale: string): string {
    const statusText = this.i18nService.t(`subscription.status.${subscription.status.toLowerCase()}`, locale);
    const endDate = new Date(subscription.endDate).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US');

    return this.i18nService.t('subscription.info_template', locale, {
      planName: subscription.plan.name,
      status: statusText,
      endDate,
    });
  }

  private normalizeChannelId(channelId: string): string {
    if (channelId.startsWith('@')) {
      return channelId;
    }
    if (/^-?\d+$/.test(channelId)) {
      return channelId;
    }
    return `@${channelId}`;
  }

  getChannelButtons(locale: string): any[] {
    const requiredChannels = this.configService.getRequiredChannels();
    return requiredChannels.map((channelId) => {
      const username = channelId.startsWith('@') ? channelId.substring(1) : channelId;
      return { text: username, url: `https://t.me/${username}` };
    });
  }
}
