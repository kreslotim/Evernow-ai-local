import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { User, UserFunnelAction, FunnelState } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../user/user.service';

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
  ) {}

  async processReferral(
    referralCode: string,
    newUserId: string,
  ): Promise<{
    referrer: User;
    bonusGranted: boolean;
    referrerBonusGranted: boolean;
  }> {
    try {
      const referrer = await this.prisma.user.findUnique({
        where: { referralCode },
        include: {
          referralsGiven: true,
        },
      });

      if (!referrer) {
        throw new NotFoundException(`Referrer with code ${referralCode} not found`);
      }

      if (referrer.id === newUserId) {
        throw new Error('User cannot refer themselves');
      }

      const existingReferral = await this.prisma.referral.findFirst({
        where: {
          referrerId: referrer.id,
          invitedUserId: newUserId,
        },
      });

      if (existingReferral) {
        this.logger.warn(`Referral already exists for user ${newUserId} from referrer ${referrer.id}`);
        return {
          referrer,
          bonusGranted: false,
          referrerBonusGranted: false,
        };
      }

      await this.prisma.referral.create({
        data: {
          referrerId: referrer.id,
          invitedUserId: newUserId,
        },
      });

      let referrerBonusGranted = false;

      const totalReferrals = referrer.referralsGiven.length + 1;

      // Устанавливаем состояние воронки при достижении 7 рефералов
      if (totalReferrals === 7) {
        await this.userService.updateUser(referrer.id, {
          funnelAction: UserFunnelAction.REFERRAL_INVITE,
          funnelState: FunnelState.INVITED_FRIENDS_7,
        });

        const subscriptionResult = await this.userService.grantFreeSubscription(referrer.id, 'REFERRAL');

        if (subscriptionResult.granted) {
          try {
            // Используем telegramId как fallback если telegramChatId пустой
            const chatId = referrer.telegramChatId || referrer.telegramId;
            await this.notificationService.publishNotification({
              type: 'referral_bonus',
              userId: referrer.id,
              chatId: chatId,
              data: {
                referralCount: '7',
                message: '🎉 Поздравляем! Ты пригласил(а) 7 друзей и получил(а) месяц подписки бесплатно!',
              },
            });
          } catch (notifyError) {
            this.logger.error(`Failed to send subscription bonus notification: ${notifyError.message}`);
          }

          this.logger.log(`User ${referrer.id} got free month subscription for 7 referrals`);
        } else {
          this.logger.log(`User ${referrer.id} already has active subscription, skipping grant for 7 referrals`);
        }
      }

      try {
        // Используем telegramId как fallback если telegramChatId пустой
        const chatId = referrer.telegramChatId || referrer.telegramId;
        this.logger.log(`Sending new referral notification to user ${referrer.id}, chatId: ${chatId}`);

        await this.notificationService.publishNotification({
          type: 'new_referral',
          userId: referrer.id,
          chatId: chatId,
          data: {
            referralCount: totalReferrals.toString(),
          },
        });
      } catch (notifyError) {
        this.logger.error(`Failed to send new referral notification: ${notifyError.message}`);
      }

      if (totalReferrals % 3 === 0) {
        await this.prisma.user.update({
          where: { id: referrer.id },
          data: {
            analysisCredits: { increment: 1 },
          },
        });
        referrerBonusGranted = true;

        try {
          // Используем telegramId как fallback если telegramChatId пустой
          const chatId = referrer.telegramChatId || referrer.telegramId;
          await this.notificationService.publishNotification({
            type: 'referral_bonus',
            userId: referrer.id,
            chatId: chatId,
            data: {
              referralCount: totalReferrals.toString(),
              bonusCredits: '1',
            },
          });
        } catch (notifyError) {
          this.logger.error(`Failed to send referral bonus notification: ${notifyError.message}`);
        }
      }

      return {
        referrer,
        bonusGranted: true,
        referrerBonusGranted,
      };
    } catch (error) {
      this.logger.error(`Failed to process referral: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getReferralStats(userId: string): Promise<{
    totalReferrals: number;
    activeReferrals: number;
    nextBonusAt: number;
  }> {
    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: userId },
      include: {
        invitedUser: {
          select: {
            isBanned: true,
          },
        },
      },
    });

    const totalReferrals = referrals.length;
    const activeReferrals = referrals.filter((r) => !r.invitedUser.isBanned).length;
    const nextBonusAt = 3 - (totalReferrals % 3);

    return {
      totalReferrals,
      activeReferrals,
      nextBonusAt: nextBonusAt === 3 ? 0 : nextBonusAt,
    };
  }
}
