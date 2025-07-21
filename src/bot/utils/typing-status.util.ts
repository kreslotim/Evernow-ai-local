import { Injectable, Logger } from '@nestjs/common';
import { Context } from 'telegraf';

/**
 * Утилитарный сервис для управления typing статусом в Telegram боте
 * Позволяет показывать пользователю, что бот "печатает" во время длительных операций
 */
@Injectable()
export class TypingStatusUtil {
  private readonly logger = new Logger(TypingStatusUtil.name);

  // Хранилище активных typing статусов для предотвращения дублирования
  private typingStatuses = new Map<
    string,
    { interval: NodeJS.Timeout; chatId: number; startTime: number; count: number }
  >();

  /**
   * Запускает typing статус для пользователя
   * Автоматически обновляет статус каждые 4 секунды до вызова функции остановки
   * @param ctx - Контекст Telegram
   * @param userId - ID пользователя
   * @returns Функция для остановки typing статуса
   */
  startTypingStatus(ctx: Context, userId: string): () => void {
    if (!userId) {
      this.logger.warn('startTypingStatus called with empty userId');
      return () => {};
    }

    // Если typing уже активен для этого пользователя, останавливаем старый
    if (this.typingStatuses.has(userId)) {
      this.logger.debug(`Stopping existing typing status for user ${userId}`);
      this.stopTypingStatus(userId);
    }

    const chatId = ctx.chat?.id;
    if (!chatId) {
      this.logger.warn(`No chatId found for user ${userId}`);
      return () => {}; // Возвращаем пустую функцию если нет chatId
    }

    const startTime = Date.now();

    // Сохраняем интервал с метаданными сначала
    const typingData = {
      interval: null as any, // Будет установлен ниже
      chatId,
      startTime,
      count: 0,
    };

    // Функция для отправки typing статуса
    const sendTyping = async () => {
      try {
        typingData.count++;
        await ctx.telegram.sendChatAction(chatId, 'typing');
        this.logger.log(`✅ Typing status sent #${typingData.count} for user ${userId} (${Date.now() - startTime}ms)`);
      } catch (error) {
        this.logger.warn(`❌ Failed to send typing status #${typingData.count} for user ${userId}: ${error.message}`);
        // Не останавливаем интервал при ошибке, так как пользователь может временно быть офлайн
      }
    };

    // Отправляем первый typing статус
    this.logger.log(`🟢 Starting typing status for user ${userId} in chat ${chatId}`);
    sendTyping();

    // Устанавливаем интервал для обновления typing статуса каждые 4 секунды
    const typingInterval = setInterval(() => {
      this.logger.debug(`🔄 Interval triggered for user ${userId}, sending typing...`);
      sendTyping();
    }, 4000);

    // Устанавливаем интервал в объект данных
    typingData.interval = typingInterval;

    // Сохраняем данные
    this.typingStatuses.set(userId, typingData);

    this.logger.debug(`Typing status started for user ${userId}, interval ID: ${typingInterval}`);

    // Возвращаем функцию для остановки
    return () => {
      this.stopTypingStatus(userId);
    };
  }

  /**
   * Останавливает typing статус для пользователя
   * @param userId - ID пользователя
   */
  stopTypingStatus(userId: string): void {
    if (!userId) {
      this.logger.warn('stopTypingStatus called with empty userId');
      return;
    }

    const typingData = this.typingStatuses.get(userId);
    if (typingData) {
      const duration = Date.now() - typingData.startTime;
      clearInterval(typingData.interval);
      this.typingStatuses.delete(userId);
      this.logger.log(
        `🔴 Typing status stopped for user ${userId} after ${duration}ms, sent ${typingData.count} updates, interval cleared`,
      );
    } else {
      this.logger.warn(
        `⚠️ Attempted to stop typing status for user ${userId} but no active status found. Active statuses: ${Array.from(this.typingStatuses.keys()).join(', ')}`,
      );
    }
  }

  /**
   * Проверяет, активен ли typing статус для пользователя
   * @param userId - ID пользователя
   * @returns true, если typing статус активен
   */
  isTypingActive(userId: string): boolean {
    return this.typingStatuses.has(userId);
  }

  /**
   * Получает информацию об активных typing статусах (для отладки)
   * @returns Массив с информацией об активных статусах
   */
  getActiveStatuses(): Array<{ userId: string; chatId: number; duration: number; count: number }> {
    const now = Date.now();
    return Array.from(this.typingStatuses.entries()).map(([userId, data]) => ({
      userId,
      chatId: data.chatId,
      duration: now - data.startTime,
      count: data.count,
    }));
  }

  /**
   * Очищает все активные typing статусы (для использования при завершении приложения)
   */
  clearAllTypingStatuses(): void {
    const statusCount = this.typingStatuses.size;
    for (const [userId, data] of this.typingStatuses.entries()) {
      const duration = Date.now() - data.startTime;
      clearInterval(data.interval);
      this.logger.debug(`Typing status cleared for user ${userId} (was active for ${duration}ms)`);
    }
    this.typingStatuses.clear();
    this.logger.log(`All ${statusCount} typing statuses cleared`);
  }
}
