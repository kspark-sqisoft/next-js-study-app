// 아주 단순한 고정 윈도(fixed window) 레이트 리밋.
//
// 프로세스 메모리에만 기록하므로 서버가 여러 대면 각자 따로 센다. 실제 서비스에서는
// Redis 나 호스팅 업체가 주는 기능을 쓴다 (Next.js 공식 문서도 "호스트의 기능을 함께 켜라" 고 권한다).
// 여기서는 "공개 API 라면 반드시 상한이 있어야 한다" 는 것과 응답 헤더 규약을 보여주는 게 목적이다.
import "server-only";

/** 창 길이(초). 이 시간이 지나면 카운터가 0 으로 돌아간다. */
export const WINDOW_SECONDS = 60;

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  /** 창이 초기화되는 시각 (Unix epoch 초). X-RateLimit-Reset 헤더로 내려준다. */
  resetAt: number;
};

type Bucket = { count: number; resetAt: number };

// 개발 모드 HMR 로 모듈이 다시 로드돼도 카운터가 날아가지 않도록 globalThis 에 둔다 (db.ts 와 같은 이유).
const globalForRateLimit = globalThis as unknown as { __rateLimitBuckets?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = globalForRateLimit.__rateLimitBuckets ?? new Map();
globalForRateLimit.__rateLimitBuckets = buckets;

/**
 * identity 별로 limit 회까지 허용한다.
 * @param identity 카운터를 나눌 기준. 로그인했으면 "user:3", 아니면 "ip:1.2.3.4"
 */
export function checkRateLimit(identity: string, limit: number, now = Date.now()): RateLimitResult {
  const nowSeconds = Math.floor(now / 1000);
  const existing = buckets.get(identity);

  // 창이 지났거나 처음 보는 identity → 새 창 시작
  if (!existing || existing.resetAt <= nowSeconds) {
    const bucket = { count: 1, resetAt: nowSeconds + WINDOW_SECONDS };
    buckets.set(identity, bucket);
    pruneExpired(nowSeconds);
    return { ok: true, limit, remaining: limit - 1, resetAt: bucket.resetAt };
  }

  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  return { ok: existing.count <= limit, limit, remaining, resetAt: existing.resetAt };
}

/**
 * 만료된 항목 정리. 안 하면 IP 마다 항목이 쌓여 메모리가 계속 늘어난다.
 * 매번 전체를 훑으면 비싸므로 항목이 어느 정도 쌓였을 때만 청소한다.
 */
function pruneExpired(nowSeconds: number): void {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= nowSeconds) buckets.delete(key);
  }
}

/** 테스트용. 창이 살아 있는 동안 상태가 이어지므로 테스트 사이에 비운다. */
export function resetRateLimits(): void {
  buckets.clear();
}
