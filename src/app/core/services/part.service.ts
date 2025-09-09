import { Injectable, signal, computed } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
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

@Injectable({
  providedIn: 'root'
})
export class PartService {
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

  private mockSuppliers: Supplier[] = [
    {
      id: 'supplier1',
      name: 'Auto Parts Tunisia',
      contactPerson: 'Karim Bouaziz',
      phone: '+216-70-123-456',
      email: 'contact@autoparts.tn',
      address: 'Avenue Habib Bourguiba, Tunis',
      paymentTerms: '30 days',
      deliveryTime: 3,
      isActive: true,
      createdAt: new Date(2024, 0, 15)
    },
    {
      id: 'supplier2',
      name: 'European Auto Supply',
      contactPerson: 'Marc Dubois',
      phone: '+216-71-654-321',
      email: 'info@euroautosupply.tn',
      address: 'Zone Industrielle, Sfax',
      paymentTerms: '15 days',
      deliveryTime: 5,
      isActive: true,
      createdAt: new Date(2024, 1, 20)
    },
    {
      id: 'supplier3',
      name: 'Maghreb Motors Parts',
      contactPerson: 'Amina Khelifi',
      phone: '+216-72-987-654',
      email: 'sales@maghrebmotors.tn',
      address: 'Route de Sousse, Monastir',
      paymentTerms: '45 days',
      deliveryTime: 2,
      isActive: true,
      createdAt: new Date(2024, 2, 10)
    }
  ];

  private mockParts: PartWithStock[] = [
    {
      id: 'part1',
      name: 'Engine Oil 5W-30',
      partNumber: 'EO-5W30-5L',
      description: 'Synthetic engine oil for modern engines',
      category: 'fluids',
      supplierId: 'supplier1',
      brand: 'Total',
      price: 45.50,
      currency: 'TND',
      stockLevel: 12,
      minStockLevel: 5,
      maxStockLevel: 50,
      unit: 'bottle',
      location: 'Shelf A-1',
      isActive: true,
      createdAt: new Date(2024, 0, 15),
      updatedAt: new Date(2025, 7, 20),
      stockStatus: 'in-stock',
      totalUsageThisMonth: 8,
      averageMonthlyUsage: 10,
      daysUntilReorder: 15
    },
    {
      id: 'part2',
      name: 'Brake Pads Front Set',
      partNumber: 'BP-FRONT-BMW-X5',
      description: 'Front brake pads for BMW X5 series',
      category: 'brakes',
      supplierId: 'supplier2',
      brand: 'Bosch',
      price: 180.00,
      currency: 'TND',
      stockLevel: 2,
      minStockLevel: 4,
      maxStockLevel: 20,
      unit: 'set',
      location: 'Shelf B-3',
      isActive: true,
      createdAt: new Date(2024, 1, 10),
      updatedAt: new Date(2025, 7, 18),
      stockStatus: 'low-stock',
      totalUsageThisMonth: 3,
      averageMonthlyUsage: 4,
      daysUntilReorder: 7
    },
    {
      id: 'part3',
      name: 'Air Filter',
      partNumber: 'AF-UNIVERSAL-001',
      description: 'Universal air filter for most car models',
      category: 'filters',
      supplierId: 'supplier1',
      brand: 'Mann',
      price: 25.90,
      currency: 'TND',
      stockLevel: 0,
      minStockLevel: 8,
      maxStockLevel: 40,
      unit: 'piece',
      location: 'Shelf A-5',
      isActive: true,
      createdAt: new Date(2024, 1, 5),
      updatedAt: new Date(2025, 7, 25),
      stockStatus: 'out-of-stock',
      totalUsageThisMonth: 6,
      averageMonthlyUsage: 8,
      daysUntilReorder: 0
    },
    {
      id: 'part4',
      name: 'Spark Plugs Set',
      partNumber: 'SP-4CYL-NGK',
      description: 'NGK spark plugs for 4-cylinder engines',
      category: 'engine',
      supplierId: 'supplier3',
      brand: 'NGK',
      price: 65.00,
      currency: 'TND',
      stockLevel: 8,
      minStockLevel: 6,
      maxStockLevel: 30,
      unit: 'set',
      location: 'Shelf C-2',
      isActive: true,
      createdAt: new Date(2024, 2, 1),
      updatedAt: new Date(2025, 7, 22),
      stockStatus: 'in-stock',
      totalUsageThisMonth: 2,
      averageMonthlyUsage: 3,
      daysUntilReorder: 20
    },
    {
      id: 'part5',
      name: 'Tire 205/55R16',
      partNumber: 'TR-205-55-16-MX',
      description: 'Michelin tire 205/55R16 for sedans',
      category: 'tires',
      supplierId: 'supplier2',
      brand: 'Michelin',
      price: 320.00,
      currency: 'TND',
      stockLevel: 16,
      minStockLevel: 8,
      maxStockLevel: 40,
      unit: 'piece',
      location: 'Tire Rack 1',
      isActive: true,
      createdAt: new Date(2024, 2, 15),
      updatedAt: new Date(2025, 7, 19),
      stockStatus: 'in-stock',
      totalUsageThisMonth: 4,
      averageMonthlyUsage: 6,
      daysUntilReorder: 25
    }
  ];

  private mockStockMovements: StockMovement[] = [
    {
      id: 'movement1',
      partId: 'part1',
      type: 'out',
      quantity: 2,
      reason: 'Used in service job #SJ001',
      reference: 'SJ001',
      performedBy: 'mechanic1',
      createdAt: new Date(2025, 7, 25),
      notes: 'Oil change for BMW X5'
    },
    {
      id: 'movement2',
      partId: 'part2',
      type: 'out',
      quantity: 1,
      reason: 'Used in service job #SJ002',
      reference: 'SJ002',
      performedBy: 'mechanic2',
      createdAt: new Date(2025, 7, 24),
      notes: 'Brake pad replacement'
    },
    {
      id: 'movement3',
      partId: 'part3',
      type: 'in',
      quantity: 10,
      reason: 'Stock replenishment',
      reference: 'PO001',
      performedBy: 'admin1',
      createdAt: new Date(2025, 7, 20),
      notes: 'Restocked air filters'
    }
  ];

  private mockAlerts: InventoryAlert[] = [
    {
      id: 'alert1',
      partId: 'part3',
      type: 'out-of-stock',
      message: 'Air Filter is out of stock',
      severity: 'critical',
      isRead: false,
      createdAt: new Date(2025, 7, 25)
    },
    {
      id: 'alert2',
      partId: 'part2',
      type: 'low-stock',
      message: 'Brake Pads Front Set stock is low (2 remaining)',
      severity: 'warning',
      isRead: false,
      createdAt: new Date(2025, 7, 24)
    }
  ];

  constructor() {
    this.partsSubject.next(this.mockParts);
    this.suppliersSubject.next(this.mockSuppliers);
    this.stockMovementsSubject.next(this.mockStockMovements);
    this.alertsSubject.next(this.mockAlerts);
  }

  // Parts CRUD operations
  getParts(): Observable<PartWithStock[]> {
    return this.parts$;
  }

  getPartById(partId: string): PartWithStock | undefined {
    return this.mockParts.find(part => part.id === partId);
  }

  createPart(part: Omit<Part, 'id' | 'createdAt' | 'updatedAt'>): Observable<PartWithStock> {
    const newPart: PartWithStock = {
      ...part,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
      stockStatus: this.calculateStockStatus(part.stockLevel, part.minStockLevel),
      totalUsageThisMonth: 0,
      averageMonthlyUsage: 0,
      daysUntilReorder: this.calculateDaysUntilReorder(part.stockLevel, 0)
    };

    this.mockParts.push(newPart);
    this.partsSubject.next([...this.mockParts]);
    return of(newPart);
  }

  updatePart(partId: string, updates: Partial<Part>): Observable<PartWithStock> {
    const index = this.mockParts.findIndex(part => part.id === partId);
    if (index !== -1) {
      const updatedPart = {
        ...this.mockParts[index],
        ...updates,
        updatedAt: new Date(),
        stockStatus: this.calculateStockStatus(
          updates.stockLevel ?? this.mockParts[index].stockLevel,
          updates.minStockLevel ?? this.mockParts[index].minStockLevel
        )
      };
      this.mockParts[index] = updatedPart;
      this.partsSubject.next([...this.mockParts]);
      return of(updatedPart);
    }
    throw new Error('Part not found');
  }

  deletePart(partId: string): Observable<boolean> {
    const index = this.mockParts.findIndex(part => part.id === partId);
    if (index !== -1) {
      this.mockParts.splice(index, 1);
      this.partsSubject.next([...this.mockParts]);
      return of(true);
    }
    return of(false);
  }

  // Stock management
  adjustStock(partId: string, quantity: number, reason: string, performedBy: string): Observable<StockMovement> {
    const part = this.getPartById(partId);
    if (!part) {
      throw new Error('Part not found');
    }

    const movement: StockMovement = {
      id: Date.now().toString(),
      partId,
      type: quantity > 0 ? 'in' : 'out',
      quantity: Math.abs(quantity),
      reason,
      performedBy,
      createdAt: new Date()
    };

    // Update part stock level
    const newStockLevel = part.stockLevel + quantity;
    this.updatePart(partId, { stockLevel: newStockLevel });

    // Add stock movement
    this.mockStockMovements.push(movement);
    this.stockMovementsSubject.next([...this.mockStockMovements]);

    // Check for alerts
    this.checkAndCreateAlerts(partId, newStockLevel);

    return of(movement);
  }

  getStockMovements(partId?: string): Observable<StockMovement[]> {
    const movements = partId 
      ? this.mockStockMovements.filter(m => m.partId === partId)
      : this.mockStockMovements;
    return of(movements.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
  }

  // Suppliers
  getSuppliers(): Observable<Supplier[]> {
    return this.suppliers$;
  }

  getSupplierById(supplierId: string): Supplier | undefined {
    return this.mockSuppliers.find(supplier => supplier.id === supplierId);
  }

  // Filtering and search
  getPartsByCategory(category: PartCategory): Observable<PartWithStock[]> {
    const filtered = this.mockParts.filter(part => part.category === category);
    return of(filtered);
  }

  getPartsBySupplier(supplierId: string): Observable<PartWithStock[]> {
    const filtered = this.mockParts.filter(part => part.supplierId === supplierId);
    return of(filtered);
  }

  getPartsByStockStatus(status: StockStatus): Observable<PartWithStock[]> {
    const filtered = this.mockParts.filter(part => part.stockStatus === status);
    return of(filtered);
  }

  searchParts(query: string): Observable<PartWithStock[]> {
    const filtered = this.mockParts.filter(part =>
      part.name.toLowerCase().includes(query.toLowerCase()) ||
      part.partNumber.toLowerCase().includes(query.toLowerCase()) ||
      part.brand.toLowerCase().includes(query.toLowerCase()) ||
      part.description?.toLowerCase().includes(query.toLowerCase())
    );
    return of(filtered);
  }

  // Alerts
  getAlerts(): Observable<InventoryAlert[]> {
    return this.alerts$;
  }

  markAlertAsRead(alertId: string): Observable<boolean> {
    const index = this.mockAlerts.findIndex(alert => alert.id === alertId);
    if (index !== -1) {
      this.mockAlerts[index].isRead = true;
      this.alertsSubject.next([...this.mockAlerts]);
      return of(true);
    }
    return of(false);
  }

  // Statistics
  getInventoryStats(): Observable<InventoryStats> {
    const totalParts = this.mockParts.length;
    const totalValue = this.mockParts.reduce((sum, part) => sum + (part.price * part.stockLevel), 0);
    const lowStockCount = this.mockParts.filter(part => part.stockStatus === 'low-stock').length;
    const outOfStockCount = this.mockParts.filter(part => part.stockStatus === 'out-of-stock').length;
    
    const categoryCounts = this.mockParts.reduce((counts, part) => {
      counts[part.category] = (counts[part.category] || 0) + 1;
      return counts;
    }, {} as Record<PartCategory, number>);

    const topUsedParts = [...this.mockParts]
      .sort((a, b) => b.totalUsageThisMonth - a.totalUsageThisMonth)
      .slice(0, 5);

    const recentMovements = [...this.mockStockMovements]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    const stats: InventoryStats = {
      totalParts,
      totalValue,
      lowStockCount,
      outOfStockCount,
      pendingOrdersCount: 0, // TODO: implement orders
      categoryCounts,
      topUsedParts,
      recentMovements
    };

    return of(stats);
  }

  // Utility methods
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
    this.mockAlerts = this.mockAlerts.filter(alert => alert.partId !== partId);

    // Create new alert if needed
    if (newStockLevel === 0) {
      this.mockAlerts.push({
        id: Date.now().toString(),
        partId,
        type: 'out-of-stock',
        message: `${part.name} is out of stock`,
        severity: 'critical',
        isRead: false,
        createdAt: new Date()
      });
    } else if (newStockLevel <= part.minStockLevel) {
      this.mockAlerts.push({
        id: Date.now().toString(),
        partId,
        type: 'low-stock',
        message: `${part.name} stock is low (${newStockLevel} remaining)`,
        severity: 'warning',
        isRead: false,
        createdAt: new Date()
      });
    }

    this.alertsSubject.next([...this.mockAlerts]);
  }
}