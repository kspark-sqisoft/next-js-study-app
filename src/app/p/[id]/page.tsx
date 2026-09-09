// /p/[id] → /posts/[id] 로 영구 이동 (308). "짧은 주소" 나 "옛 주소 체계" 를 코드로 처리하는 예.
// permanentRedirect 는 예외를 던지는 방식이라 아래 코드는 실행되지 않으며, 응답은 308 + Location 헤더다.
//
// 주의: <Suspense> 안에서 redirect 하면 이미 정적 셸(200)이 전송된 뒤라서 HTTP 상태 코드가 아니라
// 스트림 속의 "클라이언트 리다이렉트 지시" 가 된다 (브라우저는 이동하지만 curl 은 200 을 본다).
// 진짜 308 을 보내려면 스트리밍이 시작되기 전, 즉 Suspense 경계 밖에서 리다이렉트해야 한다.
// 그 대가로 이 페이지는 정적 셸이 없다 (어차피 보여 줄 내용이 없으므로 괜찮다).
//
// 경로 패턴만으로 정할 수 있는 리다이렉트는 next.config.ts 의 redirects 가 더 간단하다 (/blog/:id 참고).
// 여기서는 DB 조회 결과에 따라 목적지를 정해야 하는 경우처럼 "코드가 필요한" 리다이렉트의 형태를 보여 준다.
import { notFound, permanentRedirect } from "next/navigation";
import { getPost } from "@/lib/posts";

export async function generateStaticParams() {
  return [{ id: "1" }];
}

export default async function ShortLinkPage({ params }: PageProps<"/p/[id]">): Promise<never> {
  const { id } = await params;
  const post = await getPost(Number(id));
  if (!post) notFound(); // 없는 글이면 리다이렉트하지 않고 404
  permanentRedirect(`/posts/${post.id}`);
}
