import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ModuleAccessGuard, RequireModule } from '../modules/module-access.guard';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequireModule('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}
  @Get() findAll(@CurrentUser('garageId') gid: string, @CurrentUser('id') uid: string) { return this.service.findAll(gid, uid); }
  @Get('unread-count') getUnreadCount(@CurrentUser('garageId') gid: string, @CurrentUser('id') uid: string) { return this.service.getUnreadCount(gid, uid); }
  @Post() create(@CurrentUser('garageId') gid: string, @Body() dto: CreateNotificationDto) { return this.service.create(gid, dto); }
  @Put(':id/read') markAsRead(@Param('id') id: string) { return this.service.markAsRead(id); }
  @Put('read-all') markAllAsRead(@CurrentUser('garageId') gid: string, @CurrentUser('id') uid: string) { return this.service.markAllAsRead(gid, uid); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
