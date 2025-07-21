import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserTimer } from '@prisma/client';
import { SchedulerRegistry } from '@nestjs/schedule';

/**
 * Сервис для управления таймерами пользователей
 */
@Injectable()
export class TimerService {
  private readonly logger = new Logger(TimerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  /**
   * Создаёт таймер для пользователя
   * @param userId - ID пользователя
   * @param chatId - ID чата Telegram
   * @param durationMinutes - Длительность таймера в минутах
   * @returns Созданный таймер
   */
  async createTimer(userId: string, chatId: string, durationMinutes: number = 3): Promise<UserTimer> {
    // Удаляем старый таймер если есть
    await this.prisma.userTimer.deleteMany({
      where: { userId },
    });

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    return this.prisma.userTimer.create({
      data: {
        userId,
        chatId,
        startTime,
        endTime,
      },
    });
  }

  /**
   * Получает активный таймер пользователя
   * @param userId - ID пользователя
   * @returns Таймер или null
   */
  async getActiveTimer(userId: string): Promise<UserTimer | null> {
    return this.prisma.userTimer.findFirst({
      where: {
        userId,
        completed: false,
        endTime: {
          gt: new Date(),
        },
      },
    });
  }

  /**
   * Обновляет messageId для таймера
   * @param timerId - ID таймера
   * @param messageId - ID сообщения в Telegram
   */
  async updateTimerMessage(timerId: string, messageId: number): Promise<void> {
    await this.prisma.userTimer.update({
      where: { id: timerId },
      data: { messageId },
    });
  }

  /**
   * Отмечает таймер как завершённый
   * @param userId - ID пользователя
   */
  async completeTimer(userId: string): Promise<void> {
    await this.prisma.userTimer.updateMany({
      where: { userId },
      data: { completed: true },
    });
  }

  /**
   * Вычисляет оставшееся время таймера
   * @param timer - Объект таймера
   * @returns Оставшееся время в секундах
   */
  getRemainingSeconds(timer: UserTimer): number {
    const now = new Date();
    const remaining = timer.endTime.getTime() - now.getTime();
    return Math.max(0, Math.floor(remaining / 1000));
  }

  /**
   * Форматирует время для отображения
   * @param seconds - Количество секунд
   * @returns Отформатированная строка времени (MM:SS)
   */
  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Планирует выполнение callback после окончания таймера
   * @param timerId - ID таймера
   * @param callback - Функция для выполнения
   */
  scheduleTimerCallback(timerId: string, callback: () => void): void {
    try {
      const timeout = setTimeout(callback, 3 * 60 * 1000); // 3 минуты
      this.schedulerRegistry.addTimeout(`timer_${timerId}`, timeout);
    } catch (error) {
      this.logger.error(`Failed to schedule timer callback: ${error.message}`);
    }
  }

  /**
   * Отменяет запланированный callback
   * @param timerId - ID таймера
   */
  cancelTimerCallback(timerId: string): void {
    try {
      const timeoutName = `timer_${timerId}`;
      if (this.schedulerRegistry.doesExist('timeout', timeoutName)) {
        this.schedulerRegistry.deleteTimeout(timeoutName);
      }
    } catch (error) {
      this.logger.error(`Failed to cancel timer callback: ${error.message}`);
    }
  }

  /**
   * Проверяет, истёк ли таймер
   * @param timer - Объект таймера
   * @returns true, если таймер истёк
   */
  isTimerExpired(timer: UserTimer): boolean {
    return new Date() >= new Date(timer.endTime);
  }

  /**
   * Получает таймер пользователя (включая истёкшие)
   * @param userId - ID пользователя
   * @returns Таймер или null
   */
  async getTimerByUserId(userId: string): Promise<UserTimer | null> {
    return this.prisma.userTimer.findFirst({
      where: {
        userId,
        completed: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Очищает истёкший таймер и отмечает как завершённый
   * @param userId - ID пользователя
   */
  async cleanupExpiredTimer(userId: string): Promise<void> {
    const timer = await this.getTimerByUserId(userId);

    if (timer && this.isTimerExpired(timer)) {
      await this.prisma.userTimer.update({
        where: { id: timer.id },
        data: { completed: true },
      });

      // Отменяем callback если есть
      this.cancelTimerCallback(timer.id);

      this.logger.log(`Cleaned up expired timer for user ${userId}`);
    }
  }
}
