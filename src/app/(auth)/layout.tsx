// (auth) 는 라우트 그룹. 괄호 폴더는 URL 에 포함되지 않는다: /login, /signup
// 로그인/회원가입 페이지가 공유하는 가운데 정렬 레이아웃.
import { Card, CardContent } from "@/components/ui/card";

export default function AuthLayout({ children }: LayoutProps<"/"> ) {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">{children}</CardContent>
      </Card>
    </main>
  );
}
