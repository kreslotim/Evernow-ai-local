import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  ValidationPipe,
  BadRequestException,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './services/admin.service';
import { MiniAppService } from '../mini-app/mini-app.service';
import { WelcomePhotoService } from '../welcome-photo/welcome-photo.service';
import { GetUsersQueryDto, UpdateUserDto } from '../../../common/dtos/user.dto';
import { GetAnalyzesQueryDto } from '../../../common/dtos/analyze.dto';
import {
  BanUserDto,
  AddCreditsDto,
  GetDailyFunnelStatsDto,
  DailyFunnelStatsResponseDto,
} from '../../../common/dtos/admin.dto';
import {
  GetPromptsQueryDto,
  UpdatePromptDto,
  PromptResponseDto,
  PaginatedPromptsResponseDto,
} from '../../../common/dtos/prompt.dto';
import {
  GetBotMessagesQueryDto,
  CreateBotMessageDto,
  UpdateBotMessageDto,
  BotMessageResponseDto,
  PaginatedBotMessagesResponseDto,
  ImportDefaultMessagesDto,
} from '../../../common/dtos/bot-message.dto';
import {
  GetWelcomePhotosQueryDto,
  CreateWelcomePhotoDto,
  UpdateWelcomePhotoDto,
  BulkUpdateWelcomePhotosDto,
  WelcomePhotoResponseDto,
  PaginatedWelcomePhotosResponseDto,
  WelcomePhotoUploadResponseDto,
} from '../../../common/dtos/welcome-photo.dto';
import { AdminAuthGuard } from '../../guards';
import { memoryStorage } from 'multer';


// Интерфейс для загружаемого файла
interface UploadedFile {
  originalname: string;
  buffer: Buffer;
  size: number;
  mimetype: string;
}

@Controller('admin')
@ApiTags('Admin')
@ApiBearerAuth('jwt')
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly miniAppService: MiniAppService,
    private readonly welcomePhotoService: WelcomePhotoService,
  ) { }

  /**
   * Валидирует ID пользователя
   * @param id - ID пользователя для проверки
   * @throws BadRequestException если ID некорректный
   */
  private validateUserId(id: string): void {
    if (!id || typeof id !== 'string') {
      throw new BadRequestException('ID пользователя не может быть пустым');
    }

    // cuid обычно начинается с 'c' и содержит около 25 символов
    const cuidPattern = /^c[a-z0-9]{24}$/i;
    if (!cuidPattern.test(id)) {
      throw new BadRequestException(`Некорректный формат ID пользователя: ${id}`);
    }
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics retrieved successfully' })
  async getDashboard() {
    return await this.adminService.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get users list with pagination and filtering' })
  async getUsers(@Query(ValidationPipe) query: GetUsersQueryDto) {
    return await this.adminService.getUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user details by ID' })
  @ApiResponse({ status: 200, description: 'User details retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid user ID format' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id') id: string) {
    this.validateUserId(id);

    const user = await this.adminService.getUserById(id);
    if (!user) {
      throw new NotFoundException(`Пользователь с ID ${id} не найден`);
    }

    return user;
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Update user data' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid user ID format' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiBody({ type: UpdateUserDto })
  async updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    this.validateUserId(id);
    return this.adminService.updateUser(id, updateUserDto);
  }

  @Post('users/:id/ban')
  @ApiOperation({ summary: 'Ban user' })
  @ApiResponse({ status: 200, description: 'User banned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid user ID format' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiBody({ type: BanUserDto })
  @HttpCode(HttpStatus.OK)
  async banUser(@Param('id') id: string, @Body() banData: BanUserDto) {
    this.validateUserId(id);
    return this.adminService.banUser(id, banData.reason);
  }

  @Post('users/:id/unban')
  @ApiOperation({ summary: 'Unban user' })
  @ApiResponse({ status: 200, description: 'User unbanned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid user ID format' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @HttpCode(HttpStatus.OK)
  async unbanUser(@Param('id') id: string) {
    this.validateUserId(id);
    return this.adminService.unbanUser(id);
  }

  @Post('users/:id/credits')
  @ApiOperation({ summary: 'Add credits to user' })
  @ApiResponse({ status: 200, description: 'Credits added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid user ID format' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiBody({ type: AddCreditsDto })
  @HttpCode(HttpStatus.OK)
  async addCredits(@Param('id') id: string, @Body() creditsData: AddCreditsDto) {
    this.validateUserId(id);
    return this.adminService.addCreditsToUser(id, creditsData.amount);
  }

  @Delete('users/:id')
  @ApiOperation({
    summary: 'Полное удаление пользователя из системы',
    description: 'ВНИМАНИЕ: Полностью удаляет пользователя и все связанные данные из базы данных. Действие необратимо!',
  })
  @ApiResponse({ status: 200, description: 'Пользователь успешно удален' })
  @ApiResponse({ status: 400, description: 'Некорректный формат ID пользователя' })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  @HttpCode(HttpStatus.OK)
  async deleteUser(@Param('id') id: string) {
    this.validateUserId(id);
    return this.adminService.deleteUser(id);
  }

  @Get('users/:id/analyzes')
  @ApiOperation({ summary: 'Get user analyzes' })
  @ApiResponse({ status: 200, description: 'User analyzes retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid user ID format' })
  async getUserAnalyzes(@Param('id') id: string, @Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    this.validateUserId(id);
    return this.adminService.getUserAnalyzes(id, page, limit);
  }

  @Get('analyzes')
  @ApiOperation({ summary: 'Get all analyzes with pagination and filtering' })
  async getAnalyzes(@Query(ValidationPipe) query: GetAnalyzesQueryDto) {
    return this.adminService.getAnalyzes(query);
  }

  /**
   * Получить информацию о конкретном анализе
   */
  @Get('analyzes/:id')
  @ApiOperation({ summary: 'Get analyze details by ID' })
  @ApiResponse({ status: 200, description: 'Analyze details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Analyze not found' })
  async getAnalyzeById(@Param('id') id: string) {
    return this.adminService.getAnalyzeById(id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get system statistics' })
  @ApiResponse({ status: 200, description: 'System statistics retrieved successfully' })
  async getStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('funnel/stats')
  @ApiOperation({ summary: 'Get funnel statistics for all users' })
  @ApiResponse({ status: 200, description: 'Funnel statistics retrieved successfully' })
  async getFunnelStats() {
    return this.adminService.getFunnelStats();
  }

  @Get('funnel/daily-stats')
  @ApiOperation({
    summary: 'Получить дневную статистику воронки',
    description: 'Возвращает статистику пользователей по состояниям воронки с группировкой по дням',
  })
  @ApiResponse({
    status: 200,
    description: 'Дневная статистика воронки успешно получена',
    type: DailyFunnelStatsResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Некорректные параметры запроса' })
  async getDailyFunnelStats(@Query(ValidationPipe) query: GetDailyFunnelStatsDto) {
    return this.adminService.getDailyFunnelStats(query);
  }

  // Prompt Management Endpoints

  @Post('prompts/verify-password')
  @ApiOperation({ summary: 'Проверить пароль для доступа к промптам' })
  @ApiResponse({
    status: 200,
    description: 'Пароль корректный',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Статус проверки' },
        message: { type: 'string', description: 'Сообщение' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Неверный пароль' })
  @ApiBody({
    description: 'Пароль для доступа к промптам',
    schema: {
      type: 'object',
      properties: {
        password: { type: 'string', description: 'Пароль для промптов' },
      },
      required: ['password'],
    },
  })
  @HttpCode(HttpStatus.OK)
  async verifyPromptsPassword(@Body() body: { password: string }) {
    return this.adminService.verifyPromptsPassword(body.password);
  }

  @Get('prompts')
  @ApiOperation({ summary: 'Получить список всех промптов с пагинацией и фильтрацией' })
  @ApiResponse({
    status: 200,
    description: 'Список промптов успешно получен',
    type: PaginatedPromptsResponseDto,
  })
  async getPrompts(@Query(ValidationPipe) query: GetPromptsQueryDto) {
    return this.adminService.getPrompts(query);
  }

  @Get('prompts/:key')
  @ApiOperation({ summary: 'Получить промпт по ключу' })
  @ApiResponse({
    status: 200,
    description: 'Промпт успешно получен',
    type: PromptResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Промпт не найден' })
  async getPromptByKey(@Param('key') key: string) {
    return this.adminService.getPromptByKey(key);
  }

  @Put('prompts/:key')
  @ApiOperation({ summary: 'Обновить содержимое промпта' })
  @ApiResponse({
    status: 200,
    description: 'Промпт успешно обновлен',
    type: PromptResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Промпт не найден' })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  @ApiBody({ type: UpdatePromptDto })
  async updatePrompt(@Param('key') key: string, @Body() updateData: UpdatePromptDto) {
    return this.adminService.updatePrompt(key, updateData);
  }

  // Bot Messages Management Endpoints

  @Get('bot-messages')
  @ApiOperation({ summary: 'Получить список сообщений бота с пагинацией и фильтрацией' })
  @ApiResponse({
    status: 200,
    description: 'Список сообщений бота успешно получен',
    type: PaginatedBotMessagesResponseDto,
  })
  async getBotMessages(@Query(ValidationPipe) query: GetBotMessagesQueryDto) {
    return this.adminService.getBotMessages(query);
  }

  @Get('bot-messages/:key/:locale')
  @ApiOperation({ summary: 'Получить сообщение бота по ключу и локали' })
  @ApiResponse({
    status: 200,
    description: 'Сообщение бота успешно получено',
    type: BotMessageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Сообщение не найдено' })
  async getBotMessage(@Param('key') key: string, @Param('locale') locale: string) {
    return this.adminService.getBotMessage(key, locale);
  }

  @Put('bot-messages/:key/:locale')
  @ApiOperation({ summary: 'Обновить сообщение бота' })
  @ApiResponse({
    status: 200,
    description: 'Сообщение бота успешно обновлено',
    type: BotMessageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Сообщение не найдено' })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  @ApiBody({ type: UpdateBotMessageDto })
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('video/')) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Only video files are allowed'), false);
      }
    },
  }),)
  async updateBotMessage(
    @Param('key') key: string,
    @Param('locale') locale: string,
    @Body() updateData: UpdateBotMessageDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.adminService.updateBotMessage(key, locale, updateData, file?.buffer);
  }

  @Post('bot-messages')
  @ApiOperation({ summary: 'Создать новое сообщение бота' })
  @ApiResponse({
    status: 201,
    description: 'Сообщение бота успешно создано',
    type: BotMessageResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Некорректные данные или сообщение уже существует' })
  @ApiBody({ type: CreateBotMessageDto })
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('video/')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only video files are allowed'), false);
        }
      },
    }),
  )
  async createBotMessage(@Body() createData: CreateBotMessageDto, @UploadedFile() file: Express.Multer.File) {
    return this.adminService.createBotMessage(createData, file?.buffer);
  }

  @Delete('bot-messages/:key/:locale')
  @ApiOperation({ summary: 'Удалить кастомное сообщение (вернуть к дефолтному)' })
  @ApiResponse({
    status: 200,
    description: 'Кастомное сообщение удалено, восстановлено дефолтное значение',
  })
  @ApiResponse({ status: 404, description: 'Сообщение не найдено' })
  @HttpCode(HttpStatus.OK)
  async deleteBotMessage(@Param('key') key: string, @Param('locale') locale: string) {
    return this.adminService.deleteBotMessage(key, locale);
  }

  @Post('bot-messages/import-defaults')
  @ApiOperation({ summary: 'Импортировать дефолтные сообщения из локалей в БД' })
  @ApiResponse({
    status: 200,
    description: 'Дефолтные сообщения успешно импортированы',
  })
  @ApiResponse({ status: 400, description: 'Ошибка импорта' })
  @ApiBody({ type: ImportDefaultMessagesDto })
  @HttpCode(HttpStatus.OK)
  async importDefaultMessages(@Body() importData: ImportDefaultMessagesDto) {
    return this.adminService.importDefaultMessages(importData);
  }

  @Get('bot-messages/defaults/:locale')
  @ApiOperation({ summary: 'Получить дефолтные значения сообщений из файлов локализации' })
  @ApiResponse({
    status: 200,
    description: 'Дефолтные значения сообщений успешно получены',
  })
  @ApiResponse({ status: 404, description: 'Файл локализации не найден' })
  async getDefaultMessages(@Param('locale') locale: string) {
    return this.adminService.getDefaultMessages(locale);
  }

  // System Management Endpoints

  @Post('system/cleanup-files')
  @ApiOperation({ summary: 'Ручная очистка загруженных файлов' })
  @ApiResponse({
    status: 200,
    description: 'Очистка файлов выполнена',
    schema: {
      type: 'object',
      properties: {
        photos: { type: 'string', description: 'Результат очистки фотографий' },
        temp: { type: 'string', description: 'Результат очистки временных файлов' },
        success: { type: 'boolean', description: 'Статус успешности операции' },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Ошибка при очистке файлов' })
  @ApiBody({
    description: 'Настройки очистки файлов',
    schema: {
      type: 'object',
      properties: {
        maxAgeDays: {
          type: 'object',
          properties: {
            photos: { type: 'number', description: 'Максимальный возраст фотографий в днях (по умолчанию 7)' },
            temp: { type: 'number', description: 'Максимальный возраст временных файлов в днях (по умолчанию 1)' },
          },
        },
      },
    },
    required: false,
  })
  @HttpCode(HttpStatus.OK)
  async cleanupFiles(@Body() body?: { maxAgeDays?: { photos?: number; temp?: number } }) {
    return this.adminService.cleanupFiles(body?.maxAgeDays);
  }

  @Post('system/migrate-bot-joined-events')
  @ApiOperation({
    summary: 'Создание недостающих событий BOT_JOINED',
    description:
      'Ретроактивно создает события BOT_JOINED для существующих пользователей, у которых нет такого события. Нужно для корректной работы дневной статистики воронки.',
  })
  @ApiResponse({
    status: 200,
    description: 'Миграция событий BOT_JOINED выполнена успешно',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Сообщение о результате миграции' },
        createdEventsCount: { type: 'number', description: 'Количество созданных событий' },
        success: { type: 'boolean', description: 'Статус успешности операции' },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Ошибка при миграции событий' })
  @HttpCode(HttpStatus.OK)
  async migrateBotJoinedEvents() {
    return this.adminService.migrateBotJoinedEvents();
  }

  /**
   * Получение диагностических логов
   */
  @Get('diagnostic-logs')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Получение диагностических логов' })
  async getDiagnosticLogs(
    @Query('userId') userId?: string,
    @Query('component') component?: string,
    @Query('level') level?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const logs = await this.miniAppService.getDiagnosticLogs(
      userId,
      component,
      level,
      limit ? parseInt(limit) : 100,
      offset ? parseInt(offset) : 0,
    );

    return {
      success: true,
      logs,
      total: logs.length,
    };
  }

  // Welcome Photos Management Endpoints

  @Get('photos')
  @ApiOperation({ summary: 'Получить список фотографий приветствия с пагинацией и фильтрацией' })
  @ApiResponse({
    status: 200,
    description: 'Список фотографий приветствия успешно получен',
    type: PaginatedWelcomePhotosResponseDto,
  })
  async getWelcomePhotos(@Query(ValidationPipe) query: GetWelcomePhotosQueryDto) {
    return this.welcomePhotoService.getWelcomePhotos(query);
  }

  @Get('photos/stats')
  @ApiOperation({ summary: 'Получить статистику фотографий приветствия' })
  @ApiResponse({
    status: 200,
    description: 'Статистика фотографий приветствия успешно получена',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', description: 'Общее количество фотографий' },
        active: { type: 'number', description: 'Количество активных фотографий' },
        inactive: { type: 'number', description: 'Количество неактивных фотографий' },
        totalSizeBytes: { type: 'number', description: 'Общий размер всех фотографий в байтах' },
      },
    },
  })
  async getWelcomePhotosStats() {
    return this.welcomePhotoService.getWelcomePhotosStats();
  }

  @Post('photos/test-upload')
  @ApiOperation({ summary: 'Тестовая загрузка фотографии приветствия' })
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async testUploadWelcomePhoto(@UploadedFile() file: UploadedFile, @Body() rawData: any) {
    console.log('🔍 Received raw data:', rawData);
    console.log('🔍 File info:', file ? { name: file.originalname, size: file.size, type: file.mimetype } : 'No file');

    if (!file) {
      throw new BadRequestException('Файл не предоставлен');
    }

    // Мануальная валидация и трансформация
    const createData = {
      title: rawData.title || 'Test Photo',
      description: rawData.description || 'Test Description',
      isActive: rawData.isActive === 'true' || rawData.isActive === true,
      order: parseInt(rawData.order) || 0,
    };

    console.log('🔍 Transformed data:', createData);

    const photo = await this.welcomePhotoService.createWelcomePhoto(createData, file);

    return {
      success: true,
      message: 'Фотография приветствия успешно загружена (test)',
      photo,
    };
  }

  @Post('photos/upload')
  @ApiOperation({ summary: 'Загрузить новую фотографию приветствия' })
  @ApiResponse({
    status: 201,
    description: 'Фотография приветствия успешно загружена',
    type: WelcomePhotoUploadResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Некорректный файл или данные' })
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async uploadWelcomePhoto(
    @UploadedFile() file: UploadedFile,
    @Body(new ValidationPipe({ transform: true })) createData: CreateWelcomePhotoDto,
  ) {
    if (!file) {
      throw new BadRequestException('Файл не предоставлен');
    }

    const photo = await this.welcomePhotoService.createWelcomePhoto(createData, file);

    return {
      success: true,
      message: 'Фотография приветствия успешно загружена',
      photo,
    };
  }

  @Get('photos/:id')
  @ApiOperation({ summary: 'Получить фотографию приветствия по ID' })
  @ApiResponse({
    status: 200,
    description: 'Фотография приветствия успешно получена',
    type: WelcomePhotoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Фотография не найдена' })
  async getWelcomePhotoById(@Param('id') id: string) {
    return this.welcomePhotoService.getWelcomePhotoById(id);
  }

  @Put('photos/:id')
  @ApiOperation({ summary: 'Обновить фотографию приветствия' })
  @ApiResponse({
    status: 200,
    description: 'Фотография приветствия успешно обновлена',
    type: WelcomePhotoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Фотография не найдена' })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  @ApiBody({ type: UpdateWelcomePhotoDto })
  async updateWelcomePhoto(@Param('id') id: string, @Body() updateData: UpdateWelcomePhotoDto) {
    return this.welcomePhotoService.updateWelcomePhoto(id, updateData);
  }

  @Delete('photos/:id')
  @ApiOperation({ summary: 'Удалить фотографию приветствия' })
  @ApiResponse({
    status: 200,
    description: 'Фотография приветствия успешно удалена',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Сообщение об успешном удалении' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Фотография не найдена' })
  @HttpCode(HttpStatus.OK)
  async deleteWelcomePhoto(@Param('id') id: string) {
    return this.welcomePhotoService.deleteWelcomePhoto(id);
  }

  @Put('photos/bulk-update')
  @ApiOperation({ summary: 'Массовое обновление фотографий приветствия (порядок и активность)' })
  @ApiResponse({
    status: 200,
    description: 'Фотографии успешно обновлены',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Сообщение о результате' },
        updated: { type: 'number', description: 'Количество обновленных фотографий' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  @ApiBody({ type: BulkUpdateWelcomePhotosDto })
  async bulkUpdateWelcomePhotos(@Body() bulkUpdateData: BulkUpdateWelcomePhotosDto) {
    return this.welcomePhotoService.bulkUpdateWelcomePhotos(bulkUpdateData);
  }
}
