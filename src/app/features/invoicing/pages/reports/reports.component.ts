import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ArAgingComponent } from '../../components/ar-aging.component';
import { ZReportComponent } from '../../components/z-report.component';

/**
 * Invoicing reports landing page — embeds the existing AR aging
 * and Z-report components and exposes the accountant CSV export
 * download links.
 */
@Component({
  selector: 'app-invoicing-reports-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslatePipe,
    ArAgingComponent,
    ZReportComponent,
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.css',
})
export class InvoicingReportsPageComponent {
  /** YYYY-MM in ISO order — used for the accountant export download. */
  readonly currentMonth = new Date().toISOString().slice(0, 7);

  exportUrl(): string {
    return `/reports/accountant-export?month=${this.currentMonth}`;
  }
}
