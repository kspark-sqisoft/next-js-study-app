// NavLink: usePathname 으로 "현재 섹션" 을 판단해 aria-current 를 붙이는 클라이언트 컴포넌트.
// next/navigation 은 실제 라우터가 있어야 동작하므로 vi.mock 으로 경로만 흉내 낸다.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const { NavLink } = await import("./nav-link");

describe("<NavLink />", () => {
  it("현재 경로와 같은 섹션이면 aria-current=page 와 활성 클래스가 붙는다", () => {
    pathname = "/posts/3";
    render(<NavLink href="/posts" activeClassName="is-active">글</NavLink>);
    const link = screen.getByRole("link", { name: "글" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveClass("is-active");
  });

  it("다른 섹션이면 아무것도 붙지 않는다", () => {
    pathname = "/posts/3";
    render(<NavLink href="/todos" activeClassName="is-active">할 일</NavLink>);
    const link = screen.getByRole("link", { name: "할 일" });
    expect(link).not.toHaveAttribute("aria-current");
    expect(link).not.toHaveClass("is-active");
  });

  it("exact 이면 정확히 같은 경로에서만 활성 (홈 링크가 /posts 에서 켜지지 않게)", () => {
    pathname = "/posts";
    render(<NavLink href="/" exact activeClassName="is-active">홈</NavLink>);
    expect(screen.getByRole("link", { name: "홈" })).not.toHaveAttribute("aria-current");
  });

  it("접두사만 같은 경로(/posts-archive)는 /posts 로 치지 않는다", () => {
    pathname = "/posts-archive";
    render(<NavLink href="/posts" activeClassName="is-active">글</NavLink>);
    expect(screen.getByRole("link", { name: "글" })).not.toHaveAttribute("aria-current");
  });
});
