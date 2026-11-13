import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../admin/src/App";
import "../admin/src/i18n";
import { platform } from "../admin/src/lib/platform";
import { setTeacherDemoMode } from "../admin/src/lib/teacherLiveDemo";
import { usePlatformStore } from "../admin/src/store/usePlatformStore";

function refreshAppStore() {
  usePlatformStore.getState().refresh(platform.getState());
}

describe("grade pages and role routes", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  afterEach(() => {
    cleanup();
    setTeacherDemoMode("live");
    window.location.hash = "";
  });

  it("shows the teacher student-grades page and sidebar entry", async () => {
    platform.setCurrentUser("teacher-lina");
    refreshAppStore();
    window.location.hash = "#/teacher/grades";
    const { container } = render(<App />);
    expect(await screen.findByRole("heading", { name: "学生成绩" })).toBeInTheDocument();
    expect(screen.getAllByText("学生成绩").some((node) => node.tagName === "SPAN")).toBe(true);
    const sidebar = document.querySelector(".sidebar-nav") as HTMLElement;
    expect(Array.from(sidebar.querySelectorAll("a > span")).map((node) => node.textContent)).toEqual([
      "首页",
      "我的课表",
      "课程结果",
      "学生成绩",
      "材料库",
      "互动库",
      "消息"
    ]);
    expect(sidebar.querySelectorAll(".sidebar-nav-group")).toHaveLength(5);
    expect(screen.getByRole("heading", { name: "学生成绩明细" })).toBeInTheDocument();
    expect(screen.getByText("综合均分")).toBeInTheDocument();
    expect(screen.getByText("互动均分")).toBeInTheDocument();
    expect(screen.getByText("作业均分")).toBeInTheDocument();
    expect(screen.getByText("考试均分")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "成绩趋势" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "能力雷达" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "成绩构成" })).toBeInTheDocument();
    const studentTableHead = Array.from(
      container.querySelectorAll<HTMLElement>(".grade-student-table .data-table-head span")
    ).map((node) => node.textContent);
    expect(studentTableHead).toEqual(["学生", "班级", "综合", "互动", "作业", "考试", "状态"]);
    expect(screen.queryByText("课程")).not.toBeInTheDocument();
    expect(screen.queryByText("问候复习课")).not.toBeInTheDocument();
    expect(screen.getAllByText("印尼圣心学校7年级A班").length).toBeGreaterThan(0);
    expect(screen.queryByText("周三晚 A 班 / 印尼圣心学校7年级A班")).not.toBeInTheDocument();
  });

  it("keeps the grade overview independent from the student detail search", async () => {
    platform.setCurrentUser("teacher-lina");
    refreshAppStore();
    window.location.hash = "#/teacher/grades";
    render(<App />);

    const summaryHeading = await screen.findByRole("heading", { name: "学生成绩明细" });
    const summaryCard = summaryHeading.closest(".grade-table-card") as HTMLElement;
    const filterBar = document.querySelector(".grade-filter-bar") as HTMLElement;
    const statGrid = document.querySelector(".stat-grid") as HTMLElement;
    expect(filterBar.querySelector("input")).toBeNull();
    expect(within(summaryCard).getByLabelText("搜索学生或等级")).toBeInTheDocument();
    expect(within(summaryCard).getByText("5 位学生")).toBeInTheDocument();
    expect(within(statGrid).getByText("79.3")).toBeInTheDocument();
    expect(within(statGrid).getByText("5 位学生")).toBeInTheDocument();

    const interactionTab = screen.getByRole("tab", { name: /互动练习/ });
    const interactionTabCount = interactionTab.querySelector("span")?.textContent;
    fireEvent.change(within(summaryCard).getByLabelText("搜索学生或等级"), { target: { value: "Raymond" } });

    expect(within(summaryCard).getByText("匹配 1 位学生 / 共 5 位学生")).toBeInTheDocument();
    expect(summaryCard.querySelectorAll(".grade-student-table .data-table-row")).toHaveLength(1);
    expect(within(statGrid).getByText("79.3")).toBeInTheDocument();
    expect(within(statGrid).getByText("5 位学生")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /互动练习/ }).querySelector("span")?.textContent).toBe(interactionTabCount);

    fireEvent.click(screen.getByRole("tab", { name: /互动练习/ }));
    const interactionHeading = await screen.findByRole("heading", { name: "全部学生互动练习表现" });
    const interactionCard = interactionHeading.closest(".grade-table-card") as HTMLElement;
    expect(within(interactionCard).getByLabelText("搜索学生或等级")).toHaveValue("Raymond");
    expect(within(interactionCard).getByText(/匹配 1 位学生 \/ 共 \d+ 位学生/)).toBeInTheDocument();

    fireEvent.change(within(interactionCard).getByLabelText("搜索学生或等级"), { target: { value: "不存在" } });
    expect(within(interactionCard).getByText("没有匹配的学生")).toBeInTheDocument();
  });

  it("keeps materials and interactions as separate teacher libraries", async () => {
    platform.setCurrentUser("teacher-lina");
    refreshAppStore();
    window.location.hash = "#/teacher/materials";
    render(<App />);

    expect(await screen.findByRole("heading", { name: "材料库" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /我的互动轮次/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /互动模板库/ })).not.toBeInTheDocument();
  });

  it("opens the interaction library with rounds and templates", async () => {
    platform.setCurrentUser("teacher-lina");
    refreshAppStore();
    window.location.hash = "#/teacher/interactions";
    render(<App />);

    expect(await screen.findByRole("heading", { name: "互动库" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /我的互动轮次/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /互动模板库/ })).toBeInTheDocument();
  });

  it("groups template rounds by teaching scenario and reuses the whole round", async () => {
    platform.setCurrentUser("teacher-lina");
    refreshAppStore();
    window.location.hash = "#/teacher/interactions";
    render(<App />);

    fireEvent.click(await screen.findByRole("tab", { name: /互动模板库/ }));
    expect(screen.getByLabelText("教学场景")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /破冰热身/ })).toBeInTheDocument();

    const title = screen.getAllByRole("heading", { name: "问候与寒暄" })[0];
    const card = title.closest(".round-template-card") as HTMLElement;
    expect(card).toHaveTextContent("破冰热身");
    expect(card).toHaveTextContent("4 题");
    expect(within(card).getByRole("button", { name: /复用这一轮/ })).toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: /复用这一轮/ }));
    const editorDialog = await screen.findByRole("dialog", { name: "新建互动" });
    expect(within(editorDialog).getByRole("heading", { name: "题目编辑" })).toBeInTheDocument();
    expect(within(editorDialog).getByLabelText("互动标题")).toHaveValue("问候与寒暄 · 破冰热身");
    expect(within(editorDialog).queryByText("这是公共模板母版，当前只读")).not.toBeInTheDocument();
    expect(within(editorDialog).queryByRole("button", { name: "添加题目" })).not.toBeInTheDocument();
    expect(within(editorDialog).queryByRole("button", { name: "保存本题" })).not.toBeInTheDocument();

    const libraryCount = platform.getState().interactionSets.filter((set) => set.scope === "library").length;
    fireEvent.click(within(editorDialog).getByRole("button", { name: "保存到我的互动库" }));

    const ownCopyDialog = await screen.findByRole("dialog", { name: "编辑题目" });
    expect(within(ownCopyDialog).queryByText("已保存到我的互动库")).not.toBeInTheDocument();
    expect(within(ownCopyDialog).getByRole("button", { name: "添加题目" })).toBeInTheDocument();
    expect(within(ownCopyDialog).getByRole("button", { name: "保存本题" })).toBeInTheDocument();
    expect(within(ownCopyDialog).getByRole("button", { name: "保存更改" })).toBeInTheDocument();
    const copiedSets = platform.getState().interactionSets.filter((set) => set.scope === "library");
    expect(copiedSets).toHaveLength(libraryCount + 1);
    expect(copiedSets.some((set) => set.title === "问候与寒暄 · 破冰热身" && set.origin === "library")).toBe(true);
  });

  it("shows a multi-question interaction as one round", async () => {
    platform.setCurrentUser("teacher-lina");
    refreshAppStore();
    window.location.hash = "#/teacher/interactions";
    render(<App />);

    const heading = await screen.findByRole("heading", { name: "餐厅点餐 · 预习热身" });
    const card = heading.closest(".interaction-manage-card") as HTMLElement;
    expect(card).toHaveTextContent("3 道题 · 3 种题型");
    expect(within(card).getByRole("button", { name: /编辑/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /预习/ })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /课前/ })).not.toBeInTheDocument();
  });

  it("copies a library round to selected upcoming sessions", async () => {
    platform.setCurrentUser("teacher-lina");
    refreshAppStore();
    window.location.hash = "#/teacher/interactions";
    render(<App />);

    const heading = await screen.findByRole("heading", { name: "餐厅点餐 · 预习热身" });
    const card = heading.closest(".interaction-manage-card") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: /复制到课次/ }));

    const dialog = await screen.findByRole("dialog", { name: /复制到课次/ });
    expect(within(dialog).queryByText("目标课节")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("整个课节")).not.toBeInTheDocument();
    expect(within(dialog).getByText("待上课次")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("checkbox", { name: /时间表达 · 满员演练课/ }));
    expect(within(dialog).getByText("已选 1 节课次")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "复制到 1 节课次" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /复制到课次/ })).not.toBeInTheDocument());

    fireEvent.click(within(card).getByRole("button", { name: /复制到课次/ }));
    const reopened = await screen.findByRole("dialog", { name: /复制到课次/ });
    expect(within(reopened).getByRole("checkbox", { name: /时间表达 · 满员演练课.*已复制/ })).toBeDisabled();
  });

  it("keeps the classroom action primary on every teacher schedule card", async () => {
    platform.setCurrentUser("teacher-lina");
    refreshAppStore();
    window.location.hash = "#/teacher/schedule";
    const { container } = render(<App />);

    expect(await screen.findByRole("heading", { name: "我的课表" })).toBeInTheDocument();
    const cards = [...container.querySelectorAll<HTMLElement>(".teacher-session-list .operator-session-card")];
    expect(cards.length).toBeGreaterThan(1);

    cards.forEach((card) => {
      const primary = card.querySelector<HTMLButtonElement>(".operator-session-actions .button-primary");
      const design = card.querySelector<HTMLButtonElement>(".operator-session-actions .button-soft");
      expect(primary?.textContent).toMatch(/进入课堂|查看结果/);
      expect(design?.textContent).toMatch(/备课/);
    });
  });

  it("updates the student summary title when a class is selected", async () => {
    platform.setCurrentUser("teacher-lina");
    refreshAppStore();
    window.location.hash = "#/teacher/grades";
    render(<App />);

    const classOption = await screen.findByRole("option", { name: "印尼圣心学校7年级A班" }) as HTMLOptionElement;
    fireEvent.change(screen.getByLabelText("按班级筛选"), { target: { value: classOption.value } });
    expect(await screen.findByRole("heading", { name: "印尼圣心学校7年级A班学生成绩明细" })).toBeInTheDocument();
  });

  it("shows per-student analytics and teacher-facing status labels", async () => {
    platform.setCurrentUser("teacher-lina");
    refreshAppStore();
    window.location.hash = "#/teacher/grades";
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Raymond/ }));
    const dialog = await screen.findByRole("dialog", { name: "Raymond · 成绩详情" });
    expect(within(dialog).getByRole("img", { name: "六维能力雷达图" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "成绩趋势" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "成绩构成" })).toBeInTheDocument();
    expect(within(dialog).getByText("分数均经过归一化计算")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("tab", { name: /作业/ }));
    expect(await within(dialog).findByText("周末复习 · 第 3 次作业")).toBeInTheDocument();
    expect(within(dialog).getByText("已录入")).toBeInTheDocument();
    expect(within(dialog).getByText("待录入")).toBeInTheDocument();
    expect(within(dialog).getByText("缺交")).toBeInTheDocument();
    expect(within(dialog).queryByText("已批改")).not.toBeInTheDocument();
  });

  it("separates teacher records into interaction, homework, and exam tabs", async () => {
    platform.setCurrentUser("teacher-lina");
    refreshAppStore();
    window.location.hash = "#/teacher/grades";
    render(<App />);

    expect(await screen.findByRole("tab", { name: /互动练习/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "学生维度" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /作业/ }));
    expect(screen.getByRole("button", { name: "学生维度" })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("全部学生作业表现")).toBeInTheDocument();
    expect(screen.getByText("已录入")).toBeInTheDocument();
    expect(screen.getByText("缺交")).toBeInTheDocument();
    expect(screen.queryByText("待录入")).not.toBeInTheDocument();
    expect(screen.queryByText("免做")).not.toBeInTheDocument();
    expect(screen.queryByText("缺考")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Raymond/ }));
    const homeworkDialog = await screen.findByRole("dialog", { name: "Raymond · 成绩详情" });
    expect(within(homeworkDialog).getByRole("tab", { name: /作业/ })).toHaveAttribute("aria-selected", "true");
    expect(within(homeworkDialog).getByText("周末复习 · 第 3 次作业")).toBeInTheDocument();
    fireEvent.click(within(homeworkDialog).getByRole("button", { name: "关闭" }));

    fireEvent.click(screen.getByRole("tab", { name: /考试/ }));
    expect(await screen.findByText("全部学生考试表现")).toBeInTheDocument();
    expect(screen.getByText("缺考")).toBeInTheDocument();
    expect(screen.queryByText("待录入")).not.toBeInTheDocument();
    expect(screen.queryByText("免考")).not.toBeInTheDocument();
    expect(screen.queryByText("缺交")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /互动练习/ }));
    const interactionPanel = (await screen.findByText("全部学生互动练习表现")).closest(".grade-table-card") as HTMLElement;
    // 角色预览下拉里也有学生姓名，这里限定在互动练习表格内断言。
    expect(within(interactionPanel).getByText("Anisa")).toBeInTheDocument();
    expect(screen.getByText("完成互动")).toBeInTheDocument();
    expect(screen.getByText("平均用时")).toBeInTheDocument();
    expect(screen.queryByText("互动体验 · 八大新题型")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "内容维度" }));
    expect(await screen.findByText("互动体验 · 八大新题型")).toBeInTheDocument();
    expect(screen.getAllByText(/按范围内最佳一次成绩统计/).length).toBeGreaterThan(0);
    const interactionCard = (await screen.findByText("互动体验 · 八大新题型")).closest(".grade-assessment-card") as HTMLElement;
    expect(within(interactionCard).getByText("完成学生均分")).toBeInTheDocument();
    expect(within(interactionCard).getByText("完成人数").closest("div")).toHaveTextContent(/\d+\/\d+/);

    fireEvent.click(screen.getByRole("tab", { name: /作业/ }));
    expect(await screen.findByText("周末复习 · 第 3 次作业")).toBeInTheDocument();
    const homeworkCard = screen.getByText("周末复习 · 第 3 次作业").closest(".grade-assessment-card") as HTMLElement;
    expect(within(homeworkCard).getByText("本次作业均分")).toBeInTheDocument();
    expect(within(homeworkCard).getByText(/缺交按 0 分/)).toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole("button", { name: "按题目查看" }))[0]);
    const accuracyDialog = await screen.findByRole("dialog", { name: "题目正确率" });
    expect(within(accuracyDialog).getByText("本次均分")).toBeInTheDocument();
    expect(within(accuracyDialog).getByText("听音选择")).toBeInTheDocument();
    expect(within(accuracyDialog).getByText("听力理解")).toBeInTheDocument();
    expect(within(accuracyDialog).getByText(/演示口径/)).toBeInTheDocument();
    fireEvent.click(within(accuracyDialog).getByRole("button", { name: "关闭" }));

    fireEvent.click(screen.getByRole("tab", { name: /考试/ }));
    expect(await screen.findByText("周测 · 问候与餐厅表达")).toBeInTheDocument();
    const examCard = screen.getByText("周测 · 问候与餐厅表达").closest(".grade-assessment-card") as HTMLElement;
    expect(within(examCard).getByText("本次考试均分")).toBeInTheDocument();
    expect(within(examCard).getByText(/缺考按 0 分/)).toBeInTheDocument();
  });

  it("keeps the teacher dashboard focused on the current task and today's remaining schedule", async () => {
    setTeacherDemoMode("live");
    platform.setCurrentUser("teacher-lina");
    refreshAppStore();
    window.location.hash = "#/teacher";
    render(<App />);

    expect(await screen.findByRole("heading", { name: /今天有 \d+ 节课/ })).toBeInTheDocument();
    expect(screen.getByText("正在进行中")).toBeInTheDocument();
    expect(screen.getByText("去上课")).toBeInTheDocument();
    expect(screen.queryByText("当前互动")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "下一节课程" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "最近课程结果" })).not.toBeInTheDocument();
    expect(screen.queryByText("本周课堂")).not.toBeInTheDocument();
    expect(screen.queryByText("预约学生")).not.toBeInTheDocument();
  });

  it("uses the next lesson as the only primary task when no class is in progress", async () => {
    setTeacherDemoMode("empty");
    platform.setCurrentUser("teacher-lina");
    refreshAppStore();
    window.location.hash = "#/teacher";
    render(<App />);

    expect(await screen.findByText("下一节课")).toBeInTheDocument();
    const nextBanner = document.querySelector(".teacher-next-banner") as HTMLElement;
    expect(within(nextBanner).getByRole("button", { name: /备课/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "下一节课程" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "最近课程结果" })).not.toBeInTheDocument();
    expect(screen.queryByText("本周课堂")).not.toBeInTheDocument();
  });

  it("keeps the live room available after the class has ended", async () => {
    setTeacherDemoMode("live");
    platform.setCurrentUser("teacher-berenice");
    platform.startSession({ sessionId: "session-8b-past", actorId: "teacher-berenice" });
    platform.endSession({ sessionId: "session-8b-past", actorId: "teacher-berenice" });
    refreshAppStore();
    window.location.hash = "#/teacher/live/session-8b-past";
    render(<App />);

    expect(await screen.findByRole("button", { name: "查看完整课堂结果" })).toBeInTheDocument();
    expect(screen.queryByText("本课已结束")).not.toBeInTheDocument();
    expect(screen.queryByText("待完成轮次")).not.toBeInTheDocument();
    expect(document.querySelector(".live-class-room-card")).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "进入直播间" })).toHaveLength(1);
    expect(screen.getByText("课堂流程")).toBeInTheDocument();
    expect(document.querySelector(".live-class-workspace-grid")).not.toBeNull();
    expect(document.querySelector(".live-class-flow-list")).not.toBeNull();
    expect(screen.getAllByText("情景演练 · 看图与对话").length).toBeGreaterThan(0);
    expect(screen.queryByText("课堂动态")).not.toBeInTheDocument();
    expect(screen.queryByText("实时互动进度")).not.toBeInTheDocument();
    expect(screen.queryByText("当前正确率")).not.toBeInTheDocument();
    expect(screen.queryByText("平均分")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "进入直播间" }));
    const liveRoom = await screen.findByRole("dialog", { name: "课堂直播间" });
    expect(within(liveRoom).getByRole("tab", { name: /课堂课件/ })).toBeInTheDocument();
    expect(within(liveRoom).getByRole("button", { name: "上一页" })).toBeInTheDocument();
    expect(within(liveRoom).getByRole("button", { name: "下一页" })).toBeInTheDocument();
    expect(within(liveRoom).queryByRole("button", { name: "关闭" })).not.toBeInTheDocument();
    fireEvent.click(within(liveRoom).getByRole("button", { name: "退出全屏" }));
    expect(screen.queryByRole("dialog", { name: "课堂直播间" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "返回我的课表" }));
    await waitFor(() => expect(window.location.hash).toContain("/teacher/schedule"));
    expect(await screen.findByRole("heading", { name: "我的课表" })).toBeInTheDocument();
  });

  it("links upcoming classes into the focused schedule and opens the calendar from a date", async () => {
    setTeacherDemoMode("live");
    platform.setCurrentUser("teacher-berenice");
    refreshAppStore();
    window.location.hash = "#/teacher";
    render(<App />);

    const firstUpcoming = await waitFor(() => {
      const row = document.querySelector<HTMLButtonElement>(".teacher-upcoming-list > button");
      expect(row).not.toBeNull();
      return row!;
    });
    fireEvent.click(firstUpcoming);

    await waitFor(() => expect(window.location.hash).toContain("/teacher/schedule"));
    expect(await screen.findByRole("heading", { name: "我的课表" })).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector(".operator-session-card.is-focused")).toBeTruthy());

    fireEvent.click(screen.getByRole("link", { name: "首页" }));
    expect(await screen.findByRole("heading", { name: /今天有 \d+ 节课|今天没有排课/ })).toBeInTheDocument();

    const classDay = document.querySelector<HTMLButtonElement>(".teacher-mini-calendar-day.has-class:not(.today)");
    expect(classDay).not.toBeNull();
    fireEvent.click(classDay!);

    await waitFor(() => expect(window.location.hash).toContain("/teacher/schedule"));
    expect(await screen.findByRole("dialog", { name: "课程日历" })).toBeInTheDocument();
  });

  it("shows the student grade statistics page", async () => {
    platform.setCurrentUser("student-anisa");
    refreshAppStore();
    window.location.hash = "#/student/grades";
    render(<App />);
    expect(await screen.findByRole("heading", { name: "成绩统计" })).toBeInTheDocument();
    expect(screen.getByLabelText("开始日期")).toBeInTheDocument();
    expect(screen.getByLabelText("结束日期")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /互动练习/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /作业/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /考试/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "能力雷达" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Radar kemampuan enam dimensi" })).toBeInTheDocument();
    expect(screen.getByText("分数均经过归一化计算")).toBeInTheDocument();
    expect(screen.getByText(/项待公布/)).toBeInTheDocument();
    expect(screen.getAllByText("听力").length).toBeGreaterThan(0);
    expect(screen.getAllByText("口语").length).toBeGreaterThan(0);
    expect(screen.getAllByText("拼音").length).toBeGreaterThan(0);
    expect(screen.getAllByText("阅读").length).toBeGreaterThan(0);
    const radarTooltip = screen.getByRole("tooltip");
    expect(screen.getByRole("button", { name: "查看题型与能力维度对照" })).toBeInTheDocument();
    expect(within(radarTooltip).getByText("题型与能力维度对照")).toBeInTheDocument();
    expect(within(radarTooltip).getAllByText("听力").length).toBeGreaterThan(0);
    expect(within(radarTooltip).getByText("听音选图 / 选词")).toBeInTheDocument();
    expect(within(radarTooltip).getByText("投票")).toBeInTheDocument();
    expect(within(radarTooltip).getByText("不计入能力雷达")).toBeInTheDocument();
  });

  it("shows the student classroom performance page from the results route", async () => {
    platform.setCurrentUser("student-anisa");
    refreshAppStore();
    window.location.hash = "#/student/results";
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Performa kelas" })).toBeInTheDocument();
    expect(window.location.hash).toBe("#/student/results");

    const sidebar = document.querySelector(".sidebar-nav") as HTMLElement;
    expect(Array.from(sidebar.querySelectorAll("a > span")).map((node) => node.textContent)).toEqual([
      "Beranda",
      "Jadwal saya",
      "Performa kelas",
      "Statistik nilai",
      "Notifikasi"
    ]);
    expect(sidebar.querySelectorAll(".sidebar-nav-group")).toHaveLength(4);
  });

  it("uses student-facing status labels for homework records", async () => {
    platform.setCurrentUser("student-raymond");
    refreshAppStore();
    window.location.hash = "#/student/grades";
    render(<App />);

    fireEvent.click(await screen.findByRole("tab", { name: /作业/ }));
    expect(await screen.findByText("周末复习 · 第 3 次作业")).toBeInTheDocument();
    expect(screen.getByText("缺交")).toBeInTheDocument();
    expect(screen.getByText("已批改")).toBeInTheDocument();
    expect(screen.queryByText("缺考")).not.toBeInTheDocument();
    expect(screen.queryByText("已录入")).not.toBeInTheDocument();
    expect(screen.queryByText("待录入")).not.toBeInTheDocument();
  });

  it("keeps the teacher course results workspace working after the shared analytics refactor", async () => {
    const state = platform.getState();
    const completed = state.sessions
      .filter(
        (session) =>
          session.teacherId === "teacher-lina"
          && new Date(session.endAt).getTime() < Date.now()
      )
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())[0];

    platform.setCurrentUser("teacher-lina");
    refreshAppStore();
    window.location.hash = "#/teacher/results";
    render(<App />);

    expect(await screen.findByRole("heading", { name: "课程结果" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 2, name: completed.title })).toBeInTheDocument();
    expect(screen.queryByText("只读查看")).not.toBeInTheDocument();
  });
});
