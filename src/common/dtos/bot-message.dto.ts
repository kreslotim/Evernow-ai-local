import { IsString, IsOptional, IsInt, Min, Max, IsIn, Length } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO для запроса списка сообщений бота с фильтрацией и пагинацией
 */
export class GetBotMessagesQueryDto {
  @ApiPropertyOptional({
    description: 'Фильтр по языку сообщений',
    enum: ['ru', 'en'],
    example: 'ru',
  })
  @IsOptional()
  @IsIn(['ru', 'en'])
  locale?: string;

  @ApiPropertyOptional({
    description: 'Поиск по ключу или содержимому сообщения',
    example: 'greeting',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Номер страницы для пагинации',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Количество элементов на странице',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * DTO ответа с информацией о сообщении бота
 */
export class BotMessageResponseDto {
  @ApiProperty({
    description: 'Ключ сообщения',
    example: 'greeting.welcome',
  })
  key: string;

  @ApiProperty({
    description: 'Язык сообщения',
    enum: ['ru', 'en'],
    example: 'ru',
  })
  locale: string;

  @ApiProperty({
    description: 'Содержимое сообщения (поддерживает HTML)',
    example: 'Добро пожаловать в бот! 🎉',
  })
  content: string;

  @ApiPropertyOptional({
    description: 'Описание сообщения для админов',
    example: 'Приветственное сообщение при первом запуске бота',
  })
  description?: string;

  @ApiProperty({
    description: 'Источник сообщения',
    enum: ['database', 'default'],
    example: 'database',
  })
  source: 'database' | 'default';

  @ApiProperty({
    description: 'Активно ли сообщение',
    example: true,
  })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Дата последнего обновления',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt?: Date;
}

/**
 * DTO для обновления сообщения бота
 */
export class UpdateBotMessageDto {
  @ApiProperty({
    description: 'Новое содержимое сообщения (поддерживает HTML)',
    example: 'Обновленное приветственное сообщение! 🚀',
  })
  @IsString()
  @Length(1, 50000)
  content: string;

  @ApiPropertyOptional({
    description: 'Описание изменений или назначения сообщения',
    example: 'Обновлено для улучшения UX',
  })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  description?: string;
}

/**
 * DTO для создания нового сообщения бота
 */
export class CreateBotMessageDto {
  @ApiProperty({
    description: 'Ключ сообщения (уникальный в рамках языка)',
    example: 'greeting.new_feature',
  })
  @IsString()
  @Length(1, 255)
  key: string;

  @ApiProperty({
    description: 'Язык сообщения',
    enum: ['ru', 'en'],
    example: 'ru',
  })
  @IsIn(['ru', 'en'])
  locale: string;

  @ApiProperty({
    description: 'Содержимое сообщения (поддерживает HTML)',
    example: 'Новая функция доступна! 🎯',
  })
  @IsString()
  @Length(1, 50000)
  content: string;

  @ApiPropertyOptional({
    description: 'Описание назначения сообщения',
    example: 'Уведомление о новых возможностях бота',
  })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  description?: string;
}

/**
 * DTO для пагинированного ответа со списком сообщений
 */
export class PaginatedBotMessagesResponseDto {
  @ApiProperty({
    description: 'Массив сообщений бота',
    type: [BotMessageResponseDto],
  })
  messages: BotMessageResponseDto[];

  @ApiProperty({
    description: 'Общее количество сообщений',
    example: 45,
  })
  total: number;

  @ApiProperty({
    description: 'Текущая страница',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Количество элементов на странице',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Общее количество страниц',
    example: 3,
  })
  totalPages: number;
}

/**
 * DTO для импорта сообщений из локалей
 */
export class ImportDefaultMessagesDto {
  @ApiPropertyOptional({
    description: 'Перезаписать существующие кастомные сообщения',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  overwrite?: boolean = false;

  @ApiPropertyOptional({
    description: 'Импортировать только для указанного языка',
    enum: ['ru', 'en'],
  })
  @IsOptional()
  @IsIn(['ru', 'en'])
  locale?: string;
}
