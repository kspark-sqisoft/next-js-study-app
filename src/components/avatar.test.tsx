// Avatar: 아바타 파일이 있으면 이미지, 없으면 이름 첫 글자를 원형으로 보여 준다.
// 서버·클라이언트 컴포넌트 양쪽에서 쓰이므로 server-only 모듈을 import 하지 않는다.
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "./avatar";

describe("<Avatar />", () => {
  it("avatarPath 가 있으면 /api/uploads/ 이미지를 그린다", () => {
    render(<Avatar name="박기순" avatarPath="abc.jpg" />);
    const img = screen.getByRole("img", { name: "박기순" });
    expect(img).toHaveAttribute("src", "/api/uploads/abc.jpg");
  });

  it("avatarPath 가 없으면 이름 첫 글자를 보여 준다", () => {
    render(<Avatar name="박기순" avatarPath={null} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("박")).toBeInTheDocument();
  });

  it("이름이 없으면(작성자 없음) 물음표를 보여 준다", () => {
    render(<Avatar name={null} avatarPath={null} />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});
