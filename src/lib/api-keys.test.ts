// @vitest-environment node
// API 키의 핵심 성질: 원문은 DB 에 없고, 폐기하면 즉시 인증에 실패한다.
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { API_KEY_PREFIX, createApiKey, findUserIdByApiKey, listApiKeys, revokeApiKey, touchApiKey } from "./api-keys";
import { createUser } from "./users";

let userId: number;
let otherUserId: number;

beforeAll(() => {
  userId = createUser("키주인", "keys-owner@test.local", "hash").id;
  otherUserId = createUser("남", "keys-other@test.local", "hash").id;
});

describe("createApiKey", () => {
  it("sk_ 로 시작하는 키를 돌려주고, DB 에는 원문이 저장되지 않는다", () => {
    const { key, apiKey } = createApiKey(userId, "테스트 키");

    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(key.length).toBeGreaterThan(60); // sk_ + 32바이트 hex
    expect(apiKey.prefix).toBe(key.slice(0, API_KEY_PREFIX.length + 8));

    // 어떤 컬럼에도 원문이 없어야 한다
    const row = db.prepare("SELECT * FROM api_keys WHERE id = ?").get(apiKey.id) as Record<string, unknown>;
    expect(Object.values(row)).not.toContain(key);
    expect(row.key_hash).not.toBe(key);
  });

  it("호출할 때마다 다른 키가 나온다", () => {
    const a = createApiKey(userId, "a").key;
    const b = createApiKey(userId, "b").key;
    expect(a).not.toBe(b);
  });
});

describe("findUserIdByApiKey", () => {
  it("유효한 키면 소유자 id 를 돌려준다", () => {
    const { key } = createApiKey(userId, "조회용");
    expect(findUserIdByApiKey(key)).toBe(userId);
  });

  it("존재하지 않는 키는 null", () => {
    expect(findUserIdByApiKey("sk_deadbeef")).toBeNull();
  });

  it("폐기된 키는 null", () => {
    const { key, apiKey } = createApiKey(userId, "폐기용");
    expect(findUserIdByApiKey(key)).toBe(userId);

    expect(revokeApiKey(userId, apiKey.id)).toBe(true);
    expect(findUserIdByApiKey(key)).toBeNull();
  });
});

describe("revokeApiKey", () => {
  it("남의 키는 폐기할 수 없다", () => {
    const { key, apiKey } = createApiKey(userId, "내 키");

    expect(revokeApiKey(otherUserId, apiKey.id)).toBe(false);
    expect(findUserIdByApiKey(key)).toBe(userId); // 그대로 살아 있다
  });

  it("이미 폐기한 키를 다시 폐기하면 false", () => {
    const { apiKey } = createApiKey(userId, "두 번 폐기");
    expect(revokeApiKey(userId, apiKey.id)).toBe(true);
    expect(revokeApiKey(userId, apiKey.id)).toBe(false);
  });

  it("폐기해도 행은 남아 이력이 유지된다", () => {
    const { apiKey } = createApiKey(userId, "이력 확인");
    revokeApiKey(userId, apiKey.id);

    const found = listApiKeys(userId).find((k) => k.id === apiKey.id);
    expect(found?.revokedAt).not.toBeNull();
  });
});

describe("touchApiKey", () => {
  it("마지막 사용 시각을 기록한다", () => {
    const { key, apiKey } = createApiKey(userId, "사용 기록");
    expect(listApiKeys(userId).find((k) => k.id === apiKey.id)?.lastUsedAt).toBeNull();

    touchApiKey(key);
    expect(listApiKeys(userId).find((k) => k.id === apiKey.id)?.lastUsedAt).not.toBeNull();
  });
});

describe("listApiKeys", () => {
  it("본인 키만 나온다", () => {
    createApiKey(otherUserId, "남의 키");
    const names = listApiKeys(otherUserId).map((k) => k.name);
    expect(names).toEqual(["남의 키"]);
  });
});
