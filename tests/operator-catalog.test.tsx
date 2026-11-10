import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../admin/src/App";
import "../admin/src/i18n";
import { platform } from "../admin/src/lib/platform";
import { usePlatformStore } from "../admin/src/store/usePlatformStore";

function refreshAppStore() {
  usePlatformStore.getState().refresh(platform.getState());
}

async function openCatalog() {
  platform.setCurrentUser("operator-ray");
  refreshAppStore();
  window.location.hash = "#/operator/catalog";
  render(<App />);
  await screen.findByRole("heading", { level: 1, name: "课程管理" });
}

describe("operator course catalog", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
  });

  it("shows subjects, courses and lifecycle without a scheduling entry", async () => {
    await openCatalog();

    expect(within(screen.getByRole("navigation")).getByRole("link", { name: "课程管理" })).toBeInTheDocument();
    expect(screen.queryByText("自由课程目录")).not.toBeInTheDocument();
    expect(screen.queryByText("从此课节排课")).not.toBeInTheDocument();
    const subjectRail = within(document.querySelector(".course-subject-rail") as HTMLElement);
    expect(subjectRail.getByRole("button", { name: "中文" })).toBeInTheDocument();
    expect(subjectRail.getByRole("button", { name: "编辑科目 中文" })).toBeInTheDocument();
    const deleteSubject = subjectRail.getByRole("button", { name: "删除科目 中文" });
    expect(deleteSubject).toBeEnabled();
    fireEvent.click(deleteSubject);
    const deleteNotice = await screen.findByRole("dialog", { name: "无法删除科目" });
    expect(within(deleteNotice).getByText(/还有 \d+ 门课程/)).toBeInTheDocument();
    fireEvent.click(within(deleteNotice).getByRole("button", { name: "知道了" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "无法删除科目" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "展开课程 校园与生活" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开课程 中文社团" })).toBeInTheDocument();
  });

  it("expands course lessons in place and collapses them again", async () => {
    await openCatalog();
    fireEvent.click(screen.getByRole("button", { name: "展开课程 校园与生活" }));

    expect(screen.getByRole("heading", { level: 1, name: "课程管理" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "校园与生活的课节" })).toBeInTheDocument();
    expect(screen.queryByText(/该课程已被班级或内容引用/)).not.toBeInTheDocument();
    expect(screen.getByText("认识新朋友")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "返回课程列表" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "新建课节 校园与生活" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "调整课节顺序 认识新朋友" })).toHaveAttribute("draggable", "true");

    fireEvent.click(screen.getByRole("button", { name: "收起课程 校园与生活" }));
    expect(screen.queryByText("认识新朋友")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "新建课节 校园与生活" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开课程 校园与生活" })).toBeInTheDocument();
  });

  it("explains referenced content and offers disable instead of a dead delete button", async () => {
    await openCatalog();
    fireEvent.click(screen.getByRole("button", { name: "展开课程 问候与时间" }));
    fireEvent.click(screen.getByRole("button", { name: "删除课节 嗨！你好！" }));

    const lessonDialog = await screen.findByRole("dialog", { name: "无法删除课节" });
    expect(within(lessonDialog).getByText(/正在被使用/)).toBeInTheDocument();
    expect(lessonDialog.querySelector(".catalog-reference-grid")).toHaveTextContent("3 排课课次");
    expect(lessonDialog.querySelector(".catalog-reference-grid")).toHaveTextContent("6 互动内容");
    expect(lessonDialog.querySelector(".catalog-reference-grid")).toHaveTextContent("4 学习资料");
    expect(within(lessonDialog).queryByRole("button", { name: "确认删除" })).not.toBeInTheDocument();
    expect(within(lessonDialog).getByRole("button", { name: "停用课节" })).toBeInTheDocument();
    fireEvent.click(within(lessonDialog).getByRole("button", { name: "取消" }));

    const referencedCourseRow = screen.getByRole("button", { name: "收起课程 问候与时间" }).closest(".course-list-row") as HTMLElement;
    fireEvent.click(within(referencedCourseRow).getByLabelText("更多课程操作 问候与时间"));
    fireEvent.click(within(referencedCourseRow).getByRole("menuitem", { name: "删除课程" }));
    const courseDialog = await screen.findByRole("dialog", { name: "无法删除课程" });
    expect(courseDialog.querySelector(".catalog-reference-grid")).toHaveTextContent("4 排课课次");
    expect(courseDialog.querySelector(".catalog-reference-grid")).toHaveTextContent("7 互动内容");
    expect(courseDialog.querySelector(".catalog-reference-grid")).toHaveTextContent("7 学习资料");
    expect(within(courseDialog).queryByRole("button", { name: "确认删除" })).not.toBeInTheDocument();

    fireEvent.click(within(courseDialog).getByRole("button", { name: "停用课程" }));
    await waitFor(() => {
      expect(platform.getState().folders.find((course) => course.id === "folder-greetings")?.status).toBe("disabled");
      expect(screen.queryByRole("dialog", { name: "无法删除课程" })).not.toBeInTheDocument();
    });
  });

  it("deletes an unreferenced course through the normal confirmation", async () => {
    const subject = platform.createSubject({ name: "临时科目" });
    const course = platform.createCourse({ subjectId: subject.data!.id, name: "临时待删课程" });
    await openCatalog();

    const courseRow = screen.getByRole("button", { name: "展开课程 临时待删课程" }).closest(".course-list-row") as HTMLElement;
    fireEvent.click(within(courseRow).getByLabelText("更多课程操作 临时待删课程"));
    fireEvent.click(within(courseRow).getByRole("menuitem", { name: "删除课程" }));
    const dialog = await screen.findByRole("dialog", { name: "删除课程" });
    expect(within(dialog).getByText("确定删除“临时待删课程”吗？")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "确认删除" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "确认删除" }));

    await waitFor(() => {
      expect(platform.getState().folders.some((item) => item.id === course.data!.id)).toBe(false);
      expect(screen.queryByRole("dialog", { name: "删除课程" })).not.toBeInTheDocument();
    });
  });

  it("keeps multiple courses open and dismisses course menus on outside click or Escape", async () => {
    await openCatalog();

    fireEvent.click(screen.getByRole("button", { name: "展开课程 校园与生活" }));
    fireEvent.click(screen.getByRole("button", { name: "展开课程 旅行中文" }));
    expect(screen.getByRole("region", { name: "校园与生活的课节" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "旅行中文的课节" })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("更多课程操作 校园与生活"));
    expect(document.querySelector(".course-row-menu[open]")).not.toBeNull();
    fireEvent.pointerDown(document.body);
    expect(document.querySelector(".course-row-menu[open]")).toBeNull();

    fireEvent.click(screen.getByLabelText("更多课程操作 旅行中文"));
    expect(document.querySelector(".course-row-menu[open]")).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelector(".course-row-menu[open]")).toBeNull();
  });

  it("creates a subject, course and lesson without exposing lifecycle controls", async () => {
    await openCatalog();
    expect(screen.queryByRole("combobox", { name: "课程状态" })).not.toBeInTheDocument();
    expect(document.querySelector(".course-catalog-table-head")?.textContent).not.toContain("状态");
    expect(document.querySelector(".course-catalog-table .badge")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /新增科目/ }));
    const subjectDialog = await screen.findByRole("dialog", { name: "新增科目" });
    expect(within(subjectDialog).queryByText("科目颜色")).not.toBeInTheDocument();
    fireEvent.change(within(subjectDialog).getByLabelText("科目名称"), { target: { value: "英语" } });
    fireEvent.change(within(subjectDialog).getByLabelText("科目说明"), { target: { value: "英语拓展课程" } });
    fireEvent.click(within(subjectDialog).getByRole("button", { name: "创建科目" }));

    await waitFor(() => {
      expect(platform.getState().subjects.some((subject) => subject.name === "英语")).toBe(true);
    });

    fireEvent.click(document.querySelector(".course-catalog-create") as HTMLElement);
    const courseDialog = await screen.findByRole("dialog", { name: "新建课程" });
    expect(within(courseDialog).queryByText("课程颜色")).not.toBeInTheDocument();
    fireEvent.change(within(courseDialog).getByLabelText("课程名称"), { target: { value: "英语口语" } });
    fireEvent.change(within(courseDialog).getByLabelText("课程说明"), { target: { value: "日常口语表达" } });
    fireEvent.click(within(courseDialog).getByRole("button", { name: "创建课程" }));

    expect(await screen.findByRole("button", { name: "收起课程 英语口语" })).toHaveAttribute("aria-expanded", "true");
    const createdCourse = platform.getState().folders.find((course) => course.name === "英语口语")!;
    expect(createdCourse.status).toBe("published");

    fireEvent.click(screen.getByRole("button", { name: "新建课节 英语口语" }));
    const lessonDialog = await screen.findByRole("dialog", { name: "新建课节" });
    expect(within(lessonDialog).queryByText("主题色")).not.toBeInTheDocument();
    expect(within(lessonDialog).queryByText("封面表情")).not.toBeInTheDocument();
    fireEvent.change(within(lessonDialog).getByLabelText("课节标题"), { target: { value: "自我介绍" } });
    fireEvent.click(within(lessonDialog).getByRole("button", { name: "创建课节" }));

    await waitFor(() => {
      expect(platform.getState().lessons.some((lesson) => lesson.folderId === createdCourse.id && lesson.title === "自我介绍")).toBe(true);
    });
    const createdLesson = platform.getState().lessons.find((lesson) => lesson.folderId === createdCourse.id)!;
    expect(createdLesson.status).toBe("published");

    const lessonRow = screen.getByText("自我介绍").closest(".course-lesson-table-row") as HTMLElement;
    expect(within(lessonRow).getByRole("button", { name: "编辑课节 自我介绍" })).toBeEnabled();
    expect(within(lessonRow).getByRole("button", { name: "删除课节 自我介绍" })).toBeEnabled();
    expect(within(lessonRow).queryByLabelText("更多课节操作 自我介绍")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("更多课程操作 英语口语"));
    expect(screen.queryByRole("menuitem", { name: /发布课程|停用课程/ })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "编辑课程" })).toBeInTheDocument();
  });
});
