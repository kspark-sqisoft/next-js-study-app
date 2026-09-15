// 헤더 오른쪽의 로그인 상태 표시 (서버 컴포넌트).
// 세션 쿠키를 읽으므로 요청 시점에 실행된다. Cache Components 에서는 반드시 <Suspense> 안에 있어야 하고,
// 그래야 나머지 레이아웃(정적 셸)이 세션 확인을 기다리지 않고 먼저 그려진다.
import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/dal";
import { log } from "@/lib/study-log";

export async function UserMenu() {
  const user = await getCurrentUser();
  log.render(`UserMenu ← ${user ? user.name : "비로그인"} (레이아웃 안이지만 쿠키를 읽으므로 Suspense 안에서 요청마다 실행)`);

  if (!user) {
    return (
      <div className="flex shrink-0 items-center gap-1 text-sm whitespace-nowrap">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/login" />}>
          로그인
        </Button>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/signup" />}>
          회원 가입
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1 text-sm">
      {/* 이름을 누르면 프로필 페이지. 아바타는 users.avatar_path 에서. 긴 이름은 모바일에서 말줄임 */}
      <Link
        href="/profile"
        title="프로필"
        className="flex min-w-0 items-center gap-2 rounded-full py-0.5 pr-2.5 pl-0.5 transition-colors hover:bg-muted"
      >
        <Avatar name={user.name} avatarPath={user.avatarPath} size="sm" />
        <span className="truncate whitespace-nowrap">
          <strong className="font-medium">{user.name}</strong> 님
        </span>
      </Link>
      {/* 서버 컴포넌트에서는 onClick 을 쓸 수 없으므로 form action 으로 Server Action 을 호출한다 */}
      <form action={logoutAction}>
        <Button type="submit" size="sm" variant="ghost">로그아웃</Button>
      </form>
    </div>
  );
}
