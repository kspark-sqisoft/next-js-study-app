// zustand + persist 미들웨어: "최근 본 글" 을 localStorage 에 저장하고 여러 컴포넌트가 공유한다.
// - 글 상세의 <RecentlyViewed/> 가 기록하고, 헤더의 <RecentlyViewedBadge/> 가 개수를 보여 준다.
// - 예전 버전은 컴포넌트가 localStorage 를 직접 읽었다. 스토어로 옮기면 저장/불러오기 코드가 한 곳에 모이고
//   어떤 컴포넌트든 같은 값을 본다.
//
// SSR 과 localStorage 의 불일치 문제:
// 서버에는 localStorage 가 없어 서버 HTML 은 "비어 있음" 으로 그려진다. 브라우저가 hydration 하면서 곧바로
// localStorage 값을 쓰면 서버 HTML 과 달라 hydration 불일치 에러가 난다.
// 그래서 skipHydration: true 로 자동 복원을 끄고, 마운트 후(useEffect)에 <StoreHydrator/> 가 rehydrate() 를 호출한다.
// 복원이 끝나면 hydrated 가 true 가 되고, 그때부터 컴포넌트가 실제 값을 그린다.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type RecentEntry = { id: number; title: string };
export const RECENT_MAX = 5;

/** 순수 함수: 맨 앞에 넣고, 같은 id 는 제거하고, 최대 개수를 지킨다. 단위 테스트 대상 */
export function pushRecent(list: RecentEntry[], entry: RecentEntry, max = RECENT_MAX): RecentEntry[] {
  return [entry, ...list.filter((e) => e.id !== entry.id)].slice(0, max);
}

type RecentlyViewedState = {
  entries: RecentEntry[];
  hydrated: boolean; // localStorage 에서 복원이 끝났는가
  record: (entry: RecentEntry) => void;
  clear: () => void;
  setHydrated: () => void;
};

export const useRecentlyViewed = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      entries: [],
      hydrated: false,
      record: (entry) => set((s) => ({ entries: pushRecent(s.entries, entry) })),
      clear: () => set({ entries: [] }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "recently-viewed-posts", // localStorage 키
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ entries: s.entries }), // entries 만 저장 (hydrated, 함수는 제외)
      skipHydration: true, // 자동 복원 끔 → StoreHydrator 가 마운트 후 rehydrate()
      onRehydrateStorage: () => (state) => state?.setHydrated(), // 복원 완료 신호
    },
  ),
);
