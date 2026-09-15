// 작성자·사용자 아바타. 파일이 있으면 원형 이미지, 없으면 이름 첫 글자를 원형 배지로 보여 준다.
//
// "use client" 도, server-only 모듈 import 도 없다. 서버 컴포넌트(글 목록, 댓글)와 클라이언트 컴포넌트
// (무한 스크롤 목록) 양쪽에서 쓰기 때문이다. 그래서 URL 접두사(/api/uploads/)를 lib/uploads.ts 에서 가져오지 않고 여기 적는다.
// 이미지는 next/image 를 쓰지 않고 <img> 로 둔다. 20~80px 원형 썸네일이라 최적화 비용이 이득보다 크다.
import { cn } from "@/lib/utils";

const SIZES = {
  xs: "size-5 text-[10px]",
  sm: "size-6 text-xs",
  md: "size-9 text-sm",
  lg: "size-20 text-2xl",
} as const;

type Props = {
  name: string | null | undefined;
  avatarPath: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
};

export function Avatar({ name, avatarPath, size = "sm", className }: Props) {
  const sizeClass = SIZES[size];

  if (avatarPath) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 작은 원형 썸네일은 원본 그대로 (next/image 는 글 본문 이미지에서)
      <img
        src={`/api/uploads/${avatarPath}`}
        alt={name ?? ""}
        className={cn("shrink-0 rounded-full bg-muted object-cover", sizeClass, className)}
      />
    );
  }

  // 이름 첫 글자. 작성자가 없는 글(샘플)은 "?"
  const initial = name?.trim().charAt(0) || "?";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary select-none",
        sizeClass,
        className,
      )}
    >
      {initial}
    </span>
  );
}
