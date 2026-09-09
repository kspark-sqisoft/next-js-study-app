// /posts 와 /posts/[id] 가 공유하는 레이아웃. modal 은 병렬 라우트 슬롯(@modal 폴더).
//
// 왜 무한 스크롤/클라이언트 검색/외부 API 페이지는 여기(/posts/*) 에 없나?
// 인터셉팅 라우트 @modal/(.)[id] 는 "클라이언트 이동으로 /posts/<무엇이든>" 에 가면 전부 가로챈다.
// /posts/feed 같은 정적 형제 라우트도 [id]="feed" 로 잡혀 모달이 떠 버린다 (README 2-14 참고).
// 그래서 그 페이지들은 src/app/(demos)/ 라우트 그룹으로 옮겨 /feed, /client-fetch, /releases 가 되었다.
import { PostsNav } from "@/components/posts-nav";

export default function PostsLayout({ children, modal }: LayoutProps<"/posts">) {
  return (
    <div className="mx-auto w-full max-w-2xl p-8">
      <PostsNav />
      {children}
      {modal}
    </div>
  );
}
