import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { LanguageService } from '../../../../core/services/language.service';
import { AssistantLocale } from '../../../../core/models/assistant.model';
import { AssistantVoiceService } from '../../services/assistant-voice.service';
import { AssistantVoiceControlsComponent } from '../assistant-voice-controls/assistant-voice-controls.component';

/**
 * Bottom-of-panel input bar for the assistant.
 *
 * Contributes:
 * - Auto-resizing <textarea> (1..6 rows).
 * - Enter to submit, Shift+Enter for newline.
 * - Voice controls (mic + read-aloud) via AssistantVoiceControlsComponent.
 * - Live interim transcript shown beneath the input while listening.
 * - Final transcript appended to the editable input on listening end.
 *
 * Tab order: textarea -> mic -> submit.
 */
@Component({
  selector: 'app-assistant-input',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, AssistantVoiceControlsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assistant-input.component.html',
})
export class AssistantInputComponent implements AfterViewInit {
  private readonly languageService = inject(LanguageService);
  protected readonly voiceService = inject(AssistantVoiceService);

  /** When true, disables the textarea and submit button (e.g., while orchestrator is streaming). */
  readonly disabled = input<boolean>(false);

  /** When true, indicates an approval card is pending; input shows hint and is disabled. */
  readonly pendingApproval = input<boolean>(false);

  /** Emits the trimmed user message when the user submits. */
  readonly submitted = output<string>();

  /** Local two-way bound text. */
  protected readonly text = signal<string>('');

  /** Current row count for the textarea (1..6). */
  protected readonly rows = signal<number>(1);

  protected readonly canSubmit = computed(() => {
    if (this.disabled() || this.pendingApproval()) return false;
    return this.text().trim().length > 0;
  });

  /** Combined "input is locked" state. */
  protected readonly isLocked = computed(() => this.disabled() || this.pendingApproval());

  @ViewChild('textareaRef') private textareaRef?: ElementRef<HTMLTextAreaElement>;

  // Track the previous mode so we know when listening ends and we can
  // append the final transcript exactly once.
  private wasListening = false;

  constructor() {
    // When the voice service finishes a listening turn, fold the final
    // transcript into the editable text.
    effect(() => {
      const mode = this.voiceService.mode();
      const finalText = this.voiceService.finalTranscript();
      if (mode === 'listening') {
        this.wasListening = true;
        return;
      }
      if (this.wasListening) {
        this.wasListening = false;
        if (finalText && finalText.trim().length > 0) {
          const current = this.text();
          const next = current ? `${current.trimEnd()} ${finalText.trim()}` : finalText.trim();
          this.text.set(next);
          // Recompute rows + focus the textarea so the user can edit.
          queueMicrotask(() => {
            this.adjustRows();
            this.focusTextarea();
          });
        }
      }
    });
  }

  ngAfterViewInit(): void {
    this.adjustRows();
  }

  protected onInput(value: string): void {
    this.text.set(value);
    this.adjustRows();
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.submit();
    }
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    const value = this.text().trim();
    if (!value) return;
    this.submitted.emit(value);
    this.text.set('');
    this.rows.set(1);
    queueMicrotask(() => this.focusTextarea());
  }

  protected currentLocale(): AssistantLocale {
    return this.languageService.getCurrentLanguage() as AssistantLocale;
  }

  private adjustRows(): void {
    const value = this.text();
    if (!value) {
      this.rows.set(1);
      return;
    }
    // Approximate rows from newlines and line wrapping at ~80 chars.
    const newlineRows = value.split('\n').length;
    const wrapRows = Math.ceil(value.length / 80);
    const computed = Math.min(6, Math.max(1, Math.max(newlineRows, wrapRows)));
    this.rows.set(computed);
  }

  private focusTextarea(): void {
    this.textareaRef?.nativeElement.focus();
  }
}
