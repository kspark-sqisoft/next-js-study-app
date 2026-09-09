# next-js-study-app

Next.js 학습용 프로젝트 뼈대.

## 스택

- Next.js 16 (App Router, Turbopack)
- TypeScript
- Tailwind CSS v4
- shadcn/ui (style: base-nova, base color: neutral, icons: lucide)
- ESLint

## 실행

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

## shadcn/ui 컴포넌트 추가

```bash
npx shadcn@latest add <component>   # 예: npx shadcn@latest add table
```

설치된 컴포넌트는 `src/components/ui/` 에 생성됩니다.
현재 포함: button, card, input, label, badge, separator, dialog, dropdown-menu, sonner

## 구조

```
src/
  app/            # 라우트 (App Router)
    layout.tsx
    page.tsx
    globals.css   # Tailwind + shadcn 테마 변수
  components/ui/  # shadcn/ui 컴포넌트
  lib/utils.ts    # cn() 헬퍼
```
