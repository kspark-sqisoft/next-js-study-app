// @vitest-environment node
// 리프레시 토큰의 세 가지 성질: 서버에는 해시만 있다 / 한 번 쓰면 소비된다(회전) / 소비된 토큰을 다시 쓰면 가족 전체가 죽는다(재사용 감지).
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
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

beforeAll(async () => {
  userId = (await createUser("토큰주인", "refresh-owner@test.local", "hash")).id;
});

/** 테스트용: 특정 토큰의 만료 시각을 과거로 돌린다 (30일을 기다릴 수는 없으므로). */
async function expire(token: string) {
  await prisma.refreshToken.updateMany({ where: { tokenHash: hashRefreshToken(token) }, data: { expiresAt: "2000-01-01 00:00:00" } });
}

function rowOf(token: string) {
  return prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(token) } });
}

describe("issueRefreshToken", () => {
  it("rt_ 로 시작하는 토큰을 돌려주고, DB 에는 해시만 저장된다", async () => {
    const { token, familyId, expiresAt } = await issueRefreshToken(userId);

    expect(token.startsWith(REFRESH_TOKEN_PREFIX)).toBe(true);
    expect(token.length).toBeGreaterThan(60); // rt_ + 32바이트 hex
    expect(familyId).toMatch(/^[0-9a-f-]{36}$/); // UUID

    const row = (await rowOf(token))!;
    expect(Object.values(row)).not.toContain(token);
    expect(row.tokenHash).toBe(hashRefreshToken(token));
    expect(row.usedAt).toBeNull();
    expect(row.revokedAt).toBeNull();

    // 만료 = 지금 + 30일 (초 단위 반올림 오차 허용)
    const expected = Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000;
    expect(Math.abs(expiresAt.getTime() - expected)).toBeLessThan(5_000);
  });

  it("로그인할 때마다 다른 가족이 만들어진다", async () => {
    const a = await issueRefreshToken(userId);
    const b = await issueRefreshToken(userId);
    expect(a.token).not.toBe(b.token);
    expect(a.familyId).not.toBe(b.familyId);
  });
});

describe("rotateRefreshToken (회전)", () => {
  it("유효한 토큰이면 같은 가족의 새 토큰을 주고, 옛 토큰은 소비된다", async () => {
    const first = await issueRefreshToken(userId);

    const result = await rotateRefreshToken(first.token);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.userId).toBe(userId);
    expect(result.next.token).not.toBe(first.token);
    expect(result.next.familyId).toBe(first.familyId); // 가족은 이어진다
    expect(result.next.expiresAt.getTime()).toBe(first.expiresAt.getTime()); // 만료도 물려받는다 (절대 수명)

    expect((await rowOf(first.token))!.usedAt).not.toBeNull(); // 소비됨
    expect((await rowOf(result.next.token))!.usedAt).toBeNull(); // 새 토큰은 아직 안 씀
  });

  it("여러 번 회전해도 가족과 만료 시각이 유지된다", async () => {
    let current = await issueRefreshToken(userId);
    for (let i = 0; i < 3; i++) {
      const r = await rotateRefreshToken(current.token);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.next.familyId).toBe(current.familyId);
      expect(r.next.expiresAt.getTime()).toBe(current.expiresAt.getTime());
      current = r.next;
    }
  });

  it("없는 토큰은 invalid", async () => {
    expect(await rotateRefreshToken("rt_deadbeef")).toEqual({ ok: false, reason: "invalid" });
  });

  it("만료된 토큰은 expired", async () => {
    const { token } = await issueRefreshToken(userId);
    await expire(token);
    expect(await rotateRefreshToken(token)).toEqual({ ok: false, reason: "expired" });
  });
});

describe("재사용 감지", () => {
  it("소비된 토큰을 다시 쓰면 reused 이고, 가족의 모든 토큰(새 토큰 포함)이 폐기된다", async () => {
    const first = await issueRefreshToken(userId);
    const rotated = await rotateRefreshToken(first.token);
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;
    const second = rotated.next;

    // 정상 사용자(또는 공격자)가 새 토큰을 받은 뒤, 누군가 옛 토큰을 다시 보낸다
    expect(await rotateRefreshToken(first.token)).toEqual({ ok: false, reason: "reused" });

    // 가족 전체 폐기: 아직 쓰지 않은 두 번째 토큰도 죽는다
    expect((await rowOf(first.token))!.revokedAt).not.toBeNull();
    expect((await rowOf(second.token))!.revokedAt).not.toBeNull();
    expect(await rotateRefreshToken(second.token)).toEqual({ ok: false, reason: "revoked" });
  });

  it("만료된 토큰이라도 소비된 것을 다시 쓰면 reused 로 잡는다 (만료 검사보다 재사용 검사가 먼저)", async () => {
    const first = await issueRefreshToken(userId);
    const rotated = await rotateRefreshToken(first.token);
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;

    await expire(first.token);
    expect(await rotateRefreshToken(first.token)).toEqual({ ok: false, reason: "reused" });
    expect((await rowOf(rotated.next.token))!.revokedAt).not.toBeNull();
  });

  it("다른 가족에는 영향이 없다", async () => {
    const mine = await issueRefreshToken(userId);
    const other = await issueRefreshToken(userId); // 다른 기기에서 따로 로그인한 상황

    const rotated = await rotateRefreshToken(mine.token);
    expect(rotated.ok).toBe(true);
    await rotateRefreshToken(mine.token); // 재사용 → mine 가족 폐기

    expect((await rotateRefreshToken(other.token)).ok).toBe(true); // other 가족은 멀쩡하다
  });
});

describe("revokeRefreshTokenFamily (로그아웃)", () => {
  it("가족 전체를 폐기하고 true 를 돌려준다", async () => {
    const first = await issueRefreshToken(userId);
    const rotated = await rotateRefreshToken(first.token);
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;

    expect(await revokeRefreshTokenFamily(rotated.next.token)).toBe(true);
    expect(await rotateRefreshToken(rotated.next.token)).toEqual({ ok: false, reason: "revoked" });
  });

  it("이미 소비된 옛 토큰으로도 가족을 폐기할 수 있다", async () => {
    const first = await issueRefreshToken(userId);
    const rotated = await rotateRefreshToken(first.token);
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;

    expect(await revokeRefreshTokenFamily(first.token)).toBe(true);
    expect(await rotateRefreshToken(rotated.next.token)).toEqual({ ok: false, reason: "revoked" });
  });

  it("없는 토큰이면 false (라우트는 그래도 204 를 준다)", async () => {
    expect(await revokeRefreshTokenFamily("rt_nothing")).toBe(false);
  });

  it("폐기해도 행은 남아 이력이 유지된다", async () => {
    const { token } = await issueRefreshToken(userId);
    await revokeRefreshTokenFamily(token);
    const row = await rowOf(token);
    expect(row).not.toBeNull();
    expect(row!.revokedAt).not.toBeNull();
  });
});

describe("만료 행 정리", () => {
  it("로그인(발급) 시 만료된 행은 지워진다", async () => {
    const { token } = await issueRefreshToken(userId);
    await expire(token);
    expect(await rowOf(token)).not.toBeNull();

    await issueRefreshToken(userId); // 발급 때 pruneExpired() 가 돈다
    expect(await rowOf(token)).toBeNull();
  });
});
