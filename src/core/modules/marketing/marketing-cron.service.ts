import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { User, FunnelState } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';
import { I18nService } from '../../../bot/i18n/i18n.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MarketingCronService {
  private readonly logger = new Logger(MarketingCronService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly i18nService: I18nService,
  ) {}

  // @Cron(CronExpression.EVERY_2_HOURS)
  // async handleRetentionMessage1() {
  //   this.logger.log('Running retention message 1 cron job');
  //   try {
  //     const twoHoursAgo = new Date();
  //     twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

  //     const targetUsers = await this.getUsersByFunnelStateForSending(twoHoursAgo, FunnelState.BOT_JOINED);

  //     let successCount = 0;
  //     let failedCount = 0;
  //     for (const user of targetUsers) {
  //       try {
  //         const message = this.i18nService.t('marketing.retention_message_1', 'ru');

  //         await this.notificationService.sendFunnelCronMarketingMessage(message, user);
  //         successCount++;
  //       } catch (error) {
  //         failedCount++;
  //         this.logger.error(`Failed to send retention message to user ${user.id}: ${error.message}`);
  //       }
  //     }

  //     this.logger.log(
  //       `Retention message 1 cron completed: ${successCount} sent, ${failedCount} failed, ${targetUsers.length} total targeted`,
  //     );
  //   } catch (error) {
  //     this.logger.error('Retention message 1 cron job failed', error.stack);
  //   }
  // }

  // @Cron(CronExpression.EVERY_4_HOURS)
  // async handleRetentionMessage2() {
  //   this.logger.log('Running retention message 2 cron job');
  //   try {
  //     const twoHoursAgo = new Date();
  //     twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

  //     const targetUsers = await this.getUsersByFunnelStateForSending(twoHoursAgo, FunnelState.BOT_JOINED);

  //     let successCount = 0;
  //     let failedCount = 0;
  //     for (const user of targetUsers) {
  //       try {
  //         const message = this.i18nService.t('marketing.retention_message_2', 'ru');

  //         await this.notificationService.sendFunnelCronMarketingMessage(message, user);
  //         successCount++;
  //       } catch (error) {
  //         failedCount++;
  //         this.logger.error(`Failed to send retention message to user ${user.id}: ${error.message}`);
  //       }
  //     }

  //     this.logger.log(
  //       `Retention message 2 cron completed: ${successCount} sent, ${failedCount} failed, ${targetUsers.length} total targeted`,
  //     );
  //   } catch (error) {
  //     this.logger.error('Retention message 2 cron job failed', error.stack);
  //   }
  // }

  /**
   * Ежедневная задача для истечения подписок
   * Выполняется каждый день в полночь
   */
  @Cron('0 0 * * *')
  async expireSubscriptions(): Promise<void> {
    this.logger.log('Running subscription expiry cron job');
    try {
      const now = new Date();

      // Находим всех пользователей с истекшими подписками
      const expiredUsers = await this.prismaService.user.findMany({
        where: {
          subscriptionActive: true,
          subscriptionExpiry: {
            lte: now,
          },
        },
        select: {
          id: true,
          telegramUsername: true,
          subscriptionExpiry: true,
        },
      });

      if (expiredUsers.length === 0) {
        this.logger.log('No expired subscriptions found');
        return;
      }

      // Обновляем статус подписки для всех истекших пользователей
      const updateResult = await this.prismaService.user.updateMany({
        where: {
          subscriptionActive: true,
          subscriptionExpiry: {
            lte: now,
          },
        },
        data: {
          subscriptionActive: false,
        },
      });

      this.logger.log(
        `Subscription expiry cron completed: ${updateResult.count} subscriptions expired, ${expiredUsers.length} users affected`,
      );

      // Логируем детали для каждого пользователя
      expiredUsers.forEach((user) => {
        this.logger.log(
          `Subscription expired for user ${user.id} (${user.telegramUsername}), expiry date: ${user.subscriptionExpiry}`,
        );
      });
    } catch (error) {
      this.logger.error('Subscription expiry cron job failed', error.stack);
    }
  }

  /**
   * Ежедневная задача для очистки старых загруженных файлов
   * Выполняется каждый день в 03:00
   */
  @Cron('0 3 * * *')
  async cleanupOldFiles(): Promise<void> {
    this.logger.log('Running file cleanup cron job');

    try {
      const cleanupResults = await Promise.allSettled([this.cleanupPhotosDirectory(), this.cleanupTempDirectory()]);

      // Логируем результаты очистки
      cleanupResults.forEach((result, index) => {
        const dirName = index === 0 ? 'photos' : 'temp';
        if (result.status === 'fulfilled') {
          this.logger.log(`${dirName} directory cleanup completed: ${result.value}`);
        } else {
          this.logger.error(`${dirName} directory cleanup failed: ${result.reason.message}`);
        }
      });

      this.logger.log('File cleanup cron job completed');
    } catch (error) {
      this.logger.error('File cleanup cron job failed', error.stack);
    }
  }

  /**
   * Очищает директорию uploads/photos от файлов старше 7 дней
   * @returns Статистика очистки
   */
  private async cleanupPhotosDirectory(): Promise<string> {
    const photosDir = path.join(process.cwd(), 'uploads', 'photos');
    return this.cleanupDirectory(photosDir, 7, 'фотографий');
  }

  /**
   * Очищает директорию uploads/temp от файлов старше 1 дня
   * @returns Статистика очистки
   */
  private async cleanupTempDirectory(): Promise<string> {
    const tempDir = path.join(process.cwd(), 'uploads', 'temp');
    return this.cleanupDirectory(tempDir, 1, 'временных файлов');
  }

  /**
   * Универсальный метод очистки директории
   * @param dirPath - Путь к директории
   * @param maxAgeDays - Максимальный возраст файлов в днях
   * @param fileTypeDescription - Описание типа файлов для логирования
   * @returns Статистика очистки
   */
  private async cleanupDirectory(dirPath: string, maxAgeDays: number, fileTypeDescription: string): Promise<string> {
    try {
      // Проверяем существование директории
      if (!fs.existsSync(dirPath)) {
        return `Директория ${dirPath} не существует`;
      }

      const files = fs.readdirSync(dirPath);

      if (files.length === 0) {
        return `Директория ${dirPath} пуста`;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

      let deletedCount = 0;
      let errorCount = 0;
      let totalSize = 0;

      for (const file of files) {
        try {
          const filePath = path.join(dirPath, file);

          // Пропускаем поддиректории
          const stats = fs.statSync(filePath);
          if (stats.isDirectory()) {
            continue;
          }

          // Проверяем возраст файла
          if (stats.mtime < cutoffDate) {
            // Файл старше cutoffDate, удаляем
            totalSize += stats.size;
            fs.unlinkSync(filePath);
            deletedCount++;

            this.logger.debug(
              `Удален старый файл: ${file}, возраст: ${Math.floor((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24))} дней, размер: ${this.formatBytes(stats.size)}`,
            );
          }
        } catch (fileError) {
          errorCount++;
          this.logger.warn(`Ошибка при обработке файла ${file}: ${fileError.message}`);
        }
      }

      const result = `Удалено ${deletedCount} ${fileTypeDescription} (${this.formatBytes(totalSize)}), ошибок: ${errorCount}`;

      if (deletedCount > 0) {
        this.logger.log(`Очистка ${dirPath}: ${result}`);
      }

      return result;
    } catch (error) {
      const errorMessage = `Ошибка очистки директории ${dirPath}: ${error.message}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Форматирует размер в байтах в человеко-читаемый формат
   * @param bytes - Размер в байтах
   * @returns Отформатированная строка
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Б';

    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Публичный метод для ручной очистки файлов (для админки)
   * @param maxAgeDays - Максимальный возраст файлов в днях (по умолчанию 7 для фото, 1 для temp)
   * @returns Результат очистки
   */
  async manualCleanupFiles(maxAgeDays?: { photos?: number; temp?: number }): Promise<{
    photos: string;
    temp: string;
    success: boolean;
  }> {
    this.logger.log('Running manual file cleanup');

    try {
      const photosAge = maxAgeDays?.photos ?? 7;
      const tempAge = maxAgeDays?.temp ?? 1;

      const [photosResult, tempResult] = await Promise.allSettled([
        this.cleanupDirectory(path.join(process.cwd(), 'uploads', 'photos'), photosAge, 'фотографий'),
        this.cleanupDirectory(path.join(process.cwd(), 'uploads', 'temp'), tempAge, 'временных файлов'),
      ]);

      const photos =
        photosResult.status === 'fulfilled' ? photosResult.value : `Ошибка: ${photosResult.reason.message}`;
      const temp = tempResult.status === 'fulfilled' ? tempResult.value : `Ошибка: ${tempResult.reason.message}`;

      this.logger.log(`Manual file cleanup completed: photos: ${photos}, temp: ${temp}`);

      return {
        photos,
        temp,
        success: photosResult.status === 'fulfilled' && tempResult.status === 'fulfilled',
      };
    } catch (error) {
      this.logger.error('Manual file cleanup failed', error.stack);
      throw error;
    }
  }

  private async getUsersByFunnelStateForSending(createdDate: Date, funnelState: FunnelState): Promise<Partial<User>[]> {
    try {
      return await this.prismaService.user.findMany({
        where: {
          createdAt: {
            gte: createdDate,
          },
          funnelState,
          botBlockedAt: null,
          isBanned: false,
          telegramChatId: { not: null },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to get users by funnel state: ${error.message}`, error.stack);
      return [];
    }
  }
}
