// /posts/client 세그먼트 레이아웃. TanStack Query Provider 를 이 세그먼트에만 적용한다.
// 앱 전체(root layout)에 두지 않는 이유: 이 기능을 쓰는 곳에만 Provider 를 두면 범위가 분명하다.
import { QueryProviders } from "./providers";

export default function ClientFetchLayout({ children }: LayoutProps<"/posts/client">) {
  return <QueryProviders>{children}</QueryProviders>;
}
