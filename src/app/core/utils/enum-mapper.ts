/** Convert backend enum casing to frontend: 'IN_PROGRESS' → 'in-progress' */
export function fromBackendEnum(val: string | null | undefined): string {
  if (!val) return '';
  return val.toLowerCase().replace(/_/g, '-');
}

/** Convert frontend enum casing to backend: 'in-progress' → 'IN_PROGRESS' */
export function toBackendEnum(val: string | null | undefined): string {
  if (!val) return '';
  return val.toUpperCase().replace(/-/g, '_');
}
