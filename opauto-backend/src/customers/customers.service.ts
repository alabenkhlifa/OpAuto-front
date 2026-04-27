import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll(garageId: string, search?: string) {
    const where: any = { garageId };
    if (search) {
      // Tokenise on whitespace and AND-match each token across the four
      // searchable fields. Without this, a multi-word query like
      // "Ali Ben Salah" misses customer {firstName: "Ali", lastName: "Ben
      // Salah"} because no single column contains the whole string.
      // Single-token queries collapse to the original OR semantics.
      const tokens = search.trim().split(/\s+/).filter((t) => t.length > 0);
      if (tokens.length > 0) {
        where.AND = tokens.map((token) => ({
          OR: [
            { firstName: { contains: token, mode: 'insensitive' } },
            { lastName: { contains: token, mode: 'insensitive' } },
            { phone: { contains: token } },
            { email: { contains: token, mode: 'insensitive' } },
          ],
        }));
      }
    }
    return this.prisma.customer.findMany({
      where,
      include: {
        cars: true,
        _count: { select: { appointments: true, invoices: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, garageId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, garageId },
      include: {
        cars: true,
        appointments: { orderBy: { startTime: 'desc' }, take: 10 },
        invoices: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async create(garageId: string, dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: { ...dto, garageId } });
  }

  async update(id: string, garageId: string, dto: UpdateCustomerDto) {
    await this.findOne(id, garageId);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async remove(id: string, garageId: string) {
    await this.findOne(id, garageId);
    return this.prisma.customer.delete({ where: { id } });
  }
}
