// zustand 스토어: 할 일 목록의 "선택된 항목" (브라우저에만 있는 UI 상태).
//
// 왜 zustand 인가:
// - 선택 상태를 보는 컴포넌트가 형제 관계다. <TodoItem/> 들과 <BulkActionBar/> 는 서버 컴포넌트(page.tsx)가
//   나란히 렌더링하며, 그 사이에 공통 "클라이언트" 부모가 없다.
// - useState 를 부모로 올리려면 페이지 전체를 클라이언트 컴포넌트로 바꿔야 하고, Context 를 쓰려면 Provider 래퍼가 필요하다.
// - 스토어는 둘 다 없이 형제끼리 상태를 공유한다. 컴포넌트 트리와 무관한 "모듈 단위" 상태이기 때문이다.
//
// 무엇을 넣지 않는가: 할 일 목록 자체(서버 데이터)는 넣지 않는다. 그것은 서버 컴포넌트가 DB 에서 읽어 props 로 준다.
// 스토어에는 "어떤 id 를 골랐는가" 만 있다. 서버 상태와 클라이언트 UI 상태의 경계를 지키는 것이 핵심이다.
//
// 주의: 스토어는 모듈 싱글턴이다. 서버에서 import 해 값을 넣으면 요청 간에 섞이므로 "use client" 컴포넌트에서만 쓴다.
// SSR 때도 이 모듈이 평가되지만 초기값(빈 배열)만 렌더링되므로 안전하다.
import { create } from "zustand";

type TodoSelectionState = {
  selectedIds: number[];
  toggle: (id: number) => void;
  selectAll: (ids: number[]) => void;
  clear: () => void;
};

export const useTodoSelection = create<TodoSelectionState>()((set) => ({
  selectedIds: [],
  // set 에 함수를 넘기면 이전 상태를 받아 새 상태 "조각" 을 돌려준다 (나머지 필드는 유지)
  toggle: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((x) => x !== id)
        : [...state.selectedIds, id],
    })),
  selectAll: (ids) => set({ selectedIds: [...ids] }),
  clear: () => set({ selectedIds: [] }),
}));
