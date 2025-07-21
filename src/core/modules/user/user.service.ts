import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateUserDto, UpdateUserDto, GetUsersQueryDto } from '../../../common/dtos/user.dto';
import { UserWithStats, PaginatedUsers } from '../../../common/interfaces/user.interface';
import { User, Prisma, Language, UserFunnelAction, FunnelState, UserPipelineState, EventType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  private generateReferralCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async createOrFindUser(createUserDto: CreateUserDto): Promise<User> {
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { telegramId: createUserDto.telegramId },
      });

      if (existingUser) {
        this.logger.log(`User already exists: ${createUserDto.telegramId}`);
        return existingUser;
      }

      const referralCode = this.generateReferralCode();

      const newUser = await this.prisma.user.create({
        data: {
          telegramId: createUserDto.telegramId,
          telegramUsername: createUserDto.telegramUsername,
          telegramChatId: createUserDto.telegramChatId,
          email: createUserDto.email,
          analysisCredits: createUserDto.analysisCredits || 1,
          language: createUserDto.language || Language.RU,
          referralCode,
          funnelState: FunnelState.BOT_JOINED,
          funnelAction: UserFunnelAction.START,
        },
      });

      await this.logFunnelEvent(newUser.id, 'FUNNEL_STATE_CHANGE', null, 'BOT_JOINED', {
        funnelState: FunnelState.BOT_JOINED,
        funnelAction: UserFunnelAction.START,
      });

      this.logger.log(`New user created with BOT_JOINED event: ${createUserDto.telegramId}`);
      return newUser;
    } catch (error) {
      this.logger.error(`Failed to create user: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findUserByTelegramId(telegramId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { telegramId },
      include: {
        referralsGiven: true, // правильное имя relation
        analyses: true,
      },
    });
  }

  async findUserInfoByTeleramId(telegramId: string): Promise<User> {
    return await this.prisma.user.findUnique({
      where: { telegramId },
    });
  }

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        referralsGiven: {
          include: {
            invitedUser: {
              select: {
                id: true,
                telegramUsername: true,
                createdAt: true,
              },
            },
          },
        },
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  /**
   * Получает расширенную информацию о пользователе для админки
   * Включает UserInfo, UserTimer, FunnelEvents и детальные анализы
   * @param id - ID пользователя
   * @returns Полная информация о пользователе или null если не найден
   */
  async findUserByIdExtended(id: string): Promise<any | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        include: {
          // Рефералы с полной информацией о приглашенных пользователях
          referralsGiven: {
            include: {
              invitedUser: {
                select: {
                  id: true,
                  telegramUsername: true,
                  telegramId: true,
                  createdAt: true,
                },
              },
            },
          },
          // Детальные анализы с фотографиями и результатами
          analyses: {
            orderBy: { createdAt: 'desc' },
            take: 20, // Больше анализов для админки
          },
          // Информация от OpenAI/DeepSeek анализов
          userInfos: {
            orderBy: { createdAt: 'desc' },
            take: 1, // Последняя запись UserInfo
          },
          // Текущий таймер
          userTimer: true,
          // События воронки для аналитики
          funnelEvents: {
            orderBy: { createdAt: 'desc' },
            take: 10, // Последние 10 событий
          },
        },
      });

      if (!user) {
        return null;
      }

      // Преобразуем результат для удобства использования на фронтенде
      return {
        ...user,
        userInfo: user.userInfos?.[0] || null, // Берем последнюю запись UserInfo
        userInfos: undefined, // Убираем массив, оставляем только один объект
      };
    } catch (error) {
      this.logger.error(`Failed to find user by ID (extended): ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Логирует событие воронки пользователя
   * @param userId - ID пользователя
   * @param eventType - Тип события
   * @param previousValue - Предыдущее значение (может быть null)
   * @param newValue - Новое значение
   * @param fieldData - Дополнительные данные полей
   */
  async logFunnelEvent(
    userId: string,
    eventType: 'FUNNEL_ACTION_CHANGE' | 'FUNNEL_STATE_CHANGE' | 'PIPELINE_STATE_CHANGE',
    previousValue: string | null,
    newValue: string,
    fieldData?: {
      funnelAction?: UserFunnelAction;
      funnelState?: FunnelState;
      pipelineState?: UserPipelineState;
    },
  ): Promise<void> {
    try {
      await this.prisma.funnelEvent.create({
        data: {
          userId,
          eventType: eventType as any, // Временно используем any
          previousValue,
          newValue,
          funnelAction: fieldData?.funnelAction,
          funnelState: fieldData?.funnelState,
          pipelineState: fieldData?.pipelineState,
        },
      });

      this.logger.log(`Funnel event logged: ${eventType} for user ${userId} from ${previousValue} to ${newValue}`);
    } catch (error) {
      this.logger.error(`Failed to log funnel event: ${error.message}`, error.stack);
      // Не прерываем основной процесс если логирование не удалось
    }
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    try {
      // Получаем текущее состояние пользователя для сравнения
      const currentUser = await this.prisma.user.findUnique({
        where: { id },
        select: {
          funnelAction: true,
          funnelState: true,
          pipelineState: true,
        },
      });

      if (!currentUser) {
        throw new NotFoundException('User not found');
      }

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: updateUserDto,
      });

      // Логируем изменения в воронке
      if (updateUserDto.funnelAction !== undefined && currentUser.funnelAction !== updateUserDto.funnelAction) {
        await this.logFunnelEvent(
          id,
          'FUNNEL_ACTION_CHANGE',
          currentUser.funnelAction,
          updateUserDto.funnelAction?.toString() || 'null',
          { funnelAction: updateUserDto.funnelAction },
        );
      }

      if (updateUserDto.funnelState !== undefined && currentUser.funnelState !== updateUserDto.funnelState) {
        await this.logFunnelEvent(
          id,
          'FUNNEL_STATE_CHANGE',
          currentUser.funnelState,
          updateUserDto.funnelState?.toString() || 'null',
          { funnelState: updateUserDto.funnelState },
        );
      }

      if (updateUserDto.pipelineState !== undefined && currentUser.pipelineState !== updateUserDto.pipelineState) {
        await this.logFunnelEvent(
          id,
          'PIPELINE_STATE_CHANGE',
          currentUser.pipelineState,
          updateUserDto.pipelineState?.toString() || 'null',
          { pipelineState: updateUserDto.pipelineState },
        );
      }

      this.logger.log(`User updated: ${id}`);
      return updatedUser;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      this.logger.error(`Failed to update user: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deductCredits(userId: string, amount: number = 1): Promise<User> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          analysisCredits: {
            decrement: amount,
          },
        },
      });

      this.logger.log(`Credits deducted: ${amount} from user ${userId}`);
      return user;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      this.logger.error(`Failed to deduct credits: ${error.message}`, error.stack);
      throw error;
    }
  }

  async addCredits(userId: string, amount: number): Promise<User> {
    try {
      const userToUpdate = await this.prisma.user.findFirst({
        where: {
          OR: [{ id: userId }, { telegramId: userId }],
        },
        select: {
          id: true,
        },
      });
      const user = await this.prisma.user.update({
        where: { id: userToUpdate.id },
        data: {
          analysisCredits: {
            increment: amount,
          },
        },
      });

      this.logger.log(`Credits added: ${amount} to user ${userId}`);
      return user;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      this.logger.error(`Failed to add credits: ${error.message}`, error.stack);
      throw error;
    }
  }

  async isUserBanned(telegramId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
      select: { isBanned: true },
    });

    return user?.isBanned || false;
  }

  async banUser(userId: string, reason?: string): Promise<User> {
    try {
      const bannedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          isBanned: true,
          banReason: reason || 'Banned by administrator',
          bannedAt: new Date(),
        },
      });

      this.logger.log(`User banned: ${userId}, reason: ${reason}`);
      return bannedUser;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      this.logger.error(`Failed to ban user: ${error.message}`, error.stack);
      throw error;
    }
  }

  async unbanUser(userId: string): Promise<User> {
    try {
      const unbannedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          isBanned: false,
          banReason: null,
          bannedAt: null,
        },
      });

      this.logger.log(`User unbanned: ${userId}`);
      return unbannedUser;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      this.logger.error(`Failed to unban user: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUsers(query: GetUsersQueryDto): Promise<PaginatedUsers> {
    const {
      page = 1,
      limit = 50,
      search,
      sortBy = 'createdAt',
      sortDirection = 'desc',
      funnelAction,
      funnelState,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      ...(search && {
        OR: [
          { telegramUsername: { contains: search, mode: 'insensitive' } },
          { telegramId: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(funnelAction && { funnelAction }),
      ...(funnelState && { funnelState }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { [sortBy]: sortDirection },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              analyses: true,
              referralsGiven: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Преобразуем результат
    const usersWithStats: UserWithStats[] = users.map((user) => ({
      ...user,
      analyzesCount: user._count.analyses,
      referralsCount: user._count.referralsGiven,
      _count: undefined,
    }));

    return {
      users: usersWithStats,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    bannedUsers: number;
    usersLast30Days: number;
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalUsers, bannedUsers, usersLast30Days] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isBanned: true } }),
      this.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    ]);

    const activeUsers = totalUsers - bannedUsers;

    return {
      totalUsers,
      activeUsers,
      bannedUsers,
      usersLast30Days,
    };
  }

  async getFunnelStats(): Promise<{
    BOT_JOINED: number;
    FIRST_PHOTO_ANALYSIS: number;
    FEELINGS_SHARED: number;
    PSY_TEST_PASSED: number;
    HYPOTHESIS_RECEIVED: number;
    INVITED_FRIENDS_7: number;
    VIDEO_SHARED: number;
    PAYMENT_MADE: number;
    FUNNEL_COMPLETED: number;
  }> {
    const funnelStates = Object.values(FunnelState);

    const counts = await Promise.all(
      funnelStates.map((state) =>
        this.prisma.user.count({
          where: { funnelState: state },
        }),
      ),
    );

    const result = funnelStates.reduce((acc, state, index) => {
      acc[state] = counts[index];
      return acc;
    }, {} as any);

    return result;
  }

  /**
   * Получает язык пользователя по telegramId
   * @param telegramId - ID пользователя в Telegram
   * @returns Язык пользователя или RU по умолчанию
   */
  async getUserLanguage(telegramId: string): Promise<Language> {
    try {
      // Проверяем валидность telegramId
      if (!telegramId || telegramId === 'null' || telegramId === 'undefined') {
        this.logger.warn(`Invalid telegramId provided: "${telegramId}", using default language`);
        return Language.RU;
      }

      const user = await this.prisma.user.findUnique({
        where: { telegramId },
        select: { language: true },
      });

      return user?.language || Language.RU;
    } catch (error) {
      this.logger.error(`Failed to get user language for telegramId "${telegramId}": ${error.message}`, error.stack);
      return Language.RU; // Default fallback
    }
  }

  async sendPaymentSuccessNotification(data: {
    userId: string;
    telegramId: string;
    generationsAdded: number;
    amount: number;
  }): Promise<void> {
    try {
      const user = await this.findUserInfoByTeleramId(data.telegramId);
      if (!user) {
        this.logger.error(`User not found for payment notification: ${data.telegramId}`);
        return;
      }

      if (user.funnelState !== FunnelState.PAYMENT_MADE) {
        await this.updateUser(user.id, {
          funnelState: FunnelState.PAYMENT_MADE,
          funnelAction: UserFunnelAction.SUBSCRIPTION_PURCHASE,
        });
      }

      await this.notificationService.publishNotification({
        type: 'payment_success',
        userId: data.userId,
        chatId: user.telegramChatId,
        data: {
          generationsAdded: data.generationsAdded.toString(),
          amount: data.amount.toString(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to send payment notification: ${error.message}`, error.stack);
    }
  }

  /**
   * Получает количество рефералов пользователя
   * @param userId - внутренний ID пользователя из БД (не telegramId)
   * @returns Количество приглашённых пользователей
   */
  async getReferralsCount(userId: string): Promise<number> {
    try {
      this.logger.log(`Getting referrals count for userId: ${userId}`);
      const count = await this.prisma.referral.count({
        where: { referrerId: userId },
      });
      this.logger.log(`User ${userId} has ${count} referrals`);
      return count;
    } catch (error) {
      this.logger.error(`Failed to get referrals count for userId ${userId}: ${error.message}`, error.stack);
      return 0;
    }
  }

  /**
   * Предоставляет бесплатную подписку на месяц
   * @param userId - ID пользователя
   * @param reason - Причина предоставления подписки ('REFERRAL' | 'REPOST')
   * @returns Результат предоставления подписки
   */
  async grantFreeSubscription(
    userId: string,
    reason: 'REFERRAL' | 'REPOST',
  ): Promise<{ granted: boolean; reason?: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          subscriptionActive: true,
          subscriptionExpiry: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Проверяем идемпотентность - если подписка уже активна
      if (user.subscriptionActive && user.subscriptionExpiry && user.subscriptionExpiry > new Date()) {
        this.logger.log(`User ${userId} already has active subscription, skipping grant`);
        return {
          granted: false,
          reason: 'already_active',
        };
      }

      // Устанавливаем подписку на месяц
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1);

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionActive: true,
          subscriptionExpiry: expiryDate,
        },
      });

      this.logger.log(`Free subscription granted to user ${userId} for reason: ${reason}, expires: ${expiryDate}`);

      return {
        granted: true,
      };
    } catch (error) {
      this.logger.error(`Failed to grant free subscription: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Получает дневную статистику воронки пользователей
   * @param params - Параметры запроса
   * @returns Статистика по дням с пагинацией
   */
  async getDailyFunnelStats(params: { dateFrom?: Date; dateTo?: Date; page?: number; limit?: number }): Promise<{
    data: Array<{
      date: string;
      BOT_JOINED: number;
      FIRST_PHOTO_ANALYSIS: number;
      FEELINGS_SHARED: number;
      PSY_TEST_PASSED: number;
      HYPOTHESIS_RECEIVED: number;
      INVITED_FRIENDS_7: number;
      VIDEO_SHARED: number;
      PAYMENT_MADE: number;
      FUNNEL_COMPLETED: number;
      total: number;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const {
      dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 дней назад
      dateTo = new Date(),
      page = 1,
      limit = 30,
    } = params;

    try {
      this.logger.log(`Getting daily funnel stats from ${dateFrom.toISOString()} to ${dateTo.toISOString()}`);

      // Создаем массив дат для анализа
      const dates: Date[] = [];
      const currentDate = new Date(dateFrom);
      currentDate.setHours(0, 0, 0, 0);

      while (currentDate <= dateTo) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      const skip = (page - 1) * limit;
      const datesToProcess = dates.slice(skip, skip + limit);

      this.logger.log(`Processing ${datesToProcess.length} dates for funnel stats`);

      // Получаем данные по дням используя FunnelEvent
      const dailyData = await Promise.all(
        datesToProcess.map(async (date) => {
          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);

          this.logger.debug(`Processing date ${date.toISOString().split('T')[0]}`);

          // Считаем события изменения funnelState по дням из таблицы FunnelEvent
          const funnelEventCounts = await Promise.all([
            // Все состояния воронки считаем по событиям FunnelEvent для единообразности
            this.prisma.funnelEvent.count({
              where: {
                eventType: 'FUNNEL_STATE_CHANGE',
                newValue: 'BOT_JOINED',
                createdAt: { gte: date, lt: nextDate },
              },
            }),
            this.prisma.funnelEvent.count({
              where: {
                eventType: 'FUNNEL_STATE_CHANGE',
                newValue: 'FIRST_PHOTO_ANALYSIS',
                createdAt: { gte: date, lt: nextDate },
              },
            }),
            this.prisma.funnelEvent.count({
              where: {
                eventType: 'FUNNEL_STATE_CHANGE',
                newValue: 'FEELINGS_SHARED',
                createdAt: { gte: date, lt: nextDate },
              },
            }),
            this.prisma.funnelEvent.count({
              where: {
                eventType: 'FUNNEL_STATE_CHANGE',
                newValue: 'PSY_TEST_PASSED',
                createdAt: { gte: date, lt: nextDate },
              },
            }),
            this.prisma.funnelEvent.count({
              where: {
                eventType: 'FUNNEL_STATE_CHANGE',
                newValue: 'HYPOTHESIS_RECEIVED',
                createdAt: { gte: date, lt: nextDate },
              },
            }),
            this.prisma.funnelEvent.count({
              where: {
                eventType: 'FUNNEL_STATE_CHANGE',
                newValue: 'INVITED_FRIENDS_7',
                createdAt: { gte: date, lt: nextDate },
              },
            }),
            this.prisma.funnelEvent.count({
              where: {
                eventType: 'FUNNEL_STATE_CHANGE',
                newValue: 'VIDEO_SHARED',
                createdAt: { gte: date, lt: nextDate },
              },
            }),
            this.prisma.funnelEvent.count({
              where: {
                eventType: 'FUNNEL_STATE_CHANGE',
                newValue: 'PAYMENT_MADE',
                createdAt: { gte: date, lt: nextDate },
              },
            }),
            this.prisma.funnelEvent.count({
              where: {
                eventType: 'FUNNEL_STATE_CHANGE',
                newValue: 'FUNNEL_COMPLETED',
                createdAt: { gte: date, lt: nextDate },
              },
            }),
          ]);

          const [
            botJoined,
            firstPhotoAnalysis,
            feelingsShared,
            psyTestPassed,
            hypothesisReceived,
            invitedFriends7,
            videoShared,
            paymentMade,
            funnelCompleted,
          ] = funnelEventCounts;

          const total =
            botJoined +
            firstPhotoAnalysis +
            feelingsShared +
            psyTestPassed +
            hypothesisReceived +
            invitedFriends7 +
            videoShared +
            paymentMade +
            funnelCompleted;

          const result = {
            date: date.toISOString().split('T')[0],
            BOT_JOINED: botJoined,
            FIRST_PHOTO_ANALYSIS: firstPhotoAnalysis,
            FEELINGS_SHARED: feelingsShared,
            PSY_TEST_PASSED: psyTestPassed,
            HYPOTHESIS_RECEIVED: hypothesisReceived,
            INVITED_FRIENDS_7: invitedFriends7,
            VIDEO_SHARED: videoShared,
            PAYMENT_MADE: paymentMade,
            FUNNEL_COMPLETED: funnelCompleted,
            total,
          };

          this.logger.debug(`Daily stats for ${date.toISOString().split('T')[0]}:`, result);
          return result;
        }),
      );

      const totalDays = dates.length;
      const totalPages = Math.ceil(totalDays / limit);

      this.logger.log(`Daily funnel stats completed: ${dailyData.length} days processed`);

      return {
        data: dailyData,
        pagination: {
          page,
          limit,
          total: totalDays,
          totalPages,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get daily funnel stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Получает количество пользователей, полностью прошедших воронку
   * @returns Количество пользователей со статусом FUNNEL_COMPLETED
   */
  async getFunnelCompletionStats(): Promise<number> {
    try {
      const count = await this.prisma.user.count({
        where: { funnelState: FunnelState.FUNNEL_COMPLETED },
      });
      return count;
    } catch (error) {
      this.logger.error(`Failed to get funnel completion stats: ${error.message}`, error.stack);
      return 0;
    }
  }

  /**
   * Устанавливает состояние "поделился чувствами"
   * @param userId - ID пользователя
   */
  async markFeelingsShared(userId: string): Promise<void> {
    try {
      await this.updateUser(userId, {
        funnelState: FunnelState.FEELINGS_SHARED,
        funnelAction: UserFunnelAction.FEELINGS_SHARE,
      });
      this.logger.log(`User ${userId} marked as feelings shared`);
    } catch (error) {
      this.logger.error(`Failed to mark feelings shared: ${error.message}`, error.stack);
    }
  }

  /**
   * Устанавливает состояние "прошел психологический тест"
   * @param userId - ID пользователя
   */
  async markPsyTestPassed(userId: string): Promise<void> {
    try {
      await this.updateUser(userId, {
        funnelState: FunnelState.PSY_TEST_PASSED,
        funnelAction: UserFunnelAction.PSY_TEST_COMPLETE,
      });
      this.logger.log(`User ${userId} marked as psy test passed`);
    } catch (error) {
      this.logger.error(`Failed to mark psy test passed: ${error.message}`, error.stack);
    }
  }

  /**
   * Устанавливает состояние "получил блок-гипотезу"
   * @param userId - ID пользователя
   */
  async markHypothesisReceived(userId: string): Promise<void> {
    try {
      await this.updateUser(userId, {
        funnelState: FunnelState.HYPOTHESIS_RECEIVED,
        funnelAction: UserFunnelAction.HYPOTHESIS_RECEIVE,
      });
      this.logger.log(`User ${userId} marked as hypothesis received`);
    } catch (error) {
      this.logger.error(`Failed to mark hypothesis received: ${error.message}`, error.stack);
    }
  }

  /**
   * Устанавливает состояние "поделился видео"
   * @param userId - ID пользователя
   */
  async markVideoShared(userId: string): Promise<void> {
    try {
      await this.updateUser(userId, {
        funnelState: FunnelState.VIDEO_SHARED,
        funnelAction: UserFunnelAction.VIDEO_SHARE,
      });
      this.logger.log(`User ${userId} marked as video shared`);
    } catch (error) {
      this.logger.error(`Failed to mark video shared: ${error.message}`, error.stack);
    }
  }

  /**
   * Устанавливает состояние "сделал первый фото анализ"
   * @param userId - ID пользователя
   */
  async markFirstPhotoAnalysis(userId: string): Promise<void> {
    try {
      const existingAnalyses = await this.prisma.analyze.count({
        where: { userId },
      });

      // Устанавливаем состояние только при первом анализе
      if (existingAnalyses === 1) {
        await this.updateUser(userId, {
          funnelState: FunnelState.FIRST_PHOTO_ANALYSIS,
          funnelAction: UserFunnelAction.ANALYSIS_COMPLETE,
        });
        this.logger.log(`User ${userId} marked as first photo analysis completed`);
      }
    } catch (error) {
      this.logger.error(`Failed to mark first photo analysis: ${error.message}`, error.stack);
    }
  }

  /**
   * Проверяет и устанавливает состояние полного прохождения воронки
   * @param userId - ID пользователя
   */
  async checkAndMarkFunnelCompleted(userId: string): Promise<void> {
    try {
      const user = await this.findUserById(userId);
      if (!user) return;

      // Проверяем, что пользователь прошел все этапы до последнего
      const hasPayment = user.funnelState === FunnelState.PAYMENT_MADE;
      const hasActiveSubscription = user.subscriptionActive;

      if (hasPayment && hasActiveSubscription) {
        await this.updateUser(userId, {
          funnelState: FunnelState.FUNNEL_COMPLETED,
          funnelAction: UserFunnelAction.FUNNEL_COMPLETE,
        });
        this.logger.log(`User ${userId} marked as funnel completed`);
      }
    } catch (error) {
      this.logger.error(`Failed to check and mark funnel completed: ${error.message}`, error.stack);
    }
  }

  /**
   * Ретроактивно создает события BOT_JOINED для существующих пользователей без такого события
   * Используется для миграции данных при обновлении системы статистики
   * @returns Количество созданных событий
   */
  async createMissingBotJoinedEvents(): Promise<number> {
    try {
      // Находим пользователей без события BOT_JOINED
      const usersWithoutBotJoinedEvent = (await this.prisma.$queryRaw`
        SELECT u.id, u."createdAt", u."funnelState", u."funnelAction"
        FROM "User" u
        LEFT JOIN "FunnelEvent" fe ON fe."userId" = u.id 
          AND fe."eventType" = 'FUNNEL_STATE_CHANGE' 
          AND fe."newValue" = 'BOT_JOINED'
        WHERE fe.id IS NULL
      `) as Array<{
        id: string;
        createdAt: Date;
        funnelState: string | null;
        funnelAction: string | null;
      }>;

      this.logger.log(`Found ${usersWithoutBotJoinedEvent.length} users without BOT_JOINED events`);

      let createdEventsCount = 0;

      // Создаем события BOT_JOINED для каждого пользователя без такого события
      for (const user of usersWithoutBotJoinedEvent) {
        try {
          await this.prisma.funnelEvent.create({
            data: {
              userId: user.id,
              eventType: 'FUNNEL_STATE_CHANGE',
              previousValue: null,
              newValue: 'BOT_JOINED',
              funnelState: FunnelState.BOT_JOINED,
              funnelAction: UserFunnelAction.START,
              createdAt: user.createdAt, // Используем дату создания пользователя
            },
          });

          // Обновляем состояние пользователя если оно не установлено
          if (!user.funnelState || !user.funnelAction) {
            await this.prisma.user.update({
              where: { id: user.id },
              data: {
                funnelState: FunnelState.BOT_JOINED,
                funnelAction: UserFunnelAction.START,
              },
            });
          }

          createdEventsCount++;
        } catch (error) {
          this.logger.error(`Failed to create BOT_JOINED event for user ${user.id}: ${error.message}`);
        }
      }

      this.logger.log(`Created ${createdEventsCount} BOT_JOINED events for existing users`);
      return createdEventsCount;
    } catch (error) {
      this.logger.error(`Failed to create missing BOT_JOINED events: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ========== Методы для управления платными подписками ==========

  /**
   * Активирует платную подписку для пользователя
   * @param userId ID пользователя
   * @param subscriptionData Данные подписки от payment service
   * @returns Обновленный пользователь
   */
  async activateSubscription(userId: string, subscriptionData: any): Promise<User> {
    try {
      this.logger.debug(`Activating subscription for user ${userId}:`, subscriptionData);

      const endDate = subscriptionData.endDate ? new Date(subscriptionData.endDate) : null;

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionActive: true,
          subscriptionExpiry: endDate,
        },
      });

      // Обновляем состояние воронки, если пользователь еще не дошел до PAYMENT_MADE
      if (updatedUser.funnelState !== FunnelState.PAYMENT_MADE) {
        await this.updateUser(userId, {
          funnelState: FunnelState.PAYMENT_MADE,
          funnelAction: UserFunnelAction.SUBSCRIPTION_PURCHASE,
        });
      }

      // Проверяем и отмечаем завершение воронки
      await this.checkAndMarkFunnelCompleted(userId);

      this.logger.log(`Subscription activated for user ${userId}, expires: ${endDate}`);
      return updatedUser;
    } catch (error) {
      this.logger.error(`Failed to activate subscription for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Деактивирует подписку пользователя
   * @param userId ID пользователя
   * @returns Обновленный пользователь
   */
  async deactivateSubscription(userId: string): Promise<User> {
    try {
      this.logger.debug(`Deactivating subscription for user ${userId}`);

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionActive: false,
          subscriptionExpiry: null,
        },
      });

      this.logger.log(`Subscription deactivated for user ${userId}`);
      return updatedUser;
    } catch (error) {
      this.logger.error(`Failed to deactivate subscription for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Продлевает подписку пользователя до указанной даты
   * @param userId ID пользователя
   * @param endDate Новая дата окончания подписки
   * @returns Обновленный пользователь
   */
  async extendSubscription(userId: string, endDate: Date): Promise<User> {
    try {
      this.logger.debug(`Extending subscription for user ${userId} until ${endDate}`);

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionActive: true,
          subscriptionExpiry: endDate,
        },
      });

      this.logger.log(`Subscription extended for user ${userId} until ${endDate}`);
      return updatedUser;
    } catch (error) {
      this.logger.error(`Failed to extend subscription for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Обновляет статус подписки пользователя
   * @param userId ID пользователя
   * @param isActive Активна ли подписка
   * @param expiryDate Дата истечения (опционально)
   * @returns Обновленный пользователь
   */
  async updateSubscriptionStatus(userId: string, isActive: boolean, expiryDate?: Date): Promise<User> {
    try {
      this.logger.debug(`Updating subscription status for user ${userId}: active=${isActive}, expiry=${expiryDate}`);

      const updateData: any = {
        subscriptionActive: isActive,
      };

      if (expiryDate !== undefined) {
        updateData.subscriptionExpiry = expiryDate;
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });

      this.logger.log(`Subscription status updated for user ${userId}: active=${isActive}`);
      return updatedUser;
    } catch (error) {
      this.logger.error(`Failed to update subscription status for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Проверяет имеет ли пользователь активную подписку
   * @param userId ID пользователя (может быть telegramId или внутренний ID)
   * @returns true если подписка активна
   */
  async hasActiveSubscription(userId: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [{ id: userId }, { telegramId: userId }],
        },
        select: {
          subscriptionActive: true,
          subscriptionExpiry: true,
        },
      });

      if (!user) {
        return false;
      }

      const now = new Date();
      const hasActiveSubscription = user.subscriptionActive && user.subscriptionExpiry && user.subscriptionExpiry > now;

      this.logger.debug(`User ${userId} subscription check: active=${hasActiveSubscription}`);
      return hasActiveSubscription;
    } catch (error) {
      this.logger.error(`Failed to check subscription for user ${userId}:`, error.message);
      return false;
    }
  }

  /**
   * Получает информацию о подписке пользователя
   * @param userId ID пользователя (может быть telegramId или внутренний ID)
   * @returns Информация о подписке или null
   */
  async getSubscriptionInfo(userId: string): Promise<{
    isActive: boolean;
    expiryDate: Date | null;
    daysRemaining: number | null;
  } | null> {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [{ id: userId }, { telegramId: userId }],
        },
        select: {
          subscriptionActive: true,
          subscriptionExpiry: true,
        },
      });

      if (!user) {
        return null;
      }

      const now = new Date();
      const isActive = user.subscriptionActive && user.subscriptionExpiry && user.subscriptionExpiry > now;

      let daysRemaining = null;
      if (user.subscriptionExpiry && isActive) {
        daysRemaining = Math.ceil((user.subscriptionExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      const result = {
        isActive,
        expiryDate: user.subscriptionExpiry,
        daysRemaining,
      };

      this.logger.debug(`Subscription info for user ${userId}:`, result);
      return result;
    } catch (error) {
      this.logger.error(`Failed to get subscription info for user ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Обрабатывает уведомления о подписочных платежах
   * Расширяет существующий sendPaymentSuccessNotification для поддержки подписок
   * @param data Данные платежа
   */
  async handleSubscriptionPaymentNotification(data: {
    userId: string;
    telegramId: string;
    subscriptionId: string;
    subscriptionDays: number;
    amount: number;
    isRecurring?: boolean;
  }): Promise<void> {
    try {
      this.logger.debug(`Processing subscription payment notification:`, data);

      const user = await this.findUserInfoByTeleramId(data.telegramId);
      if (!user) {
        this.logger.error(`User not found for subscription payment notification: ${data.telegramId}`);
        return;
      }

      // Активируем подписку на указанное количество дней
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + data.subscriptionDays);

      await this.activateSubscription(user.id, {
        subscriptionId: data.subscriptionId,
        endDate,
        isRecurring: data.isRecurring,
      });

      // Отправляем уведомление пользователю (используем существующий тип payment_success)
      await this.notificationService.publishNotification({
        type: 'payment_success',
        userId: user.id,
        chatId: user.telegramChatId,
        data: {
          amount: data.amount.toString(),
          message: `Подписка активирована на ${data.subscriptionDays} дней до ${endDate.toLocaleDateString()}`,
        },
      });

      this.logger.log(`Subscription payment processed for user ${data.telegramId}, ${data.subscriptionDays} days`);
    } catch (error) {
      this.logger.error(`Failed to handle subscription payment notification:`, error.message);
    }
  }

  /**
   * Проверяет подписку перед списанием кредитов для анализов
   * Если у пользователя активная подписка, кредиты не списываются
   * @param userId ID пользователя
   * @param amount Количество кредитов для списания
   * @returns Информация о списании
   */
  async deductCreditsWithSubscriptionCheck(
    userId: string,
    amount: number = 1,
  ): Promise<{
    creditsDeducted: boolean;
    hasActiveSubscription: boolean;
    user: User;
  }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Проверяем активную подписку
      const hasActiveSubscription = await this.hasActiveSubscription(userId);

      if (hasActiveSubscription) {
        // Подписка активна - кредиты не списываем
        this.logger.debug(`User ${userId} has active subscription, skipping credit deduction`);
        return {
          creditsDeducted: false,
          hasActiveSubscription: true,
          user,
        };
      }

      // Подписки нет - списываем кредиты как обычно
      const updatedUser = await this.deductCredits(userId, amount);

      return {
        creditsDeducted: true,
        hasActiveSubscription: false,
        user: updatedUser,
      };
    } catch (error) {
      this.logger.error(`Failed to deduct credits with subscription check:`, error.message);
      throw error;
    }
  }

  /**
   * Очистка данных пользователя
   * Удаляет все данные анализов, результаты теста Люшера, гипотезы и файлы, но оставляет пользователя в системе
   * @param userId - ID пользователя для очистки данных
   * @returns результат операции очистки
   */
  async clearUserData(userId: string): Promise<{ success: boolean; message: string; filesDeleted: number }> {
    const fs = require('fs');
    const path = require('path');

    try {
      this.logger.log(`Начинается очистка данных пользователя ${userId}`);

      // Проверяем существование пользователя
      const userExists = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, telegramId: true, telegramUsername: true },
      });

      if (!userExists) {
        throw new NotFoundException(`Пользователь с ID ${userId} не найден`);
      }

      // Собираем информацию о файлах пользователя ПЕРЕД удалением из БД
      const userFilesToDelete: string[] = [];

      // 1. Получаем все UserInfo записи пользователя для извлечения путей к файлам
      const userInfos = await this.prisma.userInfo.findMany({
        where: { userId },
        select: {
          photoUrls: true,
          socialCardUrl: true,
          luscherTestResult: true,
          luscherTestCompleted: true,
          id: true,
        },
      });

      // 2. Получаем все Analyze записи пользователя для извлечения путей к файлам
      const analyzes = await this.prisma.analyze.findMany({
        where: { userId },
        select: {
          inputPhotoUrl: true,
          postcardImageUrl: true,
          id: true,
        },
      });

      this.logger.debug(
        `Найдено ${userInfos.length} UserInfo записей и ${analyzes.length} Analyze записей для пользователя ${userId}`,
      );

      // Собираем пути к файлам из UserInfo
      for (const userInfo of userInfos) {
        // Фотографии пользователя из photoUrls (JSON массив)
        if (userInfo.photoUrls) {
          try {
            const photoUrls = JSON.parse(userInfo.photoUrls);
            if (Array.isArray(photoUrls)) {
              // Фильтруем только локальные пути (не fileId из Telegram)
              const localPhotoPaths = photoUrls.filter(
                (url: string) =>
                  url &&
                  typeof url === 'string' &&
                  (url.includes('/uploads/') || url.startsWith('./') || url.startsWith('/')),
              );
              userFilesToDelete.push(...localPhotoPaths);
            }
          } catch (parseError) {
            this.logger.warn(`Не удалось парсить photoUrls для UserInfo ${userInfo.id}: ${parseError.message}`);
          }
        }

        // Социальная карточка
        if (userInfo.socialCardUrl && typeof userInfo.socialCardUrl === 'string') {
          userFilesToDelete.push(userInfo.socialCardUrl);
        }
      }

      // Собираем пути к файлам из Analyze
      for (const analyze of analyzes) {
        // Входные фотографии
        if (analyze.inputPhotoUrl && Array.isArray(analyze.inputPhotoUrl)) {
          const localPhotoPaths = analyze.inputPhotoUrl.filter(
            (url: string) =>
              url &&
              typeof url === 'string' &&
              (url.includes('/uploads/') || url.startsWith('./') || url.startsWith('/')),
          );
          userFilesToDelete.push(...localPhotoPaths);
        }

        // Открытки/социальные изображения
        if (analyze.postcardImageUrl && typeof analyze.postcardImageUrl === 'string') {
          userFilesToDelete.push(analyze.postcardImageUrl);
        }
      }

      // Добавляем поиск файлов по паттернам в uploads директории
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const photosDir = path.join(uploadsDir, 'photos');
      const tempDir = path.join(uploadsDir, 'temp');

      // Ищем файлы, содержащие telegramId пользователя в имени
      const telegramId = userExists.telegramId;

      for (const dir of [photosDir, tempDir]) {
        if (fs.existsSync(dir)) {
          try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
              // Проверяем, содержит ли имя файла telegramId или userId
              if (file.includes(telegramId) || file.includes(userId)) {
                const fullPath = path.join(dir, file);
                userFilesToDelete.push(fullPath);
              }
            }
          } catch (dirError) {
            this.logger.warn(`Не удалось прочитать директорию ${dir}: ${dirError.message}`);
          }
        }
      }

      // Удаляем дубликаты из списка файлов
      const uniqueFilesToDelete = Array.from(new Set(userFilesToDelete));
      this.logger.log(`Найдено ${uniqueFilesToDelete.length} файлов для удаления пользователя ${userId}`);

      // Выполняем транзакцию для очистки данных из БД (НЕ удаляем самого пользователя)
      await this.prisma.$transaction(async (tx) => {
        // Очищаем связанные данные в правильном порядке

        // 1. Удаляем события воронки
        await tx.funnelEvent.deleteMany({
          where: { userId },
        });

        // 2. Удаляем информацию пользователя (анализы OpenAI/DeepSeek, включая результаты теста Люшера)
        await tx.userInfo.deleteMany({
          where: { userId },
        });

        // 3. Удаляем таймер пользователя
        await tx.userTimer.deleteMany({
          where: { userId },
        });

        // 4. Удаляем анализы
        await tx.analyze.deleteMany({
          where: { userId },
        });

        // 5. Сбрасываем состояния пользователя в воронке
        await tx.user.update({
          where: { id: userId },
          data: {
            funnelAction: null,
            funnelState: null,
            pipelineState: null,
            photoFailureAttempts: 0,
          },
        });
      });

      // После успешной очистки из БД, удаляем физические файлы
      let deletedFilesCount = 0;
      let failedFilesCount = 0;

      for (const filePath of uniqueFilesToDelete) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedFilesCount++;
            this.logger.debug(`Удален файл: ${filePath}`);
          }
        } catch (fileError) {
          failedFilesCount++;
          this.logger.warn(`Не удалось удалить файл ${filePath}: ${fileError.message}`);
        }
      }

      this.logger.log(
        `Данные пользователя ${userId} (Telegram: ${userExists.telegramUsername || userExists.telegramId}) успешно очищены. ` +
          `Удалено файлов: ${deletedFilesCount}, ошибок удаления файлов: ${failedFilesCount}`,
      );

      return {
        success: true,
        message: `Данные пользователя успешно очищены. Удалено ${deletedFilesCount} файлов.`,
        filesDeleted: deletedFilesCount,
      };
    } catch (error) {
      this.logger.error(`Ошибка при очистке данных пользователя ${userId}: ${error.message}`, error.stack);

      if (error instanceof NotFoundException) {
        throw error;
      }

      if (error.code === 'P2025') {
        throw new NotFoundException(`Пользователь с ID ${userId} не найден`);
      }

      throw new Error(`Не удалось очистить данные пользователя: ${error.message}`);
    }
  }

  /**
   * Полное удаление пользователя из системы
   * Удаляет пользователя и все связанные с ним данные из базы данных и файловой системы
   * @param userId - ID пользователя для удаления
   * @returns результат операции удаления
   */
  async deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    const fs = require('fs');
    const path = require('path');

    try {
      this.logger.log(`Начинается полное удаление пользователя ${userId}`);

      // Проверяем существование пользователя
      const userExists = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, telegramId: true, telegramUsername: true },
      });

      if (!userExists) {
        throw new NotFoundException(`Пользователь с ID ${userId} не найден`);
      }

      // Собираем информацию о файлах пользователя ПЕРЕД удалением из БД
      const userFilesToDelete: string[] = [];

      // 1. Получаем все UserInfo записи пользователя для извлечения путей к файлам
      const userInfos = await this.prisma.userInfo.findMany({
        where: { userId },
        select: {
          photoUrls: true,
          socialCardUrl: true,
          id: true,
        },
      });

      // 2. Получаем все Analyze записи пользователя для извлечения путей к файлам
      const analyzes = await this.prisma.analyze.findMany({
        where: { userId },
        select: {
          inputPhotoUrl: true,
          postcardImageUrl: true,
          id: true,
        },
      });

      this.logger.debug(
        `Найдено ${userInfos.length} UserInfo записей и ${analyzes.length} Analyze записей для пользователя ${userId}`,
      );

      // Собираем пути к файлам из UserInfo
      for (const userInfo of userInfos) {
        // Фотографии пользователя из photoUrls (JSON массив)
        if (userInfo.photoUrls) {
          try {
            const photoUrls = JSON.parse(userInfo.photoUrls);
            if (Array.isArray(photoUrls)) {
              // Фильтруем только локальные пути (не fileId из Telegram)
              const localPhotoPaths = photoUrls.filter(
                (url: string) =>
                  url &&
                  typeof url === 'string' &&
                  (url.includes('/uploads/') || url.startsWith('./') || url.startsWith('/')),
              );
              userFilesToDelete.push(...localPhotoPaths);
            }
          } catch (parseError) {
            this.logger.warn(`Не удалось парсить photoUrls для UserInfo ${userInfo.id}: ${parseError.message}`);
          }
        }

        // Социальная карточка
        if (userInfo.socialCardUrl && typeof userInfo.socialCardUrl === 'string') {
          userFilesToDelete.push(userInfo.socialCardUrl);
        }
      }

      // Собираем пути к файлам из Analyze
      for (const analyze of analyzes) {
        // Входные фотографии
        if (analyze.inputPhotoUrl && Array.isArray(analyze.inputPhotoUrl)) {
          const localPhotoPaths = analyze.inputPhotoUrl.filter(
            (url: string) =>
              url &&
              typeof url === 'string' &&
              (url.includes('/uploads/') || url.startsWith('./') || url.startsWith('/')),
          );
          userFilesToDelete.push(...localPhotoPaths);
        }

        // Открытки/социальные изображения
        if (analyze.postcardImageUrl && typeof analyze.postcardImageUrl === 'string') {
          userFilesToDelete.push(analyze.postcardImageUrl);
        }
      }

      // Добавляем поиск файлов по паттернам в uploads директории
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const photosDir = path.join(uploadsDir, 'photos');
      const tempDir = path.join(uploadsDir, 'temp');

      // Ищем файлы, содержащие telegramId пользователя в имени
      const telegramId = userExists.telegramId;
      const searchPatterns = [
        `*${telegramId}*`,
        `*${userId}*`,
        `social_*${telegramId}*`,
        `avatar_${telegramId}_*`,
        `temp_*${telegramId}*`,
      ];

      for (const dir of [photosDir, tempDir]) {
        if (fs.existsSync(dir)) {
          try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
              // Проверяем, содержит ли имя файла telegramId или userId
              if (file.includes(telegramId) || file.includes(userId)) {
                const fullPath = path.join(dir, file);
                userFilesToDelete.push(fullPath);
              }
            }
          } catch (dirError) {
            this.logger.warn(`Не удалось прочитать директорию ${dir}: ${dirError.message}`);
          }
        }
      }

      // Удаляем дубликаты из списка файлов
      const uniqueFilesToDelete = Array.from(new Set(userFilesToDelete));
      this.logger.log(`Найдено ${uniqueFilesToDelete.length} файлов для удаления пользователя ${userId}`);

      // Выполняем транзакцию для удаления всех связанных данных из БД
      await this.prisma.$transaction(async (tx) => {
        // Удаляем связанные данные в правильном порядке
        // Многие удаления произойдут автоматически благодаря onDelete: Cascade

        // 1. Удаляем события воронки
        await tx.funnelEvent.deleteMany({
          where: { userId },
        });

        // 2. Удаляем диагностические логи пользователя (будут удалены каскадно или через отдельный запрос)

        // 3. Удаляем информацию пользователя (анализы OpenAI/DeepSeek, включая результаты теста Люшера)
        await tx.userInfo.deleteMany({
          where: { userId },
        });

        // 4. Удаляем таймер пользователя
        await tx.userTimer.deleteMany({
          where: { userId },
        });

        // 5. Удаляем анализы
        await tx.analyze.deleteMany({
          where: { userId },
        });

        // 6. Удаляем рефералы (связи где пользователь выступает как приглашенный)
        await tx.referral.deleteMany({
          where: { invitedUserId: userId },
        });

        // 7. Удаляем рефералы (связи где пользователь выступает как пригласивший)
        await tx.referral.deleteMany({
          where: { referrerId: userId },
        });

        // 8. Удаляем предложения пользователя
        await tx.offer.deleteMany({
          where: { userId },
        });

        // 9. Наконец, удаляем самого пользователя
        await tx.user.delete({
          where: { id: userId },
        });
      });

      // Примечание: диагностические логи пользователя остаются в базе для отладки

      // После успешного удаления из БД, удаляем физические файлы
      let deletedFilesCount = 0;
      let failedFilesCount = 0;

      for (const filePath of uniqueFilesToDelete) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedFilesCount++;
            this.logger.debug(`Удален файл: ${filePath}`);
          }
        } catch (fileError) {
          failedFilesCount++;
          this.logger.warn(`Не удалось удалить файл ${filePath}: ${fileError.message}`);
        }
      }

      this.logger.log(
        `Пользователь ${userId} (Telegram: ${userExists.telegramUsername || userExists.telegramId}) успешно удален из системы. ` +
          `Удалено файлов: ${deletedFilesCount}, ошибок удаления файлов: ${failedFilesCount}`,
      );

      return {
        success: true,
        message: `Пользователь успешно удален из системы. Удалено ${deletedFilesCount} файлов.`,
      };
    } catch (error) {
      this.logger.error(`Ошибка при удалении пользователя ${userId}: ${error.message}`, error.stack);

      if (error instanceof NotFoundException) {
        throw error;
      }

      if (error.code === 'P2025') {
        throw new NotFoundException(`Пользователь с ID ${userId} не найден`);
      }

      throw new Error(`Не удалось удалить пользователя: ${error.message}`);
    }
  }
}
