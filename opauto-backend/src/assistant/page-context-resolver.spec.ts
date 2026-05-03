import { deriveSelectedEntityFromRoute } from './page-context-resolver';

/**
 * Regression coverage for UI Bug 4: pageContext.params.id was sent by the
 * frontend on every detail page but the backend never derived a
 * selectedEntity hint from it, so "tell me about this customer" turned into
 * "the customer with the given ID could not be found".
 */
describe('deriveSelectedEntityFromRoute', () => {
  const fakeId = 'f3bf06a3-6e1e-45e5-83f0-e4af2e6dcba3';

  it('returns null when route or params are missing', () => {
    expect(deriveSelectedEntityFromRoute(undefined, { id: fakeId })).toBeNull();
    expect(deriveSelectedEntityFromRoute('/customers/abc', undefined)).toBeNull();
    expect(deriveSelectedEntityFromRoute('/customers/abc', {})).toBeNull();
  });

  it('returns null for routes without an id-shaped path segment we recognise', () => {
    expect(deriveSelectedEntityFromRoute('/dashboard', { id: fakeId })).toBeNull();
    expect(deriveSelectedEntityFromRoute('/invoices/list', { id: fakeId })).toBeNull();
    expect(deriveSelectedEntityFromRoute('/settings', { id: fakeId })).toBeNull();
  });

  it.each([
    ['/customers/' + fakeId, 'customer'],
    ['/customers/' + fakeId + '/edit', 'customer'],
    ['/cars/' + fakeId, 'car'],
    ['/quotes/' + fakeId, 'quote'],
    ['/quotes/edit/' + fakeId, 'quote'],
    ['/invoices/' + fakeId, 'invoice'],
    ['/invoices/edit/' + fakeId, 'invoice'],
    ['/credit-notes/' + fakeId, 'credit_note'],
    ['/maintenance/details/' + fakeId, 'maintenance'],
    ['/maintenance/edit/' + fakeId, 'maintenance'],
    ['/employees/details/' + fakeId, 'employee'],
    ['/employees/edit/' + fakeId, 'employee'],
    ['/appointments/' + fakeId, 'appointment'],
  ])('maps %s -> %s', (route, expectedType) => {
    expect(deriveSelectedEntityFromRoute(route, { id: fakeId })).toEqual({
      type: expectedType,
      id: fakeId,
    });
  });

  it('does not confuse the /invoices/list collection page for a detail page', () => {
    expect(
      deriveSelectedEntityFromRoute('/invoices/list', { id: 'list' }),
    ).toBeNull();
  });

  it('returns null when params.id is present but the route is collection-only', () => {
    // `/invoices` (without id) has no id segment in its route — params should
    // be a leftover from a previous navigation. Don't fabricate a hint.
    expect(deriveSelectedEntityFromRoute('/invoices', { id: fakeId })).toBeNull();
  });
});
