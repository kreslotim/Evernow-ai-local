import { Module } from '@nestjs/common';
import { OfferController } from './offer.controller';
import { OfferService } from './offer.service';
import { ConfigModule } from '../config/config.module';
import { AdminAuthGuard } from '../../guards';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [ConfigModule, JwtModule],
  controllers: [OfferController],
  providers: [OfferService, AdminAuthGuard],
  exports: [OfferService, AdminAuthGuard],
})
export class OfferModule {}
