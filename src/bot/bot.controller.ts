import { Controller, Post, Body, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { BotService } from './services/bot.service';
import { ConfigService } from '../core/modules/config/config.service';

@Controller('webhook')
export class BotController {
  constructor(
    private readonly botService: BotService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  async handleWebhook(@Body() update: any, @Headers('x-telegram-bot-api-secret-token') secretToken: string) {
    if (!this.configService.isProduction()) {
      throw new HttpException('Webhook only available in production', HttpStatus.BAD_REQUEST);
    }

    const expectedSecret = this.configService.getBotWebhookSecret();
    if (secretToken !== expectedSecret) {
      throw new HttpException('Invalid secret token', HttpStatus.UNAUTHORIZED);
    }

    await this.botService.handleWebhookUpdate(update);
    return { status: 'ok' };
  }
}
