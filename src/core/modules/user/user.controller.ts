import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiHeader } from '@nestjs/swagger';
import { UserService } from './user.service';
import { ConfigService } from '../config/config.service';
import { PaymentWebhookDto, SubscriptionWebhookDto } from '../../../common/dtos/payment.dto';

@Controller('user')
@ApiTags('User')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Обработка webhook платежей от микросервиса платежей' })
  @ApiHeader({
    name: 'x-api-key',
    description: 'API ключ для аутентификации',
    required: true,
  })
  @ApiBody({ type: PaymentWebhookDto })
  @ApiResponse({ status: 200, description: 'Webhook обработан успешно' })
  @ApiResponse({ status: 401, description: 'Неавторизован - Неверный API ключ' })
  @ApiResponse({ status: 400, description: 'Неверный запрос - Неверные данные или пользователь не найден' })
  async handlePaymentWebhook(
    @Headers('x-api-key') apiKey: string,
    @Body(ValidationPipe) webhookData: PaymentWebhookDto,
  ) {
    try {
      const expectedApiKey = this.configService.getApiKey();
      if (!apiKey || apiKey !== expectedApiKey) {
        throw new UnauthorizedException('Invalid API key');
      }

      const {
        paymentId,
        userId,
        status,
        amount,
        generationsAdded,
        isRecurring,
        subscriptionId,
        subscriptionDays,
        subscriptionType,
        recurringToken,
      } = webhookData;

      if (status !== 'PAID') {
        return { success: true, message: 'Payment status acknowledged' };
      }

      const user = await this.userService.findUserInfoByTeleramId(userId);
      if (!user) {
        this.logger.error(`User not found: ${userId}`);
        throw new BadRequestException('User not found');
      }

      // Обрабатываем подписочные платежи
      if (isRecurring && subscriptionId && subscriptionDays) {
        this.logger.debug(`Processing subscription payment for user ${userId}`);

        await this.userService.handleSubscriptionPaymentNotification({
          userId,
          telegramId: user.telegramId,
          subscriptionId,
          subscriptionDays,
          amount,
          isRecurring,
        });

        return {
          success: true,
          message: 'Subscription payment processed successfully',
          subscriptionActivated: true,
        };
      }

      // Обрабатываем обычные платежи за кредиты
      if (generationsAdded > 0) {
        await this.userService.addCredits(userId, generationsAdded);

        await this.userService.sendPaymentSuccessNotification({
          userId,
          telegramId: user.telegramId,
          generationsAdded,
          amount,
        });
      }

      return { success: true, message: 'Payment processed successfully' };
    } catch (error) {
      this.logger.error('Error processing payment webhook', error.stack);

      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Error processing payment');
    }
  }

  @Post('subscription-webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Обработка webhook изменений статуса подписки от микросервиса платежей' })
  @ApiHeader({
    name: 'x-api-key',
    description: 'API ключ для аутентификации',
    required: true,
  })
  @ApiBody({ type: SubscriptionWebhookDto })
  @ApiResponse({ status: 200, description: 'Webhook подписки обработан успешно' })
  @ApiResponse({ status: 401, description: 'Неавторизован - Неверный API ключ' })
  @ApiResponse({ status: 400, description: 'Неверный запрос - Неверные данные или пользователь не найден' })
  async handleSubscriptionWebhook(
    @Headers('x-api-key') apiKey: string,
    @Body(ValidationPipe) webhookData: SubscriptionWebhookDto,
  ) {
    try {
      const expectedApiKey = this.configService.getApiKey();
      if (!apiKey || apiKey !== expectedApiKey) {
        throw new UnauthorizedException('Invalid API key');
      }

      const { subscriptionId, userId, status, planId, startDate, endDate, isActive, autoRenew } = webhookData;

      this.logger.debug(`Processing subscription webhook for user ${userId}, status: ${status}`);

      const user = await this.userService.findUserInfoByTeleramId(userId);
      if (!user) {
        this.logger.error(`User not found for subscription webhook: ${userId}`);
        throw new BadRequestException('User not found');
      }

      // Обновляем статус подписки в зависимости от переданного статуса
      switch (status) {
        case 'ACTIVE':
          await this.userService.updateSubscriptionStatus(user.id, true, new Date(endDate));
          this.logger.log(`Subscription ${subscriptionId} activated for user ${userId}`);
          break;

        case 'PAUSED':
          // При паузе подписка остается активной до даты окончания, но автопродление отключается
          await this.userService.updateSubscriptionStatus(
            user.id,
            isActive,
            user.subscriptionExpiry, // Сохраняем текущую дату окончания
          );
          this.logger.log(`Subscription ${subscriptionId} paused for user ${userId}`);
          break;

        case 'CANCELLED':
        case 'EXPIRED':
          await this.userService.deactivateSubscription(user.id);
          this.logger.log(`Subscription ${subscriptionId} ${status.toLowerCase()} for user ${userId}`);
          break;

        default:
          this.logger.warn(`Unknown subscription status: ${status} for user ${userId}`);
      }

      // Отправляем уведомление пользователю об изменении статуса подписки
      await this.sendSubscriptionStatusNotification(user, status, endDate);

      return {
        success: true,
        message: `Subscription status updated to ${status}`,
        subscriptionId,
        userId: user.id,
      };
    } catch (error) {
      this.logger.error('Error processing subscription webhook', error.stack);

      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Error processing subscription webhook');
    }
  }

  /**
   * Отправляет уведомление пользователю об изменении статуса подписки
   * @param user Пользователь
   * @param status Новый статус подписки
   * @param endDate Дата окончания подписки
   */
  private async sendSubscriptionStatusNotification(user: any, status: string, endDate: string): Promise<void> {
    try {
      let messageKey = '';
      let messageData: any = {};

      switch (status) {
        case 'ACTIVE':
          messageKey = 'Ваша подписка активирована';
          messageData = {
            message: `Подписка активна до ${new Date(endDate).toLocaleDateString()}`,
          };
          break;
        case 'PAUSED':
          messageKey = 'Ваша подписка приостановлена';
          messageData = {
            message: 'Подписка приостановлена. Вы можете возобновить её в любое время.',
          };
          break;
        case 'CANCELLED':
          messageKey = 'Ваша подписка отменена';
          messageData = {
            message: 'Подписка отменена. Спасибо за использование нашего сервиса!',
          };
          break;
        case 'EXPIRED':
          messageKey = 'Ваша подписка истекла';
          messageData = {
            message: 'Срок действия подписки истек. Продлите подписку для продолжения использования.',
          };
          break;
      }

      if (messageKey && user.telegramChatId) {
        // Используем существующий NotificationService
        const notificationService = this.userService['notificationService'];
        await notificationService.publishNotification({
          type: 'payment_success', // Используем существующий тип
          userId: user.id,
          chatId: user.telegramChatId,
          data: messageData,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to send subscription status notification: ${error.message}`);
      // Не прерываем основной процесс при ошибке уведомления
    }
  }
}
