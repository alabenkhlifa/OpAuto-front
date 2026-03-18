import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ModuleId, GarageModule, MODULE_CATALOG, FREE_MODULES } from '../models/module.model';

interface ActiveModuleInfo {
  id: ModuleId;
  willRenew: boolean;
  purchasedAt?: string;
  expiresAt?: string;
}

@Injectable({ providedIn: 'root' })
export class ModuleService {
  private http = inject(HttpClient);

  private activeModuleInfos = signal<ActiveModuleInfo[]>([]);
  private activeModuleIds = signal<ModuleId[]>([]);
  private loaded = false;
  isLoaded = signal(false);

  modules = computed<GarageModule[]>(() => {
    const activeIds = this.activeModuleIds();
    const infos = this.activeModuleInfos();
    return MODULE_CATALOG.map(m => {
      const info = infos.find(i => i.id === m.id);
      return {
        ...m,
        isActive: activeIds.includes(m.id),
        willRenew: info?.willRenew ?? m.isFree,
        purchasedAt: info?.purchasedAt,
        expiresAt: info?.expiresAt,
      };
    });
  });

  activeModules = computed(() => this.modules().filter(m => m.isActive));
  purchasedModules = computed(() => this.modules().filter(m => m.isActive && !m.isFree));

  loadActiveModules(): void {
    if (this.loaded) return;
    this.http.get<any[]>('/modules').subscribe({
      next: (modules) => {
        const infos: ActiveModuleInfo[] = modules.map((m: any) => ({
          id: (m.moduleId || m.id) as ModuleId,
          willRenew: m.isActive !== false,
          purchasedAt: m.purchasedAt,
          expiresAt: m.expiresAt,
        }));
        const ids = infos.map(i => i.id);
        this.activeModuleInfos.set(infos);
        this.activeModuleIds.set([...FREE_MODULES, ...ids]);
        this.loaded = true;
        this.isLoaded.set(true);
      },
      error: () => {
        // Fail-closed: only free modules on error
        this.activeModuleIds.set([...FREE_MODULES]);
        this.activeModuleInfos.set([]);
        this.loaded = true;
        this.isLoaded.set(true);
      }
    });
  }

  hasModuleAccess(moduleId: ModuleId): boolean {
    if (FREE_MODULES.includes(moduleId)) return true;
    if (!this.loaded) return false;
    return this.activeModuleIds().includes(moduleId);
  }

  getModuleCatalog(): GarageModule[] {
    return this.modules();
  }

  getModuleExpiry(moduleId: ModuleId): { purchasedAt?: string; expiresAt?: string } | null {
    const info = this.activeModuleInfos().find(i => i.id === moduleId);
    return info ? { purchasedAt: info.purchasedAt, expiresAt: info.expiresAt } : null;
  }

  purchaseModule(moduleId: ModuleId) {
    return this.http.post<any>(`/modules/${moduleId}/purchase`, {}).subscribe({
      next: (result) => {
        if (!this.activeModuleIds().includes(moduleId)) {
          this.activeModuleIds.update(ids => [...ids, moduleId]);
        }
        this.activeModuleInfos.update(infos => {
          const filtered = infos.filter(i => i.id !== moduleId);
          return [...filtered, { id: moduleId, willRenew: true, purchasedAt: result.purchasedAt, expiresAt: result.expiresAt }];
        });
      }
    });
  }

  deactivateModule(moduleId: ModuleId) {
    if (FREE_MODULES.includes(moduleId)) return;
    this.http.delete(`/modules/${moduleId}`).subscribe({
      next: () => {
        // Module is cancelled but access stays until expiresAt — reload from backend
        this.loaded = false;
        this.loadActiveModules();
      }
    });
  }

  getRouteModule(route: string): ModuleId | null {
    const routeMap: Record<string, ModuleId> = {
      '/calendar': 'calendar',
      '/maintenance': 'maintenance',
      '/invoices': 'invoicing',
      '/inventory': 'inventory',
      '/employees': 'employees',
      '/reports': 'reports',
      '/approvals': 'approvals',
      '/users': 'users',
      '/settings': 'settings',
      '/notifications': 'notifications',
    };
    return routeMap[route] || null;
  }
}
