// 글 작성자에게만 보이는 수정/삭제 버튼 (서버 컴포넌트).
// 세션을 읽으므로 부모에서 <Suspense> 로 감싼다. 글 본문(캐시)은 이 확인을 기다리지 않는다.
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/dal";
import { DeletePostButton } from "./delete-post-button";

export async function PostOwnerActions({ postId, authorId }: { postId: number; authorId: number | null }) {
  const user = await getCurrentUser();
  const isOwner = user !== null && user.id === authorId;

  if (!isOwner) {
    return (
      <p className="text-xs text-muted-foreground">
        {user ? "다른 사람의 글은 읽기만 할 수 있습니다." : "로그인하면 내 글을 수정할 수 있습니다."}
      </p>
    );
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/posts/${postId}/edit`} />}>
        수정
      </Button>
      <DeletePostButton id={postId} />
    </div>
  );
}
