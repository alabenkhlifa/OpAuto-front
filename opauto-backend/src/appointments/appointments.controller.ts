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
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private service: AppointmentsService) {}

  @Get()
  findAll(
    @CurrentUser('garageId') garageId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.findAll(garageId, startDate, endDate);
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
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.service.create(garageId, dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('garageId') garageId: string,
    @Body() dto: UpdateAppointmentDto,
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
