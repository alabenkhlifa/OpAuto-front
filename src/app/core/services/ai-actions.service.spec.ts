import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AiActionsService } from './ai-actions.service';
import { ApiService } from './api.service';
import { AiAction } from '../models/ai-action.model';

describe('AiActionsService', () => {
  let service: AiActionsService;
  let api: jasmine.SpyObj<ApiService>;

  const stubAction: AiAction = {
    id: 'act-1',
    garageId: 'g1',
    customerId: 'c1',
    kind: 'REMINDER_SMS',
    status: 'DRAFT',
    messageBody: 'Bonjour',
    discountKind: null,
    discountValue: null,
    expiresAt: null,
    churnRiskSnapshot: 0.5,
    factorsSnapshot: [],
    providerMessageId: null,
    errorMessage: null,
    approvedByUserId: null,
    redeemedInvoiceId: null,
    createdAt: '',
    approvedAt: null,
    sentAt: null,
    failedAt: null,
    redeemedAt: null,
    updatedAt: '',
    customer: { id: 'c1', firstName: 'A', lastName: 'B', phone: '+216', smsOptIn: true },
  };

  beforeEach(() => {
    api = jasmine.createSpyObj('ApiService', ['get', 'post']);
    TestBed.configureTestingModule({
      providers: [
        AiActionsService,
        { provide: ApiService, useValue: api },
      ],
    });
    service = TestBed.inject(AiActionsService);
  });

  it('draft posts to ai/actions/draft with customerId', () => {
    api.post.and.returnValue(of(stubAction));
    service.draft('c1').subscribe();
    expect(api.post).toHaveBeenCalledWith('ai/actions/draft', { customerId: 'c1' });
  });

  it('list filters query params', () => {
    api.get.and.returnValue(of([stubAction]));
    service.list({ customerId: 'c1', status: 'SENT' }).subscribe();
    expect(api.get).toHaveBeenCalledWith('ai/actions', { customerId: 'c1', status: 'SENT' });
  });

  it('approve posts edits to the action endpoint', () => {
    api.post.and.returnValue(of(stubAction));
    service
      .approve('act-1', { messageBody: 'x', discountKind: 'PERCENT', discountValue: 15 })
      .subscribe();
    expect(api.post).toHaveBeenCalledWith('ai/actions/act-1/approve', {
      messageBody: 'x',
      discountKind: 'PERCENT',
      discountValue: 15,
    });
  });

  it('skip posts an empty body', () => {
    api.post.and.returnValue(of(stubAction));
    service.skip('act-1').subscribe();
    expect(api.post).toHaveBeenCalledWith('ai/actions/act-1/skip', {});
  });

  it('redeem posts optional invoice id', () => {
    api.post.and.returnValue(of(stubAction));
    service.redeem('act-1', { invoiceId: 'inv-9' }).subscribe();
    expect(api.post).toHaveBeenCalledWith('ai/actions/act-1/redeem', { invoiceId: 'inv-9' });
  });
});
