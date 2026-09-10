// /posts/[id]/edit 글 수정. 작성자 본인만 접근할 수 있다.
// src/proxy.ts 가 로그인 안 한 사용자를 먼저 걸러 주지만, 여기서도 다시 확인한다 (proxy 는 보조 수단).
import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/dal";
import { getPost, getPostIds } from "@/lib/posts";
import { imageUrl } from "@/lib/uploads";
import { updatePostAction } from "../../actions";
import { PostForm } from "../../post-form";

export const metadata: Metadata = { title: "글 수정 | Next.js Study App" };

// [id]/page.tsx 와 같은 규칙. 이 세그먼트도 동적 라우트라 최소 1개를 돌려줘야 한다.
export async function generateStaticParams() {
  const ids = (await getPostIds()).slice(0, 2);
  return ids.length > 0 ? ids.map((id) => ({ id: String(id) })) : [{ id: "0" }];
}

export default function EditPostPage({ params }: PageProps<"/posts/[id]/edit">) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <EditPost params={params} />
    </Suspense>
  );
}

async function EditPost({ params }: Pick<PageProps<"/posts/[id]/edit">, "params">) {
  const user = await requireUser(); // 로그인 안 했으면 /login 으로
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const post = await getPost(numericId);
  if (!post) notFound();
  if (post.authorId !== user.id) redirect(`/posts/${post.id}`); // 남의 글이면 상세로 돌려보낸다

  // bind: 첫 인자(id)를 고정한 새 함수를 만든다. 폼은 (prev, formData) 만 넘기면 된다.
  const action = updatePostAction.bind(null, post.id);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">글 수정</h1>
      <PostForm
        action={action}
        initial={{ title: post.title, content: post.content, imageUrl: post.imagePath ? imageUrl(post.imagePath) : null }}
        submitLabel="저장"
      />
    </div>
  );
}
