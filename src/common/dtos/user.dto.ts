import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Language, Role, UserFunnelAction, FunnelState, UserPipelineState } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ description: 'Telegram user ID', example: '123456789' })
  @IsString()
  telegramId: string;

  @ApiPropertyOptional({ description: 'Telegram username', example: 'john_doe' })
  @IsOptional()
  @IsString()
  telegramUsername?: string;

  @ApiPropertyOptional({ description: 'Telegram chat ID', example: '123456789' })
  @IsOptional()
  @IsString()
  telegramChatId?: string;

  @ApiPropertyOptional({ description: 'User email', example: 'user@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Analysis credits', example: 5, default: 1 })
  @IsOptional()
  @IsNumber()
  analysisCredits?: number;

  @ApiPropertyOptional({ description: 'User language', enum: Language, default: Language.RU })
  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @ApiPropertyOptional({ description: 'Referral code', example: 'REF123456' })
  @IsOptional()
  @IsString()
  referralCode?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'Telegram username', example: 'john_doe' })
  @IsOptional()
  @IsString()
  telegramUsername?: string;

  @ApiPropertyOptional({ description: 'Telegram chat ID', example: '123456789' })
  @IsOptional()
  @IsString()
  telegramChatId?: string;

  @ApiPropertyOptional({ description: 'User email', example: 'user@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Analysis credits', example: 5 })
  @IsOptional()
  @IsNumber()
  analysisCredits?: number;

  @ApiPropertyOptional({ description: 'User language', enum: Language })
  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @ApiPropertyOptional({ description: 'User role', enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ description: 'Is user banned', example: false })
  @IsOptional()
  @IsBoolean()
  isBanned?: boolean;

  @ApiPropertyOptional({ description: 'Ban reason', example: 'Violation of terms' })
  @IsOptional()
  @IsString()
  banReason?: string;

  @ApiPropertyOptional({ description: 'Is user subscribed to channels', example: true })
  @IsOptional()
  @IsBoolean()
  isSubscribed?: boolean;

  @ApiPropertyOptional({ description: 'Has user received free generations for subscription', example: false })
  @IsOptional()
  @IsBoolean()
  freeGenerationsGranted?: boolean;

  @ApiPropertyOptional({ description: 'Funnel action', enum: UserFunnelAction })
  @IsOptional()
  @IsEnum(UserFunnelAction)
  funnelAction?: UserFunnelAction;

  @ApiPropertyOptional({})
  @IsOptional()
  @IsBoolean()
  waitingForSuggestion?: boolean;

  @ApiPropertyOptional({})
  @IsOptional()
  @IsBoolean()
  isBotBlocked?: boolean;

  @ApiPropertyOptional({})
  @IsOptional()
  @IsBoolean()
  botBlockedAt?: Date | null;

  @ApiPropertyOptional({ description: 'Funnel state', enum: FunnelState })
  @IsOptional()
  @IsEnum(FunnelState)
  funnelState?: FunnelState;

  @ApiPropertyOptional({ description: 'Pipeline state для единого пайплайна онбординга', enum: UserPipelineState })
  @IsOptional()
  @IsEnum(UserPipelineState)
  pipelineState?: UserPipelineState;

  @ApiPropertyOptional({ description: 'Количество неудачных попыток отправки фотографий', example: 0 })
  @IsOptional()
  @IsNumber()
  photoFailureAttempts?: number;
}

export class GetUsersQueryDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 50, default: 50 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Search term', example: 'john_doe' })
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

  @ApiPropertyOptional({ description: 'Filter by funnel action', enum: UserFunnelAction })
  @IsOptional()
  @IsEnum(UserFunnelAction)
  funnelAction?: UserFunnelAction;

  @ApiPropertyOptional({ description: 'Filter by funnel state', enum: FunnelState })
  @IsOptional()
  @IsEnum(FunnelState)
  funnelState?: FunnelState;
}
