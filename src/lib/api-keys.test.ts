// @vitest-environment node
// API 키의 핵심 성질: 원문은 DB 에 없고, 폐기하면 즉시 인증에 실패한다.
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { API_KEY_PREFIX, createApiKey, findUserIdByApiKey, listApiKeys, revokeApiKey, touchApiKey } from "./api-keys";
import { createUser } from "./users";

let userId: number;
let otherUserId: number;

beforeAll(async () => {
  userId = (await createUser("키주인", "keys-owner@test.local", "hash")).id;
  otherUserId = (await createUser("남", "keys-other@test.local", "hash")).id;
});

describe("createApiKey", () => {
  it("sk_ 로 시작하는 키를 돌려주고, DB 에는 원문이 저장되지 않는다", async () => {
    const { key, apiKey } = await createApiKey(userId, "테스트 키");

    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(key.length).toBeGreaterThan(60); // sk_ + 32바이트 hex
    expect(apiKey.prefix).toBe(key.slice(0, API_KEY_PREFIX.length + 8));

    // 어떤 컬럼에도 원문이 없어야 한다
    const row = (await prisma.apiKey.findUnique({ where: { id: apiKey.id } })) as unknown as Record<string, unknown>;
    expect(Object.values(row)).not.toContain(key);
    expect(row.keyHash).not.toBe(key);
  });

  it("호출할 때마다 다른 키가 나온다", async () => {
    const a = (await createApiKey(userId, "a")).key;
    const b = (await createApiKey(userId, "b")).key;
    expect(a).not.toBe(b);
  });
});

describe("findUserIdByApiKey", () => {
  it("유효한 키면 소유자 id 를 돌려준다", async () => {
    const { key } = await createApiKey(userId, "조회용");
    expect(await findUserIdByApiKey(key)).toBe(userId);
  });

  it("존재하지 않는 키는 null", async () => {
    expect(await findUserIdByApiKey("sk_deadbeef")).toBeNull();
  });

  it("폐기된 키는 null", async () => {
    const { key, apiKey } = await createApiKey(userId, "폐기용");
    expect(await findUserIdByApiKey(key)).toBe(userId);

    expect(await revokeApiKey(userId, apiKey.id)).toBe(true);
    expect(await findUserIdByApiKey(key)).toBeNull();
  });
});

describe("revokeApiKey", () => {
  it("남의 키는 폐기할 수 없다", async () => {
    const { key, apiKey } = await createApiKey(userId, "내 키");

    expect(await revokeApiKey(otherUserId, apiKey.id)).toBe(false);
    expect(await findUserIdByApiKey(key)).toBe(userId); // 그대로 살아 있다
  });

  it("이미 폐기한 키를 다시 폐기하면 false", async () => {
    const { apiKey } = await createApiKey(userId, "두 번 폐기");
    expect(await revokeApiKey(userId, apiKey.id)).toBe(true);
    expect(await revokeApiKey(userId, apiKey.id)).toBe(false);
  });

  it("폐기해도 행은 남아 이력이 유지된다", async () => {
    const { apiKey } = await createApiKey(userId, "이력 확인");
    await revokeApiKey(userId, apiKey.id);

    const found = (await listApiKeys(userId)).find((k) => k.id === apiKey.id);
    expect(found?.revokedAt).not.toBeNull();
  });
});

describe("touchApiKey", () => {
  it("마지막 사용 시각을 기록한다", async () => {
    const { key, apiKey } = await createApiKey(userId, "사용 기록");
    expect((await listApiKeys(userId)).find((k) => k.id === apiKey.id)?.lastUsedAt).toBeNull();

    await touchApiKey(key);
    expect((await listApiKeys(userId)).find((k) => k.id === apiKey.id)?.lastUsedAt).not.toBeNull();
  });
});

describe("listApiKeys", () => {
  it("본인 키만 나온다", async () => {
    await createApiKey(otherUserId, "남의 키");
    const names = (await listApiKeys(otherUserId)).map((k) => k.name);
    expect(names).toEqual(["남의 키"]);
  });
});
