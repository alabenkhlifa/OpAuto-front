import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
  Part,
  PartWithStock,
  Supplier,
  StockMovement,
  PartOrder,
  InventoryAlert,
  InventoryStats,
  PartCategory,
  StockStatus,
  StockMovementType,
  OrderStatus
} from '../models/part.model';
import { fromBackendEnum } from '../utils/enum-mapper';

@Injectable({
  providedIn: 'root'
})
export class PartService {
  private http = inject(HttpClient);

  private partsSubject = new BehaviorSubject<PartWithStock[]>([]);
  public parts$ = this.partsSubject.asObservable();

  private suppliersSubject = new BehaviorSubject<Supplier[]>([]);
  public suppliers$ = this.suppliersSubject.asObservable();

  private stockMovementsSubject = new BehaviorSubject<StockMovement[]>([]);
  public stockMovements$ = this.stockMovementsSubject.asObservable();

  private ordersSubject = new BehaviorSubject<PartOrder[]>([]);
  public orders$ = this.ordersSubject.asObservable();

  private alertsSubject = new BehaviorSubject<InventoryAlert[]>([]);
  public alerts$ = this.alertsSubject.asObservable();

  // Search and filter signals
  public searchQuery = signal<string>('');
  public selectedCategory = signal<string>('all');
  public selectedSupplier = signal<string>('all');
  public selectedStockStatus = signal<string>('all');

  // --- Backend mapping ---

  private mapFromBackend(b: any): PartWithStock {
    const quantity = b.quantity ?? 0;
    const minQuantity = b.minQuantity ?? 0;
    return {
      id: b.id,
      name: b.name ?? '',
      partNumber: b.partNumber ?? '',
      description: b.description ?? '',
      category: fromBackendEnum(b.category) as PartCategory,
      supplierId: b.supplierId ?? '',
      brand: '',
      price: b.unitPrice ?? 0,
      currency: 'TND',
      stockLevel: quantity,
      minStockLevel: minQuantity,
      maxStockLevel: minQuantity * 3,
      unit: 'piece',
      location: '',
      isActive: true,
      createdAt: b.createdAt ? new Date(b.createdAt) : new Date(),
      updatedAt: b.updatedAt ? new Date(b.updatedAt) : new Date(),
      stockStatus: this.calculateStockStatus(quantity, minQuantity),
      totalUsageThisMonth: 0,
      averageMonthlyUsage: 0,
      daysUntilReorder: 999
    };
  }

  private mapToBackend(f: Partial<Part>): any {
    return {
      name: f.name,
      partNumber: f.partNumber,
      description: f.description,
      category: f.category,
      quantity: f.stockLevel,
      minQuantity: f.minStockLevel,
      unitPrice: f.price,
      supplierId: f.supplierId
    };
  }

  // --- Parts CRUD operations ---

  getParts(): Observable<PartWithStock[]> {
    return this.http.get<any[]>('/inventory').pipe(
      map(items => items.map(b => this.mapFromBackend(b))),
      tap(parts => this.partsSubject.next(parts))
    );
  }

  /**
   * BUG-096 (Sweep C-18) — debounced server-side search for the
   * part-picker. Hits `GET /inventory?search=&limit=` so the picker no
   * longer dumps the full inventory into memory. Caller is expected to
   * debounce + switchMap to cancel stale requests.
   *
   * Empty / whitespace `term` returns the first `limit` rows so the
   * dropdown still has something to render on focus.
   *
   * NOTE: Distinct from the legacy in-memory `searchParts(query)` below
   * which filters the cached `partsSubject`. New picker code should use
   * this method.
   */
  searchPartsServer(term: string, limit = 25): Observable<PartWithStock[]> {
    let params = new HttpParams().set('limit', String(limit));
    const trimmed = (term ?? '').trim();
    if (trimmed) params = params.set('search', trimmed);
    return this.http.get<any[]>('/inventory', { params }).pipe(
      map((items) => items.map((b) => this.mapFromBackend(b))),
    );
  }

  getPartById(partId: string): PartWithStock | undefined {
    return this.partsSubject.value.find(part => part.id === partId);
  }

  createPart(part: Omit<Part, 'id' | 'createdAt' | 'updatedAt'>): Observable<PartWithStock> {
    return this.http.post<any>('/inventory', this.mapToBackend(part)).pipe(
      map(b => this.mapFromBackend(b)),
      tap(newPart => {
        const current = this.partsSubject.value;
        this.partsSubject.next([...current, newPart]);
      })
    );
  }

  updatePart(partId: string, updates: Partial<Part>): Observable<PartWithStock> {
    return this.http.put<any>(`/inventory/${partId}`, this.mapToBackend(updates)).pipe(
      map(b => this.mapFromBackend(b)),
      tap(updated => {
        const current = this.partsSubject.value;
        const index = current.findIndex(p => p.id === partId);
        if (index !== -1) {
          const updatedList = [...current];
          updatedList[index] = updated;
          this.partsSubject.next(updatedList);
        }
      })
    );
  }

  deletePart(partId: string): Observable<boolean> {
    return this.http.delete<void>(`/inventory/${partId}`).pipe(
      map(() => {
        const current = this.partsSubject.value;
        this.partsSubject.next(current.filter(p => p.id !== partId));
        return true;
      })
    );
  }

  // --- Stock management ---

  adjustStock(partId: string, quantity: number, reason: string, performedBy: string): Observable<StockMovement> {
    const type: 'in' | 'out' = quantity >= 0 ? 'in' : 'out';
    const absQty = Math.abs(quantity);
    return this.http.post<any>(`/inventory/${partId}/adjust`, { quantity: absQty, type, reason }).pipe(
      map(b => {
        const mapped = this.mapFromBackend(b);
        const current = this.partsSubject.value;
        const index = current.findIndex(p => p.id === partId);
        if (index !== -1) {
          const updatedList = [...current];
          updatedList[index] = mapped;
          this.partsSubject.next(updatedList);
        }

        const movement: StockMovement = {
          id: Date.now().toString(),
          partId,
          type,
          quantity: absQty,
          reason,
          performedBy,
          createdAt: new Date()
        };
        const movements = this.stockMovementsSubject.value;
        this.stockMovementsSubject.next([movement, ...movements]);
        this.checkAndCreateAlerts(partId, mapped.stockLevel ?? 0);
        return movement;
      })
    );
  }

  getStockMovements(partId?: string): Observable<StockMovement[]> {
    return this.http.get<StockMovement[]>('/inventory/movements').pipe(
      tap(movements => this.stockMovementsSubject.next(movements)),
      map(movements => {
        const filtered = partId ? movements.filter(m => m.partId === partId) : movements;
        return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      })
    );
  }

  // --- Suppliers ---

  getSuppliers(): Observable<Supplier[]> {
    return this.http.get<Supplier[]>('/inventory/suppliers').pipe(
      tap(suppliers => this.suppliersSubject.next(suppliers))
    );
  }

  getSupplierById(supplierId: string): Supplier | undefined {
    return this.suppliersSubject.value.find(supplier => supplier.id === supplierId);
  }

  // --- Filtering and search ---

  getPartsByCategory(category: PartCategory): Observable<PartWithStock[]> {
    const filtered = this.partsSubject.value.filter(part => part.category === category);
    return of(filtered);
  }

  getPartsBySupplier(supplierId: string): Observable<PartWithStock[]> {
    const filtered = this.partsSubject.value.filter(part => part.supplierId === supplierId);
    return of(filtered);
  }

  getPartsByStockStatus(status: StockStatus): Observable<PartWithStock[]> {
    const filtered = this.partsSubject.value.filter(part => part.stockStatus === status);
    return of(filtered);
  }

  searchParts(query: string): Observable<PartWithStock[]> {
    const filtered = this.partsSubject.value.filter(part =>
      part.name.toLowerCase().includes(query.toLowerCase()) ||
      part.partNumber.toLowerCase().includes(query.toLowerCase()) ||
      part.brand.toLowerCase().includes(query.toLowerCase()) ||
      part.description?.toLowerCase().includes(query.toLowerCase())
    );
    return of(filtered);
  }

  // --- Alerts ---

  getAlerts(): Observable<InventoryAlert[]> {
    return this.alerts$;
  }

  markAlertAsRead(alertId: string): Observable<boolean> {
    const alerts = this.alertsSubject.value;
    const index = alerts.findIndex(alert => alert.id === alertId);
    if (index !== -1) {
      alerts[index] = { ...alerts[index], isRead: true };
      this.alertsSubject.next([...alerts]);
      return of(true);
    }
    return of(false);
  }

  // --- Statistics ---

  getInventoryStats(): Observable<InventoryStats> {
    const parts = this.partsSubject.value;
    const movements = this.stockMovementsSubject.value;

    const totalParts = parts.length;
    const totalValue = parts.reduce((sum, part) => sum + (part.price * part.stockLevel), 0);
    const lowStockCount = parts.filter(part => part.stockStatus === 'low-stock').length;
    const outOfStockCount = parts.filter(part => part.stockStatus === 'out-of-stock').length;

    const categoryCounts = parts.reduce((counts, part) => {
      counts[part.category] = (counts[part.category] || 0) + 1;
      return counts;
    }, {} as Record<PartCategory, number>);

    const topUsedParts = [...parts]
      .sort((a, b) => b.totalUsageThisMonth - a.totalUsageThisMonth)
      .slice(0, 5);

    const recentMovements = [...movements]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    const stats: InventoryStats = {
      totalParts,
      totalValue,
      lowStockCount,
      outOfStockCount,
      pendingOrdersCount: 0,
      categoryCounts,
      topUsedParts,
      recentMovements
    };

    return of(stats);
  }

  // --- Utility methods ---

  getAvailableCategories(): PartCategory[] {
    return ['engine', 'transmission', 'brakes', 'suspension', 'electrical', 'filters', 'fluids', 'tires', 'body', 'accessories', 'consumables'];
  }

  getStockStatusColor(status: StockStatus): string {
    const colors = {
      'in-stock': 'text-green-600',
      'low-stock': 'text-amber-600',
      'out-of-stock': 'text-red-600',
      'ordered': 'text-blue-600'
    };
    return colors[status] || 'text-gray-600';
  }

  getStockStatusBadgeClass(status: StockStatus): string {
    const classes = {
      'in-stock': 'badge badge-in-stock',
      'low-stock': 'badge badge-low-stock',
      'out-of-stock': 'badge badge-out-of-stock',
      'ordered': 'badge badge-ordered'
    };
    return classes[status] || 'badge badge-ordered';
  }

  getCategoryIcon(category: PartCategory): string {
    const icons = {
      'engine': 'engine',
      'transmission': 'gears',
      'brakes': 'disc',
      'suspension': 'spring',
      'electrical': 'zap',
      'filters': 'filter',
      'fluids': 'droplet',
      'tires': 'circle',
      'body': 'car',
      'accessories': 'tool',
      'consumables': 'package'
    };
    return icons[category] || 'package';
  }

  private calculateStockStatus(stockLevel: number, minStockLevel: number): StockStatus {
    if (stockLevel === 0) return 'out-of-stock';
    if (stockLevel <= minStockLevel) return 'low-stock';
    return 'in-stock';
  }

  private calculateDaysUntilReorder(stockLevel: number, averageUsage: number): number {
    if (averageUsage === 0) return 999;
    return Math.floor(stockLevel / (averageUsage / 30));
  }

  private checkAndCreateAlerts(partId: string, newStockLevel: number): void {
    const part = this.getPartById(partId);
    if (!part) return;

    // Remove existing alerts for this part
    let alerts = this.alertsSubject.value.filter(alert => alert.partId !== partId);

    // Create new alert if needed
    if (newStockLevel === 0) {
      alerts.push({
        id: Date.now().toString(),
        partId,
        type: 'out-of-stock',
        message: `${part.name} is out of stock`,
        severity: 'critical',
        isRead: false,
        createdAt: new Date()
      });
    } else if (newStockLevel <= part.minStockLevel) {
      alerts.push({
        id: Date.now().toString(),
        partId,
        type: 'low-stock',
        message: `${part.name} stock is low (${newStockLevel} remaining)`,
        severity: 'warning',
        isRead: false,
        createdAt: new Date()
      });
    }

    this.alertsSubject.next([...alerts]);
  }
}
