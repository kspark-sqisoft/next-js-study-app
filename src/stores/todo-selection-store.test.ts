// @vitest-environment node
// zustand 스토어는 React 없이도 getState()/setState() 로 테스트할 수 있다. 컴포넌트를 렌더링할 필요가 없다.
import { beforeEach, describe, expect, it } from "vitest";
import { useTodoSelection } from "./todo-selection-store";

describe("todo-selection-store", () => {
  beforeEach(() => useTodoSelection.getState().clear()); // 모듈 싱글턴이라 테스트 사이에 초기화

  it("toggle 은 없으면 추가, 있으면 제거", async () => {
    const s = useTodoSelection.getState();
    s.toggle(1);
    s.toggle(2);
    expect(useTodoSelection.getState().selectedIds).toEqual([1, 2]);
    s.toggle(1);
    expect(useTodoSelection.getState().selectedIds).toEqual([2]);
  });

  it("selectAll 은 주어진 목록으로 교체, clear 는 비운다", async () => {
    useTodoSelection.getState().selectAll([3, 4, 5]);
    expect(useTodoSelection.getState().selectedIds).toEqual([3, 4, 5]);
    useTodoSelection.getState().clear();
    expect(useTodoSelection.getState().selectedIds).toEqual([]);
  });

  it("구독자는 상태가 바뀔 때 호출된다", async () => {
    const seen: number[][] = [];
    const unsubscribe = useTodoSelection.subscribe((s) => seen.push(s.selectedIds));
    useTodoSelection.getState().toggle(9);
    unsubscribe();
    useTodoSelection.getState().toggle(10); // 구독 해제 후에는 안 온다
    expect(seen).toEqual([[9]]);
  });
});
