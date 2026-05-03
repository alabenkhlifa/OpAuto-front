import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AssistantStateService } from '../../services/assistant-state.service';

/**
 * Slide-in/out panel that hosts the assistant UI surface.
 *
 * Desktop: 420px right-anchored card with rounded corners.
 * Mobile (<768px): full-screen.
 *
 * Children mount via named slots (data-slot="messages|approval|input|drawer").
 * The conversation drawer slot is positioned absolutely inside the panel as
 * an overlay, so it covers the chat without changing layout.
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

  readonly historyClicked = output<void>();
  readonly helpClicked = output<void>();

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
