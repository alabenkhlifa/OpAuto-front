import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
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

      <!-- Calendar & Appointments (grouped) -->
      @if (schedulingTiers(); as tiers) {
        <h2 class="section-title">Calendar & Appointments</h2>
        <div class="modules-grid">
          <!-- Basic (free) -->
          <div class="glass-card module-card active">
            <div class="module-header">
              <div class="module-icon">{{ getEmoji(tiers.basic.icon) }}</div>
              <span class="module-name">{{ tiers.basic.name }}</span>
            </div>
            <p class="module-desc">{{ tiers.basic.description }}</p>
            <div class="module-footer">
              <span class="module-price free">Free</span>
              <span class="free-badge">Included</span>
            </div>
          </div>

          <!-- Advanced (paid) -->
          <div class="glass-card module-card"
               [class.active]="tiers.advanced.isActive"
               [class.cancelled]="isCancelled(tiers.advanced)"
               [class.expired]="isExpired(tiers.advanced)">
            <div class="module-header">
              <div class="module-icon">{{ getEmoji(tiers.advanced.icon) }}</div>
              <div class="module-title-row">
                <span class="module-name">{{ tiers.advanced.name }}</span>
                @if (isExpired(tiers.advanced)) {
                  <span class="expired-badge">Expired</span>
                } @else if (isCancelled(tiers.advanced)) {
                  <span class="cancelled-badge">Cancelled</span>
                }
              </div>
            </div>
            <p class="module-desc">{{ tiers.advanced.description }}</p>
            @if (tiers.advanced.isActive && tiers.advanced.expiresAt) {
              <div class="expiry-info">
                @if (isCancelled(tiers.advanced)) {
                  <span class="expiry-text cancelled-text">Access ends in {{ getDaysRemaining(tiers.advanced) }} days</span>
                } @else {
                  <span class="expiry-text">{{ getDaysRemaining(tiers.advanced) }} days remaining</span>
                }
              </div>
            }
            <div class="module-footer">
              <span class="module-price">{{ tiers.advanced.price }} TND/month</span>
              @if (isExpired(tiers.advanced)) {
                <button class="activate-btn renew" (click)="renewModule(tiers.advanced)">Renew</button>
              } @else if (isCancelled(tiers.advanced)) {
                <button class="activate-btn renew" (click)="renewModule(tiers.advanced)">Reactivate</button>
              } @else if (tiers.advanced.isActive) {
                <button class="activate-btn deactivate" (click)="toggleModule(tiers.advanced)">Deactivate</button>
              } @else {
                <button class="activate-btn inactive" (click)="toggleModule(tiers.advanced)">Activate</button>
              }
            </div>
          </div>
        </div>
      }

      <!-- Free Modules -->
      <h2 class="section-title">Free Modules</h2>
      <div class="modules-grid">
        @for (mod of freeModules(); track mod.id) {
          <div class="glass-card module-card active">
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
          <div class="glass-card module-card" [class.active]="mod.isActive" [class.cancelled]="isCancelled(mod)" [class.expired]="isExpired(mod)">
            <div class="module-header">
              <div class="module-icon">{{ getEmoji(mod.icon) }}</div>
              <div class="module-title-row">
                <span class="module-name">{{ mod.name }}</span>
                @if (isExpired(mod)) {
                  <span class="expired-badge">Expired</span>
                } @else if (isCancelled(mod)) {
                  <span class="cancelled-badge">Cancelled</span>
                }
              </div>
            </div>
            <p class="module-desc">{{ mod.description }}</p>
            @if (mod.isActive && mod.expiresAt) {
              <div class="expiry-info">
                @if (isCancelled(mod)) {
                  <span class="expiry-text cancelled-text">Access ends in {{ getDaysRemaining(mod) }} days</span>
                } @else {
                  <span class="expiry-text">{{ getDaysRemaining(mod) }} days remaining</span>
                }
              </div>
            }
            <div class="module-footer">
              <span class="module-price">{{ mod.price }} TND/month</span>
              @if (isExpired(mod)) {
                <button class="activate-btn renew" (click)="renewModule(mod)">Renew</button>
              } @else if (isCancelled(mod)) {
                <button class="activate-btn renew" (click)="renewModule(mod)">Reactivate</button>
              } @else if (mod.isActive) {
                <button class="activate-btn deactivate" (click)="toggleModule(mod)">Deactivate</button>
              } @else {
                <button class="activate-btn inactive" (click)="toggleModule(mod)">Activate</button>
              }
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Deactivation Confirmation Dialog -->
    @if (confirmingDeactivation()) {
      <div class="dialog-overlay" (click)="cancelDeactivation()">
        <div class="dialog-box glass-card" (click)="$event.stopPropagation()">
          <h3 class="dialog-title">Deactivate Module</h3>
          <p class="dialog-text">Are you sure you want to cancel <strong>{{ confirmingDeactivation()!.name }}</strong>? You'll keep access until your current billing period ends. Your data will be preserved and restored if you reactivate later.</p>
          <div class="dialog-actions">
            <button class="activate-btn inactive" (click)="cancelDeactivation()">Cancel</button>
            <button class="activate-btn deactivate" (click)="confirmDeactivation()">Deactivate</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modules-page { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
    .page-header { margin-bottom: 2rem; padding: 1.5rem; background: linear-gradient(135deg, #fff7ed, #fef3c7); border-radius: 20px; border: 1px solid #fed7aa; }
    .page-title { font-size: 1.75rem; font-weight: 700; color: #111827; margin: 0 0 0.5rem; }
    .page-subtitle { color: #6b7280; margin: 0 0 1rem; }
    .stats-row { display: flex; gap: 1.5rem; }
    .stat { padding: 0.5rem 1rem; border-radius: 10px; background: rgba(255, 132, 0, 0.1); color: #FF8400; font-weight: 600; font-size: 0.875rem; }
    .section-title { font-size: 1.25rem; font-weight: 600; color: #374151; margin: 1.5rem 0 1rem; }
    .modules-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .module-card { padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; transition: all 0.2s; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; }
    .module-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); }
    .module-card.active { border-color: rgba(255, 132, 0, 0.3); background: #fffbf5; }
    .module-card.expired { border-color: rgba(239, 68, 68, 0.3); background: #fef2f2; }
    .module-card.cancelled { border-color: rgba(251, 191, 36, 0.3); background: #fffbeb; }
    .cancelled-badge { padding: 0.15rem 0.4rem; border-radius: 6px; background: rgba(251, 191, 36, 0.15); color: #b45309; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; }
    .cancelled-text { color: #b45309 !important; }
    .module-header { display: flex; align-items: center; gap: 0.75rem; }
    .module-title-row { display: flex; align-items: center; gap: 0.5rem; }
    .module-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; background: #fff7ed; }
    .module-name { font-size: 1rem; font-weight: 600; color: #111827; }
    .module-desc { font-size: 0.85rem; color: #6b7280; line-height: 1.5; }
    .module-footer { display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 0.75rem; border-top: 1px solid #f1f5f9; }
    .module-price { font-size: 1.125rem; font-weight: 700; color: #FF8400; }
    .module-price.free { color: #16a34a; }
    .free-badge { padding: 0.2rem 0.5rem; border-radius: 6px; background: rgba(34, 197, 94, 0.1); color: #16a34a; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
    .expired-badge { padding: 0.15rem 0.4rem; border-radius: 6px; background: rgba(239, 68, 68, 0.1); color: #dc2626; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; }
    .expiry-info { padding: 0.35rem 0.6rem; border-radius: 8px; background: rgba(255, 132, 0, 0.06); }
    .expiry-text { font-size: 0.75rem; color: #FF8400; font-weight: 500; }
    .activate-btn { padding: 0.5rem 1rem; border-radius: 10px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none; }
    .activate-btn.active { background: rgba(255, 132, 0, 0.1); color: #FF8400; border: 1px solid rgba(255, 132, 0, 0.3); }
    .activate-btn.inactive { background: #f3f4f6; color: #6b7280; border: 1px solid #d1d5db; }
    .activate-btn.renew { background: rgba(255, 132, 0, 0.1); color: #FF8400; border: 1px solid rgba(255, 132, 0, 0.4); }
    .activate-btn.deactivate { background: rgba(239, 68, 68, 0.08); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.3); }
    .activate-btn:hover { transform: translateY(-1px); }

    .dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 50; }
    .dialog-box { max-width: 420px; width: 90%; padding: 1.5rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; box-shadow: 0 25px 50px rgba(0,0,0,0.15); }
    .dialog-title { color: #111827; font-size: 1.1rem; font-weight: 600; margin: 0 0 0.75rem; }
    .dialog-text { color: #6b7280; font-size: 0.9rem; line-height: 1.5; margin: 0 0 1.25rem; }
    .dialog-text strong { color: #111827; }
    .dialog-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
  `]
})
export class SubscriptionComponent {
  private moduleService = inject(ModuleService);

  modules = this.moduleService.modules;
  confirmingDeactivation = signal<GarageModule | null>(null);

  schedulingTiers = computed(() => {
    const all = this.modules();
    const basic = all.find(m => m.id === 'appointments');
    const advanced = all.find(m => m.id === 'calendar');
    if (!basic || !advanced) return null;
    return { basic, advanced };
  });

  freeModules = computed(() =>
    this.modules().filter(m => m.isFree && m.id !== 'appointments')
  );
  paidModules = computed(() =>
    this.modules().filter(m => !m.isFree && m.id !== 'calendar')
  );

  activeCount = computed(() => this.modules().filter(m => m.isActive).length);
  monthlyCost = computed(() =>
    this.modules()
      .filter(m => m.isActive && !m.isFree && m.willRenew)
      .reduce((sum, m) => sum + m.price, 0)
  );

  getEmoji(icon: string): string {
    return MODULE_EMOJI[icon] || '📦';
  }

  isExpired(mod: GarageModule): boolean {
    if (!mod.expiresAt) return false;
    return new Date(mod.expiresAt) < new Date();
  }

  isCancelled(mod: GarageModule): boolean {
    return mod.isActive && !mod.willRenew && !this.isExpired(mod);
  }

  getDaysRemaining(mod: GarageModule): number {
    if (!mod.expiresAt) return 0;
    const diff = new Date(mod.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  toggleModule(mod: GarageModule): void {
    if (mod.isActive) {
      this.confirmingDeactivation.set(mod);
    } else {
      this.moduleService.purchaseModule(mod.id);
    }
  }

  renewModule(mod: GarageModule): void {
    this.moduleService.purchaseModule(mod.id);
  }

  confirmDeactivation(): void {
    const mod = this.confirmingDeactivation();
    if (mod) {
      this.moduleService.deactivateModule(mod.id);
      this.confirmingDeactivation.set(null);
    }
  }

  cancelDeactivation(): void {
    this.confirmingDeactivation.set(null);
  }
}
