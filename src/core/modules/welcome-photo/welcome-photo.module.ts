import { Module } from '@nestjs/common';
import { WelcomePhotoService } from './welcome-photo.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [WelcomePhotoService],
  exports: [WelcomePhotoService],
})
export class WelcomePhotoModule {}
