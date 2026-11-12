import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../admin/src/App";
import "../admin/src/i18n";
import { platform } from "../admin/src/lib/platform";
import { sessionMaterials } from "../admin/src/lib/domain";
import { orderMaterialTags } from "../admin/src/lib/materialTags";
import { usePlatformStore } from "../admin/src/store/usePlatformStore";

function refreshAppStore() {
  usePlatformStore.getState().refresh(platform.getState());
}

describe("material lesson configuration", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
  });

  it("uploads a material into the library without forcing a lesson link", async () => {
    platform.setCurrentUser("teacher-lina");
    refreshAppStore();
    window.location.hash = "#/teacher/materials";
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "上传材料" }));
    const dialog = await screen.findByRole("dialog", { name: "上传材料" });
    expect(within(dialog).getByLabelText("材料标题")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("材料说明")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("文件类型")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("语言")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("标签")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("关联课节")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("学习阶段")).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("材料标题"), { target: { value: "新上传材料" } });
    const tagInput = within(dialog).getByLabelText("标签");
    fireEvent.change(tagInput, { target: { value: "文化" } });
    fireEvent.keyDown(tagInput, { key: "Enter" });
    fireEvent.change(tagInput, { target: { value: "口语，课堂" } });
    fireEvent.keyDown(tagInput, { key: "，" });
    fireEvent.change(tagInput, { target: { value: "复习" } });
    fireEvent.keyDown(tagInput, { key: "Enter" });
    expect(within(dialog).getByRole("button", { name: "移除标签 文化" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "移除标签 口语" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "移除标签 课堂" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "移除标签 复习" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "上传材料" }));

    await waitFor(() => {
      const material = platform.getState().materials.find((item) => item.title === "新上传材料");
      expect(material).toBeTruthy();
      expect(material!.tags).toEqual(["复习", "文化", "口语", "课堂"]);
      expect(platform.getState().materialRefs.some((ref) => ref.materialId === material!.id)).toBe(false);
    });
  });

  it("filters library materials by tags and shows tags on cards and details", async () => {
    platform.setCurrentUser("teacher-lina");
    refreshAppStore();
    window.location.hash = "#/teacher/materials";
    render(<App />);

    const tagGroup = await screen.findByRole("group", { name: "按标签筛选" });
    const tagChip = (name: string) => within(tagGroup).getByRole("button", { name: new RegExp(`^${name}`) });
    const usageGroup = within(tagGroup).getByRole("group", { name: "按用途标签筛选" });
    const topicGroup = within(tagGroup).getByRole("group", { name: "按主题标签筛选" });
    expect(within(usageGroup).getAllByRole("button").slice(1).map((button) => button.textContent?.replace(/\d+$/u, ""))).toEqual([
      "预习",
      "课堂使用",
      "复习"
    ]);
    expect(within(topicGroup).queryByRole("button", { name: /^预习/ })).not.toBeInTheDocument();
    expect(tagChip("问候").textContent).toContain("3");
    expect(tagChip("时间").textContent).toContain("3");

    fireEvent.click(tagChip("问候"));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "查看" })).toHaveLength(3));
    expect(screen.getByText("课前词汇卡：你好、早上好、再见")).toBeInTheDocument();
    expect(screen.queryByText("现在几点？· 互动课件")).not.toBeInTheDocument();

    fireEvent.click(tagChip("时间"));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "查看" })).toHaveLength(6));
    expect(screen.getByText("现在几点？· 互动课件")).toBeInTheDocument();

    fireEvent.click(tagChip("全部标签"));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "查看" })).toHaveLength(7));

    const viewButton = screen.getAllByRole("button", { name: "查看" })[0];
    const card = viewButton.closest("article") as HTMLElement;
    const title = card.querySelector(".material-title-row strong")?.textContent ?? "";
    const material = platform.getState().materials.find((item) => item.title === title)!;
    const cardTags = within(card).getByLabelText("材料标签");
    orderMaterialTags(material.tags).slice(0, 3).forEach((tag) => expect(cardTags).toHaveTextContent(tag));
    expect(cardTags.textContent).toMatch(/^预习/u);

    fireEvent.click(viewButton);
    const dialog = await screen.findByRole("dialog", { name: `材料详情 · ${title}` });
    expect(within(dialog).getByText("标签")).toBeInTheDocument();
    material.tags.forEach((tag) => expect(within(dialog).getAllByText(tag).length).toBeGreaterThan(0));
    expect(dialog.querySelector(".material-detail-tags span")?.textContent).toBe("预习");
  });

  it("filters library materials by multiple file types", async () => {
    platform.setCurrentUser("teacher-lina");
    refreshAppStore();
    window.location.hash = "#/teacher/materials";
    render(<App />);

    const group = await screen.findByRole("group", { name: "按文件类型筛选" });
    const chip = (name: string) => within(group).getByRole("button", { name: new RegExp(`^${name}`) });
    expect(chip("PDF").textContent).toContain("2");
    expect(chip("音频").textContent).toContain("2");
    expect(chip("视频外链").textContent).toContain("1");
    expect(screen.getAllByRole("button", { name: "查看" })).toHaveLength(7);

    fireEvent.click(chip("PDF"));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "查看" })).toHaveLength(2));
    expect(screen.getByText("课前词汇卡：你好、早上好、再见")).toBeInTheDocument();
    expect(screen.queryByText("课后跟读音频")).not.toBeInTheDocument();

    // 多选：PDF + 音频 → 4 张卡
    fireEvent.click(chip("音频"));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "查看" })).toHaveLength(4));
    expect(screen.getByText("课后跟读音频")).toBeInTheDocument();
    expect(screen.queryByText("情境视频：初次见面")).not.toBeInTheDocument();

    // 取消 PDF 只剩音频
    fireEvent.click(chip("PDF"));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "查看" })).toHaveLength(2));
    expect(screen.getByText("时间句型跟读音频")).toBeInTheDocument();

    // 点“全部类型”清空
    fireEvent.click(chip("全部类型"));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "查看" })).toHaveLength(7));

    // 叠加关键词筛选到无结果时给出空状态，可一键清除
    fireEvent.click(chip("视频外链"));
    fireEvent.change(screen.getByPlaceholderText("搜索材料名称或说明"), { target: { value: "不存在的材料" } });
    expect(await screen.findByText("没有匹配的材料")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "查看" })).toHaveLength(7));
  });

  it("opens the material detail dialog from 查看 and keeps an icon-only download", async () => {
    platform.setCurrentUser("teacher-lina");
    refreshAppStore();
    window.location.hash = "#/teacher/materials";
    render(<App />);

    const viewButtons = await screen.findAllByRole("button", { name: "查看" });
    expect(viewButtons.length).toBeGreaterThan(0);
    const card = viewButtons[0].closest("article") as HTMLElement;
    const title = card.querySelector(".material-title-row strong")?.textContent ?? "";
    const material = platform.getState().materials.find((item) => item.title === title)!;

    expect(within(card).getByRole("button", { name: `下载 ${title}` })).toBeInTheDocument();
    const cardTags = within(card).getByLabelText("材料标签");
    orderMaterialTags(material.tags).slice(0, 3).forEach((tag) => expect(cardTags).toHaveTextContent(tag));
    expect(within(card).queryByRole("button", { name: /配置到课节/ })).not.toBeInTheDocument();

    fireEvent.click(viewButtons[0]);
    const dialog = await screen.findByRole("dialog", { name: `材料详情 · ${title}` });
    expect(within(dialog).getByText("文件类型")).toBeInTheDocument();
    expect(within(dialog).getByText("文件大小")).toBeInTheDocument();
    expect(within(dialog).queryByText("版本")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("下载次数")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("已配置课节")).not.toBeInTheDocument();
    expect(within(dialog).getByText("标签")).toBeInTheDocument();
    material.tags.forEach((tag) => expect(within(dialog).getAllByText(tag).length).toBeGreaterThan(0));
    expect(within(dialog).queryByRole("button", { name: "下载" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /配置到课节/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "在新窗口打开" })).not.toBeInTheDocument();
  });

});

describe("material configuration reaches the student session", () => {
  beforeEach(() => {
    platform.resetDemo();
    platform.setCurrentUser("teacher-lina");
  });

  it("only shows the material in the configured unstarted session of the lesson", () => {
    const state = platform.getState();
    const template = state.sessions.find((item) => item.id === "session-live")!;
    const material = state.materials[0];
    const start = new Date(Date.now() + 180 * 86_400_000);
    start.setHours(10, 0, 0, 0);
    const siblingStart = new Date(start.getTime() + 2 * 86_400_000);

    const created = platform.createSession({
      title: "材料配置测试课",
      lessonId: "lesson-greetings",
      teacherId: "teacher-lina",
      classId: template.classId,
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + 40 * 60_000).toISOString(),
      capacity: template.capacity,
      actorId: "operator-ray"
    });
    expect(created.ok).toBe(true);
    const siblingCreated = platform.createSession({
      title: "材料配置对照课",
      lessonId: "lesson-greetings",
      teacherId: "teacher-lina",
      classId: template.classId,
      startAt: siblingStart.toISOString(),
      endAt: new Date(siblingStart.getTime() + 40 * 60_000).toISOString(),
      capacity: template.capacity,
      actorId: "operator-ray"
    });
    expect(siblingCreated.ok).toBe(true);

    const result = platform.attachMaterial({
      materialId: material.id,
      lessonId: "lesson-greetings",
      phase: "live",
      sessionIds: [created.data!.id],
      actorId: "teacher-lina"
    });
    expect(result.ok).toBe(true);

    const after = platform.getState();
    const target = after.sessions.find((item) => item.id === created.data!.id)!;
    expect(sessionMaterials(after, target, "live").some((item) => item.material?.id === material.id)).toBe(true);

    const sibling = after.sessions.find((item) => item.id === siblingCreated.data!.id)!;
    expect(sessionMaterials(after, sibling, "live").some((item) => item.material?.id === material.id)).toBe(false);
    expect(after.auditEvents.some((event) => event.action === "attach_material" && event.targetId === material.id)).toBe(true);
  });
});
