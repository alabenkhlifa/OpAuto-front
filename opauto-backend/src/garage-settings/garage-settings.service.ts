import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateGarageDto } from './dto/update-garage.dto';

@Injectable()
export class GarageSettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings(garageId: string) {
    const garage = await this.prisma.garage.findUnique({ where: { id: garageId } });
    if (!garage) throw new NotFoundException('Garage not found');
    return garage;
  }

  async updateSettings(garageId: string, dto: UpdateGarageDto) {
    return this.prisma.garage.update({ where: { id: garageId }, data: dto });
  }
}
