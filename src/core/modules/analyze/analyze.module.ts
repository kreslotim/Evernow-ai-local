import { forwardRef, Module } from '@nestjs/common';
import { AnalyzeService } from './analyze.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [forwardRef(() => QueueModule)],
  providers: [AnalyzeService],
  exports: [AnalyzeService],
})
export class AnalyzeModule {}
