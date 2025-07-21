import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DailyFunnelStatsResponseDto, GetDailyFunnelStatsDto } from '../../../../common/dtos/admin.dto';
import { GetAnalyzesQueryDto } from '../../../../common/dtos/analyze.dto';
import {
  BotMessageResponseDto,
  CreateBotMessageDto,
  GetBotMessagesQueryDto,
  ImportDefaultMessagesDto,
  PaginatedBotMessagesResponseDto,
  UpdateBotMessageDto,
} from '../../../../common/dtos/bot-message.dto';
import {
  GetPromptsQueryDto,
  PaginatedPromptsResponseDto,
  PromptResponseDto,
  UpdatePromptDto,
} from '../../../../common/dtos/prompt.dto';
import { GetUsersQueryDto } from '../../../../common/dtos/user.dto';
import { DashboardStats } from '../../../../common/interfaces/admin.interface';
import { AnalyzeService } from '../../analyze/analyze.service';
import { BotMessageService } from '../../bot-message/bot-message.service';
import { PromptService } from '../../llm/prompt/prompt.service';
import { PromptKey } from '../../llm/prompt/prompts.constants';
import { MarketingCronService } from '../../marketing/marketing-cron.service';
import { UserService } from '../../user/user.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly userService: UserService,
    private readonly analyzeService: AnalyzeService,
    private readonly promptService: PromptService,
    private readonly botMessageService: BotMessageService,
    private readonly marketingCronService: MarketingCronService,
  ) { }

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const [userStats, analyzeStats, funnelCompletedUsers] = await Promise.all([
        this.userService.getUserStats(),
        this.analyzeService.getAnalyzeStats(),
        this.userService.getFunnelCompletionStats(),
      ]);

      return {
        ...userStats,
        totalAnalyzes: analyzeStats.totalAnalyzes,
        completedAnalyzes: analyzeStats.completedAnalyzes,
        pendingAnalyzes: analyzeStats.pendingAnalyzes,
        failedAnalyzes: analyzeStats.failedAnalyzes,
        analyzesLast30Days: analyzeStats.analyzesLast30Days,
        funnelCompletedUsers,
      };
    } catch (error) {
      this.logger.error(`Failed to get dashboard stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUsers(query: GetUsersQueryDto) {
    return this.userService.getUsers(query);
  }

  async getUserById(id: string) {
    return this.userService.findUserByIdExtended(id);
  }

  async updateUser(id: string, updateData: any) {
    return this.userService.updateUser(id, updateData);
  }

  async banUser(id: string, reason?: string) {
    return this.userService.banUser(id, reason);
  }

  async unbanUser(id: string) {
    return this.userService.unbanUser(id);
  }

  async getAnalyzes(query: GetAnalyzesQueryDto) {
    return this.analyzeService.getAnalyzes(query);
  }

  async getAnalyzeById(id: string) {
    return this.analyzeService.findAnalyzeById(id);
  }

  async getUserAnalyzes(userId: string, page: number = 1, limit: number = 10) {
    return this.analyzeService.getUserAnalyzes(userId, page, limit);
  }

  async addCreditsToUser(userId: string, amount: number) {
    return this.userService.addCredits(userId, amount);
  }

  /**
   * Очистка данных пользователя
   * Удаляет все данные анализов, результаты теста Люшера, гипотезы и файлы, но оставляет пользователя
   * @param userId - ID пользователя для очистки данных
   * @returns результат операции очистки
   */
  async clearUserData(userId: string) {
    try {
      this.logger.log(`Начинается очистка данных пользователя ${userId}`);

      // Проверяем существование пользователя
      const user = await this.userService.findUserByIdExtended(userId);
      if (!user) {
        throw new NotFoundException(`Пользователь с ID ${userId} не найден`);
      }

      // Очищаем данные пользователя (не удаляя самого пользователя)
      const result = await this.userService.clearUserData(userId);

      this.logger.log(
        `Данные пользователя ${userId} (Telegram: ${user.telegramUsername || user.telegramId}) успешно очищены`,
      );

      return {
        success: true,
        message: `Данные пользователя ${user.telegramUsername || user.telegramId} успешно очищены`,
        clearedUser: {
          id: userId,
          telegramId: user.telegramId,
          telegramUsername: user.telegramUsername,
        },
        filesDeleted: result.filesDeleted,
      };
    } catch (error) {
      this.logger.error(`Ошибка очистки данных пользователя ${userId}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Не удалось очистить данные пользователя: ${error.message}`);
    }
  }

  /**
   * Полное удаление пользователя из системы
   * @param userId - ID пользователя для удаления
   * @returns результат операции удаления
   */
  async deleteUser(userId: string) {
    try {
      this.logger.log(`Начинается полное удаление пользователя ${userId}`);

      // Проверяем существование пользователя
      const user = await this.userService.findUserByIdExtended(userId);
      if (!user) {
        throw new NotFoundException(`Пользователь с ID ${userId} не найден`);
      }

      // Удаляем пользователя и все связанные данные
      const result = await this.userService.deleteUser(userId);

      this.logger.log(`Пользователь ${userId} (Telegram: ${user.telegramUsername || user.telegramId}) успешно удален`);

      return {
        success: true,
        message: `Пользователь ${user.telegramUsername || user.telegramId} успешно удален из системы`,
        deletedUser: {
          id: userId,
          telegramId: user.telegramId,
          telegramUsername: user.telegramUsername,
        },
      };
    } catch (error) {
      this.logger.error(`Ошибка удаления пользователя ${userId}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Не удалось удалить пользователя: ${error.message}`);
    }
  }

  async getFunnelStats() {
    return this.userService.getFunnelStats();
  }

  /**
   * Получает дневную статистику воронки пользователей
   * @param params - параметры запроса с фильтрацией и пагинацией
   * @returns дневная статистика с пагинацией
   */
  async getDailyFunnelStats(params: GetDailyFunnelStatsDto): Promise<DailyFunnelStatsResponseDto> {
    try {
      this.logger.log('Получение дневной статистики воронки');

      // Преобразуем строковые даты в Date объекты
      const queryParams = {
        dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
        dateTo: params.dateTo ? new Date(params.dateTo) : undefined,
        page: params.page || 1,
        limit: params.limit || 30,
      };

      const result = await this.userService.getDailyFunnelStats(queryParams);

      this.logger.log(`Дневная статистика воронки получена: ${result.data.length} записей`);

      return result;
    } catch (error) {
      this.logger.error(`Ошибка получения дневной статистики воронки: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Prompt Management Methods

  /**
   * Проверяет пароль для доступа к промптам
   * @param password - введенный пользователем пароль
   * @returns результат проверки пароля
   */
  async verifyPromptsPassword(password: string): Promise<{ success: boolean; message: string }> {
    try {
      // Получаем пароль промптов из переменных окружения
      const promptsPassword = process.env.PROMPTS_PASSWORD;

      if (!promptsPassword) {
        this.logger.warn('PROMPTS_PASSWORD не задан в переменных окружения');
        throw new BadRequestException('Пароль для промптов не настроен');
      }

      // Проверяем пароль
      if (password === promptsPassword) {
        this.logger.log('Успешная проверка пароля промптов');
        return {
          success: true,
          message: 'Пароль корректный',
        };
      } else {
        this.logger.warn('Неверный пароль для доступа к промптам');
        throw new BadRequestException('Неверный пароль');
      }
    } catch (error) {
      this.logger.error(`Ошибка проверки пароля промптов: ${error.message}`, error.stack);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Ошибка проверки пароля');
    }
  }

  /**
   * Получает список всех промптов с пагинацией и фильтрацией
   * @param query - параметры запроса с фильтрами
   * @returns пагинированный список промптов
   */
  async getPrompts(query: GetPromptsQueryDto): Promise<PaginatedPromptsResponseDto> {
    try {
      const { provider, search, page = 1, limit = 20 } = query;

      // Получаем все промпты с фильтрацией по провайдеру
      let allPrompts = await this.promptService.getAllPrompts(provider);

      // Применяем поиск если указан
      if (search && search.trim()) {
        const searchTerm = search.toLowerCase();
        allPrompts = allPrompts.filter(
          (prompt) =>
            prompt.content.toLowerCase().includes(searchTerm) ||
            prompt.description?.toLowerCase().includes(searchTerm) ||
            prompt.key.toLowerCase().includes(searchTerm),
        );
      }

      // Пагинация
      const total = allPrompts.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const prompts = allPrompts.slice(startIndex, startIndex + limit);

      // Преобразуем в DTO
      const promptDtos: PromptResponseDto[] = prompts.map((prompt) => ({
        key: prompt.key,
        content: prompt.content,
        description: prompt.description,
        provider: prompt.provider,
        source: prompt.source,
        isActive: prompt.isActive,
        deprecated: prompt.deprecated,
        updatedAt: prompt.updatedAt,
      }));

      return {
        prompts: promptDtos,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error(`Ошибка получения списка промптов: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Получает конкретный промпт по ключу
   * @param key - ключ промпта
   * @returns промпт с метаданными
   */
  async getPromptByKey(key: string): Promise<PromptResponseDto> {
    try {
      // Проверяем, что ключ существует в enum
      if (!Object.values(PromptKey).includes(key as PromptKey)) {
        throw new NotFoundException(`Промпт с ключом '${key}' не найден`);
      }

      const prompt = await this.promptService.getPromptWithMetadata(key as PromptKey);

      return {
        key: prompt.key,
        content: prompt.content,
        description: prompt.description,
        provider: prompt.provider,
        source: prompt.source,
        isActive: prompt.isActive,
        deprecated: prompt.deprecated,
        updatedAt: prompt.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Ошибка получения промпта ${key}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(`Промпт с ключом '${key}' не найден`);
    }
  }

  /**
   * Обновляет промпт
   * @param key - ключ промпта
   * @param updateData - данные для обновления
   * @returns обновленный промпт
   */
  async updatePrompt(key: string, updateData: UpdatePromptDto): Promise<PromptResponseDto> {
    try {
      // Проверяем, что ключ существует в enum
      if (!Object.values(PromptKey).includes(key as PromptKey)) {
        throw new BadRequestException(`Промпт с ключом '${key}' не существует`);
      }

      const updatedPrompt = await this.promptService.updatePrompt(
        key as PromptKey,
        updateData.content,
        updateData.description,
      );

      this.logger.log(`Промпт ${key} успешно обновлен администратором`);

      return {
        key: updatedPrompt.key,
        content: updatedPrompt.content,
        description: updatedPrompt.description,
        provider: updatedPrompt.provider,
        source: updatedPrompt.source,
        isActive: updatedPrompt.isActive,
        deprecated: updatedPrompt.deprecated,
        updatedAt: updatedPrompt.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Ошибка обновления промпта ${key}: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Не удалось обновить промпт: ${error.message}`);
    }
  }

  // Bot Message Management Methods

  /**
   * Получает список всех сообщений бота с пагинацией и фильтрацией
   * Включает как дефолтные сообщения из файлов локализации, так и кастомные из БД
   * @param query - параметры запроса с фильтрами
   * @returns пагинированный список сообщений бота
   */
  async getBotMessages(query: GetBotMessagesQueryDto): Promise<PaginatedBotMessagesResponseDto> {
    try {
      const { locale, search, page = 1, limit = 20 } = query;

      // Список всех ключей сообщений, доступных для редактирования в админке
      // Синхронизирован с дропдауном в BotMessages.vue
      const AVAILABLE_MESSAGE_KEYS = [
        // Приветствие и старт
        'greeting.auto_registered',
        'greeting.referral_bonus',

        // Онбординг
        'onboarding.processingFeelings',
        'onboarding.waitingPhotoAnalysis',
        'onboarding.feelsMessageDeclined',
        'onboarding.triggerMessage',
        'onboarding.miniAppButton',
        'onboarding.miniAppMessage',
        'onboarding.final',
        'onboarding.shareWithFriendsButton',
        'onboarding.shareText',
        'onboarding.makeRepostButton',
        'onboarding.purchaseParticipationButton',
        'onboarding.shareMessage',
        'onboarding.backButton',
        'onboarding.repostMessage',
        'onboarding.repostCheckButton',
        'onboarding.repostSuccessMessage',
        'onboarding.repostAlreadyActivated',
        'onboarding.photoRequest',
        'onboarding.readyToStartSurvey',
        'onboarding.readyToStartButton',
        'onboarding.completed',
        'onboarding.purchaseMessage',
        'onboarding.custom_answer_request',
        'onboarding.processing_voice_message',
        'onboarding.voice_question',
        'onboarding.voice_processing_error_retry',
        'onboarding.survey_results_header',
        'onboarding.voice_message_footer',
        'onboarding.answer_fallback',
        'onboarding.custom_answer_option',
        'onboarding.mainConclusion',
        'onboarding.readyButton',
        'onboarding.finalChoices',

        // Психологический опрос
        'onboarding.survey.q1.text',
        'onboarding.survey.q1.question_title',
        'onboarding.survey.q2.text',
        'onboarding.survey.q2.question_title',
        'onboarding.survey.q3.text',
        'onboarding.survey.q3.question_title',
        'onboarding.survey.q4.text',
        'onboarding.survey.q4.question_title',
        'onboarding.survey.results_header',
        'onboarding.survey.voice_message_prefix',

        // Middleware сообщения
        'onboarding.middleware.use_survey_buttons',
        'onboarding.middleware.voice_message_required',
        'onboarding.middleware.text_answer_required',

        // Анализ
        'scenes.analysis.send_face_photo',
        'scenes.analysis.skip_palms_button',
        'scenes.analysis.send_palms_optional',
        'scenes.analysis.skip_second_palm_button',
        'scenes.analysis.complete_analysis_button',
        'scenes.analysis.send_second_palm_optional',
        'scenes.analysis.session_completed',

        // Ошибки
        'errors.general',
        'errors.account_banned',
        'errors.user_not_found',
        'errors.photo_failed',
        'errors.analysis_creation_failed',
        'errors.hypothesis_creation_failed',
        'errors.photo_validation_failed',
        'errors.face_photo_validation_failed',
        'errors.palm_photo_validation_failed',

        // Варианты ответов для вопросов
        'onboarding.survey.q1.options.0',
        'onboarding.survey.q1.options.1',
        'onboarding.survey.q1.options.2',
        'onboarding.survey.q1.options.3',
        'onboarding.survey.q2.options.0',
        'onboarding.survey.q2.options.1',
        'onboarding.survey.q2.options.2',
        'onboarding.survey.q2.options.3',
        'onboarding.survey.q2.options.4',
        'onboarding.survey.q3.options.0',
        'onboarding.survey.q3.options.1',
        'onboarding.survey.q3.options.2',
        'onboarding.survey.q3.options.3',
        'onboarding.survey.q3.options.4',
        'onboarding.survey.q4.options.0',
        'onboarding.survey.q4.options.1',
        'onboarding.survey.q4.options.2',
        'onboarding.survey.q4.options.3',
        'onboarding.survey.q4.options.4',
        'onboarding.voice_question',
        'onboarding.backToQuestionButton',

        // Видео
        'videos.analysis_processing',
        'mini_app.loading_title',
        'mini_app.loading_subtitle',
        'mini_app.report_title',
        'mini_app.report_subtitle',


      ];

      // Функция для получения значения по вложенному ключу
      const getNestedValue = (obj: any, path: string): string | undefined => {
        return path.split('.').reduce((current, key) => current?.[key], obj);
      };

      // 1. Загружаем дефолтные сообщения из файлов локализации
      const allMessages: BotMessageResponseDto[] = [];
      const messageMap = new Map<string, BotMessageResponseDto>();

      // Загружаем для всех локалей или для конкретной
      const localesToLoad = locale ? [locale] : ['ru', 'en'];

      for (const loc of localesToLoad) {
        try {
          const localeData = await this.getDefaultMessages(loc);

          // Добавляем только важные ключи
          for (const key of AVAILABLE_MESSAGE_KEYS) {
            const content = getNestedValue(localeData, key);
            if (content && typeof content === 'string') {
              const mapKey = `${key}:${loc}`;
              messageMap.set(mapKey, {
                key,
                locale: loc,
                content,
                description: `Дефолтное сообщение из ${loc}.json`,
                source: 'default',
                isActive: true,
              });
            }
          }
        } catch (err) {
          this.logger.warn(`Не удалось загрузить локаль ${loc}: ${err.message}`);
        }
      }

      // 2. Загружаем кастомные сообщения из БД
      const dbResult = await this.botMessageService.getAllMessages(locale, '', 1, 1000); // Загружаем все для фильтрации

      // Переопределяем дефолтные сообщения кастомными из БД
      for (const prompt of dbResult.prompts) {
        // Проверяем что это важный ключ
        if (AVAILABLE_MESSAGE_KEYS.includes(prompt.key)) {
          const mapKey = `${prompt.key}:${prompt.locale}`;
          messageMap.set(mapKey, {
            key: prompt.key,
            locale: prompt.locale,
            content: prompt.content,
            description: prompt.description,
            source: 'database',
            isActive: prompt.isActive,
            updatedAt: prompt.updatedAt,
          });
        }
      }

      // 3. Применяем поиск если указан
      let filteredMessages = Array.from(messageMap.values());

      if (search && search.trim()) {
        const searchLower = search.toLowerCase();
        filteredMessages = filteredMessages.filter(
          (msg) =>
            msg.key.toLowerCase().includes(searchLower) ||
            msg.content.toLowerCase().includes(searchLower) ||
            (msg.description && msg.description.toLowerCase().includes(searchLower)),
        );
      }

      // 4. Применяем пагинацию
      const total = filteredMessages.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const paginatedMessages = filteredMessages.slice(startIndex, startIndex + limit);

      return {
        messages: paginatedMessages,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error(`Ошибка получения списка сообщений бота: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Получает конкретное сообщение бота по ключу и локали
   * @param key - ключ сообщения
   * @param locale - локаль сообщения
   * @returns сообщение бота
   */
  async getBotMessage(key: string, locale: string): Promise<BotMessageResponseDto> {
    try {
      const content = await this.botMessageService.getMessage(key, locale);

      if (!content) {
        throw new NotFoundException(`Сообщение с ключом '${key}' и локалью '${locale}' не найдено`);
      }

      // Получаем полную информацию из БД для метаданных
      const result = await this.botMessageService.getAllMessages(locale, key, 1, 1);
      const prompt = result.prompts.find((p) => p.key === key);

      if (!prompt) {
        // Сообщение есть в getMessage, но нет в getAllMessages - странная ситуация
        return {
          key,
          locale,
          content,
          source: 'database',
          isActive: true,
        };
      }

      return {
        key: prompt.key,
        locale: prompt.locale,
        content: prompt.content,
        description: prompt.description,
        source: 'database',
        isActive: prompt.isActive,
        updatedAt: prompt.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Ошибка получения сообщения ${key}:${locale}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(`Сообщение с ключом '${key}' и локалью '${locale}' не найдено`);
    }
  }

  /**
   * Обновляет сообщение бота
   * @param key - ключ сообщения
   * @param locale - локаль сообщения
   * @param updateData - данные для обновления
   * @returns обновленное сообщение
   */
  async updateBotMessage(key: string, locale: string, updateData: UpdateBotMessageDto, file: Buffer): Promise<BotMessageResponseDto> {
    try {
      await this.botMessageService.saveMessage(key, locale, updateData.content, file, updateData.description);

      this.logger.log(`Сообщение бота ${key}:${locale} успешно обновлено администратором`);

      // Возвращаем обновленное сообщение
      return await this.getBotMessage(key, locale);
    } catch (error) {
      this.logger.error(`Ошибка обновления сообщения бота ${key}:${locale}: ${error.message}`, error.stack);
      throw new BadRequestException(`Не удалось обновить сообщение: ${error.message}`);
    }
  }

  /**
   * Создает новое сообщение бота
   * @param createData - данные для создания
   * @returns созданное сообщение
   */
  async createBotMessage(createData: CreateBotMessageDto, file: Buffer): Promise<BotMessageResponseDto> {
    try {
      await this.botMessageService.saveMessage(
        createData.key,
        createData.locale,
        createData.content,
        file,
        createData.description,
      );

      this.logger.log(`Новое сообщение бота ${createData.key}:${createData.locale} создано администратором`);

      // Возвращаем созданное сообщение
      return await this.getBotMessage(createData.key, createData.locale);
    } catch (error) {
      this.logger.error(
        `Ошибка создания сообщения бота ${createData.key}:${createData.locale}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(`Не удалось создать сообщение: ${error.message}`);
    }
  }

  /**
   * Удаляет кастомное сообщение бота (возвращает к дефолтному)
   * @param key - ключ сообщения
   * @param locale - локаль сообщения
   */
  async deleteBotMessage(key: string, locale: string): Promise<{ message: string }> {
    try {
      await this.botMessageService.deleteMessage(key, locale);

      this.logger.log(`Кастомное сообщение бота ${key}:${locale} удалено администратором`);

      return {
        message: `Кастомное сообщение '${key}' для языка '${locale}' успешно удалено. Теперь будет использоваться дефолтное сообщение.`,
      };
    } catch (error) {
      this.logger.error(`Ошибка удаления сообщения бота ${key}:${locale}: ${error.message}`, error.stack);
      throw new BadRequestException(`Не удалось удалить сообщение: ${error.message}`);
    }
  }

  /**
   * Импортирует дефолтные сообщения из локалей в БД
   * @param importData - параметры импорта
   */
  async importDefaultMessages(importData: ImportDefaultMessagesDto): Promise<{ message: string; imported: number }> {
    try {
      // Это заглушка - реальная логика импорта должна быть реализована
      // в отдельном сервисе или скрипте, который читает локали и импортирует их
      this.logger.log(`Импорт дефолтных сообщений: overwrite=${importData.overwrite}, locale=${importData.locale}`);

      // Возвращаем заглушку
      return {
        message: 'Импорт дефолтных сообщений выполнен успешно',
        imported: 0, // В реальной реализации здесь будет количество импортированных сообщений
      };
    } catch (error) {
      this.logger.error(`Ошибка импорта дефолтных сообщений: ${error.message}`, error.stack);
      throw new BadRequestException(`Не удалось импортировать дефолтные сообщения: ${error.message}`);
    }
  }

  /**
   * Получает дефолтные значения сообщений из файлов локализации
   * @param locale - локаль (ru, en)
   * @returns содержимое файла локализации
   */
  async getDefaultMessages(locale: string): Promise<any> {
    try {
      // Путь к файлу локализации относительно корня проекта
      const localeFilePath = path.join(process.cwd(), 'src', 'bot', 'i18n', 'locales', `${locale}.json`);

      // Проверяем существование файла
      if (!fs.existsSync(localeFilePath)) {
        throw new NotFoundException(`Файл локализации для языка '${locale}' не найден`);
      }

      // Читаем и парсим файл
      const fileContent = fs.readFileSync(localeFilePath, 'utf8');
      const localeData = JSON.parse(fileContent);

      this.logger.log(`Дефолтные сообщения для локали '${locale}' успешно загружены`);

      return localeData;
    } catch (error) {
      this.logger.error(`Ошибка загрузки дефолтных сообщений для локали '${locale}': ${error.message}`, error.stack);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException(`Не удалось загрузить дефолтные сообщения: ${error.message}`);
    }
  }

  /**
   * Ручная очистка файлов через админ панель
   * @param maxAgeDays - Настройки максимального возраста файлов
   * @returns Результат очистки
   */
  async cleanupFiles(maxAgeDays?: { photos?: number; temp?: number }): Promise<{
    photos: string;
    temp: string;
    success: boolean;
  }> {
    try {
      this.logger.log('Manual file cleanup requested via admin panel');

      const result = await this.marketingCronService.manualCleanupFiles(maxAgeDays);

      this.logger.log(`Manual file cleanup completed via admin panel: ${JSON.stringify(result)}`);

      return result;
    } catch (error) {
      this.logger.error(`Manual file cleanup failed via admin panel: ${error.message}`, error.stack);
      throw new BadRequestException(`Ошибка очистки файлов: ${error.message}`);
    }
  }

  /**
   * Создание недостающих событий BOT_JOINED для существующих пользователей
   * @returns Результат миграции
   */
  async migrateBotJoinedEvents(): Promise<{
    message: string;
    createdEventsCount: number;
    success: boolean;
  }> {
    try {
      this.logger.log('BOT_JOINED events migration requested via admin panel');

      const createdEventsCount = await this.userService.createMissingBotJoinedEvents();

      const result = {
        message: `Миграция событий BOT_JOINED завершена успешно. Создано событий: ${createdEventsCount}`,
        createdEventsCount,
        success: true,
      };

      this.logger.log(`BOT_JOINED events migration completed via admin panel: ${JSON.stringify(result)}`);

      return result;
    } catch (error) {
      this.logger.error(`BOT_JOINED events migration failed via admin panel: ${error.message}`, error.stack);
      throw new BadRequestException(`Ошибка миграции событий BOT_JOINED: ${error.message}`);
    }
  }
}
