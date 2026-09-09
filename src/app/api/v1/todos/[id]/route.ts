// GET    /api/v1/todos/:id — 할 일 한 건 (누구나)
// PATCH  /api/v1/todos/:id — 제목/완료 여부 변경 (인증 필요)
// DELETE /api/v1/todos/:id — 삭제 (인증 필요)
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/api/auth";
import { noContent, notFound, ok, parseIdParam, parseJsonBody } from "@/lib/api/http";
import { apiRoute } from "@/lib/api/route";
import { serializeTodo } from "@/lib/api/serialize";
import { todoUpdateSchema } from "@/lib/schemas/api";
import { deleteTodo, findTodo, setTodoCompleted, updateTodoTitle } from "@/lib/todos";

function loadTodo(rawId: string) {
  const todo = findTodo(parseIdParam(rawId));
  if (!todo) throw notFound("존재하지 않는 할 일입니다.");
  return todo;
}

export const GET = apiRoute<{ id: string }>(async ({ params }) => {
  return ok(serializeTodo(loadTodo(params.id)));
});

export const PATCH = apiRoute<{ id: string }>(async ({ request, params, auth }) => {
  requireAuth(auth);
  const todo = loadTodo(params.id);
  const body = await parseJsonBody(request, todoUpdateSchema);

  // 온 필드만 반영한다. 두 컬럼을 따로 갱신하는 함수를 그대로 재사용했다.
  if (body.title !== undefined) updateTodoTitle(todo.id, body.title);
  if (body.completed !== undefined) setTodoCompleted(todo.id, body.completed);

  revalidatePath("/todos");
  return ok(serializeTodo(findTodo(todo.id)!));
});

export const DELETE = apiRoute<{ id: string }>(async ({ params, auth }) => {
  requireAuth(auth);
  const todo = loadTodo(params.id);

  deleteTodo(todo.id);
  revalidatePath("/todos");

  return noContent();
});
