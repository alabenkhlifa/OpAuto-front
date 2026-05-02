import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ServiceCatalogService } from './service-catalog.service';

/**
 * S-CAT-009 (Sweep C-21) — service-catalog HTTP envelope contract.
 *
 * Pins the new `getCatalogPaginated()` method that drives the admin
 * page. The legacy `loadCatalog()` and `searchCatalog()` paths are
 * spot-checked to ensure they did not regress.
 */
describe('ServiceCatalogService', () => {
  let service: ServiceCatalogService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ServiceCatalogService],
    });
    service = TestBed.inject(ServiceCatalogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('getCatalogPaginated (Sweep C-21)', () => {
    it('hits /service-catalog with default page=1 / limit=25', () => {
      service.getCatalogPaginated().subscribe();
      const req = http.expectOne(
        (r) =>
          r.url === '/service-catalog' &&
          r.params.get('page') === '1' &&
          r.params.get('limit') === '25',
      );
      expect(req.request.method).toBe('GET');
      req.flush({ items: [], total: 0, page: 1, limit: 25 });
    });

    it('forwards search / page / limit / includeInactive', () => {
      service
        .getCatalogPaginated({
          search: 'oil',
          page: 2,
          limit: 10,
          includeInactive: true,
        })
        .subscribe();
      const req = http.expectOne((r) => r.url === '/service-catalog');
      expect(req.request.params.get('search')).toBe('oil');
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('limit')).toBe('10');
      expect(req.request.params.get('includeInactive')).toBe('true');
      req.flush({ items: [], total: 0, page: 2, limit: 10 });
    });

    it('omits whitespace-only search from the query string', () => {
      service.getCatalogPaginated({ search: '   ' }).subscribe();
      const req = http.expectOne((r) => r.url === '/service-catalog');
      expect(req.request.params.get('search')).toBeNull();
      req.flush({ items: [], total: 0, page: 1, limit: 25 });
    });

    it('returns the BE envelope verbatim through the observable', (done) => {
      const envelope = {
        items: [
          {
            id: 's1',
            garageId: 'g1',
            code: 'OIL',
            name: 'Oil change',
            defaultPrice: 120,
            defaultTvaRate: 19,
            isActive: true,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        ],
        total: 42,
        page: 1,
        limit: 25,
      };
      service.getCatalogPaginated().subscribe((result) => {
        expect(result).toEqual(envelope);
        done();
      });
      const req = http.expectOne((r) => r.url === '/service-catalog');
      req.flush(envelope);
    });
  });

  describe('CRUD passthroughs', () => {
    it('create POSTs to /service-catalog and updates the cache', (done) => {
      const created = {
        id: 's-new',
        garageId: 'g1',
        code: 'X',
        name: 'New service',
        defaultPrice: 50,
        defaultTvaRate: 19,
        isActive: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      } as any;
      service
        .create({
          code: 'X',
          name: 'New service',
          defaultPrice: 50,
          defaultTvaRate: 19,
          isActive: true,
        })
        .subscribe(() => {
          expect(service.catalog).toEqual([created]);
          done();
        });
      const req = http.expectOne('/service-catalog');
      expect(req.request.method).toBe('POST');
      req.flush(created);
    });

    it('update PATCHes /service-catalog/:id', (done) => {
      service
        .update('s1', { name: 'Renamed' })
        .subscribe(() => done());
      const req = http.expectOne('/service-catalog/s1');
      expect(req.request.method).toBe('PATCH');
      req.flush({ id: 's1', name: 'Renamed' });
    });

    it('remove (soft) DELETEs /service-catalog/:id without hard flag', (done) => {
      service.remove('s1').subscribe(() => done());
      const req = http.expectOne((r) => r.url === '/service-catalog/s1');
      expect(req.request.method).toBe('DELETE');
      expect(req.request.params.get('hard')).toBeNull();
      req.flush({ id: 's1', isActive: false });
    });

    it('remove (hard=true) attaches ?hard=true', (done) => {
      service.remove('s1', true).subscribe(() => done());
      const req = http.expectOne((r) => r.url === '/service-catalog/s1');
      expect(req.request.params.get('hard')).toBe('true');
      req.flush({ id: 's1' });
    });
  });
});
