import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { AnalyzeService } from 'src/core/modules/analyze/analyze.service';
import { ConfigService } from 'src/core/modules/config/config.service';
import { OpenAIService } from 'src/core/modules/llm/openai/openai.service';
import { WhisperService } from 'src/core/modules/llm/whisper/whisper.service';
import { TelegramService } from 'src/core/modules/telegram/telegram.service';
import { UserInfoService } from 'src/core/modules/user-info/user-info.service';
import { UserService } from 'src/core/modules/user/user.service';
import { Context, Markup } from 'telegraf';
import { I18nService } from '../i18n/i18n.service';
import { getLocaleFromLanguage } from '../utils/language';
import { TypingStatusUtil } from '../utils/typing-status.util';
import { SubscriptionHandler } from './subscription.handler';
import { Analyze, UserPipelineState } from '@prisma/client';
import { DeepSeekService } from 'src/core/modules/llm/deepseek/deepseek.service';

/**
 * Обработчик онбординга пользователей
 * Отвечает за пошаговое ведение пользователя через процесс знакомства с ботом
 */
@Injectable()
export class OnboardingHandler {
  private readonly logger = new Logger(OnboardingHandler.name);
  private readonly MAX_RETRY_COUNT: number = 2;

  constructor(
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
    private readonly userInfoService: UserInfoService,
    private readonly whisperService: WhisperService,
    private readonly openaiService: OpenAIService,
    private readonly telegramService: TelegramService,
    private readonly configService: ConfigService,
    private readonly typingStatusUtil: TypingStatusUtil,
    private readonly subscriptionHandler: SubscriptionHandler,
    private readonly analyzeService: AnalyzeService,
    private readonly deepSeekService: DeepSeekService
  ) { }

  /**
   * Безопасно удаляет предыдущее сообщение перед отправкой нового
   * Исключение: сообщения с мини-аппом не удаляются
   * @param ctx - Контекст Telegram
   * @param isReplyToMiniApp - флаг, указывающий что это ответ после мини-аппа (не удалять)
   */
  private async safeDeletePreviousMessage(ctx: Context, isReplyToMiniApp: boolean = false): Promise<void> {
    // Не удаляем сообщение если это ответ после мини-аппа
    if (isReplyToMiniApp) {
      return;
    }

    try {
      if (ctx.callbackQuery && 'message' in ctx.callbackQuery && ctx.callbackQuery.message) {
        // Если это callback query, удаляем сообщение с кнопкой
        await ctx.deleteMessage();
        this.logger.log('Previous message deleted successfully (callback)');
      } else if (ctx.chat?.id) {
        // Для обычных сообщений пытаемся удалить предыдущее по messageId
        // Это более сложная логика, пока оставляем простое решение
        this.logger.log('Previous message deletion skipped (regular message)');
      }
    } catch (error) {
      // Ошибки удаления не критичны - сообщение могло быть уже удалено
      this.logger.warn(`Failed to delete previous message: ${error.message}`);
    }
  }

  /**
   * Отправляет следующее сообщение онбординга
   * Переходим к запросу чувств (анализ происходит асинхронно в фоне)
   * @param ctx - Контекст Telegram
   * @param userId - ID пользователя
   */
  async sendNextOnboardingMessage(ctx: Context, userId: string): Promise<void> {
    try {
      const user = await this.userService.findUserById(userId);
      if (!user) {
        this.logger.error(`User not found: ${userId}`);
        return;
      }

      // Запускаем диагностический опрос
      await this.startSurvey(ctx, userId);

      this.logger.log(`Next onboarding message sent to user ${userId}`);
    } catch (error) {
      this.logger.error(`Error sending next onboarding message: ${error.message}`, error.stack);

      // Отправляем общее сообщение об ошибке
      try {
        await ctx.reply(await this.i18nService.tAsync('errors.general', 'ru'));
      } catch (replyError) {
        this.logger.error(`Failed to send error message: ${replyError.message}`);
      }
    }
  }

  /**
   * Отправляет сообщение о готовности начать опрос
   * @param ctx - Контекст Telegram
   * @param userId - ID пользователя
   */
  async sendReadyToSurveyMessage(ctx: Context, userId: string): Promise<void> {
    try {
      const user = await this.userService.findUserById(userId);
      if (!user) return;

      const locale = getLocaleFromLanguage(user.language);

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
   * Запускает диагностический опрос пользователя
   */
  async startSurvey(ctx: Context, userId: string): Promise<void> {
    try {
      const user = await this.userService.findUserById(userId);
      if (!user) return;

      // Удаляем предыдущее сообщение перед отправкой нового
      await this.safeDeletePreviousMessage(ctx);

      // Инициализируем опрос в UserInfo, создаем если нет
      let userInfo = await this.userInfoService.getLatest(userId);
      if (!userInfo) {
        this.logger.log(`UserInfo not found for user ${userId} during survey start, creating new one`);
        userInfo = await this.userInfoService.create({
          userId: userId,
          surveyAnswers: JSON.stringify({}),
          surveyProgress: 0,
          description: '',
          feelings: '',
          blockHypothesis: '',
        } as any);
        this.logger.log(`Created new UserInfo for user ${userId}: ${userInfo.id}`);
      } else {
        await this.userInfoService.update(userInfo.id, {
          surveyAnswers: JSON.stringify({}),
          surveyProgress: 0,
        } as any);
      }

      // Обновляем состояние на опрос в процессе
      await this.userService.updateUser(userId, {
        pipelineState: 'SURVEY_IN_PROGRESS' as any,
      });

      // Отправляем первый вопрос
      await this.sendSurveyQuestion(ctx, userId, 1);

      this.logger.log(`Survey started for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error starting survey: ${error.message}`, error.stack);
    }
  }

  /**
   * Отправляет вопрос диагностического опроса
   * @param ctx - Контекст Telegram
   * @param userId - ID пользователя
   * @param questionNumber - Номер вопроса (1-4)
   */
  async sendSurveyQuestion(ctx: Context, userId: string, questionNumber: number): Promise<void> {
    try {
      const user = await this.userService.findUserById(userId);
      if (!user) return;

      const locale = getLocaleFromLanguage(user.language);

      // Определяем контент вопроса
      const questions = {
        1: {
          text: await this.i18nService.tAsync('onboarding.survey.q1.text', locale),
          options: [
            {
              text: await this.i18nService.tAsync('onboarding.survey.q1.options.0', locale),
              callback: 'survey_q1_1',
            },
            {
              text: await this.i18nService.tAsync('onboarding.survey.q1.options.1', locale),
              callback: 'survey_q1_2',
            },
            {
              text: await this.i18nService.tAsync('onboarding.survey.q1.options.2', locale),
              callback: 'survey_q1_3',
            },
            {
              text: await this.i18nService.tAsync('onboarding.survey.q1.options.3', locale),
              callback: 'survey_q1_4',
            },
          ],
        },
        2: {
          text: await this.i18nService.tAsync('onboarding.survey.q2.text', locale),
          options: [
            {
              text: await this.i18nService.tAsync('onboarding.survey.q2.options.0', locale),
              callback: 'survey_q2_1',
            },
            {
              text: await this.i18nService.tAsync('onboarding.survey.q2.options.1', locale),
              callback: 'survey_q2_2',
            },
            {
              text: await this.i18nService.tAsync('onboarding.survey.q2.options.2', locale),
              callback: 'survey_q2_3',
            },
            {
              text: await this.i18nService.tAsync('onboarding.survey.q2.options.3', locale),
              callback: 'survey_q2_4',
            },
            {
              text: await this.i18nService.tAsync('onboarding.survey.q2.options.4', locale),
              callback: 'survey_q2_5',
            },
          ],
        },
        3: {
          text: await this.i18nService.tAsync('onboarding.survey.q3.text', locale),
            options: []
        },
        4: {
          text: await this.i18nService.tAsync('onboarding.survey.q4.text', locale),
          options: [
            {
              text: await this.i18nService.tAsync('onboarding.survey.q4.options.0', locale),
              callback: 'survey_q4_1',
            },
            {
              text: await this.i18nService.tAsync('onboarding.survey.q4.options.1', locale),
              callback: 'survey_q4_2',
            },
            {
              text: await this.i18nService.tAsync('onboarding.survey.q4.options.2', locale),
              callback: 'survey_q4_3',
            },
            {
              text: await this.i18nService.tAsync('onboarding.survey.q4.options.3', locale),
              callback: 'survey_q4_4',
            },
            {
              text: await this.i18nService.tAsync('onboarding.survey.q4.options.4', locale),
              callback: 'survey_q4_5',
            },
          ],
        },
      };

      const question = questions[questionNumber];
      if (!question) return;

      // Создаём кнопки для ответов
      const answerButtons = question.options.map((option) => Markup.button.callback(option.text, option.callback));

      // Разбиваем кнопки по 1 в ряд для лучшего отображения
      const keyboardRows = answerButtons.map((button) => [button]);

      // Добавляем кнопку "Назад" для вопросов 2-4
      if (questionNumber > 1) {
        const backButtonText = await this.i18nService.tAsync('onboarding.backToQuestionButton', locale);
        const backButton = Markup.button.callback(`${backButtonText}`, `survey_back_to_q${questionNumber - 1}`);
        keyboardRows.push([backButton]);
      } else {
        const backButtonText = await this.i18nService.tAsync('onboarding.backToQuestionButton', locale);
        const backButton = Markup.button.callback(`${backButtonText}`, `survey_restart`);
        keyboardRows.push([backButton]);
      }

      const keyboard = Markup.inlineKeyboard(keyboardRows);

      await ctx.reply(question.text, {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup,
      });

      this.logger.log(`Survey question ${questionNumber} sent to user ${userId} with navigation`);
    } catch (error) {
      this.logger.error(`Error sending survey question: ${error.message}`, error.stack);
    }
  }

  /**
   * Обрабатывает ответ на вопрос диагностического опроса
   * @param ctx - Контекст Telegram (может быть null для кастомных ответов)
   * @param userId - ID пользователя
   * @param questionNumber - Номер вопроса
   * @param answerIndex - Индекс ответа
   * @param isCustom - Является ли ответ пользовательским
   * @param customText - Текст кастомного ответа (если isCustom = true)
   */
  async handleSurveyAnswer(
    ctx: Context | null,
    userId: string,
    questionNumber: number,
    answerIndex: number,
    isCustom: boolean = false,
    customText?: string,
  ): Promise<void> {
    try {
      const user = await this.userService.findUserById(userId);
      if (!user) return;

      // Если это кастомный ответ без текста - ошибка (больше не используется)
      if (isCustom && !customText) {
        this.logger.error(`Custom answer requested without text for user ${userId}, question ${questionNumber}`);
        return;
      }

      // Сохраняем ответ в UserInfo, создаем если нет
      let userInfo = await this.userInfoService.getLatest(userId);
      if (!userInfo) {
        this.logger.log(`UserInfo not found for user ${userId} during survey answer, creating new one`);
        userInfo = await this.userInfoService.create({
          userId: userId,
          surveyAnswers: JSON.stringify({}),
          surveyProgress: 0,
          description: '',
          feelings: '',
          blockHypothesis: '',
        } as any);
        this.logger.log(`Created new UserInfo for user ${userId}: ${userInfo.id}`);
      }

      const surveyAnswers = JSON.parse((userInfo as any).surveyAnswers || '{}');

      // Определяем текст ответа для читаемости
      const locale = getLocaleFromLanguage(user.language);
      const answerText =
        isCustom && customText ? customText : await this.getAnswerText(questionNumber, answerIndex, isCustom, locale);

      surveyAnswers[`question${questionNumber}`] = {
        answerIndex,
        isCustom,
        answerText,
        timestamp: new Date().toISOString(),
      };

      await this.userInfoService.update(userInfo.id, {
        surveyAnswers: JSON.stringify(surveyAnswers),
        surveyProgress: questionNumber,
      } as any);

      this.logger.log(
        `Survey answer saved: user ${userId}, question ${questionNumber}, answer ${answerIndex}, custom: ${isCustom}`,
      );

      // Удаляем предыдущее сообщение с вопросом (только если есть контекст)
      if (ctx) {
        await this.safeDeletePreviousMessage(ctx);
      }

      // Возвращаемся к состоянию опроса в процессе
      await this.userService.updateUser(userId, {
        pipelineState: 'SURVEY_IN_PROGRESS' as any,
      });

      // Переходим к следующему вопросу или завершаем опрос
      if (ctx) {
        if (questionNumber < 4) {
          await this.sendSurveyQuestion(ctx, userId, questionNumber + 1);
        } else {
          await this.sendVoiceQuestion(ctx, userId);
        }
      } else {
        this.logger.warn(`No context available for user ${userId} to send next question/voice prompt`);
      }
    } catch (error) {
      this.logger.error(`Error handling survey answer: ${error.message}`, error.stack);
    }
  }

  async handleBackStartSurvey(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from.id.toString();

      const user = await this.userService.findUserByTelegramId(telegramId);


      await this.userService.updateUser(user.id, {
        pipelineState: UserPipelineState.WAITING_PHOTOS
      })

      const locale = getLocaleFromLanguage(user.language);
      const name =
        user.telegramUsername ||
        (await this.i18nService.translateAsync('common.default_user', getLocaleFromLanguage(user.language)));

      await ctx.reply(await this.i18nService.tAsync('greeting.auto_registered', locale, {
        name,
      }), { parse_mode: 'HTML' })
    } catch (e) {
      this.logger.error('Errir in start survey');
    }
  }

  /**
   * Отправляет финальный голосовой вопрос
   */
  async sendVoiceQuestion(ctx: Context, userId: string): Promise<void> {
    try {
      const user = await this.userService.findUserById(userId);
      if (!user) return;

      // Устанавливаем состояние воронки "прошел психологический тест"
      // (пользователь завершил 4 вопроса диагностического опроса)
      await this.userService.markPsyTestPassed(userId);

      this.logger.log(`📍 About to update pipeline state to WAITING_VOICE_SURVEY for user ${userId}`);

      // Обновляем состояние
      await this.userService.updateUser(userId, {
        pipelineState: 'WAITING_VOICE_SURVEY' as any,
      });

      this.logger.log(`✅ Pipeline state updated to WAITING_VOICE_SURVEY for user ${userId}`);

      const locale = getLocaleFromLanguage(user.language);
      const voiceQuestionText = await this.i18nService.tAsync('onboarding.voice_question', locale);

      // Добавляем кнопку "Назад к 4-му вопросу"
      const backToQuestionButtonText = await this.i18nService.tAsync('onboarding.backToQuestionButton', locale);
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`${backToQuestionButtonText}`, 'survey_back_to_q4')],
      ]);

      await ctx.reply(voiceQuestionText, {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup,
      });

      this.logger.log(`Voice question sent to user ${userId}`);
    } catch (error) {
      this.logger.error(`Error sending voice question: ${error.message}`, error.stack);
    }
  }

  /**
   * Определяет номер текущего вопроса по прогрессу пользователя
   * @param userId - ID пользователя
   * @returns номер текущего вопроса (1-4) или null если не удалось определить
   */
  async getCurrentQuestionNumber(userId: string): Promise<number | null> {
    try {
      const userInfo = await this.userInfoService.getLatest(userId);
      if (!userInfo) {
        this.logger.warn(`UserInfo not found for user ${userId} during getCurrentQuestionNumber`);
        return 1; // По умолчанию первый вопрос
      }

      const progress = (userInfo as any).surveyProgress || 0;

      // progress показывает сколько вопросов пользователь УЖЕ прошел
      // текущий вопрос = progress + 1
      const currentQuestion = progress + 1;

      // Проверяем валидность номера вопроса
      if (currentQuestion >= 1 && currentQuestion <= 4) {
        return currentQuestion;
      }

      return null;
    } catch (error) {
      this.logger.error(`Error getting current question number for user ${userId}: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Получает текст ответа по номеру вопроса и индексу
   * @param questionNumber - Номер вопроса (1-4)
   * @param answerIndex - Индекс ответа
   * @param isCustom - Является ли ответ пользовательским
   * @param locale - Локаль пользователя (по умолчанию 'ru')
   * @returns Текст ответа
   */
  private async getAnswerText(
    questionNumber: number,
    answerIndex: number,
    isCustom: boolean,
    locale: string = 'ru',
  ): Promise<string> {
    if (isCustom) {
      return await this.i18nService.tAsync('onboarding.survey.custom_option', locale);
    }

    try {
      const optionKey = `onboarding.survey.q${questionNumber}.options.${answerIndex - 1}`;
      return await this.i18nService.tAsync(optionKey, locale);
    } catch (error) {
      this.logger.warn(`Failed to get localized answer text for q${questionNumber}.${answerIndex}: ${error.message}`);
      return await this.i18nService.tAsync('onboarding.answer_fallback', locale, { answerIndex });
    }
  }

  /**
   * Обрабатывает навигацию назад в опросе
   * @param ctx - Контекст Telegram
   * @param userId - ID пользователя
   * @param targetQuestionNumber - Номер вопроса, к которому нужно вернуться
   */
  async handleSurveyBackNavigation(ctx: Context, userId: string, targetQuestionNumber: number): Promise<void> {
    try {
      const user = await this.userService.findUserById(userId);
      if (!user) return;

      this.logger.log(`User ${userId} navigating back to question ${targetQuestionNumber}`);

      // Удаляем текущее сообщение
      await this.safeDeletePreviousMessage(ctx);

      // Получаем UserInfo для обновления прогресса, создаем если нет
      let userInfo = await this.userInfoService.getLatest(userId);
      if (!userInfo) {
        this.logger.log(`UserInfo not found for user ${userId} during back navigation, creating new one`);
        userInfo = await this.userInfoService.create({
          userId: userId,
          surveyAnswers: JSON.stringify({}),
          surveyProgress: 0,
          description: '',
          feelings: '',
          blockHypothesis: '',
        } as any);
      }

      // Обновляем прогресс опроса на предыдущий вопрос
      // Если возвращаемся к вопросу N, значит прогресс должен быть N-1
      const newProgress = Math.max(0, targetQuestionNumber - 1);
      await this.userInfoService.update(userInfo.id, {
        surveyProgress: newProgress,
      } as any);

      // Удаляем ответы на последующие вопросы из surveyAnswers
      const surveyAnswers = JSON.parse((userInfo as any).surveyAnswers || '{}');
      for (let i = targetQuestionNumber; i <= 4; i++) {
        delete surveyAnswers[`question${i}`];
      }

      await this.userInfoService.update(userInfo.id, {
        surveyAnswers: JSON.stringify(surveyAnswers),
      } as any);

      // Обновляем состояние пользователя на опрос в процессе
      await this.userService.updateUser(userId, {
        pipelineState: 'SURVEY_IN_PROGRESS' as any,
      });

      // Отправляем целевой вопрос
      await this.sendSurveyQuestion(ctx, userId, targetQuestionNumber);

      this.logger.log(`User ${userId} successfully navigated back to question ${targetQuestionNumber}`);
    } catch (error) {
      this.logger.error(`Error handling survey back navigation: ${error.message}`, error.stack);

      // При ошибке пытаемся продолжить с текущего состояния
      try {
        const user = await this.userService.findUserById(userId);
        if (user) {
          const locale = getLocaleFromLanguage(user.language);
          await ctx.reply(await this.i18nService.tAsync('errors.navigation_failed', locale));
        }
      } catch (replyError) {
        this.logger.error(`Failed to send navigation error message: ${replyError.message}`);
      }
    }
  }

  /**
   * Обрабатывает голосовое сообщение в конце опроса
   */
  async handleSurveyVoice(ctx: Context, userId: string): Promise<void> {
    const userMessageId = ctx.message.message_id;
    const chatId = ctx.chat.id;

    await ctx.telegram.deleteMessages(chatId, [userMessageId, userMessageId - 1]);

    try {
      const user = await this.userService.findUserById(userId);
      if (!user || (user.pipelineState as any) !== 'WAITING_VOICE_SURVEY') return;

      if ('voice' in ctx.message && ctx.message.voice) {
        const locale = getLocaleFromLanguage(user.language);
        const message = await ctx.reply(await this.i18nService.tAsync('onboarding.processing_voice_message', locale));
        const fileId = ctx.message.voice.file_id;

        // Загружаем голосовое сообщение
        const file = await ctx.telegram.getFile(fileId);
        const buffer = await this.telegramService.downloadFileAsBuffer(file.file_path!);

        // Транскрибируем через Whisper
        const language = user.language === 'EN' ? 'en' : 'ru';
        const voiceText = await this.whisperService.transcribeFromBuffer(buffer, 'voice.ogg', language);

        // Устанавливаем состояние воронки "поделился чувствами"
        // (пользователь отправил голосовое сообщение о своих чувствах)
        await this.userService.markFeelingsShared(userId);
        // Завершаем опрос
        await this.completeSurvey(ctx, userId, voiceText);

        await ctx.deleteMessage(message.message_id);
      }
    } catch (error) {
      this.logger.error(`Error handling survey voice message: ${error.message}`, error.stack);
      const user = await this.userService.findUserById(userId);
      const locale = getLocaleFromLanguage(user?.language || 'RU');
      await ctx.reply(await this.i18nService.tAsync('onboarding.voice_processing_error_retry', locale));
    }
  }

  /**
   * Завершает диагностический опрос и создаёт гипотезу
   */
  async completeSurvey(ctx: Context, userId: string, voiceText: string): Promise<void> {
    try {
      const user = await this.userService.findUserById(userId);
      if (!user) return;

      const locale = getLocaleFromLanguage(user.language);

      // Удаляем предыдущее сообщение
      await this.safeDeletePreviousMessage(ctx);

      // Получаем UserInfo для сохранения результатов, создаем если нет
      let userInfo = await this.userInfoService.getLatest(userId);
      if (!userInfo) {
        this.logger.log(`UserInfo not found for user ${userId}, creating new one`);
        userInfo = await this.userInfoService.create({
          userId: userId,
          surveyAnswers: JSON.stringify({}),
          surveyProgress: 0,
          description: '',
          feelings: '',
          blockHypothesis: '',
        } as any);
        this.logger.log(`Created new UserInfo for user ${userId}: ${userInfo.id}`);
      }

      // Формируем итоговый текст из ответов опроса + голосового
      const surveyAnswers = JSON.parse((userInfo as any).surveyAnswers || '{}');

      let combinedFeelings = await this.i18nService.tAsync('onboarding.survey.results_header', locale);

      for (let i = 1; i <= 4; i++) {
        const answer = surveyAnswers[`question${i}`];
        if (answer) {
          const questionTitle = await this.i18nService.tAsync(`onboarding.survey.q${i}.question_title`, locale);
          combinedFeelings += `${i}. ${questionTitle}\n`;
          combinedFeelings += `   ${await this.i18nService.tAsync('onboarding.answer_fallback', locale, {
            answerIndex: answer.answerText,
          })}: ${answer.answerText}\n\n`;
        }
      }

      const voicePrefix = await this.i18nService.tAsync('onboarding.survey.voice_message_prefix', locale);
      combinedFeelings += `${voicePrefix}${voiceText}`;

      this.logger.log(`Combined feelings created for user ${userId}: ${combinedFeelings.length} characters`);

      // Сохраняем результаты опроса как "чувства"
      await this.userInfoService.update(userInfo.id, {
        feelings: combinedFeelings,
      });

      this.logger.log(`✅ Psychology test completed for user ${userId}:`);
      this.logger.log(`📝 Survey answers: ${Object.keys(surveyAnswers).length} questions completed`);
      this.logger.log(`🎤 Voice message: ${voiceText.length} characters`);
      this.logger.log(`📊 Combined feelings data: ${combinedFeelings.length} characters`);

      // 1. ТЕПЕРЬ запускаем полный анализ в фоновом режиме С КОНТЕКСТОМ ПСИХОЛОГИЧЕСКОГО ТЕСТА
      this.logger.log(`🚀 TRIGGERING analysis with psychology test context for user ${userId}`);
      this.runFullAnalysisInBackground(userId, ctx);
      this.logger.log(`🚀 Triggered background analysis for user ${userId}`);

      // 2. Сразу отправляем кнопку для перехода в мини-приложение
      await this.handleContinueToMiniApp(ctx, userId);
    } catch (error) {
      this.logger.error(`Error completing survey: ${error.message}`, error.stack);
    }
  }

  /**
   * Асинхронно запускает полный цикл анализа в фоновом режиме.
   * @param userId - ID пользователя
   */
  private runFullAnalysisInBackground(userId: string, ctx: Context): void {
    (async () => {
      try {
        this.logger.log(`[BACKGROUND] 🚀 Starting PSYCHOLOGY-CONTEXT analysis for user ${userId}`);
        this.logger.log(`[BACKGROUND] ⚠️  Analysis triggered ONLY after psychological test completion`);

        const userInfo = await this.userInfoService.getLatest(userId);

        if (!userInfo || !(userInfo as any).photoUrls) {
          throw new Error('User info or photos not found for background analysis.');
        }

        const photoUrls = JSON.parse((userInfo as any).photoUrls);
        const surveyAnswers = JSON.parse((userInfo as any).surveyAnswers || '{}');
        const feelings = userInfo.feelings || '';

        this.logger.log(`[BACKGROUND] 📊 Psychology test context:`);
        this.logger.log(`[BACKGROUND] - Photos: ${photoUrls.length} items`);
        this.logger.log(`[BACKGROUND] - Survey answers: ${Object.keys(surveyAnswers).length} questions`);
        this.logger.log(`[BACKGROUND] - Feelings: ${feelings.length} characters`);

        // НОВЫЙ: Полный анализ в одном запросе используя промпт full.txt
        this.logger.log(`[BACKGROUND] 🔍 Single FULL analysis request WITH psychology test context`);
        const fullAnalysisResult = await this.openaiService.analyzePhotoWithFullPrompt({
          photoUrls,
          surveyAnswers,
          feelings,
          userId,
        });

        if (!fullAnalysisResult.success) {
          await this.userInfoService.update(userInfo.id, {
            luscherTestError: true
          })
          await ctx.reply(`Произошла ошибка во время анализа. Пожалуйста, обратись в поддержку @${process.env.TELEGRAM_SUPPORT_USERNAME}`)
          throw new Error(fullAnalysisResult.error || 'Full analysis failed');
        }

        this.logger.log(
          `[BACKGROUND] ✅ Full analysis completed in ONE request: fullAnswer=${fullAnalysisResult.fullAnswer.length}chars, blockHyposis=${fullAnalysisResult.blockHyposis.length}chars, summary=${fullAnalysisResult.shortSummary.length}chars`,
        );

        // // Шаг 4: Создание социальной карточки
        // let socialImagePath: string | null = null;
        // if (summaryResult.success) {
        //   try {
        //     const user = await this.userService.findUserById(userId);
        //     if (user && photoUrls.length > 0) {
        //       socialImagePath = await this.imageProcessingService.createSocialMediaImage(
        //         photoUrls[0],
        //         summaryResult.summary,
        //         user.telegramId,
        //       );
        //     }
        //   } catch (imageError) {
        //     this.logger.error(`[BACKGROUND] Failed to create social media image: ${imageError.message}`);
        //   }
        // }

        // Создаём запись в модели Analyze для совместимости с остальной системой
        this.logger.log(`[BACKGROUND] Creating Analyze record for user ${userId}`);
        const analyzeRecord = await this.analyzeService.createAnalyze({
          userId,
          type: 'DEFAULT' as any,
          inputPhotoUrl: photoUrls,
          cost: 1,
        });

        this.logger.log(`[BACKGROUND] Created Analyze record ${analyzeRecord.id} for user ${userId}`);

        // Сохранение гипотезы и summary из полного анализа в БД
        this.logger.log(`[BACKGROUND] Saving hypothesis and summary from full analysis for user ${userId}:`);
        this.logger.log(`[BACKGROUND] - blockHypothesis: ${fullAnalysisResult.blockHyposis?.substring(0, 100)}...`);
        this.logger.log(`[BACKGROUND] - summaryText: ${fullAnalysisResult.shortSummary?.substring(0, 100)}...`);
        // this.logger.log(`[BACKGROUND] - socialCardUrl: ${socialImagePath}`);

        await this.userInfoService.update(userInfo.id, {
          analysisId: analyzeRecord.id, // Связываем с созданной записью Analyze
          description: fullAnalysisResult.fullAnswer,
          blockHypothesis: fullAnalysisResult.blockHyposis,
          summaryText: fullAnalysisResult.shortSummary,
          // socialCardUrl: socialImagePath,
        } as any);

        // Обновляем запись в модели Analyze результатами анализа
        await this.analyzeService.completeAnalyze(analyzeRecord.id, {
          analysisResultText: fullAnalysisResult.fullAnswer,
          summaryText: fullAnalysisResult.shortSummary,
        });

        this.logger.log(
          `[BACKGROUND] ✅ Full analysis successful for user ${userId}, both UserInfo and Analyze updated`,
        );
      } catch (error) {
        this.logger.error(`[BACKGROUND] Analysis failed for user ${userId}: ${error.message}`, error.stack);
        // Можно добавить логику для пометки анализа как "неудачного" в БД
      }
    })().catch((err) =>
      this.logger.error(`[BACKGROUND] Unhandled exception in background analysis for user ${userId}: ${err.message}`),
    );
  }

  /**
  //  * Обрабатывает неверный ввод чувств
  //  */
  // private async handleInvalidFeelings(ctx: Context, userId: string): Promise<void> {
  //   try {
  //     const user = await this.userService.findUserById(userId);
  //     if (!user) return;

  //     const locale = getLocaleFromLanguage(user.language);

  //     // Увеличиваем счётчик неудачных попыток
  //     const attempts = (user.photoFailureAttempts || 0) + 1;
  //     await this.userService.updateUser(userId, {
  //       photoFailureAttempts: attempts,
  //     });

  //     if (attempts >= 5) {
  //       // Баним после 5 попыток
  //       await this.userService.updateUser(userId, {
  //         isBanned: true,
  //         banReason: await this.i18nService.tAsync('errors.ban_reason_multiple_failures', locale),
  //       });
  //       await ctx.reply(
  //         await this.i18nService.tAsync('errors.account_banned', locale, {
  //           supportLink: '@evernow_be',
  //         }),
  //       );
  //       return;
  //     }

  //     // Отправляем сообщение о неверном вводе
  //     const message = await this.i18nService.tAsync('onboarding.feelsMessageDeclined', locale);
  //     await ctx.reply(message, { parse_mode: 'HTML' });
  //   } catch (error) {
  //     this.logger.error(`Error handling invalid feelings: ${error.message}`, error.stack);
  //   }
  // }

  // /**
  //  * Отправляет финальное триггерное сообщение
  //  */
  // private async sendTriggerMessage(ctx: Context, userId: string, feelingsAnalysis: string): Promise<void> {
  //   try {
  //     const user = await this.userService.findUserById(userId);
  //     if (!user) return;

  //     const locale = getLocaleFromLanguage(user.language);

  //     // Отправляем триггерное сообщение
  //     const triggerMessage = await this.i18nService.tAsync('onboarding.triggerMessage', locale);

  //     // // Генерируем персонализированное сообщение
  //     // const triggerMessage = await this.deepSeekService.generateTriggerMessage(feelingsAnalysis, {
  //     //   name: user.telegramUsername,
  //     //   analysisDescription: userInfo?.description,
  //     // });

  //     // // Добавляем кнопку "Дальше"
  //     // const keyboard = Markup.inlineKeyboard([
  //     //   [Markup.button.callback(this.i18nService.t('onboarding.nextButton', locale), 'continue_to_miniapp')],
  //     // ]);

  //     await ctx.reply(triggerMessage, {
  //       parse_mode: 'HTML',
  //       // reply_markup: keyboard.reply_markup,
  //     });

  //     this.logger.log(`Trigger message with continue button sent for user ${userId}`);
  //   } catch (error) {
  //     this.logger.error(`Error sending trigger message: ${error.message}`, error.stack);
  //   }
  // }

  /**
   * Обрабатывает переход к мини-приложению с готовой гипотезой
   */
  async handleContinueToMiniApp(ctx: Context, userId: string): Promise<void> {
    try {
      const user = await this.userService.findUserById(userId);
      if (!user) return;

      const locale = getLocaleFromLanguage(user.language);

      // Получаем URL мини-приложения из конфигурации
      const miniAppUrl = this.configService.getMiniAppUrl();

      // Обновляем состояние
      await this.userService.updateUser(userId, {
        pipelineState: 'MINI_APP_OPENED',
      });

      // Отправляем кнопку для открытия мини-приложения с готовой гипотезой
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.webApp(await this.i18nService.tAsync('onboarding.miniAppButton', locale), miniAppUrl)],
      ]);

      await ctx.reply(await this.i18nService.tAsync('onboarding.miniAppMessage', locale), {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup,
      });

      this.logger.log(`Mini app button sent for user ${userId}, URL: ${miniAppUrl}`);
    } catch (error) {
      this.logger.error(`Error handling continue to mini app: ${error.message}`, error.stack);
    }
  }

  /**
   * Переходит к финальному сообщению после закрытия мини-приложения
   * Гипотеза уже создана и показана в мини-аппе
   */
  async handleMiniAppFinish(ctx: Context, userId: string): Promise<void> {
    try {
      const user = await this.userService.findUserById(userId);
      if (!user) return;

      // НЕ удаляем сообщение с кнопкой мини-аппа - оно должно оставаться
      // Используем флаг isReplyToMiniApp для предотвращения удаления
      await this.safeDeletePreviousMessage(ctx, true);

      // Устанавливаем состояние воронки "получил блок-гипотезу"
      // (гипотеза была показана в мини-аппе)
      await this.userService.markHypothesisReceived(userId);

      // Сразу переходим к финальному сообщению
      await this.sendFinalMessage(ctx, userId);

      this.logger.log(`User ${userId} completed mini-app step, moved to final message`);
    } catch (error) {
      this.logger.error(`Error processing mini app completion: ${error.message}`, error.stack);
    }
  }

  /**
   * Отправка финального сообщения с главным выводом и кнопкой "Я готов"
   */
  private async sendFinalMessage(ctx: Context, userId: string): Promise<void> {
    let user: any = null;

    try {
      user = await this.userService.findUserById(userId);
      if (!user) return;

      const locale = getLocaleFromLanguage(user.language);

      // Получаем данные пользователя включая summary
      const userInfo = await this.userInfoService.getLatest(userId);

      // Получаем базовое финальное сообщение из локализации
      const baseMessage = await this.i18nService.tAsync('onboarding.final', locale);

      // Формируем итоговое сообщение с summary в начале
      let finalMessage = baseMessage;

      if (userInfo && (userInfo as any).summaryText) {
        const mainConclusionText = await this.i18nService.tAsync('onboarding.mainConclusion', locale);
        const summarySection = `${mainConclusionText}\n${(userInfo as any).summaryText}\n\n`;
        finalMessage = summarySection + baseMessage;
      } else {
        // Если summary нет, показываем заглушку
        finalMessage = 'Анализ завершён. Готов предоставить рекомендации.';
      }

      // Создаём клавиатуру с одной кнопкой "Я готов"
      const readyButtonText = await this.i18nService.tAsync('onboarding.readyButton', locale);
      const keyboard = Markup.inlineKeyboard([[Markup.button.callback(readyButtonText, 'final_ready')]]);

      // Если есть социальная карточка - отправляем её как фото с сообщением
      if (userInfo && (userInfo as any).socialCardUrl) {
        try {
          const socialCardPath = (userInfo as any).socialCardUrl;

          if (fs.existsSync(socialCardPath)) {
            await ctx.replyWithPhoto(
              { source: socialCardPath },
              {
                caption: finalMessage,
                parse_mode: 'HTML',
                reply_markup: keyboard.reply_markup,
              },
            );
            this.logger.log(`Social card with summary conclusion sent to user ${userId}`);
          } else {
            this.logger.warn(`Social card file not found: ${socialCardPath}, sending text message`);
            // Если файл не найден, отправляем только текстовое сообщение
            await ctx.reply(finalMessage, {
              parse_mode: 'HTML',
              reply_markup: keyboard.reply_markup,
            });
          }
        } catch (photoError) {
          this.logger.error(`Error sending social card to user ${userId}: ${photoError.message}`);
          // При ошибке отправки фото, отправляем только текстовое сообщение
          await ctx.reply(finalMessage, {
            parse_mode: 'HTML',
            reply_markup: keyboard.reply_markup,
          });
        }
      } else {
        // Если нет социальной карточки - отправляем только текстовое сообщение
        await ctx.reply(finalMessage, {
          parse_mode: 'HTML',
          reply_markup: keyboard.reply_markup,
        });
        this.logger.log(`Summary conclusion message sent to user ${userId}`);
      }

      // Обновляем состояние пользователя
      await this.userService.updateUser(userId, {
        pipelineState: 'FINAL_MESSAGE_SENT',
      });

      this.logger.log(`Summary conclusion message sent to user ${userId}`);
    } catch (error) {
      this.logger.error('Error sending final message:', error);
      const locale = getLocaleFromLanguage(user?.language || 'RU');
      await ctx.reply(await this.i18nService.tAsync('errors.generic_error', locale));
    }
  }

  /**
   * Отправка второго финального сообщения с вариантами действий
   */
  async sendFinalChoicesMessage(ctx: Context, userId: string): Promise<void> {
    let user: any = null;

    try {
      user = await this.userService.findUserById(userId);
      if (!user) return;

      const locale = getLocaleFromLanguage(user.language);

      // Удаляем предыдущее сообщение с кнопкой "Я готов"
      await this.safeDeletePreviousMessage(ctx, true);

      // Получаем сообщение с вариантами из локализации
      const message = await this.i18nService.tAsync('onboarding.finalChoices', locale);

      // Создаём клавиатуру с тремя кнопками
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.switchToChat(
            await this.i18nService.tAsync('onboarding.shareWithFriendsButton', locale),
            await this.i18nService.tAsync('onboarding.shareText'),
          ),
        ],
        [
          Markup.button.callback(
            await this.i18nService.tAsync('onboarding.makeRepostButton', locale),
            'onboarding_repost',
          ),
        ],
        [
          Markup.button.callback(
            await this.i18nService.tAsync('onboarding.purchaseParticipationButton', locale),
            'onboarding_purchase',
          ),
        ],
      ]);

      // Отправляем текстовое сообщение с вариантами
      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup,
      });

      // Обновляем состояние пользователя на завершение онбординга
      await this.userService.updateUser(userId, {
        pipelineState: 'ONBOARDING_COMPLETE',
      });

      this.logger.log(`Final choices message sent to user ${userId}`);
    } catch (error) {
      this.logger.error(`Error sending final choices message: ${error.message}`, error.stack);
      const locale = getLocaleFromLanguage(user?.language || 'RU');
      await ctx.reply(await this.i18nService.tAsync('errors.generic_error', locale));
    }
  }

  /**
   * Проверяет, находится ли пользователь в процессе онбординга
   * @param userId - ID пользователя
   * @returns true, если пользователь в онбординге
   */
  async isUserInOnboarding(userId: string): Promise<boolean> {
    try {
      const user = await this.userService.findUserById(userId);
      if (!user) return false;

      // Проверяем по состоянию пайплайна
      return (
        user.pipelineState !== 'ONBOARDING_COMPLETE' && user.pipelineState !== null && user.pipelineState !== undefined
      );
    } catch (error) {
      this.logger.error(`Error checking onboarding status: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Обрабатывает текстовое сообщение как кастомный ответ во время опроса
   * @param ctx - Контекст Telegram
   * @param userId - ID пользователя
   * @param messageText - Текст сообщения от пользователя
   */
  async processSurveyCustomAnswer(ctx: Context, userId: string, messageText: string): Promise<void> {
    try {
      const user = await this.userService.findUserById(userId);
      if (!user) return;

      const locale = getLocaleFromLanguage(user.language);

      // Получаем номер текущего вопроса
      const currentQuestionNumber = await this.getCurrentQuestionNumber(userId);
      if (!currentQuestionNumber) {
        this.logger.error(`Could not determine current question for user ${userId}`);
        await ctx.reply(await this.i18nService.tAsync('errors.survey_state_error', locale));
        return;
      }

      // Валидация длины кастомного ответа
      if (messageText.length < 3) {
        await ctx.reply(await this.i18nService.tAsync('errors.custom_answer_short', locale));
        return;
      }

      if (messageText.length > 500) {
        await ctx.reply(await this.i18nService.tAsync('errors.custom_answer_long', locale));
        return;
      }

      this.logger.log(
        `Processing custom survey answer for user ${userId}, question ${currentQuestionNumber}: ${messageText}`,
      );

      // Удаляем сообщение пользователя с кастомным ответом и предыдущее сообщение бота
      if (ctx.message && 'message_id' in ctx.message && ctx.chat) {
        try {
          const userMessageId = ctx.message.message_id;
          const chatId = ctx.chat.id;
          // Удаляем сообщение пользователя и предыдущее сообщение (вопрос)
          await ctx.telegram.deleteMessages(chatId, [userMessageId, userMessageId - 1]);

          this.logger.log(`Deleted user message ${userMessageId} and bot question ${userMessageId - 1}`);
        } catch (deleteError) {
          this.logger.warn(`Failed to delete 2 messages for custom answer: ${deleteError.message}`);
        }
      }

      // Обрабатываем как кастомный ответ через существующий метод
      // handleSurveyAnswer больше не будет пытаться удалить сообщение, если это не callback_query
      await this.handleSurveyAnswer(ctx, userId, currentQuestionNumber, 0, true, messageText);

      this.logger.log(`Custom survey answer processed for user ${userId}, question ${currentQuestionNumber}`);
    } catch (error) {
      this.logger.error(`Error processing survey custom answer: ${error.message}`, error.stack);
      const user = await this.userService.findUserById(userId);
      const locale = getLocaleFromLanguage(user?.language || 'RU');
      await ctx.reply(await this.i18nService.tAsync('errors.custom_answer_processing', locale));
    }
  }

  /**
   * Обрабатывает нажатие кнопки "Поделиться с друзьями"
   */
  async handleShareWithFriends(ctx: Context): Promise<void> {
    try {
      this.logger.log('handleShareWithFriends called');
      if (!ctx.from) {
        this.logger.warn('handleShareWithFriends: no ctx.from');
        return;
      }
      const telegramId = ctx.from.id.toString();
      this.logger.log(`handleShareWithFriends: telegramId = ${telegramId}`);

      const user = await this.userService.findUserByTelegramId(telegramId);
      if (!user) {
        this.logger.warn(`handleShareWithFriends: user not found for telegramId ${telegramId}`);
        return;
      }
      this.logger.log(`handleShareWithFriends: user found, language = ${user.language}`);

      const locale = getLocaleFromLanguage(user.language);

      // Генерируем реферальную ссылку
      const botUsername = ctx.botInfo?.username || 'your_bot';
      const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;

      // Получаем количество рефералов по внутреннему userId (не telegramId)
      const referrals = await this.userService.getReferralsCount(user.id);
      this.logger.log(`handleShareWithFriends: user ${user.id} has ${referrals} referrals`);

      // Формируем сообщение
      const message = await this.i18nService.tAsync('onboarding.shareMessage', locale, {
        referralLink,
        referralCount: referrals,
      });

      // Кнопка "Назад"
      const backButtonText = await this.i18nService.tAsync('onboarding.backButton', locale);
      this.logger.log(`handleShareWithFriends: backButtonText = ${backButtonText}`);

      const keyboard = Markup.inlineKeyboard([[Markup.button.callback(backButtonText, 'action_back')]]);

      // Удаляем предыдущее финальное сообщение перед отправкой сообщения о рефералах
      await this.safeDeletePreviousMessage(ctx);

      this.logger.log('handleShareWithFriends: about to send reply');
      await ctx.reply(message, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } catch (error) {
      this.logger.error('Error handling share with friends:', error);
    }
  }

  /**
   * Обрабатывает нажатие кнопки "Сделать репост"
   */
  async handleMakeRepost(ctx: Context): Promise<void> {
    try {
      this.logger.log('handleMakeRepost called');
      if (!ctx.from) {
        this.logger.warn('handleMakeRepost: no ctx.from');
        return;
      }
      const telegramId = ctx.from.id.toString();
      this.logger.log(`handleMakeRepost: telegramId = ${telegramId}`);

      const user = await this.userService.findUserByTelegramId(telegramId);
      if (!user) {
        this.logger.warn(`handleMakeRepost: user not found for telegramId ${telegramId}`);
        return;
      }
      this.logger.log(`handleMakeRepost: user found, language = ${user.language}`);

      const locale = getLocaleFromLanguage(user.language);

      // Ссылка на видео (замените на реальную)
      const videoLink = this.configService.getRepostVideoUrl();

      // Формируем сообщение
      const message = await this.i18nService.tAsync('onboarding.repostMessage', locale, {
        videoLink,
      });

      // Кнопки "Проверить" и "Назад"
      const checkButtonText = await this.i18nService.tAsync('onboarding.repostCheckButton', locale);
      const backButtonText = await this.i18nService.tAsync('onboarding.backButton', locale);
      this.logger.log(`handleMakeRepost: checkButtonText = ${checkButtonText}, backButtonText = ${backButtonText}`);

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(checkButtonText, 'repost_check')],
        [Markup.button.callback(backButtonText, 'action_back')],
      ]);

      // Удаляем предыдущее финальное сообщение перед отправкой сообщения о репосте
      await this.safeDeletePreviousMessage(ctx);

      await ctx.reply(message, {
        parse_mode: 'HTML',
        ...keyboard,
      });

      // Устанавливаем состояние воронки "поделился видео"
      this.logger.log('handleMakeRepost: about to mark video shared');
      await this.userService.markVideoShared(user.id);
      this.logger.log('handleMakeRepost: video shared marked successfully');
    } catch (error) {
      this.logger.error('Error handling make repost:', error);
    }
  }

  /**
   * Обрабатывает нажатие кнопки "Приобрести участие"
   * Показывает доступные тарифные планы подписки для оформления
   */
  async handlePurchaseParticipation(ctx: Context): Promise<void> {
    try {
      this.logger.log('handlePurchaseParticipation called - showing subscription plans');
      if (!ctx.from) {
        this.logger.warn('handlePurchaseParticipation: no ctx.from');
        return;
      }
      const telegramId = ctx.from.id.toString();
      this.logger.log(`handlePurchaseParticipation: telegramId = ${telegramId}`);

      const user = await this.userService.findUserByTelegramId(telegramId);
      if (!user) {
        this.logger.warn(`handlePurchaseParticipation: user not found for telegramId ${telegramId}`);
        return;
      }
      this.logger.log(`handlePurchaseParticipation: user found, language = ${user.language}`);

      const locale = getLocaleFromLanguage(user.language);

      // Удаляем предыдущее финальное сообщение перед отправкой тарифных планов
      await this.safeDeletePreviousMessage(ctx);

      try {
        // Проверяем, включены ли платные подписки
        const subscriptionsEnabled = this.configService.isPaidSubscriptionsEnabled();

        if (!subscriptionsEnabled) {
          this.logger.warn('Paid subscriptions are disabled, showing fallback message');
          await this.showFallbackPurchaseMessage(ctx, user, locale);
          return;
        }

        // Логируем начало процесса оформления подписки
        this.logger.log(`User ${user.id} started subscription purchase process from onboarding`);

        // Используем SubscriptionHandler для показа тарифных планов
        // Передаем специальный контекст, чтобы после выбора плана вернуться к онбордингу
        (ctx as any).fromOnboarding = true;
        await this.subscriptionHandler.handleSubscriptionPlans(ctx);

        this.logger.log(`Subscription plans displayed for user ${user.id} from onboarding flow`);
      } catch (subscriptionError) {
        this.logger.error(`Error showing subscription plans: ${subscriptionError.message}`, subscriptionError.stack);

        // Если произошла ошибка с подписками, показываем fallback сообщение
        await this.showFallbackPurchaseMessage(ctx, user, locale);
      }
    } catch (error) {
      this.logger.error('Error handling purchase participation:', error);

      // При любой критической ошибке отправляем сообщение об ошибке
      try {
        // Получаем локаль из контекста или используем русский по умолчанию
        const userLanguage = ctx.from?.language_code === 'en' ? 'EN' : 'RU';
        const locale = getLocaleFromLanguage(userLanguage);
        await ctx.reply(await this.i18nService.tAsync('errors.general', locale));
      } catch (replyError) {
        this.logger.error(`Failed to send error message: ${replyError.message}`);
      }
    }
  }

  /**
   * Показывает резервное сообщение о покупке когда подписки недоступны
   * @param ctx - Контекст Telegram
   * @param user - Объект пользователя
   * @param locale - Локаль пользователя
   */
  private async showFallbackPurchaseMessage(ctx: Context, user: any, locale: string): Promise<void> {
    try {
      // Ссылки на документы
      const offerLink = 'https://evernow.be/oferta-bot';
      const privacyLink = 'https://evernow.be/privacy-bot';

      // Формируем сообщение о том, что подписки временно недоступны
      const message = await this.i18nService.tAsync('onboarding.purchaseUnavailable', locale, {
        offerLink,
        privacyLink,
        supportLink: '@evernow_be',
      });

      // Кнопка "Назад"
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(await this.i18nService.tAsync('onboarding.backButton', locale), 'action_back')],
      ]);

      await ctx.reply(message, {
        parse_mode: 'HTML',
        ...keyboard,
        link_preview_options: { is_disabled: true },
      });

      this.logger.log(`Fallback purchase message sent to user ${user.id}`);
    } catch (error) {
      this.logger.error(`Error showing fallback purchase message: ${error.message}`, error.stack);
    }
  }

  /**
   * Обрабатывает нажатие кнопки "Проверить" для репоста
   */
  async handleRepostCheck(ctx: Context): Promise<void> {
    try {
      if (!ctx.from) return;
      const telegramId = ctx.from.id.toString();

      const user = await this.userService.findUserByTelegramId(telegramId);
      if (!user) return;

      const locale = getLocaleFromLanguage(user.language);

      // Удаляем предыдущее сообщение о репосте перед отправкой результата проверки
      await this.safeDeletePreviousMessage(ctx);

      // Предоставляем месяц подписки
      const subscriptionResult = await this.userService.grantFreeSubscription(user.id, 'REPOST');

      if (subscriptionResult.granted) {
        // Обновляем состояние пайплайна
        await this.userService.updateUser(user.id, {
          pipelineState: 'ONBOARDING_COMPLETE',
        });

        // Проверяем и устанавливаем состояне полного прохождения воронки
        await this.userService.checkAndMarkFunnelCompleted(user.id);

        // Отправляем сообщение об успехе
        await ctx.reply(await this.i18nService.tAsync('onboarding.repostSuccessMessage', locale), {
          parse_mode: 'HTML',
        });

        this.logger.log(`User ${user.id} got free month subscription for repost`);
      } else {
        // Подписка уже была предоставлена
        await ctx.reply(await this.i18nService.tAsync('onboarding.repostAlreadyActivated', locale), {
          parse_mode: 'HTML',
        });

        this.logger.log(`User ${user.id} already has active subscription, skipping repost grant`);
      }
    } catch (error) {
      this.logger.error('Error handling repost check:', error);
    }
  }

  /**
   * Обрабатывает нажатие кнопки "Готов начать"
   */
  async handleReadyToStartSurvey(ctx: Context): Promise<void> {
    try {
      if (!ctx.from) return;
      const telegramId = ctx.from.id.toString();

      const user = await this.userService.findUserByTelegramId(telegramId);
      if (!user) return;

      this.logger.log(`User ${user.id} is ready to start survey`);

      // Удаляем сообщение с кнопкой готовности
      await this.safeDeletePreviousMessage(ctx);

      // Сразу начинаем опрос (не ждем анализа)
      await this.startSurvey(ctx, user.id);

      this.logger.log(`Survey started for user ${user.id} from ready button`);
    } catch (error) {
      this.logger.error('Error handling ready to start survey:', error);
    }
  }

  /**
   * Обрабатывает нажатие кнопки "Попробовать еще раз" при таймауте анализа
   */
  async handleRetryPhotoAnalysis(ctx: Context): Promise<void> {
    try {
      if (!ctx.from) return;
      const telegramId = ctx.from.id.toString();

      const user = await this.userService.findUserByTelegramId(telegramId);
      if (!user) return;

      this.logger.log(`User ${user.id} requests photo analysis retry`);

      const locale = getLocaleFromLanguage(user.language);

      // Удаляем сообщение с вариантами
      await this.safeDeletePreviousMessage(ctx);

      // Сбрасываем состояние пользователя на ожидание фотографий
      await this.userService.updateUser(user.id, {
        pipelineState: 'WAITING_PHOTOS',
      });

      // Очищаем предыдущий анализ если он есть
      const userInfo = await this.userInfoService.getLatest(user.id);
      if (userInfo) {
        await this.userInfoService.update(userInfo.id, {
          description: '', // Очищаем description из предыдущего анализа
        } as any);
      }

      // Отправляем сообщение о повторе
      await ctx.reply(await this.i18nService.tAsync('onboarding.retryAnalysisMessage', locale), {
        parse_mode: 'HTML',
      });

      this.logger.log(`User ${user.id} state reset to WAITING_PHOTOS for retry`);
    } catch (error) {
      this.logger.error('Error handling retry photo analysis:', error);
    }
  }

  /**
   * Обрабатывает нажатие кнопки "Продолжить без анализа" при таймауте
   */
  async handleContinueWithoutAnalysis(ctx: Context): Promise<void> {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    const user = await this.userService.findUserByTelegramId(telegramId);
    if (!user) return;

    const locale = getLocaleFromLanguage(user.language);

    try {
      this.logger.log(`User ${user.id} chooses to continue without analysis`);

      // Удаляем сообщение с вариантами
      await this.safeDeletePreviousMessage(ctx);

      // При ошибке создаем fallback гипотезу
      await ctx.reply(await this.i18nService.tAsync('errors.hypothesis_creation_failed', locale));
    } catch (error) {
      this.logger.error('Error handling continue without analysis:', error);
      try {
        const retryButton = await this.i18nService.tAsync('onboarding.retryAnalysisButton', locale);
        const keyboard = Markup.inlineKeyboard([[Markup.button.callback(retryButton, 'retry_photo_analysis')]]);

        await ctx.reply(await this.i18nService.tAsync('errors.generic_error', locale), {
          parse_mode: 'HTML',
          reply_markup: keyboard.reply_markup,
        });
      } catch (replyError) {
        this.logger.error(`Failed to send retry button: ${replyError.message}`);
      }
    }
  }

  /**
   * Обрабатывает нажатие кнопки "Назад"
   */
  async handleBackButton(ctx: Context): Promise<void> {
    try {
      if (!ctx.from) return;
      const telegramId = ctx.from.id.toString();

      // Получаем внутренний userId через поиск по telegramId
      const user = await this.userService.findUserByTelegramId(telegramId);
      if (!user) {
        this.logger.error(`handleBackButton: user not found for telegramId ${telegramId}`);
        return;
      }

      this.logger.log(`handleBackButton: user ${user.id} requesting back navigation`);

      // Удаляем текущее сообщение и возвращаем финальное
      await this.safeDeletePreviousMessage(ctx);
      await this.sendFinalMessage(ctx, user.id);

      this.logger.log(`handleBackButton: final message sent for user ${user.id}`);
    } catch (error) {
      this.logger.error('Error handling back button:', error);
    }
  }

  /**
   * Восстанавливает онбординг пользователя с того места, где он остановился
   * @param ctx - Контекст Telegram
   * @param user - Объект пользователя
   */
  async resumeOnboarding(ctx: Context, user: any): Promise<void> {
    try {
      const userId = user.id;
      const locale = getLocaleFromLanguage(user.language);

      this.logger.log(`Resuming onboarding for user ${userId} at state: ${user.pipelineState}`);

      switch (user.pipelineState) {
        case 'WELCOME_SENT':
        case 'WAITING_PHOTOS':
          // Отправляем сообщение с просьбой прислать фото
          const photoMessage = await this.i18nService.tAsync('onboarding.photoRequest', locale);
          await ctx.reply(photoMessage, { parse_mode: 'HTML' });
          break;

        case 'PHOTOS_RECEIVED':
          // Анализ не завершился успешно, запрашиваем фото повторно
          this.logger.log(`User ${userId} was in PHOTOS_RECEIVED state, requesting photos again`);

          // Сбрасываем состояние на ожидание фото
          await this.userService.updateUser(userId, { pipelineState: 'WAITING_PHOTOS' });

          // Отправляем сообщение с просьбой прислать фото
          const photoRetryMessage = await this.i18nService.tAsync('onboarding.photoRequest', locale);
          await ctx.reply(photoRetryMessage, { parse_mode: 'HTML' });
          break;

        case 'ANALYSIS_COMPLETED':
          // Вызываем существующий метод для отправки следующего сообщения
          await this.sendNextOnboardingMessage(ctx, userId);
          break;

        case 'READY_TO_START_SURVEY':
          // Пользователь готов начать опрос, отправляем промежуточное сообщение с кнопкой
          await this.sendReadyToSurveyMessage(ctx, userId);
          break;

        case 'SURVEY_IN_PROGRESS':
          // Восстанавливаем опрос на текущем вопросе
          const userInfoForSurvey = await this.userInfoService.getLatest(userId);
          const progress = (userInfoForSurvey as any)?.surveyProgress || 0;

          this.logger.log(`Resuming survey for user ${userId}: progress = ${progress}`);

          if (progress === 0) {
            // Пользователь ещё не начинал опрос - отправляем первый вопрос
            await this.sendSurveyQuestion(ctx, userId, 1);
          } else if (progress < 4) {
            // Пользователь прошёл progress вопросов, отправляем следующий
            await this.sendSurveyQuestion(ctx, userId, progress + 1);
          } else if (progress === 4) {
            // Пользователь прошёл все 4 вопроса, но состояние не обновилось - переходим к голосовому
            this.logger.log(
              `User ${userId} completed 4 questions but stuck in SURVEY_IN_PROGRESS, moving to voice question`,
            );
            await this.sendVoiceQuestion(ctx, userId);
          } else {
            // Непредвиденная ситуация - сбрасываем опрос
            this.logger.warn(`User ${userId} has unexpected survey progress: ${progress}, resetting survey`);
            await this.userInfoService.update(userInfoForSurvey.id, {
              surveyAnswers: JSON.stringify({}),
              surveyProgress: 0,
            } as any);
            await this.sendSurveyQuestion(ctx, userId, 1);
          }
          break;

        case 'WAITING_VOICE_SURVEY':
          // Пользователь находится на этапе голосового вопроса - повторно отправляем его
          this.logger.log(`Resuming voice survey for user ${userId}`);
          await this.sendVoiceQuestion(ctx, userId);
          break;

        case 'WAITING_ANALYSIS_FOR_HYPOTHESIS':
          // Пользователь ждет завершения анализа фотографий для создания гипотезы
          this.logger.log(`Resuming analysis wait for hypothesis for user ${userId}`);
          // Просто возобновляем онбординг, показывая сообщение об ожидании
          await this.resumeOnboarding(ctx, user);
          break;

        case 'WAITING_FEELINGS':
          // Устаревшее состояние - обновляем на новое и отправляем голосовой вопрос
          this.logger.log(`User ${userId} in deprecated WAITING_FEELINGS state, updating to WAITING_VOICE_SURVEY`);
          await this.userService.updateUser(userId, {
            pipelineState: 'WAITING_VOICE_SURVEY' as any,
          });
          await this.sendVoiceQuestion(ctx, userId);
          break;

        case 'WAITING_CUSTOM_ANSWER_Q1':
        case 'WAITING_CUSTOM_ANSWER_Q2':
        case 'WAITING_CUSTOM_ANSWER_Q3':
        case 'WAITING_CUSTOM_ANSWER_Q4':
          // Устаревшие состояния - переводим обратно в SURVEY_IN_PROGRESS
          this.logger.log(`User ${userId} in deprecated custom answer state, updating to SURVEY_IN_PROGRESS`);
          await this.userService.updateUser(userId, {
            pipelineState: 'SURVEY_IN_PROGRESS' as any,
          });

          // Определяем номер текущего вопроса и отправляем его
          const currentQuestionNumber = await this.getCurrentQuestionNumber(userId);
          if (currentQuestionNumber && currentQuestionNumber <= 4) {
            await this.sendSurveyQuestion(ctx, userId, currentQuestionNumber);
          } else {
            // Если не удалось определить вопрос - начинаем с первого
            await this.sendSurveyQuestion(ctx, userId, 1);
          }
          break;

        case 'MINI_APP_OPENED':
          // Повторно отправляем кнопку мини-приложения
          await this.handleContinueToMiniApp(ctx, userId);
          break;

        case 'CREATING_HYPOTHESIS':
          // Состояние больше не используется - переходим к финальному сообщению
          await this.sendFinalMessage(ctx, userId);
          break;

        case 'HYPOTHESIS_SENT':
          // Состояние больше не используется - переходим к финальному сообщению
          await this.sendFinalMessage(ctx, userId);
          break;

        case 'FINAL_MESSAGE_SENT':
          // Повторно отправляем финальное сообщение
          await this.sendFinalMessage(ctx, userId);
          break;

        case 'ONBOARDING_COMPLETE':
          // Отправляем сообщение о завершённом онбординге
          const completedMessage = await this.i18nService.tAsync('onboarding.completed', locale);
          await ctx.reply(completedMessage, { parse_mode: 'HTML' });
          break;

        default:
          // Неизвестное состояние - начинаем с начала
          this.logger.warn(`Unknown pipeline state: ${user.pipelineState} for user ${userId}`);
          await this.userService.updateUser(userId, { pipelineState: 'WAITING_PHOTOS' });
          const defaultMessage = await this.i18nService.tAsync('onboarding.photoRequest', locale);
          await ctx.reply(defaultMessage, { parse_mode: 'HTML' });
          break;
      }
    } catch (error) {
      this.logger.error(`Error resuming onboarding for user ${user.id}: ${error.message}`, error.stack);

      // При ошибке отправляем базовое сообщение
      try {
        const locale = getLocaleFromLanguage(user.language);
        const errorMessage = await this.i18nService.tAsync('errors.general', locale);
        await ctx.reply(errorMessage);
      } catch (replyError) {
        this.logger.error(`Failed to send error message: ${replyError.message}`);
      }
    }
  }

  private async handleAnalysisTimeout(ctx: Context, userId: string): Promise<void> {
    let user = await this.userService.findUserById(userId);
    if (!user) return;
    const locale = getLocaleFromLanguage(user.language);

    try {
      // Удаляем предыдущее сообщение об ожидании
      await this.safeDeletePreviousMessage(ctx);

      // Отправляем сообщение о таймауте анализа
      const message = await this.i18nService.tAsync('onboarding.analysisTimeout', locale);

      // Создаём клавиатуру с тремя кнопками
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            await this.i18nService.tAsync('onboarding.retryAnalysisButton', locale),
            'retry_analysis',
          ),
        ],
        [
          Markup.button.callback(
            await this.i18nService.tAsync('onboarding.continueWithoutAnalysisButton', locale),
            'continue_without_analysis',
          ),
        ],
      ]);

      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup,
      });

      this.logger.log(`Analysis timeout options sent to user ${userId}`);
    } catch (error) {
      this.logger.error(`Error handling analysis timeout for user ${userId}: ${error.message}`, error.stack);
      // При ошибке показа вариантов, все равно пытаемся создать fallback гипотезу
      await ctx.reply(await this.i18nService.tAsync('errors.hypothesis_creation_failed', locale));
    }
  }
}
