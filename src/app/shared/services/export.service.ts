import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ReportExportOptions, ReportFilters } from '../../core/models/report.model';

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  exportReport(options: ReportExportOptions): Observable<boolean> {
    switch (options.format) {
      case 'pdf':
        return this.exportToPdf(options);
      case 'excel':
        return this.exportToExcel(options);
      case 'csv':
        return this.exportToCsv(options);
      case 'png':
      case 'jpg':
        return this.exportToImage(options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  private exportToPdf(options: ReportExportOptions): Observable<boolean> {
    // Create PDF content
    const content = this.generateReportContent(options);
    
    // Create blob and download
    const blob = new Blob([content], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `garage-report-${this.formatDateForFilename(options.dateRange.startDate)}-to-${this.formatDateForFilename(options.dateRange.endDate)}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
    
    return of(true);
  }

  private exportToExcel(options: ReportExportOptions): Observable<boolean> {
    // Generate Excel data
    const data = this.generateExcelData(options);
    
    // Create workbook and download
    const csv = this.convertToCSV(data);
    const blob = new Blob([csv], { type: 'application/vnd.ms-excel' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `garage-report-${this.formatDateForFilename(options.dateRange.startDate)}-to-${this.formatDateForFilename(options.dateRange.endDate)}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
    
    return of(true);
  }

  private exportToCsv(options: ReportExportOptions): Observable<boolean> {
    const data = this.generateCSVData(options);
    const csv = this.convertToCSV(data);
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `garage-report-${this.formatDateForFilename(options.dateRange.startDate)}-to-${this.formatDateForFilename(options.dateRange.endDate)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    
    return of(true);
  }

  private exportToImage(options: ReportExportOptions): Observable<boolean> {
    // Capture current charts as image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Set canvas size
      canvas.width = 1200;
      canvas.height = 800;
      
      // Fill background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add title
      ctx.fillStyle = '#000000';
      ctx.font = '24px Arial';
      ctx.fillText('Garage Report', 50, 50);
      
      // Add date range
      ctx.font = '16px Arial';
      ctx.fillText(`${options.dateRange.label}`, 50, 80);
      
      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `garage-report-${this.formatDateForFilename(options.dateRange.startDate)}-to-${this.formatDateForFilename(options.dateRange.endDate)}.${options.format}`;
          link.click();
          window.URL.revokeObjectURL(url);
        }
      }, `image/${options.format}`);
    }
    
    return of(true);
  }

  printReport(): void {
    // Add print styles
    const printStyles = `
      <style>
        @media print {
          body * { visibility: hidden; }
          .print-section, .print-section * { visibility: visible; }
          .print-section { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .bg-gray-50 { background: white !important; }
          .dark\\:bg-gray-900 { background: white !important; }
        }
      </style>
    `;
    
    const head = document.getElementsByTagName('head')[0];
    const style = document.createElement('style');
    style.innerHTML = printStyles;
    head.appendChild(style);
    
    // Trigger print
    window.print();
    
    // Clean up
    setTimeout(() => {
      head.removeChild(style);
    }, 1000);
  }

  private generateReportContent(options: ReportExportOptions): string {
    let content = `
      Garage Management Report
      Period: ${options.dateRange.label}
      Generated: ${new Date().toLocaleDateString()}
      
      ===============================
    `;

    if (options.reportSections.includes('financial')) {
      content += `
      
      FINANCIAL SUMMARY
      =================
      Total Revenue: [Data would be calculated here]
      Paid Revenue: [Data would be calculated here]
      Pending Revenue: [Data would be calculated here]
      `;
    }

    if (options.reportSections.includes('operational')) {
      content += `
      
      OPERATIONAL SUMMARY
      ===================
      Total Appointments: [Data would be calculated here]
      Completion Rate: [Data would be calculated here]
      Mechanic Utilization: [Data would be calculated here]
      `;
    }

    return content;
  }

  private generateExcelData(options: ReportExportOptions): any[][] {
    const data: any[][] = [
      ['Garage Management Report'],
      ['Period:', options.dateRange.label],
      ['Generated:', new Date().toLocaleDateString()],
      [''],
      ['Section', 'Metric', 'Value']
    ];

    // Add sample data
    data.push(['Financial', 'Total Revenue', '18,500 TND']);
    data.push(['Financial', 'Paid Revenue', '16,200 TND']);
    data.push(['Operational', 'Total Appointments', '45']);
    data.push(['Operational', 'Completion Rate', '92%']);

    return data;
  }

  private generateCSVData(options: ReportExportOptions): any[][] {
    return this.generateExcelData(options);
  }

  private convertToCSV(data: any[][]): string {
    return data.map(row => 
      row.map(cell => 
        typeof cell === 'string' && cell.includes(',') 
          ? `"${cell}"` 
          : cell
      ).join(',')
    ).join('\n');
  }

  private formatDateForFilename(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}