import { Injectable, Logger } from '@nestjs/common';
import { BotMessageService } from '../../core/modules/bot-message/bot-message.service';

// Import locale data directly
import * as enLocale from './locales/en.json';
import * as ruLocale from './locales/ru.json';

@Injectable()
export class I18nService {
  private readonly logger = new Logger(I18nService.name);
  private locales: Map<string, any> = new Map();
  private defaultLocale = 'ru';

  constructor(private readonly botMessageService: BotMessageService) {
    this.loadLocales();
  }

  private loadLocales(): void {
    try {
      this.locales.set('ru', ruLocale);
      this.locales.set('en', enLocale);

      this.logger.log(`Loaded locales: ${Array.from(this.locales.keys()).join(', ')}`);

      // Log some sample keys for debugging
      const ruKeys = Object.keys(ruLocale);
      const enKeys = Object.keys(enLocale);
      this.logger.log(`Russian locale keys: ${ruKeys.join(', ')}`);
      this.logger.log(`English locale keys: ${enKeys.join(', ')}`);

      // Test a specific translation
      const testTranslation = this.getNestedValue(ruLocale, 'greeting.auto_registered');
      this.logger.log(`Test translation for greeting.auto_registered: ${testTranslation ? 'Found' : 'Not found'}`);
    } catch (error) {
      this.logger.error(`Could not load locales: ${error.message}`);
    }
  }

  translate(key: string, locale: string = this.defaultLocale, variables?: Map<string, string>): string {
    const localeData = this.locales.get(locale) || this.locales.get(this.defaultLocale);

    if (!localeData) {
      this.logger.warn(`No locale data found for: ${locale}, fallback: ${this.defaultLocale}`);
      return key;
    }

    const translation = this.getNestedValue(localeData, key);

    if (!translation) {
      this.logger.warn(`Translation not found for key: ${key} in locale: ${locale}`);
      return key;
    }

    const result = this.interpolateVariables(translation, variables);
    return result;
  }

  /**
   * Асинхронный метод перевода с приоритетом БД над локалями
   * Порядок приоритета: БД → JSON локали → возврат ключа
   */
  async translateAsync(
    key: string,
    locale: string = this.defaultLocale,
    variables?: Map<string, string>,
  ): Promise<string> {
    try {
      // Сначала проверяем БД
      const dbMessage = await this.botMessageService.getMessage(key, locale);
      if (dbMessage) {
        return this.interpolateVariables(dbMessage, variables);
      }

      // Fallback на локали
      return this.translate(key, locale, variables);
    } catch (error) {
      this.logger.error(`Ошибка асинхронного перевода для ключа ${key}:`, error);
      // Fallback на синхронный метод при ошибке
      return this.translate(key, locale, variables);
    }
  }

  private interpolateVariables(text: string, variables?: Map<string, string>): string {
    if (!variables || variables.size === 0) {
      return text;
    }

    let result = text;

    // Replace all {{variable}} patterns with actual values
    variables.forEach((value, key) => {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(pattern, value);
    });

    return result;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? current[key] : undefined;
    }, obj);
  }

  getSupportedLocales(): string[] {
    return Array.from(this.locales.keys());
  }

  setDefaultLocale(locale: string): void {
    if (this.locales.has(locale)) {
      this.defaultLocale = locale;
      this.logger.log(`Default locale set to: ${locale}`);
    } else {
      this.logger.warn(`Cannot set default locale to ${locale} - not loaded`);
    }
  }

  getLoadedLocales(): Record<string, any> {
    const result: Record<string, any> = {};
    this.locales.forEach((value, key) => {
      result[key] = Object.keys(value);
    });
    return result;
  }

  createVariables(variables: Record<string, string | number>): Map<string, string> {
    const map = new Map<string, string>();
    Object.entries(variables).forEach(([key, value]) => {
      map.set(key, String(value));
    });
    return map;
  }

  t(key: string, locale?: string, variables?: Record<string, string | number>): string {
    const actualLocale = locale || this.defaultLocale;
    const variableMap = variables ? this.createVariables(variables) : undefined;
    return this.translate(key, actualLocale, variableMap);
  }

  /**
   * Асинхронная версия метода t() с приоритетом БД над локалями
   * Рекомендуется для использования в новом коде
   */
  async tAsync(key: string, locale?: string, variables?: Record<string, string | number>): Promise<string> {
    const actualLocale = locale || this.defaultLocale;
    const variableMap = variables ? this.createVariables(variables) : undefined;
    return this.translateAsync(key, actualLocale, variableMap);
  }
}
