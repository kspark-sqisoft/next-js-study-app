// /posts/[id] 글 상세. 동적 라우트 세그먼트.
//
// Cache Components 에서 동적 라우트를 다루는 규칙:
// 1. generateStaticParams 가 돌려준 id 는 빌드 시 완전히 미리 렌더링된다.
// 2. 그 외 id 는 첫 요청 때 렌더링되고, getPost 가 "use cache" 라 결과가 캐시된다 (ISR).
// 3. params 는 Promise 이며, 페이지 최상위가 아니라 <Suspense> 안에서 await 해야
//    "id 와 무관한 정적 셸" 을 만들 수 있다.
import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getPost, getPostIds } from "@/lib/posts";
import { imageUrl } from "@/lib/uploads";
import { CommentsSection } from "./comments-section";
import { ErrorTrigger } from "./error-trigger";
import { OtherPosts } from "./other-posts";
import { PostOwnerActions } from "./post-owner-actions";
import { RecentlyViewedLoader } from "./recently-viewed-loader";

// 빌드 시 미리 렌더링할 id. Cache Components 에서는 최소 1개를 돌려줘야 한다.
// DB 가 비어 있으면(첫 clone 등) 자리표시자를 주고, 페이지에서 notFound() 로 처리한다.
export async function generateStaticParams() {
  const ids = getPostIds().slice(0, 2); // 최신 2개만 빌드 시 생성, 나머지는 첫 요청 때
  return ids.length > 0 ? ids.map((id) => ({ id: String(id) })) : [{ id: "0" }];
}

// <title> 을 글 제목으로. params 를 읽으므로 요청 시점에 실행되고, 페이지와 함께 스트리밍된다.
export async function generateMetadata({
  params,
}: PageProps<"/posts/[id]">): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(Number(id));
  return { title: post ? `${post.title} | Next.js Study App` : "글 없음" };
}

// 페이지 자체는 params 를 await 하지 않는다. Suspense 안의 자식에게 넘긴다.
export default function PostPage({ params }: PageProps<"/posts/[id]">) {
  return (
    <div className="space-y-8">
      <Suspense fallback={<PostSkeleton />}>
        <PostDetail params={params} />
      </Suspense>
    </div>
  );
}

// 실제로 params 를 읽고 데이터를 가져오는 부분
async function PostDetail({ params }: Pick<PageProps<"/posts/[id]">, "params">) {
  const { id } = await params;
  const numericId = Number(id);

  // 숫자가 아니거나 없는 글이면 같은 세그먼트의 not-found.tsx 를 렌더링한다
  if (!Number.isInteger(numericId)) notFound();
  const post = await getPost(numericId);
  if (!post) notFound();

  return (
    <>
      <article>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{post.title}</h1>
          <Badge variant="secondary">#{post.id}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {post.authorName ?? "작성자 없음"} · 작성 {post.createdAt} · 수정 {post.updatedAt}
        </p>
        {post.imagePath && (
          // next/image: 크기를 모르는 업로드 이미지는 fill + 부모의 relative/aspect 로 자리를 잡는다.
          // 브라우저 폭에 맞춰 리사이즈·WebP 변환된 결과가 /_next/image 를 통해 내려온다 (Network 탭 확인).
          <div className="relative mt-4 aspect-video overflow-hidden rounded-lg border">
            <Image
              src={imageUrl(post.imagePath)}
              alt={post.title}
              fill
              sizes="(max-width: 768px) 100vw, 672px"
              className="object-cover"
              priority
            />
          </div>
        )}
        {/* whitespace-pre-line: 저장된 줄바꿈을 그대로 표시 */}
        <div className="mt-6 whitespace-pre-line text-sm leading-relaxed">
          {post.content}
        </div>
      </article>

      {/* next/dynamic + ssr:false: localStorage 를 쓰는 브라우저 전용 컴포넌트를 클라이언트에서만 로드 */}
      <RecentlyViewedLoader currentId={post.id} currentTitle={post.title} />

      <div className="flex flex-wrap items-center gap-3">
        {/* 세션을 읽는 부분만 Suspense. 본문(캐시)은 즉시 나오고 버튼은 요청 시 채워진다 */}
        <Suspense fallback={<div className="h-7 w-24" />}>
          <PostOwnerActions postId={post.id} authorId={post.authorId} />
        </Suspense>
        <ErrorTrigger />
      </div>

      {/* 댓글: 목록은 캐시, 현재 사용자는 요청 시 → Suspense 안에서 합친다 */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">댓글 불러오는 중...</p>}>
        <CommentsSection postId={post.id} />
      </Suspense>

      {/* 스트리밍 데모: 이 부분만 1.5초 뒤에 채워진다. 위쪽 본문은 기다리지 않는다. */}
      <section>
        <h2 className="mb-2 font-semibold">다른 글</h2>
        <Suspense fallback={<OtherPostsSkeleton />}>
          <OtherPosts excludeId={post.id} />
        </Suspense>
      </section>
    </>
  );
}

function PostSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function OtherPostsSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-5 w-2/5" />
      <Skeleton className="h-5 w-3/5" />
    </div>
  );
}
