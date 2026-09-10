// todos 테이블 접근 함수 (Prisma 버전). main 브랜치의 SQL 문자열 버전과 비교해 보자.
// - TodoRow 타입과 toTodo 변환이 거의 사라졌다. Prisma 가 컬럼 타입을 알고 있어서 반환값에 타입이 자동으로 붙는다.
//   (completed 만 0/1 → boolean 변환이 남는다. SQLite 에 boolean 이 없기 때문)
// - `IN (?, ?, ?)` 자리표시자 조립이 `{ id: { in: ids } }` 로 바뀌었다.
import "server-only";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

export type Todo = {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
};

type TodoRecord = { id: number; title: string; completed: number; createdAt: string };

function toTodo(t: TodoRecord): Todo {
  return { id: t.id, title: t.title, completed: t.completed === 1, createdAt: t.createdAt };
}

/**
 * 전체 목록 조회. `await connection()` 의 역할은 main 브랜치 README 1-1 과 같다:
 * 요청이 온 다음에 실행되게 해서 빌드 시점에 결과가 굳지 않도록 한다.
 * (Prisma 쿼리는 비동기지만, 비동기라고 해서 자동으로 "요청 시점" 이 되는 것은 아니다. 캐시되지 않은
 *  비동기 작업도 프리렌더 중에 실행될 수 있으므로 여전히 connection() 이 필요하다.)
 */
export async function getTodos(): Promise<Todo[]> {
  await connection();
  const rows = await prisma.todo.findMany({ orderBy: [{ completed: "asc" }, { id: "desc" }] });
  return rows.map(toTodo);
}

export async function listTodos(
  completed: boolean | null,
  limit: number,
  offset: number,
): Promise<{ todos: Todo[]; total: number }> {
  const where = completed === null ? {} : { completed: completed ? 1 : 0 };
  const [total, rows] = await Promise.all([
    prisma.todo.count({ where }),
    prisma.todo.findMany({ where, orderBy: { id: "desc" }, take: limit, skip: offset }),
  ]);
  return { todos: rows.map(toTodo), total };
}

export async function findTodo(id: number): Promise<Todo | null> {
  if (!Number.isInteger(id)) return null;
  const t = await prisma.todo.findUnique({ where: { id } });
  return t ? toTodo(t) : null;
}

export async function createTodo(title: string): Promise<Todo> {
  return toTodo(await prisma.todo.create({ data: { title } }));
}

export async function setTodoCompleted(id: number, completed: boolean): Promise<void> {
  await prisma.todo.update({ where: { id }, data: { completed: completed ? 1 : 0 } });
}

export async function updateTodoTitle(id: number, title: string): Promise<void> {
  await prisma.todo.update({ where: { id }, data: { title } });
}

export async function deleteTodo(id: number): Promise<void> {
  await prisma.todo.deleteMany({ where: { id } }); // delete() 는 없으면 예외를 던지므로 deleteMany
}

export async function setTodosCompleted(ids: number[], completed: boolean): Promise<number> {
  if (ids.length === 0) return 0;
  const r = await prisma.todo.updateMany({ where: { id: { in: ids } }, data: { completed: completed ? 1 : 0 } });
  return r.count;
}

export async function deleteTodos(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  const r = await prisma.todo.deleteMany({ where: { id: { in: ids } } });
  return r.count;
}

export async function deleteCompletedTodos(): Promise<number> {
  const r = await prisma.todo.deleteMany({ where: { completed: 1 } });
  return r.count;
}
