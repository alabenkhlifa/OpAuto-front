import { TestBed } from '@angular/core/testing';
import { AssistantVoiceService } from './assistant-voice.service';

/**
 * Fake SpeechRecognition implementation we control from each test.
 * Drives the recognition lifecycle (start/stop/result/error) explicitly.
 */
class FakeSpeechRecognition {
  static instances: FakeSpeechRecognition[] = [];

  lang = '';
  interimResults = false;
  continuous = false;
  maxAlternatives = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onresult: ((event: any) => void) | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;

  startCalls = 0;
  stopCalls = 0;

  constructor() {
    FakeSpeechRecognition.instances.push(this);
  }

  start(): void {
    this.startCalls++;
  }

  stop(): void {
    this.stopCalls++;
  }

  // Helper used by tests.
  emitResult(parts: { transcript: string; isFinal: boolean }[]): void {
    const results = parts.map(p => Object.assign([{ transcript: p.transcript }], { isFinal: p.isFinal }));
    this.onresult?.({ results });
  }

  emitError(code: string): void {
    this.onerror?.({ error: code });
  }

  emitEnd(): void {
    this.onend?.();
  }
}

describe('AssistantVoiceService', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w: any = window;
  let originalSR: unknown;
  let originalWebkitSR: unknown;
  let originalSpeechSynthesisDescriptor: PropertyDescriptor | undefined;

  let speechSynthesisMock: {
    speak: jasmine.Spy;
    cancel: jasmine.Spy;
    getVoices: jasmine.Spy;
  };

  function defineSpeechSynthesis(value: unknown): void {
    Object.defineProperty(window, 'speechSynthesis', {
      value,
      configurable: true,
      writable: true,
    });
  }

  beforeEach(() => {
    originalSR = w.SpeechRecognition;
    originalWebkitSR = w.webkitSpeechRecognition;
    originalSpeechSynthesisDescriptor = Object.getOwnPropertyDescriptor(window, 'speechSynthesis');

    FakeSpeechRecognition.instances = [];
    w.SpeechRecognition = FakeSpeechRecognition;
    delete w.webkitSpeechRecognition;

    speechSynthesisMock = {
      speak: jasmine.createSpy('speak'),
      cancel: jasmine.createSpy('cancel'),
      getVoices: jasmine.createSpy('getVoices').and.returnValue([]),
    };
    defineSpeechSynthesis(speechSynthesisMock);

    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    if (originalSR === undefined) delete w.SpeechRecognition;
    else w.SpeechRecognition = originalSR;

    if (originalWebkitSR === undefined) delete w.webkitSpeechRecognition;
    else w.webkitSpeechRecognition = originalWebkitSR;

    if (originalSpeechSynthesisDescriptor) {
      Object.defineProperty(window, 'speechSynthesis', originalSpeechSynthesisDescriptor);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).speechSynthesis;
    }
  });

  it('reports supported when SpeechRecognition exists on window', () => {
    const service = TestBed.inject(AssistantVoiceService);
    expect(service.isSupported()).toBe(true);
    expect(service.mode()).toBe('idle');
  });

  it('falls back to webkitSpeechRecognition when SpeechRecognition is missing', () => {
    delete w.SpeechRecognition;
    w.webkitSpeechRecognition = FakeSpeechRecognition;

    const service = TestBed.inject(AssistantVoiceService);
    expect(service.isSupported()).toBe(true);
  });

  it('marks mode as unsupported when neither API exists', () => {
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;

    const service = TestBed.inject(AssistantVoiceService);
    expect(service.isSupported()).toBe(false);
    expect(service.mode()).toBe('unsupported');
  });

  it('startListening transitions to listening with the right BCP-47 lang', () => {
    const service = TestBed.inject(AssistantVoiceService);

    service.startListening('en');
    expect(service.mode()).toBe('listening');
    const inst = FakeSpeechRecognition.instances[0];
    expect(inst).toBeDefined();
    expect(inst.lang).toBe('en-US');
    expect(inst.interimResults).toBe(true);
    expect(inst.continuous).toBe(false);
    expect(inst.startCalls).toBe(1);
  });

  it('uses fr-FR for the French locale', () => {
    const service = TestBed.inject(AssistantVoiceService);
    service.startListening('fr');
    expect(FakeSpeechRecognition.instances[0].lang).toBe('fr-FR');
  });

  it('uses ar-SA for Arabic when no Tunisian voice is available', () => {
    const service = TestBed.inject(AssistantVoiceService);
    service.startListening('ar');
    expect(FakeSpeechRecognition.instances[0].lang).toBe('ar-SA');
  });

  it('uses ar-TN when a Tunisian synthesis voice is detected', () => {
    speechSynthesisMock.getVoices.and.returnValue([{ lang: 'ar-TN', name: 'Tunisian' }]);
    const service = TestBed.inject(AssistantVoiceService);
    service.startListening('ar');
    expect(FakeSpeechRecognition.instances[0].lang).toBe('ar-TN');
  });

  it('updates interim and final transcripts on result events', () => {
    const service = TestBed.inject(AssistantVoiceService);
    service.startListening('en');
    const inst = FakeSpeechRecognition.instances[0];

    inst.emitResult([{ transcript: 'how much', isFinal: false }]);
    expect(service.interimTranscript()).toBe('how much');
    expect(service.finalTranscript()).toBe('');

    inst.emitResult([
      { transcript: 'how much revenue this month', isFinal: true },
    ]);
    expect(service.finalTranscript()).toBe('how much revenue this month');
  });

  it('returns to idle when recognition naturally ends', () => {
    const service = TestBed.inject(AssistantVoiceService);
    service.startListening('en');
    expect(service.mode()).toBe('listening');

    FakeSpeechRecognition.instances[0].emitEnd();
    expect(service.mode()).toBe('idle');
  });

  it('maps not-allowed error to permissionDenied translation key', () => {
    const service = TestBed.inject(AssistantVoiceService);
    service.startListening('en');

    FakeSpeechRecognition.instances[0].emitError('not-allowed');

    expect(service.mode()).toBe('idle');
    expect(service.error()).toBe('assistant.voice.permissionDenied');
  });

  it('maps service-not-allowed error to permissionDenied translation key', () => {
    const service = TestBed.inject(AssistantVoiceService);
    service.startListening('en');
    FakeSpeechRecognition.instances[0].emitError('service-not-allowed');
    expect(service.error()).toBe('assistant.voice.permissionDenied');
    expect(service.mode()).toBe('idle');
  });

  it('stopListening calls stop() on the active recognition and goes to idle', () => {
    const service = TestBed.inject(AssistantVoiceService);
    service.startListening('en');
    const inst = FakeSpeechRecognition.instances[0];

    service.stopListening();

    expect(inst.stopCalls).toBe(1);
    expect(service.mode()).toBe('idle');
  });

  it('startListening is a no-op while already listening', () => {
    const service = TestBed.inject(AssistantVoiceService);
    service.startListening('en');
    service.startListening('en');
    expect(FakeSpeechRecognition.instances.length).toBe(1);
  });

  it('resets transcripts at the start of a new listening turn', () => {
    const service = TestBed.inject(AssistantVoiceService);
    service.startListening('en');
    FakeSpeechRecognition.instances[0].emitResult([{ transcript: 'first', isFinal: true }]);
    FakeSpeechRecognition.instances[0].emitEnd();
    expect(service.finalTranscript()).toBe('first');

    service.startListening('en');
    expect(service.interimTranscript()).toBe('');
    expect(service.finalTranscript()).toBe('');
  });

  describe('speak', () => {
    it('calls speechSynthesis.speak with the locale lang', () => {
      const service = TestBed.inject(AssistantVoiceService);
      service.speak('hello there', 'en');
      expect(speechSynthesisMock.speak).toHaveBeenCalled();
      const utterance = speechSynthesisMock.speak.calls.mostRecent().args[0];
      expect(utterance.lang).toBe('en-US');
      expect(utterance.text).toBe('hello there');
      expect(service.mode()).toBe('speaking');
    });

    it('does nothing when text is empty', () => {
      const service = TestBed.inject(AssistantVoiceService);
      service.speak('', 'en');
      expect(speechSynthesisMock.speak).not.toHaveBeenCalled();
      expect(service.mode()).toBe('idle');
    });

    it('cancelSpeech calls speechSynthesis.cancel and resets mode', () => {
      const service = TestBed.inject(AssistantVoiceService);
      service.speak('hello', 'en');
      expect(service.mode()).toBe('speaking');

      service.cancelSpeech();
      expect(speechSynthesisMock.cancel).toHaveBeenCalled();
      expect(service.mode()).toBe('idle');
    });
  });
});
