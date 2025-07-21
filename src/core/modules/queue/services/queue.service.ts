import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bullmq';
import { PhotoAnalysisJobDto } from '../../../../common/dtos/photo-analysis-job.dto';
import { QueueNames, JobTypes } from '../../../../common/enums/queue-names.enum';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QueueNames.PHOTO_ANALYSIS)
    private readonly photoAnalysisQueue: Queue,
  ) {}

  public async addPhotoAnalysisJob(
    jobData: PhotoAnalysisJobDto,
    options?: {
      delay?: number;
      priority?: number;
      attempts?: number;
    },
  ): Promise<Job> {
    try {
      const job = await this.photoAnalysisQueue.add(JobTypes.ANALYZE_PHOTO, jobData, {
        delay: options?.delay || 0,
        priority: options?.priority || 0,
        attempts: options?.attempts || 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 10,
        removeOnFail: 5,
      });

      this.logger.log(`Photo analysis job added: ${job.id} for user ${jobData.userId}`);
      return job;
    } catch (error) {
      this.logger.error(`Failed to add photo analysis job: ${error.message}`, error.stack);
      throw error;
    }
  }

  public async getJobStatus(jobId: string): Promise<any> {
    try {
      const job = await this.photoAnalysisQueue.getJob(jobId);
      if (!job) {
        return null;
      }

      return {
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress,
        returnvalue: job.returnvalue,
        finishedOn: job.finishedOn,
        processedOn: job.processedOn,
        failedReason: job.failedReason,
      };
    } catch (error) {
      this.logger.error(`Failed to get job status: ${error.message}`, error.stack);
      throw error;
    }
  }

  public async getQueueStats(): Promise<any> {
    try {
      const waiting = await this.photoAnalysisQueue.getWaiting();
      const active = await this.photoAnalysisQueue.getActive();
      const completed = await this.photoAnalysisQueue.getCompleted();
      const failed = await this.photoAnalysisQueue.getFailed();

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get queue stats: ${error.message}`, error.stack);
      throw error;
    }
  }
}
