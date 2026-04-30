/**
 * Service catalog — per-garage list of named services with default
 * pricing + TVA + labor hours. Backed by the `service_catalog` table
 * via `/api/service-catalog`.
 *
 * Used as an autocomplete source on quote/invoice forms (Phase 5
 * wires the picker into the live forms).
 */
export interface ServiceCatalogEntry {
  id: string;
  garageId: string;
  code: string;
  name: string;
  description?: string | null;
  category?: string | null;
  defaultPrice: number;
  defaultLaborHours?: number | null;
  defaultTvaRate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceCatalogRequest {
  code: string;
  name: string;
  description?: string;
  category?: string;
  defaultPrice: number;
  defaultLaborHours?: number;
  defaultTvaRate?: number;
  isActive?: boolean;
}

export type UpdateServiceCatalogRequest = Partial<CreateServiceCatalogRequest>;
