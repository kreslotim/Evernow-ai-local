import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from 'src/core/modules/config/config.service';

export interface MSProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  generations: number;
  currency?: string;
  botName: string;
  paymentId: string;
  paymentLink: string;
}

export interface PaymentUpdateData {
  userId?: string;
  username?: string;
  amount?: number;
  status?: string;
  generationsAdded?: number;
  productId?: string;
}

/**
 * Интерфейс для тарифного плана подписки
 */
export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration: number; // Количество дней
  durationType: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  features?: string[];
  isActive: boolean;
}

/**
 * Интерфейс для подписки пользователя
 */
export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';
  startDate: string;
  endDate: string;
  nextBillingDate?: string;
  autoRenew: boolean;
  plan: SubscriptionPlan;
}

/**
 * Интерфейс для ответа при создании подписки
 */
export interface CreateSubscriptionResponse {
  subscription: Subscription;
  paymentLink: string;
  paymentId: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly httpClient: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const baseURL = this.configService.getPaymentServiceApiUrl();
    const apiKey = this.configService.getPaymentServiceApiKey();

    this.httpClient = axios.create({
      baseURL,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  /**
   * Получение продуктов из микросервиса платежей
   * @param botName Имя бота для фильтрации продуктов
   * @returns Список продуктов
   */
  async getProductsFromMS(botName: string): Promise<MSProduct[]> {
    try {
      this.logger.debug(`Fetching products for bot: ${botName}`);

      const response = await this.httpClient.get<MSProduct[]>(`/api/products/${botName}`);

      this.logger.debug(`Fetched ${response.data.length} products`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching products for bot ${botName}:`, error.message);
      throw new Error(`Failed to fetch products: ${error.message}`);
    }
  }

  /**
   * Обновление платежа в микросервисе
   * @param paymentId ID платежа
   * @param updateData Данные для обновления
   * @returns Обновленные данные платежа
   */
  async updatePaymentOnMS(paymentId: string, updateData: PaymentUpdateData): Promise<any> {
    try {
      const response = await this.httpClient.patch(`/api/payments/${paymentId}`, updateData);

      this.logger.debug(`Payment ${paymentId} updated successfully`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error updating payment ${paymentId}:`, error.message);
      throw new Error(`Failed to update payment: ${error.message}`);
    }
  }

  /**
   * Создание новой подписки для пользователя
   * @param userId ID пользователя в Telegram
   * @param username Имя пользователя в Telegram
   * @param planId ID тарифного плана
   * @returns Данные созданной подписки и ссылка на оплату
   */
  async createSubscription(userId: string, username: string, planId: string): Promise<CreateSubscriptionResponse> {
    try {
      this.logger.debug(`Creating subscription for user ${userId} with plan ${planId}`);

      const response = await this.httpClient.post<CreateSubscriptionResponse>('/api/subscriptions', {
        userId,
        username,
        planId,
      });

      this.logger.debug(`Subscription created successfully for user ${userId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error creating subscription for user ${userId}:`, error.message);
      throw new Error(`Failed to create subscription: ${error.message}`);
    }
  }

  /**
   * Получение статуса подписки пользователя
   * @param userId ID пользователя в Telegram
   * @returns Информация о подписке пользователя
   */
  async getSubscriptionStatus(userId: string): Promise<Subscription | null> {
    try {
      this.logger.debug(`Fetching subscription status for user ${userId}`);

      const response = await this.httpClient.get<Subscription>(`/api/subscriptions/user/${userId}`);

      this.logger.debug(`Subscription status fetched for user ${userId}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        this.logger.debug(`No active subscription found for user ${userId}`);
        return null;
      }
      this.logger.error(`Error fetching subscription status for user ${userId}:`, error.message);
      throw new Error(`Failed to fetch subscription status: ${error.message}`);
    }
  }

  /**
   * Отмена подписки пользователя
   * @param subscriptionId ID подписки
   * @param userId ID пользователя для проверки прав
   * @returns Обновленная информация о подписке
   */
  async cancelSubscription(subscriptionId: string, userId: string): Promise<Subscription> {
    try {
      this.logger.debug(`Cancelling subscription ${subscriptionId} for user ${userId}`);

      const response = await this.httpClient.post<Subscription>(`/api/subscriptions/${subscriptionId}/cancel`, {
        userId,
      });

      this.logger.debug(`Subscription ${subscriptionId} cancelled successfully`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error cancelling subscription ${subscriptionId}:`, error.message);
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }

  /**
   * Приостановка подписки пользователя
   * @param subscriptionId ID подписки
   * @param userId ID пользователя для проверки прав
   * @returns Обновленная информация о подписке
   */
  async pauseSubscription(subscriptionId: string, userId: string): Promise<Subscription> {
    try {
      this.logger.debug(`Pausing subscription ${subscriptionId} for user ${userId}`);

      const response = await this.httpClient.post<Subscription>(`/api/subscriptions/${subscriptionId}/pause`, {
        userId,
      });

      this.logger.debug(`Subscription ${subscriptionId} paused successfully`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error pausing subscription ${subscriptionId}:`, error.message);
      throw new Error(`Failed to pause subscription: ${error.message}`);
    }
  }

  /**
   * Возобновление приостановленной подписки
   * @param subscriptionId ID подписки
   * @param userId ID пользователя для проверки прав
   * @returns Обновленная информация о подписке
   */
  async resumeSubscription(subscriptionId: string, userId: string): Promise<Subscription> {
    try {
      this.logger.debug(`Resuming subscription ${subscriptionId} for user ${userId}`);

      const response = await this.httpClient.post<Subscription>(`/api/subscriptions/${subscriptionId}/resume`, {
        userId,
      });

      this.logger.debug(`Subscription ${subscriptionId} resumed successfully`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error resuming subscription ${subscriptionId}:`, error.message);
      throw new Error(`Failed to resume subscription: ${error.message}`);
    }
  }

  /**
   * Получение доступных тарифных планов для бота
   * @param botName Имя бота для фильтрации планов
   * @returns Список доступных тарифных планов
   */
  async getSubscriptionPlans(botName: string): Promise<SubscriptionPlan[]> {
    try {
      this.logger.debug(`Fetching subscription plans for bot: ${botName}`);

      const response = await this.httpClient.get<SubscriptionPlan[]>(`/api/subscription-plans/${botName}`);

      this.logger.debug(`Fetched ${response.data.length} subscription plans`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching subscription plans for bot ${botName}:`, error.message);
      throw new Error(`Failed to fetch subscription plans: ${error.message}`);
    }
  }
}
