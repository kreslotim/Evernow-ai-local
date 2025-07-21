import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PromptKey, DEFAULT_PROMPTS, PROMPT_METADATA } from './prompts.constants';

/**
 * Интерфейс для промпта с метаданными
 */
export interface PromptWithMetadata {
  key: string;
  content: string;
  source: 'database' | 'default';
  description?: string;
  provider: string;
  isActive: boolean;
  deprecated?: boolean;
  updatedAt?: Date;
}

/**
 * Сервис для управления промптами с поддержкой fallback на константы
 */
@Injectable()
export class PromptService {
  private readonly logger = new Logger(PromptService.name);
  private readonly cache = new Map<string, { content: string; timestamp: number }>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 минут

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Получает промпт по ключу с fallback на константы
   * @param key - ключ промпта
   * @param locale - локаль промпта (по умолчанию 'ru')
   * @returns содержимое промпта
   */
  async getPrompt(key: PromptKey, locale: string = 'ru'): Promise<string> {
    try {
      // Проверяем кеш
      const cacheKey = `${key}:${locale}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.content;
      }

      // Пытаемся получить из базы данных (временно без locale пока типы не обновятся)
      const dbPrompt = await this.prisma.prompt.findFirst({
        where: {
          key,
          isActive: true,
        },
      });

      let content: string;
      if (dbPrompt) {
        content = dbPrompt.content;
        this.logger.debug(`Промпт ${key} загружен из базы данных`);
      } else {
        // Fallback на константы
        content = DEFAULT_PROMPTS[key] || '';
        if (!content) {
          this.logger.warn(`Промпт ${key} не найден ни в БД, ни в константах`);
        } else {
          this.logger.debug(`Промпт ${key} загружен из констант (fallback)`);
        }
      }

      // Сохраняем в кеш
      this.cache.set(cacheKey, { content, timestamp: Date.now() });
      return content;
    } catch (error) {
      this.logger.error(`Ошибка получения промпта ${key}: ${error.message}`, error.stack);
      // Fallback на константы при ошибке
      return DEFAULT_PROMPTS[key] || '';
    }
  }

  /**
   * Получает промпт с метаданными о источнике
   * @param key - ключ промпта
   * @param locale - локаль промпта (по умолчанию 'ru')
   * @returns промпт с метаданными
   */
  async getPromptWithMetadata(key: PromptKey, locale: string = 'ru'): Promise<PromptWithMetadata> {
    try {
      const dbPrompt = await this.prisma.prompt.findFirst({
        where: { key, isActive: true },
      });

      const metadata = PROMPT_METADATA[key];

      if (dbPrompt) {
        return {
          key: dbPrompt.key,
          content: dbPrompt.content,
          source: 'database',
          description: dbPrompt.description || metadata?.description,
          provider: dbPrompt.provider,
          isActive: dbPrompt.isActive,
          deprecated: metadata?.deprecated,
          updatedAt: dbPrompt.updatedAt,
        };
      } else {
        return {
          key,
          content: DEFAULT_PROMPTS[key] || '',
          source: 'default',
          description: metadata?.description,
          provider: metadata?.provider || 'unknown',
          isActive: true,
          deprecated: metadata?.deprecated,
        };
      }
    } catch (error) {
      this.logger.error(`Ошибка получения метаданных промпта ${key}: ${error.message}`, error.stack);
      const metadata = PROMPT_METADATA[key];
      return {
        key,
        content: DEFAULT_PROMPTS[key] || '',
        source: 'default',
        description: metadata?.description,
        provider: metadata?.provider || 'unknown',
        isActive: true,
        deprecated: metadata?.deprecated,
      };
    }
  }

  /**
   * Обновляет или создает промпт в базе данных
   * @param key - ключ промпта
   * @param content - содержимое промпта
   * @param locale - локаль промпта (по умолчанию 'ru')
   * @param description - описание промпта (опционально)
   * @returns обновленный промпт
   */
  async updatePrompt(
    key: PromptKey,
    content: string,
    locale: string = 'ru',
    description?: string,
  ): Promise<PromptWithMetadata> {
    try {
      const metadata = PROMPT_METADATA[key];

      // Сначала пытаемся найти существующий промпт
      const existingPrompt = await this.prisma.prompt.findFirst({
        where: { key },
      });

      let updatedPrompt;
      if (existingPrompt) {
        // Обновляем существующий
        updatedPrompt = await this.prisma.prompt.update({
          where: { id: existingPrompt.id },
          data: {
            content,
            description: description || undefined,
            updatedAt: new Date(),
          },
        });
      } else {
        // Создаем новый
        updatedPrompt = await this.prisma.prompt.create({
          data: {
            key,
            content,
            description: description || metadata?.description,
            provider: metadata?.provider || 'unknown',
            isActive: true,
          },
        });
      }

      // Очищаем кеш для этого ключа
      const cacheKey = `${key}:${locale}`;
      this.cache.delete(cacheKey);

      this.logger.log(`Промпт ${key} успешно обновлен в базе данных`);

      return {
        key: updatedPrompt.key,
        content: updatedPrompt.content,
        source: 'database',
        description: updatedPrompt.description,
        provider: updatedPrompt.provider,
        isActive: updatedPrompt.isActive,
        deprecated: metadata?.deprecated,
        updatedAt: updatedPrompt.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Ошибка обновления промпта ${key}: ${error.message}`, error.stack);
      throw new Error(`Не удалось обновить промпт: ${error.message}`);
    }
  }

  /**
   * Получает все промпты с их текущими значениями (из БД или по умолчанию)
   * @param provider - фильтр по провайдеру (опционально)
   * @returns массив всех промптов с метаданными
   */
  async getAllPrompts(provider?: string): Promise<PromptWithMetadata[]> {
    try {
      // Получаем все промпты из БД
      const dbPrompts = await this.prisma.prompt.findMany({
        where: provider ? { provider, isActive: true } : { isActive: true },
      });

      // Создаем Map для быстрого поиска промптов из БД
      const dbPromptsMap = new Map(dbPrompts.map((prompt) => [prompt.key, prompt]));

      // Обрабатываем все ключи из констант
      const allPrompts: PromptWithMetadata[] = [];

      for (const [key, metadata] of Object.entries(PROMPT_METADATA)) {
        // Пропускаем если фильтр по провайдеру не совпадает
        if (provider && metadata.provider !== provider) {
          continue;
        }

        // Пропускаем устаревшие промпты
        if (metadata.deprecated) {
          continue;
        }

        const promptKey = key as PromptKey;
        const dbPrompt = dbPromptsMap.get(promptKey);

        if (dbPrompt) {
          allPrompts.push({
            key: dbPrompt.key,
            content: dbPrompt.content,
            source: 'database',
            description: dbPrompt.description || metadata.description,
            provider: dbPrompt.provider,
            isActive: dbPrompt.isActive,
            deprecated: metadata.deprecated,
            updatedAt: dbPrompt.updatedAt,
          });
        } else {
          allPrompts.push({
            key: promptKey,
            content: DEFAULT_PROMPTS[promptKey] || '',
            source: 'default',
            description: metadata.description,
            provider: metadata.provider,
            isActive: true,
            deprecated: metadata.deprecated,
          });
        }
      }

      return allPrompts;
    } catch (error) {
      this.logger.error(`Ошибка получения всех промптов: ${error.message}`, error.stack);
      throw new Error(`Не удалось получить список промптов: ${error.message}`);
    }
  }

  /**
   * Очищает кеш промптов
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.log('Кеш промптов очищен');
  }

  /**
   * Заменяет переменные в промпте на их значения
   * @param content - содержимое промпта с переменными
   * @param variables - объект с переменными для замены
   * @returns промпт с замененными переменными
   */
  replaceVariables(content: string, variables: Record<string, string>): string {
    let result = content;

    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `\${${key}}`;
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });

    return result;
  }
}
