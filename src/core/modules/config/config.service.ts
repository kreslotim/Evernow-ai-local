import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private readonly nestConfigService: NestConfigService) {}

  public getAppPort() {
    return this.nestConfigService.get<number>('APP_PORT');
  }

  public getJwtSecret() {
    return this.nestConfigService.get<string>('JWT_SECRET');
  }

  public getExpiresIn() {
    return this.nestConfigService.get<string>('EXPIRES_IN');
  }

  public getNodeEnv() {
    return this.nestConfigService.get<string>('NODE_ENV');
  }

  public isDevelopment() {
    return this.getNodeEnv() === 'development';
  }

  public isProduction() {
    return this.getNodeEnv() === 'production';
  }

  public getBotToken() {
    return this.nestConfigService.get<string>('BOT_TOKEN');
  }

  public getBotWebhookUrl() {
    return this.nestConfigService.get<string>('BOT_WEBHOOK_URL');
  }

  public getBotWebhookPath() {
    return this.nestConfigService.get<string>('BOT_WEBHOOK_PATH');
  }

  public getBotWebhookSecret() {
    return this.nestConfigService.get<string>('BOT_WEBHOOK_SECRET');
  }

  public getRedisUrl() {
    return this.nestConfigService.get<string>('REDIS_URL');
  }

  public getRequiredChannels(): string[] {
    const channels = this.nestConfigService.get<string>('REQUIRED_CHANNELS', '');
    return channels.split(',').filter(Boolean);
  }

  public isSubscriptionCheckActive(): boolean {
    return this.nestConfigService.get<boolean>('SUBSCRIPTION_CHECK_ACTIVE', false);
  }

  public getApiKey(): string {
    return this.nestConfigService.get<string>('API_KEY');
  }

  public getPaymentServiceApiUrl(): string {
    return this.nestConfigService.get<string>('PAYMENT_SERVICE_API_URL');
  }
  public getPaymentServiceApiKey(): string {
    return this.nestConfigService.get<string>('PAYMENT_SERVICE_API_KEY');
  }

  public getBotUsername(): string {
    return this.nestConfigService.get<string>('BOT_USERNAME');
  }

  public getOpenAiApiKey(): string {
    return this.nestConfigService.get<string>('OPENAI_API_KEY');
  }

  public getOpenAiModel(): string {
    return this.nestConfigService.get<string>('OPENAI_MODEL');
  }

  public getSummaryOpenAiModel(): string {
    return this.nestConfigService.get<string>('SUMMARY_OPENAI_MODEL');
  }

  public getAdminPassword(): string {
    return this.nestConfigService.get<string>('ADMIN_PASSWORD');
  }

  public getJwtExpiresIn(): string {
    return this.nestConfigService.get<string>('JWT_EXPIRES_IN');
  }

  /**
   * Получает базовый URL приложения
   * @returns Базовый URL (например, http://localhost:4200)
   */
  public getAppUrl(): string {
    const port = this.getAppPort();
    const host = this.nestConfigService.get<string>('APP_HOST', 'localhost');
    const protocol = this.isProduction() ? 'https' : 'http';

    return this.nestConfigService.get<string>('APP_URL') || `${protocol}://${host}:${port}`;
  }

  /**
   * Получает URL для мини-приложения
   * @returns URL мини-приложения (с учетом глобального префикса API)
   */
  public getMiniAppUrl(): string {
    const appUrl = this.getAppUrl();
    return `${appUrl}/api/mini-app/app`;
  }

  /**
   * Получает ссылку на видео для репоста
   * @returns URL видео
   */
  getRepostVideoUrl(): string {
    return process.env.REPOST_VIDEO_URL || 'https://t.me/your_channel/video_post';
  }

  /**
   * Получает ссылку на оферту
   * @returns URL оферты
   */
  getOfferUrl(): string {
    return process.env.OFFER_URL || 'https://your-site.com/offer';
  }

  /**
   * Получает ссылку на политику конфиденциальности
   * @returns URL политики конфиденциальности
   */
  getPrivacyPolicyUrl(): string {
    return process.env.PRIVACY_POLICY_URL || 'https://your-site.com/privacy';
  }

  public getDeepSeekApiKey(): string {
    return this.nestConfigService.get<string>('DEEPSEEK_API_KEY');
  }

  /**
   * Получает API ключ для OpenRouter
   * @returns API ключ OpenRouter
   */
  public getOpenRouterApiKey(): string {
    return this.nestConfigService.get<string>('OPENROUTER_API_KEY');
  }

  /**
   * Проверяет, нужно ли использовать OpenRouter вместо прямого OpenAI
   * @returns true если нужно использовать OpenRouter
   */
  public useOpenRouter(): boolean {
    return this.nestConfigService.get<boolean>('USE_OPENROUTER', true);
  }

  /**
   * Получает ID плана подписки по умолчанию
   * @returns ID плана подписки по умолчанию
   */
  public getDefaultSubscriptionPlanId(): string {
    return this.nestConfigService.get<string>('DEFAULT_SUBSCRIPTION_PLAN_ID', '');
  }

  /**
   * Получает имя бота для payment service
   * @returns Имя бота в системе платежей
   */
  public getSubscriptionBotName(): string {
    return this.nestConfigService.get<string>('SUBSCRIPTION_BOT_NAME', 'evernow_ai');
  }

  /**
   * Проверяет включены ли платные подписки
   * @returns true если платные подписки включены
   */
  public isPaidSubscriptionsEnabled(): boolean {
    return this.nestConfigService.get<boolean>('ENABLE_PAID_SUBSCRIPTIONS', true);
  }
}
