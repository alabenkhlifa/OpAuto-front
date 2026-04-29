import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AssistantInputComponent } from './assistant-input.component';
import { AssistantVoiceService } from '../../services/assistant-voice.service';
import { LanguageService } from '../../../../core/services/language.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { AssistantVoiceMode } from '../../../../core/models/assistant.model';
import { BehaviorSubject } from 'rxjs';

describe('AssistantInputComponent', () => {
  let fixture: ComponentFixture<AssistantInputComponent>;
  let component: AssistantInputComponent;

  let voiceModeSig: ReturnType<typeof signal<AssistantVoiceMode>>;
  let interimSig: ReturnType<typeof signal<string>>;
  let finalSig: ReturnType<typeof signal<string>>;
  let errorSig: ReturnType<typeof signal<string | null>>;

  let voiceServiceMock: AssistantVoiceService & {
    isSupported: jasmine.Spy;
    startListening: jasmine.Spy;
    stopListening: jasmine.Spy;
    speak: jasmine.Spy;
    cancelSpeech: jasmine.Spy;
  };

  beforeEach(async () => {
    voiceModeSig = signal<AssistantVoiceMode>('idle');
    interimSig = signal<string>('');
    finalSig = signal<string>('');
    errorSig = signal<string | null>(null);

    voiceServiceMock = {
      mode: voiceModeSig,
      interimTranscript: interimSig,
      finalTranscript: finalSig,
      error: errorSig,
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

    const languageService = jasmine.createSpyObj<LanguageService>(
      'LanguageService',
      ['getCurrentLanguage'],
      { currentLanguage$: new BehaviorSubject('en') },
    );
    languageService.getCurrentLanguage.and.returnValue('en');

    const translationService = jasmine.createSpyObj<TranslationService>(
      'TranslationService',
      ['instant'],
      { translations$: new BehaviorSubject({}) },
    );
    translationService.instant.and.callFake((k: string) => k);

    await TestBed.configureTestingModule({
      imports: [AssistantInputComponent],
      providers: [
        { provide: AssistantVoiceService, useValue: voiceServiceMock },
        { provide: LanguageService, useValue: languageService },
        { provide: TranslationService, useValue: translationService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AssistantInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function getTextarea(): HTMLTextAreaElement {
    return fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
  }

  function getSubmitButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button.assistant-input__send') as HTMLButtonElement;
  }

  it('disables submit when input is empty or whitespace', () => {
    const button = getSubmitButton();
    expect(button.disabled).toBe(true);

    const textarea = getTextarea();
    textarea.value = '   ';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(button.disabled).toBe(true);
  });

  it('emits submitted on Enter (without Shift) and clears the textarea', () => {
    const emissions: string[] = [];
    component.submitted.subscribe(v => emissions.push(v));

    const textarea = getTextarea();
    textarea.value = 'how much revenue this month';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const enter = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: false });
    textarea.dispatchEvent(enter);
    fixture.detectChanges();

    expect(emissions).toEqual(['how much revenue this month']);
  });

  it('does NOT submit on Shift+Enter (newline behavior)', () => {
    const spy = jasmine.createSpy('submitted');
    component.submitted.subscribe(spy);

    const textarea = getTextarea();
    textarea.value = 'line1';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true });
    spyOn(event, 'preventDefault');
    textarea.dispatchEvent(event);

    expect(spy).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('does not emit when text is whitespace-only', () => {
    const spy = jasmine.createSpy('submitted');
    component.submitted.subscribe(spy);

    const textarea = getTextarea();
    textarea.value = '   ';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const enter = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: false });
    textarea.dispatchEvent(enter);
    fixture.detectChanges();

    expect(spy).not.toHaveBeenCalled();
  });

  it('clicking the submit button emits the trimmed value', () => {
    const emissions: string[] = [];
    component.submitted.subscribe(v => emissions.push(v));

    const textarea = getTextarea();
    textarea.value = '   hi there   ';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    getSubmitButton().click();
    fixture.detectChanges();

    expect(emissions).toEqual(['hi there']);
  });

  it('appends the final voice transcript to the input on listening end', fakeAsync(() => {
    voiceModeSig.set('listening');
    fixture.detectChanges();

    finalSig.set('show today appointments');
    voiceModeSig.set('idle');
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const textarea = getTextarea();
    expect(textarea.value).toBe('show today appointments');
  }));

  it('preserves existing typed text when appending the voice transcript', fakeAsync(() => {
    const textarea = getTextarea();
    textarea.value = 'please';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    voiceModeSig.set('listening');
    fixture.detectChanges();

    finalSig.set('list at risk customers');
    voiceModeSig.set('idle');
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(getTextarea().value).toBe('please list at risk customers');
  }));

  it('disables the textarea + submit when [disabled] is true', async () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // Forms-controlled textarea: disabled attribute is the source of truth.
    expect(getTextarea().hasAttribute('disabled')).toBe(true);
    expect(getSubmitButton().disabled).toBe(true);
  });

  it('shows a hint and disables when pendingApproval is true', async () => {
    fixture.componentRef.setInput('pendingApproval', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(getTextarea().hasAttribute('disabled')).toBe(true);
    expect(getSubmitButton().disabled).toBe(true);
    const hint = fixture.nativeElement.textContent || '';
    expect(hint).toContain('assistant.input.pendingApprovalHint');
  });
});
