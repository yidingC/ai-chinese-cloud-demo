import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../admin/src/App";
import "../admin/src/i18n";
import { platform } from "../admin/src/lib/platform";
import { usePlatformStore } from "../admin/src/store/usePlatformStore";

function refreshAppStore() {
  usePlatformStore.getState().refresh(platform.getState());
}

async function openSchedule(userId: string) {
  platform.setCurrentUser(userId);
  refreshAppStore();
  window.location.hash = "#/student/schedule";
  render(<App />);
  await screen.findByRole("heading", { name: "我的课表" });
}

function previewButtonOf(sessionTitle: string) {
  const card = screen.getByText(sessionTitle).closest(".student-session-card") as HTMLElement;
  return within(card).getByRole("button", { name: "课前预习" });
}

describe("schedule preview modal", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
  });

  it("renames the courseware action and puts courseware, materials and interactions in tabs", async () => {
    await openSchedule("student-raymond");

    expect(screen.queryByRole("button", { name: "查看课件" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "课前预习" }).length).toBeGreaterThan(0);

    // 有互动课件的课次：课件页签直接播放，材料不再重复展示它
    fireEvent.click(previewButtonOf("时间表达 · 满员演练课"));
    const coursewareDialog = await screen.findByRole("dialog", { name: "现在几点？ · 课前预习" });
    expect(coursewareDialog.querySelector("iframe")).toBeTruthy();
    expect(within(coursewareDialog).getByRole("tab", { name: /材料/ })).toBeInTheDocument();
    expect(within(coursewareDialog).getByRole("tab", { name: /互动/ })).toBeInTheDocument();
    fireEvent.click(within(coursewareDialog).getByRole("button", { name: "关闭" }));

    // 没有互动课件的课次：课件空态可以跳到课前材料
    fireEvent.click(previewButtonOf("问候口语大班课"));
    const materialDialog = await screen.findByRole("dialog", { name: "嗨！你好！ · 课前预习" });
    expect(within(materialDialog).getByText("这节课暂时没有互动课件")).toBeInTheDocument();

    fireEvent.click(within(materialDialog).getByRole("button", { name: "查看材料" }));
    expect(await within(materialDialog).findByText("课前词汇卡：你好、早上好、再见")).toBeInTheDocument();

    fireEvent.click(within(materialDialog).getByRole("tab", { name: /互动/ }));
    expect(await within(materialDialog).findByText("问候热身")).toBeInTheDocument();

    // 弹窗内可以直接开始互动
    fireEvent.click(within(materialDialog).getByRole("button", { name: /开始互动|再练一次/ }));
    expect(await screen.findByRole("dialog", { name: "问候热身" })).toBeInTheDocument();
  });

  it("opens the lesson page from the preview modal", async () => {
    await openSchedule("student-raymond");
    fireEvent.click(previewButtonOf("时间表达 · 满员演练课"));

    const dialog = await screen.findByRole("dialog", { name: /课前预习/ });
    fireEvent.click(within(dialog).getByRole("button", { name: "打开学习页" }));

    await waitFor(() => expect(window.location.hash).toContain("/student/lesson/"));
    expect(window.location.hash).toContain("phase=preview");
  });

  it("opens review materials and interactions in a modal, then links to the class performance page", async () => {
    await openSchedule("student-raymond");
    fireEvent.click(screen.getByRole("tab", { name: /历史课程/ }));

    const reviewCard = (await screen.findByText("问候复习课")).closest(".student-session-card") as HTMLElement;
    fireEvent.click(within(reviewCard).getByRole("button", { name: "课后复习" }));

    const dialog = await screen.findByRole("dialog", { name: "嗨！你好！ · 课后复习" });
    // 课后阶段没有互动课件，默认落在材料页签
    expect(within(dialog).queryByRole("tab", { name: "课件" })).not.toBeInTheDocument();
    expect(await within(dialog).findByText("课后跟读音频")).toBeInTheDocument();
    expect(within(dialog).getByText("情境视频：初次见面")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("tab", { name: /互动/ }));
    expect(await within(dialog).findByText("课后复习挑战")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "关闭" }));

    // 历史课程右侧直接进入这节课的课堂表现
    fireEvent.click(within(reviewCard).getByRole("button", { name: "查看课堂表现" }));
    await waitFor(() => expect(window.location.hash).toContain("/student/results"));
    expect(await screen.findByRole("heading", { name: "课堂表现" })).toBeInTheDocument();
  });
});
