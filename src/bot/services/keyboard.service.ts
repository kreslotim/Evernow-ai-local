import { Injectable, Logger } from '@nestjs/common';
import { Markup } from 'telegraf';
import { I18nService } from '../i18n/i18n.service';

export interface KeyboardButton {
  text: string;
  callback: string;
}

export interface MainKeyboardButtons {
  analysis: KeyboardButton;
  balance: KeyboardButton;
  referral: KeyboardButton;
  help: KeyboardButton;
}

@Injectable()
export class KeyboardService {
  constructor(private readonly i18nService: I18nService) {}

  // /**
  //  * Создает клавиатуру с основными кнопками
  //  * @param locale - Локализация пользователя
  //  * @returns Разметка клавиатуры
  //  */
  // async getMainKeyboard(locale: string) {
  //   return Markup.keyboard([
  //     [
  //       {
  //         text: await this.i18nService.tAsync('keyboard.analysis', locale),
  //         request_contact: false,
  //       },
  //     ],
  //     [
  //       {
  //         text: await this.i18nService.tAsync('keyboard.balance', locale),
  //         request_contact: false,
  //       },
  //       {
  //         text: await this.i18nService.tAsync('keyboard.referral', locale),
  //         request_contact: false,
  //       },
  //     ],
  //     [
  //       {
  //         text: await this.i18nService.tAsync('keyboard.help', locale),
  //         request_contact: false,
  //       },
  //     ],
  //   ])
  //     .oneTime()
  //     .resize();
  // }

  // /**
  //  * Создает опции для ответа с основной клавиатурой
  //  * @param locale - Локализация пользователя
  //  * @returns Объект с опциями для reply
  //  */
  // async getMainKeyboardReplyOptions(locale: string) {
  //   const keyboard = await this.getMainKeyboard(locale);
  //   return {
  //     parse_mode: 'HTML' as const,
  //     reply_markup: keyboard.reply_markup,
  //   };
  // }

  // /**
  //  * Создает простую клавиатуру "Назад"
  //  * @param locale - Локализация пользователя
  //  * @returns Разметка клавиатуры
  //  */
  // async getBackKeyboard(locale: string) {
  //   return Markup.keyboard([['🔙 ' + (await this.i18nService.tAsync('common.back', locale))]])
  //     .oneTime()
  //     .resize();
  // }

  // getMainKeyboardButtons(locale: string = 'ru'): MainKeyboardButtons {
  //   return {
  //     analysis: {
  //       text: this.i18nService.t('keyboard.analysis', locale),
  //       callback: 'analysis',
  //     },
  //     balance: {
  //       text: this.i18nService.t('keyboard.balance', locale),
  //       callback: 'balance',
  //     },
  //     referral: {
  //       text: this.i18nService.t('keyboard.referral', locale),
  //       callback: 'referral',
  //     },
  //     help: {
  //       text: this.i18nService.t('keyboard.help', locale),
  //       callback: 'help',
  //     },
  //   };
  // }

  // isMainKeyboardButton(text: string, locale: string = 'ru'): string | null {
  //   const locales = ['ru', 'en'];

  //   for (const checkLocale of locales) {
  //     const buttons = this.getMainKeyboardButtons(checkLocale);

  //     for (const [key, button] of Object.entries(buttons)) {
  //       if (button.text === text) {
  //         return button.callback;
  //       }
  //     }
  //   }

  //   return null;
  // }

  // removeKeyboard(): any {
  //   return Markup.removeKeyboard();
  // }
}
