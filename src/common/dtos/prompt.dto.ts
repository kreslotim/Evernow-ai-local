import { IsString, IsOptional, MinLength, MaxLength, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO для запроса списка промптов с фильтрацией и пагинацией
 */
export class GetPromptsQueryDto {
  /**
   * Фильтр по провайдеру (openai, deepseek)
   */
  @IsOptional()
  @IsString()
  provider?: string;

  /**
   * Поиск по содержимому и описанию промптов
   */
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Номер страницы для пагинации
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  /**
   * Количество элементов на странице
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

/**
 * DTO для обновления промпта
 */
export class UpdatePromptDto {
  /**
   * Содержимое промпта
   */
  @IsString()
  @MinLength(10, { message: 'Содержимое промпта должно содержать минимум 10 символов' })
  @MaxLength(50000, { message: 'Содержимое промпта не должно превышать 50000 символов' })
  content: string;

  /**
   * Описание промпта (опционально)
   */
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Описание не должно превышать 500 символов' })
  description?: string;
}

/**
 * DTO для ответа с данными промпта
 */
export class PromptResponseDto {
  /**
   * Уникальный ключ промпта
   */
  key: string;

  /**
   * Содержимое промпта
   */
  content: string;

  /**
   * Описание назначения промпта
   */
  description?: string;

  /**
   * Провайдер LLM (openai, deepseek)
   */
  provider: string;

  /**
   * Источник промпта (database - из БД, default - из констант)
   */
  source: 'database' | 'default';

  /**
   * Активен ли промпт
   */
  isActive: boolean;

  /**
   * Помечен ли промпт как устаревший
   */
  deprecated?: boolean;

  /**
   * Дата последнего обновления
   */
  updatedAt?: Date;
}

/**
 * DTO для ответа со списком промптов и пагинацией
 */
export class PaginatedPromptsResponseDto {
  /**
   * Список промптов
   */
  prompts: PromptResponseDto[];

  /**
   * Общее количество промптов
   */
  total: number;

  /**
   * Текущая страница
   */
  page: number;

  /**
   * Количество элементов на странице
   */
  limit: number;

  /**
   * Общее количество страниц
   */
  totalPages: number;
}
