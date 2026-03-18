import { Global, Module } from '@nestjs/common';
import { ModulesService } from './modules.service';
import { ModulesController } from './modules.controller';
import { ModuleAccessGuard } from './module-access.guard';

@Global()
@Module({
  controllers: [ModulesController],
  providers: [ModulesService, ModuleAccessGuard],
  exports: [ModulesService, ModuleAccessGuard],
})
export class ModulesModule {}
