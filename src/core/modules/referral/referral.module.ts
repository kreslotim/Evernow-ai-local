import { Module } from '@nestjs/common';
import { ReferralService } from './referral.service';
import { PrismaModule } from 'src/core/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}
