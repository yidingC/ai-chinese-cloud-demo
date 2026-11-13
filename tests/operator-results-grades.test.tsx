import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../admin/src/App";
import "../admin/src/i18n";
import { platform } from "../admin/src/lib/platform";
import { usePlatformStore } from "../admin/src/store/usePlatformStore";

function refreshAppStore() {
  usePlatformStore.getState().refresh(platform.getState());
}

describe("operator results and grades", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
  });

  it("shows the two result entries in the operator sidebar", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/grades";
    render(<App />);

    expect(await screen.findByRole("link", { name: "课堂表现" })).toHaveAttribute("href", "#/operator/results");
    expect(screen.getByRole("link", { name: "学生成绩" })).toHaveAttribute("href", "#/operator/grades");
  });

  it("defaults the operator gradebook to the first school and scopes data when switching", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/grades";
    const { container } = render(<App />);

    expect(await screen.findByRole("heading", { name: "学生成绩" })).toBeInTheDocument();
    expect(screen.queryByText("只读查看")).not.toBeInTheDocument();
    const schoolSelect = await screen.findByRole("combobox", { name: "学校范围" });
    expect(schoolSelect).toHaveValue("school-sacred-heart");
    expect(within(schoolSelect).queryByRole("option", { name: "全部学校" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "印尼圣心学校学生成绩明细" })).toBeInTheDocument();

    const classSelect = screen.getByLabelText("按班级筛选");
    const filterLabels = Array.from(
      container.querySelectorAll<HTMLElement>(".results-filter-bar select, .results-filter-bar input")
    ).map((control) => control.getAttribute("aria-label"));
    expect(filterLabels).toEqual(["学校范围", "按班级筛选", "统计时间范围"]);
    const summaryCard = screen.getByRole("heading", { name: "印尼圣心学校学生成绩明细" }).closest(".grade-table-card") as HTMLElement;
    expect(within(summaryCard).getByLabelText("搜索学生或等级")).toBeInTheDocument();
    expect(within(classSelect).getByRole("option", { name: "印尼圣心学校7年级A班" })).toBeInTheDocument();

    fireEvent.change(schoolSelect, { target: { value: "school-hope" } });

    await waitFor(() => expect(window.location.hash).toContain("school=school-hope"));
    expect(await screen.findByRole("heading", { name: "印尼希望学校学生成绩明细" })).toBeInTheDocument();
    const nextClassSelect = screen.getByLabelText("按班级筛选");
    expect(within(nextClassSelect).queryByRole("option", { name: "印尼圣心学校7年级A班" })).not.toBeInTheDocument();
    expect(within(nextClassSelect).getByRole("option", { name: "印尼希望学校7年级体验班" })).toBeInTheDocument();
  });

  it("opens an operator classroom performance deep link and keeps the school after switching", async () => {
    const state = platform.getState();
    const ended = state.sessions
      .filter(
        (session) =>
          session.schoolId === "school-sacred-heart"
          && session.status === "published"
          && new Date(session.endAt).getTime() < Date.now()
      )
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())[0];

    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = `#/operator/results?school=school-sacred-heart&sessionId=${ended.id}`;
    const { container } = render(<App />);

    expect(await screen.findByRole("heading", { name: "课堂表现" })).toBeInTheDocument();
    expect(screen.queryByText("只读查看")).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 2, name: ended.title })).toBeInTheDocument();
    const schoolSelect = await screen.findByRole("combobox", { name: "学校范围" });
    expect(schoolSelect).toHaveValue("school-sacred-heart");
    expect(screen.getByRole("combobox", { name: "选择课次" })).toHaveValue(ended.id);
    const filterLabels = Array.from(
      container.querySelectorAll<HTMLElement>(".results-filter-bar select, .results-filter-bar input")
    ).map((control) => control.getAttribute("aria-label"));
    expect(filterLabels).toEqual(["学校范围", "选择班级", "选择课次", "搜索课次"]);
    expect(screen.queryByRole("combobox", { name: "按时间筛选" })).not.toBeInTheDocument();
    expect(container.querySelector(".analytics-session-nav")).toBeNull();
    await waitFor(() => expect(window.location.hash).not.toContain("sessionId"));
    expect(window.location.hash).toContain("school=school-sacred-heart");

    fireEvent.change(schoolSelect, { target: { value: "school-hope" } });

    await waitFor(() => expect(window.location.hash).toContain("school=school-hope"));
    expect(await screen.findByRole("combobox", { name: "学校范围" })).toHaveValue("school-hope");
    expect(await screen.findByText("本校暂无已结束课次")).toBeInTheDocument();
  });

  it("defaults classroom performance to the school-wide summary", async () => {
    const state = platform.getState();
    const completed = state.sessions.filter(
      (session) =>
        session.schoolId === "school-sacred-heart"
        && session.status === "published"
        && new Date(session.endAt).getTime() < Date.now()
    );
    const completedClassIds = new Set(completed.map((session) => session.classId));

    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/results?school=school-sacred-heart";
    render(<App />);

    expect(await screen.findByRole("heading", { level: 2, name: "印尼圣心学校 · 全校汇总" })).toBeInTheDocument();
    const classSelect = await screen.findByRole("combobox", { name: "选择班级" });
    expect(classSelect).toHaveValue("__school_aggregate__");
    expect(within(classSelect).getByRole("option", { name: "全校汇总" })).toBeInTheDocument();
    const sessionSelect = screen.getByRole("combobox", { name: "选择课次" });
    expect(sessionSelect).toHaveValue("__all_sessions__");
    expect(within(sessionSelect).getByRole("option", { name: "课次汇总（全部课次）" })).toBeInTheDocument();
    expect(screen.getByText(`共 ${completed.length} 个课次`)).toBeInTheDocument();
    expect(screen.getByText(`${completedClassIds.size} 个班级`)).toBeInTheDocument();
  });

  it("groups classroom performance by class and supports class-wide aggregation", async () => {
    const initialState = platform.getState();
    const seededCompleted = initialState.sessions
      .filter(
        (session) =>
          session.schoolId === "school-sacred-heart"
          && session.status === "published"
          && new Date(session.endAt).getTime() < Date.now()
      )
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
    const targetSession = seededCompleted[0];
    const extraStart = new Date(Date.now() - 3 * 86400000);
    extraStart.setHours(9, 0, 0, 0);
    const extraSession = platform.createSession({
      title: "班级汇总补充课",
      lessonId: "lesson-greetings",
      teacherId: targetSession.teacherId,
      classId: targetSession.classId,
      startAt: extraStart.toISOString(),
      endAt: new Date(extraStart.getTime() + 40 * 60_000).toISOString(),
      capacity: targetSession.capacity,
      actorId: "operator-ray"
    });
    expect(extraSession.ok).toBe(true);

    const state = platform.getState();
    const completed = state.sessions
      .filter(
        (session) =>
          session.schoolId === "school-sacred-heart"
          && session.status === "published"
          && new Date(session.endAt).getTime() < Date.now()
      )
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
    const classGroups = new Map<string, { classId: string; className: string; sessions: typeof completed }>();
    completed.forEach((session) => {
      const group = classGroups.get(session.classId) ?? {
        classId: session.classId,
        className: session.className,
        sessions: []
      };
      group.sessions.push(session);
      classGroups.set(session.classId, group);
    });
    const repeatedClass = [...classGroups.values()].find((group) => group.sessions.length > 1);
    expect(repeatedClass).toBeDefined();
    const schoolName = state.schools.find((school) => school.id === "school-sacred-heart")!.name;
    const shortClassName = repeatedClass!.className.replace(schoolName, "").trim();

    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/results?school=school-sacred-heart";
    render(<App />);

    expect(await screen.findByRole("heading", { name: "课堂表现" })).toBeInTheDocument();
    const classSelect = await screen.findByRole("combobox", { name: "选择班级" });
    expect(within(classSelect).getByRole("option", { name: shortClassName })).toBeInTheDocument();
    expect(within(classSelect).queryByRole("option", { name: repeatedClass!.className })).not.toBeInTheDocument();
    fireEvent.change(classSelect, { target: { value: repeatedClass!.classId } });

    expect(
      await screen.findByRole("heading", { level: 2, name: `${shortClassName} · 课次汇总` })
    ).toBeInTheDocument();
    const sessionSelect = screen.getByRole("combobox", { name: "选择课次" });
    expect(sessionSelect).toHaveValue("__all_sessions__");
    expect(within(sessionSelect).getByRole("option", { name: "课次汇总（全部课次）" })).toBeInTheDocument();
    expect(screen.getByText(`共 ${repeatedClass!.sessions.length} 个课次`)).toBeInTheDocument();

    fireEvent.change(sessionSelect, { target: { value: repeatedClass!.sessions[0].id } });
    expect(
      await screen.findByRole("heading", { level: 2, name: repeatedClass!.sessions[0].title })
    ).toBeInTheDocument();

    fireEvent.change(sessionSelect, { target: { value: "__class_aggregate__" } });
    expect(
      await screen.findByRole("heading", { level: 2, name: `${shortClassName} · 课次汇总` })
    ).toBeInTheDocument();
  });

  it("keeps classroom performance focused on session participation", async () => {
    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/results?school=school-sacred-heart";
    render(<App />);

    expect(await screen.findByRole("heading", { name: "课堂表现" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "成绩概览" })).not.toBeInTheDocument();
    expect(screen.queryByText("综合均分")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "班级成绩对比" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "选择课次" })).toBeInTheDocument();
  });

  it("shows class grade analysis on the student grades page", async () => {
    const state = platform.getState();
    const firstClass = state.classes.find(
      (item) => item.schoolId === "school-sacred-heart" && item.status === "active"
    );
    expect(firstClass).toBeTruthy();

    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = "#/operator/grades?school=school-sacred-heart";
    const { container } = render(<App />);

    expect(await screen.findByRole("heading", { name: "学生成绩" })).toBeInTheDocument();
    expect(await screen.findByText("综合均分")).toBeInTheDocument();
    expect(screen.getByText("互动均分")).toBeInTheDocument();
    expect(screen.getByText("作业均分")).toBeInTheDocument();
    expect(screen.getByText("考试均分")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "成绩趋势" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "能力雷达" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "成绩构成" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "选择课次" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "印尼圣心学校学生成绩明细" })).toBeInTheDocument();

    const gradeFilterLabels = Array.from(
      container.querySelectorAll<HTMLElement>(".results-filter-bar select, .results-filter-bar input")
    ).map((control) => control.getAttribute("aria-label"));
    expect(gradeFilterLabels).toEqual(["学校范围", "按班级筛选", "统计时间范围"]);
    const summaryCard = screen.getByRole("heading", { name: "印尼圣心学校学生成绩明细" }).closest(".grade-table-card") as HTMLElement;
    expect(within(summaryCard).getByLabelText("搜索学生或等级")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("按班级筛选"), { target: { value: firstClass!.id } });

    expect(
      await screen.findByRole("heading", { name: `${firstClass!.name}学生成绩明细` })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "成绩趋势" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "能力雷达" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "成绩构成" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "选择课次" })).not.toBeInTheDocument();
  });

  it("opens operator classroom performance from an ended scheduling card", async () => {
    const state = platform.getState();
    const ended = state.sessions
      .filter(
        (session) =>
          session.schoolId === "school-sacred-heart"
          && session.status === "published"
          && new Date(session.endAt).getTime() < Date.now()
      )
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())[0];

    platform.setCurrentUser("operator-ray");
    refreshAppStore();
    window.location.hash = `#/operator/scheduling?focus=${ended.id}`;
    const { container } = render(<App />);

    expect(await screen.findByRole("heading", { name: "课次排课" })).toBeInTheDocument();
    const card = container.querySelector(`[data-session-id="${ended.id}"]`) as HTMLElement;
    expect(card).not.toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: "课堂表现" }));

    expect(await screen.findByRole("heading", { name: "课堂表现" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 2, name: ended.title })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "选择课次" })).toHaveValue(ended.id);
    expect(window.location.hash).toContain("/operator/results?");
    expect(window.location.hash).toContain("school=school-sacred-heart");
  });

  it("does not show a school selector in the academic gradebook", async () => {
    platform.setCurrentUser("academic-shengxin");
    refreshAppStore();
    window.location.hash = "#/academic/grades";
    render(<App />);

    expect(await screen.findByRole("heading", { name: "学生成绩" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "学校范围" })).not.toBeInTheDocument();
  });
});
