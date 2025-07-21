import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateWelcomePhotoDto,
  UpdateWelcomePhotoDto,
  GetWelcomePhotosQueryDto,
  BulkUpdateWelcomePhotosDto,
  WelcomePhotoResponseDto,
  PaginatedWelcomePhotosResponseDto,
} from '../../../common/dtos/welcome-photo.dto';
import * as fs from 'fs';
import * as path from 'path';

// Интерфейс для загружаемого файла
interface UploadedFile {
  originalname: string;
  buffer: Buffer;
  size: number;
  mimetype: string;
}

@Injectable()
export class WelcomePhotoService {
  private readonly logger = new Logger(WelcomePhotoService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Получить все фотографии приветствия с пагинацией и фильтрацией
   */
  async getWelcomePhotos(query: GetWelcomePhotosQueryDto): Promise<PaginatedWelcomePhotosResponseDto> {
    try {
      const { page = 1, limit = 10, search, isActive } = query;
      const skip = (page - 1) * limit;

      // Строим условия для поиска
      const where: any = {};

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { fileName: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      // Получаем общее количество записей
      const total = await this.prisma.welcomePhoto.count({ where });

      // Получаем фотографии с пагинацией
      const photos = await this.prisma.welcomePhoto.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      });

      const totalPages = Math.ceil(total / limit);

      return {
        photos: photos.map(this.mapToResponseDto),
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error(`Ошибка получения фотографий приветствия: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Не удалось получить фотографии приветствия');
    }
  }

  /**
   * Получить фотографию приветствия по ID
   */
  async getWelcomePhotoById(id: string): Promise<WelcomePhotoResponseDto> {
    try {
      const photo = await this.prisma.welcomePhoto.findUnique({
        where: { id },
      });

      if (!photo) {
        throw new NotFoundException(`Фотография приветствия с ID ${id} не найдена`);
      }

      return this.mapToResponseDto(photo);
    } catch (error) {
      this.logger.error(`Ошибка получения фотографии приветствия ${id}: ${error.message}`, error.stack);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Не удалось получить фотографию приветствия');
    }
  }

  /**
   * Создать новую фотографию приветствия
   */
  async createWelcomePhoto(createDto: CreateWelcomePhotoDto, file: UploadedFile): Promise<WelcomePhotoResponseDto> {
    try {
      // Проверяем тип файла
      if (!file.mimetype.startsWith('image/')) {
        throw new BadRequestException('Файл должен быть изображением');
      }

      // Проверяем размер файла (максимум 10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new BadRequestException('Размер файла не должен превышать 10MB');
      }

      // Создаем директорию для загрузки если она не существует
      const uploadDir = path.join(process.cwd(), 'uploads', 'welcome-photos');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Генерируем уникальное имя файла
      const fileExtension = path.extname(file.originalname);
      const fileName = `welcome-photo-${Date.now()}-${Math.random().toString(36).substring(2, 15)}${fileExtension}`;
      const filePath = path.join('uploads', 'welcome-photos', fileName);
      const fullPath = path.join(process.cwd(), filePath);

      // Сохраняем файл
      fs.writeFileSync(fullPath, file.buffer);

      // Создаем запись в БД
      const photo = await this.prisma.welcomePhoto.create({
        data: {
          title: createDto.title,
          description: createDto.description,
          fileName: file.originalname,
          filePath: filePath.replace(/\\/g, '/'), // Нормализуем путь для Windows
          fileSize: file.size,
          mimeType: file.mimetype,
          isActive: createDto.isActive ?? true,
          order: createDto.order ?? 0,
        },
      });

      this.logger.log(`Создана новая фотография приветствия: ${photo.id}`);

      return this.mapToResponseDto(photo);
    } catch (error) {
      this.logger.error(`Ошибка создания фотографии приветствия: ${error.message}`, error.stack);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Не удалось создать фотографию приветствия');
    }
  }

  /**
   * Обновить фотографию приветствия
   */
  async updateWelcomePhoto(id: string, updateDto: UpdateWelcomePhotoDto): Promise<WelcomePhotoResponseDto> {
    try {
      // Проверяем существование фотографии
      const existingPhoto = await this.prisma.welcomePhoto.findUnique({
        where: { id },
      });

      if (!existingPhoto) {
        throw new NotFoundException(`Фотография приветствия с ID ${id} не найдена`);
      }

      // Обновляем данные
      const updatedPhoto = await this.prisma.welcomePhoto.update({
        where: { id },
        data: {
          title: updateDto.title,
          description: updateDto.description,
          isActive: updateDto.isActive,
          order: updateDto.order,
        },
      });

      this.logger.log(`Обновлена фотография приветствия: ${id}`);

      return this.mapToResponseDto(updatedPhoto);
    } catch (error) {
      this.logger.error(`Ошибка обновления фотографии приветствия ${id}: ${error.message}`, error.stack);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Не удалось обновить фотографию приветствия');
    }
  }

  /**
   * Удалить фотографию приветствия
   */
  async deleteWelcomePhoto(id: string): Promise<{ message: string }> {
    try {
      // Проверяем существование фотографии
      const existingPhoto = await this.prisma.welcomePhoto.findUnique({
        where: { id },
      });

      if (!existingPhoto) {
        throw new NotFoundException(`Фотография приветствия с ID ${id} не найдена`);
      }

      // Удаляем файл с диска
      const fullPath = path.join(process.cwd(), existingPhoto.filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        this.logger.log(`Удален файл фотографии: ${existingPhoto.filePath}`);
      }

      // Удаляем запись из БД
      await this.prisma.welcomePhoto.delete({
        where: { id },
      });

      this.logger.log(`Удалена фотография приветствия: ${id}`);

      return {
        message: 'Фотография приветствия успешно удалена',
      };
    } catch (error) {
      this.logger.error(`Ошибка удаления фотографии приветствия ${id}: ${error.message}`, error.stack);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Не удалось удалить фотографию приветствия');
    }
  }

  /**
   * Массовое обновление фотографий (порядок и активность)
   */
  async bulkUpdateWelcomePhotos(
    bulkUpdateDto: BulkUpdateWelcomePhotosDto,
  ): Promise<{ message: string; updated: number }> {
    try {
      let updated = 0;

      for (const photoUpdate of bulkUpdateDto.photos) {
        const updateData: any = {};

        if (photoUpdate.order !== undefined) {
          updateData.order = photoUpdate.order;
        }

        if (photoUpdate.isActive !== undefined) {
          updateData.isActive = photoUpdate.isActive;
        }

        if (Object.keys(updateData).length > 0) {
          await this.prisma.welcomePhoto.update({
            where: { id: photoUpdate.id },
            data: updateData,
          });
          updated++;
        }
      }

      this.logger.log(`Массовое обновление фотографий приветствия: обновлено ${updated} фотографий`);

      return {
        message: `Успешно обновлено ${updated} фотографий`,
        updated,
      };
    } catch (error) {
      this.logger.error(`Ошибка массового обновления фотографий приветствия: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Не удалось выполнить массовое обновление фотографий');
    }
  }

  /**
   * Получить активные фотографии приветствия для отправки пользователям
   */
  async getActiveWelcomePhotos(): Promise<WelcomePhotoResponseDto[]> {
    try {
      const photos = await this.prisma.welcomePhoto.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
      });

      return photos.map(this.mapToResponseDto);
    } catch (error) {
      this.logger.error(`Ошибка получения активных фотографий приветствия: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Не удалось получить активные фотографии приветствия');
    }
  }

  /**
   * Получить статистику фотографий приветствия
   */
  async getWelcomePhotosStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    totalSizeBytes: number;
  }> {
    try {
      const [total, active, sizeResult] = await Promise.all([
        this.prisma.welcomePhoto.count(),
        this.prisma.welcomePhoto.count({ where: { isActive: true } }),
        this.prisma.welcomePhoto.aggregate({
          _sum: { fileSize: true },
        }),
      ]);

      return {
        total,
        active,
        inactive: total - active,
        totalSizeBytes: sizeResult._sum.fileSize || 0,
      };
    } catch (error) {
      this.logger.error(`Ошибка получения статистики фотографий приветствия: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Не удалось получить статистику фотографий приветствия');
    }
  }

  /**
   * Маппинг модели в DTO
   */
  private mapToResponseDto(photo: any): WelcomePhotoResponseDto {
    return {
      id: photo.id,
      title: photo.title,
      description: photo.description,
      fileName: photo.fileName,
      filePath: photo.filePath,
      fileSize: photo.fileSize,
      mimeType: photo.mimeType,
      isActive: photo.isActive,
      order: photo.order,
      createdAt: photo.createdAt,
      updatedAt: photo.updatedAt,
    };
  }
}
