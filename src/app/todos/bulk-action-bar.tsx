// 선택된 할 일에 대한 일괄 처리 툴바 (클라이언트 컴포넌트).
// <TodoItem/> 과 형제지만 같은 zustand 스토어를 구독하므로 props 없이 선택 상태를 안다.
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { useTodoSelection } from "@/stores/todo-selection-store";
import { bulkDeleteAction, bulkSetCompletedAction } from "./actions";

export function BulkActionBar({ allIds }: { allIds: number[] }) {
  const [isPending, startTransition] = useTransition();

  // 선택자(selector): 스토어 전체가 아니라 필요한 조각만 구독한다.
  // useShallow: 객체/배열을 새로 만들어 돌려주는 선택자는 매번 다른 참조라 리렌더가 무한히 나므로 얕은 비교로 막는다.
  const { selectedIds, selectAll, clear } = useTodoSelection(
    useShallow((s) => ({ selectedIds: s.selectedIds, selectAll: s.selectAll, clear: s.clear })),
  );

  // 삭제된 항목이 선택에 남아 있을 수 있으므로 현재 목록에 있는 것만 센다
  const selected = selectedIds.filter((id) => allIds.includes(id));
  const allSelected = allIds.length > 0 && selected.length === allIds.length;

  function run(work: () => Promise<{ error?: string } | { changed: number } | { deleted: number }>, done: (r: never) => string) {
    startTransition(async () => {
      const result = await work();
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(done(result as never));
      clear(); // 처리 후 선택 해제
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm" data-testid="bulk-action-bar">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(e) => (e.target.checked ? selectAll(allIds) : clear())}
          disabled={allIds.length === 0}
          aria-label="전체 선택"
        />
        전체 선택
      </label>
      <span className="text-muted-foreground" data-testid="selected-count">{selected.length}개 선택됨</span>

      {selected.length > 0 && (
        <div className="ml-auto flex gap-1">
          <Button size="xs" variant="outline" disabled={isPending}
            onClick={() => run(() => bulkSetCompletedAction(selected, true), (r: { changed: number }) => `${r.changed}개를 완료 처리했습니다.`)}>
            완료 처리
          </Button>
          <Button size="xs" variant="outline" disabled={isPending}
            onClick={() => run(() => bulkSetCompletedAction(selected, false), (r: { changed: number }) => `${r.changed}개를 미완료로 바꿨습니다.`)}>
            미완료로
          </Button>
          <Button size="xs" variant="destructive" disabled={isPending}
            onClick={() => {
              if (!confirm(`${selected.length}개를 삭제할까요?`)) return;
              run(() => bulkDeleteAction(selected), (r: { deleted: number }) => `${r.deleted}개를 삭제했습니다.`);
            }}>
            삭제
          </Button>
          <Button size="xs" variant="ghost" onClick={clear}>선택 해제</Button>
        </div>
      )}
    </div>
  );
}
