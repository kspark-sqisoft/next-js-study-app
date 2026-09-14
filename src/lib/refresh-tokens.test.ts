// @vitest-environment node
// 리프레시 토큰의 세 가지 성질: 서버에는 해시만 있다 / 한 번 쓰면 소비된다(회전) / 소비된 토큰을 다시 쓰면 가족 전체가 죽는다(재사용 감지).
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  REFRESH_TOKEN_PREFIX,
  REFRESH_TOKEN_TTL_SECONDS,
  hashRefreshToken,
  issueRefreshToken,
  revokeRefreshTokenFamily,
  rotateRefreshToken,
} from "./refresh-tokens";
import { createUser } from "./users";

let userId: number;

beforeAll(() => {
  userId = createUser("토큰주인", "refresh-owner@test.local", "hash").id;
});

/** 테스트용: 특정 토큰의 만료 시각을 과거로 돌린다 (30일을 기다릴 수는 없으므로). */
function expire(token: string) {
  db.prepare("UPDATE refresh_tokens SET expires_at = '2000-01-01 00:00:00' WHERE token_hash = ?").run(hashRefreshToken(token));
}

function rowOf(token: string) {
  return db.prepare("SELECT * FROM refresh_tokens WHERE token_hash = ?").get(hashRefreshToken(token)) as
    | Record<string, unknown>
    | undefined;
}

describe("issueRefreshToken", () => {
  it("rt_ 로 시작하는 토큰을 돌려주고, DB 에는 해시만 저장된다", () => {
    const { token, familyId, expiresAt } = issueRefreshToken(userId);

    expect(token.startsWith(REFRESH_TOKEN_PREFIX)).toBe(true);
    expect(token.length).toBeGreaterThan(60); // rt_ + 32바이트 hex
    expect(familyId).toMatch(/^[0-9a-f-]{36}$/); // UUID

    const row = rowOf(token)!;
    expect(Object.values(row)).not.toContain(token);
    expect(row.token_hash).toBe(hashRefreshToken(token));
    expect(row.used_at).toBeNull();
    expect(row.revoked_at).toBeNull();

    // 만료 = 지금 + 30일 (초 단위 반올림 오차 허용)
    const expected = Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000;
    expect(Math.abs(expiresAt.getTime() - expected)).toBeLessThan(5_000);
  });

  it("로그인할 때마다 다른 가족이 만들어진다", () => {
    const a = issueRefreshToken(userId);
    const b = issueRefreshToken(userId);
    expect(a.token).not.toBe(b.token);
    expect(a.familyId).not.toBe(b.familyId);
  });
});

describe("rotateRefreshToken (회전)", () => {
  it("유효한 토큰이면 같은 가족의 새 토큰을 주고, 옛 토큰은 소비된다", () => {
    const first = issueRefreshToken(userId);

    const result = rotateRefreshToken(first.token);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.userId).toBe(userId);
    expect(result.next.token).not.toBe(first.token);
    expect(result.next.familyId).toBe(first.familyId); // 가족은 이어진다
    expect(result.next.expiresAt.getTime()).toBe(first.expiresAt.getTime()); // 만료도 물려받는다 (절대 수명)

    expect(rowOf(first.token)!.used_at).not.toBeNull(); // 소비됨
    expect(rowOf(result.next.token)!.used_at).toBeNull(); // 새 토큰은 아직 안 씀
  });

  it("여러 번 회전해도 가족과 만료 시각이 유지된다", () => {
    let current = issueRefreshToken(userId);
    for (let i = 0; i < 3; i++) {
      const r = rotateRefreshToken(current.token);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.next.familyId).toBe(current.familyId);
      expect(r.next.expiresAt.getTime()).toBe(current.expiresAt.getTime());
      current = r.next;
    }
  });

  it("없는 토큰은 invalid", () => {
    expect(rotateRefreshToken("rt_deadbeef")).toEqual({ ok: false, reason: "invalid" });
  });

  it("만료된 토큰은 expired", () => {
    const { token } = issueRefreshToken(userId);
    expire(token);
    expect(rotateRefreshToken(token)).toEqual({ ok: false, reason: "expired" });
  });
});

describe("재사용 감지", () => {
  it("소비된 토큰을 다시 쓰면 reused 이고, 가족의 모든 토큰(새 토큰 포함)이 폐기된다", () => {
    const first = issueRefreshToken(userId);
    const rotated = rotateRefreshToken(first.token);
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;
    const second = rotated.next;

    // 정상 사용자(또는 공격자)가 새 토큰을 받은 뒤, 누군가 옛 토큰을 다시 보낸다
    expect(rotateRefreshToken(first.token)).toEqual({ ok: false, reason: "reused" });

    // 가족 전체 폐기: 아직 쓰지 않은 두 번째 토큰도 죽는다
    expect(rowOf(first.token)!.revoked_at).not.toBeNull();
    expect(rowOf(second.token)!.revoked_at).not.toBeNull();
    expect(rotateRefreshToken(second.token)).toEqual({ ok: false, reason: "revoked" });
  });

  it("만료된 토큰이라도 소비된 것을 다시 쓰면 reused 로 잡는다 (만료 검사보다 재사용 검사가 먼저)", () => {
    const first = issueRefreshToken(userId);
    const rotated = rotateRefreshToken(first.token);
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;

    expire(first.token);
    expect(rotateRefreshToken(first.token)).toEqual({ ok: false, reason: "reused" });
    expect(rowOf(rotated.next.token)!.revoked_at).not.toBeNull();
  });

  it("다른 가족에는 영향이 없다", () => {
    const mine = issueRefreshToken(userId);
    const other = issueRefreshToken(userId); // 다른 기기에서 따로 로그인한 상황

    const rotated = rotateRefreshToken(mine.token);
    expect(rotated.ok).toBe(true);
    rotateRefreshToken(mine.token); // 재사용 → mine 가족 폐기

    expect(rotateRefreshToken(other.token).ok).toBe(true); // other 가족은 멀쩡하다
  });
});

describe("revokeRefreshTokenFamily (로그아웃)", () => {
  it("가족 전체를 폐기하고 true 를 돌려준다", () => {
    const first = issueRefreshToken(userId);
    const rotated = rotateRefreshToken(first.token);
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;

    expect(revokeRefreshTokenFamily(rotated.next.token)).toBe(true);
    expect(rotateRefreshToken(rotated.next.token)).toEqual({ ok: false, reason: "revoked" });
  });

  it("이미 소비된 옛 토큰으로도 가족을 폐기할 수 있다", () => {
    const first = issueRefreshToken(userId);
    const rotated = rotateRefreshToken(first.token);
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;

    expect(revokeRefreshTokenFamily(first.token)).toBe(true);
    expect(rotateRefreshToken(rotated.next.token)).toEqual({ ok: false, reason: "revoked" });
  });

  it("없는 토큰이면 false (라우트는 그래도 204 를 준다)", () => {
    expect(revokeRefreshTokenFamily("rt_nothing")).toBe(false);
  });

  it("폐기해도 행은 남아 이력이 유지된다", () => {
    const { token } = issueRefreshToken(userId);
    revokeRefreshTokenFamily(token);
    expect(rowOf(token)).toBeDefined();
    expect(rowOf(token)!.revoked_at).not.toBeNull();
  });
});

describe("만료 행 정리", () => {
  it("로그인(발급) 시 만료된 행은 지워진다", () => {
    const { token } = issueRefreshToken(userId);
    expire(token);
    expect(rowOf(token)).toBeDefined();

    issueRefreshToken(userId); // 발급 때 pruneExpired() 가 돈다
    expect(rowOf(token)).toBeUndefined();
  });
});
