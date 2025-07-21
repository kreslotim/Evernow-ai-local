import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '../../config/config.service';
import { PromptService } from '../prompt/prompt.service';
import { PromptKey } from '../prompt/prompts.constants';

/**
 * Сервис для анализа текста через DeepSeek Reasoning API
 */
@Injectable()
export class DeepSeekService {
  private readonly logger = new Logger(DeepSeekService.name);
  private deepseek: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly promptService: PromptService,
  ) {
    // DeepSeek использует OpenAI-совместимый API
    this.deepseek = new OpenAI({
      apiKey: this.configService.getDeepSeekApiKey(),
      baseURL: 'https://api.deepseek.com',
    });
  }

  /**
   * Анализирует текст о чувствах пользователя
   * @param text - Текст для анализа
   * @returns Результат анализа (полноценный ответ или "НЕТ")
   */
  async analyzeFeelingsText(text: string): Promise<{ isValid: boolean; analysis?: string }> {
    try {
      const promptTemplate = await this.promptService.getPrompt(PromptKey.DEEPSEEK_FEELINGS_ANALYSIS);
      const prompt = this.promptService.replaceVariables(promptTemplate, { text });

      const response = await this.deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';

      try {
        const result = JSON.parse(content);
        this.logger.log(`DeepSeek analysis result: ${JSON.stringify(result)}`);
        return result;
      } catch (parseError) {
        this.logger.error(`Failed to parse DeepSeek response: ${content}`);
        return { isValid: false };
      }
    } catch (error) {
      this.logger.error(`Error analyzing feelings: ${error.message}`, error.stack);
      throw new Error(`Failed to analyze feelings: ${error.message}`);
    }
  }

  //   /**
  //    * Генерирует триггерное сообщение на основе анализа чувств
  //    * @param feelingsAnalysis - Анализ чувств пользователя
  //    * @param userInfo - Информация о пользователе
  //    * @returns Персонализированное триггерное сообщение
  //    */
  //   async generateTriggerMessage(
  //     feelingsAnalysis: string,
  //     userInfo: { name?: string; analysisDescription?: string },
  //   ): Promise<string> {
  //     try {
  //       const prompt = `На основе эмоционального анализа пользователя, создай персонализированное мотивирующее сообщение.

  // Анализ эмоций: ${feelingsAnalysis}
  // ${userInfo.analysisDescription ? `Результат анализа фото: ${userInfo.analysisDescription}` : ''}

  // Создай короткое (2-3 предложения) вдохновляющее сообщение, которое:
  // 1. Подтверждает чувства пользователя
  // 2. Даёт позитивный импульс к действию
  // 3. Заканчивается конкретным предложением или вопросом

  // Пиши от первого лица, дружелюбно и поддерживающе.`;

  //       const response = await this.deepseek.chat.completions.create({
  //         model: 'deepseek-reasoner',
  //         messages: [
  //           {
  //             role: 'user',
  //             content: prompt,
  //           },
  //         ],
  //         temperature: 0.7,
  //         max_tokens: 300,
  //       });

  //       const message =
  //         response.choices[0]?.message?.content ||
  //         'Спасибо, что поделились своими чувствами! Это важный шаг к самопознанию.';

  //       this.logger.log(`Generated trigger message: ${message.substring(0, 100)}...`);
  //       return message;
  //     } catch (error) {
  //       this.logger.error(`Error generating trigger message: ${error.message}`, error.stack);
  //       return 'Спасибо, что поделились своими чувствами! Это важный шаг к самопознанию. Готовы двигаться дальше?';
  //     }
  //   }

  /**
   * Создаёт блок-гипотезу на основе всех данных пользователя
   * @param data - Данные из анализа и чувств
   * @returns Блок-гипотеза
   */
  async createBlockHypothesis(data: {
    analysisDescription: string;
    feelings: string;
    feelingsAnalysis: string;
  }): Promise<string> {
    try {
      const promptTemplate = await this.promptService.getPrompt(PromptKey.DEEPSEEK_BLOCK_HYPOTHESIS);
      const prompt = this.promptService.replaceVariables(promptTemplate, {
        analysisDescription: data.analysisDescription,
        feelings: data.feelings,
        feelingsAnalysis: data.feelingsAnalysis,
      });

      const response = await this.deepseek.chat.completions.create({
        model: 'deepseek-reasoner',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 2000,
      });

      const hypothesis =
        response.choices[0]?.message?.content ||
        'Вероятно, основной внутренний конфликт связан с противоречием между внешними ожиданиями и внутренними стремлениями. Это создаёт напряжение, которое блокирует реализацию истинного потенциала.';

      this.logger.log(`Created block hypothesis: ${hypothesis.substring(0, 100)}...`);
      return hypothesis;
    } catch (error) {
      this.logger.error(`Error creating block hypothesis: ${error.message}`, error.stack);
      return 'Анализ показывает внутреннее противоречие между стремлением к достижениям и страхом выйти за рамки привычного. Ключ к росту — в принятии своей уникальности и смелости быть собой.';
    }
  }

  /**
   * Создаёт гипотезу второго порядка
   * @param data - Данные из анализа и предыдущей гипотезы
   * @returns Гипотеза второго порядка
   */
  async createSecondOrderHypothesis(data: {
    analysisDescription: string;
    feelings: string;
    previousHypothesis: string;
  }): Promise<string> {
    try {
      const promptTemplate = await this.promptService.getPrompt(PromptKey.DEEPSEEK_SECOND_ORDER_HYPOTHESIS);
      const prompt = this.promptService.replaceVariables(promptTemplate, {
        analysisDescription: data.analysisDescription,
        feelings: data.feelings,
        previousHypothesis: data.previousHypothesis,
      });

      const response = await this.deepseek.chat.completions.create({
        model: 'deepseek-reasoner',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const hypothesis =
        response.choices[0]?.message?.content ||
        'Возможно, первая гипотеза затронула лишь поверхностный слой. Похоже, истинный блок лежит не в противоречии, а в страхе потерять текущую идентичность при достижении новых высот. Это точка, где рост требует не борьбы, а принятия.';

      this.logger.log(`Created 2nd order hypothesis: ${hypothesis.substring(0, 100)}...`);
      return hypothesis;
    } catch (error) {
      this.logger.error(`Error creating 2nd order hypothesis: ${error.message}`, error.stack);
      return 'Иногда первое предположение не попадает в цель. Возможно, дело не в страхе, а в поиске истинного пути, который принесет не только успех, но и гармонию. Важно прислушиваться к себе.';
    }
  }
}
