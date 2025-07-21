import { IsString, IsOptional, IsNumber, IsDateString, IsEnum, IsArray, ValidateNested, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class BanUserDto {
  @ApiPropertyOptional({ description: 'Reason for banning the user', example: 'Violation of terms' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AddCreditsDto {
  @ApiProperty({ description: 'Amount of credits to add', example: 5, minimum: 1 })
  @IsNumber()
  amount: number;
}

/**
 * DTO для запроса дневной статистики воронки
 */
export class GetDailyFunnelStatsDto {
  @ApiPropertyOptional({
    description: 'Дата начала периода (ISO 8601)',
    example: '2024-01-01',
    type: String,
  })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => (value ? new Date(value).toISOString().split('T')[0] : undefined))
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Дата окончания периода (ISO 8601)',
    example: '2024-01-31',
    type: String,
  })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => (value ? new Date(value).toISOString().split('T')[0] : undefined))
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Номер страницы',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Количество записей на странице',
    example: 30,
    minimum: 1,
    maximum: 100,
    default: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 30;
}

/**
 * DTO для элемента дневной статистики воронки
 */
export class DailyFunnelStatsItemDto {
  @ApiProperty({ description: 'Дата в формате YYYY-MM-DD', example: '2024-01-15' })
  date: string;

  @ApiProperty({ description: 'Количество пользователей в состоянии BOT_JOINED', example: 25 })
  BOT_JOINED: number;

  @ApiProperty({ description: 'Количество пользователей в состоянии FIRST_PHOTO_ANALYSIS', example: 18 })
  FIRST_PHOTO_ANALYSIS: number;

  @ApiProperty({ description: 'Количество пользователей в состоянии FEELINGS_SHARED', example: 15 })
  FEELINGS_SHARED: number;

  @ApiProperty({ description: 'Количество пользователей в состоянии PSY_TEST_PASSED', example: 12 })
  PSY_TEST_PASSED: number;

  @ApiProperty({ description: 'Количество пользователей в состоянии HYPOTHESIS_RECEIVED', example: 10 })
  HYPOTHESIS_RECEIVED: number;

  @ApiProperty({ description: 'Количество пользователей в состоянии INVITED_FRIENDS_7', example: 8 })
  INVITED_FRIENDS_7: number;

  @ApiProperty({ description: 'Количество пользователей в состоянии VIDEO_SHARED', example: 6 })
  VIDEO_SHARED: number;

  @ApiProperty({ description: 'Количество пользователей в состоянии PAYMENT_MADE', example: 4 })
  PAYMENT_MADE: number;

  @ApiProperty({ description: 'Количество пользователей в состоянии FUNNEL_COMPLETED', example: 3 })
  FUNNEL_COMPLETED: number;

  @ApiProperty({ description: 'Общее количество пользователей за день', example: 101 })
  total: number;
}

/**
 * DTO для пагинации
 */
export class PaginationDto {
  @ApiProperty({ description: 'Текущая страница', example: 1 })
  page: number;

  @ApiProperty({ description: 'Количество записей на странице', example: 30 })
  limit: number;

  @ApiProperty({ description: 'Общее количество записей', example: 150 })
  total: number;

  @ApiProperty({ description: 'Общее количество страниц', example: 5 })
  totalPages: number;
}

/**
 * DTO для ответа с дневной статистикой воронки
 */
export class DailyFunnelStatsResponseDto {
  @ApiProperty({
    description: 'Массив данных дневной статистики',
    type: [DailyFunnelStatsItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyFunnelStatsItemDto)
  data: DailyFunnelStatsItemDto[];

  @ApiProperty({
    description: 'Информация о пагинации',
    type: PaginationDto,
  })
  @ValidateNested()
  @Type(() => PaginationDto)
  pagination: PaginationDto;
}

/**
 * DTO для события воронки
 */
export class FunnelEventDto {
  @ApiProperty({ description: 'ID события', example: 'evt_123456789' })
  id: string;

  @ApiProperty({ description: 'ID пользователя', example: 'usr_123456789' })
  userId: string;

  @ApiProperty({
    description: 'Тип события',
    enum: ['FUNNEL_ACTION_CHANGE', 'FUNNEL_STATE_CHANGE', 'PIPELINE_STATE_CHANGE'],
    example: 'FUNNEL_STATE_CHANGE',
  })
  @IsEnum(['FUNNEL_ACTION_CHANGE', 'FUNNEL_STATE_CHANGE', 'PIPELINE_STATE_CHANGE'])
  eventType: 'FUNNEL_ACTION_CHANGE' | 'FUNNEL_STATE_CHANGE' | 'PIPELINE_STATE_CHANGE';

  @ApiPropertyOptional({ description: 'Предыдущее значение', example: 'BOT_JOINED' })
  @IsOptional()
  @IsString()
  previousValue?: string;

  @ApiProperty({ description: 'Новое значение', example: 'WAITING_FIRST_PHOTO' })
  @IsString()
  newValue: string;

  @ApiProperty({ description: 'Дата создания события', example: '2024-01-15T10:30:00.000Z' })
  createdAt: Date;
}
