import {Injectable, Logger} from '@nestjs/common';
import {AnalyzeType} from '@prisma/client';
import {UserInfoService} from 'src/core/modules/user-info/user-info.service';
import {UserService} from 'src/core/modules/user/user.service';
import {Context} from 'telegraf';
import {I18nService} from '../i18n/i18n.service';
import {AnalysisCheckMiddleware, AnalysisContext} from '../middleware/analysis-check.middleware';
import {getLocaleFromLanguage} from '../utils/language';
import {TypingStatusUtil} from '../utils/typing-status.util';
import {OnboardingHandler} from './onboarding.handler';
import {OpenAIService} from 'src/core/modules/llm/openai/openai.service';

/**
 * Обработчик анализа (упрощённая версия)
 * --------------------------------------
 * 1. Больше нет выбора типа анализа — используем один тип DEFAULT.
 * 2. Пользователь отправляет 3 фотографии (лицо, ладони, полное тело), после чего создаётся запись в БД и кладётся задача в очередь.
 * 3. Лишние старые методы оставлены как заглушки, чтобы не ломать существующие вызовы из BotService.
 */
@Injectable()
export class AnalyzeHandler {
    private readonly logger = new Logger(AnalyzeHandler.name);

    // Сохраняем один «дефолтный» тип анализа, остальные не используются
    private static readonly DEFAULT_ANALYZE_TYPE: AnalyzeType = 'DEFAULT' as AnalyzeType;

    // Минимальный список типов (нужен для совместимости со старым кодом)
    private static readonly analysisTypes = [
        {key: AnalyzeHandler.DEFAULT_ANALYZE_TYPE, labelKey: 'scenes.analysis.effects.default_analyze'},
    ];

    // Временное хранилище сессий для поэтапной загрузки фотографий
    private readonly userSessions = new Map<
        string,
        {
            photos: string[];
            stage: 'waiting_face' | 'waiting_palms' | 'completed';
            facePhoto?: string;
            palmPhotos: string[];
        }
    >();

    // Временное хранилище для media groups (группы фотографий, отправленных одновременно)
    private readonly mediaGroupBuffer = new Map<
        string,
        {
            photos: string[];
            userId: string;
            timeout: NodeJS.Timeout;
            timestamp: number;
            ctx: Context;
        }
    >();

    constructor(
        private readonly userService: UserService,
        private readonly userInfoService: UserInfoService,
        private readonly i18nService: I18nService,
        private readonly analysisCheckMiddleware: AnalysisCheckMiddleware,
        private readonly onboardingHandler: OnboardingHandler,
        private readonly typingStatusUtil: TypingStatusUtil,
        private readonly openaiService: OpenAIService
    ) {
    }

    /**
     * Безопасно удаляет предыдущее сообщение перед отправкой нового
     * @param ctx - Контекст Telegram
     */
    private async safeDeletePreviousMessage(ctx: Context): Promise<void> {
        try {
            if (ctx.callbackQuery && 'message' in ctx.callbackQuery && ctx.callbackQuery.message) {
                // Если это callback query, удаляем сообщение с кнопкой
                await ctx.deleteMessage();
                this.logger.log('Previous message deleted successfully (callback)');
            }
        } catch (error) {
            // Ошибки удаления не критичны - сообщение могло быть уже удалено
            this.logger.warn(`Failed to delete previous message: ${error.message}`);
        }
    }

    /**
     * Обрабатывает команду /analyze - просит пользователя прислать 3 фотографии
     * Фотографии должны быть: лицо, ладони и полное тело при хорошем освещении
     * @param ctx - контекст анализа Telegram
     */
    async handleAnalyzeCommand(ctx: AnalysisContext): Promise<void> {
        const middleware = this.analysisCheckMiddleware.getMiddleware();
        await middleware(ctx, async () => {
            if (!ctx.canAnalyze || !ctx.user) return;

            const telegramId = ctx.from?.id?.toString();
            if (!telegramId) return;

            this.userSessions.set(telegramId, {
                photos: [],
                stage: 'waiting_face',
                palmPhotos: [],
            });

            // Удаляем предыдущее сообщение перед отправкой запроса фотографий
            await this.safeDeletePreviousMessage(ctx);

            const locale = getLocaleFromLanguage(ctx.user.language);
            const message = this.i18nService.translate('scenes.analysis.send_face_photo', locale);
            await ctx.reply(message, {parse_mode: 'HTML'});
        });
    }

    /**
     * Поэтапный приём фотографий для анализа
     * Этап 1: Фото лица (обязательно)
     * Этап 2: Фото ладоней (опционально, можно пропустить)
     *
     * Защита от лишних фотографий:
     * 1. Проверяет состояние пользователя - принимает фото только в состоянии WAITING_PHOTOS
     * 2. Отслеживает этапы через сессию: waiting_face -> waiting_palms -> completed
     * 3. После запуска анализа состояние меняется на ANALYSIS_COMPLETED
     * 4. Сессия очищается после завершения обработки
     * 5. Поддерживает media groups (несколько фото отправленных одновременно)
     *
     * @param ctx - контекст Telegram
     */
    async handlePhotoMessage(ctx: Context): Promise<void> {
        const telegramId = ctx.from?.id?.toString();
        if (!telegramId) return;

        const user = await this.userService.findUserInfoByTeleramId(telegramId);
        if (!user) {
            await ctx.reply(await this.i18nService.tAsync('errors.user_not_found', 'ru'));
            return;
        }

        // Проверяем состояние пользователя - принимаем фото только в режиме ожидания
        if (user.pipelineState !== 'WAITING_PHOTOS') {
            this.logger.log(
                `User ${telegramId} sent photo but not in WAITING_PHOTOS state (current: ${user.pipelineState}), ignoring`,
            );
            return;
        }

        // Извлекаем файлId последней фото в сообщении
        const photoArray = (ctx.message as any).photo as Array<{ file_id: string }> | undefined;
        const fileId = photoArray ? photoArray[photoArray.length - 1].file_id : undefined;
        if (!fileId) {
            const locale = getLocaleFromLanguage(user.language);
            await ctx.reply(await this.i18nService.tAsync('errors.photo_failed', locale));
            return;
        }

        // Проверяем, является ли это частью media group (группы фотографий)
        const mediaGroupId = (ctx.message as any).media_group_id;

        if (mediaGroupId) {
            // Обрабатываем как часть media group
            await this.handleMediaGroupPhoto(ctx, user, fileId, mediaGroupId);
        } else {
            // Обрабатываем как одиночное фото
            await this.handleSinglePhoto(ctx, user, fileId);
        }

        const userMessageId = ctx.message.message_id;
        const chatId = ctx.chat.id;

        await ctx.telegram.deleteMessages(chatId, [userMessageId, userMessageId - 1]);
    }

    /**
     * Обрабатывает фотографию как часть media group (группы фотографий)
     * Собирает все фотографии из группы и обрабатывает их вместе
     * @param ctx - контекст Telegram
     * @param user - объект пользователя
     * @param fileId - ID фото в Telegram
     * @param mediaGroupId - ID группы медиафайлов
     */
    private async handleMediaGroupPhoto(ctx: Context, user: any, fileId: string, mediaGroupId: string): Promise<void> {
        const telegramId = ctx.from?.id?.toString();
        if (!telegramId) return;

        this.logger.log(`Processing media group photo: user ${telegramId}, group ${mediaGroupId}, photo ${fileId}`);

        // Получаем или создаём буфер для media group
        let groupBuffer = this.mediaGroupBuffer.get(mediaGroupId);

        if (!groupBuffer) {
            // Создаём новый буфер для группы с таймером
            groupBuffer = {
                photos: [],
                userId: telegramId,
                timestamp: Date.now(),
                ctx: ctx, // Сохраняем контекст
                timeout: setTimeout(() => {
                    // Таймер истёк - обрабатываем накопленные фотографии
                    this.processMediaGroupPhotos(mediaGroupId);
                }, 1000), // Ждём 1 секунду для сбора всех фото из группы
            };
            this.mediaGroupBuffer.set(mediaGroupId, groupBuffer);
        } else {
            // Обновляем контекст на самый последний из группы
            groupBuffer.ctx = ctx;
        }

        // Добавляем фото в буфер
        groupBuffer.photos.push(fileId);

        this.logger.log(`Added photo to media group buffer: ${groupBuffer.photos.length} photos in group ${mediaGroupId}`);
    }

    /**
     * Обрабатывает одиночное фото (не part of media group)
     * @param ctx - контекст Telegram
     * @param user - объект пользователя
     * @param fileId - ID фото в Telegram
     */
    private async handleSinglePhoto(ctx: Context, user: any, fileId: string): Promise<void> {
        const telegramId = ctx.from?.id?.toString();
        if (!telegramId) return;

        // Получаем или создаём сессию для хранения фото
        let session = this.userSessions.get(telegramId);
        if (!session) {
            session = {
                photos: [],
                stage: 'waiting_face',
                palmPhotos: [],
            };
            this.userSessions.set(telegramId, session);
        }

        const locale = getLocaleFromLanguage(user.language);

        // Поэтапная обработка фотографий
        switch (session.stage) {
            case 'waiting_face':
                await this.handleFacePhoto(ctx, user, session, fileId, locale);
                break;

            case 'waiting_palms':
                await this.handlePalmPhoto(ctx, user, session, fileId, locale);
                break;

            case 'completed':
                // Сессия уже завершена, игнорируем дополнительные фото
                this.logger.log(`User ${telegramId} sent photo but session already completed, ignoring`);
                await ctx.reply(this.i18nService.translate('scenes.analysis.session_completed', locale));
                break;
        }
    }

    /**
     * Обрабатывает накопленные фотографии из media group
     * @param mediaGroupId - ID группы медиафайлов
     */
    private async processMediaGroupPhotos(mediaGroupId: string): Promise<void> {
        const groupBuffer = this.mediaGroupBuffer.get(mediaGroupId);
        if (!groupBuffer) return;

        const {userId: telegramId, photos, ctx} = groupBuffer;

        this.logger.log(`Processing media group: ${mediaGroupId}, ${photos.length} photos for user ${telegramId}`);

        // Очищаем таймер и удаляем буфер
        clearTimeout(groupBuffer.timeout);
        this.mediaGroupBuffer.delete(mediaGroupId);

        // Получаем пользователя и сессию
        const user = await this.userService.findUserInfoByTeleramId(telegramId);
        if (!user) {
            this.logger.error(`User not found for media group processing: ${telegramId}`);
            return;
        }

        if (groupBuffer.photos.length > 2) {
            const {rating} = await this.openaiService.validatePhotos(await Promise.all(groupBuffer.photos.map(async fileId => (await ctx.telegram.getFileLink(fileId)).href)));

            this.logger.log(`Recieved rating of validated photos: ${rating}`);

            if (rating < 1) {
                ctx.reply(await this.i18nService.tAsync('errors.photo_validation_failed', user.language.toLowerCase()));
                return;
            }
        }


        let session = this.userSessions.get(telegramId);
        if (!session) {
            session = {
                photos: [],
                stage: 'waiting_face',
                palmPhotos: [],
            };
            this.userSessions.set(telegramId, session);
        }

        const locale = getLocaleFromLanguage(user.language);

        // Обрабатываем все фотографии из группы в зависимости от текущего этапа
        switch (session.stage) {
            case 'waiting_face':
                // В этапе ожидания лица принимаем только первое фото из группы как лицо
                await this.handleFacePhoto(ctx, user, session, photos[0], locale, true);

                // Если в группе больше 1 фото, добавляем остальные как ладони
                if (photos.length > 1) {
                    for (let i = 1; i < photos.length; i++) {
                        await this.addPalmPhotoToSession(user, session, photos[i]);
                    }

                    // Если теперь у нас достаточно ладоней, завершаем анализ
                    if (session.palmPhotos.length >= 1) {
                        this.logger.log(
                            `Media group with face + ${session.palmPhotos.length} palm(s) processed for user ${telegramId}, completing analysis`,
                        );
                        await this.completePhotoAnalysis(ctx, user, session, locale);
                    }
                }
                break;

            case 'waiting_palms':
                // В этапе ожидания ладоней добавляем все фото как ладони
                for (const photoId of photos) {
                    await this.addPalmPhotoToSession(user, session, photoId);
                }

                // Отправляем итоговое сообщение в зависимости от количества ладоней
                if (session.palmPhotos.length >= 1) {
                    // Если теперь у нас 1 или больше ладоней - завершаем
                    await this.completePhotoAnalysis(ctx, user, session, locale);
                }
                break;

            case 'completed':
                // Сессия завершена, игнорируем
                this.logger.log(`Media group received but session already completed for user ${telegramId}`);
                break;
        }
    }

    /**
     * Добавляет фото ладони в сессию без отправки промежуточных сообщений
     * @param user - объект пользователя
     * @param session - сессия пользователя
     * @param fileId - ID фото в Telegram
     */
    private async addPalmPhotoToSession(user: any, session: any, fileId: string): Promise<void> {
        session.palmPhotos.push(fileId);
        session.photos.push(fileId);
        this.logger.log(`Palm photo ${session.palmPhotos.length} added to session for user ${user.id}`);
    }

    /**
     * Обрабатывает фото лица (первый этап)
     * @param ctx - контекст Telegram (может быть null для media groups)
     * @param user - объект пользователя
     * @param session - сессия пользователя
     * @param fileId - ID фото в Telegram
     * @param locale - язык пользователя
     */
    private async handleFacePhoto(
        ctx: Context | null,
        user: any,
        session: any,
        fileId: string,
        locale: string,
        isFromMediaGroup: boolean = false,
    ): Promise<void> {
        this.logger.log(`Face photo received for user ${user.id}`);

        // Отправляем сообщение только если есть контекст (не для media groups)
        if (ctx && !isFromMediaGroup) {
            const {Markup} = await import('telegraf');
            const skipButton = await this.i18nService.tAsync('scenes.analysis.skip_palms_button', locale);
            const backButton = await this.i18nService.tAsync('onboarding.backButton');

            const fileUrl = (await ctx.telegram.getFileLink(fileId)).href;

            const {rating} = await this.openaiService.validateFacePhoto(fileUrl);

            if (rating < 1) {
                await ctx.reply(await this.i18nService.tAsync('errors.face_photo_validation_failed', user.language?.toLowerCase() || 'ru'));
                return;
            }

            session.facePhoto = fileId;
            session.photos.push(fileId);
            session.stage = 'waiting_palms';

            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback(skipButton, 'skip_palms')],
                [Markup.button.callback(backButton, 'face_back')]
            ]);

            await ctx.reply(await this.i18nService.tAsync('scenes.analysis.send_palms_optional', locale), {
                parse_mode: 'HTML',
                reply_markup: keyboard.reply_markup,
            });
        }
    }

    /**
     * Обрабатывает фото ладони (второй этап)
     * @param ctx - контекст Telegram
     * @param user - объект пользователя
     * @param session - сессия пользователя
     * @param fileId - ID фото в Telegram
     * @param locale - язык пользователя
     */
    private async handlePalmPhoto(ctx: Context, user: any, session: any, fileId: string, locale: string): Promise<void> {
        // Добавляем фото ладони
        session.palmPhotos.push(fileId);
        session.photos.push(fileId);

        this.logger.log(`Palm photo ${session.palmPhotos.length} received for user ${user.id}`);

        if (session.palmPhotos.length === 1) {
            // Получили первую ладонь, предлагаем добавить вторую или завершить
            const {Markup} = await import('telegraf');
            const skipButton = await this.i18nService.tAsync('scenes.analysis.skip_second_palm_button', locale);
            const completeButton = await this.i18nService.tAsync('scenes.analysis.complete_analysis_button', locale);

            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback(completeButton, 'complete_analysis')],
                [Markup.button.callback(skipButton, 'send_second_palm')],
            ]);

            await ctx.reply(await this.i18nService.tAsync('scenes.analysis.send_second_palm_optional', locale), {
                parse_mode: 'HTML',
                reply_markup: keyboard.reply_markup,
            });
        } else if (session.palmPhotos.length >= 2) {
            // Получили две ладони, автоматически завершаем
            await this.completePhotoAnalysis(ctx, user, session, locale);
        }
    }

    /**
     * Завершает сбор фотографий и сохраняет их без запуска анализа
     * @param ctx - контекст Telegram (может быть null для media groups)
     * @param user - объект пользователя
     * @param session - сессия пользователя
     * @param locale - язык пользователя
     */
    private async completePhotoAnalysis(ctx: Context | null, user: any, session: any, locale: string): Promise<void> {
        try {
            session.stage = 'completed';

            // Сохраняем фотографии в UserInfo без запуска анализа
            let userInfo = await this.userInfoService.getLatest(user.id);
            if (!userInfo) {
                this.logger.log(`UserInfo not found for user ${user.id} during photo saving, creating new one`);
                userInfo = await this.userInfoService.create({
                    userId: user.id,
                    surveyAnswers: JSON.stringify({}),
                    surveyProgress: 0,
                    description: '',
                    feelings: '',
                    blockHypothesis: '',
                    photoUrls: JSON.stringify(session.photos), // Сохраняем URL фотографий
                } as any);
            } else {
                // Обновляем существующий UserInfo с фотографиями
                await this.userInfoService.update(userInfo.id, {
                    photoUrls: JSON.stringify(session.photos),
                } as any);
            }

            this.logger.log(
                `✅ Photos saved for user ${user.id}, photos: ${session.photos.length}, photoUrls updated in UserInfo`,
            );

            this.logger.log(`📷 PHOTO UPLOAD COMPLETE - NO ANALYSIS TRIGGERED`);
            this.logger.log(`⚠️  Analysis will be triggered ONLY after psychology test completion`);
            this.logger.log(`🔄 Setting pipeline state to READY_TO_START_SURVEY for user ${user.id}`);

            // Устанавливаем состояние воронки "сделал первый фото анализ"
            await this.userService.markFirstPhotoAnalysis(user.id);

            // Устанавливаем состояние готовности к опросу (анализ произойдет после опроса)
            await this.userService.updateUser(user.id, {
                pipelineState: 'READY_TO_START_SURVEY' as any,
            });

            // Отправляем промежуточное сообщение с кнопкой готовности
            if (ctx) {
                await this.sendReadyToSurveyMessage(ctx, user.id, locale);
                this.logger.log(`🚀 User ${user.id} received ready-to-survey message`);
            } else {
                // Для media groups (когда ctx = null) состояние установлено, переход произойдет при следующем взаимодействии
                this.logger.log(`User ${user.id} state is READY_TO_START_SURVEY, ready for next interaction`);
            }
        } catch (error) {
            this.logger.error('Failed to save photos', error);

            // Возвращаем состояние обратно для повторной попытки
            await this.userService.updateUser(user.id, {
                pipelineState: 'WAITING_PHOTOS',
            });

            if (ctx) {
                const locale = getLocaleFromLanguage(user.language);
                await ctx.reply(await this.i18nService.tAsync('errors.analysis_creation_failed', locale));
            }
        } finally {
            // Очищаем сессию
            const telegramId = ctx?.from?.id?.toString() || user.telegramId;
            if (telegramId) {
                this.userSessions.delete(telegramId);
            }
        }
    }

    /**
     * Обрабатывает нажатие кнопки "Пропустить ладони"
     * @param ctx - контекст Telegram
     */
    async handleSkipPalms(ctx: Context): Promise<void> {
        // Получаем telegramId из разных источников в зависимости от типа события
        let telegramId: string | undefined;

        if (ctx.callbackQuery && 'from' in ctx.callbackQuery) {
            telegramId = ctx.callbackQuery.from.id.toString();
        } else if (ctx.from?.id) {
            telegramId = ctx.from.id.toString();
        }

        if (!telegramId) {
            this.logger.error('handleSkipPalms: No telegramId in context');
            return;
        }

        this.logger.log(`handleSkipPalms: Processing for user ${telegramId}`);

        const user = await this.userService.findUserInfoByTeleramId(telegramId);
        if (!user) {
            this.logger.error(`handleSkipPalms: User not found for telegramId ${telegramId}`);
            return;
        }

        this.logger.log(`handleSkipPalms: User found, pipelineState: ${user.pipelineState}`);

        // Проверяем состояние пользователя - должен быть в режиме ожидания фотографий
        if (user.pipelineState !== 'WAITING_PHOTOS') {
            this.logger.warn(
                `handleSkipPalms: User ${telegramId} not in WAITING_PHOTOS state (current: ${user.pipelineState}), ignoring`,
            );

            // Отправляем сообщение пользователю о том, что действие недоступно
            const locale = getLocaleFromLanguage(user.language);
            await ctx.reply(await this.i18nService.tAsync('errors.generic_error', locale));
            return;
        }

        const session = this.userSessions.get(telegramId);
        if (!session || session.stage !== 'waiting_palms') {
            this.logger.warn(
                `handleSkipPalms: Invalid session state for user ${telegramId}, session: ${JSON.stringify(session)}`,
            );

            // Пытаемся создать сессию с фото лица если её нет
            if (!session) {
                this.logger.log(`handleSkipPalms: Creating fallback session for user ${telegramId}`);
                this.userSessions.set(telegramId, {
                    photos: [],
                    stage: 'waiting_palms',
                    palmPhotos: [],
                    facePhoto: 'fallback_face_photo', // Placeholder, так как мы не знаем актуальное фото
                });

                const newSession = this.userSessions.get(telegramId);
                this.logger.log(`handleSkipPalms: Created fallback session: ${JSON.stringify(newSession)}`);
            } else {
                // Если сессия есть, но неправильная стадия, принудительно переводим в waiting_palms
                session.stage = 'waiting_palms';
                this.logger.log(`handleSkipPalms: Fixed session stage to waiting_palms`);
            }
        }

        const finalSession = this.userSessions.get(telegramId);
        const locale = getLocaleFromLanguage(user.language);

        this.logger.log(`handleSkipPalms: About to delete previous message and complete analysis for user ${telegramId}`);

        // Удаляем сообщение с кнопками
        await this.safeDeletePreviousMessage(ctx);

        // Завершаем анализ только с фото лица
        await this.completePhotoAnalysis(ctx, user, finalSession, locale);

        this.logger.log(`handleSkipPalms: Completed processing for user ${telegramId}`);
    }

    /**
     * Обрабатывает нажатие кнопки "Завершить анализ" (после первой ладони)
     * @param ctx - контекст Telegram
     */
    async handleCompleteAnalysis(ctx: Context): Promise<void> {
        // Получаем telegramId из разных источников в зависимости от типа события
        let telegramId: string | undefined;

        if (ctx.callbackQuery && 'from' in ctx.callbackQuery) {
            telegramId = ctx.callbackQuery.from.id.toString();
        } else if (ctx.from?.id) {
            telegramId = ctx.from.id.toString();
        }

        if (!telegramId) {
            this.logger.error('handleCompleteAnalysis: No telegramId in context');
            return;
        }

        this.logger.log(`handleCompleteAnalysis: Processing for user ${telegramId}`);

        const user = await this.userService.findUserInfoByTeleramId(telegramId);
        if (!user) {
            this.logger.error(`handleCompleteAnalysis: User not found for telegramId ${telegramId}`);
            return;
        }

        this.logger.log(`handleCompleteAnalysis: User found, pipelineState: ${user.pipelineState}`);

        // Проверяем состояние пользователя - должен быть в режиме ожидания фотографий
        if (user.pipelineState !== 'WAITING_PHOTOS') {
            this.logger.warn(
                `handleCompleteAnalysis: User ${telegramId} not in WAITING_PHOTOS state (current: ${user.pipelineState}), ignoring`,
            );

            // Отправляем сообщение пользователю о том, что действие недоступно
            const locale = getLocaleFromLanguage(user.language);
            await ctx.reply(await this.i18nService.tAsync('errors.generic_error', locale));
            return;
        }

        const session = this.userSessions.get(telegramId);
        if (!session || session.stage !== 'waiting_palms') {
            this.logger.warn(
                `handleCompleteAnalysis: Invalid session state for user ${telegramId}, session: ${JSON.stringify(session)}`,
            );

            // Отправляем сообщение об ошибке
            const locale = getLocaleFromLanguage(user.language);
            await ctx.reply(await this.i18nService.tAsync('errors.generic_error', locale));
            return;
        }

        const locale = getLocaleFromLanguage(user.language);

        this.logger.log(
            `handleCompleteAnalysis: About to delete previous message and complete analysis for user ${telegramId}`,
        );

        // Удаляем сообщение с кнопками
        await this.safeDeletePreviousMessage(ctx);

        // Завершаем анализ с имеющимися фотографиями
        await this.completePhotoAnalysis(ctx, user, session, locale);

        this.logger.log(`handleCompleteAnalysis: Completed processing for user ${telegramId}`);
    }

    /**
     * Устаревший метод - используется handlePhotoMessage для основной логики
     * Оставлен для совместимости со старым кодом
     * @deprecated Используйте handlePhotoMessage вместо этого метода
     */
    async handlePhoto(ctx: Context, userId: string, photos: any[]): Promise<void> {
        this.logger.warn(`handlePhoto method is deprecated, redirecting to handlePhotoMessage for user ${userId}`);

        // Проксируем вызов к основному методу handlePhotoMessage
        // В реальном контексте photos будут обрабатываться через отдельные сообщения
        return;
    }

    /**
     * Отправляет сообщение о готовности начать опрос
     * @param ctx - контекст Telegram
     * @param userId - ID пользователя
     * @param locale - язык пользователя
     */
    private async sendReadyToSurveyMessage(ctx: Context, userId: string, locale: string): Promise<void> {
        try {
            const {Markup} = await import('telegraf');
            const readyButton = await this.i18nService.tAsync('onboarding.readyToStartButton', locale);

            const keyboard = Markup.inlineKeyboard([[Markup.button.callback(readyButton, 'ready_to_start_survey')]]);

            await ctx.reply(await this.i18nService.tAsync('onboarding.readyToStartSurvey', locale), {
                parse_mode: 'HTML',
                reply_markup: keyboard.reply_markup,
            });

            this.logger.log(`Ready-to-survey message sent to user ${userId}`);
        } catch (error) {
            this.logger.error(`Error sending ready-to-survey message: ${error.message}`, error.stack);
        }
    }

    /**
     * Очищает сессию фотографий для пользователя
     * Используется при ошибках анализа для сброса состояния
     * @param telegramId - ID пользователя в Telegram
     */
    public clearUserSession(telegramId: string): void {
        if (this.userSessions.has(telegramId)) {
            this.userSessions.delete(telegramId);
            this.logger.log(`Photo session cleared for user ${telegramId}`);
        }
    }

    /**
     * Получает количество фотографий в сессии пользователя
     * @param telegramId - ID пользователя в Telegram
     * @returns количество фотографий в сессии
     */
    public getUserSessionPhotoCount(telegramId: string): number {
        const session = this.userSessions.get(telegramId);
        return session ? session.photos.length : 0;
    }

    // ----- Заглушки для совместимости со старым BotService -----
    async handlePaginationCallback(): Promise<void> {
    }

    async handleAnalysisTypeSelection(): Promise<void> {
    }

    async handleOnboardingAnalysisTypeSelection(): Promise<void> {
    }

    async handleAddMorePhotos(): Promise<void> {
    }

    async handleStartAnalysis(): Promise<void> {
    }

    async handleSkipSecondPhoto(): Promise<void> {
    }
}
