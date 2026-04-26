import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AssistantVoiceService } from '../../services/assistant-voice.service';
import { AssistantLocale } from '../../../../core/models/assistant.model';

const READ_ALOUD_STORAGE_KEY = 'opauto.assistant.readAloud';

/**
 * Inline voice toolbar used by AssistantInputComponent.
 *
 * Design choices:
 * - **Click-to-toggle** mic (NOT hold-to-talk). Rationale: improves
 *   accessibility for keyboard / screen-reader users; touch devices struggle
 *   with hold gestures when scrolling; SpeechRecognition's natural end-of-
 *   utterance detection makes toggling feel like push-to-talk.
 * - Read-aloud preference is persisted in localStorage and starts off.
 * - Component renders nothing when SpeechRecognition is unsupported; the
 *   parent input keeps working in text-only mode.
 */
@Component({
  selector: 'app-assistant-voice-controls',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assistant-voice-controls.component.html',
  styleUrls: ['./assistant-voice-controls.component.css'],
})
export class AssistantVoiceControlsComponent {
  protected readonly voiceService = inject(AssistantVoiceService);

  /** Active locale for SpeechRecognition. Defaults to English. */
  readonly locale = input<AssistantLocale>('en');

  /** When true, the mic and toggle buttons are disabled. */
  readonly disabled = input<boolean>(false);

  /** Local read-aloud preference; persisted in localStorage. */
  protected readonly readAloud = signal<boolean>(this.loadReadAloud());

  protected readonly isUnsupported = computed(() => this.voiceService.mode() === 'unsupported');

  protected readonly isListening = computed(() => this.voiceService.mode() === 'listening');

  /** True if the host browser supports SpeechRecognition (used to hide). */
  protected readonly isSupported = computed(() => this.voiceService.isSupported());

  protected toggleListening(): void {
    if (this.disabled() || this.isUnsupported()) return;
    if (this.isListening()) {
      this.voiceService.stopListening();
    } else {
      this.voiceService.startListening(this.locale());
    }
  }

  protected toggleReadAloud(): void {
    if (this.disabled()) return;
    const next = !this.readAloud();
    this.readAloud.set(next);
    this.saveReadAloud(next);
    if (!next) {
      // Cancel any in-flight speech when the user disables read-aloud.
      this.voiceService.cancelSpeech();
    }
  }

  private loadReadAloud(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    try {
      return window.localStorage.getItem(READ_ALOUD_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private saveReadAloud(value: boolean): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(READ_ALOUD_STORAGE_KEY, String(value));
    } catch {
      // ignore
    }
  }
}
