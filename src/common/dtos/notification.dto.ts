import { IsEnum, IsString, IsNotEmpty, IsArray, IsOptional, MinLength, MaxLength, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserFunnelAction } from '@prisma/client';

export class SendFunnelMessageDto {
  @ApiProperty({
    description: 'Funnel action to target users, or "all" for all users',
    enum: [...Object.values(UserFunnelAction), 'all'],
    example: 'WAITING_FIRST_PHOTO',
  })
  @IsIn([...Object.values(UserFunnelAction), 'all'])
  funnelAction: UserFunnelAction | 'all';

  @ApiProperty({
    description: 'Message text to send (HTML format supported)',
    example: '<b>Привет!</b> У нас для вас есть специальное предложение 🎁',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(4096)
  message: string;
}

export class FunnelMessageResultDto {
  @ApiProperty({
    description: 'Number of messages sent successfully',
  })
  sentCount: number;

  @ApiProperty({
    description: 'Number of messages that failed to send',
  })
  failedCount: number;

  @ApiProperty({
    description: 'Number of users that had the bot blocked',
  })
  blockedCount: number;

  @ApiProperty({
    description: 'Total number of users targeted',
  })
  totalTargeted: number;

  @ApiProperty({
    description: 'List of failed user IDs with reasons',
    required: false,
  })
  failedUsers?: Array<{
    userId: string;
    reason: string;
  }>;
}

export class UpdateUserBlockStatusDto {
  @ApiProperty({
    description: 'User ID to update',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Whether the bot is blocked by this user',
  })
  @IsOptional()
  isBotBlocked?: boolean;
}
