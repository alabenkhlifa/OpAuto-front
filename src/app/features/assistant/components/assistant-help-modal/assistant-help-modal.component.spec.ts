import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AssistantHelpModalComponent } from './assistant-help-modal.component';
import { TranslationService } from '../../../../core/services/translation.service';

describe('AssistantHelpModalComponent', () => {
  let fixture: ComponentFixture<AssistantHelpModalComponent>;
  let component: AssistantHelpModalComponent;
  let translationService: jasmine.SpyObj<TranslationService>;

  const setOpen = (open: boolean): void => {
    fixture.componentRef.setInput('open', open);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    translationService = jasmine.createSpyObj('TranslationService', ['instant'], {
      translations$: { subscribe: () => ({ unsubscribe: () => {} }) },
    });
    translationService.instant.and.callFake((k: string) => k);

    await TestBed.configureTestingModule({
      imports: [AssistantHelpModalComponent],
      providers: [{ provide: TranslationService, useValue: translationService }],
    }).compileComponents();

    fixture = TestBed.createComponent(AssistantHelpModalComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  it('renders nothing when open=false', () => {
    setOpen(false);
    expect(fixture.debugElement.query(By.css('.assistant-help-modal'))).toBeNull();
    expect(
      fixture.debugElement.query(By.css('.assistant-help-modal__backdrop')),
    ).toBeNull();
  });

  it('renders backdrop + dialog when open=true', () => {
    setOpen(true);
    expect(
      fixture.debugElement.query(By.css('.assistant-help-modal__backdrop')),
    ).toBeTruthy();
    expect(fixture.debugElement.query(By.css('.assistant-help-modal'))).toBeTruthy();
  });

  it('renders all three sections (tools, skills, agents)', () => {
    setOpen(true);
    const sections = fixture.debugElement.queryAll(
      By.css('.assistant-help-modal__section'),
    );
    expect(sections.length).toBe(3);
  });

  it('opens the Tools section by default', () => {
    setOpen(true);
    expect(component.isExpanded('tools')).toBe(true);
    expect(component.isExpanded('skills')).toBe(false);
    expect(component.isExpanded('agents')).toBe(false);
  });

  it('renders all 29 tool items inside the Tools section by default', () => {
    setOpen(true);
    const items = fixture.debugElement.queryAll(
      By.css('.assistant-help-modal__item'),
    );
    expect(items.length).toBe(29);
  });

  it('toggles to Skills section when its header is clicked, hiding Tools items', () => {
    setOpen(true);
    component.toggleSection('skills');
    fixture.detectChanges();
    expect(component.isExpanded('skills')).toBe(true);
    expect(component.isExpanded('tools')).toBe(false);
    const items = fixture.debugElement.queryAll(
      By.css('.assistant-help-modal__item'),
    );
    // 9 skills
    expect(items.length).toBe(9);
  });

  it('shows 6 agents when Agents section is opened', () => {
    setOpen(true);
    component.toggleSection('agents');
    fixture.detectChanges();
    const items = fixture.debugElement.queryAll(
      By.css('.assistant-help-modal__item'),
    );
    expect(items.length).toBe(6);
  });

  it('emits closed when the close button is clicked', () => {
    setOpen(true);
    const events: number[] = [];
    component.closed.subscribe(() => events.push(1));

    const btn = fixture.debugElement.query(By.css('.assistant-help-modal__close'));
    expect(btn).toBeTruthy();
    btn.nativeElement.click();

    expect(events.length).toBe(1);
  });

  it('emits closed when the backdrop is clicked', () => {
    setOpen(true);
    const events: number[] = [];
    component.closed.subscribe(() => events.push(1));

    const backdrop = fixture.debugElement.query(
      By.css('.assistant-help-modal__backdrop'),
    );
    backdrop.nativeElement.click();

    expect(events.length).toBe(1);
  });

  it('does NOT emit closed when a click bubbles from inside the modal body', () => {
    setOpen(true);
    const events: number[] = [];
    component.closed.subscribe(() => events.push(1));

    // Simulate click on the modal element itself (currentTarget != target)
    const modal = fixture.debugElement.query(By.css('.assistant-help-modal'));
    modal.nativeElement.click();

    expect(events.length).toBe(0);
  });

  it('emits closed on ESC keydown when open', () => {
    setOpen(true);
    const events: number[] = [];
    component.closed.subscribe(() => events.push(1));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(events.length).toBe(1);
  });

  it('does NOT emit closed on ESC when modal is closed', () => {
    setOpen(false);
    const events: number[] = [];
    component.closed.subscribe(() => events.push(1));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(events.length).toBe(0);
  });

  it('renders an example-prefix label inside each visible item', () => {
    setOpen(true);
    const prefixes = fixture.debugElement.queryAll(
      By.css('.assistant-help-modal__item-example-prefix'),
    );
    expect(prefixes.length).toBe(29);
  });
});
