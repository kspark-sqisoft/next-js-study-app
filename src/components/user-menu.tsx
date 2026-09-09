// 헤더 오른쪽의 로그인 상태 표시 (서버 컴포넌트).
// 세션 쿠키를 읽으므로 요청 시점에 실행된다. Cache Components 에서는 반드시 <Suspense> 안에 있어야 하고,
// 그래야 나머지 레이아웃(정적 셸)이 세션 확인을 기다리지 않고 먼저 그려진다.
import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/dal";

export async function UserMenu() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Link href="/login" className="hover:underline">로그인</Link>
        <Link href="/signup" className="hover:underline">회원 가입</Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span>
        <strong>{user.name}</strong> 님
      </span>
      {/* 서버 컴포넌트에서는 onClick 을 쓸 수 없으므로 form action 으로 Server Action 을 호출한다 */}
      <form action={logoutAction}>
        <Button type="submit" size="sm" variant="outline">로그아웃</Button>
      </form>
    </div>
  );
}
