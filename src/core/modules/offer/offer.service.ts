import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OfferStatus, Prisma } from '@prisma/client';
import {
  CreateOfferDto,
  UpdateOfferDto,
  GetOffersQueryDto,
  OfferResponseDto,
  PaginatedOffersResponseDto,
  ApproveOfferDto,
  RejectOfferDto,
} from '../../../common/dtos/offer.dto';

@Injectable()
export class OfferService {
  constructor(private readonly prisma: PrismaService) {}

  async createOffer(createOfferDto: CreateOfferDto): Promise<OfferResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { telegramId: createOfferDto.userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const offer = await this.prisma.offer.create({
        data: {
          title: createOfferDto.title,
          description: createOfferDto.description,
          userId: createOfferDto.userId,
        },
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

      return this.mapOfferToResponse(offer);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to create offer');
    }
  }

  async getOffers(query: GetOffersQueryDto): Promise<PaginatedOffersResponseDto> {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortDirection = 'desc', status, userId } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.OfferWhereInput = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { adminResponse: { contains: search, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { telegramUsername: { contains: search, mode: 'insensitive' } },
              { telegramId: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    // Build orderBy clause
    const orderBy: Prisma.OfferOrderByWithRelationInput = {};
    orderBy[sortBy] = sortDirection;

    try {
      const [offers, total] = await Promise.all([
        this.prisma.offer.findMany({
          where,
          skip,
          take: limit,
          orderBy,
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
        this.prisma.offer.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        offers: offers.map((offer) => this.mapOfferToResponse(offer)),
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch offers');
    }
  }

  async getOfferById(id: string): Promise<OfferResponseDto> {
    try {
      const offer = await this.prisma.offer.findUnique({
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

      if (!offer) {
        throw new NotFoundException('Offer not found');
      }

      return this.mapOfferToResponse(offer);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch offer');
    }
  }

  async updateOffer(id: string, updateOfferDto: UpdateOfferDto): Promise<OfferResponseDto> {
    try {
      const existingOffer = await this.prisma.offer.findUnique({
        where: { id },
      });

      if (!existingOffer) {
        throw new NotFoundException('Offer not found');
      }

      const offer = await this.prisma.offer.update({
        where: { id },
        data: updateOfferDto,
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

      return this.mapOfferToResponse(offer);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update offer');
    }
  }

  async approveOffer(id: string, approveOfferDto?: ApproveOfferDto): Promise<OfferResponseDto> {
    try {
      const existingOffer = await this.prisma.offer.findUnique({
        where: { id },
      });

      if (!existingOffer) {
        throw new NotFoundException('Offer not found');
      }

      if (existingOffer.status === OfferStatus.APPROVED) {
        throw new BadRequestException('Offer is already approved');
      }

      const offer = await this.prisma.offer.update({
        where: { id },
        data: {
          status: OfferStatus.APPROVED,
          adminResponse: approveOfferDto?.adminResponse,
        },
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

      return this.mapOfferToResponse(offer);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to approve offer');
    }
  }

  async rejectOffer(id: string, rejectOfferDto?: RejectOfferDto): Promise<OfferResponseDto> {
    try {
      const existingOffer = await this.prisma.offer.findUnique({
        where: { id },
      });

      if (!existingOffer) {
        throw new NotFoundException('Offer not found');
      }

      if (existingOffer.status === OfferStatus.REJECTED) {
        throw new BadRequestException('Offer is already rejected');
      }

      const offer = await this.prisma.offer.update({
        where: { id },
        data: {
          status: OfferStatus.REJECTED,
          adminResponse: rejectOfferDto?.adminResponse,
        },
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

      return this.mapOfferToResponse(offer);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to reject offer');
    }
  }

  async deleteOffer(id: string): Promise<void> {
    try {
      const existingOffer = await this.prisma.offer.findUnique({
        where: { id },
      });

      if (!existingOffer) {
        throw new NotFoundException('Offer not found');
      }

      await this.prisma.offer.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete offer');
    }
  }

  async getOfferStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    last30Days: number;
  }> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [total, pending, approved, rejected, last30Days] = await Promise.all([
        this.prisma.offer.count(),
        this.prisma.offer.count({ where: { status: OfferStatus.PENDING } }),
        this.prisma.offer.count({ where: { status: OfferStatus.APPROVED } }),
        this.prisma.offer.count({ where: { status: OfferStatus.REJECTED } }),
        this.prisma.offer.count({
          where: {
            createdAt: {
              gte: thirtyDaysAgo,
            },
          },
        }),
      ]);

      return {
        total,
        pending,
        approved,
        rejected,
        last30Days,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch offer statistics');
    }
  }

  private mapOfferToResponse(offer: any): OfferResponseDto {
    return {
      id: offer.id,
      title: offer.title,
      description: offer.description,
      status: offer.status,
      adminResponse: offer.adminResponse,
      userId: offer.userId,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
      user: offer.user
        ? {
            id: offer.user.id,
            telegramUsername: offer.user.telegramUsername,
            telegramId: offer.user.telegramId,
          }
        : undefined,
    };
  }
}
