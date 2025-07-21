import { Module } from '@nestjs/common';
import { SwaggerModule } from '../swagger/swagger.module';
import { HealthModule } from '../health/health.module';
import { AppController } from './app.controller';
import { APP_INTERCEPTOR, RouterModule } from '@nestjs/core';
import { ErrorsInterceptor } from '../../interceptors/errors.interceptor';
import { ConfigModule } from '../config/config.module';
import { ExceptionModule } from '../exception/exception.module';
import { QueueModule } from '../queue/queue.module';
import { PrismaModule } from 'src/core/prisma/prisma.module';
import { AdminModule } from '../admin/admin.module';
import { UserModule } from '../user/user.module';
import { AnalyzeModule } from '../analyze/analyze.module';
import { OpenAIModule } from '../llm/openai/openai.module';
import { BotModule } from 'src/bot/bot.module';
import { NotificationModule } from '../notification/notification.module';
import { SentryModule } from '@sentry/nestjs/setup';
import { AuthModule } from '../auth/auth.module';
import { I18nModule } from '../../../bot/i18n/i18n.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { existsSync } from 'fs';
import { OfferModule } from '../offer/offer.module';
import { TimerModule } from '../timer/timer.module';
import { UserInfoModule } from '../user-info/user-info.module';
import { MiniAppModule } from '../mini-app/mini-app.module';
import { PhilosophyModule } from "../philosophy/philosophy.module";
import { FileModule } from '../file/file.module';

@Module({
    imports: [
        ConfigModule,
        PrismaModule,
        I18nModule,
        UserModule,
        AnalyzeModule,
        OfferModule,
        RouterModule.register([
            {
                path: 'admin/',
                module: OfferModule,
            },
            {
                path: 'admin/',
                module: NotificationModule,
            },
        ]),
        OpenAIModule,
        AdminModule,
        SwaggerModule,
        HealthModule,
        ExceptionModule,
        NotificationModule,
        BotModule,
        QueueModule,
        SentryModule.forRoot(),
        AuthModule,
        ServeStaticModule.forRoot({
            rootPath: (() => {
                // Try multiple possible paths for the admin dist folder
                const possiblePaths = [
                    join(process.cwd(), 'client', 'admin', 'dist'), // From project root
                    join(__dirname, '..', '..', '..', 'client', 'admin', 'dist'), // From dist folder
                    join(__dirname, '..', '..', '..', '..', 'client', 'admin', 'dist'), // Alternative path
                ];

                for (const path of possiblePaths) {
                    if (existsSync(path)) {
                        console.log(`✅ Found admin dist at: ${path}`);
                        return path;
                    }
                }

                console.warn(`❌ Admin dist folder not found. Tried paths:`, possiblePaths);
                return possiblePaths[0]; // Fallback to first path
            })(),
            serveRoot: '/panel',
            exclude: ['/api*'],
            serveStaticOptions: {
                index: 'index.html',
                fallthrough: false,
                // SPA fallback - serve index.html for all non-asset routes
                setHeaders: (res, path) => {
                    if (path.endsWith('.html')) {
                        res.setHeader('Cache-Control', 'no-cache');
                    }
                },
            },
        }),
        TimerModule,
        UserInfoModule,
        MiniAppModule,
        PhilosophyModule,
        FileModule
    ],
    controllers: [AppController],
    providers: [
        {
            useClass: ErrorsInterceptor,
            provide: APP_INTERCEPTOR,
        },
    ],
})
export class AppModule {
}
