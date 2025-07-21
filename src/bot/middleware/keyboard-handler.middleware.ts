import { Injectable, Logger } from '@nestjs/common';
import { Context, MiddlewareFn } from 'telegraf';
import { KeyboardService } from '../services/keyboard.service';
import { I18nService } from '../i18n/i18n.service';
import { SupportHandler } from '../handlers/support.handler';
import { ReferralHandler } from '../handlers/referral.handler';
import { UserService } from 'src/core/modules/user/user.service';
import { User } from '@prisma/client';

export interface BotContext extends Context {
  scene?: {
    enter: (sceneId: string) => Promise<void>;
    leave: () => Promise<void>;
  };
  user?: any;
  locale?: string;
}

@Injectable()
export class KeyboardHandlerMiddleware {
  private readonly logger = new Logger(KeyboardHandlerMiddleware.name);

  constructor(
    private readonly keyboardService: KeyboardService,
    private readonly i18nService: I18nService,
    private readonly supportHandler: SupportHandler,
    private readonly referralHandler: ReferralHandler,
    private readonly userService: UserService,
  ) {}

  getMiddleware(): MiddlewareFn<BotContext> {
    return async (ctx: BotContext, next) => {
      // // Set locale from user in DB or Telegram profile
      // let locale = 'ru';
      // let telegramId = ctx.from?.id?.toString();
      // let user: User | null = null;
      // if (telegramId) {
      //   user = await this.userService.findUserByTelegramId(telegramId);
      //   if (user && user.language) {
      //     locale = user.language.toLowerCase();
      //   } else if (ctx.from?.language_code) {
      //     locale = ctx.from.language_code.startsWith('en') ? 'en' : 'ru';
      //   }
      // }
      // if (!ctx.user) ctx.user = {};
      // ctx.user.locale = locale;

      // // Check for callback queries (inline keyboard buttons)
      // if (ctx.callbackQuery) {
      //   const callbackData = (ctx.callbackQuery as any).data;

      //   if (callbackData?.startsWith('support_')) {
      //     await this.supportHandler.handleSupportAction(ctx, callbackData);
      //     return;
      //   }

      //   if (callbackData?.startsWith('referral_')) {
      //     await this.referralHandler.handleReferralAction(ctx, callbackData);
      //     return;
      //   }

      //   return next();
      // }

      // // Check if this is a text message
      // if (!ctx.message || !('text' in ctx.message)) {
      //   return next();
      // }

      // const messageText = ctx.message.text;
      // const userLocale = ctx.user?.locale || 'ru';

      // // Check for command handlers first (/referral, etc.)
      // if (messageText.startsWith('/')) {
      //   const command = messageText.split(' ')[0].toLowerCase();

      //   try {
      //     switch (command) {
      //       case '/referral':
      //         await this.handleReferralButton(ctx, userLocale);
      //         return;
      //       case '/support':
      //       case '/help':
      //         await this.handleHelpButton(ctx, userLocale);
      //         return;
      //       default:
      //         // Let other command handlers process this
      //         return next();
      //     }
      //   } catch (error) {
      //     this.logger.error(`Error handling command ${command}:`, error);
      //     await ctx.reply(this.i18nService.t('errors.general', userLocale));
      //     return;
      //   }
      // }

      // // Check for main keyboard buttons first (higher priority)
      // const buttonCallback = this.keyboardService.isMainKeyboardButton(messageText, userLocale);

      // if (buttonCallback) {
      //   this.logger.debug(`Main keyboard button pressed: ${buttonCallback}`);

      //   try {
      //     await this.handleMainKeyboardButton(ctx, buttonCallback, userLocale);
      //   } catch (error) {
      //     this.logger.error(`Error handling keyboard button ${buttonCallback}:`, error);
      //     await ctx.reply(this.i18nService.t('errors.general', userLocale));
      //   }

      //   return;
      // }

      // // Check if user is waiting for a suggestion (lower priority)
      // try {
      //   const handled = await this.supportHandler.handleUserMessage(ctx, messageText);
      //   if (handled) {
      //     return; // Message was handled by support handler, don't process further
      //   }
      // } catch (error) {
      //   this.logger.error(`Error handling suggestion message:`, error);
      // }

      return next();
    };
  }

  // private async handleMainKeyboardButton(ctx: BotContext, callback: string, locale: string): Promise<void> {
  //   switch (callback) {
  //     case 'referral':
  //       await this.handleReferralButton(ctx, locale);
  //       break;

  //     case 'help':
  //       await this.handleHelpButton(ctx, locale);
  //       break;

  //     default:
  //       this.logger.warn(`Unknown keyboard button callback: ${callback}`);
  //   }
  // }

  // private async handleReferralButton(ctx: BotContext, locale: string): Promise<void> {
  //   await this.referralHandler.showReferralInfo(ctx);
  // }

  // private async handleHelpButton(ctx: BotContext, locale: string): Promise<void> {
  //   await this.supportHandler.showSupportMenu(ctx);
  // }
}
