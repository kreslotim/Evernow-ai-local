import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import * as joi from 'joi';
import { ConfigService } from './config.service';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      validationSchema: joi.object({
        NODE_ENV: joi.string().valid('development', 'production').default('development'),
        APP_PORT: joi.number().optional().default(4001),
        BOT_TOKEN: joi.string().required(),
        BOT_WEBHOOK_URL: joi.string().when('NODE_ENV', {
          is: 'production',
          then: joi.required(),
          otherwise: joi.optional(),
        }),
        BOT_WEBHOOK_PATH: joi.string().default('/webhook'),
        BOT_WEBHOOK_SECRET: joi.string().when('NODE_ENV', {
          is: 'production',
          then: joi.required(),
          otherwise: joi.optional(),
        }),
        DATABASE_URL: joi.string().required(),
        REDIS_URL: joi.string().required(),
        API_KEY: joi.string().required(),
        REQUIRED_CHANNELS: joi.string().default(''),
        SUBSCRIPTION_CHECK_ACTIVE: joi.boolean().default(false),
        TELEGRAM_SUPPORT_USERNAME: joi.string().required(),
        PAYMENT_SERVICE_API_URL: joi.string().required(),
        PAYMENT_SERVICE_API_KEY: joi.string().required(),
        BOT_USERNAME: joi.string().required(),
        OPENAI_API_KEY: joi.string().required(),
        OPENAI_MODEL: joi.string().required(),
        SUMMARY_OPENAI_MODEL: joi.string().required(),
        SENTRY_DSN: joi.string().required(),
        ADMIN_PASSWORD: joi.string().required(),
        JWT_SECRET: joi.string().required(),
        JWT_EXPIRES_IN: joi.string().default('24h'),
      }),
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
