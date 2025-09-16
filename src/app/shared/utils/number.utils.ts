/**
 * Number formatting utilities for Tunisia
 * Ensures Western numerals are used regardless of language setting
 */

export class NumberUtils {
  /**
   * Format numbers using Western numerals for Tunisia
   */
  static formatNumber(num: number): string {
    // Always use en-US for Western numerals regardless of language
    return new Intl.NumberFormat('en-US').format(num);
  }

  /**
   * Format currency using Tunisian locale with Western numerals
   */
  static formatCurrency(amount: number, currency: string = 'TND'): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Format percentage using Western numerals
   */
  static formatPercentage(value: number, minimumFractionDigits: number = 1): string {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: minimumFractionDigits,
      maximumFractionDigits: minimumFractionDigits
    }).format(value / 100);
  }

  /**
   * Format mileage with Western numerals
   */
  static formatMileage(mileage: number): string {
    return new Intl.NumberFormat('en-US').format(mileage) + ' km';
  }
}