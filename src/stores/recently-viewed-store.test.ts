// persist 스토어 테스트. jsdom 환경이라 localStorage 가 있다 (기본 환경).
import { beforeEach, describe, expect, it } from "vitest";
import { pushRecent, RECENT_MAX, useRecentlyViewed } from "./recently-viewed-store";

describe("pushRecent (순수 함수)", () => {
  it("맨 앞에 넣고 같은 id 는 제거하며 최대 개수를 지킨다", () => {
    const list = [{ id: 1, title: "a" }, { id: 2, title: "b" }];
    expect(pushRecent(list, { id: 2, title: "b2" })).toEqual([{ id: 2, title: "b2" }, { id: 1, title: "a" }]);
    const many = Array.from({ length: RECENT_MAX }, (_, i) => ({ id: i + 10, title: "x" }));
    expect(pushRecent(many, { id: 99, title: "new" })).toHaveLength(RECENT_MAX);
    expect(pushRecent(many, { id: 99, title: "new" })[0].id).toBe(99);
  });
});

describe("recently-viewed-store (persist)", () => {
  beforeEach(() => {
    localStorage.clear();
    useRecentlyViewed.setState({ entries: [], hydrated: false });
  });

  it("record 하면 localStorage 에 entries 만 저장된다 (partialize)", () => {
    useRecentlyViewed.getState().record({ id: 1, title: "첫 글" });
    const raw = JSON.parse(localStorage.getItem("recently-viewed-posts")!);
    expect(raw.state).toEqual({ entries: [{ id: 1, title: "첫 글" }] }); // hydrated, 함수는 저장 안 됨
  });

  it("skipHydration 이라 자동 복원되지 않고, rehydrate() 를 부르면 복원되며 hydrated 가 true 가 된다", async () => {
    localStorage.setItem(
      "recently-viewed-posts",
      JSON.stringify({ state: { entries: [{ id: 7, title: "저장된 글" }] }, version: 0 }),
    );
    expect(useRecentlyViewed.getState().entries).toEqual([]); // 아직 복원 전
    await useRecentlyViewed.persist.rehydrate();
    expect(useRecentlyViewed.getState().entries).toEqual([{ id: 7, title: "저장된 글" }]);
    expect(useRecentlyViewed.getState().hydrated).toBe(true);
  });
});
