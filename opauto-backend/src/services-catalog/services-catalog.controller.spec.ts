/**
 * S-CAT-009 (Sweep C-21) — Service Catalog admin controller role + paging.
 *
 * Verifies:
 *  - OWNER can POST/PATCH/DELETE; STAFF can only GET (S-CAT-004/005/006).
 *  - The `?page=` envelope path is wired (paginated admin UI contract).
 *  - The legacy flat-array path (no `?page=`) stays untouched (picker
 *    autocomplete still works).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ServicesCatalogController } from './services-catalog.controller';
import { ServicesCatalogService } from './services-catalog.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const MOCK_GARAGE_ID = 'garage-ctrl-cat';

function makeAuthGuard(role: 'OWNER' | 'STAFF') {
  return {
    canActivate: (ctx: any) => {
      const req = ctx.switchToHttp().getRequest();
      req.user = { id: 'user-cat', garageId: MOCK_GARAGE_ID, role };
      return true;
    },
  };
}

describe('ServicesCatalogController — S-CAT-009 admin matrix', () => {
  let app: INestApplication;
  let svc: Record<string, jest.Mock>;

  async function bootstrapAs(role: 'OWNER' | 'STAFF') {
    svc = {
      findAll: jest.fn().mockResolvedValue([{ id: 's1', name: 'Oil change' }]),
      findAllPaginated: jest.fn().mockResolvedValue({
        items: [{ id: 's1', name: 'Oil change' }],
        total: 1,
        page: 1,
        limit: 25,
      }),
      findOne: jest.fn().mockResolvedValue({ id: 's1' }),
      create: jest.fn().mockResolvedValue({ id: 's-new' }),
      update: jest.fn().mockResolvedValue({ id: 's1', name: 'Updated' }),
      remove: jest.fn().mockResolvedValue({ id: 's1', isActive: false }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServicesCatalogController],
      providers: [{ provide: ServicesCatalogService, useValue: svc }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(makeAuthGuard(role))
      .compile();

    app = module.createNestApplication();
    await app.init();
  }

  afterEach(async () => {
    if (app) await app.close();
  });

  describe('OWNER', () => {
    beforeEach(() => bootstrapAs('OWNER'));

    it('GET /service-catalog (no page) → flat array (legacy picker contract)', async () => {
      const res = await request(app.getHttpServer())
        .get('/service-catalog')
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(svc.findAll).toHaveBeenCalled();
      expect(svc.findAllPaginated).not.toHaveBeenCalled();
    });

    it('GET /service-catalog?page=1&limit=10 → paginated envelope', async () => {
      const res = await request(app.getHttpServer())
        .get('/service-catalog?page=1&limit=10')
        .expect(200);
      expect(res.body).toEqual({
        items: [{ id: 's1', name: 'Oil change' }],
        total: 1,
        page: 1,
        limit: 25,
      });
      expect(svc.findAllPaginated).toHaveBeenCalledWith(MOCK_GARAGE_ID, {
        includeInactive: false,
        search: undefined,
        limit: 10,
        page: 1,
      });
      expect(svc.findAll).not.toHaveBeenCalled();
    });

    it('GET /service-catalog?page=2&search=oil&includeInactive=true forwards all params', async () => {
      await request(app.getHttpServer())
        .get('/service-catalog?page=2&search=oil&includeInactive=true&limit=5')
        .expect(200);
      expect(svc.findAllPaginated).toHaveBeenCalledWith(MOCK_GARAGE_ID, {
        includeInactive: true,
        search: 'oil',
        limit: 5,
        page: 2,
      });
    });

    it('POST /service-catalog → 201 (S-CAT-004 OWNER allowed)', async () => {
      await request(app.getHttpServer())
        .post('/service-catalog')
        .send({ code: 'OIL', name: 'Oil change', defaultPrice: 100 })
        .expect(201);
      expect(svc.create).toHaveBeenCalled();
    });

    it('PATCH /service-catalog/:id → 200', async () => {
      await request(app.getHttpServer())
        .patch('/service-catalog/s1')
        .send({ name: 'Renamed' })
        .expect(200);
      expect(svc.update).toHaveBeenCalledWith(
        's1',
        MOCK_GARAGE_ID,
        expect.objectContaining({ name: 'Renamed' }),
      );
    });

    it('DELETE /service-catalog/:id → soft delete (S-CAT-008 default)', async () => {
      await request(app.getHttpServer())
        .delete('/service-catalog/s1')
        .expect(200);
      expect(svc.remove).toHaveBeenCalledWith('s1', MOCK_GARAGE_ID, false);
    });

    it('DELETE /service-catalog/:id?hard=true → hard delete', async () => {
      await request(app.getHttpServer())
        .delete('/service-catalog/s1?hard=true')
        .expect(200);
      expect(svc.remove).toHaveBeenCalledWith('s1', MOCK_GARAGE_ID, true);
    });
  });

  describe('STAFF', () => {
    beforeEach(() => bootstrapAs('STAFF'));

    it('GET /service-catalog → 200 (S-CAT-005 read open to STAFF)', async () => {
      await request(app.getHttpServer()).get('/service-catalog').expect(200);
      expect(svc.findAll).toHaveBeenCalled();
    });

    it('GET /service-catalog?page=1 → 200 (paginated path also open to STAFF)', async () => {
      await request(app.getHttpServer())
        .get('/service-catalog?page=1')
        .expect(200);
      expect(svc.findAllPaginated).toHaveBeenCalled();
    });

    it('POST /service-catalog → 403 (S-CAT-006 STAFF blocked)', async () => {
      await request(app.getHttpServer())
        .post('/service-catalog')
        .send({ code: 'X', name: 'X', defaultPrice: 1 })
        .expect(403);
      expect(svc.create).not.toHaveBeenCalled();
    });

    it('PATCH /service-catalog/:id → 403', async () => {
      await request(app.getHttpServer())
        .patch('/service-catalog/s1')
        .send({ name: 'Hacked' })
        .expect(403);
      expect(svc.update).not.toHaveBeenCalled();
    });

    it('DELETE /service-catalog/:id → 403', async () => {
      await request(app.getHttpServer())
        .delete('/service-catalog/s1')
        .expect(403);
      expect(svc.remove).not.toHaveBeenCalled();
    });
  });
});
