import { TestBed, ComponentFixture } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { convertToParamMap, ActivatedRoute } from '@angular/router';
import { PublicJobApprovalComponent } from './public-job-approval.component';
import { MaintenanceService } from '../../core/services/maintenance.service';
import { TranslationService } from '../../core/services/translation.service';
import { PublicJobApprovalSummary } from '../../core/models/maintenance.model';

describe('PublicJobApprovalComponent', () => {
  let fixture: ComponentFixture<PublicJobApprovalComponent>;
  let component: PublicJobApprovalComponent;
  let maintenanceService: jasmine.SpyObj<MaintenanceService>;

  const summary: PublicJobApprovalSummary = {
    token: 'public-token',
    jobId: 'job-1',
    jobTitle: 'Brake pad replacement',
    customerName: 'Sara Demo',
    carDetails: '2020 Toyota Camry',
    licensePlate: 'ABC-123',
    status: 'pending',
    request: {
      id: 'req-1',
      type: 'price-change',
      description: 'Replace worn brake pads',
      partName: 'Brake pad',
      estimatedPrice: 180,
      urgency: 'medium',
      requestedBy: 'Owner',
      requestedAt: new Date('2026-06-24T00:00:00Z'),
      status: 'pending',
    },
    alreadyResponded: false,
  };

  const approvedSummary: PublicJobApprovalSummary = {
    ...summary,
    status: 'approved',
    alreadyResponded: true,
    request: {
      ...summary.request,
      status: 'approved',
      customerResponse: 'approved',
      customerRespondedAt: new Date('2026-06-24T01:00:00Z'),
    },
  };

  beforeEach(() => {
    maintenanceService = jasmine.createSpyObj<MaintenanceService>(['getPublicApprovalSummary', 'respondToPublicApproval']);
    maintenanceService.getPublicApprovalSummary.and.returnValue(of(summary));
    maintenanceService.respondToPublicApproval.and.returnValue(of(approvedSummary));

    TestBed.configureTestingModule({
      imports: [PublicJobApprovalComponent],
      providers: [
        { provide: MaintenanceService, useValue: maintenanceService },
        {
          provide: TranslationService,
          useValue: {
            instant: (key: string) => key,
            translations$: new BehaviorSubject({}),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ token: 'public-token' }),
            },
          },
        },
      ],
    });

    fixture = TestBed.createComponent(PublicJobApprovalComponent);
    component = fixture.componentInstance;
  });

  it('loads the public approval summary using route token', () => {
    fixture.detectChanges();

    expect(component.summary()).toEqual(summary);
    expect(component.loading()).toBeFalse();
    expect(maintenanceService.getPublicApprovalSummary).toHaveBeenCalledWith('public-token');
  });

  it('calls public approval endpoint for approval', () => {
    fixture.detectChanges();
    component.submitResponse('approved');

    expect(maintenanceService.respondToPublicApproval).toHaveBeenCalledWith('public-token', {
      decision: 'approved',
      reason: undefined,
    });
    expect(component.summary()?.status).toBe('approved');
    expect(component.isAlreadyResponded()).toBeTrue();
  });

  it('blocks reject without reason and sends reject when provided', () => {
    maintenanceService.respondToPublicApproval.calls.reset();
    maintenanceService.respondToPublicApproval.and.returnValue(of(approvedSummary));

    fixture.detectChanges();
    component.openRejectForm();
    component.submitResponse('rejected');

    expect(maintenanceService.respondToPublicApproval).not.toHaveBeenCalled();

    component.rejectReason = 'Price is too high';
    component.submitResponse('rejected');

    expect(maintenanceService.respondToPublicApproval).toHaveBeenCalledWith('public-token', {
      decision: 'rejected',
      reason: 'Price is too high',
    });
  });

  it('renders public timeline events with maintenance timeline styling', () => {
    maintenanceService.getPublicApprovalSummary.and.returnValue(of({
      ...summary,
      timeline: [
        {
          id: 'event-created',
          type: 'job-created',
          occurredAt: new Date('2026-06-24T04:46:00Z'),
        },
        {
          id: 'event-part',
          type: 'part-added',
          description: 'Oil 10w40',
          occurredAt: new Date('2026-06-24T04:47:00Z'),
        },
        {
          id: 'event-requested',
          type: 'approval-requested',
          occurredAt: new Date('2026-06-24T04:48:00Z'),
        },
        {
          id: 'event-approved',
          type: 'approval-responded',
          occurredAt: new Date('2026-06-24T04:49:00Z'),
          metadata: { status: 'approved' },
        },
      ],
    }));

    fixture.detectChanges();

    const timeline = fixture.nativeElement.querySelector('.maintenance-timeline') as HTMLElement | null;
    const items = Array.from(fixture.nativeElement.querySelectorAll('.maintenance-timeline__item')) as HTMLElement[];

    expect(timeline).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.approval-timeline')).toBeNull();
    expect(items.length).toBe(4);
    expect(items[0].classList).toContain('timeline--created');
    expect(items[1].classList).toContain('timeline--part');
    expect(items[2].classList).toContain('timeline--requested');
    expect(items[3].classList).toContain('timeline--approved');
    expect(getComputedStyle(items[2]).getPropertyValue('--timeline-accent').trim()).toBe('#f97316');
  });
});
