/**
 * 极简内存限流。
 *
 * 局限（README 中如实说明）：状态保存在单个 Node 实例的内存里，
 * 多实例部署时每个实例各算各的。对 MVP 而言足以防止单人刷爆额度；
 * 需要严格限流时应换成 Upstash Ratelimit 或平台级 WAF 规则。
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  max = 12,
  windowSeconds = 60,
  now = Date.now(),
): RateLimitResult {
  const windowMs = windowSeconds * 1000;

  // 顺手清理过期 bucket，避免长期运行后内存无限增长
  if (buckets.size > 5000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: max - existing.count, retryAfterSeconds: 0 };
}

/** 仅用于测试：清空限流状态。 */
export function resetRateLimit(): void {
  buckets.clear();
}

/** 从请求头里取客户端标识。取不到时退回一个固定字符串（仍然受限流保护）。 */
export function clientKeyFrom(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown-client";
}
