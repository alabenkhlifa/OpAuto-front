import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { TranslationService } from '../../core/services/translation.service';

interface NavTab {
  id: string;
  labelKey: string;
  route: string;
  exact?: boolean;
}

interface CreateOption {
  labelKey: string;
  route: string;
  iconPath: string;
}

/**
 * Invoicing shell — hosts a sticky sub-nav and a router-outlet for the
 * `/invoices/*` sub-routes (dashboard, list, quotes, credit-notes, …).
 *
 * The shell itself owns no business state — each child page fetches
 * its own data. This component only tracks which tab is active and
 * the open/closed state of the "+ New" dropdown.
 */
@Component({
  selector: 'app-invoicing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslatePipe],
  templateUrl: './invoicing.component.html',
  styleUrl: './invoicing.component.css',
})
export class InvoicingComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  protected translationService = inject(TranslationService);
  private routerSubscription?: Subscription;

  /** Currently active route URL (kept in a signal so templates can react). */
  currentUrl = signal<string>('');
  newDropdownOpen = signal<boolean>(false);

  /** Tabs rendered in the sticky sub-nav (left side). */
  readonly tabs: NavTab[] = [
    { id: 'dashboard', labelKey: 'invoicing.subnav.dashboard', route: '/invoices', exact: true },
    { id: 'quotes', labelKey: 'invoicing.subnav.quotes', route: '/invoices/quotes' },
    { id: 'list', labelKey: 'invoicing.subnav.invoices', route: '/invoices/list' },
    { id: 'creditNotes', labelKey: 'invoicing.subnav.creditNotes', route: '/invoices/credit-notes' },
    { id: 'pending', labelKey: 'invoicing.subnav.pending', route: '/invoices/pending' },
    { id: 'reports', labelKey: 'invoicing.subnav.reports', route: '/invoices/reports' },
    { id: 'settings', labelKey: 'invoicing.subnav.settings', route: '/invoices/settings' },
  ];

  /** "+ New" dropdown items (right side). */
  readonly createOptions: CreateOption[] = [
    {
      labelKey: 'invoicing.create.menu.newQuote',
      route: '/invoices/quotes/new',
      iconPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    },
    {
      labelKey: 'invoicing.create.menu.newInvoice',
      route: '/invoices/create',
      iconPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    },
    {
      labelKey: 'invoicing.create.menu.newCreditNote',
      route: '/invoices/credit-notes/new',
      iconPath: 'M19 14l-7 7m0 0l-7-7m7 7V3',
    },
  ];

  ngOnInit(): void {
    this.currentUrl.set(this.router.url);
    this.routerSubscription = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => {
        const url = (e as NavigationEnd).urlAfterRedirects;
        this.currentUrl.set(url);
        // Close the dropdown on navigation.
        this.newDropdownOpen.set(false);
      });
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  isActive(tab: NavTab): boolean {
    const url = this.currentUrl();
    if (tab.exact) {
      // Match exact `/invoices` (no trailing path segment) — strip query params first.
      const path = url.split('?')[0].replace(/\/$/, '');
      return path === '/invoices';
    }
    return url.startsWith(tab.route);
  }

  toggleNewDropdown(): void {
    this.newDropdownOpen.update((v) => !v);
  }

  closeNewDropdown(): void {
    this.newDropdownOpen.set(false);
  }

  goToCreateOption(opt: CreateOption): void {
    this.closeNewDropdown();
    this.router.navigate([opt.route]);
  }

  /** Mobile select-based nav. */
  onMobileNavChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (!target.value) return;
    this.router.navigate([target.value]);
  }

  /** Floating "+" FAB on mobile opens the new-invoice form directly. */
  onMobileFab(): void {
    this.router.navigate(['/invoices/create']);
  }

  /** Selected tab id for the mobile select binding. */
  selectedMobileRoute = computed<string>(() => {
    const url = this.currentUrl();
    const match = this.tabs.find((t) =>
      t.exact ? url === t.route : url.startsWith(t.route),
    );
    return match?.route ?? '/invoices';
  });
}
