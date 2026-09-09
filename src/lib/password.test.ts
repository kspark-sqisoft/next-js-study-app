// @vitest-environment node
// 단위 테스트: 외부 의존성이 없는 순수 함수. 가장 쓰기 쉽고 빠르다.
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("해시는 'salt:hash' 형태이고 원문을 포함하지 않는다", async () => {
    const hash = await hashPassword("password123");
    expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(hash).not.toContain("password123");
  });

  it("같은 비밀번호라도 salt 가 달라 해시가 매번 다르다", async () => {
    const a = await hashPassword("password123");
    const b = await hashPassword("password123");
    expect(a).not.toBe(b);
  });

  it("맞는 비밀번호는 통과, 틀린 비밀번호는 실패", async () => {
    const hash = await hashPassword("password123");
    expect(await verifyPassword("password123", hash)).toBe(true);
    expect(await verifyPassword("password124", hash)).toBe(false);
  });

  it("형식이 깨진 저장값은 실패로 처리한다 (예외를 던지지 않음)", async () => {
    expect(await verifyPassword("x", "not-a-valid-hash")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });
});
