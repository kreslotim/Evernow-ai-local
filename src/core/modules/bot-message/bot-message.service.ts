import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import { FileService } from '../file/file.service';
import { randomUUID } from 'crypto';

/**
 * Сервис для управления сообщениями бота с приоритетом БД над локалями
 * Поддерживает кэширование для оптимизации производительности
 */
@Injectable()
export class BotMessageService {
  private readonly logger = new Logger(BotMessageService.name);
  private readonly cache = new Map<string, { content: string; timestamp: number }>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 минут TTL для кэша

  constructor(private readonly prisma: PrismaService, private readonly fileService: FileService) { }

  /**
   * Получить сообщение с приоритетом БД над локалями
   * @param key - Ключ сообщения (например, 'greeting.welcome')
   * @param locale - Язык сообщения (по умолчанию 'ru')
   * @returns Содержимое сообщения или null если не найдено
   */
  async getMessage(key: string, locale: string = 'ru'): Promise<string | null> {
    try {
      const cacheKey = `${key}:${locale}`;

      // Проверяем кэш
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.content;
      }

      // Ищем в базе данных
      const prompt = await this.prisma.prompt.findFirst({
        where: {
          key,
          locale,
          provider: 'BOT_MESSAGE',
          isActive: true,
        },
      });

      if (prompt) {
        // Сохраняем в кэш
        this.cache.set(cacheKey, {
          content: prompt.content,
          timestamp: Date.now(),
        });

        if (prompt.content.startsWith('http')) {
          return `${process.env.APP_URL}/${prompt.content}`
        }

        return prompt.content;
      }

      return null;
    } catch (error) {
      this.logger.error(`Ошибка получения сообщения ${key}:${locale}:`, error);
      return null;
    }
  }

  /**
   * Сохранить или обновить сообщение в БД
   * @param key - Ключ сообщения
   * @param locale - Язык сообщения
   * @param content - Содержимое сообщения
   * @param description - Описание сообщения (опционально)
   */
  async saveMessage(key: string, locale: string, content: string, file?: Buffer, description?: string): Promise<void> {
    let contentData: string = content;

    const oldPromptData = await this.prisma.prompt.findFirst({
      where: { key, locale }, select: {
        content: true
      }
    });

    if (oldPromptData?.content?.startsWith('/uploads')) {
      await this.fileService.deleteFile(oldPromptData.content);
    }

    if (file) {
      const { url } = await this.fileService.saveFile(file, `${randomUUID()}.mp4`, 'videos');

      contentData = url;
    }

    try {
      await this.prisma.prompt.upsert({
        where: {
          key_locale: {
            key,
            locale,
          },
        },
        update: {
          content: contentData,
          description,
          updatedAt: new Date(),
        },
        create: {
          key,
          locale,
          content: contentData,
          description,
          provider: 'BOT_MESSAGE',
          isActive: true,
        },
      });

      // Очищаем кэш для этого ключа
      const cacheKey = `${key}:${locale}`;
      this.cache.delete(cacheKey);

      this.logger.log(`Сообщение ${key}:${locale} сохранено`);
    } catch (error) {
      this.logger.error(`Ошибка сохранения сообщения ${key}:${locale}:`, error);
      throw error;
    }
  }

  /**
   * Получить все сообщения для админки с пагинацией и фильтрацией
   * @param locale - Фильтр по языку (опционально)
   * @param search - Поиск по ключу или содержимому (опционально)
   * @param page - Номер страницы (по умолчанию 1)
   * @param limit - Количество элементов на странице (по умолчанию 20)
   */
  async getAllMessages(locale?: string, search?: string, page: number = 1, limit: number = 20) {
    try {
      const where = {
        provider: 'BOT_MESSAGE',
        ...(locale && { locale }),
        ...(search && {
          OR: [
            { key: { contains: search, mode: 'insensitive' as any } },
            { content: { contains: search, mode: 'insensitive' as any } },
            { description: { contains: search, mode: 'insensitive' as any } },
          ],
        }),
      };

      const [prompts, total] = await Promise.all([
        this.prisma.prompt.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.prompt.count({ where }),
      ]);

      const promptsFormatted = prompts.map(prompt => ({
        ...prompt,
        content: prompt.content.startsWith('/uploads') ? `${process.env.APP_URL}${prompt.content}` : prompt.content
      }))

      return {
        prompts: promptsFormatted,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error('Ошибка получения списка сообщений:', error);
      throw error;
    }
  }

  /**
   * Удалить кастомное сообщение (вернуть к дефолтному)
   * @param key - Ключ сообщения
   * @param locale - Язык сообщения
   */
  async deleteMessage(key: string, locale: string): Promise<void> {
    try {
      await this.prisma.prompt.delete({
        where: {
          key_locale: {
            key,
            locale,
          },
        },
      });

      // Очищаем кэш
      const cacheKey = `${key}:${locale}`;
      this.cache.delete(cacheKey);

      this.logger.log(`Кастомное сообщение ${key}:${locale} удалено`);
    } catch (error) {
      this.logger.error(`Ошибка удаления сообщения ${key}:${locale}:`, error);
      throw error;
    }
  }

  /**
   * Загрузить сообщения в кэш при старте приложения
   */
  async loadCache(): Promise<void> {
    try {
      const prompts = await this.prisma.prompt.findMany({
        where: {
          provider: 'BOT_MESSAGE',
          isActive: true,
        },
      });

      for (const prompt of prompts) {
        const cacheKey = `${prompt.key}:${prompt.locale}`;
        this.cache.set(cacheKey, {
          content: prompt.content,
          timestamp: Date.now(),
        });
      }

      this.logger.log(`Загружено ${prompts.length} сообщений в кэш`);
    } catch (error) {
      this.logger.error('Ошибка загрузки кэша сообщений:', error);
    }
  }

  /**
   * Очистить весь кэш сообщений
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.log('Кэш сообщений очищен');
  }

  /**
   * Получить статистику кэша (для отладки)
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      timeout: this.cacheTimeout,
    };
  }
}
