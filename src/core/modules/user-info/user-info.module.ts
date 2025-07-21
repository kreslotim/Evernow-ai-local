import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { UserInfoService } from './user-info.service';

@Module({
  imports: [PrismaModule],
  providers: [UserInfoService],
  exports: [UserInfoService],
})
export class UserInfoModule {}
