import { IsString, IsOptional, IsBoolean, IsInt, IsArray, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWelcomePhotoDto {
  @ApiProperty({
    description: 'Название фотографии',
    example: 'Основная фотография приветствия',
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'Описание фотографии',
    example: 'Фотография отправляется в приветственном сообщении',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Активна ли фотография',
    example: true,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @ApiProperty({
    description: 'Порядок отображения фотографии',
    example: 1,
    minimum: 0,
    maximum: 100,
  })
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  order?: number = 0;
}

export class UpdateWelcomePhotoDto {
  @ApiPropertyOptional({
    description: 'Название фотографии',
    example: 'Основная фотография приветствия',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'Описание фотографии',
    example: 'Фотография отправляется в приветственном сообщении',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Активна ли фотография',
    example: true,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Порядок отображения фотографии',
    example: 1,
    minimum: 0,
    maximum: 100,
  })
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  order?: number;
}

export class GetWelcomePhotosQueryDto {
  @ApiPropertyOptional({
    description: 'Номер страницы',
    example: 1,
    minimum: 1,
  })
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Количество элементов на странице',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Поиск по названию или описанию',
    example: 'приветствие',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Фильтр по активности',
    example: true,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class BulkUpdateWelcomePhotosDto {
  @ApiProperty({
    description: 'Массив обновлений фотографий',
    type: [Object],
    example: [
      { id: 'photo1', order: 1, isActive: true },
      { id: 'photo2', order: 2, isActive: false },
    ],
  })
  @IsArray()
  photos: Array<{
    id: string;
    order?: number;
    isActive?: boolean;
  }>;
}

export class WelcomePhotoResponseDto {
  @ApiProperty({
    description: 'ID фотографии',
    example: 'ckx7z1q2z0000qw8x1z2z3z4z',
  })
  id: string;

  @ApiProperty({
    description: 'Название фотографии',
    example: 'Основная фотография приветствия',
  })
  title: string;

  @ApiPropertyOptional({
    description: 'Описание фотографии',
    example: 'Фотография отправляется в приветственном сообщении',
  })
  description?: string;

  @ApiProperty({
    description: 'Имя файла',
    example: 'welcome-photo-1.jpg',
  })
  fileName: string;

  @ApiProperty({
    description: 'Путь к файлу',
    example: '/uploads/welcome-photos/welcome-photo-1.jpg',
  })
  filePath: string;

  @ApiProperty({
    description: 'Размер файла в байтах',
    example: 1024000,
  })
  fileSize: number;

  @ApiProperty({
    description: 'MIME тип файла',
    example: 'image/jpeg',
  })
  mimeType: string;

  @ApiProperty({
    description: 'Активна ли фотография',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Порядок отображения',
    example: 1,
  })
  order: number;

  @ApiProperty({
    description: 'Дата создания',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Дата обновления',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt: Date;
}

export class PaginatedWelcomePhotosResponseDto {
  @ApiProperty({
    description: 'Список фотографий',
    type: [WelcomePhotoResponseDto],
  })
  photos: WelcomePhotoResponseDto[];

  @ApiProperty({
    description: 'Общее количество фотографий',
    example: 25,
  })
  total: number;

  @ApiProperty({
    description: 'Текущая страница',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Количество элементов на странице',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Общее количество страниц',
    example: 3,
  })
  totalPages: number;
}

export class WelcomePhotoUploadResponseDto {
  @ApiProperty({
    description: 'Статус успешности загрузки',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Сообщение о результате',
    example: 'Фотография успешно загружена',
  })
  message: string;

  @ApiProperty({
    description: 'Данные загруженной фотографии',
    type: WelcomePhotoResponseDto,
  })
  photo: WelcomePhotoResponseDto;
}
