import { Injectable, Logger } from '@nestjs/common';
import { Context, MiddlewareFn, Markup } from 'telegraf';
import { UserService } from 'src/core/modules/user/user.service';
import { I18nService } from '../i18n/i18n.service';
import { SubscriptionService } from '../services/subscription.service';
import { getLocaleFromLanguage } from '../utils/language';

export interface AnalysisContext extends Context {
  user?: any;
  canAnalyze?: boolean;
  hasActiveSubscription?: boolean;
}

@Injectable()
export class AnalysisCheckMiddleware {
  private readonly logger = new Logger(AnalysisCheckMiddleware.name);

  constructor(
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  getMiddleware(): MiddlewareFn<AnalysisContext> {
    return async (ctx: AnalysisContext, next) => {
      try {
        const telegramId = ctx.from?.id?.toString();
        if (!telegramId) {
          ctx.canAnalyze = false;
          return next();
        }

        const user = await this.userService.findUserInfoByTeleramId(telegramId);
        if (!user) {
          ctx.canAnalyze = false;
          return next();
        }

        ctx.user = user;

        // Сначала проверяем платную подписку через микросервис
        const paidSubscriptionResult = await this.subscriptionService.checkPaidSubscription(telegramId);

        if (paidSubscriptionResult.isActive) {
          this.logger.debug(`User ${telegramId} has active paid subscription, allowing analysis`);
          ctx.canAnalyze = true;
          ctx.hasActiveSubscription = true;
          return next();
        }

        // Проверяем локальную подписку (fallback)
        if (user.subscriptionActive && user.subscriptionExpiry && user.subscriptionExpiry > new Date()) {
          this.logger.debug(`User ${telegramId} has active local subscription, allowing analysis`);
          ctx.canAnalyze = true;
          ctx.hasActiveSubscription = true;
          return next();
        }

        // Fallback: проверяем кредиты для пользователей без подписки
        if (user.analysisCredits > 0) {
          this.logger.debug(`User ${telegramId} has ${user.analysisCredits} credits, allowing analysis`);
          ctx.canAnalyze = true;
          ctx.hasActiveSubscription = false;
          return next();
        }

        // Пользователь не может продолжить - нет ни подписки, ни кредитов
        this.logger.debug(`User ${telegramId} has no subscription or credits, blocking analysis`);
        ctx.canAnalyze = false;
        const locale = getLocaleFromLanguage(user.language);

        const noCreditsMessage = this.i18nService.t('scenes.balance.no_credits', locale);
        const buttons = [];

        // Добавляем кнопку "Оформить подписку"
        buttons.push([
          Markup.button.callback(this.i18nService.t('subscription.subscribe_button', locale), 'subscription_plans'),
        ]);

        buttons.push([
          Markup.button.callback(this.i18nService.t('scenes.balance.buy_credits_button', locale), 'package_show'),
        ]);

        buttons.push([
          Markup.button.callback(
            this.i18nService.t('scenes.referral.earn_token_button', locale),
            'referral_earn_token',
          ),
        ]);

        await ctx.reply(noCreditsMessage, {
          reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
        });

        return;
      } catch (error) {
        this.logger.error(`Error in analysis check middleware: ${error.message}`, error.stack);
        ctx.canAnalyze = false;
        return next();
      }
    };
  }
}
