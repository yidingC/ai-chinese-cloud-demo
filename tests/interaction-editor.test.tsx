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

  it("edits an existing question inline and saves it manually without opening a modal", async () => {
    await openDesignPage();
    const firstQuestion = document.querySelector(".design-round-question-main") as HTMLElement;
    fireEvent.click(firstQuestion);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const prompt = await screen.findByLabelText("题目说明");
    fireEvent.change(prompt, { target: { value: "第一次见面的新题干" } });
    fireEvent.blur(prompt);

    expect(
      platform
        .getState()
        .interactionVersions.some((version) => version.items.some((item) => item.prompt === "第一次见面的新题干"))
    ).toBe(false);
    expect(screen.getByText("有未保存修改")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "保存本题" }));

    await waitFor(() => {
      const saved = platform
        .getState()
        .interactionVersions.some((version) =>
          version.status === "published" && version.items.some((item) => item.prompt === "第一次见面的新题干")
        );
      expect(saved).toBe(true);
    });
  });

  it("switches question type, previews the draft, and saves the conversion manually", async () => {
    await openDesignPage();
    const firstQuestion = document.querySelector(".design-round-question-main") as HTMLElement;
    fireEvent.click(firstQuestion);

    const prompt = await screen.findByLabelText("题目说明") as HTMLTextAreaElement;
    const originalPrompt = prompt.value;
    const sourceItem = platform
      .getState()
      .interactionVersions.flatMap((version) => version.items)
      .find((item) => item.prompt === originalPrompt)!;
    expect(sourceItem.type).toBe("choice");

    fireEvent.click(screen.getByRole("button", { name: "更换题型" }));
    fireEvent.click(screen.getByRole("option", { name: "看图单选" }));
    expect(screen.getByText("有未保存修改")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "预览本题" }));
    const previewDialog = await screen.findByRole("dialog", { name: /学生端预览/ });
    expect(within(previewDialog).getAllByText("看图单选").length).toBeGreaterThan(0);
    fireEvent.click(within(previewDialog).getByRole("button", { name: "关闭" }));

    fireEvent.click(screen.getByRole("button", { name: "保存本题" }));
    await waitFor(() => {
      const updated = platform
        .getState()
        .interactionVersions.flatMap((version) => version.items)
        .filter((item) => item.id === sourceItem.id)
        .at(-1);
      expect(updated?.type).toBe("picture");
      expect(updated?.prompt).toBe(originalPrompt);
      expect(updated?.choices?.length).toBeGreaterThan(0);
    });
  });

  it("creates a round inline, adds a question from the type picker, and edits it on the page", async () => {
    await openDesignPage();

    fireEvent.click(screen.getByRole("button", { name: /新建互动轮次/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const titleInput = screen
      .getAllByPlaceholderText("轮次主题")
      .find((input) => (input as HTMLInputElement).value === "")!;
    fireEvent.change(titleInput, { target: { value: "课堂新轮次" } });
    fireEvent.blur(titleInput);
    const card = screen.getByDisplayValue("课堂新轮次").closest(".design-round-card") as HTMLElement;
    expect(card).toBeTruthy();

    fireEvent.click(within(card).getByRole("button", { name: /加题/ }));
    expect(screen.getByRole("heading", { name: "选择题型" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /单选 \/ 多选/ }));
    const prompt = await screen.findByLabelText("题目说明");
    fireEvent.change(prompt, { target: { value: "新轮次里的第一题" } });
    fireEvent.click(screen.getByRole("button", { name: "保存本题" }));

    await waitFor(() => {
      const created = platform.getState().interactionSets.find((set) => set.title === "课堂新轮次");
      expect(created).toBeTruthy();
      const version = platform.getState().interactionVersions.find((item) => item.id === created?.currentVersionId);
      expect(version?.items.some((item) => item.prompt === "新轮次里的第一题")).toBe(true);
    });
    const created = platform.getState().interactionSets.find((set) => set.title === "课堂新轮次")!;
    expect(created.scope).toBe("lesson");
    expect(created.phase).toBe("live");
    expect(created.sessionIds).toEqual(["session-preview"]);
  });

  it("merges the two existing-content entries and keeps the new-round action on the right", async () => {
    await openDesignPage();

    const actionLabels = Array.from(document.querySelectorAll(".design-panel-actions button")).map((button) => button.textContent ?? "");
    expect(actionLabels.findIndex((label) => label.includes("添加已有互动"))).toBeLessThan(
      actionLabels.findIndex((label) => label.includes("新建互动轮次"))
    );
    expect(screen.queryByRole("button", { name: /从互动库添加/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /从模板库选用/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /添加已有互动/ }));
    const dialog = await screen.findByRole("dialog", { name: /添加已有互动/ });
    expect(within(dialog).getByRole("tab", { name: "我的互动库" })).toBeInTheDocument();
    expect(within(dialog).getByRole("tab", { name: "互动模板库" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("tab", { name: "互动模板库" }));
    expect(within(dialog).queryByLabelText("模板难度")).not.toBeInTheDocument();
    expect(within(dialog).getByText(/选中的模板会整轮复制成/)).toBeInTheDocument();
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

    fireEvent.click(within(editorDialog).getByRole("button", { name: "保存更改" }));
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
    expect(within(dialog).queryByRole("checkbox", { name: /计入学生成绩/ })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "保存设置" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "互动设置" })).not.toBeInTheDocument());
    const updated = platform.getState().interactionSets.find((set) => set.id === targetSet.id)!;
    expect(updated.title).toBe("餐厅点餐复习");
    expect(updated.phase).toBe("review");
    expect(updated.tags).toEqual(["餐厅", "复习"]);
    expect(platform.getState().interactionVersions.filter((version) => version.setId === targetSet.id)).toHaveLength(versionCount);
    expect(await screen.findByRole("heading", { name: "餐厅点餐复习" })).toBeInTheDocument();
  });

  it("creates a library interaction directly in the single-round editor", async () => {
    await openInteractionLibrary();

    fireEvent.click(screen.getByRole("button", { name: "新建互动" }));
    const editorDialog = await screen.findByRole("dialog", { name: "新建互动" });
    expect(within(editorDialog).getByRole("heading", { name: "互动轮次" })).toBeInTheDocument();
    expect(within(editorDialog).queryByText("新建互动轮次")).not.toBeInTheDocument();
    expect(within(editorDialog).queryByText("添加已有互动")).not.toBeInTheDocument();
    expect(within(editorDialog).queryByRole("button", { name: /另存到互动库/ })).not.toBeInTheDocument();
    expect(within(editorDialog).getByRole("heading", { name: "题目编辑" })).toBeInTheDocument();

    const titleInput = within(editorDialog).getByLabelText("互动标题");
    expect(titleInput).toHaveFocus();
    fireEvent.change(titleInput, { target: { value: "餐厅点餐 · 新建演练" } });

    fireEvent.click(within(editorDialog).getByRole("button", { name: "互动设置" }));
    const settingsDialog = await screen.findByRole("dialog", { name: "互动设置" });
    fireEvent.change(within(settingsDialog).getByLabelText(/阶段/), { target: { value: "live" } });
    fireEvent.change(within(settingsDialog).getByLabelText(/标签/), { target: { value: "餐厅，演练" } });
    fireEvent.click(within(settingsDialog).getByRole("button", { name: "保存设置" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "互动设置" })).not.toBeInTheDocument());

    fireEvent.click(within(editorDialog).getByRole("button", { name: "添加题目" }));
    fireEvent.click(within(editorDialog).getByRole("button", { name: /单选 \/ 多选/ }));
    const promptInput = within(editorDialog).getByLabelText("题目说明");
    fireEvent.change(promptInput, { target: { value: "请选择正确的问候语。" } });
    expect(within(editorDialog).getByText("有未保存修改")).toBeInTheDocument();
    fireEvent.click(within(editorDialog).getByRole("button", { name: "保存本题" }));
    await waitFor(() => expect(within(editorDialog).queryByText("有未保存修改")).not.toBeInTheDocument());
    fireEvent.click(within(editorDialog).getByRole("button", { name: "保存到我的互动库" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "新建互动" })).not.toBeInTheDocument());
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

  it("saves a blank title as an unnamed library interaction", async () => {
    await openInteractionLibrary();
    const libraryCount = platform.getState().interactionSets.filter((set) => set.scope === "library").length;

    fireEvent.click(screen.getByRole("button", { name: "新建互动" }));
    const editorDialog = await screen.findByRole("dialog", { name: "新建互动" });
    expect(within(editorDialog).getByLabelText("互动标题")).toHaveValue("");
    expect(within(editorDialog).getByRole("button", { name: "保存到我的互动库" })).toBeEnabled();

    fireEvent.click(within(editorDialog).getByRole("button", { name: "添加题目" }));
    fireEvent.click(within(editorDialog).getByRole("button", { name: /单选 \/ 多选/ }));
    fireEvent.click(within(editorDialog).getByRole("button", { name: "保存到我的互动库" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "新建互动" })).not.toBeInTheDocument());
    const librarySets = platform.getState().interactionSets.filter((set) => set.scope === "library");
    expect(librarySets).toHaveLength(libraryCount + 1);
    expect(librarySets.some((set) => set.title === "未命名互动")).toBe(true);
    expect(await screen.findByRole("heading", { name: "未命名互动" })).toBeInTheDocument();
  });

  it("deletes a library round without touching its lesson copies", async () => {
    await openInteractionLibrary();
    const before = platform.getState();
    const library = before.interactionSets.find(
      (set) => set.scope === "library" && before.interactionSets.some((copy) => copy.sourceSetId === set.id)
    );
    expect(library).toBeTruthy();
    const copiesBefore = before.interactionSets.filter((copy) => copy.sourceSetId === library!.id);
    const heading = document.querySelector(`[data-interaction-set-id="${library!.id}"]`) as HTMLElement;
    expect(heading).toBeTruthy();
    const card = heading.closest(".interaction-round-card") as HTMLElement;

    fireEvent.click(within(card).getByRole("button", { name: `删除互动 ${library!.title}` }));

    await waitFor(() => {
      expect(platform.getState().interactionSets.find((set) => set.id === library!.id)?.deletedAt).toBeTruthy();
    });
    expect(document.querySelector(`[data-interaction-set-id="${library!.id}"]`)).toBeNull();
    const copiesAfter = platform.getState().interactionSets.filter((copy) => copy.sourceSetId === library!.id);
    expect(copiesAfter).toHaveLength(copiesBefore.length);
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

  it("moves a round up and down from its header controls", async () => {
    await openDesignPage();
    const roundTitles = () =>
      Array.from(document.querySelectorAll<HTMLInputElement>(".design-round-title-input")).map((input) => input.value);

    expect(roundTitles().slice(0, 3)).toEqual(["破冰快问", "词语配对", "介绍自己"]);
    expect(screen.getByRole("button", { name: "上移轮次 破冰快问" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "下移轮次 破冰快问" }));
    await waitFor(() => expect(roundTitles().slice(0, 3)).toEqual(["词语配对", "破冰快问", "介绍自己"]));

    fireEvent.click(screen.getByRole("button", { name: "上移轮次 破冰快问" }));
    await waitFor(() => expect(roundTitles().slice(0, 3)).toEqual(["破冰快问", "词语配对", "介绍自己"]));
  });

  it("deletes rounds and questions immediately without opening a confirmation dialog", async () => {
    await openDesignPage();

    const firstRoundCard = document.querySelector(".design-round-card") as HTMLElement;
    const firstQuestionRow = firstRoundCard.querySelector(".design-round-question-row") as HTMLElement;
    const questionCountBefore = firstRoundCard.querySelectorAll(".design-round-question-row").length;

    fireEvent.click(within(firstQuestionRow).getByRole("button", { name: /删除题目/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(firstRoundCard.querySelectorAll(".design-round-question-row")).toHaveLength(questionCountBefore - 1));

    fireEvent.click(screen.getByRole("button", { name: "删除轮次 破冰快问" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByDisplayValue("破冰快问")).not.toBeInTheDocument());
  });

  it("guards unsaved edits when switching questions and can save before continuing", async () => {
    await openDesignPage();
    const questionRows = Array.from(document.querySelectorAll<HTMLElement>(".design-round-question-main"));

    fireEvent.click(questionRows[0]);
    const prompt = await screen.findByLabelText("题目说明");
    fireEvent.change(prompt, { target: { value: "切换前还没保存的题干" } });
    fireEvent.blur(prompt);
    expect(screen.getByText("有未保存修改")).toBeInTheDocument();

    fireEvent.click(questionRows[1]);
    let dialog = await screen.findByRole("dialog", { name: "有未保存的题目修改" });
    expect(within(dialog).getByText(/切换题目/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("dialog", { name: "有未保存的题目修改" })).not.toBeInTheDocument();
    expect((screen.getByLabelText("题目说明") as HTMLTextAreaElement).value).toBe("切换前还没保存的题干");

    fireEvent.click(questionRows[1]);
    dialog = await screen.findByRole("dialog", { name: "有未保存的题目修改" });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存并继续" }));

    await waitFor(() => {
      const saved = platform
        .getState()
        .interactionVersions.some((version) =>
          version.status === "published" && version.items.some((item) => item.prompt === "切换前还没保存的题干")
        );
      expect(saved).toBe(true);
    });
    expect(screen.queryByRole("dialog", { name: "有未保存的题目修改" })).not.toBeInTheDocument();
  });

  it("asks before leaving the design page and discards the draft when requested", async () => {
    await openDesignPage();
    const firstQuestion = document.querySelector(".design-round-question-main") as HTMLElement;
    fireEvent.click(firstQuestion);
    const prompt = await screen.findByLabelText("题目说明");
    fireEvent.change(prompt, { target: { value: "离开页面就丢弃的题干" } });
    fireEvent.blur(prompt);

    const scheduleLink = document.querySelector('.sidebar a[href="#/teacher/schedule"]') as HTMLAnchorElement;
    expect(scheduleLink).toBeTruthy();
    fireEvent.click(scheduleLink);

    const dialog = await screen.findByRole("dialog", { name: "有未保存的题目修改" });
    expect(within(dialog).getByText(/离开当前设计页/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "不保存并继续" }));

    await waitFor(() => expect(window.location.hash).toBe("#/teacher/schedule"));
    expect(
      platform
        .getState()
        .interactionVersions.some((version) => version.items.some((item) => item.prompt === "离开页面就丢弃的题干"))
    ).toBe(false);
  });

  it("blocks a teacher from opening another teacher's session by direct URL", async () => {
    platform.setCurrentUser("teacher-berenice");
    refreshAppStore();
    window.location.hash = "#/teacher/session/session-live/design";
    render(<App />);

    expect(await screen.findByText("无权访问该课次")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存" })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("破冰快问")).not.toBeInTheDocument();
  });

  it("opens with the classroom interaction demo and an explicit save action", async () => {
    await openDesignPage();

    expect(screen.getByDisplayValue("破冰快问")).toBeInTheDocument();
    expect(screen.getByDisplayValue("词语配对")).toBeInTheDocument();
    expect(screen.getByDisplayValue("介绍自己")).toBeInTheDocument();

    fireEvent.click(document.querySelector(".design-round-question-main") as HTMLElement);
    const prompt = await screen.findByLabelText("题目说明");
    fireEvent.change(prompt, { target: { value: "顶部保存真正写入的题干" } });
    fireEvent.blur(prompt);
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(document.querySelector(".design-save-button")?.textContent).toContain("已保存"));
    await waitFor(() => {
      const saved = platform
        .getState()
        .interactionVersions.some((version) =>
          version.status === "published" && version.items.some((item) => item.prompt === "顶部保存真正写入的题干")
        );
      expect(saved).toBe(true);
    });
  });
});
