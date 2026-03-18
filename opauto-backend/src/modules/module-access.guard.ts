import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModulesService } from './modules.service';

export const REQUIRE_MODULE_KEY = 'requireModule';
export const RequireModule = (moduleId: string) => SetMetadata(REQUIRE_MODULE_KEY, moduleId);

@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private modulesService: ModulesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleId = this.reflector.getAllAndOverride<string>(REQUIRE_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!moduleId) return true;

    const request = context.switchToHttp().getRequest();
    const garageId = request.user?.garageId;
    if (!garageId) throw new ForbiddenException({ message: 'No garage associated', moduleId });

    const hasAccess = await this.modulesService.hasAccess(garageId, moduleId);
    if (!hasAccess) {
      throw new ForbiddenException({ message: 'Module not purchased', moduleId });
    }

    return true;
  }
}
