// /profile 내 프로필. 로그인 필수 (requireUser). 이름과 아바타를 바꾼다.
// 세션을 읽으므로 실제 내용은 Suspense 안에서 요청마다 렌더링되고, 제목 영역은 정적 셸에 들어간다.
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/dal";
import { log } from "@/lib/study-log";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "프로필 | Next.js Study App" };

export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-10">
      <h1 className="text-xl font-semibold">프로필</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">헤더와 글·댓글 작성자에 보이는 이름과 아바타를 바꿉니다.</p>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <ProfileContent />
      </Suspense>
    </main>
  );
}

async function ProfileContent() {
  const user = await requireUser(); // 로그인 안 했으면 /login 으로 (proxy 가 먼저 걸러 주지만 여기서 다시 확인)
  log.render(`ProfileContent ← ${user.name} (requireUser 통과)`);
  return <ProfileForm user={{ name: user.name, email: user.email, avatarPath: user.avatarPath }} />;
}
