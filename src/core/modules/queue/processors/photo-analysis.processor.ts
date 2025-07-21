import { Processor, Process } from '@nestjs/bull';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PhotoAnalysisJobDto, PhotoAnalysisJobResult } from '../../../../common/dtos/photo-analysis-job.dto';
import { QueueNames, JobTypes } from '../../../../common/enums/queue-names.enum';
import { OpenAIService } from '../../llm/openai/openai.service';
import { AnalyzeService } from '../../analyze/analyze.service';
import { TelegramService } from '../../telegram/telegram.service';
import { NotificationService } from '../../notification/notification.service';
import { AnalyzeType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { UserService } from '../../user/user.service';
import { isCoupleAnalyze } from 'src/bot/utils/analysis.util';
import { ImageProcessingService } from '../../image-processing/image-processing.service';
import { formatQuote } from 'src/bot/utils/telegram-formatting.util';

/**
 * Простой менеджер typing статуса для процессора
 */
class TypingManager {
  private timeout: NodeJS.Timeout | null = null;
  private count = 0;
  private startTime = 0;
  private isActive = false;

  constructor(
    private telegramService: TelegramService,
    private chatId: string,
    private userId: string,
    private logger: Logger,
  ) {}

  start(): void {
    this.startTime = Date.now();
    this.count = 0;
    this.isActive = true;

    // Отправляем первый typing статус и планируем следующий
    this.scheduleNext();

    this.logger.log(`🟢 Typing status started for user ${this.userId} in PhotoAnalysisProcessor`);
  }

  stop(): void {
    this.isActive = false;
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    const duration = Date.now() - this.startTime;
    this.logger.log(
      `🔴 Typing status stopped for user ${this.userId} after ${duration}ms, sent ${this.count} updates in PhotoAnalysisProcessor`,
    );
  }

  private scheduleNext(): void {
    if (!this.isActive) return;

    // Отправляем typing статус (неблокирующий)
    this.sendTyping();

    // Планируем следующую отправку через 4 секунды
    this.timeout = setTimeout(() => {
      this.scheduleNext();
    }, 4000);
  }

  private sendTyping(): void {
    this.count++;

    // Fire-and-forget: НЕ блокируем основной поток
    this.telegramService
      .sendTypingStatus(this.chatId)
      .then(() => {
        this.logger.log(
          `✅ Typing status sent #${this.count} for user ${this.userId} in PhotoAnalysisProcessor (${Date.now() - this.startTime}ms)`,
        );
      })
      .catch((error) => {
        this.logger.warn(
          `❌ Failed to send typing status #${this.count} for user ${this.userId} in PhotoAnalysisProcessor: ${error.message}`,
        );
      });
  }
}

@Injectable()
@Processor(QueueNames.PHOTO_ANALYSIS)
export class PhotoAnalysisProcessor {
  private readonly logger = new Logger(PhotoAnalysisProcessor.name);

  constructor(
    private readonly openAIService: OpenAIService,
    private readonly analyzeService: AnalyzeService,
    private readonly telegramService: TelegramService,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => UserService)) private readonly userService: UserService,
    private readonly imageProcessingService: ImageProcessingService,
  ) {}

  @Process(JobTypes.ANALYZE_PHOTO)
  public async handlePhotoAnalysis(job: Job<PhotoAnalysisJobDto>): Promise<PhotoAnalysisJobResult> {
    const startTime = Date.now();
    const { userId, photoUrl, chatId, messageId, analysisType, id } = job.data;
    const downloadedPhotoPaths: string[] = [];
    let processedPhotoPaths: string[] = [];

    // Запускаем typing статус для всего процесса анализа
    let typingManager: TypingManager | null = null;
    if (chatId && chatId !== 'null' && chatId !== 'undefined') {
      typingManager = new TypingManager(this.telegramService, chatId, userId, this.logger);
      typingManager.start();
    }

    try {
      const isCouple = isCoupleAnalyze(analysisType);

      // Validate photo count based on analysis type
      if (isCouple) {
        if (photoUrl.length === 0 || photoUrl.length > 2) {
          throw new Error(`Invalid photo count for couple analysis: ${photoUrl.length}. Must be 1 or 2 photos.`);
        }
      } else {
        if (photoUrl.length === 0 || photoUrl.length > 3) {
          throw new Error(`Invalid photo count: ${photoUrl.length}. Must be between 1 and 3 photos.`);
        }
      }

      // Download all photos from Telegram
      for (let i = 0; i < photoUrl.length; i++) {
        const url = photoUrl[i];
        const photoPath = await this.downloadPhotoFromTelegram(url);
        downloadedPhotoPaths.push(photoPath);
      }

      // Process photos based on analysis type
      if (isCouple && downloadedPhotoPaths.length === 2) {
        // Combine photos horizontally for couple analysis
        const combinedPhotoPath = await this.imageProcessingService.combinePhotosHorizontally(downloadedPhotoPaths);
        processedPhotoPaths = [combinedPhotoPath];
      } else {
        processedPhotoPaths = [...downloadedPhotoPaths];
      }

      const analysisResult = await this.openAIService.analyzePhoto({
        photoPaths: processedPhotoPaths,
        analysisType: analysisType as AnalyzeType,
        userId,
      });

      if (analysisResult.analysisResultText && analysisResult.analysisResultText.trim()) {
        const cleanedText = analysisResult.analysisResultText
          .trim()
          .replace(/^[^\w\u0400-\u04FF]+|[^\w\u0400-\u04FF]+$/g, '') // Remove punctuation from start/end
          .toUpperCase();

        if (cleanedText === 'НЕТ') {
          // Send notification for face not detected (this will preserve session state)
          await this.notificationService.notifyFaceNotDetected({
            userId,
            chatId,
            messageId,
            analysisId: id,
            analysisType,
          });
          await this.analyzeService.deleteAnalyze(id);
          await this.userService.addCredits(userId, 1);

          return {
            userId,
            processingTime: Date.now() - startTime,
            analysisType,
            chatId,
            id,
            messageId,
            description: '',
            summary: '',
          };
        }
      }

      if (analysisResult.success) {
        // Генерируем summary и социальное изображение для каждого анализа
        let summaryResult = null;
        let socialImagePath: string | null = null;

        this.logger.log(`🔄 Generating summary for analysis ${id}`);
        summaryResult = await this.openAIService.generateSummary(analysisResult.analysisResultText, userId);

        if (summaryResult.success) {
          this.logger.log(`✅ Summary generated for analysis ${id}`);

          try {
            this.logger.log(`🎨 Creating social media image for analysis ${id}`);

            // Получаем пользователя для извлечения telegramId
            const user = await this.userService.findUserById(userId);
            const telegramId = user?.telegramId;

            this.logger.debug(`Using telegramId ${telegramId} for social media image creation`);

            // Используем первую обработанную фотографию для создания социального изображения
            socialImagePath = await this.imageProcessingService.createSocialMediaImage(
              processedPhotoPaths[0],
              summaryResult.summary,
              telegramId, // Передаем telegramId для получения аватарки
            );
            this.logger.log(`✅ Social media image created: ${socialImagePath}`);
          } catch (error) {
            this.logger.error(`❌ Failed to generate social media image for analysis ${id}: ${error.message}`);
          }
        } else {
          this.logger.warn(`⚠️ Summary generation failed for analysis ${id}: ${summaryResult.error}`);
        }

        await this.analyzeService.completeAnalyze(id, {
          analysisResultText: analysisResult.analysisResultText,
          summaryText: summaryResult?.success ? summaryResult.summary : null,
          postcardImageUrl: socialImagePath, // Сохраняем путь к социальному изображению
        });

        // Отправляем уведомление о завершении анализа с социальным изображением
        await this.notificationService.notifyAnalysisComplete({
          userId,
          chatId,
          messageId,
          analysisId: id,
          analysisType,
          summary: summaryResult?.success ? summaryResult.summary : null,
          description: analysisResult.analysisResultText,
          socialImagePath, // Всегда передаем путь к социальному изображению
        });
      } else if (analysisResult.error === 'AI_REFUSAL') {
        try {
          // Delete the analysis
          await this.analyzeService.deleteAnalyze(id);

          // Refund the credit
          await this.userService.addCredits(userId, 1);

          // Send AI refusal notification
          await this.notificationService.notifyAiAnalysisRefusal({
            userId,
            chatId,
            messageId,
            analysisId: id,
            analysisType,
          });
        } catch (refundError) {
          this.logger.error(`Failed to handle AI refusal properly: ${refundError.message}`);

          // Fallback to regular failure handling
          await this.analyzeService.failAnalyze(id, 'AI analysis refused');
          await this.notificationService.notifyAnalysisFailed({
            userId,
            chatId,
            messageId,
            analysisId: id,
            analysisType,
            error: 'AI analysis refused',
          });
        }
      } else {
        // Mark analysis as failed
        await this.analyzeService.failAnalyze(id, analysisResult.error || 'Analysis failed');

        // Send failure notification
        await this.notificationService.notifyAnalysisFailed({
          userId,
          chatId,
          messageId,
          analysisId: id,
          analysisType,
          error: analysisResult.error || 'Analysis failed',
        });
      }

      const processingTime = Date.now() - startTime;

      this.logger.log(`Photo analysis completed for user ${userId} in ${processingTime}ms`);

      return {
        userId,
        processingTime,
        analysisType,
        chatId,
        id,
        messageId,
        description: analysisResult.analysisResultText,
        summary: analysisResult.summaryText,
      };
    } catch (error) {
      this.logger.error(`Photo analysis failed for user ${userId}: ${error.message}`, error.stack);

      // Mark analysis as failed in database
      try {
        await this.analyzeService.failAnalyze(id, error.message);
      } catch (dbError) {
        this.logger.error(`Failed to mark analysis as failed in database: ${dbError.message}`);
      }

      // Send failure notification
      try {
        await this.notificationService.notifyAnalysisFailed({
          userId,
          chatId,
          messageId,
          analysisId: id,
          analysisType,
          error: error.message,
        });
      } catch (notifyError) {
        this.logger.error(`Failed to send failure notification: ${notifyError.message}`);
      }

      return {
        id,
        analysisType,
        chatId,
        messageId,
        userId,
        processingTime: Date.now() - startTime,
        error: error.message,
      };
    } finally {
      // Останавливаем typing статус
      if (typingManager) {
        typingManager.stop();
      }

      // ВРЕМЕННО ЗАКОММЕНТИРОВАНО: Очистка временных файлов
      // Cleanup temporary files
      // await this.cleanupTempFiles(...downloadedPhotoPaths);

      // ВРЕМЕННО ЗАКОММЕНТИРОВАНО: Очистка обработанных файлов
      // Cleanup processed files if they're different from downloaded files
      // ВАЖНО: НЕ удаляем социальные изображения - они нужны для мини-аппа
      // const processedFilesToCleanup = processedPhotoPaths.filter(
      //   (path) => !downloadedPhotoPaths.includes(path) && !path.includes('social_'),
      // );
      // await this.cleanupTempFiles(...processedFilesToCleanup);

      // УДАЛЕНО: Cleanup social image after a delay
      // Социальные изображения больше НЕ удаляются автоматически,
      // так как они нужны для долгосрочного отображения в мини-аппе
      this.logger.log('✅ Social image preserved for mini-app display');
      this.logger.log('⚠️ ВРЕМЕННО: Очистка файлов отключена для отладки');
    }
  }

  private async downloadPhotoFromTelegram(fileId: string): Promise<string> {
    try {
      // Create unique filename with timestamp
      const fileName = `${Date.now()}.jpg`;
      const uploadDir = path.join(process.cwd(), 'uploads', 'photos');
      const filePath = path.join(uploadDir, fileName);

      this.logger.debug(`Downloading photo with file_id: ${fileId}`);

      // Download file using TelegramService
      const downloadedPath = await this.telegramService.downloadFile(fileId, filePath);

      this.logger.debug(`Photo downloaded successfully: ${downloadedPath}`);
      return downloadedPath;
    } catch (error) {
      this.logger.error(`Failed to download photo from Telegram: ${error.message}`, error.stack);
      throw new Error(`Telegram file download failed: ${error.message}`);
    }
  }

  private async cleanupTempFiles(...filePaths: string[]): Promise<void> {
    try {
      for (const filePath of filePaths) {
        if (filePath && fs.existsSync(filePath)) {
          // ВРЕМЕННО ЗАКОММЕНТИРОВАНО: Удаление файлов отключено для отладки
          // fs.unlinkSync(filePath);
          this.logger.debug(`⚠️ ВРЕМЕННО: Файл НЕ удален (отладка): ${filePath}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to cleanup files: ${error.message}`);
    }
  }
}
