import { IsString, IsOptional, IsNumber, IsEnum, IsDateString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OfferStatus } from '@prisma/client';

export class CreateOfferDto {
  @ApiProperty({ description: 'Offer title', example: 'Add dark mode to the bot' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Offer description', example: 'Please add dark mode to improve user experience' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'User ID who submitted the offer', example: 'cuid123456' })
  @IsString()
  userId: string;
}

export class UpdateOfferDto {
  @ApiPropertyOptional({ description: 'Offer status', enum: OfferStatus })
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;

  @ApiPropertyOptional({
    description: 'Admin response to the offer',
    example: 'Thank you for the suggestion. We will consider it.',
  })
  @IsOptional()
  @IsString()
  adminResponse?: string;
}

export class GetOffersQueryDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 20, default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Search term in offer text', example: 'dark mode' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Sort field', example: 'createdAt', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Filter by offer status', enum: OfferStatus })
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;

  @ApiPropertyOptional({ description: 'Filter by user ID', example: 'cuid123456' })
  @IsOptional()
  @IsString()
  userId?: string;
}

export class OfferResponseDto {
  @ApiProperty({ description: 'Offer ID', example: 'cuid123456' })
  id: string;

  @ApiProperty({ description: 'Offer title', example: 'Add dark mode to the bot' })
  title: string;

  @ApiProperty({ description: 'Offer description', example: 'Please add dark mode to improve user experience' })
  description: string;

  @ApiProperty({ description: 'Offer status', enum: OfferStatus })
  status: OfferStatus;

  @ApiPropertyOptional({
    description: 'Admin response to the offer',
    example: 'Thank you for the suggestion. We will consider it.',
  })
  adminResponse?: string;

  @ApiProperty({ description: 'User ID who submitted the offer', example: 'cuid123456' })
  userId: string;

  @ApiProperty({ description: 'Creation timestamp', example: '2024-01-15T10:30:00Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp', example: '2024-01-15T10:30:00Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'User information' })
  user?: {
    id: string;
    telegramUsername?: string;
    telegramId: string;
  };
}

export class PaginatedOffersResponseDto {
  @ApiProperty({ type: [OfferResponseDto], description: 'Array of offers' })
  offers: OfferResponseDto[];

  @ApiProperty({ description: 'Total number of offers', example: 150 })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total number of pages', example: 8 })
  totalPages: number;
}

export class ApproveOfferDto {
  @ApiPropertyOptional({
    description: 'Admin response message',
    example: 'Great idea! We will implement this feature.',
  })
  @IsOptional()
  @IsString()
  adminResponse?: string;
}

export class RejectOfferDto {
  @ApiPropertyOptional({
    description: 'Admin response message',
    example: 'Thank you for the suggestion, but this is not feasible at the moment.',
  })
  @IsOptional()
  @IsString()
  adminResponse?: string;
}
