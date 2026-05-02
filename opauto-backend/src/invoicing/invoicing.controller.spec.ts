/**
 * BUG-097 (Sweep C-16) — DELETE /invoices/:id returns 204 No Content.
 *
 * Pre-fix: the controller returned `service.remove(...)`'s deleted invoice
 * payload with status 200. Standard REST convention (and our `S-INV-016`
 * scenario) expects 204 + empty body. The frontend `InvoiceService.deleteInvoice()`
 * already calls `http.delete<void>(...)` and ignores the body, so this is a
 * backend-side correctness fix only.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { InvoicingController } from './invoicing.controller';
import { InvoicingService } from './invoicing.service';
import { FromJobService } from './from-job.service';
import { DeliveryService } from './delivery.service';
import { PdfRendererService } from './pdf-renderer.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleAccessGuard } from '../modules/module-access.guard';

const MOCK_GARAGE_ID = 'garage-ctrl-001';

function makeAuthGuard(role: 'OWNER' | 'STAFF') {
  return {
    canActivate: (ctx) => {
      const req = ctx.switchToHttp().getRequest();
      req.user = { id: 'user-1', garageId: MOCK_GARAGE_ID, role };
      return true;
    },
  };
}

const PassThroughGuard = { canActivate: () => true };

describe('InvoicingController — BUG-097 DELETE 204', () => {
  let app: INestApplication;
  let svc: Record<string, jest.Mock>;

  async function bootstrapAs(role: 'OWNER' | 'STAFF') {
    svc = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      issue: jest.fn(),
      remove: jest.fn().mockResolvedValue({
        id: 'inv-deleted',
        invoiceNumber: 'INV-DRAFT-1',
        status: 'DRAFT',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoicingController],
      providers: [
        { provide: InvoicingService, useValue: svc },
        { provide: FromJobService, useValue: { createFromJob: jest.fn() } },
        { provide: DeliveryService, useValue: { deliverInvoice: jest.fn() } },
        { provide: PdfRendererService, useValue: { renderInvoice: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(makeAuthGuard(role))
      .overrideGuard(ModuleAccessGuard)
      .useValue(PassThroughGuard)
      .compile();

    app = module.createNestApplication();
    await app.init();
  }

  afterEach(async () => {
    if (app) await app.close();
  });

  describe('OWNER', () => {
    beforeEach(() => bootstrapAs('OWNER'));

    it('DELETE /invoices/:id returns 204 No Content with empty body', async () => {
      const res = await request(app.getHttpServer())
        .delete('/invoices/inv-deleted')
        .expect(204);

      // 204 = no body. supertest exposes res.text === '' on no-content.
      expect(res.text).toBe('');
      expect(res.body).toEqual({});
      expect(svc.remove).toHaveBeenCalledWith('inv-deleted', MOCK_GARAGE_ID);
    });

    it('does NOT leak the deleted invoice payload in the response', async () => {
      const res = await request(app.getHttpServer())
        .delete('/invoices/inv-deleted')
        .expect(204);

      // Even though service.remove resolves with the full record, the
      // controller returns void → no body on the wire.
      expect(JSON.stringify(res.body)).not.toContain('inv-deleted');
      expect(JSON.stringify(res.body)).not.toContain('INV-DRAFT-1');
    });
  });

  describe('STAFF', () => {
    beforeEach(() => bootstrapAs('STAFF'));

    it('DELETE /invoices/:id → 403 (OWNER-only)', async () => {
      await request(app.getHttpServer())
        .delete('/invoices/inv-deleted')
        .expect(403);
      expect(svc.remove).not.toHaveBeenCalled();
    });
  });
});
