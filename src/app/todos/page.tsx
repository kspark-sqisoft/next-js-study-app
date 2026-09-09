// /todos 페이지 (서버 컴포넌트).
// "use client" 가 없으므로 서버에서만 실행되고, DB 를 직접 읽을 수 있다.
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getTodos } from "@/lib/todos";
import { AddTodoForm } from "./add-todo-form";
import { ClearCompletedButton } from "./clear-completed-button";
import { TodoItem } from "./todo-item";

// <head> 의 <title> 등 메타데이터
export const metadata: Metadata = {
  title: "할 일 | Next.js Study App",
};

// async 컴포넌트: 서버 컴포넌트는 데이터를 await 로 바로 가져올 수 있다.
export default async function TodosPage() {
  const todos = await getTodos(); // 매 요청마다 DB 조회 (SSR)
  const completedCount = todos.filter((t) => t.completed).length;
  const remainingCount = todos.length - completedCount;

  return (
    <main className="flex flex-1 items-start justify-center p-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>할 일</CardTitle>
            <Badge variant="secondary">{remainingCount}개 남음</Badge>
          </div>
          <CardDescription>
            SQLite + Server Actions 로 만든 기본 투두 관리
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 아래부터는 클라이언트 컴포넌트. 서버에서 받은 데이터를 props 로 넘긴다. */}
          <AddTodoForm />
          <Separator />

          {todos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              아직 할 일이 없습니다. 위에서 추가해 보세요.
            </p>
          ) : (
            <ul className="space-y-2">
              {todos.map((todo) => (
                <TodoItem key={todo.id} todo={todo} />
              ))}
            </ul>
          )}
        </CardContent>

        <CardFooter className="justify-between">
          {/* render prop: Button 스타일을 유지한 채 실제 요소는 <a>(Link) 로 렌더링 */}
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/" />}>
            <ArrowLeftIcon data-icon="inline-start" />
            홈으로
          </Button>
          <ClearCompletedButton count={completedCount} />
        </CardFooter>
      </Card>
    </main>
  );
}
