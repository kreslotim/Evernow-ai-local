import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsPositive, IsIn, IsOptional, IsBoolean } from 'class-validator';

/**
 * Статусы подписки
 */
export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export class PaymentWebhookDto {
  @ApiProperty({
    description: 'Уникальный идентификатор платежа',
    example: 'payment_123456789',
  })
  @IsString()
  @IsNotEmpty()
  paymentId: string;

  @ApiProperty({
    description: 'ID пользователя, совершившего платеж',
    example: 'cuid123456',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Статус платежа',
    example: 'PAID',
    enum: ['PAID', 'PENDING', 'FAILED', 'CANCELLED'],
  })
  @IsString()
  @IsIn(['PAID', 'PENDING', 'FAILED', 'CANCELLED'])
  status: string;

  @ApiProperty({
    description: 'Сумма платежа',
    example: 9.99,
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    description: 'Количество кредитов для добавления на счет пользователя',
    example: 10,
  })
  @IsNumber()
  @IsPositive()
  generationsAdded: number;

  // ========== Поля для поддержки подписок ==========

  @ApiProperty({
    description: 'ID подписки (для подписочных платежей)',
    example: 'sub_123456789',
    required: false,
  })
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @ApiProperty({
    description: 'Тип подписки',
    example: 'premium_monthly',
    required: false,
  })
  @IsOptional()
  @IsString()
  subscriptionType?: string;

  @ApiProperty({
    description: 'Количество дней подписки',
    example: 30,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  subscriptionDays?: number;

  @ApiProperty({
    description: 'Является ли платеж рекуррентным (автоплатеж)',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiProperty({
    description: 'Токен для рекуррентных платежей',
    example: 'token_abc123',
    required: false,
  })
  @IsOptional()
  @IsString()
  recurringToken?: string;
}

/**
 * DTO для уведомлений о изменениях статуса подписки
 */
export class SubscriptionWebhookDto {
  @ApiProperty({
    description: 'ID подписки',
    example: 'sub_123456789',
  })
  @IsString()
  @IsNotEmpty()
  subscriptionId: string;

  @ApiProperty({
    description: 'ID пользователя',
    example: '123456789',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Статус подписки',
    example: 'ACTIVE',
    enum: SubscriptionStatus,
  })
  @IsString()
  @IsIn(Object.values(SubscriptionStatus))
  status: SubscriptionStatus;

  @ApiProperty({
    description: 'ID тарифного плана',
    example: 'plan_monthly_premium',
  })
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({
    description: 'Дата начала подписки',
    example: '2024-01-15T10:30:00Z',
  })
  @IsString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    description: 'Дата окончания подписки',
    example: '2024-02-15T10:30:00Z',
  })
  @IsString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({
    description: 'Дата следующего списания (для активных подписок)',
    example: '2024-02-15T10:30:00Z',
    required: false,
  })
  @IsOptional()
  @IsString()
  nextBillingDate?: string;

  @ApiProperty({
    description: 'Автопродление включено',
    example: true,
  })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({
    description: 'Автопродление включено',
    example: true,
  })
  @IsBoolean()
  autoRenew: boolean;
}
