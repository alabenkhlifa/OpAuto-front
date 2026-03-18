import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CarsService } from './cars.service';
import { CreateCarDto } from './dto/create-car.dto';
import { UpdateCarDto } from './dto/update-car.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('cars')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cars')
export class CarsController {
  constructor(private service: CarsService) {}

  @Get()
  findAll(@CurrentUser('garageId') garageId: string) {
    return this.service.findAll(garageId);
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
    @Body() dto: CreateCarDto,
  ) {
    return this.service.create(garageId, dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('garageId') garageId: string,
    @Body() dto: UpdateCarDto,
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
