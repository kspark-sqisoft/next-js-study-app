// 홈 페이지 (/). 서버 컴포넌트이며 요청별 데이터가 없어서 빌드 시 정적 HTML 로 생성된다 (SSG).
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
import Link from "next/link";
import { ListTodoIcon } from "lucide-react";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Next.js Study App</CardTitle>
            <Badge variant="secondary">v0.1.0</Badge>
          </div>
          <CardDescription>
            Next.js 16 + TypeScript + Tailwind CSS v4 + shadcn/ui
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <code className="rounded bg-muted px-1 py-0.5">src/app/page.tsx</code>
            를 수정하면 화면이 바로 갱신됩니다.
          </p>
        </CardContent>
        <CardFooter className="gap-2">
          {/* Button 스타일을 유지한 채 <a>(Link) 로 렌더링해 /todos 로 이동 */}
          <Button nativeButton={false} render={<Link href="/todos" />}>
            <ListTodoIcon data-icon="inline-start" />
            할 일 관리
          </Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
        </CardFooter>
      </Card>
    </main>
  );
}
