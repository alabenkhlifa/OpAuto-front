import { Component, Input, Output, EventEmitter, computed, OnInit, OnDestroy, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ModuleService } from '../../../core/services/module.service';
import { ModuleId, MODULE_CATALOG } from '../../../core/models/module.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AccessibilityService } from '../../services/accessibility.service';

export interface FeatureLockConfig {
  feature: string;
  moduleId?: ModuleId;
  title?: string;
  description?: string;
  showUpgradeButton?: boolean;
  customMessage?: string;
}

@Component({
  selector: 'app-feature-lock',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="feature-container" [class.feature-locked]="isLocked()">
      <ng-content></ng-content>

      @if (isLocked() && shouldShowOverlay()) {
        <div class="feature-lock-overlay"
             role="dialog"
             aria-modal="true"
             [attr.aria-label]="getLockAriaLabel()"
             tabindex="0">

          <div class="lock-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 10V8C6 5.79086 7.79086 4 10 4H14C16.2091 4 18 5.79086 18 8V10M6 10H18M6 10C4.89543 10 4 10.8954 4 12V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V12C20 10.8954 19.1046 10 18 10"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"/>
            </svg>
          </div>

          <div class="lock-text">
            {{ getLockMessage() | translate }}
          </div>

          @if (config.showUpgradeButton !== false) {
            <button
              class="upgrade-cta"
              (click)="onUpgradeClick()"
              [attr.aria-label]="getUpgradeAriaLabel()"
              type="button">
              {{ 'modules.browse' | translate }}
            </button>
          }

          @if (config.showUpgradeButton !== false && getRequiredModuleName()) {
            <div class="module-info">
              {{ 'modules.requiredModule' | translate: { module: getRequiredModuleName() } }}
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .feature-container {
      position: relative;
    }

    .module-info {
      font-size: 0.75rem;
      color: #9ca3af;
      margin-top: 0.25rem;
      text-align: center;
    }
  `]
})
export class FeatureLockComponent implements OnInit, OnDestroy {
  @Input() config: FeatureLockConfig = { feature: '', showUpgradeButton: true };
  @Input() feature: string = '';
  @Input() moduleId?: ModuleId;
  @Input() title?: string;
  @Input() description?: string;
  @Input() showUpgradeButton: boolean = true;
  @Input() customMessage?: string;
  @Input() showOverlayInput: boolean = true;

  @Output() upgradeClicked = new EventEmitter<{ feature: string; moduleId?: ModuleId }>();

  // Computed signal for reactive state using ModuleService
  isLocked = computed(() => {
    const resolvedModuleId = this.getModuleId();
    if (!resolvedModuleId) return false;

    return !this.moduleService.hasModuleAccess(resolvedModuleId);
  });

  private escapeKeyHandler?: () => void;

  constructor(
    private moduleService: ModuleService,
    private accessibilityService: AccessibilityService,
    private elementRef: ElementRef<HTMLElement>,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Set up escape key handler for overlay
    if (this.isLocked() && this.showOverlayInput) {
      this.escapeKeyHandler = this.accessibilityService.handleEscapeKey(() => {
        // Focus back to the main content when overlay is dismissed via keyboard
        this.accessibilityService.announce('Feature lock overlay dismissed', 'polite');
      });
    }

    // Announce feature lock status to screen readers when component initializes
    if (this.isLocked()) {
      const featureName = this.config?.title || this.title || this.getFeatureKey();
      const moduleName = this.getRequiredModuleName();
      this.accessibilityService.announceFeatureLock(featureName, moduleName);
    }
  }

  ngOnDestroy(): void {
    if (this.escapeKeyHandler) {
      this.escapeKeyHandler();
    }
  }

  private getFeatureKey(): string {
    return this.config?.feature || this.feature || '';
  }

  private getModuleId(): ModuleId | null {
    return this.config?.moduleId || this.moduleId || null;
  }

  shouldShowOverlay(): boolean {
    return this.showOverlayInput;
  }

  getLockMessage(): string {
    if (this.config?.customMessage) return this.config.customMessage;
    if (this.customMessage) return this.customMessage;

    const moduleName = this.getRequiredModuleName();
    if (moduleName) {
      return 'modules.featureLockedWithModule';
    }

    return 'modules.featureLocked';
  }

  getLockAriaLabel(): string {
    const featureName = this.config?.title || this.title || this.getFeatureKey();
    return `Feature ${featureName} is locked. Module purchase required.`;
  }

  getUpgradeAriaLabel(): string {
    const moduleName = this.getRequiredModuleName();
    return moduleName
      ? `Purchase ${moduleName} module to unlock this feature`
      : 'Browse modules to unlock this feature';
  }

  getRequiredModuleName(): string | null {
    const resolvedModuleId = this.getModuleId();
    if (!resolvedModuleId) return null;

    const module = MODULE_CATALOG.find(m => m.id === resolvedModuleId);
    return module?.name || null;
  }

  onUpgradeClick(): void {
    const featureKey = this.getFeatureKey();
    const resolvedModuleId = this.getModuleId();

    // Announce the action to screen readers
    const moduleName = this.getRequiredModuleName() || 'a module';
    this.accessibilityService.announce(`Opening modules page to purchase ${moduleName}`, 'polite');

    this.upgradeClicked.emit({
      feature: featureKey,
      moduleId: resolvedModuleId || undefined
    });

    // Navigate to modules page
    this.router.navigate(['/modules']);
  }

  // Method to check module access (for programmatic use)
  hasFeatureAccess(): boolean {
    const resolvedModuleId = this.getModuleId();
    if (!resolvedModuleId) return true;

    return this.moduleService.hasModuleAccess(resolvedModuleId);
  }

  // Method to get module info (for programmatic use)
  getModuleInfo(): { moduleId: ModuleId | null; name: string | null } {
    const resolvedModuleId = this.getModuleId();
    return {
      moduleId: resolvedModuleId,
      name: this.getRequiredModuleName()
    };
  }
}
