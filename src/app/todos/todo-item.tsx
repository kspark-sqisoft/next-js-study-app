// 할 일 한 줄 (클라이언트 컴포넌트).
// 체크 토글, 인라인 수정, 삭제를 담당한다.
"use client";

import { useOptimistic, useState, useTransition } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { Todo } from "@/lib/todos";
import { useTodoSelection } from "@/stores/todo-selection-store";
import {
  deleteTodoAction,
  renameTodoAction,
  toggleTodoAction,
} from "./actions";

export function TodoItem({ todo }: { todo: Todo }) {
  // useTransition: Server Action 을 감싸 실행하면 isPending 으로 진행 중 상태를 알 수 있다.
  const [isPending, startTransition] = useTransition();
  // 수정 모드 여부 (순수 클라이언트 상태)
  const [editing, setEditing] = useState(false);
  // useOptimistic: 서버 응답을 기다리지 않고 화면을 먼저 바꾼다.
  // 액션이 끝나 서버에서 새 props 가 오면 자동으로 실제 값으로 동기화된다.
  const [optimisticCompleted, setOptimisticCompleted] = useOptimistic(
    todo.completed,
  );
  // zustand: 이 항목이 선택됐는지만 구독한다. 선택자가 boolean 을 돌려주므로 다른 항목의 선택이 바뀌어도
  // 이 컴포넌트는 리렌더되지 않는다 (스토어 전체를 구독했다면 모든 항목이 매번 다시 그려진다).
  const isSelected = useTodoSelection((s) => s.selectedIds.includes(todo.id));
  const toggleSelected = useTodoSelection((s) => s.toggle);

  // 체크박스 클릭: 화면 먼저 갱신 → 서버에 저장
  function handleToggle(checked: boolean) {
    startTransition(async () => {
      setOptimisticCompleted(checked);
      await toggleTodoAction(todo.id, checked);
    });
  }

  // 삭제 버튼 클릭
  function handleDelete() {
    startTransition(async () => {
      await deleteTodoAction(todo.id);
      toast.success("삭제했습니다.");
    });
  }

  // 수정 폼 제출 (저장 버튼 또는 Enter)
  function handleRename(formData: FormData) {
    const title = String(formData.get("title") ?? "");
    startTransition(async () => {
      const result = await renameTodoAction(todo.id, title);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setEditing(false); // 성공하면 보기 모드로 복귀
    });
  }

  const checkboxId = `todo-${todo.id}`;

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2 transition-opacity",
        isPending && "opacity-60", // 서버 처리 중이면 흐리게
        isSelected && "border-primary bg-primary/5", // 선택된 항목 강조
      )}
    >
      {/* 일괄 처리용 선택 체크박스 (zustand). 오른쪽의 완료 체크박스(서버 상태)와는 별개다 */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => toggleSelected(todo.id)}
        aria-label="선택"
        className="accent-primary"
      />
      <Checkbox
        id={checkboxId}
        checked={optimisticCompleted}
        onCheckedChange={(checked) => handleToggle(checked === true)}
        disabled={isPending || editing}
        aria-label="완료 여부"
      />

      {editing ? (
        // 수정 모드: 입력창 + 저장/취소
        <form action={handleRename} className="flex flex-1 gap-2">
          <Input
            name="title"
            defaultValue={todo.title}
            autoFocus
            maxLength={200}
            required
            className="h-7"
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false); // Esc 로 취소
            }}
          />
          <Button type="submit" size="sm" disabled={isPending}>
            저장
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
          >
            취소
          </Button>
        </form>
      ) : (
        // 보기 모드: 제목 + 수정/삭제 아이콘
        <>
          <label
            htmlFor={checkboxId} // 제목을 클릭해도 체크박스가 토글된다
            className={cn(
              "flex-1 cursor-pointer text-sm",
              optimisticCompleted && "text-muted-foreground line-through",
            )}
          >
            {todo.title}
          </label>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setEditing(true)}
            disabled={isPending}
            aria-label="수정"
          >
            <PencilIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={isPending}
            aria-label="삭제"
          >
            <Trash2Icon />
          </Button>
        </>
      )}
    </li>
  );
}
