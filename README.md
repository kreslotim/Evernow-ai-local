# Evernow-ai - NestJS Backend

Упрощённый Telegram bot backend для анализа фотографий с использованием NestJS, OpenAI Vision API и системы очередей.

## 🚀 Features

- **Упрощённый бот анализа** - Единый тип анализа DEFAULT для 2 фотографий
- **OpenAI Vision API** - Анализ фотографий с использованием GPT-4 Vision
- **Система очередей** - Фоновая обработка фотографий через Redis/BullMQ
- **JWT Authentication** - Безопасная аутентификация админ-панели
- **Уведомления** - Redis pub/sub система для мгновенных уведомлений
- **Система кредитов** - Управление кредитами с автоматическим возвратом при ошибках
- **I18n поддержка** - Многоязычность с шаблонами `{{переменная}}`
- **Реферальная система** - Уведомления о новых рефералах
- **Admin API** - REST API для управления пользователями и анализами
- **Блокировка ботов** - Отслеживание заблокированных пользователей
- **Фильтрация и поиск** - Пагинация, сортировка для всех сущностей
- **Telegram Mini App** - Интерактивное веб-приложение для расширенного онбординга
- **Единый пайплайн онбординга** - Полный цикл от анализа до создания гипотез
- **DeepSeek AI интеграция** - Анализ чувств и создание персональных гипотез
- **Whisper API** - Транскрипция голосовых сообщений пользователей

## 📁 Project Structure

```
src/
├── bot/                    # Telegram bot logic (упрощённый)
│   ├── guards/            # NestJS guards (banned-user.guard.ts)
│   ├── handlers/          # Обработчики команд
│   │   ├── analyze.handler.ts   # Упрощённый анализ для 2 фото
│   │   ├── start.handler.ts     # Команда /start
│   │   ├── balance.handler.ts   # Баланс кредитов
│   │   ├── referral.handler.ts  # Реферальная система
│   │   ├── support.handler.ts   # Поддержка /help
│   │   └── onboarding.handler.ts # Единый пайплайн онбординга
│   ├── services/          # Бизнес-логика бота
│   │   ├── keyboard.service.ts  # Глобальная клавиатура
│   │   └── bot.service.ts       # Основной сервис с уведомлениями
│   ├── middleware/        # Middleware для бота
│   │   ├── keyboard-handler.middleware.ts  # Обработка глобальной клавиатуры
│   │   └── onboarding.middleware.ts       # Простой pass-through
│   ├── i18n/             # Интернационализация
│   │   ├── i18n.service.ts      # I18n с шаблонами {{переменная}}
│   │   └── locales/       # Файлы переводов (ru.json, en.json)
│   └── decorators/        # Декораторы (@SkipGuards)
├── core/
│   ├── modules/
│   │   ├── admin/         # Admin panel API
│   │   ├── user/          # User management service with payment notifications
│   │   ├── analyze/       # Analysis management service
│   │   ├── queue/         # Фоновая обработка заданий
│   │   │   └── processors/ # Процессоры очередей
│   │   │       └── photo-analysis.processor.ts # OpenAI интеграция
│   │   ├── openai/        # OpenAI Vision API интеграция
│   │   ├── telegram/      # Сервис загрузки файлов Telegram
│   │   ├── notification/  # Redis pub/sub система уведомлений
│   │   ├── referral/      # Реферальная система с уведомлениями
│   │   ├── auth/          # JWT аутентификация
│   │   ├── config/        # Управление конфигурацией
│   │   ├── mini-app/      # Telegram Mini App модуль
│   │   │   ├── static/    # HTML/CSS/JS файлы мини-приложения
│   │   │   └── README.md  # Документация мини-приложения
│   │   ├── llm/           # AI сервисы
│   │   │   ├── deepseek/  # DeepSeek Reasoning API
│   │   │   ├── openai/    # OpenAI GPT-4 Vision API
│   │   │   └── whisper/   # OpenAI Whisper API для голоса
│   │   ├── timer/         # Сервис таймеров для онбординга
│   │   └── user-info/     # Расширенная информация пользователей
│   └── prisma/            # Database service
├── common/
│   ├── interfaces/        # Общие TypeScript интерфейсы
│   ├── dtos/             # Data Transfer Objects с валидацией
│   ├── enums/            # Перечисления приложения
│   └── utils/            # Вспомогательные функции
├── uploads/
│   └── photos/           # Временное хранение фотографий
├── src/fonts/            # Шрифты (если используется image processing)
│   └── Evolventa-Regular.ttf  # Шрифт Evolventa
├── src/common/
│   ├── backgrounds/      # Фоновые изображения (1.png, 2.png, 3.png, 4.png)
│   └── video/           # Видео файлы (1.mp4)
└── src/bot/prompts/      # Промпты для OpenAI анализа
    ├── fast_analyze.txt  # Единственный оставшийся промпт
    └── summary.txt       # Промпт для резюме
```

## 🛠️ Technology Stack

- **Framework**: NestJS
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: Redis with BullMQ
- **Bot**: Telegraf with advanced middleware system
- **AI**: OpenAI GPT-4 Vision API
- **Image Processing**: Sharp library for social media image generation
- **Authentication**: JWT with @nestjs/jwt
- **Notifications**: Redis pub/sub
- **I18n**: Custom template interpolation system
- **Validation**: class-validator
- **Documentation**: Swagger/OpenAPI
- **Language**: TypeScript

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL
- Redis
- Telegram Bot Token
- OpenAI API Key

## 🔧 Installation

```bash
# Install dependencies
npm install

# Install JWT package (required for auth)
npm install @nestjs/jwt

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy
```

## ⚙️ Configuration

Create `.env` file:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/facebot"

# Redis
REDIS_URL="redis://localhost:6379"

# Telegram Bot
BOT_TOKEN="your_telegram_bot_token"
BOT_WEBHOOK_URL="https://yourdomain.com" # for production
BOT_WEBHOOK_PATH="/webhook"
BOT_WEBHOOK_SECRET="your_webhook_secret"

# OpenAI
OPENAI_API_KEY="your_openai_api_key_here"

# DeepSeek AI (для анализа чувств и гипотез)
DEEPSEEK_API_KEY="your_deepseek_api_key"

# Admin Authentication
ADMIN_PASSWORD="your_admin_password"
JWT_SECRET="your_jwt_secret_key"
JWT_EXPIRES_IN="24h"

# Channels (optional)
REQUIRED_CHANNELS="@channel1,@channel2"
SUBSCRIPTION_CHECK_ACTIVE=true

# App
NODE_ENV="development"
APP_PORT=4001

# Links for onboarding
REPOST_VIDEO_URL="https://example.com/video"
OFFER_URL="https://example.com/offer"
PRIVACY_POLICY_URL="https://example.com/privacy"

# OpenRouter API настройки
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
USE_OPENROUTER=true
```

## 🚀 Running the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod

# Watch mode
npm run start:dev
```

## 📚 API Documentation

### Admin API

Complete admin panel API documentation available at:

- **Swagger UI**: `http://localhost:4001/api/docs` (when running)
- **API Documentation**: [docs.api.md](./docs.api.md)

### Authentication

```
POST   /auth/login           # Admin login with JWT
```

### Key API Endpoints

```
GET    /admin/dashboard        # Dashboard statistics
GET    /admin/users           # List users with pagination
GET    /admin/users/:id       # Get user details
PUT    /admin/users/:id       # Update user
POST   /admin/users/:id/ban   # Ban user
GET    /admin/analyzes        # List analyses with filtering
```

## 🏗️ Architecture

### Core Modules

#### **OpenAIModule** (`src/core/modules/openai/`)

- **Vision API Integration**: GPT-4 Vision for photo analysis
- **Specialized Prompts**: 6 different analysis types with custom prompts
- **Image Processing**: Base64 encoding and MIME type detection
- **Error Handling**: Comprehensive error handling and logging

#### **NotificationModule** (`src/core/modules/notification/`)

- **Redis Pub/Sub**: Real-time messaging between services
- **Typed Messages**: Structured notification system
- **Multi-language Support**: Automatic message localization
- **Connection Management**: Robust Redis connection handling

#### **TelegramModule** (`src/core/modules/telegram/`)

- **File Downloads**: Real Telegram file downloads via Bot API
- **Local Storage**: Automatic directory creation and file management
- **Error Recovery**: Comprehensive error handling for file operations

#### **AuthModule** (`src/core/modules/auth/`)

- **JWT Authentication**: Secure token-based authentication
- **Admin Login**: Environment-based admin password validation
- **Token Validation**: Middleware for protected routes
- **Role-based Access**: Admin role management

#### **UserModule** (`src/core/modules/user/`)

- User management for Telegram bot
- Credit system operations
- **Payment Notifications**: Real-time payment success/failure notifications
- Ban/unban functionality
- User statistics and search

#### **AnalyzeModule** (`src/core/modules/analyze/`)

- Analysis lifecycle management
- Queue integration for processing
- Status tracking and error handling
- Statistics by type and status

#### **ReferralModule** (`src/core/modules/referral/`)

- **Enhanced Referral System**: Real-time referral notifications
- **Bonus Tracking**: 3rd referral bonus notifications
- **Notification Integration**: Redis pub/sub for instant messaging

#### **AdminModule** (`src/core/modules/admin/`)

- REST API for admin panel
- Aggregates User and Analyze services
- Comprehensive CRUD operations
- Advanced filtering and pagination

### Bot Architecture

#### **AnalysisCheckMiddleware** (`src/bot/middleware/analysis-check.middleware.ts`)

- **Smart Token Validation**: Intelligent credit checking before analysis
- **User Guidance**: Dynamic button generation based on user state
- **Conditional Actions**: "Buy Tokens" and "Earn Token" buttons
- **Seamless Integration**: Works with existing analyze handler

#### **BotService** (`src/bot/services/bot.service.ts`)

- **Notification Handling**: Redis subscription for real-time messages
- **Multi-language Support**: Automatic message localization
- **Message Types**: Referral, payment, and bonus notifications
- **Error Recovery**: Robust error handling for message delivery

#### **AnalyzeHandler** (`src/bot/handlers/analyze.handler.ts`)

- **Complete Analysis Flow**: From type selection to result delivery
- **Session Management**: User state tracking during analysis
- **Photo Processing**: Support for photos and documents
- **Queue Integration**: Seamless background processing

#### **I18nService** (`src/bot/i18n/i18n.service.ts`)

- **Template Interpolation**: Supports `{{variable}}` syntax with dynamic value replacement
- **Multi-language Support**: Structured JSON locale files with nested keys
- **Type Safety**: Map-based and object-based variable passing
- **Convenience Methods**: `t()` method for simplified translations

```typescript
// Template interpolation example
const message = i18nService.t('notifications.new_referral', 'ru', {
  referralCount: 5,
});
// Result: "🎉 У тебя новый реферал! Всего рефералов: 5"
```

#### **KeyboardService** (`src/bot/services/keyboard.service.ts`)

- **Localized Keyboards**: Automatically translated buttons based on user locale
- **Static Layout**: Fixed main keyboard (Analysis, Balance, Referral, Help)
- **Button Detection**: Smart identification of keyboard button presses
- **Utility Methods**: Back keyboards and keyboard removal

#### **KeyboardHandlerMiddleware** (`src/bot/middleware/keyboard-handler.middleware.ts`)

- **Global Navigation**: Intercepts keyboard presses across all bot scenes
- **Scene-Aware**: Automatically navigates to target scenes from any context
- **Error Handling**: Robust error handling with localized messages
- **Context Integration**: Seamless Telegraf context integration

### Queue Processing

#### **PhotoAnalysisProcessor** (`src/core/modules/queue/processors/photo-analysis.processor.ts`)

- **Real File Downloads**: Telegram file downloads via TelegramService
- **OpenAI Integration**: GPT-4 Vision API processing
- **Social Media Image Generation**: Automated creation of shareable images with analysis summaries
- **Business Logic Optimization**: Summary and social images only for first-time users
- **Fraud Prevention**: Three-strike ban system for repeated analysis failures
- **Notification System**: Success/failure notifications via Redis
- **Database Updates**: Analysis result storage and status tracking
- **Cleanup**: Automatic temporary file cleanup

### Interfaces & DTOs

**Centralized Interfaces** (`src/common/interfaces/`):

- `UserWithStats` - User with analysis/referral counts
- `AnalyzeWithUser` - Analysis with user details
- `DashboardStats` - Admin dashboard statistics
- `NotificationMessage` - Typed notification messages

**Validated DTOs** (`src/common/dtos/`):

- Full Swagger documentation with `@ApiProperty`
- Input validation with `class-validator`
- Type-safe data transfer

## 🌐 Bot Features

### Упрощённая система анализа

- **Единый тип анализа**: Только DEFAULT тип для всех анализов
- **2 фотографии**: Пользователь загружает 2 фото для анализа
- **OpenAI Vision**: AI анализ фотографий с использованием GPT-4 Vision
- **Очереди**: Фоновая обработка через Redis/BullMQ
- **Уведомления**: Мгновенные результаты через Redis pub/sub

### Система управления кредитами

- **Автоматическая проверка**: Проверка кредитов перед анализом
- **Возврат при ошибке**: Автоматический возврат кредитов при неудаче
- **Простой поток**: Удобная навигация для пользователя

### Система уведомлений

- **Реферальные уведомления**: Мгновенные уведомления о новых рефералах
- **Мультиязычность**: Автоматическая локализация по предпочтениям

### Глобальная клавиатура

- **Всегда доступна**: Основная клавиатура работает из любого контекста
- **Локализована**: Кнопки автоматически переводятся
- **Навигация**: Анализ, Баланс, Рефералы, Помощь
- **Сохранение состояния**: Поддерживает состояние пользователя

### Поддержка I18n

- **Шаблонные переменные**: `{{name}}`, `{{count}}` с автозаменой
- **Вложенные ключи**: Структурированные переводы (`notifications.new_referral`)
- **Безопасность типов**: Полная поддержка TypeScript

### Telegram Mini App - Цветовой тест Люшера

- **Интерактивный цветовой тест**: Психологический тест Люшера с 8 цветами
- **Два круга выбора**: Пользователь проходит тест дважды для повышения точности
- **Сохранение результатов**: Результаты сохраняются в поле `luscherTestResult` таблицы `UserInfo`
- **Психологический анализ**: Определение потребностей, источников стресса и ключевых истин
- **Безопасная интеграция**: Валидация подписи Telegram через HMAC-SHA256
- **Адаптивный дизайн**: Поддержка тем Telegram и мобильных устройств
- **Единый пайплайн**: Интеграция с системой онбординга через Redis очереди

### Расширенный онбординг

- **Единый пайплайн**: От анализа фотографий до создания персональных гипотез
- **Таймер-система**: 3-минутные таймеры с обновлением каждые 5 секунд
- **Анализ чувств**: DeepSeek AI для обработки текста и голосовых сообщений
- **Whisper интеграция**: Транскрипция голосовых сообщений в текст
- **Блок-гипотезы**: Персональные психологические инсайты на основе данных
- **Система валидации**: Защита от спама с автоматическим баном

### Простой пример использования бота

```typescript
// Настройка бота с упрощённой архитектурой
bot.use(keyboardHandlerMiddleware.getMiddleware());

// Упрощённый поток анализа
bot.command('start', async (ctx) => {
  // Приветствие и основная клавиатура
});

// Единый обработчик анализа для 2 фотографий
bot.on('photo', async (ctx) => {
  // Проверка кредитов, создание анализа в БД, добавление в очередь
  // Тип анализа всегда DEFAULT
});

// Система уведомлений
notificationService.publishNotification({
  type: 'new_referral',
  userId: 'user123',
  data: { referralCount: 5 },
});
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📊 Database Schema

Приложение использует Prisma с PostgreSQL:

- **User** - Пользователи Telegram с кредитами, настройками, блокировкой бота
- **Analyze** - Записи анализа фото с единым типом DEFAULT
- **Referral** - Реферальная система
- **Offer** - Предложения пользователей с title/description
- **UserInfo** - Расширенная информация пользователей для онбординга (включая результаты теста Люшера)
- **UserTimer** - Таймеры для интерактивного онбординга

Полная схема: [prisma/schema.prisma](./prisma/schema.prisma)

## 🔐 Security

- **JWT Authentication**: Secure admin authentication with configurable expiration
- **Input validation**: Comprehensive validation on all endpoints
- **User ban system**: Ban system with reason tracking
- **Environment-based configuration**: Secure credential management
- **Type-safe database operations**: Prisma-based type safety

## 📈 Performance

- **Queue-based async processing**: Background photo analysis
- **Redis pub/sub**: Real-time notifications without polling
- **Pagination**: Efficient handling of large datasets
- **Efficient database queries**: Optimized Prisma queries
- **Memory-optimized i18n**: Efficient locale loading
- **Global middleware**: Optimal keyboard and analysis handling

## 🚀 Deployment

1. **Install dependencies**: `npm install && npm install @nestjs/jwt`
2. **Set environment variables**: Configure all required env vars
3. **Install system dependencies**: `fontconfig libvips-dev` for image processing
4. **Setup fonts**: Ensure Evolventa font is available system-wide
5. **Database setup**: `npx prisma migrate deploy`
6. **Build application**: `npm run build`
7. **Start production**: `npm run start:prod`

### Required Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `BOT_TOKEN` - Telegram bot token
- `OPENAI_API_KEY` - OpenAI API key
- `DEEPSEEK_API_KEY` - DeepSeek API key
- `ADMIN_PASSWORD` - Admin authentication password
- `JWT_SECRET` - JWT signing secret
- `JWT_EXPIRES_IN` - JWT token expiration (e.g., "24h")

## 📝 Contributing

1. Follow TypeScript best practices
2. Use proper naming conventions (camelCase, PascalCase)
3. Document public APIs with JSDoc
4. Write tests for new features
5. Maintain clean code principles
6. Use i18n for all user-facing text
7. Leverage global keyboard system for navigation
8. Implement proper error handling and logging
9. Use notification system for real-time updates

## 📞 Support

For support and questions, please check the API documentation or create an issue.

## 📄 License

This project is proprietary software.

## Переменные окружения

Добавьте следующие переменные окружения для работы с OpenRouter:

```bash
# OpenRouter API настройки
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
USE_OPENROUTER=true

# Опционально: для обратной совместимости с прямым OpenAI
OPENAI_API_KEY=your_openai_api_key_here
```

### Конфигурация OpenRouter

- `OPENROUTER_API_KEY` - API ключ от OpenRouter.ai
- `OPENROUTER_BASE_URL` - Базовый URL для OpenRouter API (по умолчанию: https://openrouter.ai/api/v1)
- `USE_OPENROUTER` - Включить использование OpenRouter вместо прямого обращения к OpenAI (по умолчанию: true)

### Используемые модели

- **Анализ фото**: `openai/o3` - основная модель для анализа изображений
- **Генерация summary**: `openai/gpt-4o-mini` - модель для создания кратких резюме
