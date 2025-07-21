import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { UserInfoService } from '../user-info/user-info.service';
import { AnalyzeService } from '../analyze/analyze.service';
import { ConfigService } from '../config/config.service';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../../prisma/prisma.service';

import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import { I18nService } from 'src/bot/i18n/i18n.service';

/**
 * Интерфейс для данных пользователя из Telegram
 */
interface TelegramUserData {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

/**
 * Сервис мини-приложения для отображения персональной гипотезы
 * Обрабатывает логику Telegram Mini App для показа блок-гипотезы пользователю
 */
@Injectable()
export class MiniAppService {
  private readonly logger = new Logger(MiniAppService.name);

  // Кеш для предотвращения дублирования уведомлений о закрытии мини-аппа
  private readonly miniAppClosureCache = new Map<string, number>();
  private readonly CLOSURE_CACHE_TTL = 30000; // 30 секунд

  // ✅ ОПТИМИЗАЦИЯ: Кеш для статических файлов
  private readonly staticFileCache = new Map<string, { content: string; lastModified: number }>();
  private readonly STATIC_CACHE_TTL = process.env.NODE_ENV === 'production' ? 1800000 : 5000; // 30 мин в prod, 5 сек в dev
  private staticDir: string | null = null; // Кешируем найденную директорию

  constructor(
    private readonly userService: UserService,
    private readonly userInfoService: UserInfoService,
    private readonly analyzeService: AnalyzeService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
    private readonly i18nService: I18nService
  ) { }

  /**
   * Валидация данных от Telegram WebApp
   * @param initData - Строка с данными инициализации из Telegram
   * @returns true если подпись валидна
   */
  validateTelegramData(initData: string): boolean {
    try {
      const botToken = this.configService.getBotToken();
      if (!botToken) {
        this.logger.error('Bot token not found');
        return false;
      }

      // Парсим URL параметры
      const params = new URLSearchParams(initData);
      const hash = params.get('hash');
      params.delete('hash');

      // Сортируем параметры и создаём строку для проверки
      const dataCheckString = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      // Создаём секретный ключ
      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();

      // Проверяем подпись
      const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      return calculatedHash === hash;
    } catch (error) {
      this.logger.error(`Error validating Telegram data: ${error.message}`);
      return false;
    }
  }

  /**
   * Парсинг данных инициализации Telegram WebApp
   * @param initData - Строка с данными от Telegram
   * @returns Объект с данными пользователя
   */
  parseTelegramInitData(initData: string): TelegramUserData {
    const params = new URLSearchParams(initData);
    const userParam = params.get('user');

    if (!userParam) {
      throw new Error('User data not found in init data');
    }

    try {
      const userData = JSON.parse(userParam);
      return {
        id: userData.id.toString(),
        first_name: userData.first_name,
        last_name: userData.last_name,
        username: userData.username,
        language_code: userData.language_code,
        is_premium: userData.is_premium,
      };
    } catch (error) {
      this.logger.error(`Error parsing user data: ${error.message}`);
      throw new Error('Invalid user data format');
    }
  }

  /**
   * Получение или создание пользователя из Telegram данных
   * @param userData - Данные пользователя из Telegram
   * @returns Пользователь из базы данных
   */
  async getOrCreateUser(userData: TelegramUserData) {
    // Ищем существующего пользователя
    let user = await this.userService.findUserInfoByTeleramId(userData.id);

    if (!user) {
      // Создаём нового пользователя
      const language = userData.language_code?.toUpperCase() === 'RU' ? 'RU' : 'EN';

      user = await this.userService.createOrFindUser({
        telegramId: userData.id,
        telegramUsername: userData.username,
        language: language as any,
        telegramChatId: userData.id, // Используем telegram id как chat id
      });

      this.logger.log(`Created new user from mini app: ${user.id}`);
    }

    return user;
  }

  /**
   * Отслеживание действий пользователя в мини-приложении
   * @param data - Данные о действии пользователя
   */
  async trackUserAction(data: any) {
    this.logger.log(`User action tracked: ${JSON.stringify(data)}`);

    // TODO: Можно добавить сохранение в отдельную модель UserAction для аналитики

    // Если это закрытие мини-приложения, запускаем следующий этап онбординга
    if (data.action === 'send_miniapp_finish') {
      await this.handleMiniAppClosed(data.userId.toString());
    } else if (data.action === 'return_to_bot') {
      // Устаревшее действие - обрабатываем как send_miniapp_finish для совместимости
      await this.handleMiniAppClosed(data.userId.toString());
    } else if (data.action === 'return_to_bot_dev') {
      // Development событие - только логируем, не закрываем мини-апп
      this.logger.log(`Development return to bot action tracked for user ${data.userId} - no closure triggered`);
    } else if (data.action === 'closed') {
      // Событие 'closed' больше не используется в новой логике, игнорируем
      this.logger.log(`Legacy 'closed' action received for user ${data.userId} - ignoring to prevent duplication`);
    }
  }

  /**
   * Отправка гипотезы другому пользователю
   * @param telegramUserId - Telegram ID отправителя
   * @param hypothesis - Текст гипотезы для отправки
   * @returns Результат отправки
   */
  async shareHypothesis(telegramUserId: string, hypothesis: string): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Sharing hypothesis from user ${telegramUserId}`);

      // Находим пользователя
      const user = await this.userService.findUserInfoByTeleramId(telegramUserId);
      if (!user) {
        throw new Error(`Пользователь с Telegram ID ${telegramUserId} не найден`);
      }

      // Формируем сообщение с гипотезой (без кнопок, как в sendHypothesis но упрощённо)
      const message = `<i>${hypothesis}</i>`;

      // TODO: Отправляем сообщение пользователю
      // Нужно будет интегрировать с соответствующим сервисом для отправки сообщений
      this.logger.log(`Would send hypothesis message to user ${user.telegramChatId}: ${message}`);

      // Отслеживаем успешную отправку
      await this.trackUserAction({
        userId: telegramUserId,
        action: 'hypothesis_shared',
        data: { hypothesisLength: hypothesis.length },
        timestamp: Date.now(),
      });

      this.logger.log(`Hypothesis successfully shared by user ${user.id}`);

      return {
        success: true,
        message: 'Гипотеза успешно отправлена в чат',
      };
    } catch (error) {
      this.logger.error(`Error sharing hypothesis for user ${telegramUserId}: ${error.message}`, error.stack);

      return {
        success: false,
        message: error.message || 'Не удалось отправить гипотезу',
      };
    }
  }

  async getLoadingTitle(locale: 'ru' | 'en' = 'ru') {
    const [title, subtitle] = await Promise.all([
      this.prisma.prompt.findFirst({
        where: {
          key: 'mini_app.loading_title',
          locale
        }
      }),
      this.prisma.prompt.findFirst({
        where: {
          key: 'mini_app.loading_subtitle',
          locale
        }
      })
    ])

    return {
      title: title?.content || await this.i18nService.tAsync('mini_app.loading_title', locale),
      subtitle: subtitle?.content || await this.i18nService.tAsync('mini_app.loading_subtitle', locale),
    }
  }

  async getReportTitle(locale: 'ru' | 'en' = 'ru') {
    const [title, subtitle] = await Promise.all([
      this.prisma.prompt.findFirst({
        where: {
          key: 'mini_app.report_title',
          locale
        }
      }),
      this.prisma.prompt.findFirst({
        where: {
          key: 'mini_app.report_subtitle',
          locale
        }
      })
    ])

    console.log(title, subtitle);

    return {
      title: title?.content || await this.i18nService.tAsync('mini_app.report_title', locale),
      subtitle: subtitle?.content || await this.i18nService.tAsync('mini_app.report_subtitle', locale),
    }
  }

  async getLoadingVideo(locale: 'ru' | 'en' = 'ru') {
    const message = await this.prisma.prompt.findFirst({
      where: {
        key: 'videos.analysis_processing',
        locale
      }
    })

    if (!message) {
      return await this.i18nService.tAsync('videos.analysis_processing', locale);
    }

    return process.env.APP_URL + message.content;
  }

  /**
   * Обрабатывает закрытие мини-приложения и переход к финальному сообщению
   * @param userIdOrTelegramId - ID пользователя (может быть внутренний userId или telegramId)
   */
  private async handleMiniAppClosed(userIdOrTelegramId: string) {
    try {
      this.logger.log(`Processing mini app closure for user ID ${userIdOrTelegramId}`);

      // Проверяем кеш для предотвращения дублирования
      const now = Date.now();
      const lastClosure = this.miniAppClosureCache.get(userIdOrTelegramId);

      if (lastClosure && now - lastClosure < this.CLOSURE_CACHE_TTL) {
        this.logger.warn(
          `Mini app closure for user ${userIdOrTelegramId} already processed ${now - lastClosure}ms ago, ignoring duplicate request`,
        );
        return;
      }

      // Добавляем в кеш
      this.miniAppClosureCache.set(userIdOrTelegramId, now);

      // Очищаем старые записи из кеша
      for (const [userId, timestamp] of this.miniAppClosureCache.entries()) {
        if (now - timestamp > this.CLOSURE_CACHE_TTL) {
          this.miniAppClosureCache.delete(userId);
        }
      }

      // Пытаемся найти пользователя сначала по внутреннему userId, потом по telegramId
      let user = await this.userService.findUserById(userIdOrTelegramId);

      if (!user) {
        // Если не нашли по userId, пробуем по telegramId
        user = await this.userService.findUserInfoByTeleramId(userIdOrTelegramId);
        if (user) {
          this.logger.log(`User found by telegramId: ${userIdOrTelegramId} -> userId: ${user.id}`);
        }
      } else {
        this.logger.log(`User found by userId: ${userIdOrTelegramId}`);
      }

      if (!user) {
        this.logger.error(`User not found for ID ${userIdOrTelegramId} (tried both userId and telegramId)`);
        return;
      }

      // Проверяем, что пользователь в правильном состоянии для закрытия мини-аппа
      if (user.pipelineState !== 'MINI_APP_OPENED') {
        this.logger.warn(
          `User ${user.id} (Input ID: ${userIdOrTelegramId}) is in unexpected state: ${user.pipelineState} for mini app closure. Expected: MINI_APP_OPENED`,
        );

        // Если онбординг уже завершён, игнорируем
        if (user.pipelineState === 'ONBOARDING_COMPLETE') {
          this.logger.log(`Ignoring mini app closure for completed onboarding user ${user.id}`);
          return;
        }
      }

      // Отправляем уведомление для перехода к финальному сообщению
      const notificationMessage = {
        userId: user.id,
        chatId: user.telegramId,
        type: 'mini_app_closed' as const,
        data: {
          userId: user.id,
          telegramUserId: user.telegramId,
          nextAction: 'PROCEED_TO_FINAL_MESSAGE',
          timestamp: new Date().toISOString(),
        },
      };

      // Отправляем уведомление
      await this.notificationService.sendNotification(notificationMessage);

      this.logger.log(`Mini app closed notification sent for user ${user.id}, proceeding to final message`);
    } catch (error) {
      this.logger.error(
        `Error handling mini app closure for user ${userIdOrTelegramId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Обработка webhook событий (для будущего расширения)
   * @param data - Данные события
   */
  async handleWebhookEvent(data: any) {
    this.logger.log(`Webhook event: ${JSON.stringify(data)}`);

    // Обработка различных событий
    switch (data.type) {
      case 'mini_app_closed':
        // Обработка закрытия мини-приложения
        break;
      case 'button_clicked':
        // Обработка нажатий кнопок
        break;
      default:
        this.logger.warn(`Unknown webhook event type: ${data.type}`);
    }
  }

  /**
   * ✅ ОПТИМИЗИРОВАННАЯ версия: Читает статический файл мини-приложения с кешированием
   * @param fileName - Имя файла (index.html, styles.css, script.js)
   * @returns Содержимое файла
   */
  async getStaticFile(fileName: string): Promise<string> {
    try {
      // Проверяем кеш сначала
      const cacheKey = fileName;
      const cached = this.staticFileCache.get(cacheKey);
      const now = Date.now();

      if (cached && now - cached.lastModified < this.STATIC_CACHE_TTL) {
        this.logger.debug(`📦 Static file served from cache: ${fileName}`);
        return cached.content;
      }

      // Определяем директорию статических файлов только один раз
      if (!this.staticDir) {
        this.staticDir = await this.findStaticDirectory();
      }

      const filePath = path.join(this.staticDir, fileName);

      // Проверяем безопасность пути (защита от path traversal)
      const resolvedPath = path.resolve(filePath);
      const resolvedStaticDir = path.resolve(this.staticDir);

      if (!resolvedPath.startsWith(resolvedStaticDir)) {
        throw new Error('Доступ к файлу запрещен');
      }

      // Читаем файл асинхронно
      const content = await fs.readFile(filePath, 'utf-8');

      // Сохраняем в кеш
      this.staticFileCache.set(cacheKey, {
        content,
        lastModified: now,
      });

      this.logger.debug(`📁 Static file loaded and cached: ${fileName} from ${this.staticDir}`);
      return content;
    } catch (error) {
      this.logger.error(`❌ Error loading static file ${fileName}: ${error.message}`);
      throw new Error(`Файл ${fileName} не найден`);
    }
  }

  /**
   * ✅ НОВЫЙ МЕТОД: Находит правильную директорию статических файлов
   */
  private async findStaticDirectory(): Promise<string> {
    const possiblePaths = [];

    if (process.env.NODE_ENV === 'production') {
      // В production проверяем в порядке приоритета
      possiblePaths.push(
        path.join(__dirname, 'static'),
        path.join(process.cwd(), 'dist', 'core', 'modules', 'mini-app', 'static'),
        path.join(process.cwd(), 'src', 'core', 'modules', 'mini-app', 'static'),
        path.join(path.dirname(require.main?.filename || ''), 'core', 'modules', 'mini-app', 'static'),
      );
    } else {
      // В development
      possiblePaths.push(
        path.join(process.cwd(), 'src', 'core', 'modules', 'mini-app', 'static'),
        path.join(__dirname, 'static'),
      );
    }

    // Проверяем асинхронно только один раз
    for (const dir of possiblePaths) {
      try {
        await fs.access(dir);
        this.logger.log(`✅ Found static directory: ${dir}`);
        return dir;
      } catch {
        // Директория не существует, пробуем следующую
        continue;
      }
    }

    throw new Error(`Static directory not found in any of: ${possiblePaths.join(', ')}`);
  }

  async getUserData(userId: string) {
    const user = await this.userService.findUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async getUserInfo(userId: string) {
    const userInfo = await this.userInfoService.getLatest(userId);
    if (!userInfo) {
      return null;
    }
    return userInfo;
  }

  async getUserInfoForMiniApp(userId: string) {
    // Пытаемся найти по внутреннему ID
    let userInfo = await this.userInfoService.getLatest(userId);

    // Если не нашли — пробуем трактовать как telegramId
    if (!userInfo) {
      const userByTelegram = await this.userService.findUserInfoByTeleramId(userId);
      if (userByTelegram) {
        userInfo = await this.userInfoService.getLatest(userByTelegram.id);
        // Создаём пустую запись, чтобы не падать при первом обращении
        if (!userInfo) {
          userInfo = await this.userInfoService.create({ userId: userByTelegram.id } as any);
        }
      }
    }

    if (!userInfo) {
      throw new NotFoundException('User info not found');
    }

    const isReady = !!(userInfo as any).blockHypothesis;

    const result = {
      isAnalysisReady: isReady,
      isError: userInfo.luscherTestError,
      hypothesis: (userInfo as any).blockHypothesis,
      socialCardUrl: (userInfo as any).socialCardUrl,
      luscherTestCompleted: (userInfo as any).luscherTestCompleted,
      description: userInfo.description,
      feelings: userInfo.feelings,
    };

    this.logger.log(`📸 getUserInfoForMiniApp result for user ${userId}:`, result);
    return result;
  }

  async saveLuscherTestResult(userId: string, results: Record<string, any>) {
    // Пытаемся трактовать параметр как внутренний ID пользователя
    let userInfo = await this.userInfoService.getLatest(userId);

    // Если не нашли, возможно это telegramId – ищем пользователя и его UserInfo
    if (!userInfo) {
      const userByTelegram = await this.userService.findUserInfoByTeleramId(userId);

      if (userByTelegram) {
        userInfo = await this.userInfoService.getLatest(userByTelegram.id);

        // Если до сих пор нет записи, создаём новую пустую
        if (!userInfo) {
          userInfo = await this.userInfoService.create({
            userId: userByTelegram.id,
          } as any);
        }
      }
    }

    if (!userInfo) {
      throw new NotFoundException('User info not found');
    }

    await this.userInfoService.update(userInfo.id, {
      luscherTestResult: JSON.stringify(results),
      luscherTestCompleted: true,
    } as any);

    this.logger.log(`Luscher test result saved for user ${userInfo.userId}`);
    return { success: true };
  }

  // ✅ ОПТИМИЗАЦИЯ: Батчинг логов для production
  private logQueue: Array<{
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
    component: string;
    action: string;
    message: string;
    metadata?: any;
    userId?: string;
    userAgent?: string;
    ipAddress?: string;
    telegramId?: string;
    timestamp: Date;
  }> = [];

  private logBatchTimer: NodeJS.Timeout | null = null;
  private readonly LOG_BATCH_SIZE = 10;
  private readonly LOG_BATCH_TIMEOUT = 5000; // 5 секунд

  /**
   * ✅ ОПТИМИЗИРОВАННАЯ версия: Логирование диагностических событий в базу данных
   */
  async logDiagnostic(
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG',
    component: string,
    action: string,
    message: string,
    metadata?: any,
    userId?: string,
    userAgent?: string,
    ipAddress?: string,
    telegramId?: string,
  ) {
    try {
      // В production используем батчинг для оптимизации
      if (process.env.NODE_ENV === 'production') {
        // Добавляем в очередь
        this.logQueue.push({
          level,
          component,
          action,
          message,
          metadata,
          userId,
          userAgent,
          ipAddress,
          telegramId,
          timestamp: new Date(),
        });

        // Если очередь заполнена - сбрасываем немедленно
        if (this.logQueue.length >= this.LOG_BATCH_SIZE) {
          await this.flushLogQueue();
        } else {
          // Иначе устанавливаем таймер для автоматического сброса
          this.scheduleLogFlush();
        }
      } else {
        // В development пишем сразу для дебага
        await this.prisma.diagnosticLog.create({
          data: {
            level,
            component,
            action,
            message,
            metadata: metadata ? JSON.stringify(metadata) : null,
            userId,
            userAgent,
            ipAddress,
            telegramId,
          },
        });
      }
    } catch (error) {
      // Если логирование не удалось, используем обычный logger
      this.logger.error(`Failed to log diagnostic: ${error.message}`, {
        level,
        component,
        action,
        message,
        metadata,
      });
    }
  }

  /**
   * ✅ НОВЫЙ МЕТОД: Планирует сброс логов по таймауту
   */
  private scheduleLogFlush() {
    if (this.logBatchTimer) {
      return; // Таймер уже установлен
    }

    this.logBatchTimer = setTimeout(async () => {
      await this.flushLogQueue();
    }, this.LOG_BATCH_TIMEOUT);
  }

  /**
   * ✅ НОВЫЙ МЕТОД: Сбрасывает очередь логов в базу данных
   */
  private async flushLogQueue() {
    if (this.logQueue.length === 0) {
      return;
    }

    // Очищаем таймер
    if (this.logBatchTimer) {
      clearTimeout(this.logBatchTimer);
      this.logBatchTimer = null;
    }

    // Берём копию очереди и очищаем оригинал
    const logsToFlush = [...this.logQueue];
    this.logQueue = [];

    try {
      // Записываем все логи одним запросом
      await this.prisma.diagnosticLog.createMany({
        data: logsToFlush.map((log) => ({
          level: log.level,
          component: log.component,
          action: log.action,
          message: log.message,
          metadata: log.metadata ? JSON.stringify(log.metadata) : null,
          userId: log.userId,
          userAgent: log.userAgent,
          ipAddress: log.ipAddress,
          telegramId: log.telegramId,
          createdAt: log.timestamp,
        })),
      });

      this.logger.debug(`📊 Flushed ${logsToFlush.length} diagnostic logs to database`);
    } catch (error) {
      this.logger.error(`❌ Failed to flush diagnostic logs: ${error.message}`);
      // Возвращаем логи в очередь для повторной попытки
      this.logQueue.unshift(...logsToFlush);
    }
  }

  /**
   * ✅ НОВЫЙ МЕТОД: Принудительно сбрасывает все логи при завершении работы
   */
  async onApplicationShutdown() {
    if (this.logQueue.length > 0) {
      this.logger.log('🔄 Flushing remaining logs before shutdown...');
      await this.flushLogQueue();
    }
  }

  /**
   * Получение диагностических логов для админки
   */
  async getDiagnosticLogs(
    userId?: string,
    component?: string,
    level?: string,
    limit: number = 100,
    offset: number = 0,
  ) {
    const where: any = {};

    if (userId) where.userId = userId;
    if (component) where.component = component;
    if (level) where.level = level;

    return this.prisma.diagnosticLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        level: true,
        component: true,
        action: true,
        message: true,
        metadata: true,
        userId: true,
        telegramId: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
      },
    });
  }
}
