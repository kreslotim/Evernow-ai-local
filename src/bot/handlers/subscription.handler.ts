import { Injectable, Logger } from '@nestjs/common';
import { Context, Markup } from 'telegraf';
import { PaymentService, SubscriptionPlan, Subscription } from '../services/payment.service';
import { SubscriptionService } from '../services/subscription.service';
import { UserService } from 'src/core/modules/user/user.service';
import { I18nService } from '../i18n/i18n.service';
import { getLocaleFromLanguage } from '../utils/language';

/**
 * Handler для управления подписками пользователей
 */
@Injectable()
export class SubscriptionHandler {
  private readonly logger = new Logger(SubscriptionHandler.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly subscriptionService: SubscriptionService,
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
  ) {}

  /**
   * Показать доступные тарифные планы
   * @param ctx Контекст Telegram
   */
  async handleSubscriptionPlans(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) {
        return;
      }

      this.logger.debug(`Showing subscription plans for user ${telegramId}`);

      const user = await this.userService.findUserByTelegramId(telegramId);
      if (!user) {
        return;
      }

      const locale = getLocaleFromLanguage(user.language);
      const plans = await this.subscriptionService.getSubscriptionPlans();

      if (plans.length === 0) {
        const noPlansMessage = this.i18nService.t('subscription.no_plans_available', locale);
        await ctx.reply(noPlansMessage);
        return;
      }

      const headerMessage = this.i18nService.t('subscription.choose_plan_message', locale);
      const buttons = [];

      // Создаем кнопки для каждого плана
      for (const plan of plans) {
        const planText = this.formatPlanButton(plan, locale);
        buttons.push([Markup.button.callback(planText, `create_subscription:${plan.id}`)]);
      }

      // Добавляем кнопку "Назад"
      buttons.push([Markup.button.callback(this.i18nService.t('keyboard.back', locale), 'subscription_back')]);

      await ctx.reply(headerMessage, {
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
      });
    } catch (error) {
      this.logger.error(`Error showing subscription plans:`, error.message);
      await this.sendErrorMessage(ctx, 'subscription.error_loading_plans');
    }
  }

  /**
   * Создать подписку для выбранного плана
   * @param ctx Контекст Telegram
   * @param planId ID выбранного плана
   */
  async handleCreateSubscription(ctx: Context, planId: string): Promise<void> {
    try {
      const telegramId = ctx.from?.id?.toString();
      const username = ctx.from?.username || ctx.from?.first_name || 'User';

      if (!telegramId) {
        return;
      }

      this.logger.debug(`Creating subscription for user ${telegramId} with plan ${planId}`);

      const user = await this.userService.findUserByTelegramId(telegramId);
      if (!user) {
        return;
      }

      const locale = getLocaleFromLanguage(user.language);

      // Создаем подписку через payment service
      const createResponse = await this.paymentService.createSubscription(telegramId, username, planId);

      const successMessage = this.i18nService.t('subscription.payment_link_created', locale, {
        planName: createResponse.subscription.plan.name,
      });

      const buttons = [
        [Markup.button.url(this.i18nService.t('subscription.pay_button', locale), createResponse.paymentLink)],
        [Markup.button.callback(this.i18nService.t('keyboard.back', locale), 'subscription_plans')],
      ];

      await ctx.reply(successMessage, {
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
      });

      this.logger.debug(`Payment link created for user ${telegramId}: ${createResponse.paymentLink}`);
    } catch (error) {
      this.logger.error(`Error creating subscription for plan ${planId}:`, error.message);
      await this.sendErrorMessage(ctx, 'subscription.error_creating_subscription');
    }
  }

  /**
   * Показать текущий статус подписки пользователя
   * @param ctx Контекст Telegram
   */
  async handleSubscriptionStatus(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) {
        return;
      }

      this.logger.debug(`Checking subscription status for user ${telegramId}`);

      const user = await this.userService.findUserByTelegramId(telegramId);
      if (!user) {
        return;
      }

      const locale = getLocaleFromLanguage(user.language);
      const paidSubscriptionResult = await this.subscriptionService.checkPaidSubscription(telegramId);

      if (!paidSubscriptionResult.isActive || !paidSubscriptionResult.subscription) {
        const noSubscriptionMessage = this.i18nService.t('subscription.no_active_subscription', locale);
        const buttons = [
          [Markup.button.callback(this.i18nService.t('subscription.view_plans_button', locale), 'subscription_plans')],
        ];

        await ctx.reply(noSubscriptionMessage, {
          reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
        });
        return;
      }

      const subscription = paidSubscriptionResult.subscription;
      const statusMessage = this.subscriptionService.formatSubscriptionInfo(subscription, locale);
      const buttons = [];

      // Добавляем кнопки в зависимости от статуса подписки
      if (subscription.status === 'ACTIVE') {
        buttons.push([
          Markup.button.callback(
            this.i18nService.t('subscription.pause_button', locale),
            `pause_subscription:${subscription.id}`,
          ),
        ]);
        buttons.push([
          Markup.button.callback(
            this.i18nService.t('subscription.cancel_button', locale),
            `cancel_subscription:${subscription.id}`,
          ),
        ]);
      } else if (subscription.status === 'PAUSED') {
        buttons.push([
          Markup.button.callback(
            this.i18nService.t('subscription.resume_button', locale),
            `resume_subscription:${subscription.id}`,
          ),
        ]);
      }

      await ctx.reply(statusMessage, {
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
      });
    } catch (error) {
      this.logger.error(`Error checking subscription status:`, error.message);
      await this.sendErrorMessage(ctx, 'subscription.error_checking_status');
    }
  }

  /**
   * Отменить подписку пользователя
   * @param ctx Контекст Telegram
   * @param subscriptionId ID подписки
   */
  async handleCancelSubscription(ctx: Context, subscriptionId: string): Promise<void> {
    try {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) {
        return;
      }

      this.logger.debug(`Cancelling subscription ${subscriptionId} for user ${telegramId}`);

      const user = await this.userService.findUserByTelegramId(telegramId);
      if (!user) {
        return;
      }

      const locale = getLocaleFromLanguage(user.language);

      // Показываем подтверждение
      const confirmMessage = this.i18nService.t('subscription.confirm_cancel_message', locale);
      const buttons = [
        [
          Markup.button.callback(
            this.i18nService.t('subscription.confirm_cancel_button', locale),
            `confirm_cancel_subscription:${subscriptionId}`,
          ),
        ],
        [Markup.button.callback(this.i18nService.t('keyboard.back', locale), 'subscription_status')],
      ];

      await ctx.reply(confirmMessage, {
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
      });
    } catch (error) {
      this.logger.error(`Error in cancel subscription flow:`, error.message);
      await this.sendErrorMessage(ctx, 'subscription.error_cancelling');
    }
  }

  /**
   * Подтвердить отмену подписки
   * @param ctx Контекст Telegram
   * @param subscriptionId ID подписки
   */
  async handleConfirmCancelSubscription(ctx: Context, subscriptionId: string): Promise<void> {
    try {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) {
        return;
      }

      const user = await this.userService.findUserByTelegramId(telegramId);
      if (!user) {
        return;
      }

      const locale = getLocaleFromLanguage(user.language);

      // Отменяем подписку
      const cancelledSubscription = await this.paymentService.cancelSubscription(subscriptionId, telegramId);

      const successMessage = this.i18nService.t('subscription.subscription_cancelled', locale, {
        planName: cancelledSubscription.plan.name,
        endDate: new Date(cancelledSubscription.endDate).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US'),
      });

      await ctx.reply(successMessage);

      this.logger.debug(`Subscription ${subscriptionId} cancelled for user ${telegramId}`);
    } catch (error) {
      this.logger.error(`Error confirming cancel subscription:`, error.message);
      await this.sendErrorMessage(ctx, 'subscription.error_cancelling');
    }
  }

  /**
   * Приостановить подписку пользователя
   * @param ctx Контекст Telegram
   * @param subscriptionId ID подписки
   */
  async handlePauseSubscription(ctx: Context, subscriptionId: string): Promise<void> {
    try {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) {
        return;
      }

      const user = await this.userService.findUserByTelegramId(telegramId);
      if (!user) {
        return;
      }

      const locale = getLocaleFromLanguage(user.language);

      // Приостанавливаем подписку
      const pausedSubscription = await this.paymentService.pauseSubscription(subscriptionId, telegramId);

      const successMessage = this.i18nService.t('subscription.subscription_paused', locale, {
        planName: pausedSubscription.plan.name,
      });

      await ctx.reply(successMessage);

      this.logger.debug(`Subscription ${subscriptionId} paused for user ${telegramId}`);
    } catch (error) {
      this.logger.error(`Error pausing subscription:`, error.message);
      await this.sendErrorMessage(ctx, 'subscription.error_pausing');
    }
  }

  /**
   * Возобновить приостановленную подписку
   * @param ctx Контекст Telegram
   * @param subscriptionId ID подписки
   */
  async handleResumeSubscription(ctx: Context, subscriptionId: string): Promise<void> {
    try {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) {
        return;
      }

      const user = await this.userService.findUserByTelegramId(telegramId);
      if (!user) {
        return;
      }

      const locale = getLocaleFromLanguage(user.language);

      // Возобновляем подписку
      const resumedSubscription = await this.paymentService.resumeSubscription(subscriptionId, telegramId);

      const successMessage = this.i18nService.t('subscription.subscription_resumed', locale, {
        planName: resumedSubscription.plan.name,
      });

      await ctx.reply(successMessage);

      this.logger.debug(`Subscription ${subscriptionId} resumed for user ${telegramId}`);
    } catch (error) {
      this.logger.error(`Error resuming subscription:`, error.message);
      await this.sendErrorMessage(ctx, 'subscription.error_resuming');
    }
  }

  /**
   * Форматирует кнопку для тарифного плана
   * @param plan Тарифный план
   * @param locale Язык пользователя
   * @returns Текст для кнопки
   */
  private formatPlanButton(plan: SubscriptionPlan, locale: string): string {
    const currency = locale === 'ru' ? '₽' : '$';
    return `${plan.name} - ${plan.price}${currency}`;
  }

  /**
   * Отправить сообщение об ошибке пользователю
   * @param ctx Контекст Telegram
   * @param messageKey Ключ сообщения в локализации
   */
  private async sendErrorMessage(ctx: Context, messageKey: string): Promise<void> {
    try {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) {
        return;
      }

      const user = await this.userService.findUserByTelegramId(telegramId);
      const locale = user ? getLocaleFromLanguage(user.language) : 'en';

      const errorMessage = this.i18nService.t(messageKey, locale);
      await ctx.reply(errorMessage);
    } catch (error) {
      this.logger.error(`Error sending error message:`, error.message);
    }
  }
}
