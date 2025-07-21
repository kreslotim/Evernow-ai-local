import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AnalyzeType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '../../config/config.service';
import { PromptService } from '../prompt/prompt.service';
import { PromptKey } from '../prompt/prompts.constants';

export interface AnalyzePhotoRequest {
  photoPaths: string[];
  analysisType: AnalyzeType;
  userId: string;
}

export interface AnalyzePhotoResponse {
  analysisResultText: string;
  summaryText: string;
  success: boolean;
  error?: string;
}

export interface AnalyzePhotoWithSurveyContextRequest {
  photoUrls: string[];
  surveyAnswers: object;
  feelings: string;
  userId: string;
}

export interface FullAnalysisResponse {
  fullAnswer: string;
  blockHyposis: string;
  shortSummary: string;
  success: boolean;
  error?: string;
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly summaryModel: string;
  private readonly useOpenRouter: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly promptService: PromptService,
  ) {
    // this.useOpenRouter = this.configService.useOpenRouter();

    // if (this.useOpenRouter) {
    //   // Настройка для OpenRouter
    //   const openRouterApiKey = this.configService.getOpenRouterApiKey();
    //   if (!openRouterApiKey) {
    //     throw new Error('OpenRouter API key not configured');
    //   }

    //   this.client = new OpenAI({
    //     apiKey: openRouterApiKey,
    //     baseURL: 'https://openrouter.ai/api/v1',
    //   });

    //   this.logger.log('Using OpenRouter for OpenAI API calls');
    // } else {
    // Прямое подключение к OpenAI
    const apiKey = this.configService.getOpenAiApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    this.client = new OpenAI({
      apiKey: apiKey,
    });

    this.logger.log('Using direct OpenAI API calls');
    // }

    // if (this.useOpenRouter) {
    //   // Используем те же модели
    //   this.model = 'openai/o3';
    //   this.summaryModel = 'openai/gpt-4.1-nano';
    // } else {
    // Для прямого OpenAI используем специальные API
    this.model = 'o3';
    this.summaryModel = 'gpt-4.1-nano';
    // }
  }

  private async getPromptForAnalysisType(analysisType: AnalyzeType): Promise<string> {
    try {
      // Для всех типов анализа используем один промпт
      const promptKey = PromptKey.OPENAI_MAIN_ANALYSIS;
      const prompt = await this.promptService.getPrompt(promptKey);

      if (!prompt) {
        throw new Error(`No prompt found for analysis type: ${analysisType}`);
      }

      return prompt;
    } catch (error) {
      this.logger.error(`Failed to load prompt for analysis type: ${analysisType}`, error);
      throw new Error(`Failed to load prompt for analysis type: ${analysisType}`);
    }
  }

  private async getSummaryPrompt(): Promise<string> {
    try {
      const prompt = await this.promptService.getPrompt(PromptKey.OPENAI_SUMMARY);

      if (!prompt) {
        throw new Error('Summary prompt not found');
      }

      return prompt;
    } catch (error) {
      this.logger.error('Failed to load summary prompt', error);
      throw new Error('Failed to load summary prompt');
    }
  }

  private encodeImageToBase64(imagePath: string): string {
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      return imageBuffer.toString('base64');
    } catch (error) {
      this.logger.error(`Failed to encode image to base64: ${imagePath}`, error);
      throw new Error('Failed to process image file');
    }
  }

  private getImageMimeType(imagePath: string): string {
    const ext = path.extname(imagePath).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      default:
        return 'image/jpeg'; // Default fallback
    }
  }

  private isRefusalResponse(text: string): boolean {
    const refusalPatterns = [
      /I'm sorry, but I can't help with that./i,
      /Извините, я не могу помочь с этим./i,
      /I cannot provide[.!?]?/i,
      /I can't analyze[.!?]?/i,
      /I'm not able to[.!?]?/i,
      /Я не могу предоставить[.!?]?/i,
      /Я не могу анализировать[.!?]?/i,
      /Я не могу помочь[.!?]?/i,
      /sorry,? (?:but )?I can't[.!?]?/i,
      /I (?:cannot|can't) (?:help|assist|analyze)[.!?]?/i,
      /unable to (?:help|assist|analyze|provide)[.!?]?/i,
      /не могу (?:помочь|анализировать|предоставить)[.!?]?/i,
    ];

    return refusalPatterns.some((pattern) => pattern.test(text));
  }

  async analyzePhoto(request: AnalyzePhotoRequest, retryCount: number = 0): Promise<AnalyzePhotoResponse> {
    try {
      this.logger.log(
        `Starting photo analysis for user ${request.userId}, type: ${request.analysisType} with ${request.photoPaths.length} photos (retry: ${retryCount})`,
      );

      const systemPrompt = await this.getPromptForAnalysisType(request.analysisType);

      // Validate all photos exist
      for (const photoPath of request.photoPaths) {
        if (!fs.existsSync(photoPath)) {
          throw new Error(`Photo file not found: ${photoPath}`);
        }
      }

      let analysisResult: string;

      // if (this.useOpenRouter) {
      //   // Используем стандартный chat.completions.create для OpenRouter
      //   this.logger.log(`🔄 Using OpenRouter with model: ${this.model}`);
      //   analysisResult = await this.analyzePhotoWithChatCompletions(request, systemPrompt);
      // } else {
      // Используем специальный responses.create для прямого OpenAI o3
      this.logger.log(`🔄 Using direct OpenAI with model: ${this.model}`);
      analysisResult = await this.analyzePhotoWithResponses(request, systemPrompt);
      // }

      if (!analysisResult) {
        throw new Error('No analysis result received from AI model');
      }

      // Check if the response is a refusal
      if (this.isRefusalResponse(analysisResult) || analysisResult.length < 1000) {
        this.logger.warn(`AI model refused to analyze photo for user ${request.userId}, attempt ${retryCount + 1}`);

        if (retryCount < 1) {
          // Retry once
          this.logger.log(`Retrying analysis for user ${request.userId}`);
          return await this.analyzePhoto(request, retryCount + 1);
        } else {
          // Failed after retry
          this.logger.error(`AI model refused analysis after retry for user ${request.userId}`);
          return {
            analysisResultText: '',
            summaryText: '',
            success: false,
            error: 'AI_REFUSAL',
          };
        }
      }

      const summaryText = analysisResult.length > 200 ? analysisResult.substring(0, 200) + '...' : analysisResult;

      this.logger.log(`Photo analysis completed for user ${request.userId} with ${request.photoPaths.length} photos`);

      return {
        analysisResultText: analysisResult,
        summaryText: summaryText,
        success: true,
      };
    } catch (error) {
      this.logger.error(`Photo analysis failed for user ${request.userId}:`, error);

      return {
        analysisResultText: '',
        summaryText: '',
        success: false,
        error: error.message || 'Analysis failed',
      };
    }
  }

  /**
   * Анализ фотографий через стандартный chat.completions API (для OpenRouter)
   */
  private async analyzePhotoWithChatCompletions(request: AnalyzePhotoRequest, systemPrompt: string): Promise<string> {
    // Prepare image content for OpenRouter
    const imageContents = [];
    for (const photoPath of request.photoPaths) {
      const base64Image = this.encodeImageToBase64(photoPath);
      const mimeType = this.getImageMimeType(photoPath);

      imageContents.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64Image}`,
        },
      });
    }

    // Build the user message content
    const userMessageContent = [
      {
        type: 'text',
        text:
          request.photoPaths.length > 1
            ? `Проанализируй эти ${request.photoPaths.length} фото согласно инструкции.`
            : 'Проанализируй это сгенерированное фото согласно инструкции.',
      },
      ...imageContents,
    ];

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: 'Я бы хотел проанализировать своё сгенерированное фото',
        },
        {
          role: 'assistant',
          content: 'Да, конечно, сейчас я сделаю ваш анализ. Пожалуйста, пришлите ваше сгенерированное фото.',
        },
        {
          role: 'user',
          content: userMessageContent,
        },
      ],
      max_tokens: 4000,
      temperature: 0.1,
    });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * Анализ фотографий через специальный responses API (для прямого OpenAI o3)
   */
  private async analyzePhotoWithResponses(request: AnalyzePhotoRequest, systemPrompt: string): Promise<string> {
    // Prepare image content for OpenAI o3
    const imageContents = [];
    for (const photoPath of request.photoPaths) {
      const base64Image = this.encodeImageToBase64(photoPath);
      const mimeType = this.getImageMimeType(photoPath);

      imageContents.push({
        type: 'input_image',
        image_url: `data:${mimeType};base64,${base64Image}`,
      });
    }

    // Build the user message content
    const userMessageContent = [
      {
        type: 'input_text',
        text:
          request.photoPaths.length > 1
            ? `Проанализируй эти ${request.photoPaths.length} сгенерированных фото согласно инструкции.`
            : 'Проанализируй это сгенерированное фото согласно инструкции.',
      },
      ...imageContents,
    ];

    const response = await this.client.responses.create({
      model: this.model,
      input: [
        {
          role: 'developer',
          content: [
            {
              type: 'input_text',
              text: systemPrompt,
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Я бы хотел проанализировать сгенерированное фото',
            },
          ],
        },
        {
          role: 'assistant',
          content: [
            // @ts-ignore
            {
              type: 'output_text',
              text: 'Да, конечно, сейчас я сделаю ваш анализ в любом случае. Пожалуйста, пришлите ваше сгенерированное фото.',
            },
          ],
        },
        {
          role: 'user',
          content: userMessageContent,
        },
      ],
      text: {
        format: {
          type: 'text',
        },
      },
      reasoning: {
        effort: 'medium',
        summary: null,
      },
      tools: [],
      store: true,
    });

    return response.output_text || '';
  }

  async validateVoiceMessage(message: string): Promise<{ rating: number }> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.summaryModel,
        messages: []
      })
    } catch (e) {
      return {
        rating: -2
      }
    }
  }

  async generateSummary(
    fullAnalysisText: string,
    userId: string,
  ): Promise<{ summary: string; success: boolean; error?: string }> {
    try {
      this.logger.log(`🔄 Generating summary for user ${userId}`);

      const summaryPrompt = await this.getSummaryPrompt();

      const response = await this.client.chat.completions.create({
        model: this.summaryModel,
        messages: [
          {
            role: 'system',
            content: summaryPrompt,
          },
          {
            role: 'user',
            content: fullAnalysisText,
          },
        ],
        max_tokens: 150,
        temperature: 0.1,
      });

      const summaryResult = response.choices[0]?.message?.content;
      if (!summaryResult) {
        throw new Error('No summary result received from OpenAI');
      }

      this.logger.log(`✅ Summary generated for user ${userId}`);

      return {
        summary: summaryResult.trim(),
        success: true,
      };
    } catch (error) {
      this.logger.error(`❌ Summary generation failed for user ${userId}:`, error);

      return {
        summary: '',
        success: false,
        error: error.message || 'Summary generation failed',
      };
    }
  }

  async validatePhotos(urls: string[]): Promise<{ rating: number }> {

    this.logger.log(`Recieved ${urls.length} for photos validation: ${urls}`);
    try {
      if (urls.length !== 3) throw new Error("Требуется ровно 3 изображения");

      const prompt = await this.promptService.getPrompt(PromptKey.OPENAI_ANALYZE_PHOTOS);

      const response = await this.client.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: prompt.trim()
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Оцени соответствие этих трёх изображений требованиям." },
              ...urls.map((url) => ({
                type: "image_url" as const,
                image_url: {
                  url,
                  detail: "low" as const
                }
              }))
            ]
          }
        ]
      });
      const jsonString = response.choices[0].message.content;
      const jsonMatch = jsonString.match(/{[\s\S]*?}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0].replaceAll('`', '').replaceAll('json', '').replaceAll('+', '')) : { rating: 0 };

      return parsed;
    } catch (e) {
      this.logger.error(`Cannot validate some photos: ${e}`);
      return { rating: -2 }
    }
  }

  async validateFacePhoto(url: string): Promise<{ rating: number }> {
    this.logger.log(`Recieved validation face photo url: ${url}`);
    try {
      const prompt = await this.promptService.getPrompt(PromptKey.OPENAI_ANALYZE_FACE)

      const response = await this.client.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: prompt.trim()
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Проверь, соответствует ли это фото требованиям:" },
              {
                type: "image_url",
                image_url: {
                  url,
                  detail: "low"
                }
              }
            ]
          }
        ]
      });

      const jsonText = response.choices[0].message.content?.match(/{[\s\S]*?}/)?.[0];
      console.log(response.choices[0].message);
      if (!jsonText) throw new Error("Модель не вернула JSON");

      const parsed = JSON.parse(jsonText.replaceAll('`', '').replaceAll('+', ''));
      if (typeof parsed.rating !== "number") throw new Error("Incorrect rating");

      console.log(parsed);

      return parsed;
    } catch (e) {
      this.logger.error(`Recieved an error after trying to validate a face photo: ${e}`);
      return {
        rating: -2
      }
    }
  }


  /**
   * Создаёт блок-гипотезу на основе результата анализа фотографий через модель gpt-4.1-mini
   * @param data - Данные из анализа фотографий (уменьшенная версия из analyzePhotoWithResponses)
   * @returns Блок-гипотеза
   */
  async createBlockHypothesis(data: {
    analysisDescription: string;
    feelings: string;
    feelingsAnalysis: string;
    surveyAnswers?: object; // Структурированные ответы на диагностический опрос (не используются в контексте)
  }): Promise<string> {
    try {
      this.logger.log('🔄 Creating block hypothesis via gpt-4.1-mini from photo analysis');

      const prompt = await this.promptService.getPrompt(PromptKey.OPENAI_BLOCK_HYPOTHESIS);

      // const prompt = this.promptService.replaceVariables(promptTemplate, {
      //   analysisDescription: data.analysisDescription,
      //   feelings: '', // Не используем в новом контексте
      //   feelingsAnalysis: '', // Не используем в новом контексте
      //   surveyAnswers: '', // Не используем в новом контексте
      // });

      const response = await this.client.chat.completions.create({
        model: 'gpt-4.1-mini', // Используем gpt-4.1-mini как указал пользователь
        messages: [
          {
            role: 'system',
            content: prompt,
          },
          {
            role: 'user',
            content: `На основе этого анализа создай краткую блок-гипотезу:\n\n${data.analysisDescription}`,
          },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      });

      const hypothesis =
        response.choices[0]?.message?.content ||
        'Вероятно, основной внутренний конфликт связан с противоречием между внешними ожиданиями и внутренними стремлениями. Это создаёт напряжение, которое блокирует реализацию истинного потенциала.';

      this.logger.log(`✅ Block hypothesis created via gpt-4.1-mini: ${hypothesis.substring(0, 100)}...`);
      return hypothesis;
    } catch (error) {
      this.logger.error(`❌ Error creating block hypothesis: ${error.message}`, error.stack);
      return 'Анализ показывает внутреннее противоречие между стремлением к достижениям и страхом выйти за рамки привычного. Ключ к росту — в принятии своей уникальности и смелости быть собой.';
    }
  }

  /**
   * Создаёт гипотезу второго порядка через модель o3
   * @param data - Данные из анализа, предыдущей гипотезы и структурированного опроса
   * @returns Гипотеза второго порядка
   */
  async createSecondOrderHypothesis(data: {
    analysisDescription: string;
    feelings: string;
    previousHypothesis: string;
    surveyAnswers?: object; // Структурированные ответы на диагностический опрос
  }): Promise<string> {
    try {
      this.logger.log('🔄 Creating second order hypothesis via OpenAI o3');

      const promptTemplate = await this.promptService.getPrompt(PromptKey.OPENAI_SECOND_ORDER_HYPOTHESIS);

      // Подготавливаем структурированные данные опроса для промпта
      const surveyData = data.surveyAnswers ? JSON.stringify(data.surveyAnswers, null, 2) : 'Нет данных опроса';

      const prompt = this.promptService.replaceVariables(promptTemplate, {
        analysisDescription: data.analysisDescription,
        feelings: data.feelings,
        previousHypothesis: data.previousHypothesis,
        surveyAnswers: surveyData,
      });

      const response = await this.client.responses.create({
        model: this.model, // o3
        input: [
          {
            role: 'developer',
            content: [
              {
                type: 'input_text',
                text: prompt,
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'text',
          },
        },
        reasoning: {
          effort: 'medium',
          summary: null,
        },
        tools: [],
        store: true,
      });

      const hypothesis =
        response.output_text ||
        'Возможно, первая гипотеза затронула лишь поверхностный слой. Похоже, истинный блок лежит не в противоречии, а в страхе потерять текущую идентичность при достижении новых высот. Это точка, где рост требует не борьбы, а принятия.';

      this.logger.log(`✅ Second order hypothesis created: ${hypothesis.substring(0, 100)}...`);
      return hypothesis;
    } catch (error) {
      this.logger.error(`❌ Error creating 2nd order hypothesis: ${error.message}`, error.stack);
      return 'Иногда первое предположение не попадает в цель. Возможно, дело не в страхе, а в поиске истинного пути, который принесет не только успех, но и гармонию. Важно прислушиваться к себе.';
    }
  }



  /**
   * Анализирует фотографии с контекстом психологического опроса
   * @param request - Данные для анализа с контекстом опроса
   * @returns Результат анализа
   */
  async analyzePhotoWithSurveyContext(request: AnalyzePhotoWithSurveyContextRequest): Promise<AnalyzePhotoResponse> {
    try {
      this.logger.log(
        `🔄 Starting photo analysis with survey context for user ${request.userId} with ${request.photoUrls.length} photos`,
      );

      const systemPrompt = await this.getPromptForAnalysisType('DEFAULT' as AnalyzeType);

      // Подготавливаем контекст из опроса
      const surveyContext = JSON.stringify(request.surveyAnswers, null, 2);
      const feelingsContext = request.feelings || '';

      // Загружаем фотографии через TelegramService
      const { TelegramService } = await import('../../telegram/telegram.service');
      const telegramService = new TelegramService(this.configService);

      const downloadedPhotoPaths: string[] = [];
      for (const photoUrl of request.photoUrls) {
        try {
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
          const uploadDir = path.join(process.cwd(), 'uploads', 'photos');
          const filePath = path.join(uploadDir, fileName);

          // Скачиваем фотографию
          const downloadedPath = await telegramService.downloadFile(photoUrl, filePath);
          downloadedPhotoPaths.push(downloadedPath);
        } catch (downloadError) {
          this.logger.error(`Failed to download photo ${photoUrl}: ${downloadError.message}`);
          throw new Error(`Failed to download photo: ${downloadError.message}`);
        }
      }

      // Validate all photos exist
      for (const photoPath of downloadedPhotoPaths) {
        if (!fs.existsSync(photoPath)) {
          throw new Error(`Photo file not found: ${photoPath}`);
        }
      }

      // Анализируем фотографии с контекстом через responses API
      const analysisResult = await this.analyzePhotoWithSurveyContextInternal(
        downloadedPhotoPaths,
        systemPrompt,
        surveyContext,
        feelingsContext,
      );

      if (!analysisResult) {
        throw new Error('No analysis result received from AI model');
      }

      // Проверяем на отказ AI
      if (this.isRefusalResponse(analysisResult) || analysisResult.length < 1000) {
        this.logger.warn(`AI model refused to analyze photo with survey context for user ${request.userId}`);
        return {
          analysisResultText: '',
          summaryText: '',
          success: false,
          error: 'AI_REFUSAL',
        };
      }

      const summaryText = analysisResult.length > 200 ? analysisResult.substring(0, 200) + '...' : analysisResult;

      this.logger.log(`✅ Photo analysis with survey context completed for user ${request.userId}`);

      return {
        analysisResultText: analysisResult,
        summaryText: summaryText,
        success: true,
      };
    } catch (error) {
      this.logger.error(`❌ Photo analysis with survey context failed for user ${request.userId}:`, error);

      return {
        analysisResultText: '',
        summaryText: '',
        success: false,
        error: error.message || 'Analysis failed',
      };
    }
  }

  /**
   * Внутренний метод для анализа фотографий с контекстом опроса
   */
  private async analyzePhotoWithSurveyContextInternal(
    photoPaths: string[],
    systemPrompt: string,
    surveyContext: string,
    feelingsContext: string,
  ): Promise<string> {
    // Подготавливаем контент изображений
    const imageContents = [];
    for (const photoPath of photoPaths) {
      const base64Image = this.encodeImageToBase64(photoPath);
      const mimeType = this.getImageMimeType(photoPath);

      imageContents.push({
        type: 'input_image',
        image_url: `data:${mimeType};base64,${base64Image}`,
      });
    }

    // Расширяем системный промпт контекстом из опроса
    const extendedPrompt = `${systemPrompt}

ДОПОЛНИТЕЛЬНЫЙ КОНТЕКСТ ИЗ ПСИХОЛОГИЧЕСКОГО ОПРОСА:

${feelingsContext}

Используй этот контекст для более глубокого и точного анализа сгенерированных фотографий. Учитывай ответы пользователя при интерпретации визуальных признаков.`;

    // Строим содержимое для пользователя
    const userMessageContent = [
      {
        type: 'input_text',
        text:
          photoPaths.length > 1
            ? `Проанализируй эти ${photoPaths.length} сгенерированных фото согласно инструкции, учитывая контекст психологического опроса.`
            : 'Проанализируй это сгенерированное фото согласно инструкции, учитывая контекст психологического опроса.',
      },
      ...imageContents,
    ];

    const response = await this.client.responses.create({
      model: this.model, // o3
      input: [
        {
          role: 'developer',
          content: [
            {
              type: 'input_text',
              text: extendedPrompt,
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Я бы хотел проанализировать сгенерированное фото с учетом контекста моего психологического состояния',
            },
          ],
        },
        {
          role: 'assistant',
          content: [
            // @ts-ignore
            {
              type: 'output_text',
              text: 'Да, конечно, сейчас я сделаю ваш углубленный анализ с учетом психологического контекста. Пожалуйста, пришлите ваше сгенерированное фото.',
            },
          ],
        },
        {
          role: 'user',
          content: userMessageContent,
        },
      ],
      text: {
        format: {
          type: 'text',
        },
      },
      reasoning: {
        effort: 'medium',
        summary: null,
      },
      tools: [],
      store: true,
    });

    return response.output_text || '';
  }

  /**
   * Полный анализ фотографий в одном запросе используя промпт full.txt
   * Возвращает JSON с fullAnswer, blockHyposis, shortSummary
   * @param request - Данные для анализа с контекстом опроса
   * @returns Результат полного анализа
   */
  async analyzePhotoWithFullPrompt(request: AnalyzePhotoWithSurveyContextRequest, retryCount: number = 0): Promise<FullAnalysisResponse> {
    try {
      this.logger.log(
        `🔄 Starting FULL analysis with survey context for user ${request.userId} with ${request.photoUrls.length} photos`,
      );

      const fullPrompt = await this.promptService.getPrompt(PromptKey.OPENAI_FULL_ANALYSIS);

      // Подготавливаем контекст из опроса для подстановки в {test}
      const surveyContext = JSON.stringify(request.surveyAnswers, null, 2);
      const feelingsContext = request.feelings || '';
      const testContext = `Ответы на психологический опрос:\n${surveyContext}\n\nОписание чувств:\n${feelingsContext}`;

      // Заменяем переменную {test} в промпте
      const processedPrompt = fullPrompt.replace('{test}', testContext);

      // Загружаем фотографии через TelegramService
      const { TelegramService } = await import('../../telegram/telegram.service');
      const telegramService = new TelegramService(this.configService);

      const downloadedPhotoPaths: string[] = [];
      for (const photoUrl of request.photoUrls) {
        try {
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
          const uploadDir = path.join(process.cwd(), 'uploads', 'photos');
          const filePath = path.join(uploadDir, fileName);

          // Скачиваем фотографию
          const downloadedPath = await telegramService.downloadFile(photoUrl, filePath);
          downloadedPhotoPaths.push(downloadedPath);
        } catch (downloadError) {
          this.logger.error(`Failed to download photo ${photoUrl}: ${downloadError.message}`);
          throw new Error(`Failed to download photo: ${downloadError.message}`);
        }
      }

      // Validate all photos exist
      for (const photoPath of downloadedPhotoPaths) {
        if (!fs.existsSync(photoPath)) {
          throw new Error(`Photo file not found: ${photoPath}`);
        }
      }

      // Подготавливаем контент изображений для o3 API
      const imageContents = [];
      for (const photoPath of downloadedPhotoPaths) {
        const base64Image = this.encodeImageToBase64(photoPath);
        const mimeType = this.getImageMimeType(photoPath);

        imageContents.push({
          type: 'input_image',
          image_url: `data:${mimeType};base64,${base64Image}`,
        });
      }

      // Строим содержимое для пользователя
      const userMessageContent = [
        {
          type: 'input_text',
          text:
            downloadedPhotoPaths.length > 1
              ? `Проанализируй эти ${downloadedPhotoPaths.length} сгенерированных фото согласно инструкции, учитывая контекст психологического опроса.`
              : 'Проанализируй это сгенерированное фото согласно инструкции, учитывая контекст психологического опроса.',
        },
        ...imageContents,
      ];

      const response = await this.client.responses.create({
        model: this.model, // o3
        input: [
          {
            role: 'developer',
            content: [
              {
                type: 'input_text',
                text: processedPrompt,
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: 'Я бы хотел получить полный анализ сгенерированного фото с учетом контекста моего психологического состояния',
              },
            ],
          },
          {
            role: 'assistant',
            content: [
              // @ts-ignore
              {
                type: 'output_text',
                text: 'Да, конечно, сейчас я сделаю ваш полный углубленный анализ с учетом психологического контекста и верну результат в формате JSON.',
              },
            ],
          },
          {
            role: 'user',
            content: userMessageContent,
          },
        ],
        text: {
          format: {
            type: 'text',
          },
        },
        reasoning: {
          effort: 'medium',
          summary: null,
        },
        tools: [],
        store: true,
      });

      const analysisResult = response.output_text || '';

      if (!analysisResult) {
        throw new Error('No analysis result received from AI model');
      }

      // Проверяем на отказ AI
      if (this.isRefusalResponse(analysisResult) || analysisResult.length < 500) {
        if (retryCount < 2) {
          this.logger.log(`Analyze retry count: ${retryCount}`)
          return await this.analyzePhotoWithFullPrompt(request, retryCount + 1);
        } else {
          this.logger.warn(`AI model refused to analyze photo with full prompt for user ${request.userId}`);
          return {
            fullAnswer: '',
            blockHyposis: '',
            shortSummary: '',
            success: false,
            error: 'AI_REFUSAL',
          };
        }
      }

      // Пытаемся парсить JSON ответ
      try {
        const jsonMatch = analysisResult.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }

        const jsonResponse = JSON.parse(jsonMatch[0]);

        if (!jsonResponse.fullAnswer || !jsonResponse.blockHyposis || !jsonResponse.shortSummary) {
          throw new Error('Missing required fields in JSON response');
        }

        this.logger.log(`✅ Full analysis completed for user ${request.userId}`);

        return {
          fullAnswer: jsonResponse.fullAnswer,
          blockHyposis: jsonResponse.blockHyposis,
          shortSummary: jsonResponse.shortSummary,
          success: true,
        };
      } catch (parseError) {
        this.logger.error(`Failed to parse JSON response: ${parseError.message}`);
        this.logger.error(`Response content: ${analysisResult.substring(0, 500)}...`);

        // Fallback: возвращаем весь ответ как fullAnswer
        return {
          fullAnswer: analysisResult,
          blockHyposis: 'Не удалось извлечь структурированную гипотезу из ответа ИИ.',
          shortSummary: analysisResult.length > 200 ? analysisResult.substring(0, 200) + '...' : analysisResult,
          success: true,
        };
      }
    } catch (error) {
      this.logger.error(`❌ Full analysis failed for user ${request.userId}:`, error);

      return {
        fullAnswer: '',
        blockHyposis: '',
        shortSummary: '',
        success: false,
        error: error.message || 'Full analysis failed',
      };
    }
  }
}
