import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserInfo, Prisma } from '@prisma/client';

/**
 * Сервис для работы с моделью UserInfo
 */
@Injectable()
export class UserInfoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Создаёт запись UserInfo с любым набором поддерживаемых полей.
   * Используем тип Prisma.UserInfoUncheckedCreateInput, чтобы можно было
   * передавать scalar-поля без необходимости указывать вложенные объекты.
   */
  async create(data: Prisma.UserInfoUncheckedCreateInput): Promise<UserInfo> {
    return this.prisma.userInfo.create({
      data,
    });
  }

  /**
   * Возвращает все записи по пользователю
   */
  async getByUser(userId: string): Promise<UserInfo[]> {
    return this.prisma.userInfo.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Возвращает последнюю запись по пользователю
   */
  async getLatest(userId: string): Promise<UserInfo | null> {
    return this.prisma.userInfo.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Обновляет запись UserInfo, принимая любой допустимый набор полей.
   */
  async update(id: string, data: Prisma.UserInfoUncheckedUpdateInput): Promise<UserInfo> {
    return this.prisma.userInfo.update({
      where: { id },
      data,
    });
  }
}
