import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

export interface TelegramFileInfo {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

/**
 * Интерфейс для ответа API getUserProfilePhotos
 */
export interface TelegramUserProfilePhotos {
  total_count: number;
  photos: Array<
    Array<{
      file_id: string;
      file_unique_id: string;
      width: number;
      height: number;
      file_size?: number;
    }>
  >;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly baseUrl = 'https://api.telegram.org';

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.getBotToken();
  }

  public async getFile(fileId: string): Promise<TelegramFileInfo> {
    const url = `${this.baseUrl}/bot${this.botToken}/getFile?file_id=${fileId}`;

    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              const response = JSON.parse(data);
              if (response.ok) {
                resolve(response.result);
              } else {
                reject(new Error(`Telegram API error: ${response.description}`));
              }
            } catch (error) {
              reject(new Error(`Failed to parse Telegram response: ${error.message}`));
            }
          });
        })
        .on('error', (error) => {
          reject(new Error(`Failed to get file info: ${error.message}`));
        });
    });
  }

  public async downloadFile(fileId: string, localPath: string): Promise<string> {
    try {
      // Get file info from Telegram
      const fileInfo = await this.getFile(fileId);

      if (!fileInfo.file_path) {
        throw new Error('File path not available');
      }

      // Download file from Telegram servers
      const fileUrl = `${this.baseUrl}/file/bot${this.botToken}/${fileInfo.file_path}`;

      // Ensure directory exists
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(localPath);

        https
          .get(fileUrl, (response) => {
            if (response.statusCode !== 200) {
              reject(new Error(`Failed to download file: HTTP ${response.statusCode}`));
              return;
            }

            response.pipe(file);

            file.on('finish', () => {
              file.close();
              this.logger.debug(`File downloaded successfully: ${localPath}`);
              resolve(localPath);
            });

            file.on('error', (error) => {
              fs.unlink(localPath, () => {}); // Delete partial file
              reject(error);
            });
          })
          .on('error', (error) => {
            reject(new Error(`Failed to download file: ${error.message}`));
          });
      });
    } catch (error) {
      this.logger.error(`Error downloading file ${fileId}: ${error.message}`);
      throw error;
    }
  }

  public async getFileUrl(fileId: string): Promise<string> {
    const fileInfo = await this.getFile(fileId);

    if (!fileInfo.file_path) {
      throw new Error('File path not available');
    }

    return `${this.baseUrl}/file/bot${this.botToken}/${fileInfo.file_path}`;
  }

  /**
   * Отправляет typing статус в чат
   * @param chatId - ID чата
   * @returns Promise<void>
   */
  public async sendTypingStatus(chatId: string): Promise<void> {
    const url = `${this.baseUrl}/bot${this.botToken}/sendChatAction`;
    const payload = {
      chat_id: chatId,
      action: 'typing',
    };

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(payload);
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 3000, // 3 секунды timeout
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.ok) {
              resolve();
            } else {
              reject(new Error(`Telegram sendChatAction error: ${response.description}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse sendChatAction response: ${error.message}`));
          }
        });
      });

      // Timeout handling
      req.setTimeout(3000, () => {
        req.destroy();
        reject(new Error('Typing status request timeout'));
      });

      req.on('error', (error) => {
        reject(new Error(`Failed to send typing status: ${error.message}`));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Загружает файл из Telegram как Buffer
   * @param filePath - Путь к файлу из Telegram API
   * @returns Buffer с содержимым файла
   */
  public async downloadFileAsBuffer(filePath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const fileUrl = `${this.baseUrl}/file/bot${this.botToken}/${filePath}`;
      const chunks: Buffer[] = [];

      https
        .get(fileUrl, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download file: HTTP ${response.statusCode}`));
            return;
          }

          response.on('data', (chunk) => {
            chunks.push(chunk);
          });

          response.on('end', () => {
            const buffer = Buffer.concat(chunks);
            this.logger.debug(`File downloaded as buffer, size: ${buffer.length} bytes`);
            resolve(buffer);
          });

          response.on('error', (error) => {
            reject(new Error(`Error during download: ${error.message}`));
          });
        })
        .on('error', (error) => {
          reject(new Error(`Failed to download file: ${error.message}`));
        });
    });
  }

  /**
   * Получает фотографии профиля пользователя из Telegram
   * @param userId - ID пользователя в Telegram
   * @param offset - Смещение для пагинации (по умолчанию 0)
   * @param limit - Лимит количества фотографий (по умолчанию 1)
   * @returns Promise с данными фотографий профиля пользователя
   */
  public async getUserProfilePhotos(
    userId: string,
    offset: number = 0,
    limit: number = 1,
  ): Promise<TelegramUserProfilePhotos> {
    const url = `${this.baseUrl}/bot${this.botToken}/getUserProfilePhotos?user_id=${userId}&offset=${offset}&limit=${limit}`;

    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              const response = JSON.parse(data);
              if (response.ok) {
                resolve(response.result);
              } else {
                reject(new Error(`Telegram API error: ${response.description}`));
              }
            } catch (error) {
              reject(new Error(`Failed to parse Telegram response: ${error.message}`));
            }
          });
        })
        .on('error', (error) => {
          reject(new Error(`Failed to get user profile photos: ${error.message}`));
        });
    });
  }

  /**
   * Получает file_id последней аватарки пользователя
   * @param userId - ID пользователя в Telegram
   * @returns Promise с file_id аватарки или null, если аватарки нет
   */
  public async getUserAvatarFileId(userId: string): Promise<string | null> {
    try {
      this.logger.debug(`Getting avatar for user ${userId}`);

      const profilePhotos = await this.getUserProfilePhotos(userId, 0, 1);

      if (profilePhotos.total_count === 0 || profilePhotos.photos.length === 0) {
        this.logger.debug(`No avatar found for user ${userId}`);
        return null;
      }

      // Берем последнее (самое большое по размеру) фото из первой группы
      const photoSizes = profilePhotos.photos[0];
      const largestPhoto = photoSizes[photoSizes.length - 1];

      this.logger.debug(`Avatar found for user ${userId}, file_id: ${largestPhoto.file_id}`);
      return largestPhoto.file_id;
    } catch (error) {
      this.logger.warn(`Failed to get avatar for user ${userId}: ${error.message}`);
      return null;
    }
  }
}
