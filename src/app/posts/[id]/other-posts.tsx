// 스트리밍 데모용 서버 컴포넌트. getOtherPosts 가 일부러 1.5초 걸린다.
// 부모에서 <Suspense> 로 감싸므로, 이 컴포넌트가 끝날 때까지 페이지 전체가 기다리지 않는다.
import Link from "next/link";
import { getOtherPosts } from "@/lib/posts";

export async function OtherPosts({ excludeId }: { excludeId: number }) {
  const posts = await getOtherPosts(excludeId);

  if (posts.length === 0) {
    return <p className="text-sm text-muted-foreground">다른 글이 없습니다.</p>;
  }

  return (
    <ul className="space-y-1 text-sm">
      {posts.map((post) => (
        <li key={post.id}>
          <Link href={`/posts/${post.id}`} className="hover:underline">
            {post.title}
          </Link>
        </li>
      ))}
      <li className="pt-1 text-xs text-muted-foreground">
        (1.5초 지연 후 스트리밍된 영역)
      </li>
    </ul>
  );
}
