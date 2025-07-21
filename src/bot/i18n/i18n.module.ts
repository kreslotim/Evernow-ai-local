import { Global, Module } from '@nestjs/common';
import { I18nService } from './i18n.service';
import { BotMessageModule } from '../../core/modules/bot-message/bot-message.module';

@Global()
@Module({
  imports: [BotMessageModule],
  providers: [I18nService],
  exports: [I18nService],
})
export class I18nModule {}
