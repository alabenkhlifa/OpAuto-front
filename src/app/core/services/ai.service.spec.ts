import { TestBed } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AiService } from './ai.service';
import { ApiService } from './api.service';
import {
  AiError,
  AiChatRequest,
  AiChatResponse,
  AiDiagnoseRequest,
  AiDiagnoseResponse,
  AiEstimateRequest,
  AiEstimateResponse,
  AiScheduleRequest,
  AiScheduleResponse,
  AiInsightsRequest,
  AiInsightsResponse,
  AiMaintenancePredictionRequest,
  AiMaintenancePredictionResponse,
  AiChurnPredictionRequest,
  AiChurnPredictionResponse,
} from '../models/ai.model';

describe('AiService', () => {
  let service: AiService;
  let mockApiService: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    const apiSpy = jasmine.createSpyObj('ApiService', ['post']);

    TestBed.configureTestingModule({
      providers: [
        AiService,
        { provide: ApiService, useValue: apiSpy },
      ],
    });

    service = TestBed.inject(AiService);
    mockApiService = TestBed.inject(ApiService) as jasmine.SpyObj<ApiService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have loading signal initially false', () => {
      expect(service.loading()).toBe(false);
    });

    it('should have error signal initially null', () => {
      expect(service.error()).toBeNull();
    });
  });

  describe('chat', () => {
    const chatRequest: AiChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      context: 'garage',
    };

    const chatResponse: AiChatResponse = {
      message: 'Hi, how can I help?',
      provider: 'openai',
    };

    it('should call ApiService.post with /ai/chat and return the response', (done) => {
      mockApiService.post.and.returnValue(of(chatResponse));

      service.chat(chatRequest).subscribe((result) => {
        expect(mockApiService.post).toHaveBeenCalledWith('/ai/chat', chatRequest);
        expect(result).toEqual(chatResponse);
        done();
      });
    });

    it('should pass the request body to ApiService.post', (done) => {
      mockApiService.post.and.returnValue(of(chatResponse));

      const customRequest: AiChatRequest = {
        messages: [
          { role: 'user', content: 'What is wrong with my car?' },
          { role: 'assistant', content: 'Can you describe the symptoms?' },
          { role: 'user', content: 'It makes a grinding noise' },
        ],
      };

      service.chat(customRequest).subscribe(() => {
        expect(mockApiService.post).toHaveBeenCalledWith('/ai/chat', customRequest);
        done();
      });
    });
  });

  describe('diagnose', () => {
    const diagnoseRequest: AiDiagnoseRequest = {
      symptoms: 'grinding noise when braking',
      carMake: 'Toyota',
      carModel: 'Corolla',
      carYear: '2020',
    };

    const diagnoseResponse: AiDiagnoseResponse = {
      diagnosis: 'Worn brake pads',
      recommendations: ['Replace front brake pads', 'Inspect rotors'],
      urgency: 'high',
      provider: 'openai',
    };

    it('should call ApiService.post with /ai/diagnose and return the response', (done) => {
      mockApiService.post.and.returnValue(of(diagnoseResponse));

      service.diagnose(diagnoseRequest).subscribe((result) => {
        expect(mockApiService.post).toHaveBeenCalledWith('/ai/diagnose', diagnoseRequest);
        expect(result).toEqual(diagnoseResponse);
        done();
      });
    });
  });

  describe('estimate', () => {
    const estimateRequest: AiEstimateRequest = {
      serviceType: 'brake_replacement',
      carMake: 'Toyota',
      carModel: 'Corolla',
      description: 'Front brake pad replacement',
    };

    const estimateResponse: AiEstimateResponse = {
      estimatedCost: { min: 150, max: 300 },
      estimatedHours: 2,
      breakdown: ['Parts: $80-$150', 'Labor: $70-$150'],
      provider: 'openai',
    };

    it('should call ApiService.post with /ai/estimate and return the response', (done) => {
      mockApiService.post.and.returnValue(of(estimateResponse));

      service.estimate(estimateRequest).subscribe((result) => {
        expect(mockApiService.post).toHaveBeenCalledWith('/ai/estimate', estimateRequest);
        expect(result).toEqual(estimateResponse);
        done();
      });
    });
  });

  describe('suggestSchedule', () => {
    const scheduleRequest: AiScheduleRequest = {
      appointmentType: 'maintenance',
      preferredDate: '2026-04-01',
      estimatedDuration: 60,
    };

    const scheduleResponse: AiScheduleResponse = {
      suggestedSlots: [
        {
          start: '2026-04-01T09:00:00',
          end: '2026-04-01T10:00:00',
          mechanicId: 'mech-1',
          mechanicName: 'John',
          score: 0.95,
          reason: 'Best availability match',
        },
      ],
      provider: 'openai',
    };

    it('should call ApiService.post with /ai/suggest-schedule and return the response', (done) => {
      mockApiService.post.and.returnValue(of(scheduleResponse));

      service.suggestSchedule(scheduleRequest).subscribe((result) => {
        expect(mockApiService.post).toHaveBeenCalledWith('/ai/suggest-schedule', scheduleRequest);
        expect(result).toEqual(scheduleResponse);
        done();
      });
    });
  });

  describe('generateInsights', () => {
    const insightsRequest: AiInsightsRequest = {
      period: 'month',
      metrics: { revenue: 5000, appointments: 120 },
    };

    const insightsResponse: AiInsightsResponse = {
      insights: ['Revenue up 15% vs last month'],
      highlights: [
        { label: 'Revenue', trend: 'up', detail: '+15%' },
      ],
      provider: 'openai',
    };

    it('should call ApiService.post with /ai/insights and return the response', (done) => {
      mockApiService.post.and.returnValue(of(insightsResponse));

      service.generateInsights(insightsRequest).subscribe((result) => {
        expect(mockApiService.post).toHaveBeenCalledWith('/ai/insights', insightsRequest);
        expect(result).toEqual(insightsResponse);
        done();
      });
    });
  });

  describe('predictMaintenance', () => {
    const maintenanceRequest: AiMaintenancePredictionRequest = {
      carId: 'car-123',
      language: 'en',
    };

    const maintenanceResponse: AiMaintenancePredictionResponse = {
      predictions: [
        {
          carId: 'car-123',
          carLabel: 'Peugeot 308 · 123-TUN-4567',
          service: 'oil-change',
          predictedDate: '2026-05-01',
          confidence: 0.9,
          urgency: 'medium',
          reason: 'Based on mileage interval',
        },
      ],
      provider: 'groq',
    };

    it('should call ApiService.post with /ai/predict-maintenance and return the response', (done) => {
      mockApiService.post.and.returnValue(of(maintenanceResponse));

      service.predictMaintenance(maintenanceRequest).subscribe((result) => {
        expect(mockApiService.post).toHaveBeenCalledWith('/ai/predict-maintenance', maintenanceRequest);
        expect(result).toEqual(maintenanceResponse);
        done();
      });
    });
  });

  describe('predictChurn', () => {
    const churnRequest: AiChurnPredictionRequest = {
      customerId: 'cust-456',
    };

    const churnResponse: AiChurnPredictionResponse = {
      predictions: [
        {
          customerId: 'cust-456',
          customerName: 'Jane Doe',
          churnRisk: 0.75,
          riskLevel: 'high',
          factors: ['No visit in 6 months', 'Declined last appointment'],
          suggestedAction: 'Send personalized discount offer',
        },
      ],
      provider: 'openai',
    };

    it('should call ApiService.post with /ai/predict-churn and return the response', (done) => {
      mockApiService.post.and.returnValue(of(churnResponse));

      service.predictChurn(churnRequest).subscribe((result) => {
        expect(mockApiService.post).toHaveBeenCalledWith('/ai/predict-churn', churnRequest);
        expect(result).toEqual(churnResponse);
        done();
      });
    });
  });

  describe('loading signal', () => {
    it('should set loading to true during a call and false after completion', () => {
      const subject = new Subject<AiChatResponse>();
      mockApiService.post.and.returnValue(subject.asObservable());

      const request: AiChatRequest = {
        messages: [{ role: 'user', content: 'test' }],
      };

      // Subscribe to start the call
      service.chat(request).subscribe();

      // After subscribing but before emission, loading should be true
      expect(service.loading()).toBe(true);

      // Emit value and complete — finalize runs synchronously after complete
      subject.next({ message: 'response', provider: 'test' });
      subject.complete();

      // After the stream completes, finalize has run and loading is false
      expect(service.loading()).toBe(false);
    });

    it('should set loading to false after an error', () => {
      const httpError = new HttpErrorResponse({
        status: 500,
        statusText: 'Internal Server Error',
      });
      mockApiService.post.and.returnValue(throwError(() => httpError));

      const request: AiChatRequest = {
        messages: [{ role: 'user', content: 'test' }],
      };

      service.chat(request).subscribe({
        error: () => {
          // intentionally empty — just consume the error
        },
      });

      // After the observable errors and finalize runs, loading is false
      expect(service.loading()).toBe(false);
    });
  });

  describe('error signal', () => {
    it('should be null initially', () => {
      expect(service.error()).toBeNull();
    });

    it('should be set on HTTP failure', (done) => {
      const httpError = new HttpErrorResponse({
        status: 500,
        statusText: 'Internal Server Error',
      });
      mockApiService.post.and.returnValue(throwError(() => httpError));

      const request: AiChatRequest = {
        messages: [{ role: 'user', content: 'test' }],
      };

      service.chat(request).subscribe({
        error: () => {
          const error = service.error();
          expect(error).not.toBeNull();
          expect(error!.code).toBe('UNKNOWN');
          expect(error!.message).toBeTruthy();
          done();
        },
      });
    });

    it('should clear error at the start of a new call', (done) => {
      // First: trigger an error
      const httpError = new HttpErrorResponse({
        status: 500,
        statusText: 'Internal Server Error',
      });
      mockApiService.post.and.returnValue(throwError(() => httpError));

      const request: AiChatRequest = {
        messages: [{ role: 'user', content: 'test' }],
      };

      service.chat(request).subscribe({
        error: () => {
          expect(service.error()).not.toBeNull();

          // Second: start a new successful call — error should clear immediately
          const successResponse: AiChatResponse = { message: 'ok', provider: 'test' };
          mockApiService.post.and.returnValue(of(successResponse));

          // The call to chat() internally calls this.error.set(null) synchronously
          // before returning the observable. But we need to subscribe to trigger callAi.
          service.chat(request).subscribe(() => {
            expect(service.error()).toBeNull();
            done();
          });
        },
      });
    });

    it('should re-throw the AiError via the observable', (done) => {
      const httpError = new HttpErrorResponse({
        status: 429,
        statusText: 'Too Many Requests',
      });
      mockApiService.post.and.returnValue(throwError(() => httpError));

      const request: AiChatRequest = {
        messages: [{ role: 'user', content: 'test' }],
      };

      service.chat(request).subscribe({
        error: (err: AiError) => {
          expect(err.code).toBe('RATE_LIMITED');
          done();
        },
      });
    });
  });

  describe('clearError', () => {
    it('should reset error signal to null', (done) => {
      // First: cause an error
      const httpError = new HttpErrorResponse({
        status: 503,
        statusText: 'Service Unavailable',
      });
      mockApiService.post.and.returnValue(throwError(() => httpError));

      const request: AiChatRequest = {
        messages: [{ role: 'user', content: 'test' }],
      };

      service.chat(request).subscribe({
        error: () => {
          expect(service.error()).not.toBeNull();

          service.clearError();

          expect(service.error()).toBeNull();
          done();
        },
      });
    });

    it('should be safe to call when no error exists', () => {
      expect(service.error()).toBeNull();
      service.clearError();
      expect(service.error()).toBeNull();
    });
  });

  describe('HTTP error mapping', () => {
    const request: AiChatRequest = {
      messages: [{ role: 'user', content: 'test' }],
    };

    it('should map HTTP 429 to RATE_LIMITED', (done) => {
      const httpError = new HttpErrorResponse({
        status: 429,
        statusText: 'Too Many Requests',
      });
      mockApiService.post.and.returnValue(throwError(() => httpError));

      service.chat(request).subscribe({
        error: (err: AiError) => {
          expect(err.code).toBe('RATE_LIMITED');
          expect(service.error()!.code).toBe('RATE_LIMITED');
          done();
        },
      });
    });

    it('should map HTTP 503 to PROVIDER_UNAVAILABLE', (done) => {
      const httpError = new HttpErrorResponse({
        status: 503,
        statusText: 'Service Unavailable',
      });
      mockApiService.post.and.returnValue(throwError(() => httpError));

      service.chat(request).subscribe({
        error: (err: AiError) => {
          expect(err.code).toBe('PROVIDER_UNAVAILABLE');
          expect(service.error()!.code).toBe('PROVIDER_UNAVAILABLE');
          done();
        },
      });
    });

    it('should map HTTP 0 (network error) to PROVIDER_UNAVAILABLE', (done) => {
      const httpError = new HttpErrorResponse({
        status: 0,
        statusText: 'Unknown Error',
      });
      mockApiService.post.and.returnValue(throwError(() => httpError));

      service.chat(request).subscribe({
        error: (err: AiError) => {
          expect(err.code).toBe('PROVIDER_UNAVAILABLE');
          expect(service.error()!.code).toBe('PROVIDER_UNAVAILABLE');
          done();
        },
      });
    });

    it('should map HTTP 404 to NOT_IMPLEMENTED', (done) => {
      const httpError = new HttpErrorResponse({
        status: 404,
        statusText: 'Not Found',
      });
      mockApiService.post.and.returnValue(throwError(() => httpError));

      service.chat(request).subscribe({
        error: (err: AiError) => {
          expect(err.code).toBe('NOT_IMPLEMENTED');
          expect(service.error()!.code).toBe('NOT_IMPLEMENTED');
          done();
        },
      });
    });

    it('should map HTTP 500 to UNKNOWN', (done) => {
      const httpError = new HttpErrorResponse({
        status: 500,
        statusText: 'Internal Server Error',
      });
      mockApiService.post.and.returnValue(throwError(() => httpError));

      service.chat(request).subscribe({
        error: (err: AiError) => {
          expect(err.code).toBe('UNKNOWN');
          expect(service.error()!.code).toBe('UNKNOWN');
          done();
        },
      });
    });

    it('should map HTTP 400 to UNKNOWN', (done) => {
      const httpError = new HttpErrorResponse({
        status: 400,
        statusText: 'Bad Request',
      });
      mockApiService.post.and.returnValue(throwError(() => httpError));

      service.chat(request).subscribe({
        error: (err: AiError) => {
          expect(err.code).toBe('UNKNOWN');
          done();
        },
      });
    });

    it('should map HTTP 401 to UNKNOWN', (done) => {
      const httpError = new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized',
      });
      mockApiService.post.and.returnValue(throwError(() => httpError));

      service.chat(request).subscribe({
        error: (err: AiError) => {
          expect(err.code).toBe('UNKNOWN');
          done();
        },
      });
    });

    it('should include the error message from HttpErrorResponse', (done) => {
      const httpError = new HttpErrorResponse({
        status: 429,
        statusText: 'Too Many Requests',
        error: { message: 'Rate limit exceeded' },
      });
      mockApiService.post.and.returnValue(throwError(() => httpError));

      service.chat(request).subscribe({
        error: (err: AiError) => {
          expect(err.message).toBeTruthy();
          done();
        },
      });
    });

    it('should use statusText when message is empty', (done) => {
      const httpError = new HttpErrorResponse({
        status: 503,
        statusText: 'Service Unavailable',
      });
      mockApiService.post.and.returnValue(throwError(() => httpError));

      service.chat(request).subscribe({
        error: (err: AiError) => {
          expect(err.message).toBeTruthy();
          done();
        },
      });
    });
  });

  describe('callAi endpoint routing', () => {
    it('should use distinct endpoints for each public method', (done) => {
      mockApiService.post.and.returnValue(of({}));

      const endpoints: string[] = [];
      mockApiService.post.and.callFake((endpoint: string, _body: unknown) => {
        endpoints.push(endpoint);
        return of({} as any);
      });

      let completed = 0;
      const total = 7;
      const checkDone = () => {
        completed++;
        if (completed === total) {
          expect(endpoints).toContain('/ai/chat');
          expect(endpoints).toContain('/ai/diagnose');
          expect(endpoints).toContain('/ai/estimate');
          expect(endpoints).toContain('/ai/suggest-schedule');
          expect(endpoints).toContain('/ai/insights');
          expect(endpoints).toContain('/ai/predict-maintenance');
          expect(endpoints).toContain('/ai/predict-churn');
          expect(new Set(endpoints).size).toBe(7);
          done();
        }
      };

      service.chat({ messages: [] }).subscribe(checkDone);
      service.diagnose({ symptoms: '' }).subscribe(checkDone);
      service.estimate({ serviceType: '' }).subscribe(checkDone);
      service.suggestSchedule({ appointmentType: '', estimatedDuration: 0 }).subscribe(checkDone);
      service.generateInsights({ period: 'week' }).subscribe(checkDone);
      service.predictMaintenance({}).subscribe(checkDone);
      service.predictChurn({}).subscribe(checkDone);
    });
  });

  describe('error across different methods', () => {
    it('should map errors consistently regardless of which method is called', (done) => {
      const httpError = new HttpErrorResponse({
        status: 429,
        statusText: 'Too Many Requests',
      });
      mockApiService.post.and.returnValue(throwError(() => httpError));

      service.diagnose({ symptoms: 'test' }).subscribe({
        error: (err: AiError) => {
          expect(err.code).toBe('RATE_LIMITED');
          expect(service.error()!.code).toBe('RATE_LIMITED');
          done();
        },
      });
    });

    it('should update error signal when a different method fails', (done) => {
      const error429 = new HttpErrorResponse({ status: 429, statusText: 'Too Many Requests' });
      const error503 = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });

      // First call: 429
      mockApiService.post.and.returnValue(throwError(() => error429));
      service.chat({ messages: [] }).subscribe({
        error: () => {
          expect(service.error()!.code).toBe('RATE_LIMITED');

          // Second call with different method: 503
          mockApiService.post.and.returnValue(throwError(() => error503));
          service.estimate({ serviceType: 'test' }).subscribe({
            error: () => {
              expect(service.error()!.code).toBe('PROVIDER_UNAVAILABLE');
              done();
            },
          });
        },
      });
    });
  });
});
