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
});
