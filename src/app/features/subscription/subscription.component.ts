import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModuleService } from '../../core/services/module.service';
import { ModuleId, GarageModule } from '../../core/models/module.model';

const MODULE_EMOJI: Record<string, string> = {
  dashboard: '📊',
  people: '👥',
  car: '🚗',
  calendar: '📅',
  'calendar-view': '📆',
  wrench: '🔧',
  invoice: '📄',
  inventory: '📦',
  team: '👤',
  chart: '📈',
  'check-circle': '✅',
  users: '👥',
  settings: '⚙️',
  sparkle: '🤖',
  bell: '🔔',
};

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modules-page">
      <div class="page-header">
        <h1 class="page-title">Module Marketplace</h1>
        <p class="page-subtitle">Customize your garage with the modules you need</p>
        <div class="stats-row">
          <span class="stat">Active Modules: {{ activeCount() }}</span>
          <span class="stat">Monthly Cost: {{ monthlyCost() }} TND</span>
        </div>
      </div>

      <!-- Free Modules -->
      <h2 class="section-title">Free Modules</h2>
      <div class="modules-grid">
        @for (mod of freeModules(); track mod.id) {
          <div class="glass-card module-card" [class.active]="mod.isActive">
            <div class="module-header">
              <div class="module-icon">{{ getEmoji(mod.icon) }}</div>
              <span class="module-name">{{ mod.name }}</span>
            </div>
            <p class="module-desc">{{ mod.description }}</p>
            <div class="module-footer">
              <span class="module-price free">Free</span>
              <span class="free-badge">Included</span>
            </div>
          </div>
        }
      </div>

      <!-- Paid Modules -->
      <h2 class="section-title">Paid Modules</h2>
      <div class="modules-grid">
        @for (mod of paidModules(); track mod.id) {
          <div class="glass-card module-card" [class.active]="mod.isActive">
            <div class="module-header">
              <div class="module-icon">{{ getEmoji(mod.icon) }}</div>
              <span class="module-name">{{ mod.name }}</span>
            </div>
            <p class="module-desc">{{ mod.description }}</p>
            <div class="module-footer">
              <span class="module-price">{{ mod.price }} TND/month</span>
              <button
                class="activate-btn"
                [class.active]="mod.isActive"
                [class.inactive]="!mod.isActive"
                (click)="toggleModule(mod)">
                {{ mod.isActive ? 'Deactivate' : 'Activate' }}
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .modules-page { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
    .page-header { margin-bottom: 2rem; }
    .page-title { font-size: 1.75rem; font-weight: 700; color: #fff; margin: 0 0 0.5rem; }
    .page-subtitle { color: #94a3b8; margin: 0 0 1rem; }
    .stats-row { display: flex; gap: 1.5rem; }
    .stat { padding: 0.5rem 1rem; border-radius: 10px; background: rgba(255, 132, 0, 0.1); color: #FF8400; font-weight: 600; font-size: 0.875rem; }
    .section-title { font-size: 1.25rem; font-weight: 600; color: #8FA0D8; margin: 1.5rem 0 1rem; }
    .modules-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .module-card { padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; transition: all 0.2s; }
    .module-card:hover { transform: translateY(-2px); }
    .module-card.active { border-color: rgba(255, 132, 0, 0.3); }
    .module-header { display: flex; align-items: center; gap: 0.75rem; }
    .module-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; background: rgba(255, 132, 0, 0.1); }
    .module-name { font-size: 1rem; font-weight: 600; color: #fff; }
    .module-desc { font-size: 0.85rem; color: #94a3b8; line-height: 1.5; }
    .module-footer { display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 0.75rem; border-top: 1px solid rgba(255, 255, 255, 0.05); }
    .module-price { font-size: 1.125rem; font-weight: 700; color: #FF8400; }
    .module-price.free { color: #22c55e; }
    .free-badge { padding: 0.2rem 0.5rem; border-radius: 6px; background: rgba(34, 197, 94, 0.1); color: #22c55e; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
    .activate-btn { padding: 0.5rem 1rem; border-radius: 10px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none; }
    .activate-btn.active { background: rgba(255, 132, 0, 0.15); color: #FF8400; border: 1px solid rgba(255, 132, 0, 0.3); }
    .activate-btn.inactive { background: rgba(18, 15, 61, 0.6); color: #94a3b8; border: 1px solid rgba(255, 255, 255, 0.1); }
    .activate-btn:hover { transform: translateY(-1px); }
  `]
})
export class SubscriptionComponent {
  private moduleService = inject(ModuleService);

  modules = this.moduleService.modules;

  freeModules = computed(() => this.modules().filter(m => m.isFree));
  paidModules = computed(() => this.modules().filter(m => !m.isFree));

  activeCount = computed(() => this.modules().filter(m => m.isActive).length);
  monthlyCost = computed(() =>
    this.modules()
      .filter(m => m.isActive && !m.isFree)
      .reduce((sum, m) => sum + m.price, 0)
  );

  getEmoji(icon: string): string {
    return MODULE_EMOJI[icon] || '📦';
  }

  toggleModule(mod: GarageModule): void {
    if (mod.isActive) {
      this.moduleService.deactivateModule(mod.id);
    } else {
      this.moduleService.purchaseModule(mod.id);
    }
  }
}
