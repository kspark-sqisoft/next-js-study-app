// 컴포넌트 테스트 (React Testing Library).
// PostForm 은 action 을 props 로 받으므로, 서버 없이 가짜 액션을 넘겨 "에러 표시 / 초기값" 을 검증한다.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostForm } from "./post-form";
import type { PostFormState } from "./actions";

describe("<PostForm />", () => {
  it("initial 값을 입력창에 채운다", () => {
    render(<PostForm action={async () => null} initial={{ title: "제목", content: "내용" }} submitLabel="저장" />);
    expect(screen.getByLabelText("제목")).toHaveValue("제목");
    expect(screen.getByLabelText("내용")).toHaveValue("내용");
    expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
  });

  it("액션이 필드별 에러를 돌려주면 각 입력 아래에 표시한다", async () => {
    const action = vi.fn(async (): Promise<PostFormState> => ({
      errors: { title: ["제목을 입력하세요."], content: ["내용을 입력하세요."] },
      fields: { title: "", content: "" },
    }));
    render(<PostForm action={action} submitLabel="작성" />);

    await userEvent.click(screen.getByRole("button", { name: "작성" }));

    expect(await screen.findByText("제목을 입력하세요.")).toBeInTheDocument();
    expect(screen.getByText("내용을 입력하세요.")).toBeInTheDocument();
    expect(screen.getByLabelText("제목")).toHaveAttribute("aria-invalid", "true");
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("폼 전체 에러(form)도 표시한다", async () => {
    const action = async (): Promise<PostFormState> => ({ errors: { form: ["본인이 작성한 글만 수정할 수 있습니다."] } });
    render(<PostForm action={action} submitLabel="저장" />);
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText("본인이 작성한 글만 수정할 수 있습니다.")).toBeInTheDocument();
  });
});
