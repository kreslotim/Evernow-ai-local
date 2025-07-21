import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAnalyzeDto, UpdateAnalyzeDto, GetAnalyzesQueryDto } from '../../../common/dtos/analyze.dto';
import { AnalyzeWithUser, PaginatedAnalyzes } from '../../../common/interfaces/analyze.interface';
import { Analyze, AnalyzeType, ProcessingStatus, Prisma } from '@prisma/client';
import { QueueService } from '../queue/services/queue.service';

@Injectable()
export class AnalyzeService {
  private readonly logger = new Logger(AnalyzeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async createAnalyze(createAnalyzeDto: CreateAnalyzeDto): Promise<Analyze> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: createAnalyzeDto.userId },
        select: {
          analysisCredits: true,
          subscriptionActive: true,
          subscriptionExpiry: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const cost = createAnalyzeDto.cost || 1;
      const hasActiveSubscription =
        user.subscriptionActive && user.subscriptionExpiry && user.subscriptionExpiry > new Date();

      // Проверяем кредиты только если нет активной подписки
      if (!hasActiveSubscription && user.analysisCredits < cost) {
        throw new BadRequestException('Insufficient credits');
      }

      const analyze = await this.prisma.analyze.create({
        data: {
          userId: createAnalyzeDto.userId,
          type: createAnalyzeDto.type,
          inputPhotoUrl: createAnalyzeDto.inputPhotoUrl,
          cost,
          status: ProcessingStatus.PENDING,
        },
      });

      // Списываем кредиты только если у пользователя нет активной подписки
      if (!hasActiveSubscription) {
        await this.prisma.user.update({
          where: { id: createAnalyzeDto.userId },
          data: {
            analysisCredits: {
              decrement: cost,
            },
          },
        });
      }

      // УДАЛЕНО: Запуск старого photo-analysis процессора
      // Теперь анализ запускается ТОЛЬКО в completeSurvey с контекстом психологического теста
      // await this.queueService.addPhotoAnalysisJob({
      //   id: analyze.id,
      //   userId: createAnalyzeDto.userId,
      //   photoUrl: createAnalyzeDto.inputPhotoUrl,
      //   chatId: createAnalyzeDto.chatId,
      //   messageId: createAnalyzeDto.messageId,
      //   analysisType: createAnalyzeDto.type,
      // });

      this.logger.log(
        `New analyze created without queue processing: ${analyze.id} for user ${createAnalyzeDto.userId}`,
      );
      this.logger.log(`Analysis will be triggered ONLY after psychological test completion in completeSurvey`);
      return analyze;
    } catch (error) {
      this.logger.error(`Failed to create analyze: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAnalyzeById(id: string): Promise<Analyze | null> {
    return this.prisma.analyze.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            telegramUsername: true,
            telegramId: true,
          },
        },
      },
    });
  }

  async updateAnalyze(id: string, updateAnalyzeDto: UpdateAnalyzeDto): Promise<Analyze> {
    try {
      const updatedAnalyze = await this.prisma.analyze.update({
        where: { id },
        data: updateAnalyzeDto,
      });

      return updatedAnalyze;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Analyze not found');
      }
      this.logger.error(`Failed to update analyze: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUserAnalyzes(userId: string, page: number = 1, limit: number = 10): Promise<PaginatedAnalyzes> {
    const skip = (page - 1) * limit;

    const [analyses, total] = await Promise.all([
      this.prisma.analyze.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              telegramUsername: true,
              telegramId: true,
            },
          },
        },
      }),
      this.prisma.analyze.count({ where: { userId } }),
    ]);

    return {
      analyses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAnalyzesCountByUserId(userId: string): Promise<number> {
    return await this.prisma.analyze.count({
      where: { userId },
    });
  }

  async getAnalyzes(query: GetAnalyzesQueryDto): Promise<PaginatedAnalyzes> {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortDirection = 'desc', status, type, userId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AnalyzeWhereInput = {};

    if (search) {
      where.OR = [
        { analysisResultText: { contains: search, mode: 'insensitive' } },
        { summaryText: { contains: search, mode: 'insensitive' } },
        { user: { telegramUsername: { contains: search, mode: 'insensitive' } } },
        { user: { telegramId: { contains: search } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (userId) {
      where.userId = userId;
    }

    const [analyses, total] = await Promise.all([
      this.prisma.analyze.findMany({
        where,
        orderBy: { [sortBy]: sortDirection },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              telegramUsername: true,
              telegramId: true,
            },
          },
        },
      }),
      this.prisma.analyze.count({ where }),
    ]);

    return {
      analyses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async completeAnalyze(
    id: string,
    result: { analysisResultText: string; summaryText?: string; postcardImageUrl?: string },
  ): Promise<Analyze> {
    try {
      const completedAnalyze = await this.prisma.analyze.update({
        where: { id },
        data: {
          status: ProcessingStatus.COMPLETED,
          analysisResultText: result.analysisResultText,
          summaryText: result.summaryText,
          postcardImageUrl: result.postcardImageUrl,
        },
      });

      return completedAnalyze;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Analyze not found');
      }
      this.logger.error(`Failed to complete analyze: ${error.message}`, error.stack);
      throw error;
    }
  }

  async failAnalyze(id: string, errorMessage: string): Promise<Analyze> {
    try {
      const failedAnalyze = await this.prisma.analyze.update({
        where: { id },
        data: {
          status: ProcessingStatus.FAILED,
          errorMessage,
        },
      });

      const analyze = await this.prisma.analyze.findUnique({
        where: { id },
        select: { userId: true, cost: true },
      });

      if (analyze) {
        await this.prisma.user.update({
          where: { id: analyze.userId },
          data: {
            analysisCredits: {
              increment: analyze.cost,
            },
          },
        });
      }

      return failedAnalyze;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Analyze not found');
      }
      this.logger.error(`Failed to mark analyze as failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getAnalyzeStats(): Promise<{
    totalAnalyzes: number;
    completedAnalyzes: number;
    pendingAnalyzes: number;
    failedAnalyzes: number;
    analyzesLast30Days: number;
    analyzesByType: Record<AnalyzeType, number>;
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalAnalyzes, completedAnalyzes, pendingAnalyzes, failedAnalyzes, analyzesLast30Days, analyzesByType] =
      await Promise.all([
        this.prisma.analyze.count(),
        this.prisma.analyze.count({ where: { status: ProcessingStatus.COMPLETED } }),
        this.prisma.analyze.count({ where: { status: ProcessingStatus.PENDING } }),
        this.prisma.analyze.count({ where: { status: ProcessingStatus.FAILED } }),
        this.prisma.analyze.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        this.prisma.analyze.groupBy({
          by: ['type'],
          _count: { type: true },
        }),
      ]);

    const analyzesByTypeMap: Record<AnalyzeType, number> = {} as Record<AnalyzeType, number>;
    Object.values(AnalyzeType).forEach((type) => {
      analyzesByTypeMap[type] = 0;
    });

    analyzesByType.forEach((item) => {
      analyzesByTypeMap[item.type] = item._count.type;
    });

    return {
      totalAnalyzes,
      completedAnalyzes,
      pendingAnalyzes,
      failedAnalyzes,
      analyzesLast30Days,
      analyzesByType: analyzesByTypeMap,
    };
  }

  async deleteAnalyze(id: string): Promise<void> {
    try {
      await this.prisma.analyze.delete({ where: { id } });
      this.logger.log(`Analyze deleted: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete analyze: ${error.message}`, error.stack);
      throw error;
    }
  }
}
