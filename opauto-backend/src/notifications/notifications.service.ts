import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(garageId: string, userId?: string) {
    const where: any = { garageId };
    if (userId) where.OR = [{ userId }, { userId: null }];
    return this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async getUnreadCount(garageId: string, userId: string) {
    return this.prisma.notification.count({ where: { garageId, isRead: false, OR: [{ userId }, { userId: null }] } });
  }

  async create(garageId: string, dto: CreateNotificationDto) {
    return this.prisma.notification.create({ data: { ...dto, garageId } });
  }

  async markAsRead(id: string) {
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllAsRead(garageId: string, userId: string) {
    return this.prisma.notification.updateMany({ where: { garageId, isRead: false, OR: [{ userId }, { userId: null }] }, data: { isRead: true } });
  }
}
