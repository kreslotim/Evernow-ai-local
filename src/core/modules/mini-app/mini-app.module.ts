import { Module } from '@nestjs/common';
import { MiniAppController } from './mini-app.controller';
import { MiniAppService } from './mini-app.service';
import { UserModule } from '../user/user.module';
import { UserInfoModule } from '../user-info/user-info.module';
import { AnalyzeModule } from '../analyze/analyze.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * Модуль мини-приложения Telegram
 * Обслуживает веб-интерфейс для расширенного онбординга
 */
@Module({
  imports: [UserModule, UserInfoModule, AnalyzeModule, AuthModule, NotificationModule, ConfigModule, PrismaModule],
  controllers: [MiniAppController],
  providers: [MiniAppService],
  exports: [MiniAppService],
})
export class MiniAppModule {}
