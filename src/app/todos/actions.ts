// 파일 전체를 Server Action 으로 선언. 여기 export 된 함수는 서버에서만 실행되며,
// 클라이언트 컴포넌트에서 일반 함수처럼 호출하면 내부적으로 POST 요청이 나간다.
"use server";

import { revalidatePath } from "next/cache";
import {
  createTodo,
  deleteCompletedTodos,
  deleteTodo,
  deleteTodos,
  setTodoCompleted,
  setTodosCompleted,
  updateTodoTitle,
} from "@/lib/todos";

// useActionState 에서 사용하는 상태 타입. 에러가 없으면 null.
export type ActionState = { error?: string } | null;

const MAX_TITLE = 200;

// 입력값 검증: 공백 제거 후 1~200자만 허용. 실패하면 null.
function parseTitle(value: FormDataEntryValue | null): string | null {
  const title = typeof value === "string" ? value.trim() : "";
  if (!title || title.length > MAX_TITLE) return null;
  return title;
}

// 할 일 추가. <form action> 으로 호출되어 FormData 를 받는다.
// 첫 번째 인자 _prev 는 useActionState 규약상 이전 상태 (여기서는 사용 안 함).
export async function addTodoAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const title = parseTitle(formData.get("title"));
  if (!title) {
    return { error: `할 일은 1~${MAX_TITLE}자로 입력하세요.` };
  }
  await createTodo(title);
  revalidatePath("/todos"); // /todos 페이지를 서버에서 다시 렌더링해 최신 목록을 내려보낸다
  return null;
}

// 완료 여부 토글
export async function toggleTodoAction(id: number, completed: boolean) {
  await setTodoCompleted(id, completed);
  revalidatePath("/todos");
}

// 제목 수정. 검증 실패 시 에러 객체 반환.
export async function renameTodoAction(id: number, title: string) {
  const parsed = parseTitle(title);
  if (!parsed) return { error: `할 일은 1~${MAX_TITLE}자로 입력하세요.` };
  await updateTodoTitle(id, parsed);
  revalidatePath("/todos");
  return null;
}

// 단건 삭제
export async function deleteTodoAction(id: number) {
  await deleteTodo(id);
  revalidatePath("/todos");
}

// 완료 항목 일괄 삭제. 삭제 개수를 반환해 토스트 메시지에 사용한다.
export async function clearCompletedAction() {
  const count = await deleteCompletedTodos();
  revalidatePath("/todos");
  return count;
}

// ---------------------------------------------------------------------------
// 일괄 처리 (zustand 선택 스토어와 짝을 이룬다)
// 클라이언트가 고른 id 목록을 받는다. 클라이언트에서 온 값이므로 여기서 다시 검증한다.
// ---------------------------------------------------------------------------

const MAX_BULK = 100;

function parseIds(ids: unknown): number[] | null {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_BULK) return null;
  if (!ids.every((id) => Number.isInteger(id) && id > 0)) return null;
  return ids as number[];
}

export async function bulkSetCompletedAction(ids: number[], completed: boolean) {
  const valid = parseIds(ids);
  if (!valid) return { error: "선택한 항목이 올바르지 않습니다." };
  const changed = await setTodosCompleted(valid, completed);
  revalidatePath("/todos");
  return { changed };
}

export async function bulkDeleteAction(ids: number[]) {
  const valid = parseIds(ids);
  if (!valid) return { error: "선택한 항목이 올바르지 않습니다." };
  const deleted = await deleteTodos(valid);
  revalidatePath("/todos");
  return { deleted };
}
