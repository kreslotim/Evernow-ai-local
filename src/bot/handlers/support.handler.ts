import { Injectable, Logger } from '@nestjs/common';
import { Context, Markup } from 'telegraf';
import { Language } from '@prisma/client';
import { I18nService } from '../i18n/i18n.service';
import { KeyboardService } from '../services/keyboard.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { getLocaleFromLanguage, mapLanguageCode } from '../utils/language';

export interface SupportContext extends Context {
  user?: any;
  scene?: {
    enter: (sceneId: string) => Promise<void>;
    leave: () => Promise<void>;
  };
  session?: {
    waitingForSuggestion?: boolean;
  };
}

@Injectable()
export class SupportHandler {
  private readonly logger = new Logger(SupportHandler.name);

  constructor(
    private readonly i18nService: I18nService,
    private readonly prisma: PrismaService,
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

  async showSupportMenu(ctx: SupportContext): Promise<void> {
    const locale = this.getUserLocale(ctx);

    try {
      const title = this.i18nService.t('support.menu.title', locale);
      const welcome = this.i18nService.t('support.menu.welcome', locale);
      const message = `${title}\n\n${welcome}`;

      const keyboard = this.getSupportMenuKeyboard(locale);

      // Удаляем предыдущее сообщение перед отправкой меню поддержки
      await this.safeDeletePreviousMessage(ctx);

      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup,
      });
    } catch (error) {
      this.logger.error(`Error showing support menu: ${error.message}`, error.stack);
      await ctx.reply(this.i18nService.t('errors.general', locale));
    }
  }

  async handleSupportAction(ctx: SupportContext, action: string): Promise<void> {
    const locale = this.getUserLocale(ctx);

    try {
      await ctx.answerCbQuery();

      switch (action) {
        case 'support_help':
          await this.showHelpInfo(ctx, locale);
          break;
        case 'support_links':
          await this.showLinksInfo(ctx, locale);
          break;
        case 'support_suggestion':
          await this.startSuggestionFlow(ctx, locale);
          break;
        case 'support_back':
          await this.showSupportMenuInline(ctx, locale);
          break;
        default:
          this.logger.warn(`Unknown support action: ${action}`);
      }
    } catch (error) {
      this.logger.error(`Error handling support action ${action}: ${error.message}`, error.stack);
      await ctx.reply(this.i18nService.t('errors.general', locale));
    }
  }

  async handleUserMessage(ctx: SupportContext, messageText: string): Promise<boolean> {
    // Пока что не обрабатываем предложения пользователей
    // Эта функциональность была временно отключена при упрощении схемы
    return false;
  }

  private async showHelpInfo(ctx: SupportContext, locale: string): Promise<void> {
    const helpInfo = this.i18nService.t('support.help.info', locale);
    const backKeyboard = this.getBackToMenuKeyboard(locale);

    await ctx.editMessageText(helpInfo, {
      parse_mode: 'HTML',
      reply_markup: backKeyboard.reply_markup,
    });
  }

  private async showLinksInfo(ctx: SupportContext, locale: string): Promise<void> {
    const linksInfo = this.i18nService.t('support.links.info', locale);
    const backKeyboard = this.getBackToMenuKeyboard(locale);

    await ctx.editMessageText(linksInfo, {
      parse_mode: 'HTML',
      reply_markup: backKeyboard.reply_markup,
    });
  }

  private async showSupportMenuInline(ctx: SupportContext, locale: string): Promise<void> {
    const title = this.i18nService.t('support.menu.title', locale);
    const welcome = this.i18nService.t('support.menu.welcome', locale);
    const message = `${title}\n\n${welcome}`;

    const keyboard = this.getSupportMenuKeyboard(locale);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard.reply_markup,
    });
  }

  private getSupportMenuKeyboard(locale: string): any {
    const supportUsername = process.env.TELEGRAM_SUPPORT_USERNAME || 'support';

    return Markup.inlineKeyboard([
      [Markup.button.callback(this.i18nService.t('support.menu.button_help', locale), 'support_help')],
      [Markup.button.callback(this.i18nService.t('support.menu.button_links', locale), 'support_links')],
      [Markup.button.callback(this.i18nService.t('support.menu.button_suggestion', locale), 'support_suggestion')],
      [Markup.button.url(this.i18nService.t('support.menu.button_support', locale), `https://t.me/${supportUsername}`)],
    ]);
  }

  private getBackToMenuKeyboard(locale: string): any {
    return Markup.inlineKeyboard([
      [Markup.button.callback('🔙 ' + this.i18nService.t('common.back', locale), 'support_back')],
    ]);
  }

  private getUserLocale(ctx: SupportContext): string {
    const userLanguage = ctx.user?.language || mapLanguageCode(ctx.from?.language_code);
    return getLocaleFromLanguage(userLanguage);
  }

  private async startSuggestionFlow(ctx: SupportContext, locale: string): Promise<void> {
    const message = this.i18nService.t('support.suggestion.prompt', locale);
    const backKeyboard = this.getBackToMenuKeyboard(locale);

    // Пока что просто показываем сообщение без сохранения состояния
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: backKeyboard.reply_markup,
    });
  }
}
