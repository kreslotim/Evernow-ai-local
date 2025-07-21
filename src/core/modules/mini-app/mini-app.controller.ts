import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Res,
  HttpException,
  HttpStatus,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { MiniAppService } from './mini-app.service';
import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { IsObject, IsString } from 'class-validator';

/**
 * DTO для теста Люшера
 */
export class LuscherTestResultDto {
  @IsObject()
  results: Record<string, any>;
}

/**
 * DTO для данных из мини-приложения
 */
export class MiniAppDataDto {
  userId: string;
  action: 'opened' | 'closed' | 'button_clicked' | 'share_clicked' | 'return_to_bot';
  data?: any; // Дополнительные данные действия
  timestamp: number;
}

/**
 * DTO для инициализации мини-приложения
 */
export class InitMiniAppDto {
  initData: string; // Telegram init data string
}

/**
 * DTO для отправки гипотезы
 */
export class ShareHypothesisDto {
  userId: string;
  hypothesis: string;
  initData: string; // Telegram init data для проверки подписи
}

/**
 * DTO для сохранения результата Люшера (альтернативный формат из фронтенда)
 */
export class SaveLuscherResultDto {
  @IsString()
  userId: string;

  // В фронтенде поле называется result, а не results
  @IsObject()
  result: Record<string, any>;
}

/**
 * Контроллер мини-приложения для отображения персональной гипотезы
 * Обрабатывает запросы от Telegram Mini App и обслуживает статические файлы
 */
@Controller('mini-app')
@ApiTags('Mini App')
export class MiniAppController {
  constructor(private readonly miniAppService: MiniAppService) { }

  /**
   * ✅ ОПТИМИЗИРОВАННАЯ версия: Главная страница мини-приложения с кешированием
   * Доступна по адресу /app
   */
  @Get('app')
  @ApiOperation({ summary: 'Главная страница мини-приложения с гипотезой' })
  async getMainPage(@Res() res: Response) {
    try {
      const html = await this.miniAppService.getStaticFile('index.html');

      // ✅ Оптимизированные заголовки для production
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');

      // ✅ Улучшенное кеширование в зависимости от среды
      if (process.env.NODE_ENV === 'production') {
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        res.setHeader('ETag', `"${Date.now()}"`);
      } else {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }

      res.send(html);
    } catch (error) {
      res.status(404).send('Страница не найдена');
    }
  }

  // CSS и JS файлы теперь обслуживаются через Express static middleware в main.ts
  // Эндпоинты удалены для избежания конфликтов

  /**
   * Инициализация мини-приложения
   * Проверяет подпись Telegram и возвращает данные пользователя с гипотезой
   */
  @Post('init')
  @ApiOperation({ summary: 'Инициализация мини-приложения' })
  @ApiBody({ type: InitMiniAppDto })
  @ApiResponse({ status: 200, description: 'Успешная инициализация с данными гипотезы' })
  @ApiResponse({ status: 401, description: 'Неверная подпись Telegram' })
  async initMiniApp(@Body() dto: InitMiniAppDto) {
    try {
      // Проверяем подпись Telegram
      const isValid = this.miniAppService.validateTelegramData(dto.initData);
      if (!isValid) {
        throw new HttpException('Неверная подпись Telegram', HttpStatus.UNAUTHORIZED);
      }

      // Парсим данные
      const userData = this.miniAppService.parseTelegramInitData(dto.initData);

      // Получаем или создаём пользователя
      const user = await this.miniAppService.getOrCreateUser(userData);

      // Получаем данные для мини-приложения
      const miniAppData = await this.miniAppService.getUserInfoForMiniApp(user.id);

      const response = {
        success: true,
        user: {
          id: user.id,
          telegramId: user.telegramId,
          username: user.telegramUsername,
          language: user.language,
          pipelineState: user.pipelineState,
        },
        ...miniAppData, // Добавляем все данные из сервиса
      };

      // Логируем данные для диагностики
      console.log(`📸 Mini-app init response for user ${user.id}:`, response);

      return response;
    } catch (error) {
      throw new HttpException(
        error.message || 'Не удалось инициализировать мини-приложение',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Отслеживание действий в мини-приложении
   */
  @Post('track')
  @ApiOperation({ summary: 'Отслеживание действий пользователя в мини-приложении' })
  @ApiBody({ type: MiniAppDataDto })
  @ApiResponse({ status: 200, description: 'Действие записано' })
  async trackAction(@Body() dto: MiniAppDataDto) {
    try {
      await this.miniAppService.trackUserAction(dto);
      return { success: true };
    } catch (error) {
      throw new HttpException('Не удалось записать действие', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Отправка гипотезы другому пользователю
   * Проверяет подпись Telegram и отправляет гипотезу в чат пользователя
   */
  @Post('share-hypothesis')
  @ApiOperation({ summary: 'Отправка персональной гипотезы в чат пользователя' })
  @ApiBody({ type: ShareHypothesisDto })
  @ApiResponse({ status: 200, description: 'Гипотеза успешно отправлена' })
  @ApiResponse({ status: 401, description: 'Неверная подпись Telegram' })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  async shareHypothesis(@Body() dto: ShareHypothesisDto) {
    try {
      // Проверяем подпись Telegram
      const isValid = this.miniAppService.validateTelegramData(dto.initData);
      if (!isValid) {
        throw new HttpException('Неверная подпись Telegram', HttpStatus.UNAUTHORIZED);
      }

      // Парсим данные пользователя из Telegram
      const telegramUserData = this.miniAppService.parseTelegramInitData(dto.initData);

      // Отправляем гипотезу
      const result = await this.miniAppService.shareHypothesis(telegramUserData.id, dto.hypothesis);

      if (!result.success) {
        throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
      }

      return {
        success: true,
        message: result.message,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Не удалось отправить гипотезу',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Webhook для обработки событий из мини-приложения
   */
  @Post('webhook')
  @ApiOperation({ summary: 'Webhook для событий мини-приложения' })
  async handleWebhook(@Body() data: any, @Req() req: Request) {
    // Логируем событие
    console.log('Webhook мини-приложения:', data);

    // Обрабатываем событие
    await this.miniAppService.handleWebhookEvent(data);

    return { success: true };
  }

  /**
   * Получение социального изображения
   * Возвращает изображение для просмотра или скачивания
   */
  @Get('download-image/:userId')
  @ApiOperation({ summary: 'Получение социального изображения пользователя' })
  @ApiResponse({ status: 200, description: 'Изображение успешно загружено' })
  @ApiResponse({ status: 404, description: 'Изображение не найдено' })
  async downloadSocialImage(@Param('userId') userId: string, @Req() req: Request, @Res() res: Response) {
    try {
      // Логируем запрос в базу данных
      await this.miniAppService.logDiagnostic(
        'INFO',
        'mini-app',
        'image-download-request',
        `Requesting social image for user ${userId}`,
        { userId },
        req.headers['user-agent'] as string,
        req.ip,
      );

      // Получаем данные пользователя, включая URL карточки
      const miniAppData = await this.miniAppService.getUserInfoForMiniApp(userId);

      // Логируем полученные данные
      await this.miniAppService.logDiagnostic(
        'DEBUG',
        'mini-app',
        'image-download-data',
        `Mini app data retrieved for user ${userId}`,
        { userId, miniAppData },
        req.headers['user-agent'] as string,
        req.ip,
      );

      if (!miniAppData.socialCardUrl) {
        await this.miniAppService.logDiagnostic(
          'WARN',
          'mini-app',
          'image-download-no-url',
          `No socialCardUrl found for user ${userId}`,
          { userId, miniAppData },
          req.headers['user-agent'] as string,
          req.ip,
        );
        return res.status(404).json({
          success: false,
          message: 'Социальное изображение не найдено',
        });
      }

      // Логируем найденный URL
      await this.miniAppService.logDiagnostic(
        'DEBUG',
        'mini-app',
        'image-download-url-found',
        `Social card URL found: ${miniAppData.socialCardUrl}`,
        { userId, socialCardUrl: miniAppData.socialCardUrl },
        req.headers['user-agent'] as string,
        req.ip,
      );

      // Проверяем существование файла
      if (!fs.existsSync(miniAppData.socialCardUrl)) {
        await this.miniAppService.logDiagnostic(
          'ERROR',
          'mini-app',
          'image-download-file-not-found',
          `Social card file does not exist: ${miniAppData.socialCardUrl}`,
          { userId, socialCardUrl: miniAppData.socialCardUrl },
          req.headers['user-agent'] as string,
          req.ip,
        );
        return res.status(404).json({
          success: false,
          message: 'Файл изображения не существует',
        });
      }

      // Проверяем параметр download для режима скачивания
      const isDownload = req.query.download === 'true';

      // Получаем информацию о файле
      const fileStats = fs.statSync(miniAppData.socialCardUrl);

      // Устанавливаем заголовки
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Length', fileStats.size);

      if (isDownload) {
        // Для скачивания - attachment
        res.setHeader('Content-Disposition', `attachment; filename="evernow_analysis_${userId}_${Date.now()}.jpg"`);
        res.setHeader('Cache-Control', 'no-cache');
      } else {
        // Для просмотра - inline
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }

      // Отправляем файл
      const stream = fs.createReadStream(miniAppData.socialCardUrl);
      stream.pipe(res);

      // Логируем успешную отправку
      await this.miniAppService.logDiagnostic(
        'INFO',
        'mini-app',
        'image-download-success',
        `Social image sent successfully for user ${userId}`,
        { userId, socialCardUrl: miniAppData.socialCardUrl, fileSize: fileStats.size },
        req.headers['user-agent'] as string,
        req.ip,
      );
    } catch (error) {
      // Логируем ошибку
      await this.miniAppService.logDiagnostic(
        'ERROR',
        'mini-app',
        'image-download-error',
        `Error downloading social image for user ${userId}: ${error.message}`,
        { userId, error: error.message, stack: error.stack },
        req.headers['user-agent'] as string,
        req.ip,
      );
      return res.status(500).json({
        success: false,
        message: 'Ошибка при загрузке изображения',
      });
    }
  }

  /**
   * ✅ ОПТИМИЗИРОВАННАЯ версия: Получение информации пользователя с кешированием
   */
  @Get('user-info/:userId')
  async getUserInfo(@Param('userId') userId: string, @Res() res: Response) {
    try {
      const userInfo = await this.miniAppService.getUserInfoForMiniApp(userId);
      if (!userInfo) {
        throw new NotFoundException('User info not found');
      }

      // ✅ Оптимизированные заголовки для API
      if (process.env.NODE_ENV === 'production') {
        // Кешируем только если гипотеза готова
        if (userInfo.hypothesis) {
          res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600'); // 5 минут
        } else {
          res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60'); // 30 секунд
        }
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }

      console.log(`📸 User info for user ${userId}:`, userInfo);
      return res.json(userInfo);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('luscher-test/:userId')
  async saveLuscherTestResult(@Param('userId') userId: string, @Body() luscherTestResultDto: LuscherTestResultDto) {
    return this.miniAppService.saveLuscherTestResult(userId, luscherTestResultDto.results);
  }

  @Get('/loading-video/:locale')
  async getLoadingVideo(@Param('locale') locale: 'ru' | 'en' = 'ru'): Promise<string> {
    return this.miniAppService.getLoadingVideo(locale)
  }

  @Get('/loading-title/:locale')
  async getLoadingTitle(@Param('locale') locale: 'ru' | 'en' = 'ru'): Promise<{ title: string; subtitle: string }> {
    return this.miniAppService.getLoadingTitle(locale)
  }

  @Get('/report-title/:locale')
  async getReportTitle(@Param('locale') locale: 'ru' | 'en' = 'ru'): Promise<{ title: string; subtitle: string }> {
    return this.miniAppService.getReportTitle(locale)
  }
  /**
   * Альтернативный эндпоинт для сохранения результата Люшера.
   * Фронтенд отправляет POST /save-luscher-result с userId и result.
   */
  @Post('save-luscher-result')
  @ApiOperation({ summary: 'Сохранение результата теста Люшера (альтернативный формат)' })
  @ApiBody({ type: SaveLuscherResultDto })
  @ApiResponse({ status: 200, description: 'Результаты успешно сохранены' })
  async saveLuscherTestResultAlt(@Body() dto: SaveLuscherResultDto) {
    try {
      await this.miniAppService.saveLuscherTestResult(dto.userId, dto.result);
      return { success: true };
    } catch (error) {
      throw new HttpException(
        error.message || 'Не удалось сохранить результаты теста',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Дополнительный эндпоинт для совместимости с оригинальным URL
   * Фронтенд может отправлять POST /luscher-results с userId и results
   */
  @Post('luscher-results')
  @ApiOperation({ summary: 'Сохранение результата теста Люшера (оригинальный формат)' })
  @ApiResponse({ status: 200, description: 'Результаты успешно сохранены' })
  async saveLuscherResults(@Body() dto: { userId: string; results: Record<string, any> }) {
    try {
      await this.miniAppService.saveLuscherTestResult(dto.userId, dto.results);
      return { success: true };
    } catch (error) {
      throw new HttpException(
        error.message || 'Не удалось сохранить результаты теста',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  healthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Эндпоинт для логирования событий фронтенда
   */
  @Post('log')
  @ApiOperation({ summary: 'Логирование событий фронтенда' })
  async logFrontendEvent(@Body() dto: any, @Req() req: Request) {
    try {
      await this.miniAppService.logDiagnostic(
        dto.level || 'INFO',
        'mini-app-frontend',
        dto.action || 'unknown',
        dto.message || '',
        dto.metadata,
        dto.userId,
        req.headers['user-agent'] as string,
        req.ip,
        dto.telegramId,
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Получение диагностических логов (только для админов)
   */
  @Get('logs')
  @ApiOperation({ summary: 'Получение диагностических логов' })
  async getDiagnosticLogs(
    @Req() req: Request,
    @Query('userId') userId?: string,
    @Query('component') component?: string,
    @Query('level') level?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    try {
      const logs = await this.miniAppService.getDiagnosticLogs(
        userId,
        component,
        level,
        limit ? parseInt(limit) : 100,
        offset ? parseInt(offset) : 0,
      );
      return { success: true, logs };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
