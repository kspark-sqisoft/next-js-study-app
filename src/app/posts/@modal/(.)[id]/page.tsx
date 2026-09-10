// 인터셉팅 라우트: 목록(/posts)에서 <Link href="/posts/3"> 로 "클라이언트 이동" 하면
// 진짜 /posts/[id] 페이지 대신 이 파일이 @modal 슬롯에 렌더링된다. URL 은 /posts/3 으로 바뀐다.
// 새로고침하거나 주소를 직접 입력하면 인터셉트가 일어나지 않고 원래 페이지(src/app/posts/[id]/page.tsx)가 뜬다.
//
// 폴더 이름 (.)[id] 의 (.) 는 "같은 세그먼트 레벨" 을 뜻한다. @modal 은 슬롯이라 세그먼트로 치지 않으므로
// posts/@modal/(.)[id] 는 posts/[id] 를 가리킨다.
import { Suspense } from "react";
import Image from "next/image";
import { RouteModal } from "@/components/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { getPost, getPostIds } from "@/lib/posts";
import { imageUrl } from "@/lib/uploads";

// 동적 세그먼트이므로 Cache Components 규칙대로 최소 1개를 돌려준다
export async function generateStaticParams() {
  const ids = (await getPostIds()).slice(0, 2);
  return ids.length > 0 ? ids.map((id) => ({ id: String(id) })) : [{ id: "0" }];
}

export default function InterceptedPostPage({ params }: PageProps<"/posts/[id]">) {
  return (
    <Suspense fallback={null}>
      <ModalContent params={params} />
    </Suspense>
  );
}

async function ModalContent({ params }: Pick<PageProps<"/posts/[id]">, "params">) {
  const { id } = await params;
  const post = await getPost(Number(id));

  if (!post) {
    return (
      <RouteModal title="글을 찾을 수 없습니다">
        <p className="text-sm text-muted-foreground">삭제되었거나 없는 글입니다.</p>
      </RouteModal>
    );
  }

  return (
    <RouteModal title={post.title}>
      <p className="text-xs text-muted-foreground">
        {post.authorName ?? "작성자 없음"} · {post.createdAt}
      </p>
      {post.imagePath && (
        <div className="relative aspect-video overflow-hidden rounded-lg border">
          <Image src={imageUrl(post.imagePath)} alt={post.title} fill sizes="640px" className="object-cover" />
        </div>
      )}
      <div className="whitespace-pre-line text-sm leading-relaxed">{post.content}</div>
      <Suspense fallback={<Skeleton className="h-4 w-24" />}>
        {/* 일반 <a>: 클라이언트 이동이 아닌 "전체 페이지 로드" 라서 인터셉트되지 않고 원래 상세 페이지가 열린다 */}
        <a href={`/posts/${post.id}`} className="text-xs underline">전체 페이지로 보기 (댓글, 수정)</a>
      </Suspense>
    </RouteModal>
  );
}
