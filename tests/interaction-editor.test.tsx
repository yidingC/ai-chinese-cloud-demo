import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import App from "../admin/src/App";
import "../admin/src/i18n";
import { platform } from "../admin/src/lib/platform";
import { usePlatformStore } from "../admin/src/store/usePlatformStore";

function refreshAppStore() {
  usePlatformStore.getState().refresh(platform.getState());
}

/** 打开课堂设计页（session-preview 课次）。 */
async function openDesignPage() {
  platform.setCurrentUser("teacher-berenice");
  refreshAppStore();
  window.location.hash = "#/teacher/session/session-preview/design";
  render(<App />);
  await screen.findByRole("button", { name: /新建互动/ });
}

describe("interaction editor", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
  });

  it("no longer embeds the student preview inside the editor modal", async () => {
    await openDesignPage();
    fireEvent.click(screen.getByRole("button", { name: /新建互动/ }));
    const dialog = await screen.findByRole("dialog", { name: "新建互动" });

    expect(within(dialog).queryByRole("heading", { name: "学生端预览" })).not.toBeInTheDocument();
    expect(dialog.querySelector(".student-preview-card")).toBeNull();
    expect(dialog.querySelector(".student-preview-phone")).toBeNull();

    // 题目卡片仍保留「编辑中」高亮：新增的题目自动成为当前编辑项，点回上一题也能切回来。
    fireEvent.click(within(dialog).getByRole("button", { name: "排序" }));
    const cards = dialog.querySelectorAll(".editor-item-card");
    expect(cards).toHaveLength(2);
    expect(cards[1].className).toContain("is-active");
    expect(cards[1].textContent).toContain("编辑中");

    fireEvent.click(cards[0].querySelector("header") as HTMLElement);
    const refreshed = dialog.querySelectorAll(".editor-item-card");
    expect(refreshed[0].className).toContain("is-active");
    expect(refreshed[0].textContent).toContain("编辑中");
  });

  it("renames a round inline and hides redundant round controls", async () => {
    await openDesignPage();
    const titleInput = screen
      .getAllByRole("textbox")
      .find((input) => input.getAttribute("aria-label")?.startsWith("轮次名称："))!;
    const originalTitle = (titleInput as HTMLInputElement).value;
    const targetSet = platform.getState().interactionSets.find((set) => set.title === originalTitle)!;

    expect(screen.queryByText("2 题 · 全课次共用")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /配置轮次/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /编辑轮次/ })).not.toBeInTheDocument();

    fireEvent.change(titleInput, { target: { value: "打招呼热身" } });
    fireEvent.blur(titleInput);

    const renamed = platform.getState().interactionSets.find((set) => set.id === targetSet.id)!;
    expect(renamed.title).toBe("打招呼热身");
  });

  it("opens with the classroom interaction demo and an explicit save action", async () => {
    await openDesignPage();

    expect(screen.getByDisplayValue("破冰快问")).toBeInTheDocument();
    expect(screen.getByDisplayValue("词语配对")).toBeInTheDocument();
    expect(screen.getByDisplayValue("介绍自己")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByRole("button", { name: "已保存" })).toBeInTheDocument();
  });
});
