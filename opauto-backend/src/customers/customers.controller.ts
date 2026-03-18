import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private service: CustomersService) {}

  @Get()
  findAll(
    @CurrentUser('garageId') garageId: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(garageId, search);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser('garageId') garageId: string,
  ) {
    return this.service.findOne(id, garageId);
  }

  @Post()
  create(
    @CurrentUser('garageId') garageId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.service.create(garageId, dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('garageId') garageId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.service.update(id, garageId, dto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser('garageId') garageId: string,
  ) {
    return this.service.remove(id, garageId);
  }
}
