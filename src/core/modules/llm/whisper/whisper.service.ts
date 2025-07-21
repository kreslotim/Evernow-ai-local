import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '../../config/config.service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Сервис для транскрипции голосовых сообщений через OpenAI Whisper
 */
@Injectable()
export class WhisperService {
  private readonly logger = new Logger(WhisperService.name);
  private openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.getOpenAiApiKey(),
    });
  }

  /**
   * Проверяет, похож ли текст на английский (для обнаружения нежелательного перевода)
   * @param text - Текст для проверки
   * @returns true если текст похож на английский
   */
  private isLikelyEnglishText(text: string): boolean {
    // Простая эвристика для определения английского текста
    const englishWords = [
      'the',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'is',
      'are',
      'was',
      'were',
      'have',
      'has',
      'had',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'can',
      'must',
      'shall',
      'this',
      'that',
      'these',
      'those',
      'i',
      'you',
      'he',
      'she',
      'it',
      'we',
      'they',
    ];

    const words = text.toLowerCase().split(/\s+/);
    const englishWordsCount = words.filter((word) => englishWords.includes(word.replace(/[.,!?;:]/, ''))).length;
    const totalWords = words.length;

    // Если более 30% слов - английские, вероятно это английский текст
    return totalWords > 0 && englishWordsCount / totalWords > 0.3;
  }

  /**
   * Транскрибирует аудиофайл в текст
   * @param audioPath - Путь к аудиофайлу
   * @param language - Язык аудио (по умолчанию 'ru')
   * @returns Транскрибированный текст
   */
  async transcribe(audioPath: string, language: string = 'ru'): Promise<string> {
    try {
      this.logger.log(`Starting transcription for file: ${audioPath}`);

      // Проверяем существование файла
      if (!fs.existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
      }

      // Создаём поток для файла
      const audioStream = fs.createReadStream(audioPath);

      // Отправляем на транскрипцию
      // Важно: указываем явно язык для предотвращения автоматического перевода
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioStream,
        model: 'whisper-1',
        language: language, // Явно указываем язык
        response_format: 'text',
        prompt:
          language === 'ru'
            ? 'Распознай русскую речь без перевода на английский'
            : 'Transcribe in the specified language',
      });

      this.logger.log(`Transcription completed for language '${language}': ${transcription.substring(0, 100)}...`);

      // Проверяем, не был ли текст случайно переведен на английский
      if (language === 'ru' && this.isLikelyEnglishText(transcription)) {
        this.logger.warn(
          `⚠️ Possible unwanted translation detected for Russian audio: ${transcription.substring(0, 50)}...`,
        );
      }

      return transcription;
    } catch (error) {
      this.logger.error(`Error transcribing audio: ${error.message}`, error.stack);
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }

  /**
   * Транскрибирует аудиофайл из Buffer
   * @param audioBuffer - Buffer с аудиоданными
   * @param fileName - Имя файла для OpenAI
   * @param language - Язык аудио
   * @returns Транскрибированный текст
   */
  async transcribeFromBuffer(
    audioBuffer: Buffer,
    fileName: string = 'audio.ogg',
    language: string = 'ru',
  ): Promise<string> {
    try {
      // Создаём временный файл
      const tempDir = path.join(process.cwd(), 'uploads', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempPath = path.join(tempDir, `${Date.now()}_${fileName}`);
      fs.writeFileSync(tempPath, audioBuffer);

      try {
        // Транскрибируем
        const result = await this.transcribe(tempPath, language);

        // Удаляем временный файл
        fs.unlinkSync(tempPath);

        return result;
      } catch (error) {
        // Удаляем временный файл в случае ошибки
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        throw error;
      }
    } catch (error) {
      this.logger.error(`Error transcribing from buffer: ${error.message}`, error.stack);
      throw new Error(`Failed to transcribe audio from buffer: ${error.message}`);
    }
  }
}
