import { Injectable, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AssistantPageContext } from '../../../core/models/assistant.model';

/**
 * Tracks the user's current page context so the orchestrator can
 * disambiguate "this customer", "this invoice", etc.
 *
 * Listens to `Router.events` (NavigationEnd) and exposes a signal with
 * the current route + params. Feature pages may call
 * `setSelectedEntity(...)` to attach a richer "what the user is looking at"
 * hint; that hint is automatically cleared on the next navigation.
 */
@Injectable({ providedIn: 'root' })
export class AssistantContextService {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);

  readonly pageContext = signal<AssistantPageContext>({
    route: this.router.url || '/',
    params: {},
  });

  readonly currentRoute = computed(() => this.pageContext().route ?? '/');

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(event => {
        const params = this.collectParams(this.activatedRoute);
        // Clear selectedEntity on navigation; pages opt back in via setSelectedEntity.
        this.pageContext.set({
          route: event.urlAfterRedirects,
          params,
        });
      });
  }

  /**
   * Page-level hint: declare the entity the user is currently viewing.
   * Cleared automatically on next navigation.
   */
  setSelectedEntity(type: string, id: string, displayName?: string): void {
    this.pageContext.update(ctx => ({
      ...ctx,
      selectedEntity: { type, id, displayName },
    }));
  }

  clearSelectedEntity(): void {
    this.pageContext.update(ctx => {
      const { selectedEntity, ...rest } = ctx;
      return { ...rest };
    });
  }

  /** Read the current page context (for sending with chat requests). */
  current(): AssistantPageContext {
    return this.pageContext();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  private collectParams(route: ActivatedRoute): Record<string, string> {
    const params: Record<string, string> = {};
    let cursor: ActivatedRoute | null = route.root;
    while (cursor) {
      const snap = cursor.snapshot;
      if (snap?.params) {
        for (const k of Object.keys(snap.params)) {
          const v = snap.params[k];
          if (v != null) params[k] = String(v);
        }
      }
      cursor = cursor.firstChild;
    }
    return params;
  }
}
