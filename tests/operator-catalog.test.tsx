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
    expect(within(document.querySelector(".course-subject-rail") as HTMLElement).getByRole("button", { name: /中文/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开课程 校园与生活" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开课程 中文社团" })).toBeInTheDocument();
  });

  it("expands course lessons in place and collapses them again", async () => {
    await openCatalog();
    fireEvent.click(screen.getByRole("button", { name: "展开课程 校园与生活" }));

    expect(screen.getByRole("heading", { level: 1, name: "课程管理" })).toBeInTheDocument();
    expect(screen.getByText("课节标题")).toBeInTheDocument();
    expect(screen.queryByText(/该课程已被班级或内容引用/)).not.toBeInTheDocument();
    expect(screen.getByText("认识新朋友")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "返回课程列表" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "收起课程 校园与生活" }));
    expect(screen.queryByText("认识新朋友")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开课程 校园与生活" })).toBeInTheDocument();
  });

  it("creates a subject, course and lesson, then publishes them", async () => {
    await openCatalog();
    fireEvent.click(screen.getByRole("button", { name: /新增科目/ }));
    const subjectDialog = await screen.findByRole("dialog", { name: "新增科目" });
    fireEvent.change(within(subjectDialog).getByLabelText("科目名称"), { target: { value: "英语" } });
    fireEvent.change(within(subjectDialog).getByLabelText("科目说明"), { target: { value: "英语拓展课程" } });
    fireEvent.click(within(subjectDialog).getByRole("button", { name: "创建科目" }));

    await waitFor(() => {
      expect(platform.getState().subjects.some((subject) => subject.name === "英语")).toBe(true);
    });

    fireEvent.click(within(document.querySelector(".page-actions") as HTMLElement).getByRole("button", { name: /新建课程/ }));
    const courseDialog = await screen.findByRole("dialog", { name: "新建课程" });
    fireEvent.change(within(courseDialog).getByLabelText("课程名称"), { target: { value: "英语口语" } });
    fireEvent.change(within(courseDialog).getByLabelText("课程说明"), { target: { value: "日常口语表达" } });
    fireEvent.click(within(courseDialog).getByRole("button", { name: "创建课程" }));

    expect(await screen.findByRole("button", { name: "收起课程 英语口语" })).toHaveAttribute("aria-expanded", "true");
    const createdCourse = platform.getState().folders.find((course) => course.name === "英语口语")!;
    expect(createdCourse.status).toBe("draft");

    fireEvent.click(screen.getByRole("button", { name: /新建课节/ }));
    const lessonDialog = await screen.findByRole("dialog", { name: "新建课节" });
    fireEvent.change(within(lessonDialog).getByLabelText("课节标题"), { target: { value: "自我介绍" } });
    fireEvent.click(within(lessonDialog).getByRole("button", { name: "创建课节" }));

    await waitFor(() => {
      expect(platform.getState().lessons.some((lesson) => lesson.folderId === createdCourse.id && lesson.title === "自我介绍")).toBe(true);
    });
    const createdLesson = platform.getState().lessons.find((lesson) => lesson.folderId === createdCourse.id)!;
    expect(createdLesson.status).toBe("draft");

    const lessonRow = screen.getByText("自我介绍").closest(".course-lesson-table-row") as HTMLElement;
    fireEvent.click(within(lessonRow).getByRole("button", { name: "发布" }));
    await waitFor(() => {
      expect(platform.getState().lessons.find((lesson) => lesson.id === createdLesson.id)?.status).toBe("published");
    });

    fireEvent.click(screen.getByRole("button", { name: "发布课程 英语口语" }));
    await waitFor(() => {
      expect(platform.getState().folders.find((course) => course.id === createdCourse.id)?.status).toBe("published");
    });
  });
});
