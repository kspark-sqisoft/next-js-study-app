// 디바운스 훅: 함수를 연속으로 호출해도 "마지막 호출 뒤 delay 만큼 조용해졌을 때" 한 번만 실행한다.
// 검색창처럼 키 입력마다 서버 요청을 보내면 안 되는 곳에 쓴다.
//
// 라이브러리(lodash.debounce, use-debounce)를 써도 되지만 원리를 보기 위해 직접 만들었다.
// - 새 호출이 오면 이전 타이머를 취소하고 다시 잰다 → 타이핑 중에는 실행되지 않는다.
// - 언마운트되면 대기 중인 타이머를 취소한다 → 사라진 컴포넌트에서 실행되는 일이 없다.
// - 항상 최신 callback 을 ref 로 들고 있어서, 렌더링마다 새 함수를 넘겨도 타이머가 리셋되지 않는다.
"use client";

import { useCallback, useEffect, useRef } from "react";

export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay: number,
) {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 렌더링마다 최신 callback 을 기억한다 (클로저에 옛 state 가 갇히는 문제 방지)
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const debounced = useCallback(
    (...args: Args) => {
      cancel(); // 이전 예약 취소
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        callbackRef.current(...args);
      }, delay);
    },
    [delay, cancel],
  );

  useEffect(() => cancel, [cancel]); // 언마운트 시 대기 중인 실행 취소

  return { debounced, cancel };
}
