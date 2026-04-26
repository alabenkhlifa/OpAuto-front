import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AssistantVoiceControlsComponent } from './assistant-voice-controls.component';
import { AssistantVoiceService } from '../../services/assistant-voice.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { AssistantVoiceMode } from '../../../../core/models/assistant.model';

describe('AssistantVoiceControlsComponent', () => {
  let fixture: ComponentFixture<AssistantVoiceControlsComponent>;
  let component: AssistantVoiceControlsComponent;

  let modeSig: ReturnType<typeof signal<AssistantVoiceMode>>;
  let voice: AssistantVoiceService & {
    isSupported: jasmine.Spy;
    startListening: jasmine.Spy;
    stopListening: jasmine.Spy;
    speak: jasmine.Spy;
    cancelSpeech: jasmine.Spy;
  };

  beforeEach(async () => {
    modeSig = signal<AssistantVoiceMode>('idle');
    voice = {
      mode: modeSig,
      interimTranscript: signal(''),
      finalTranscript: signal(''),
      error: signal<string | null>(null),
      isSupported: jasmine.createSpy('isSupported').and.returnValue(true),
      startListening: jasmine.createSpy('startListening'),
      stopListening: jasmine.createSpy('stopListening'),
      speak: jasmine.createSpy('speak'),
      cancelSpeech: jasmine.createSpy('cancelSpeech'),
    } as unknown as AssistantVoiceService & {
      isSupported: jasmine.Spy;
      startListening: jasmine.Spy;
      stopListening: jasmine.Spy;
      speak: jasmine.Spy;
      cancelSpeech: jasmine.Spy;
    };

    const translationService = jasmine.createSpyObj<TranslationService>(
      'TranslationService',
      ['instant'],
      { translations$: new BehaviorSubject({}) },
    );
    translationService.instant.and.callFake((k: string) => k);

    localStorage.removeItem('opauto.assistant.readAloud');

    await TestBed.configureTestingModule({
      imports: [AssistantVoiceControlsComponent],
      providers: [
        { provide: AssistantVoiceService, useValue: voice },
        { provide: TranslationService, useValue: translationService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AssistantVoiceControlsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('locale', 'en');
    fixture.detectChanges();
  });

  function micButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('button.assistant-mic') as HTMLButtonElement | null;
  }

  function speakerButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('button.assistant-speaker') as HTMLButtonElement | null;
  }

  it('renders nothing when SpeechRecognition is unsupported', () => {
    voice.isSupported.and.returnValue(false);
    fixture = TestBed.createComponent(AssistantVoiceControlsComponent);
    fixture.componentRef.setInput('locale', 'en');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button.assistant-mic')).toBeNull();
    expect(fixture.nativeElement.querySelector('button.assistant-speaker')).toBeNull();
  });

  it('renders the mic and speaker buttons when supported', () => {
    expect(micButton()).not.toBeNull();
    expect(speakerButton()).not.toBeNull();
  });

  it('clicking the mic starts listening with the configured locale', () => {
    micButton()!.click();
    expect(voice.startListening).toHaveBeenCalledWith('en');
  });

  it('clicking the mic while listening stops listening', () => {
    modeSig.set('listening');
    fixture.detectChanges();

    micButton()!.click();
    expect(voice.stopListening).toHaveBeenCalled();
    expect(voice.startListening).not.toHaveBeenCalled();
  });

  it('mic button reflects listening state with the listening modifier class', () => {
    modeSig.set('listening');
    fixture.detectChanges();
    expect(micButton()!.classList.contains('assistant-mic--listening')).toBe(true);
    expect(micButton()!.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders the unsupported style when mode is unsupported', () => {
    voice.isSupported.and.returnValue(true);
    modeSig.set('unsupported');
    fixture.detectChanges();
    expect(micButton()!.classList.contains('assistant-mic--unsupported')).toBe(true);
    expect(micButton()!.disabled).toBe(true);
  });

  it('respects the disabled input', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(micButton()!.disabled).toBe(true);
    expect(speakerButton()!.disabled).toBe(true);

    micButton()!.click();
    expect(voice.startListening).not.toHaveBeenCalled();
  });

  it('toggles read-aloud preference and persists it to localStorage', () => {
    const speaker = speakerButton()!;
    expect(speaker.getAttribute('aria-pressed')).toBe('false');

    speaker.click();
    fixture.detectChanges();

    expect(speaker.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('opauto.assistant.readAloud')).toBe('true');

    speaker.click();
    fixture.detectChanges();
    expect(speaker.getAttribute('aria-pressed')).toBe('false');
    expect(localStorage.getItem('opauto.assistant.readAloud')).toBe('false');
  });

  it('cancels in-flight speech when read-aloud is toggled off', () => {
    speakerButton()!.click(); // turn on
    fixture.detectChanges();
    voice.cancelSpeech.calls.reset();

    speakerButton()!.click(); // turn off
    fixture.detectChanges();
    expect(voice.cancelSpeech).toHaveBeenCalled();
  });
});
