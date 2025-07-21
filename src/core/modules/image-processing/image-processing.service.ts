import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);
  private backgroundCount: number;

  constructor(private readonly telegramService: TelegramService) {
    this.backgroundCount = this.countBackgrounds();
  }

  private countBackgrounds(): number {
    try {
      const backgroundsPath = path.join(process.cwd(), 'src', 'common', 'backgrounds');
      const files = fs.readdirSync(backgroundsPath);
      const pngFiles = files.filter((file) => file.endsWith('.png') && /^\d+\.png$/.test(file));
      return pngFiles.length;
    } catch (error) {
      this.logger.error(`Failed to count backgrounds: ${error.message}`);
      return 4; // Fallback to default count
    }
  }

  async combinePhotosHorizontally(imagePaths: string[]): Promise<string> {
    try {
      if (!imagePaths || imagePaths.length === 0) {
        throw new Error('No image paths provided');
      }

      if (imagePaths.length === 1) {
        return imagePaths[0];
      }

      this.logger.log(`Combining ${imagePaths.length} photos horizontally`);

      const imageMetadata = await Promise.all(
        imagePaths.map(async (imagePath) => {
          const metadata = await sharp(imagePath).metadata();
          return {
            path: imagePath,
            width: metadata.width || 0,
            height: metadata.height || 0,
            metadata,
          };
        }),
      );

      const maxHeight = Math.max(...imageMetadata.map((img) => img.height));
      this.logger.debug(`Maximum height found: ${maxHeight}px`);

      // Resize all images to the same height while maintaining aspect ratio
      const resizedImages = await Promise.all(
        imageMetadata.map(async (img) => {
          const resizedBuffer = await sharp(img.path)
            .resize({
              height: maxHeight,
              fit: 'contain',
              background: { r: 255, g: 255, b: 255, alpha: 1 },
            })
            .toBuffer();

          const resizedMetadata = await sharp(resizedBuffer).metadata();

          return {
            buffer: resizedBuffer,
            width: resizedMetadata.width || 0,
            height: resizedMetadata.height || 0,
          };
        }),
      );

      // Calculate total width for the combined image
      const totalWidth = resizedImages.reduce((sum, img) => sum + img.width, 0);
      this.logger.debug(`Total combined width: ${totalWidth}px`);

      // Create a blank canvas with the calculated dimensions
      const combinedImage = sharp({
        create: {
          width: totalWidth,
          height: maxHeight,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      });

      // Prepare composite operations for horizontal placement
      const compositeOperations = [];
      let currentLeft = 0;

      for (const resizedImg of resizedImages) {
        compositeOperations.push({
          input: resizedImg.buffer,
          left: currentLeft,
          top: 0,
        });
        currentLeft += resizedImg.width;
      }

      const outputDir = path.dirname(imagePaths[0]);
      const outputPath = path.join(outputDir, `combined_${Date.now()}.jpg`);

      await combinedImage.composite(compositeOperations).jpeg({ quality: 100 }).toFile(outputPath);

      return outputPath;
    } catch (error) {
      this.logger.error(`Failed to combine photos: ${error.message}`, error.stack);
      throw new Error(`Photo combining failed: ${error.message}`);
    }
  }

  async createSocialMediaImage(userPhotoPath: string, summaryText: string, telegramId?: string): Promise<string> {
    try {
      this.logger.log('🎨 Creating social media image with summary and user photo');

      // Определяем путь к финальному фото пользователя
      let finalUserPhotoPath = userPhotoPath;
      let isUsingAvatar = false;

      // Если есть telegramId, сначала пытаемся получить аватарку пользователя
      if (telegramId) {
        try {
          this.logger.debug(`Attempting to get avatar for user ${telegramId}`);
          const avatarFileId = await this.telegramService.getUserAvatarFileId(telegramId);

          if (avatarFileId) {
            // Скачиваем аватарку во временную папку
            const avatarDir = path.join(path.dirname(userPhotoPath), 'avatars');
            if (!fs.existsSync(avatarDir)) {
              fs.mkdirSync(avatarDir, { recursive: true });
            }

            const avatarPath = path.join(avatarDir, `avatar_${telegramId}_${Date.now()}.jpg`);
            await this.telegramService.downloadFile(avatarFileId, avatarPath);

            finalUserPhotoPath = avatarPath;
            isUsingAvatar = true;
            this.logger.log(`✅ Using user avatar from Telegram for user ${telegramId}`);
          } else {
            this.logger.debug(`No avatar found for user ${telegramId}, using uploaded photo`);
          }
        } catch (error) {
          this.logger.warn(`Failed to get avatar for user ${telegramId}: ${error.message}, using uploaded photo`);
        }
      }

      // Format summary text: split by "." and add double "\n" for better separation
      const formattedSummary = summaryText
        .split('.')
        .filter((sentence) => sentence.trim().length > 0)
        .map((sentence) => sentence.trim())
        .join('.\n');

      // Get random background dynamically
      const backgroundNumber = Math.floor(Math.random() * this.backgroundCount) + 1;
      const backgroundPath = path.join(process.cwd(), 'src', 'common', 'backgrounds', `1.png`);

      if (!fs.existsSync(backgroundPath)) {
        throw new Error(`Background image not found: ${backgroundPath}`);
      }

      this.logger.debug(`Using background: ${backgroundNumber}.png`);

      // Load background image
      const backgroundImage = sharp(backgroundPath);
      const backgroundMetadata = await backgroundImage.metadata();
      const bgWidth = backgroundMetadata.width;
      const bgHeight = backgroundMetadata.height;

      const userPhotoSize = 240; // Increased size for better visibility
      const circleRadius = userPhotoSize / 2; // Радиус для круглого фото
      const rectangleSize = userPhotoSize + 80; // Even bigger white rectangle with more padding
      const cornerOffset = 120; // Much more distance from corner for better bottom margin

      // Создаем круглую маску для фото пользователя
      const circleMask = Buffer.from(`
        <svg width="${userPhotoSize}" height="${userPhotoSize}">
          <circle cx="${circleRadius}" cy="${circleRadius}" r="${circleRadius}" fill="white"/>
        </svg>
      `);

      // Обрабатываем фото пользователя - обрезаем по кругу
      const userPhoto = await sharp(finalUserPhotoPath)
        .resize(userPhotoSize, userPhotoSize, { fit: 'cover' })
        .composite([{ input: circleMask, blend: 'dest-in' }])
        .png()
        .toBuffer();

      // Create white rounded rectangle
      const whiteRectangle = Buffer.from(`
        <svg width="${rectangleSize}" height="${rectangleSize}">
          <rect x="0" y="0" width="${rectangleSize}" height="${rectangleSize}" rx="71" ry="71" fill="white"/>
        </svg>
      `);

      // Create text SVG with proper positioning after header
      const headerHeight = 380; // Space for the header section
      const textStartY = headerHeight + 80; // Start text after header with margin
      const finalWidth = bgWidth - 20; // Reduce more aggressively to eliminate white line
      const maxTextWidth = finalWidth - 100; // Leave 50px margin on each side
      const textSvg = `
        <svg width="${finalWidth}" height="${bgHeight}">
          <defs>
            <style>
              .summary-text { 
                font-family: 'Evolventa', 'Inter', 'SF Pro Display', 'Arial', 'Helvetica', 'Trebuchet MS', sans-serif; 
                font-size: 42px; 
                font-weight: 400;
                fill: #000000; 
                text-anchor: middle;
                dominant-baseline: top;
              }
            </style>
          </defs>
          <text x="${finalWidth / 2}" y="${textStartY}" class="summary-text">
            ${this.wrapText(formattedSummary, maxTextWidth)}
          </text>
        </svg>
      `;

      const outputPath = path.join(path.dirname(userPhotoPath), `social_${Date.now()}.jpg`);

      // Reduce width to eliminate white line and ensure proper sizing
      await backgroundImage
        .resize(finalWidth, bgHeight, { fit: 'fill' })
        .composite([
          {
            input: Buffer.from(textSvg),
            top: 0,
            left: 0,
          },
          {
            input: whiteRectangle,
            top: bgHeight - rectangleSize - cornerOffset,
            left: finalWidth - rectangleSize - cornerOffset,
          },
          {
            input: userPhoto,
            top: bgHeight - rectangleSize - cornerOffset + 40, // More padding inside rectangle
            left: finalWidth - rectangleSize - cornerOffset + 40,
          },
        ])
        .jpeg({ quality: 95 })
        .toFile(outputPath);

      // Удаляем временный файл аватарки, если он был создан
      if (isUsingAvatar && finalUserPhotoPath !== userPhotoPath && fs.existsSync(finalUserPhotoPath)) {
        try {
          fs.unlinkSync(finalUserPhotoPath);
          this.logger.debug(`Cleaned up temporary avatar file: ${finalUserPhotoPath}`);
        } catch (error) {
          this.logger.warn(`Failed to cleanup avatar file: ${error.message}`);
        }
      }

      this.logger.log(
        `✅ Social media image created: ${outputPath} (using ${isUsingAvatar ? 'avatar' : 'uploaded photo'})`,
      );
      return outputPath;
    } catch (error) {
      this.logger.error(`Failed to create social media image: ${error.message}`, error.stack);
      throw new Error(`Social media image creation failed: ${error.message}`);
    }
  }

  private wrapText(text: string, maxWidth: number): string {
    const lines = text.split('\n');
    const wrappedLines = [];

    for (const line of lines) {
      if (line.length > 35) {
        // Reduced character limit for bigger 48px font
        const words = line.split(' ');
        let currentLine = '';

        for (const word of words) {
          if ((currentLine + word).length > 35) {
            if (currentLine) wrappedLines.push(currentLine.trim());
            currentLine = word + ' ';
          } else {
            currentLine += word + ' ';
          }
        }

        if (currentLine) wrappedLines.push(currentLine.trim());
      } else {
        wrappedLines.push(line);
      }
    }

    return wrappedLines
      .map((line, index) => {
        // Check if this line ends with a period (end of sentence) for extra spacing
        const isStartOfSentence = wrappedLines[index - 1]?.trim().endsWith('.');
        const spacing = index === 0 ? '0' : isStartOfSentence ? '2.2em' : '1.2em';
        return `<tspan x="50%" dy="${spacing}">${line}</tspan>`;
      })
      .join('');
  }

  async cleanupImages(filePaths: string[]): Promise<void> {
    try {
      for (const filePath of filePaths) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          this.logger.debug(`Cleaned up image: ${filePath}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to cleanup images: ${error.message}`);
    }
  }

  async getImageMetadata(imagePath: string) {
    try {
      return await sharp(imagePath).metadata();
    } catch (error) {
      this.logger.error(`Failed to get image metadata: ${error.message}`);
      throw new Error(`Failed to read image metadata: ${error.message}`);
    }
  }
}
