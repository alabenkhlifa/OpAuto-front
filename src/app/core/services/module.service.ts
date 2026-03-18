import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ModuleId, GarageModule, MODULE_CATALOG, FREE_MODULES } from '../models/module.model';

@Injectable({ providedIn: 'root' })
export class ModuleService {
  private http = inject(HttpClient);

  private activeModuleIds = signal<ModuleId[]>([]);
  private loaded = false;

  modules = computed<GarageModule[]>(() => {
    const activeIds = this.activeModuleIds();
    return MODULE_CATALOG.map(m => ({
      ...m,
      isActive: activeIds.includes(m.id),
    }));
  });

  activeModules = computed(() => this.modules().filter(m => m.isActive));
  purchasedModules = computed(() => this.modules().filter(m => m.isActive && !m.isFree));

  loadActiveModules(): void {
    if (this.loaded) return;
    this.http.get<any[]>('/modules').subscribe({
      next: (modules) => {
        const ids = modules.map((m: any) => m.moduleId || m.id) as ModuleId[];
        this.activeModuleIds.set([...FREE_MODULES, ...ids]);
        this.loaded = true;
      },
      error: () => {
        // Fallback: activate all modules for demo
        this.activeModuleIds.set(MODULE_CATALOG.map(m => m.id));
        this.loaded = true;
      }
    });
  }

  hasModuleAccess(moduleId: ModuleId): boolean {
    if (FREE_MODULES.includes(moduleId)) return true;
    // If not loaded yet, default to allowing access
    if (!this.loaded) return true;
    return this.activeModuleIds().includes(moduleId);
  }

  getModuleCatalog(): GarageModule[] {
    return this.modules();
  }

  purchaseModule(moduleId: ModuleId) {
    this.http.post(`/modules/${moduleId}/purchase`, {}).subscribe({
      next: () => {
        if (!this.activeModuleIds().includes(moduleId)) {
          this.activeModuleIds.update(ids => [...ids, moduleId]);
        }
      }
    });
  }

  deactivateModule(moduleId: ModuleId) {
    if (FREE_MODULES.includes(moduleId)) return;
    this.http.delete(`/modules/${moduleId}`).subscribe({
      next: () => {
        this.activeModuleIds.update(ids => ids.filter(id => id !== moduleId));
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
