import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MarketingCronService } from './marketing-cron.service';
import { NotificationModule } from '../notification/notification.module';
import { I18nModule } from '../../../bot/i18n/i18n.module';

@Module({
  imports: [ScheduleModule.forRoot(), NotificationModule, I18nModule],
  providers: [MarketingCronService],
  exports: [MarketingCronService],
})
export class MarketingModule {}
