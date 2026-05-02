import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ServicesCatalogService } from './services-catalog.service';
import { CreateServiceCatalogDto } from './dto/create-service-catalog.dto';
import { UpdateServiceCatalogDto } from './dto/update-service-catalog.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('service-catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('service-catalog')
export class ServicesCatalogController {
  constructor(private service: ServicesCatalogService) {}

  // List + detail are readable by anyone authenticated in the garage.
  //
  // Sweep C-21 (S-CAT-009) — added optional `?page=` param. When `page` is
  // present the response is a paginated envelope `{ items, total, page,
  // limit }`; without `page` the legacy flat array is returned (so the
  // service-picker autocomplete keeps working unchanged). The envelope
  // path is what the new admin UI consumes.
  @Get()
  findAll(
    @CurrentUser('garageId') gid: string,
    @Query('includeInactive') includeInactive?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    const parsedLimit =
      limit !== undefined && limit !== '' ? Number(limit) : undefined;
    if (page !== undefined && page !== '') {
      return this.service.findAllPaginated(gid, {
        includeInactive: includeInactive === 'true',
        search,
        limit: parsedLimit,
        page: Number(page),
      });
    }
    return this.service.findAll(
      gid,
      includeInactive === 'true',
      search,
      parsedLimit,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('garageId') gid: string) {
    return this.service.findOne(id, gid);
  }

  // Create / update / delete restricted to OWNER until Phase 3 widens the
  // permission set.
  @Post()
  @Roles(UserRole.OWNER)
  create(
    @CurrentUser('garageId') gid: string,
    @Body() dto: CreateServiceCatalogDto,
  ) {
    return this.service.create(gid, dto);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER)
  update(
    @Param('id') id: string,
    @CurrentUser('garageId') gid: string,
    @Body() dto: UpdateServiceCatalogDto,
  ) {
    return this.service.update(id, gid, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  remove(
    @Param('id') id: string,
    @CurrentUser('garageId') gid: string,
    @Query('hard') hard?: string,
  ) {
    return this.service.remove(id, gid, hard === 'true');
  }
}
