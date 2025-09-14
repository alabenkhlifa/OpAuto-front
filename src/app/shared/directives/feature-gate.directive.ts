import { 
  Directive, 
  Input, 
  TemplateRef, 
  ViewContainerRef, 
  OnInit, 
  OnDestroy,
  ElementRef,
  Renderer2,
  Output,
  EventEmitter
} from '@angular/core';
import { Subscription } from 'rxjs';
import { SubscriptionService } from '../../core/services/subscription.service';
import { SubscriptionTierId } from '../../core/models/subscription.model';

export interface FeatureGateContext {
  $implicit: boolean; // Whether feature is enabled
  isLocked: boolean;  // Whether feature is locked
  requiredTier: SubscriptionTierId | null;
  canUpgrade: boolean;
}

/**
 * Feature gating directive that conditionally shows/hides elements based on subscription tiers
 * 
 * Usage examples:
 * 
 * // Hide element if feature not available
 * <div *featureGate="'photo_upload'">Photo upload section</div>
 * 
 * // Show different content based on feature availability
 * <div *featureGate="'sms_notifications'; else: lockedTemplate">
 *   SMS settings enabled
 * </div>
 * <ng-template #lockedTemplate>
 *   <app-feature-lock [feature]="'sms_notifications'">
 *     SMS settings (upgrade required)
 *   </app-feature-lock>
 * </ng-template>
 * 
 * // Use with context variables
 * <div *featureGate="'api_access'; let enabled; let isLocked = isLocked">
 *   @if (enabled) {
 *     API configuration available
 *   } @else {
 *     API locked - upgrade needed
 *   }
 * </div>
 * 
 * // Disable mode - show element but make it non-interactive
 * <button *featureGate="'team_collaboration'; mode: 'disable'">
 *   Invite team members
 * </button>
 */
@Directive({
  selector: '[featureGate]',
  standalone: true
})
export class FeatureGateDirective implements OnInit, OnDestroy {
  @Input('featureGate') feature!: string;
  @Input('featureGateMode') mode: 'hide' | 'disable' | 'show' = 'hide';
  @Input('featureGateElse') elseTemplate?: TemplateRef<any>;
  @Input('featureGateThen') thenTemplate?: TemplateRef<any>;
  
  @Output('featureGateBlocked') blocked = new EventEmitter<{
    feature: string;
    requiredTier: SubscriptionTierId | null;
  }>();

  private subscription = new Subscription();
  private hasView = false;
  private context: FeatureGateContext = {
    $implicit: false,
    isLocked: true,
    requiredTier: null,
    canUpgrade: false
  };

  constructor(
    private templateRef: TemplateRef<FeatureGateContext>,
    private viewContainer: ViewContainerRef,
    private subscriptionService: SubscriptionService,
    private elementRef: ElementRef,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    if (!this.feature) {
      console.warn('FeatureGateDirective: feature input is required');
      return;
    }

    this.subscription.add(
      this.subscriptionService.hasFeature(this.feature).subscribe(enabled => {
        this.updateContext(enabled);
        this.updateView();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private updateContext(enabled: boolean): void {
    const requiredTier = this.subscriptionService.getUpgradeTierForFeature(this.feature);
    
    this.context = {
      $implicit: enabled,
      isLocked: !enabled,
      requiredTier,
      canUpgrade: !!requiredTier
    };
  }

  private updateView(): void {
    const enabled = this.context.$implicit;

    switch (this.mode) {
      case 'hide':
        this.handleHideMode(enabled);
        break;
      case 'disable':
        this.handleDisableMode(enabled);
        break;
      case 'show':
        this.handleShowMode(enabled);
        break;
    }

    // Emit blocked event if feature is locked
    if (!enabled) {
      this.blocked.emit({
        feature: this.feature,
        requiredTier: this.context.requiredTier
      });
    }
  }

  private handleHideMode(enabled: boolean): void {
    this.viewContainer.clear();
    this.hasView = false;

    if (enabled) {
      // Show the main template
      const template = this.thenTemplate || this.templateRef;
      this.viewContainer.createEmbeddedView(template, this.context);
      this.hasView = true;
    } else if (this.elseTemplate) {
      // Show the else template
      this.viewContainer.createEmbeddedView(this.elseTemplate, this.context);
      this.hasView = true;
    }
  }

  private handleDisableMode(enabled: boolean): void {
    // Always show the element but disable it if feature is locked
    if (!this.hasView) {
      const template = this.thenTemplate || this.templateRef;
      this.viewContainer.createEmbeddedView(template, this.context);
      this.hasView = true;
    }

    // Apply disabled state to the element
    const element = this.elementRef.nativeElement;
    if (enabled) {
      this.renderer.removeClass(element, 'feature-locked');
      this.renderer.removeAttribute(element, 'disabled');
      this.renderer.removeAttribute(element, 'aria-disabled');
    } else {
      this.renderer.addClass(element, 'feature-locked');
      this.renderer.setAttribute(element, 'disabled', 'true');
      this.renderer.setAttribute(element, 'aria-disabled', 'true');
      
      // Add tooltip or aria-label for accessibility
      const requiredTier = this.context.requiredTier;
      const ariaLabel = requiredTier 
        ? `Feature locked - ${requiredTier} tier required`
        : 'Feature locked - upgrade required';
      this.renderer.setAttribute(element, 'aria-label', ariaLabel);
    }
  }

  private handleShowMode(enabled: boolean): void {
    // Always show the element, let the template handle the logic
    if (!this.hasView) {
      const template = this.thenTemplate || this.templateRef;
      this.viewContainer.createEmbeddedView(template, this.context);
      this.hasView = true;
    }
  }

  // Static method for programmatic feature checking
  static async checkFeature(
    feature: string, 
    subscriptionService: SubscriptionService
  ): Promise<FeatureGateContext> {
    const enabled = await subscriptionService.hasFeature(feature).toPromise();
    const requiredTier = subscriptionService.getUpgradeTierForFeature(feature);
    
    return {
      $implicit: enabled || false,
      isLocked: !enabled,
      requiredTier,
      canUpgrade: !!requiredTier
    };
  }
}