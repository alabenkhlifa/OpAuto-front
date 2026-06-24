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
});
