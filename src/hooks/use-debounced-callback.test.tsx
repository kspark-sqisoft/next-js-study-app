// 훅 테스트: renderHook + 가짜 타이머. 실제로 400ms 를 기다리지 않고 시계를 앞으로 돌린다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDebouncedCallback } from "./use-debounced-callback";

describe("useDebouncedCallback", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("연속 호출하면 마지막 호출만 delay 뒤에 한 번 실행된다", async () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 400));

    act(() => {
      result.current.debounced("스");
      result.current.debounced("스트");
      result.current.debounced("스트리밍");
    });
    expect(fn).not.toHaveBeenCalled(); // 아직 타이핑 중

    act(() => vi.advanceTimersByTime(399));
    expect(fn).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("스트리밍");
  });

  it("cancel 하면 실행되지 않는다", async () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 400));
    act(() => {
      result.current.debounced("x");
      result.current.cancel();
      vi.advanceTimersByTime(1000);
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it("언마운트되면 대기 중인 실행이 취소된다", async () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(fn, 400));
    act(() => result.current.debounced("x"));
    unmount();
    act(() => vi.advanceTimersByTime(1000));
    expect(fn).not.toHaveBeenCalled();
  });

  it("렌더링마다 새 callback 을 넘겨도 최신 것이 실행된다", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ cb }) => useDebouncedCallback(cb, 400), { initialProps: { cb: first } });
    act(() => result.current.debounced("x"));
    rerender({ cb: second }); // 타이머가 도는 중에 callback 교체
    act(() => vi.advanceTimersByTime(400));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("x");
  });
});
