// @vitest-environment node
// (jose 는 Web Crypto 를 쓰는데, jsdom 환경의 Uint8Array 는 Node 의 것과 다른 객체라 서명이 실패한다.
//  DOM 이 필요 없는 테스트는 이렇게 파일 단위로 node 환경을 지정한다.)
// 세션 테스트. next/headers 의 cookies() 는 실제 요청이 있어야 동작하므로 vi.mock 으로 가짜를 만든다.
// "Next.js 런타임에 묶인 모듈을 어떻게 단위 테스트하는가" 의 예.
import { beforeEach, describe, expect, it, vi } from "vitest";

// 메모리 안의 쿠키 저장소. 실제 cookies() 와 같은 모양(get/set/delete)만 흉내 낸다.
const store = new Map<string, { value: string; options?: Record<string, unknown> }>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => store.get(name),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      store.set(name, { value, options });
    },
    delete: (name: string) => store.delete(name),
  }),
}));

// vi.mock 은 호이스팅되므로, 테스트 대상은 그 뒤에 import 해도 mock 이 적용된다
const { createSession, decrypt, deleteSession, getSessionUserId } = await import("./session");

describe("session", () => {
  beforeEach(() => store.clear());

  it("createSession 은 httpOnly 쿠키를 만들고, getSessionUserId 로 다시 읽을 수 있다", async () => {
    await createSession(42);
    const cookie = store.get("session");
    expect(cookie).toBeDefined();
    expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(await getSessionUserId()).toBe(42);
  });

  it("쿠키가 없으면 null", async () => {
    expect(await getSessionUserId()).toBeNull();
  });

  it("변조된 토큰은 검증에 실패한다", async () => {
    await createSession(1);
    const token = store.get("session")!.value;
    // 페이로드 부분(가운데)을 건드리면 서명이 맞지 않는다
    const [h, p, s] = token.split(".");
    const tampered = `${h}.${p.slice(0, -2)}xx.${s}`;
    expect(await decrypt(tampered)).toBeNull();
    expect(await decrypt("garbage")).toBeNull();
    expect(await decrypt(undefined)).toBeNull();
  });

  it("deleteSession 이후에는 로그아웃 상태", async () => {
    await createSession(7);
    await deleteSession();
    expect(await getSessionUserId()).toBeNull();
  });
});
