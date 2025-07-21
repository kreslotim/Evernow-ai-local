import { IsString, IsOptional, IsArray, IsEnum, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnalyzeType, ProcessingStatus } from '@prisma/client';

export class CreateAnalyzeDto {
  @ApiProperty({ description: 'ID пользователя', example: 'cuid123456' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Тип анализа (всегда DEFAULT)', enum: AnalyzeType, default: 'DEFAULT' })
  @IsEnum(AnalyzeType)
  type: AnalyzeType = 'DEFAULT' as AnalyzeType;

  @ApiProperty({ description: 'URL загруженных фотографий', example: ['https://example.com/photo1.jpg'] })
  @IsArray()
  @IsString({ each: true })
  inputPhotoUrl: string[];

  @ApiPropertyOptional({ description: 'Стоимость в кредитах', example: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  cost?: number;

  @ApiPropertyOptional({ description: 'ID чата Telegram', example: '123456789' })
  @IsOptional()
  @IsString()
  chatId?: string;

  @ApiPropertyOptional({ description: 'ID сообщения Telegram', example: 12345 })
  @IsOptional()
  @IsNumber()
  messageId?: number;
}

export class UpdateAnalyzeDto {
  @ApiPropertyOptional({ description: 'Статус обработки', enum: ProcessingStatus })
  @IsOptional()
  @IsEnum(ProcessingStatus)
  status?: ProcessingStatus;

  @ApiPropertyOptional({ description: 'Текст результата анализа' })
  @IsOptional()
  @IsString()
  analysisResultText?: string;

  @ApiPropertyOptional({ description: 'Краткое резюме анализа' })
  @IsOptional()
  @IsString()
  summaryText?: string;

  @ApiPropertyOptional({ description: 'URL изображения открытки', example: 'https://example.com/postcard.jpg' })
  @IsOptional()
  @IsString()
  postcardImageUrl?: string;

  @ApiPropertyOptional({ description: 'Сообщение об ошибке при неудаче' })
  @IsOptional()
  @IsString()
  errorMessage?: string;
}

export class GetAnalyzesQueryDto {
  @ApiPropertyOptional({ description: 'Номер страницы', example: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Количество элементов на странице', example: 20, default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Поисковый запрос' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Поле для сортировки', example: 'createdAt', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Направление сортировки', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Фильтр по статусу', enum: ProcessingStatus })
  @IsOptional()
  @IsEnum(ProcessingStatus)
  status?: ProcessingStatus;

  @ApiPropertyOptional({ description: 'Фильтр по типу анализа (всегда DEFAULT)', enum: AnalyzeType })
  @IsOptional()
  @IsEnum(AnalyzeType)
  type?: AnalyzeType;

  @ApiPropertyOptional({ description: 'Фильтр по ID пользователя', example: 'cuid123456' })
  @IsOptional()
  @IsString()
  userId?: string;
}
