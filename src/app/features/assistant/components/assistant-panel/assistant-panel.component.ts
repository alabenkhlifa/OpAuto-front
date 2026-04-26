import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AssistantStateService } from '../../services/assistant-state.service';

/**
 * Slide-in/out panel that hosts the assistant UI surface.
 *
 * On mobile (<768px) the panel covers the full viewport. On desktop it's
 * a 400px right-anchored drawer (left-anchored under [dir="rtl"]). All
 * sub-surfaces (conversation list, message list, input, approval card)
 * mount into named slots so other Phase-3 subagents can plug them in
 * without touching this file.
 */
@Component({
  selector: 'app-assistant-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './assistant-panel.component.html',
  styleUrls: ['./assistant-panel.component.css'],
})
export class AssistantPanelComponent {
  state = inject(AssistantStateService);

  readonly isOpen = computed(() => this.state.isOpen());
  readonly isStreaming = computed(() => this.state.isStreaming());
  readonly errorMessage = computed(() => this.state.error());

  close(): void {
    this.state.closePanel();
  }

  startNewConversation(): void {
    this.state.reset();
  }
}
