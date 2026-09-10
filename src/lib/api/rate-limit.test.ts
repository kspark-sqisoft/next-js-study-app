// @vitest-environment node
// 레이트 리밋은 시간에 의존하지만, now 를 인자로 받게 만들어 두면 시계를 조작하지 않고 테스트할 수 있다.
import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimits, WINDOW_SECONDS } from "./rate-limit";

beforeEach(() => resetRateLimits());

describe("checkRateLimit", () => {
  it("limit 까지는 허용하고 그 다음부터 막는다", async () => {
    const first = checkRateLimit("ip:1.1.1.1", 3);
    expect(first).toMatchObject({ ok: true, limit: 3, remaining: 2 });

    expect(checkRateLimit("ip:1.1.1.1", 3).remaining).toBe(1);
    expect(checkRateLimit("ip:1.1.1.1", 3).remaining).toBe(0);

    const blocked = checkRateLimit("ip:1.1.1.1", 3);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0); // 음수로 내려가지 않는다
  });

  it("identity 가 다르면 카운터도 따로 센다", async () => {
    checkRateLimit("ip:1.1.1.1", 1);
    expect(checkRateLimit("ip:1.1.1.1", 1).ok).toBe(false);
    expect(checkRateLimit("user:7", 1).ok).toBe(true); // 다른 주체는 영향 없음
  });

  it("창이 지나면 카운터가 초기화된다", async () => {
    const start = Date.now();
    checkRateLimit("ip:2.2.2.2", 1, start);
    expect(checkRateLimit("ip:2.2.2.2", 1, start).ok).toBe(false);

    const afterWindow = start + (WINDOW_SECONDS + 1) * 1000;
    expect(checkRateLimit("ip:2.2.2.2", 1, afterWindow).ok).toBe(true);
  });

  it("resetAt 은 창이 끝나는 시각(초)이다", async () => {
    const now = Date.now();
    const result = checkRateLimit("ip:3.3.3.3", 5, now);
    expect(result.resetAt).toBe(Math.floor(now / 1000) + WINDOW_SECONDS);
  });
});
