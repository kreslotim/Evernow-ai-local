import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';
import Redis from 'ioredis';
import { AnalyzeType, User, UserFunnelAction } from '@prisma/client';
import { SendFunnelMessageDto, FunnelMessageResultDto } from '../../../common/dtos/notification.dto';

export interface NotificationMessage {
  type:
    | 'analysis_complete'
    | 'analysis_failed'
    | 'new_referral'
    | 'referral_bonus'
    | 'payment_success'
    | 'payment_failed'
    | 'face_not_detected'
    | 'funnel_message'
    | 'ai_analysis_refusal'
    | 'mini_app_closed';
  userId: string;
  chatId: string;
  messageId?: number;
  analysisId?: string;
  analysisType?: AnalyzeType;
  data?: {
    summary?: string;
    description?: string;
    error?: string;
    referralCount?: string;
    bonusCredits?: string;
    generationsAdded?: string;
    amount?: string;
    socialImagePath?: string;
    message?: string;
    parseMode?: 'HTML' | 'Markdown';
    userId?: string;
    telegramUserId?: string;
    nextAction?: string;
  };
}

@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationService.name);
  private publisher: Redis;
  private subscriber: Redis;
  private readonly CHANNEL_NAME = 'bot_notifications';

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.configService.getRedisUrl();

    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);

    this.logger.log('Notification service initialized');
  }

  async onModuleDestroy() {
    if (this.publisher) {
      await this.publisher.quit();
    }
    if (this.subscriber) {
      await this.subscriber.quit();
    }
  }

  public async publishNotification(message: NotificationMessage): Promise<void> {
    try {
      const messageString = JSON.stringify(message);
      await this.publisher.publish(this.CHANNEL_NAME, messageString);

      this.logger.debug(`Notification published: ${message.type} for user ${message.userId}`);
    } catch (error) {
      this.logger.error(`Failed to publish notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  public async subscribeToNotifications(callback: (message: NotificationMessage) => Promise<void>): Promise<void> {
    try {
      await this.subscriber.subscribe(this.CHANNEL_NAME);

      this.subscriber.on('message', async (channel, messageString) => {
        if (channel === this.CHANNEL_NAME) {
          try {
            const message: NotificationMessage = JSON.parse(messageString);
            await callback(message);
          } catch (error) {
            this.logger.error(`Failed to process notification: ${error.message}`, error.stack);
          }
        }
      });

      this.logger.log('Subscribed to bot notifications');
    } catch (error) {
      this.logger.error(`Failed to subscribe to notifications: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Funnel messaging functionality
  public async sendFunnelMessage(dto: SendFunnelMessageDto): Promise<FunnelMessageResultDto> {
    try {
      // Build the where clause based on funnel action
      const whereClause = {
        isBotBlocked: false,
        isBanned: false,
        telegramChatId: { not: null },
        ...(dto.funnelAction !== 'all' && { funnelAction: dto.funnelAction }),
      };

      // Get target users by funnel action or all users
      const targetUsers = await this.prismaService.user.findMany({
        where: whereClause,
        select: {
          id: true,
          telegramId: true,
          telegramChatId: true,
          funnelAction: true,
        },
      });

      const result: FunnelMessageResultDto = {
        sentCount: 0,
        failedCount: 0,
        blockedCount: 0,
        totalTargeted: targetUsers.length,
        failedUsers: [],
      };

      // Send messages to each user
      for (const user of targetUsers) {
        try {
          const message: NotificationMessage = {
            type: 'funnel_message',
            userId: user.id,
            chatId: user.telegramChatId!,
            data: {
              message: dto.message,
              parseMode: 'HTML',
            },
          };

          await this.publishNotification(message);
          result.sentCount++;

          await this.updateLastBotInteraction(user.id);
        } catch (error) {
          this.logger.error(`Failed to send message to user ${user.id}: ${error.message}`);
          result.failedCount++;
          result.failedUsers.push({
            userId: user.id,
            reason: error.message,
          });
        }
      }

      this.logger.log(
        `Funnel message campaign completed: ${result.sentCount}/${result.totalTargeted} sent (target: ${dto.funnelAction})`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Failed to send funnel messages: ${error.message}`, error.stack);
      throw error;
    }
  }

  public async sendFunnelCronMarketingMessage(message: string, user: Partial<User>): Promise<void> {
    try {
      await this.publishNotification({
        type: 'funnel_message',
        userId: user.id,
        chatId: user.telegramChatId!,
        data: {
          message,
          parseMode: 'HTML',
        },
      });

      await this.updateLastBotInteraction(user.id);
    } catch (error) {
      throw error;
    }
  }

  // Get funnel statistics
  public async getFunnelStats() {
    try {
      const stats = await this.prismaService.user.groupBy({
        by: ['funnelAction'],
        _count: true,
        where: {
          isBanned: false,
        },
      });

      const blockedUsersCount = await this.prismaService.user.count({
        where: {
          botBlockedAt: { not: null }, // пользователи с заблокированным ботом
          isBanned: false,
        },
      });

      const funnelStats = stats.reduce(
        (acc, stat) => {
          acc[stat.funnelAction] = stat._count;
          return acc;
        },
        {} as Record<UserFunnelAction, number>,
      );

      return {
        funnelStats,
        blockedUsersCount,
        totalUsers: stats.reduce((sum, stat) => sum + stat._count, 0),
      };
    } catch (error) {
      this.logger.error(`Failed to get funnel stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Update last bot interaction
  public async updateLastBotInteraction(userId: string): Promise<void> {
    try {
      await this.prismaService.user.update({
        where: { id: userId },
        data: {
          // lastBotInteraction поле удалено из схемы - используем updatedAt
          botBlockedAt: null, // сбрасываем блокировку при успешном взаимодействии
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update last bot interaction: ${error.message}`, error.stack);
    }
  }

  // Existing methods remain unchanged
  public async notifyAnalysisComplete(params: {
    userId: string;
    chatId: string;
    messageId?: number;
    analysisId: string;
    analysisType: AnalyzeType;
    summary: string | null;
    description: string;
    socialImagePath?: string | null;
  }): Promise<void> {
    const message: NotificationMessage = {
      type: 'analysis_complete',
      userId: params.userId,
      chatId: params.chatId,
      messageId: params.messageId,
      analysisId: params.analysisId,
      analysisType: params.analysisType,
      data: {
        description: params.description,
        summary: params.summary,
        socialImagePath: params.socialImagePath,
      },
    };

    await this.publishNotification(message);
  }

  public async notifyAnalysisFailed(params: {
    userId: string;
    chatId: string;
    messageId?: number;
    analysisId: string;
    analysisType: AnalyzeType;
    error: string;
  }): Promise<void> {
    const message: NotificationMessage = {
      type: 'analysis_failed',
      userId: params.userId,
      chatId: params.chatId,
      messageId: params.messageId,
      analysisId: params.analysisId,
      analysisType: params.analysisType,
      data: {
        error: params.error,
      },
    };

    await this.publishNotification(message);
  }

  public async notifyFaceNotDetected(params: {
    userId: string;
    chatId: string;
    messageId?: number;
    analysisId: string;
    analysisType: AnalyzeType;
  }): Promise<void> {
    const message: NotificationMessage = {
      type: 'face_not_detected',
      userId: params.userId,
      chatId: params.chatId,
      messageId: params.messageId,
      analysisId: params.analysisId,
      analysisType: params.analysisType,
    };

    await this.publishNotification(message);
  }

  public async notifyAiAnalysisRefusal(params: {
    userId: string;
    chatId: string;
    messageId?: number;
    analysisId: string;
    analysisType: AnalyzeType;
  }): Promise<void> {
    const message: NotificationMessage = {
      type: 'ai_analysis_refusal',
      userId: params.userId,
      chatId: params.chatId,
      messageId: params.messageId,
      analysisId: params.analysisId,
      analysisType: params.analysisType,
    };

    await this.publishNotification(message);
  }

  /**
   * Отправляет уведомление о закрытии мини-приложения
   */
  public async notifyMiniAppClosed(params: {
    userId: string;
    chatId: string;
    telegramUserId: string;
    nextAction: string;
  }): Promise<void> {
    const message: NotificationMessage = {
      type: 'mini_app_closed',
      userId: params.userId,
      chatId: params.chatId,
      data: {
        userId: params.userId,
        telegramUserId: params.telegramUserId,
        nextAction: params.nextAction,
      },
    };

    await this.publishNotification(message);
  }

  /**
   * Общий метод для отправки уведомлений
   * @param message - Сообщение уведомления
   */
  public async sendNotification(message: NotificationMessage): Promise<void> {
    await this.publishNotification(message);
  }
}
