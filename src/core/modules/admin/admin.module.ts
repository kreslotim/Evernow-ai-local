import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './services/admin.service';
import { UserModule } from '../user/user.module';
import { AnalyzeModule } from '../analyze/analyze.module';
import { AuthModule } from '../auth/auth.module';
import { PromptModule } from '../llm/prompt/prompt.module';
import { BotMessageModule } from '../bot-message/bot-message.module';
import { MarketingModule } from '../marketing/marketing.module';
import { MiniAppModule } from '../mini-app/mini-app.module';
import { WelcomePhotoModule } from '../welcome-photo/welcome-photo.module';
import { AdminAuthGuard } from '../../guards';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    UserModule,
    AnalyzeModule,
    AuthModule,
    PromptModule,
    BotMessageModule,
    MarketingModule,
    MiniAppModule,
    WelcomePhotoModule,
    JwtModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminAuthGuard],
  exports: [AdminService, AdminAuthGuard],
})
export class AdminModule {}
