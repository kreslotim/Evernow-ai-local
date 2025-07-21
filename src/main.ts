import './instrument';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from './core/modules/swagger/swagger.module';
import { AppModule } from './core/modules/app/app.module';
import { ConfigService } from './core/modules/config/config.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api', { exclude: ['panel*', 'mini-app*'] });

  // Настройка статических файлов для мини-приложения
  const staticPath =
    process.env.NODE_ENV === 'production'
      ? path.join(__dirname, 'core', 'modules', 'mini-app', 'static')
      : path.join(process.cwd(), 'src', 'core', 'modules', 'mini-app', 'static');

  console.log(`📁 Настройка статических файлов: ${staticPath}`);
  console.log(`📁 NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`📁 __dirname: ${__dirname}`);

  // Проверяем существование директории
  const fs = require('fs');
  if (fs.existsSync(staticPath)) {
    console.log(`✅ Директория статических файлов найдена: ${staticPath}`);
    const files = fs.readdirSync(staticPath);
    console.log(`📄 Файлы в директории: ${files.join(', ')}`);
  } else {
    console.error(`❌ Директория статических файлов НЕ найдена: ${staticPath}`);
  }

  // Логирование запросов к статическим файлам для диагностики
  app.use('/mini-app', (req, res, next) => {
    console.log(`🔍 Запрос к мини-приложению: ${req.method} ${req.url}`);
    next();
  });

  // Настраиваем Express для раздачи статических файлов мини-приложения
  // Раздаем CSS и JS файлы через static middleware
  app.use(
    '/mini-app/app',
    express.static(staticPath, {
      maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
      etag: true,
      lastModified: true,
      index: false, // Отключаем автоматическую раздачу index.html, так как это делает контроллер
      setHeaders: (res, path) => {
        console.log(`📤 Раздача статического файла: ${path}`);
        if (path.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css; charset=utf-8');
        } else if (path.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        }
      },
    }),
  );

  // Дополнительный маршрут для совместимости
  app.use(
    '/mini-app/static',
    express.static(staticPath, {
      maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
      etag: true,
      lastModified: true,
    }),
  );

  // Раздача статических файлов по пути с глобальным префиксом /api для прямых ссылок из HTML
  app.use(
    '/api/mini-app',
    express.static(staticPath, {
      maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
      etag: true,
      lastModified: true,
    }),
  );

  // Настройка статических файлов для загруженных фотографий
  const uploadsPath = path.join(process.cwd(), 'uploads');
  console.log(`📁 Настройка статических файлов для uploads: ${uploadsPath}`);

  // Раздача загруженных файлов (фотографии приветствия и других)
  app.use(
    '/uploads',
    express.static(uploadsPath, {
      maxAge: process.env.NODE_ENV === 'production' ? '7d' : '0', // Дольше кэшируем загруженные файлы
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        console.log(`📤 Раздача загруженного файла: ${filePath}`);
        // Устанавливаем правильные MIME типы для изображений
        if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
          };
          res.setHeader('Content-Type', mimeTypes[ext] || 'image/jpeg');
        }
      },
    }),
  );

  // Настройка CORS для поддержки Telegram Mini Apps
  const config = app.get(ConfigService);
  const corsOptions =
    config.isProduction()
      ? {
        origin: [
          'https://web.telegram.org',
          'https://telegram.org',
          // Добавьте ваш домен мини-приложения, если используете отдельный
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Telegram-Init-Data'],
      }
      :
      { origin: '*' }; // В dev режиме разрешаем все

  app.enableCors(corsOptions);
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  const swagger = app.get(SwaggerModule);
  swagger.use(app);
  swagger.config();

  const configService = app.get(ConfigService);
  const port = configService.getAppPort();

  await app.listen(port);
}
bootstrap();
