import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile, StreamableFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ModuleAccessGuard, RequireModule } from '../modules/module-access.guard';
import { createReadStream } from 'fs';
import type { Response } from 'express';

@ApiTags('maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private service: MaintenanceService) {}

  @Get() findAll(@CurrentUser('garageId') gid: string) { return this.service.findAll(gid); }
  @Get(':id') findOne(@Param('id') id: string, @CurrentUser('garageId') gid: string) { return this.service.findOne(id, gid); }
  @Post() @RequireModule('maintenance') create(@CurrentUser('garageId') gid: string, @Body() dto: CreateMaintenanceDto) { return this.service.create(gid, dto); }
  @Put(':id') @RequireModule('maintenance') update(@Param('id') id: string, @CurrentUser('garageId') gid: string, @Body() dto: UpdateMaintenanceDto) { return this.service.update(id, gid, dto); }
  @Delete(':id') @RequireModule('maintenance') remove(@Param('id') id: string, @CurrentUser('garageId') gid: string) { return this.service.remove(id, gid); }

  @Post(':jobId/tasks') @RequireModule('maintenance')
  addTask(@Param('jobId') jobId: string, @CurrentUser('garageId') gid: string, @Body() dto: CreateTaskDto) {
    return this.service.addTask(jobId, gid, dto);
  }
  @Put(':jobId/tasks/:taskId') @RequireModule('maintenance')
  updateTask(@Param('jobId') jobId: string, @Param('taskId') taskId: string, @CurrentUser('garageId') gid: string, @Body() dto: UpdateTaskDto) {
    return this.service.updateTask(jobId, taskId, gid, dto);
  }
  @Delete(':jobId/tasks/:taskId') @RequireModule('maintenance')
  removeTask(@Param('jobId') jobId: string, @Param('taskId') taskId: string, @CurrentUser('garageId') gid: string) {
    return this.service.removeTask(jobId, taskId, gid);
  }

  // ── Photos ────────────────────────────────────────────────────────
  @Post(':jobId/photos') @RequireModule('maintenance')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadPhoto(
    @Param('jobId') jobId: string,
    @CurrentUser('garageId') gid: string,
    @CurrentUser('id') uid: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() meta: { caption?: string; type?: string },
  ) {
    return this.service.addPhoto(jobId, gid, uid, file, meta);
  }

  @Get(':jobId/photos')
  listPhotos(@Param('jobId') jobId: string, @CurrentUser('garageId') gid: string) {
    return this.service.listPhotos(jobId, gid);
  }

  @Get(':jobId/photos/:photoId/file')
  async getPhotoFile(
    @Param('jobId') jobId: string,
    @Param('photoId') photoId: string,
    @CurrentUser('garageId') gid: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { fullPath, mimeType, originalName } = await this.service.getPhotoFile(jobId, photoId, gid);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${originalName || 'photo'}"`,
    });
    return new StreamableFile(createReadStream(fullPath));
  }

  @Delete(':jobId/photos/:photoId') @RequireModule('maintenance')
  removePhoto(
    @Param('jobId') jobId: string,
    @Param('photoId') photoId: string,
    @CurrentUser('garageId') gid: string,
  ) {
    return this.service.removePhoto(jobId, photoId, gid);
  }
}
