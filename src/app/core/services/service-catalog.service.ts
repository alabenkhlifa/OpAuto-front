import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  ServiceCatalogEntry,
  CreateServiceCatalogRequest,
  UpdateServiceCatalogRequest,
} from '../models/service-catalog.model';

/**
 * ServiceCatalogService — thin HTTP wrapper around `/service-catalog`.
 *
 * Maintains an in-memory cache of the active catalog so multiple
 * pickers on the same screen share a single backend call. Call
 * `loadCatalog()` once on app boot or on form open.
 */
@Injectable({ providedIn: 'root' })
export class ServiceCatalogService {
  private http = inject(HttpClient);

  private readonly baseUrl = '/service-catalog';

  private catalogSubject = new BehaviorSubject<ServiceCatalogEntry[]>([]);
  public catalog$ = this.catalogSubject.asObservable();

  /** Current snapshot of cached entries (sync access for filters). */
  get catalog(): ServiceCatalogEntry[] {
    return this.catalogSubject.value;
  }

  loadCatalog(includeInactive = false): Observable<ServiceCatalogEntry[]> {
    const params = includeInactive
      ? new HttpParams().set('includeInactive', 'true')
      : undefined;
    return this.http
      .get<ServiceCatalogEntry[]>(this.baseUrl, { params })
      .pipe(tap((rows) => this.catalogSubject.next(rows)));
  }

  /**
   * BUG-096 (Sweep C-18) — debounced server-side search for the
   * service-picker. Hits `GET /service-catalog?search=&limit=` so we no
   * longer dump the full catalog into memory on form open. Caller is
   * expected to debounce + switchMap to cancel stale requests.
   *
   * Empty / whitespace `term` returns the first `limit` rows so the
   * picker still has something to show on focus.
   */
  searchCatalog(term: string, limit = 25): Observable<ServiceCatalogEntry[]> {
    let params = new HttpParams().set('limit', String(limit));
    const trimmed = (term ?? '').trim();
    if (trimmed) params = params.set('search', trimmed);
    return this.http.get<ServiceCatalogEntry[]>(this.baseUrl, { params });
  }

  /**
   * S-CAT-009 (Sweep C-21) — paginated catalog list for the admin UI.
   * Returns the BE envelope `{ items, total, page, limit }` so the
   * admin page can drive its pagination footer off a stable
   * BE-authoritative count. Mirrors `InvoiceService.getInvoicesPaginated()`.
   */
  getCatalogPaginated(opts: {
    search?: string;
    page?: number;
    limit?: number;
    includeInactive?: boolean;
  } = {}): Observable<{
    items: ServiceCatalogEntry[];
    total: number;
    page: number;
    limit: number;
  }> {
    let params = new HttpParams();
    const trimmed = (opts.search ?? '').trim();
    if (trimmed) params = params.set('search', trimmed);
    params = params.set('page', String(opts.page ?? 1));
    params = params.set('limit', String(opts.limit ?? 25));
    if (opts.includeInactive) params = params.set('includeInactive', 'true');
    return this.http.get<{
      items: ServiceCatalogEntry[];
      total: number;
      page: number;
      limit: number;
    }>(this.baseUrl, { params });
  }

  getOne(id: string): Observable<ServiceCatalogEntry> {
    return this.http.get<ServiceCatalogEntry>(`${this.baseUrl}/${id}`);
  }

  create(
    payload: CreateServiceCatalogRequest,
  ): Observable<ServiceCatalogEntry> {
    return this.http
      .post<ServiceCatalogEntry>(this.baseUrl, payload)
      .pipe(tap((row) => this.catalogSubject.next([...this.catalog, row])));
  }

  update(
    id: string,
    payload: UpdateServiceCatalogRequest,
  ): Observable<ServiceCatalogEntry> {
    return this.http
      .patch<ServiceCatalogEntry>(`${this.baseUrl}/${id}`, payload)
      .pipe(
        tap((updated) =>
          this.catalogSubject.next(
            this.catalog.map((c) => (c.id === id ? updated : c)),
          ),
        ),
      );
  }

  remove(id: string, hard = false): Observable<unknown> {
    const params = hard ? new HttpParams().set('hard', 'true') : undefined;
    return this.http.delete(`${this.baseUrl}/${id}`, { params }).pipe(
      tap(() => {
        if (hard) {
          this.catalogSubject.next(this.catalog.filter((c) => c.id !== id));
        } else {
          this.catalogSubject.next(
            this.catalog.map((c) =>
              c.id === id ? { ...c, isActive: false } : c,
            ),
          );
        }
      }),
    );
  }

  /**
   * Pure filter helper — kept on the service so the picker component
   * stays presentation-only and we can re-use the same matcher in any
   * future autocomplete call site.
   */
  filter(query: string, includeInactive = false): ServiceCatalogEntry[] {
    const q = query.trim().toLowerCase();
    return this.catalog.filter((row) => {
      if (!includeInactive && !row.isActive) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.code.toLowerCase().includes(q) ||
        (row.category ?? '').toLowerCase().includes(q)
      );
    });
  }
}
