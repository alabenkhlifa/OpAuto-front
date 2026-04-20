import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(UserRole.OWNER)
  findAll(@CurrentUser('garageId') garageId: string) {
    return this.usersService.findAll(garageId);
  }

  @Get('me')
  findMe(@CurrentUser('id') id: string, @CurrentUser('garageId') garageId: string) {
    return this.usersService.findOne(id, garageId);
  }

  @Put('me')
  updateMe(
    @CurrentUser('id') id: string,
    @CurrentUser('garageId') garageId: string,
    @Body() dto: UpdateUserDto,
  ) {
    const { password, role, ...safe } = dto as any;
    return this.usersService.update(id, garageId, safe);
  }

  @Get(':id')
  @Roles(UserRole.OWNER)
  findOne(@Param('id') id: string, @CurrentUser('garageId') garageId: string) {
    return this.usersService.findOne(id, garageId);
  }

  @Post()
  @Roles(UserRole.OWNER)
  create(@CurrentUser('garageId') garageId: string, @Body() dto: CreateUserDto) {
    return this.usersService.create(garageId, dto);
  }

  @Put(':id')
  @Roles(UserRole.OWNER)
  update(@Param('id') id: string, @CurrentUser('garageId') garageId: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, garageId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  remove(@Param('id') id: string, @CurrentUser('garageId') garageId: string) {
    return this.usersService.remove(id, garageId);
  }
}
