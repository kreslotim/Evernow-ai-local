import { Module } from '@nestjs/common';
import { TimerService } from './timer.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  providers: [TimerService],
  exports: [TimerService],
})
export class TimerModule {}
