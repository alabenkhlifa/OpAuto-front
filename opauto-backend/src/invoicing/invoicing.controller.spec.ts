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

/**
 * S-PERF-001 (Sweep C-20) — `GET /api/invoices` accepts `?page=` /
 * `?limit=` query params and forwards parsed numeric values to the
 * service. Defaults: page=1, limit=25. `limit` clamps to [1, 100].
 * Invalid / NaN params fall back to defaults — callers can never break
 * the contract by sending garbage.
 */
describe('InvoicingController — S-PERF-001 pagination wiring', () => {
  let app: INestApplication;
  let svc: Record<string, jest.Mock>;

  beforeEach(async () => {
    svc = {
      findAll: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 25,
      }),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      issue: jest.fn(),
      remove: jest.fn(),
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
      .useValue(makeAuthGuard('OWNER'))
      .overrideGuard(ModuleAccessGuard)
      .useValue(PassThroughGuard)
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('defaults to page=1, limit=25 when no query params are supplied', async () => {
    await request(app.getHttpServer()).get('/invoices').expect(200);
    expect(svc.findAll).toHaveBeenCalledWith(MOCK_GARAGE_ID, {
      search: undefined,
      page: 1,
      limit: 25,
    });
  });

  it('forwards ?page=2&limit=50 verbatim', async () => {
    await request(app.getHttpServer())
      .get('/invoices')
      .query({ page: 2, limit: 50 })
      .expect(200);
    expect(svc.findAll).toHaveBeenCalledWith(MOCK_GARAGE_ID, {
      search: undefined,
      page: 2,
      limit: 50,
    });
  });

  it('clamps ?limit=999 down to 100 at the controller layer', async () => {
    await request(app.getHttpServer())
      .get('/invoices')
      .query({ limit: 999 })
      .expect(200);
    expect(svc.findAll).toHaveBeenCalledWith(MOCK_GARAGE_ID, {
      search: undefined,
      page: 1,
      limit: 100,
    });
  });

  it('substitutes default 25 for ?limit=0 (invalid)', async () => {
    await request(app.getHttpServer())
      .get('/invoices')
      .query({ limit: 0 })
      .expect(200);
    expect(svc.findAll).toHaveBeenCalledWith(MOCK_GARAGE_ID, {
      search: undefined,
      page: 1,
      limit: 25,
    });
  });

  it('substitutes default 25 for ?limit=foo (NaN)', async () => {
    await request(app.getHttpServer())
      .get('/invoices')
      .query({ limit: 'foo' })
      .expect(200);
    expect(svc.findAll).toHaveBeenCalledWith(MOCK_GARAGE_ID, {
      search: undefined,
      page: 1,
      limit: 25,
    });
  });

  it('substitutes default 1 for ?page=0', async () => {
    await request(app.getHttpServer())
      .get('/invoices')
      .query({ page: 0 })
      .expect(200);
    expect(svc.findAll).toHaveBeenCalledWith(MOCK_GARAGE_ID, {
      search: undefined,
      page: 1,
      limit: 25,
    });
  });

  it('substitutes default 1 for ?page=-3 (negative)', async () => {
    await request(app.getHttpServer())
      .get('/invoices')
      .query({ page: -3 })
      .expect(200);
    expect(svc.findAll).toHaveBeenCalledWith(MOCK_GARAGE_ID, {
      search: undefined,
      page: 1,
      limit: 25,
    });
  });

  it('forwards search alongside pagination', async () => {
    await request(app.getHttpServer())
      .get('/invoices')
      .query({ search: 'Karoui', page: 3, limit: 10 })
      .expect(200);
    expect(svc.findAll).toHaveBeenCalledWith(MOCK_GARAGE_ID, {
      search: 'Karoui',
      page: 3,
      limit: 10,
    });
  });

  it('returns the paginated envelope shape verbatim from the service', async () => {
    svc.findAll.mockResolvedValueOnce({
      items: [{ id: 'inv-1' }],
      total: 237,
      page: 2,
      limit: 25,
    });
    const res = await request(app.getHttpServer())
      .get('/invoices')
      .query({ page: 2 })
      .expect(200);
    expect(res.body).toEqual({
      items: [{ id: 'inv-1' }],
      total: 237,
      page: 2,
      limit: 25,
    });
  });
});
