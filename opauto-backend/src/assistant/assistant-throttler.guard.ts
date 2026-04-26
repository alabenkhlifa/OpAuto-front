import { ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// `ThrottlerLimitDetail` is not re-exported from the package barrel in v5;
// we shape-match the only field we use. Adopted from `dist/throttler.guard.interface.d.ts`.
interface ThrottlerLimitDetail {
  totalHits: number;
  timeToExpire: number;
  ttl: number;
  limit: number;
  key: string;
  tracker: string;
}

/**
 * Global throttler guard returning a structured 429 body.
 *
 * The stock `ThrottlerException` ships only a string message; we need
 * `{ message, retryAfter }` so the chat client can surface a friendly toast
 * and back off. `timeToExpire` is already in seconds, so it maps 1:1 onto
 * `retryAfter`. The `Retry-After` HTTP header is still set by the parent
 * guard via `handleRequest` — this only customises the JSON body.
 */
@Injectable()
export class AssistantThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new HttpException(
      {
        message: 'Too many requests, please slow down.',
        retryAfter: detail.timeToExpire,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
