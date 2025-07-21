import { Controller, Post, Body, Get, Param, Put, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { AdminAuthGuard } from '../../guards/admin-auth.guard';
import {
  SendFunnelMessageDto,
  FunnelMessageResultDto,
  UpdateUserBlockStatusDto,
} from '../../../common/dtos/notification.dto';
import { UserFunnelAction } from '@prisma/client';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly notificationService: NotificationService) {}

  @Post('funnel/send')
  @ApiOperation({
    summary: 'Send message to users by funnel action',
    description:
      'Send HTML formatted messages to users in specific funnel stages. Automatically handles blocked users.',
  })
  @ApiResponse({
    status: 200,
    description: 'Messages sent successfully',
    type: FunnelMessageResultDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async sendFunnelMessage(@Body() dto: SendFunnelMessageDto): Promise<FunnelMessageResultDto> {
    this.logger.log(`Sending funnel message for action: ${dto.funnelAction}`);

    const result = await this.notificationService.sendFunnelMessage(dto);

    this.logger.log(
      `Funnel message sent: ${result.sentCount} successful, ${result.failedCount} failed, ${result.blockedCount} blocked`,
    );

    return result;
  }
}
