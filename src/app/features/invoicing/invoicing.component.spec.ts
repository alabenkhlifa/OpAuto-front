import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { Subject, of } from 'rxjs';
import { NavigationEnd } from '@angular/router';
import { InvoicingComponent } from './invoicing.component';
import { TranslationService } from '../../core/services/translation.service';

@Component({ standalone: true, template: '' })
class StubPage {}

/**
 * Tests for the Invoicing shell — verifies that the active tab
 * derived from `currentUrl()` matches the route, and that
 * `selectedMobileRoute()` follows along when the URL changes.
 */
describe('InvoicingComponent (shell)', () => {
  let component: InvoicingComponent;
  let fixture: ComponentFixture<InvoicingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvoicingComponent],
      providers: [
        provideRouter([
          { path: 'invoices', component: StubPage, children: [
            { path: '', component: StubPage },
            { path: 'list', component: StubPage },
            { path: 'quotes', component: StubPage },
          ]},
        ]),
        provideLocationMocks(),
        {
          provide: TranslationService,
          useValue: {
            instant: (k: string) => k,
            getCurrentLanguage: () => 'en',
            translations$: of({}),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InvoicingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts with currentUrl reflecting the router URL on init', () => {
    expect(component.currentUrl()).toBeDefined();
  });

  it('marks the dashboard tab active when URL is /invoices (exact)', () => {
    component.currentUrl.set('/invoices');
    const dashboardTab = component.tabs.find((t) => t.id === 'dashboard')!;
    const listTab = component.tabs.find((t) => t.id === 'list')!;
    expect(component.isActive(dashboardTab)).toBeTrue();
    expect(component.isActive(listTab)).toBeFalse();
  });

  it('marks the list tab active when URL starts with /invoices/list', () => {
    component.currentUrl.set('/invoices/list');
    const dashboardTab = component.tabs.find((t) => t.id === 'dashboard')!;
    const listTab = component.tabs.find((t) => t.id === 'list')!;
    expect(component.isActive(dashboardTab)).toBeFalse();
    expect(component.isActive(listTab)).toBeTrue();
  });

  it('treats the dashboard tab as exact-only (does not match /invoices/list)', () => {
    component.currentUrl.set('/invoices/list');
    const dashboardTab = component.tabs.find((t) => t.id === 'dashboard')!;
    expect(component.isActive(dashboardTab)).toBeFalse();
  });

  it('selectedMobileRoute reflects the active tab', () => {
    component.currentUrl.set('/invoices/quotes');
    expect(component.selectedMobileRoute()).toBe('/invoices/quotes');
    component.currentUrl.set('/invoices');
    expect(component.selectedMobileRoute()).toBe('/invoices');
  });

  it('toggleNewDropdown flips the dropdown signal', () => {
    expect(component.newDropdownOpen()).toBeFalse();
    component.toggleNewDropdown();
    expect(component.newDropdownOpen()).toBeTrue();
    component.toggleNewDropdown();
    expect(component.newDropdownOpen()).toBeFalse();
  });

  describe('S-NAV-007 — "+ New → Payment" entry', () => {
    it('exposes 4 create options (Quote / Invoice / Credit Note / Payment)', () => {
      expect(component.createOptions.length).toBe(4);
      const labels = component.createOptions.map((o) => o.labelKey);
      expect(labels).toContain('invoicing.create.menu.newQuote');
      expect(labels).toContain('invoicing.create.menu.newInvoice');
      expect(labels).toContain('invoicing.create.menu.newCreditNote');
      expect(labels).toContain('invoicing.create.menu.newPayment');
    });

    it('Payment option deep-links to /invoices?openPayment=1', () => {
      const opt = component.createOptions.find(
        (o) => o.labelKey === 'invoicing.create.menu.newPayment',
      )!;
      expect(opt.route).toBe('/invoices');
      expect(opt.queryParams).toEqual({ openPayment: '1' });
    });

    it('goToCreateOption forwards queryParams when present', () => {
      const router = TestBed.inject(Router);
      const spy = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
      const opt = component.createOptions.find(
        (o) => o.labelKey === 'invoicing.create.menu.newPayment',
      )!;
      component.goToCreateOption(opt);
      expect(spy).toHaveBeenCalledWith(['/invoices'], {
        queryParams: { openPayment: '1' },
      });
    });

    it('goToCreateOption omits the second arg when no queryParams', () => {
      const router = TestBed.inject(Router);
      const spy = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
      const opt = component.createOptions.find(
        (o) => o.labelKey === 'invoicing.create.menu.newQuote',
      )!;
      component.goToCreateOption(opt);
      expect(spy).toHaveBeenCalledWith(['/invoices/quotes/new'], undefined);
    });
  });

  describe('S-NAV-010 — Settings pill deep-links to fiscal anchor', () => {
    it('settings tab targets /settings with fragment "fiscal"', () => {
      const tab = component.tabs.find((t) => t.id === 'settings')!;
      expect(tab.route).toBe('/settings');
      expect(tab.fragment).toBe('fiscal');
    });

    it('mobile select navigation forwards the fragment', () => {
      const router = TestBed.inject(Router);
      const spy = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
      const event = {
        target: { value: '/settings' } as unknown as HTMLSelectElement,
      } as unknown as Event;
      component.onMobileNavChange(event);
      expect(spy).toHaveBeenCalledWith(['/settings'], { fragment: 'fiscal' });
    });
  });
});
