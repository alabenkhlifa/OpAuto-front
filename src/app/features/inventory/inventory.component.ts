import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PartService } from '../../core/services/part.service';
import { PartWithStock, InventoryAlert, InventoryStats, Supplier, Part } from '../../core/models/part.model';
import { PartModalComponent } from './components/part-modal.component';
import { StockAdjustmentModalComponent } from './components/stock-adjustment-modal.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PartModalComponent, StockAdjustmentModalComponent, TranslatePipe],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.css'
})
export class InventoryComponent implements OnInit {
  public partService = inject(PartService);
  private translationService = inject(TranslationService);

  parts = signal<PartWithStock[]>([]);
  alerts = signal<InventoryAlert[]>([]);
  stats = signal<InventoryStats | null>(null);
  suppliers = signal<Supplier[]>([]);
  isLoading = signal(false);
  
  searchQuery = signal('');
  selectedCategory = signal('all');
  selectedSupplier = signal('all');
  selectedStockStatus = signal('all');
  showMobileFilters = signal(false);
  currentView = signal<'dashboard' | 'parts' | 'suppliers'>('dashboard');
  
  // Modal states
  showPartModal = signal(false);
  showStockAdjustmentModal = signal(false);
  selectedPart = signal<PartWithStock | null>(null);

  filteredParts = computed(() => {
    let filtered = [...this.parts()];
    
    const query = this.searchQuery().toLowerCase();
    if (query) {
      filtered = filtered.filter(part =>
        part.name.toLowerCase().includes(query) ||
        part.partNumber.toLowerCase().includes(query) ||
        part.brand.toLowerCase().includes(query) ||
        part.description?.toLowerCase().includes(query)
      );
    }
    
    if (this.selectedCategory() !== 'all') {
      filtered = filtered.filter(part => part.category === this.selectedCategory());
    }
    
    if (this.selectedSupplier() !== 'all') {
      filtered = filtered.filter(part => part.supplierId === this.selectedSupplier());
    }
    
    if (this.selectedStockStatus() !== 'all') {
      filtered = filtered.filter(part => part.stockStatus === this.selectedStockStatus());
    }
    
    return filtered;
  });

  unreadAlerts = computed(() => this.alerts().filter(alert => !alert.isRead));
  criticalAlerts = computed(() => this.alerts().filter(alert => alert.severity === 'critical'));

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.isLoading.set(true);
    
    this.partService.getParts().subscribe({
      next: (parts) => {
        this.parts.set(parts);
      },
      error: (error) => console.error('Failed to load parts:', error)
    });

    this.partService.getAlerts().subscribe({
      next: (alerts) => {
        this.alerts.set(alerts);
      },
      error: (error) => console.error('Failed to load alerts:', error)
    });

    this.partService.getInventoryStats().subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to load stats:', error);
        this.isLoading.set(false);
      }
    });

    this.partService.getSuppliers().subscribe({
      next: (suppliers) => {
        this.suppliers.set(suppliers);
      },
      error: (error) => console.error('Failed to load suppliers:', error)
    });
  }

  setView(view: 'dashboard' | 'parts' | 'suppliers'): void {
    this.currentView.set(view);
  }

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  onCategoryChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedCategory.set(target.value);
  }

  onSupplierChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedSupplier.set(target.value);
  }

  onStockStatusChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedStockStatus.set(target.value);
  }

  setStockStatusFilter(status: string): void {
    this.selectedStockStatus.set(status);
    this.setView('parts');
  }

  toggleMobileFilters(): void {
    this.showMobileFilters.set(!this.showMobileFilters());
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedCategory.set('all');
    this.selectedSupplier.set('all');
    this.selectedStockStatus.set('all');
  }

  getStockStatusColor(status: string): string {
    return this.partService.getStockStatusColor(status as any);
  }

  getStockStatusBadgeClass(status: string): string {
    return this.partService.getStockStatusBadgeClass(status as any);
  }

  getCategoryIcon(category: string): string {
    return this.partService.getCategoryIcon(category as any);
  }

  getCategoryColor(category: string): string {
    const colors = {
      'engine': 'bg-red-600',
      'transmission': 'bg-purple-600', 
      'brakes': 'bg-orange-600',
      'suspension': 'bg-indigo-600',
      'electrical': 'bg-yellow-600',
      'filters': 'bg-green-600',
      'fluids': 'bg-blue-600',
      'tires': 'bg-gray-600',
      'body': 'bg-pink-600',
      'accessories': 'bg-teal-600',
      'consumables': 'bg-cyan-600'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-600';
  }

  getSupplierName(supplierId: string): string {
    const supplier = this.suppliers().find(s => s.id === supplierId);
    return supplier?.name || 'Unknown Supplier';
  }

  onPartSelect(part: PartWithStock): void {
    this.selectedPart.set(part);
    this.showPartModal.set(true);
  }

  onEditPart(part: PartWithStock): void {
    this.selectedPart.set(part);
    this.showPartModal.set(true);
  }

  onAdjustStock(part: PartWithStock): void {
    this.selectedPart.set(part);
    this.showStockAdjustmentModal.set(true);
  }

  onAddNewPart(): void {
    this.selectedPart.set(null);
    this.showPartModal.set(true);
  }

  onPartModalClose(): void {
    this.showPartModal.set(false);
    this.selectedPart.set(null);
  }

  onPartModalSave(part: Part): void {
    this.loadData(); // Refresh data
  }

  onStockAdjustmentModalClose(): void {
    this.showStockAdjustmentModal.set(false);
    this.selectedPart.set(null);
  }

  onStockAdjustmentApply(adjustment: any): void {
    this.loadData(); // Refresh data
  }

  onMarkAlertRead(alert: InventoryAlert): void {
    this.partService.markAlertAsRead(alert.id).subscribe({
      next: () => {
        const updatedAlerts = this.alerts().map(a => 
          a.id === alert.id ? { ...a, isRead: true } : a
        );
        this.alerts.set(updatedAlerts);
      },
      error: (error) => console.error('Failed to mark alert as read:', error)
    });
  }

  getAlertIcon(type: string): string {
    const icons = {
      'low-stock': 'alert-triangle',
      'out-of-stock': 'x-circle',
      'reorder-point': 'shopping-cart',
      'expired': 'clock',
      'price-change': 'trending-up'
    };
    return icons[type as keyof typeof icons] || 'info';
  }

  getAlertSeverityClass(severity: string): string {
    const classes = {
      'info': 'alert-info',
      'warning': 'alert-warning',
      'critical': 'alert-critical'
    };
    return classes[severity as keyof typeof classes] || classes.info;
  }

  formatCurrency(amount: number, currency: string = 'TND'): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-TN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }

  getStockStatusLabel(status: string): string {
    const statusKeys: {[key: string]: string} = {
      'in-stock': 'inStock',
      'low-stock': 'lowStock',
      'out-of-stock': 'outOfStock',
      'ordered': 'ordered'
    };
    const key = statusKeys[status] || 'inStock';
    return this.translationService.instant(`inventory.stockStatus.${key}`);
  }

  getCategoryLabel(category: string): string {
    const categoryKeys: {[key: string]: string} = {
      'engine': 'engine',
      'transmission': 'transmission',
      'brakes': 'brakes',
      'suspension': 'suspension',
      'electrical': 'electrical',
      'filters': 'filters',
      'fluids': 'fluids',
      'tires': 'tires',
      'body': 'body',
      'accessories': 'accessories',
      'consumables': 'consumables'
    };
    const key = categoryKeys[category] || category;
    return this.translationService.instant(`inventory.categories.${key}`);
  }
}