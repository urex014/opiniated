export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export type RateLimitStore = {
  consume(key: string, limit: number, windowMs: number, now?: number): Promise<RateLimitResult>;
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let chain: Promise<void> = Promise.resolve();

export const memoryRateLimitStore: RateLimitStore = {
  consume(key, limit, windowMs, now = Date.now()) {
    const run = chain.then(() => take(key, limit, windowMs, now));
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  },
};

export function resetRateLimits(): void {
  buckets.clear();
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  return take(key, limit, windowMs, now).allowed;
}

function take(key: string, limit: number, windowMs: number, now: number): RateLimitResult {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)) };
  }
  const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  if (current.count >= limit) return { allowed: false, retryAfterSeconds };
  current.count += 1;
  return { allowed: true, retryAfterSeconds };
}
