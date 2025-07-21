# Bot Architecture - NestJS Guards & Services

This directory contains the refactored bot logic using proper NestJS patterns instead of traditional Telegraf middlewares.

## Architecture Overview

```
bot/
├── guards/                 # NestJS Guards (replace middlewares)
│   ├── subscription.guard.ts    # Channel subscription checking
│   └── banned-user.guard.ts     # Banned user blocking
├── services/               # Business logic services
│   ├── i18n.service.ts          # Internationalization
│   └── user.service.ts          # User database operations
├── decorators/             # Custom decorators
│   └── skip-guards.decorator.ts # Skip guard checks
├── modules/                # Module organization
│   └── bot-core.module.ts       # Core bot services module
├── examples/               # Usage examples
│   └── bot-handler.example.ts   # Handler implementation example
└── README.md              # This file
```

## Key Changes

### ❌ Old Middleware Approach

```typescript
// Function-based middlewares
bot.use(checkBannedUser);
bot.use(checkChannelSubscription);
bot.use(i18nMiddleware());

bot.start(async (ctx) => {
  // Logic here - middlewares run before every handler
});
```

### ✅ New NestJS Guard Approach

```typescript
@Injectable()
@UseGuards(BannedUserGuard, SubscriptionGuard)
export class BotHandler {
  constructor(
    private readonly i18nService: I18nService,
    private readonly queueService: QueueService,
  ) {}

  @SkipBanCheck()
  @SkipSubscription()
  async handleStart(ctx: any) {
    const i18n = await this.i18nService.getI18nContext(ctx);
    // Logic here
  }
}
```

## Components

### 🛡️ Guards

#### `SubscriptionGuard`

- Replaces `checkChannelSubscription` middleware
- Checks if user is subscribed to required channels
- Handles subscription verification callbacks
- Configurable via environment variables

#### `BannedUserGuard`

- Converted to Telegram middleware for better integration
- Блокирует заблокированных пользователей от использования функций бота
- Разрешает команду `/start` по умолчанию
- Интегрируется как Telegram middleware для лучшей совместимости

### 🔧 Services

#### `I18nService`

- Replaces `i18nMiddleware` function
- Provides language detection and translation
- Memory-optimized with static contexts
- Integrates with user settings
- **NEW**: Supports database-backed messages with fallback to locale files
- **NEW**: Async methods `tAsync()` and `translateAsync()` with database priority

#### `UserService`

- Handles database operations for users
- Manages subscription status and user settings
- Tracks photo analysis failure attempts for fraud prevention
- Implements user ban/unban functionality with automatic cleanup

#### `BotMessageService` 🆕

- **NEW**: Manages bot messages with database priority over locale files
- Provides CRUD operations for bot messages in admin panel
- Implements intelligent fallback: Database → Locale files → Key
- Supports HTML markup with validation
- 5-minute caching for performance optimization
- Integrates seamlessly with existing I18nService

#### `ImageProcessingService`

- Generates social media shareable images
- Integrates user photos with analysis summaries
- Uses Sharp library for high-performance image processing
- Supports custom fonts and dynamic backgrounds

### 🎯 Decorators

#### `@SkipSubscription()`

- Skip subscription check for specific handlers
- Useful for public commands like `/help`

#### `@SkipBanCheck()`

- Skip ban check for specific handlers
- Useful for `/start` or settings commands

## Configuration

### Environment Variables

```env
# Channel subscription settings
REQUIRED_CHANNELS=@channel1,@channel2,-1001234567890
SUBSCRIPTION_CHECK_ACTIVE=true

# Redis for queue (already configured)
REDIS_URL=redis://localhost:6379
```

### Config Service Integration

The following methods are available in `ConfigService`:

- `getRequiredChannels()` - Returns array of channel IDs
- `isSubscriptionCheckActive()` - Returns boolean for feature toggle

## Usage Examples

### Basic Handler Setup

```typescript
@Injectable()
@UseGuards(BannedUserGuard, SubscriptionGuard)
export class PhotoBotHandler {
  constructor(
    private readonly i18nService: I18nService,
    private readonly queueService: QueueService,
  ) {}

  // Photo processing - requires subscription, blocks banned users
  async handlePhoto(ctx: any) {
    const locale = getLocaleFromLanguage(ctx.from.language_code);
    const message = await this.i18nService.tAsync('scenes.analysis.send_photos', locale);
    await ctx.reply(message, { parse_mode: 'HTML' });
    // Queue photo analysis...
  }

  // Start command - accessible to everyone
  @SkipBanCheck()
  @SkipSubscription()
  async handleStart(ctx: any) {
    const locale = getLocaleFromLanguage(ctx.from.language_code);
    const welcomeMessage = await this.i18nService.tAsync('greeting.auto_registered', locale, {
      name: ctx.from.first_name || 'Друг',
    });
    await ctx.reply(welcomeMessage, { parse_mode: 'HTML' });
  }
}
```

### Database-Backed Messages System 🆕

```typescript
@Injectable()
export class OnboardingHandler {
  constructor(
    private readonly i18nService: I18nService,
    private readonly userService: UserService,
  ) {}

  async sendWelcomeMessage(ctx: Context, locale: string) {
    // 🆕 NEW: Uses database-backed messages with fallback
    const message = await this.i18nService.tAsync('onboarding.welcomeMessage', locale);

    // Supports HTML markup from admin panel
    await ctx.reply(message, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  }

  async sendTimerMessage(ctx: Context, locale: string) {
    // Messages can be edited through admin panel without code changes
    const timerMessage = await this.i18nService.tAsync('onboarding.timerMessage', locale);
    const skipButtonText = await this.i18nService.tAsync('onboarding.skipTimerButton', locale);

    const keyboard = Markup.inlineKeyboard([[Markup.button.callback(skipButtonText, 'skip_timer')]]);

    await ctx.reply(timerMessage, {
      parse_mode: 'HTML',
      reply_markup: keyboard.reply_markup,
    });
  }
}
```

### Integration with Telegraf

```typescript
// In your bot setup
const app = await NestFactory.create(AppModule);
const botHandler = app.get(PhotoBotHandler);

bot.start(async (ctx) => {
  await botHandler.handleStart(ctx);
});

bot.on('photo', async (ctx) => {
  await botHandler.handlePhoto(ctx);
});
```

## Benefits

### 🎯 **Dependency Injection**

- Proper service injection instead of global imports
- Testable components with mocking capabilities
- Clean separation of concerns

### 🔧 **Configurability**

- Environment-based configuration
- Feature toggles via config service
- Runtime configuration changes

### 🚀 **Performance**

- Guards only run when needed
- Memory-optimized i18n contexts
- Efficient database queries

### 🧪 **Testability**

- Each guard/service can be unit tested
- Mocking dependencies is straightforward
- Integration tests are cleaner

### 📈 **Scalability**

- Easy to add new guards or services
- Modular architecture supports growth
- Queue integration for heavy operations

### 🤖 **Dynamic Content Management** 🆕

- Real-time message editing through admin panel
- No code deployments needed for content changes
- HTML support for rich message formatting
- Multi-language content management
- Database-backed with intelligent fallbacks

## 🚀 Recent Architecture Improvements (v3.4.1)

### 📸 **Media Groups Support**

Fixed handling of multiple photos sent simultaneously in Telegram:

```typescript
// Handles media groups with automatic buffering
private mediaGroupBuffer = new Map<string, {
  photos: string[];
  timeout: NodeJS.Timeout;
}>();

// Collects photos from same media group for 1 second
private async handleMediaGroup(ctx: Context, fileId: string) {
  // Buffers and processes photos together
  // Prevents duplicate "photo received" messages
}
```

**Benefits:**

- ✅ Correct message order when sending 2+ photos
- ✅ Single "photos uploaded" notification
- ✅ Proper face/palm photo assignment

### 🔄 **Onboarding State Recovery**

Enhanced resume functionality for interrupted onboarding:

```typescript
// Intelligent state recovery in resumeOnboarding()
case 'SURVEY_IN_PROGRESS':
  const progress = userInfo?.surveyProgress || 0;

  if (progress === 0) {
    await this.sendSurveyQuestion(ctx, userId, 1); // ✅ Fixed: starts from Q1
  } else if (progress < 4) {
    await this.sendSurveyQuestion(ctx, userId, progress + 1);
  }
```

**Fixed Issues:**

- ✅ Bot restart now continues from correct survey question
- ✅ No more jumping to voice question after restart
- ✅ Proper handling of progress state

### 🛡️ **Middleware Activation**

Re-enabled OnboardingMiddleware for proper message filtering:

```typescript
// In bot.service.ts - NOW ENABLED
this.bot.use(this.userMiddleware.getMiddleware());
this.bot.use(this.onboardingMiddleware.use()); // ✅ Re-enabled
```

**Benefits:**

- ✅ Custom text answers now processed correctly
- ✅ Survey button reminders work
- ✅ Voice message prompts active

### 🌐 **Selective Localization**

Moved critical error messages to i18n system while keeping survey content intact:

```typescript
// Localized critical errors
await ctx.reply(await this.i18nService.tAsync('errors.user_not_found', locale));
await ctx.reply(await this.i18nService.tAsync('errors.photo_failed', locale));

// Survey content remains hardcoded for consistency
const questions = {
  1: { text: `<b>1/5</b> Человек сильно подвёл...` },
};
```

**Strategy:**

- ✅ Error messages → i18n (admin manageable)
- ✅ System notifications → i18n
- ✅ Survey content → hardcoded (content stability)

## Migration Guide

### Step 1: Remove Old Middlewares

```typescript
// Remove these lines from your bot setup
bot.use(checkBannedUser);
bot.use(checkChannelSubscription);
bot.use(i18nMiddleware());
```

### Step 2: Create Handler Classes

```typescript
@Injectable()
@UseGuards(BannedUserGuard, SubscriptionGuard)
export class YourBotHandler {
  constructor(
    private readonly i18nService: I18nService,
    // ... other services
  ) {}
}
```

### Step 3: Update Bot Registration

```typescript
const handler = app.get(YourBotHandler);
bot.start(async (ctx) => await handler.handleStart(ctx));
```

### Step 4: Add Skip Decorators Where Needed

```typescript
@SkipBanCheck()      // For commands that banned users should access
@SkipSubscription()  // For public commands
async handlePublicCommand(ctx: any) { ... }
```

### Step 5: Migrate to Async Message Methods 🆕

```typescript
// ❌ OLD: Synchronous methods (only locale files)
const message = this.i18nService.t('greeting.welcome', locale);
const translated = this.i18nService.translate('errors.general', locale);

// ✅ NEW: Asynchronous methods (database + locale files)
const message = await this.i18nService.tAsync('greeting.welcome', locale);
const translated = await this.i18nService.translateAsync('errors.general', locale);
```

### Step 6: Set up Admin Panel for Message Management

1. **Access Admin Panel**: Navigate to `/panel/bot-messages`
2. **Import Existing Messages**: Use the import feature to move locale messages to database
3. **Edit Messages**: Use HTML formatting for rich content
4. **Test Changes**: Messages update immediately without code deployment

## TODO

- [x] ~~Replace UserService placeholders with actual database service~~ ✅ **COMPLETED**
- [x] ~~Integrate real i18n library instead of placeholder~~ ✅ **COMPLETED**
- [x] ~~Implement database-backed message system~~ ✅ **COMPLETED (v3.4.0)**
- [x] ~~Add admin panel for message management~~ ✅ **COMPLETED (v3.4.0)**
- [x] ~~Support HTML markup in messages~~ ✅ **COMPLETED (v3.4.0)**
- [x] ~~Fix media groups handling for multiple photos~~ ✅ **COMPLETED (v3.4.1)**
- [x] ~~Enable OnboardingMiddleware for custom answers~~ ✅ **COMPLETED (v3.4.1)**
- [x] ~~Fix onboarding resume to correct survey step~~ ✅ **COMPLETED (v3.4.1)**
- [x] ~~Partial localization of critical error messages~~ ✅ **COMPLETED (v3.4.1)**
- [ ] Add proper error handling and logging for new message system
- [ ] Create integration tests for guards and message system
- [ ] Add metrics and monitoring for guard performance
- [ ] Implement message versioning for rollback capabilities
- [ ] Add bulk import/export for message management
- [ ] Create message approval workflow for content moderation
