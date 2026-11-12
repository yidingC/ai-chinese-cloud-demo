import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

/** 打开教师互动库。 */
async function openInteractionLibrary() {
  platform.setCurrentUser("teacher-lina");
  refreshAppStore();
  window.location.hash = "#/teacher/interactions";
  render(<App />);
  await screen.findByRole("heading", { name: "互动库" });
}

describe("interaction editor", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
  });

  it("opens in design view and keeps editing behavior unchanged", async () => {
    await openDesignPage();
    fireEvent.click(screen.getByRole("button", { name: /新建互动/ }));
    const dialog = await screen.findByRole("dialog", { name: "新建互动" });

    expect(within(dialog).getByRole("tab", { name: "设计" })).toHaveAttribute("aria-selected", "true");
    expect(dialog.querySelector(".editor-preview-view")).toBeNull();

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

  it("opens card preview and question editing in separate modals", async () => {
    await openInteractionLibrary();

    fireEvent.click(screen.getAllByRole("button", { name: /预览/ })[0]);
    const previewDialog = await screen.findByRole("dialog", { name: "编辑互动" });
    expect(within(previewDialog).getByRole("tab", { name: "学生预览" })).toHaveAttribute("aria-selected", "true");
    expect(previewDialog.querySelector(".editor-preview-view")).not.toBeNull();
    expect(previewDialog.querySelector(".student-preview-phone")).not.toBeNull();

    fireEvent.click(within(previewDialog).getByRole("button", { name: "返回设计" }));
    expect(within(previewDialog).getByRole("tab", { name: "设计" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(within(previewDialog).getByRole("button", { name: "关闭" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "编辑互动" })).not.toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button", { name: "编辑题目" })[0]);

    const editorDialog = await screen.findByRole("dialog", { name: "编辑题目" });
    expect(within(editorDialog).getByRole("heading", { name: "题目编辑" })).toBeInTheDocument();
    expect(within(editorDialog).queryByText("计入学生成绩")).not.toBeInTheDocument();
    expect(window.location.hash).toBe("#/teacher/interactions");

    fireEvent.click(within(editorDialog).getByRole("button", { name: /保存并发布/ }));
    expect(await within(editorDialog).findByRole("button", { name: /已保存/ })).toBeInTheDocument();
  });

  it("updates interaction settings without creating a question version", async () => {
    await openInteractionLibrary();
    const targetSet = platform.getState().interactionSets.find((set) => set.scope === "library")!;
    const versionCount = platform
      .getState()
      .interactionVersions.filter((version) => version.setId === targetSet.id).length;

    fireEvent.click(screen.getByRole("button", { name: `互动设置 ${targetSet.title}` }));
    const dialog = await screen.findByRole("dialog", { name: "互动设置" });

    fireEvent.change(within(dialog).getByLabelText("互动标题"), { target: { value: "餐厅点餐复习" } });
    fireEvent.change(within(dialog).getByLabelText(/阶段/), { target: { value: "review" } });
    fireEvent.change(within(dialog).getByLabelText(/标签/), { target: { value: "餐厅，复习" } });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /计入学生成绩/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "保存设置" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "互动设置" })).not.toBeInTheDocument());
    const updated = platform.getState().interactionSets.find((set) => set.id === targetSet.id)!;
    expect(updated.title).toBe("餐厅点餐复习");
    expect(updated.phase).toBe("review");
    expect(updated.tags).toEqual(["餐厅", "复习"]);
    expect(updated.countsTowardGrade).toBe(false);
    expect(platform.getState().interactionVersions.filter((version) => version.setId === targetSet.id)).toHaveLength(versionCount);
    expect(await screen.findByRole("heading", { name: "餐厅点餐复习" })).toBeInTheDocument();
  });

  it("creates a library interaction through the shared settings and question editor", async () => {
    await openInteractionLibrary();

    fireEvent.click(screen.getByRole("button", { name: "新建互动" }));
    const settingsDialog = await screen.findByRole("dialog", { name: "新建互动" });
    fireEvent.change(within(settingsDialog).getByLabelText("互动标题"), { target: { value: "餐厅点餐 · 新建演练" } });
    fireEvent.change(within(settingsDialog).getByLabelText(/阶段/), { target: { value: "live" } });
    fireEvent.change(within(settingsDialog).getByLabelText(/标签/), { target: { value: "餐厅，演练" } });
    fireEvent.click(within(settingsDialog).getByRole("button", { name: "下一步：编辑题目" }));

    const editorDialog = await screen.findByRole("dialog", { name: "新建互动 · 编辑题目" });
    expect(within(editorDialog).getByRole("heading", { name: "题目编辑" })).toBeInTheDocument();
    fireEvent.change(within(editorDialog).getByLabelText("添加题目"), { target: { value: "choice" } });
    fireEvent.click(within(editorDialog).getByRole("button", { name: /保存并发布/ }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "新建互动 · 编辑题目" })).not.toBeInTheDocument());
    const created = platform
      .getState()
      .interactionSets.find((set) => set.scope === "library" && set.title === "餐厅点餐 · 新建演练");
    expect(created).toBeTruthy();
    expect(created?.phase).toBe("live");
    expect(created?.tags).toEqual(["餐厅", "演练"]);
    const version = platform.getState().interactionVersions.find((item) => item.id === created?.currentVersionId);
    expect(version?.items).toHaveLength(1);
    expect(await screen.findByRole("heading", { name: "餐厅点餐 · 新建演练" })).toBeInTheDocument();
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
