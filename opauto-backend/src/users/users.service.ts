import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(garageId: string) {
    return this.prisma.user.findMany({
      where: { garageId },
      select: {
        id: true, email: true, username: true, firstName: true, lastName: true,
        role: true, avatar: true, phone: true, isActive: true, lastLoginAt: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: string, garageId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, garageId },
      select: {
        id: true, email: true, username: true, firstName: true, lastName: true,
        role: true, avatar: true, phone: true, isActive: true, lastLoginAt: true,
        createdAt: true, updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(garageId: string, dto: CreateUserDto) {
    if (dto.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) throw new ConflictException('Email already in use');
    }
    if (dto.username) {
      const existing = await this.prisma.user.findUnique({ where: { username: dto.username } });
      if (existing) throw new ConflictException('Username already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        ...dto,
        password: hashedPassword,
        garageId,
        role: dto.role || 'STAFF',
      },
      select: {
        id: true, email: true, username: true, firstName: true, lastName: true,
        role: true, avatar: true, phone: true, isActive: true, createdAt: true,
      },
    });
  }

  async update(id: string, garageId: string, dto: UpdateUserDto) {
    await this.findOne(id, garageId);
    const data: any = { ...dto };
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, email: true, username: true, firstName: true, lastName: true,
        role: true, avatar: true, phone: true, isActive: true, createdAt: true,
      },
    });
  }

  async remove(id: string, garageId: string) {
    await this.findOne(id, garageId);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Preferences are 1:1 with user. We upsert on GET so every authenticated
   * user always has a row — simpler than nullable checks in every caller.
   */
  async getPreferences(userId: string) {
    return this.prisma.userPreference.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async updatePreferences(
    userId: string,
    dto: Partial<{
      emailNotifications: boolean;
      smsNotifications: boolean;
      browserNotifications: boolean;
      language: string;
      theme: string;
    }>,
  ) {
    return this.prisma.userPreference.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }
}
