// 외부 API 호출 예제: GitHub 에서 Next.js 최신 릴리스 목록을 가져온다.
//
// Cache Components 에서 외부 fetch 를 캐시하는 방법은 DB 조회와 똑같다: "use cache" 로 감싼다.
// (예전 모델의 fetch(url, { next: { revalidate: 3600, tags: [...] } }) 옵션이 cacheLife / cacheTag 로 바뀐 것)
// 실패하면 throw 한다. 던져진 에러는 캐시에 저장되지 않으므로 다음 요청에서 다시 시도되고,
// 화면에서는 가장 가까운 error.tsx 가 잡는다.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";

export type Release = {
  id: number;
  name: string;
  tag: string;
  url: string;
  publishedAt: string;
  prerelease: boolean;
};

type GitHubRelease = {
  id: number;
  name: string | null;
  tag_name: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
};

export const RELEASES_TAG = "next-releases";

export async function getNextReleases(): Promise<{ releases: Release[]; fetchedAt: string }> {
  "use cache";
  cacheLife("hours"); // 릴리스는 자주 안 바뀌니 1시간. 비인증 GitHub API 한도(시간당 60회)도 아낀다
  cacheTag(RELEASES_TAG);

  const res = await fetch("https://api.github.com/repos/vercel/next.js/releases?per_page=8", {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "next-js-study-app", // GitHub API 는 User-Agent 가 없으면 거부한다
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API 요청 실패: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as GitHubRelease[];
  return {
    releases: data.map((r) => ({
      id: r.id,
      name: r.name || r.tag_name,
      tag: r.tag_name,
      url: r.html_url,
      publishedAt: r.published_at,
      prerelease: r.prerelease,
    })),
    fetchedAt: new Date().toISOString(),
  };
}
