/**
 * Maps a (route, params) pair to a {type, id} hint when the frontend hasn't
 * called `setSelectedEntity()` explicitly. The orchestrator surfaces the hint
 * in the system prompt so the LLM resolves "this customer / this invoice / ..."
 * without having to extract a UUID from the route URL itself.
 *
 * Order matters: more specific patterns first (e.g. /customers/:id/edit before
 * /customers/:id) so an "edit" page still maps to the right entity type.
 */
const ROUTE_ENTITY_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /^\/customers\/[^/]+\/edit/, type: 'customer' },
  { pattern: /^\/customers\/[^/]+/, type: 'customer' },
  { pattern: /^\/cars\/[^/]+/, type: 'car' },
  { pattern: /^\/invoices\/edit\/[^/]+/, type: 'invoice' },
  { pattern: /^\/invoices\/[a-f0-9-]{36}/, type: 'invoice' },
  { pattern: /^\/quotes\/edit\/[^/]+/, type: 'quote' },
  { pattern: /^\/quotes\/[a-f0-9-]{36}/, type: 'quote' },
  { pattern: /^\/credit-notes\/[^/]+/, type: 'credit_note' },
  { pattern: /^\/maintenance\/(?:details|edit)\/[^/]+/, type: 'maintenance' },
  { pattern: /^\/employees\/(?:details|edit)\/[^/]+/, type: 'employee' },
  { pattern: /^\/appointments\/[^/]+/, type: 'appointment' },
];

export interface DerivedSelectedEntity {
  type: string;
  id: string;
  displayName?: string;
}

export function deriveSelectedEntityFromRoute(
  route: string | undefined,
  params: Record<string, string> | undefined,
): DerivedSelectedEntity | null {
  if (!route || !params) return null;
  const id = params['id'];
  if (!id || id.length === 0) return null;
  for (const { pattern, type } of ROUTE_ENTITY_PATTERNS) {
    if (pattern.test(route)) {
      return { type, id };
    }
  }
  return null;
}
