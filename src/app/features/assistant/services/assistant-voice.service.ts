import { Injectable, signal } from '@angular/core';
import { AssistantLocale, AssistantVoiceMode } from '../../../core/models/assistant.model';

/**
 * Browser-native voice service for the OpAuto assistant.
 *
 * Wraps:
 * - SpeechRecognition (or webkitSpeechRecognition) for speech-to-text input.
 * - SpeechSynthesis for text-to-speech assistant replies.
 *
 * Browser support notes:
 * - Chrome / Chromium / Edge: full support for both APIs.
 * - Safari (desktop): SpeechRecognition is gated behind webkit prefix and
 *   may require user-gesture activation; speechSynthesis is supported.
 * - Safari iOS: SpeechRecognition is unreliable; we fall back gracefully.
 * - Firefox: SpeechRecognition unsupported -> mode === 'unsupported',
 *   the UI hides the mic.
 *
 * Locale mapping:
 * - en -> en-US
 * - fr -> fr-FR
 * - ar -> ar-TN if a Tunisian voice is detected, otherwise ar-SA fallback.
 */
@Injectable({ providedIn: 'root' })
export class AssistantVoiceService {
  /** Current voice mode signal: idle | listening | speaking | unsupported. */
  readonly mode = signal<AssistantVoiceMode>('idle');

  /** Live (interim) transcript while listening. */
  readonly interimTranscript = signal<string>('');

  /** Final transcript emitted at the end of a listening turn. */
  readonly finalTranscript = signal<string>('');

  /** Last error message (translation key or raw message). */
  readonly error = signal<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any | null = null;

  private currentUtterance: SpeechSynthesisUtterance | null = null;

  private readonly localeMap: Record<AssistantLocale, string[]> = {
    en: ['en-US', 'en-GB', 'en'],
    fr: ['fr-FR', 'fr-CA', 'fr'],
    // ar-TN preferred for the Tunisian market, fall back to ar-SA, then ar.
    ar: ['ar-TN', 'ar-SA', 'ar'],
  };

  constructor() {
    if (!this.isSupported()) {
      this.mode.set('unsupported');
    }
  }

  /**
   * Returns true when the browser exposes a SpeechRecognition implementation.
   * SpeechSynthesis is checked separately when actually speaking.
   */
  isSupported(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    const w = window as unknown as Record<string, unknown>;
    return 'SpeechRecognition' in w || 'webkitSpeechRecognition' in w;
  }

  /**
   * Begin a single listening turn for the given assistant locale.
   * Sets up event handlers and updates the relevant signals as audio arrives.
   * No-op when the browser is unsupported or already listening.
   */
  startListening(locale: AssistantLocale): void {
    if (!this.isSupported()) {
      this.mode.set('unsupported');
      return;
    }
    if (this.mode() === 'listening') {
      return;
    }

    // Reset signals for the new listening turn.
    this.interimTranscript.set('');
    this.finalTranscript.set('');
    this.error.set(null);

    try {
      this.recognition = this.createRecognition();
    } catch (err) {
      this.error.set(this.normalizeError(err));
      this.mode.set('idle');
      return;
    }

    if (!this.recognition) {
      this.mode.set('unsupported');
      return;
    }

    this.recognition.lang = this.resolveRecognitionLang(locale);
    this.recognition.interimResults = true;
    this.recognition.continuous = false;
    this.recognition.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      const results = event?.results ?? [];
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const transcript = result?.[0]?.transcript ?? '';
        if (result?.isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (interim) {
        this.interimTranscript.set(interim);
      }
      if (final) {
        // Append final segments as they arrive in case of multiple chunks.
        const previous = this.finalTranscript();
        this.finalTranscript.set((previous + ' ' + final).trim());
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.recognition.onerror = (event: any) => {
      const code = event?.error ?? 'unknown';
      // Map known error codes to translation keys; consumers can localize them.
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        this.error.set('assistant.voice.permissionDenied');
      } else if (code === 'no-speech') {
        this.error.set('assistant.voice.noSpeech');
      } else {
        this.error.set(`assistant.voice.error.${code}`);
      }
      this.mode.set('idle');
    };

    this.recognition.onend = () => {
      // Recognition naturally ended (final result or timeout).
      if (this.mode() === 'listening') {
        this.mode.set('idle');
      }
    };

    try {
      this.recognition.start();
      this.mode.set('listening');
    } catch (err) {
      this.error.set(this.normalizeError(err));
      this.mode.set('idle');
    }
  }

  /**
   * Stop an in-progress listening turn. Safe to call when not listening.
   * The current finalTranscript is preserved for the consumer.
   */
  stopListening(): void {
    if (!this.recognition) {
      this.mode.set('idle');
      return;
    }
    try {
      this.recognition.stop();
    } catch {
      // Some browsers throw if stop() is called when not started.
    }
    if (this.mode() === 'listening') {
      this.mode.set('idle');
    }
  }

  /**
   * Speak the given text using the locale-appropriate synthesis voice.
   * Cancels any in-progress utterance first to avoid overlap.
   */
  speak(text: string, locale: AssistantLocale): void {
    if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    this.cancelSpeech();

    const utterance = new SpeechSynthesisUtterance(text);
    const langCandidates = this.localeMap[locale];
    utterance.lang = langCandidates[0];

    const voice = this.pickVoice(locale);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    utterance.onend = () => {
      if (this.mode() === 'speaking') {
        this.mode.set('idle');
      }
      this.currentUtterance = null;
    };

    utterance.onerror = () => {
      if (this.mode() === 'speaking') {
        this.mode.set('idle');
      }
      this.currentUtterance = null;
    };

    this.currentUtterance = utterance;
    this.mode.set('speaking');
    window.speechSynthesis.speak(utterance);
  }

  /** Cancel any in-progress synthesis. Safe to call any time. */
  cancelSpeech(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
    this.currentUtterance = null;
    if (this.mode() === 'speaking') {
      this.mode.set('idle');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createRecognition(): any | null {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as Record<string, unknown>;
    const Ctor = (w['SpeechRecognition'] ?? w['webkitSpeechRecognition']) as
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | (new () => any)
      | undefined;
    return Ctor ? new Ctor() : null;
  }

  /**
   * Choose the best BCP-47 language tag to feed SpeechRecognition for the
   * current assistant locale. For Arabic, prefer ar-TN if any installed
   * voice/synthesis voice signals Tunisian support; otherwise ar-SA.
   */
  private resolveRecognitionLang(locale: AssistantLocale): string {
    const candidates = this.localeMap[locale];
    if (locale !== 'ar') {
      return candidates[0];
    }
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return candidates[1] ?? candidates[0];
    }
    const voices = (window.speechSynthesis.getVoices?.() ?? []) as SpeechSynthesisVoice[];
    const hasTn = voices.some(v => (v.lang ?? '').toLowerCase().startsWith('ar-tn'));
    return hasTn ? 'ar-TN' : 'ar-SA';
  }

  private pickVoice(locale: AssistantLocale): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return null;
    }
    const voices = (window.speechSynthesis.getVoices?.() ?? []) as SpeechSynthesisVoice[];
    if (!voices.length) return null;

    const candidates = this.localeMap[locale];
    for (const candidate of candidates) {
      const lower = candidate.toLowerCase();
      const exact = voices.find(v => (v.lang ?? '').toLowerCase() === lower);
      if (exact) return exact;
      const prefix = voices.find(v => (v.lang ?? '').toLowerCase().startsWith(lower));
      if (prefix) return prefix;
    }
    // Last resort: locale family prefix (en, fr, ar).
    const family = locale.toLowerCase();
    return voices.find(v => (v.lang ?? '').toLowerCase().startsWith(family)) ?? null;
  }

  private normalizeError(err: unknown): string {
    if (err instanceof Error) return err.message || 'assistant.voice.error.unknown';
    if (typeof err === 'string') return err;
    return 'assistant.voice.error.unknown';
  }
}
