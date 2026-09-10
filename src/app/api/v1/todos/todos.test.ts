// @vitest-environment node
// 할 일 API. posts 와 달리 소유자 개념이 없어서 "로그인했는가" 만 본다.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { apiRequest, routeParams } from "@/test/api-request";

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  updateTag: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

const { issueAccessToken } = await import("@/lib/api/auth");
const { createUser } = await import("@/lib/users");
const { createTodo, setTodoCompleted } = await import("@/lib/todos");
const { GET: listTodosRoute, POST: createTodoRoute } = await import("./route");
const { GET: getTodo, PATCH: patchTodo, DELETE: deleteTodoRoute } = await import("./[id]/route");

async function json<T = Record<string, never>>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

let token: string;

beforeAll(async () => {
  token = await issueAccessToken((await createUser("할일러", "todo-user@test.local", "hash")).id);

  await createTodo("우유 사기");
  const done = await createTodo("설거지");
  await setTodoCompleted(done.id, true);
});

describe("GET /api/v1/todos", () => {
  it("인증 없이 목록을 준다", async () => {
    const res = await listTodosRoute(apiRequest("/api/v1/todos"));
    expect(res.status).toBe(200);

    const body = await json<{ data: Record<string, unknown>[]; pagination: { total: number } }>(res);
    expect(body.pagination.total).toBe(2);
    expect(Object.keys(body.data[0]).sort()).toEqual(["completed", "createdAt", "id", "title"]);
  });

  it("completed 로 거른다", async () => {
    const done = await json<{ data: { title: string }[] }>(
      await listTodosRoute(apiRequest("/api/v1/todos?completed=true")),
    );
    expect(done.data.map((t) => t.title)).toEqual(["설거지"]);

    const todo = await json<{ data: { title: string }[] }>(
      await listTodosRoute(apiRequest("/api/v1/todos?completed=false")),
    );
    expect(todo.data.map((t) => t.title)).toEqual(["우유 사기"]);
  });

  it("completed 에 이상한 값을 주면 422", async () => {
    expect((await listTodosRoute(apiRequest("/api/v1/todos?completed=yes"))).status).toBe(422);
  });
});

describe("POST /api/v1/todos", () => {
  it("토큰이 없으면 401", async () => {
    const res = await createTodoRoute(apiRequest("/api/v1/todos", { method: "POST", body: { title: "무단" } }));
    expect(res.status).toBe(401);
  });

  it("추가하면 201", async () => {
    const res = await createTodoRoute(apiRequest("/api/v1/todos", {
      method: "POST", token, body: { title: "API 로 추가" },
    }));
    expect(res.status).toBe(201);

    const { data } = await json<{ data: { title: string; completed: boolean } }>(res);
    expect(data).toMatchObject({ title: "API 로 추가", completed: false });
  });

  it("completed: true 로도 만들 수 있다", async () => {
    const res = await createTodoRoute(apiRequest("/api/v1/todos", {
      method: "POST", token, body: { title: "이미 끝난 일", completed: true },
    }));
    expect((await json<{ data: { completed: boolean } }>(res)).data.completed).toBe(true);
  });

  it("빈 제목은 422", async () => {
    const res = await createTodoRoute(apiRequest("/api/v1/todos", { method: "POST", token, body: { title: "  " } }));
    expect(res.status).toBe(422);
  });
});

describe("/api/v1/todos/:id", () => {
  it("PATCH 로 완료 처리하고 GET 으로 확인한다", async () => {
    const created = (await json<{ data: { id: number } }>(
      await createTodoRoute(apiRequest("/api/v1/todos", { method: "POST", token, body: { title: "토글 대상" } })),
    )).data;
    const id = String(created.id);

    const patched = await patchTodo(
      apiRequest(`/api/v1/todos/${id}`, { method: "PATCH", token, body: { completed: true } }),
      routeParams({ id }),
    );
    expect((await json<{ data: { completed: boolean; title: string } }>(patched)).data)
      .toMatchObject({ completed: true, title: "토글 대상" });

    const fetched = await getTodo(apiRequest(`/api/v1/todos/${id}`), routeParams({ id }));
    expect((await json<{ data: { completed: boolean } }>(fetched)).data.completed).toBe(true);
  });

  it("빈 PATCH 는 422", async () => {
    const res = await patchTodo(
      apiRequest("/api/v1/todos/1", { method: "PATCH", token, body: {} }),
      routeParams({ id: "1" }),
    );
    expect(res.status).toBe(422);
  });

  it("없는 할 일은 404", async () => {
    expect((await getTodo(apiRequest("/api/v1/todos/999999"), routeParams({ id: "999999" }))).status).toBe(404);
  });

  it("삭제는 204, 인증이 없으면 401", async () => {
    const created = (await json<{ data: { id: number } }>(
      await createTodoRoute(apiRequest("/api/v1/todos", { method: "POST", token, body: { title: "지울 일" } })),
    )).data;
    const id = String(created.id);

    const unauthorized = await deleteTodoRoute(
      apiRequest(`/api/v1/todos/${id}`, { method: "DELETE" }),
      routeParams({ id }),
    );
    expect(unauthorized.status).toBe(401);

    const res = await deleteTodoRoute(
      apiRequest(`/api/v1/todos/${id}`, { method: "DELETE", token }),
      routeParams({ id }),
    );
    expect(res.status).toBe(204);
    expect((await getTodo(apiRequest(`/api/v1/todos/${id}`), routeParams({ id }))).status).toBe(404);
  });
});
