import { useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layers3 } from "lucide-react";
import type { InteractionItem, InteractionSet, InteractionTemplate, Phase } from "../domain/types";
import { platform } from "../lib/platform";
import { usePlatformStore } from "../store/usePlatformStore";
import { getCurrentInteractionVersion, getLesson } from "../lib/domain";
import { Button, Card, EmptyState, Field, Modal, Select, Tabs, TextInput } from "./ui";
import { InteractionEditor, createInteractionItem } from "./InteractionEditor";
import { InteractionTemplatePicker, templateToItem } from "./InteractionTemplatePicker";
import { StudentPhonePreview } from "./InteractionPlayer";
import { PmNote } from "./PmNote";

const phaseLabels: Record<Phase, string> = { preview: "课前预习", live: "课中互动", review: "课后复习" };

function defaultCountsTowardGrade(items: InteractionItem[]) {
  const onlyPoll = items.length > 0 && items.every((item) => item.type === "poll");
  const hasPlaceholderSpeaking = items.some((item) => ["read-aloud", "picture-talk", "open-qa"].includes(item.type));
  return !onlyPoll && !hasPlaceholderSpeaking;
}

/** 互动设计的创建 / 编辑弹窗：设计库与课堂设计页共用。 */
export function InteractionSetEditorModal({
  open,
  set,
  defaultLessonId,
  defaultPhase = "live",
  lockLesson = false,
  scope = "lesson",
  teacherId,
  pendingSessionIds = [],
  copyTarget,
  presetItems,
  presetTitle,
  initialView = "design",
  onClose
}: {
  open: boolean;
  /** null = 新建；InteractionSet = 编辑该设计。 */
  set: InteractionSet | null;
  defaultLessonId?: string;
  defaultPhase?: Phase;
  /** 从课堂设计页进入时锁定课节，避免误改到别的课节。 */
  lockLesson?: boolean;
  /** library = 编辑互动库母版；lesson = 编辑课节副本。 */
  scope?: "library" | "lesson";
  teacherId: string;
  /** 保存后自动配置到这些课次。 */
  pendingSessionIds?: string[];
  /** 互动库新建后，顺手复制到指定课节 / 课次。 */
  copyTarget?: { lessonId: string; phase: Phase; sessionIds?: string[] };
  /** 用模板新建：预填题目与标题。 */
  presetItems?: InteractionItem[];
  presetTitle?: string;
  /** 从互动库点「预览」进入时直接落在学生预览；默认设计视图。 */
  initialView?: "design" | "preview";
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { state, run } = usePlatformStore();
  const libraryMode = scope === "library";
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [view, setView] = useState<"design" | "preview">(initialView);
  const [form, setForm] = useState({
    lessonId: defaultLessonId ?? state.lessons[0]?.id ?? "",
    phase: defaultPhase,
    title: "",
    tags: "",
    publishNote: ""
  });
  const [items, setItems] = useState<InteractionItem[]>([]);
  /** 当前高亮的题目：决定哪张题目卡片处于编辑态。 */
  const [activeItemId, setActiveItemId] = useState("");
  const [countsTowardGrade, setCountsTowardGrade] = useState(true);
  const [assignmentScope, setAssignmentScope] = useState<"session" | "lesson">("session");

  useLayoutEffect(() => {
    if (open) setView(initialView);
  }, [open, set?.id, initialView]);

  useEffect(() => {
    if (!open) return;
    setAssignmentScope("session");
    setActiveItemId("");
    if (set) {
      const version = getCurrentInteractionVersion(state, set);
      setForm({
        lessonId: libraryMode ? "" : set.lessonId,
        phase: set.phase,
        title: set.title,
        tags: (set.tags ?? []).join("，"),
        publishNote: ""
      });
      setItems(version ? structuredClone(version.items) : []);
      setCountsTowardGrade(set.countsTowardGrade ?? defaultCountsTowardGrade(version?.items ?? []));
    } else {
      setForm({
        lessonId: libraryMode ? "" : (defaultLessonId ?? state.lessons[0]?.id ?? ""),
        phase: defaultPhase,
        title: presetTitle ?? "",
        tags: "",
        publishNote: ""
      });
      const nextItems = presetItems ? structuredClone(presetItems) : [createInteractionItem("choice")];
      setItems(nextItems);
      setCountsTowardGrade(defaultCountsTowardGrade(nextItems));
    }
    // 只在打开或切换编辑对象时重置表单。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, set?.id]);

  const lesson = getLesson(state, form.lessonId);
  const activeItem = items.find((item) => item.id === activeItemId) ?? items[0] ?? null;

  function save() {
    if (!form.title.trim()) return;
    const result = run(
      () =>
        platform.saveInteractionSet({
          setId: set?.id,
          lessonId: form.lessonId,
          scope,
          title: form.title,
          phase: form.phase,
          items,
          tags: libraryMode
            ? form.tags.split(/[,，]/u).map((tag) => tag.trim()).filter(Boolean)
            : undefined,
          countsTowardGrade,
          actorId: teacherId,
          publishNote: form.publishNote
        }),
      "互动已保存并发布新版本"
    );
    if (!result.ok) return;
    const savedSet = result.data?.set;
    if (!libraryMode && pendingSessionIds.length && savedSet) {
      const assignedSessionIds = assignmentScope === "session" ? pendingSessionIds : [];
      run(
        () => platform.assignInteractionSessions({ setId: savedSet.id, sessionIds: assignedSessionIds, actorId: teacherId }),
        assignmentScope === "session" ? "已配置到本节课" : "已配置到该课节全部课次"
      );
    }
    if (libraryMode && copyTarget && savedSet) {
      run(
        () =>
          platform.copyInteractionSetToLesson({
            setId: savedSet.id,
            lessonId: copyTarget.lessonId,
            phase: copyTarget.phase,
            sessionIds: copyTarget.sessionIds ?? [],
            actorId: teacherId
          }),
        "已复制到课节"
      );
    }
    onClose();
  }

  return (
    <>
      <Modal
        open={open}
        title={set ? t("teacher.editInteraction") : t("teacher.createInteraction")}
        onClose={onClose}
        headerExtra={
          <Tabs
            value={view}
            onChange={(value) => setView(value as "design" | "preview")}
            items={[
              { value: "design", label: "设计" },
              { value: "preview", label: "学生预览" }
            ]}
            compact
          />
        }
        width="1180px"
        footer={
          view === "preview" ? (
            <div className="modal-footer-split">
              <span>{items.length} 个互动题目 · 学生预览</span>
              <div>
                <Button variant="ghost" onClick={onClose}>关闭</Button>
                <Button variant="secondary" onClick={() => setView("design")}>返回设计</Button>
              </div>
            </div>
          ) : (
            <div className="modal-footer-split">
              <span>
                {items.length} 个互动题目
                {!libraryMode && !set && pendingSessionIds.length > 0 && ` · ${assignmentScope === "session" ? "仅配置到本节课" : "配置到该课节全部课次"}`}
              </span>
              <div>
                <Button variant="ghost" onClick={onClose}>取消</Button>
                <PmNote
                  kind="流程"
                  note={libraryMode
                    ? "点击后生成互动库里的新版本；不会直接出现在课堂，已经复制到课节的副本也不受影响。"
                    : "点击后生成新的不可变版本并立即切换为学生当前版本；历史版本仍可追溯。"}
                >
                  <Button onClick={save}>{t("common.publish")}</Button>
                </PmNote>
              </div>
            </div>
          )
        }
      >
        {view === "preview" ? (
          <div className="editor-preview-view">
            <div className="editor-preview-stage">
              <span className="editor-preview-caption">
                {phaseLabels[form.phase]} · 学生端预览 · {items.length} 道题
              </span>
              {items.length > 0 ? (
                <StudentPhonePreview items={items} />
              ) : (
                <EmptyState
                  title="这一轮还没有题目"
                  description="回到设计里加一道题，再来预览学生端效果。"
                  action={<Button onClick={() => setView("design")}>返回设计</Button>}
                />
              )}
            </div>
          </div>
        ) : (
        <div className="editor-page-layout">
          <div className="editor-main-column">
            <Card className="editor-meta-card">
              <div className="editor-grid">
                {libraryMode ? (
                  <Field label="内容归属">
                    <div className="editor-static-field">互动库 · 可被任意课节复制</div>
                  </Field>
                ) : (
                  <Field label="所属课节">
                    {lockLesson ? (
                      <div className="editor-static-field">{lesson?.coverEmoji} {lesson?.title}</div>
                    ) : (
                      <Select value={form.lessonId} onChange={(event) => setForm((value) => ({ ...value, lessonId: event.target.value }))}>
                        {state.lessons.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                      </Select>
                    )}
                  </Field>
                )}
                <Field label={libraryMode ? "推荐阶段" : "学习阶段"}>
                  <Select value={form.phase} onChange={(event) => setForm((value) => ({ ...value, phase: event.target.value as Phase }))}>
                    <option value="preview">课前预习</option>
                    <option value="live">课中互动</option>
                    <option value="review">课后复习</option>
                  </Select>
                </Field>
                <Field label="互动标题" className="field-span-2">
                  <TextInput value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} placeholder="例如：问候热身" />
                </Field>
                {libraryMode && (
                  <Field label="标签" className="field-span-2">
                    <TextInput
                      value={form.tags}
                      onChange={(event) => setForm((value) => ({ ...value, tags: event.target.value }))}
                      placeholder="用逗号分隔，例如：餐厅，口语，预习"
                    />
                  </Field>
                )}
                <label className="grade-count-toggle field-span-2">
                  <input type="checkbox" checked={countsTowardGrade} onChange={(event) => setCountsTowardGrade(event.target.checked)} />
                  <span><strong>计入学生成绩</strong><small>开启后，该互动的最高分进入“互动练习”分类；投票和语音占位互动默认关闭。</small></span>
                </label>
                <Field label="发布说明" className="field-span-2">
                  <PmNote kind="口径" note="发布说明写入版本记录，用于后续追踪改动，不展示给学生。">
                    <TextInput value={form.publishNote} onChange={(event) => setForm((value) => ({ ...value, publishNote: event.target.value }))} placeholder="介绍该互动的学习目的和内容吧" />
                  </PmNote>
                </Field>
              </div>
              {!libraryMode && !set && pendingSessionIds.length > 0 && (
                <div className="scope-choice editor-scope-choice">
                  <button type="button" className={assignmentScope === "session" ? "active" : ""} onClick={() => setAssignmentScope("session")}>
                    仅配置于此课次
                  </button>
                  <button type="button" className={assignmentScope === "lesson" ? "active" : ""} onClick={() => setAssignmentScope("lesson")}>
                    该课节全部课次
                  </button>
                </div>
              )}
            </Card>
            <Card className="editor-template-bar">
              <div>
                <strong>从单题模板插入</strong>
                <span>素材库共有 {state.interactionTemplates.length} 道单题模板，挑一道插入当前互动后可直接改内容。</span>
              </div>
              <PmNote kind="流程" note="点击后复制一套模板到当前互动，原模板不发生变化。">
                <Button variant="secondary" onClick={() => setTemplatePickerOpen(true)}>
                  <Layers3 size={16} /> 打开模板库
                </Button>
              </PmNote>
            </Card>
            <InteractionEditor
              items={items}
              onChange={setItems}
              activeItemId={activeItem?.id ?? ""}
              onActiveItemChange={setActiveItemId}
            />
          </div>
        </div>
        )}
      </Modal>

      <InteractionTemplatePicker
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        templates={state.interactionTemplates}
        onPick={(template: InteractionTemplate) => {
          setItems((current) => [...current, templateToItem(template)]);
          setTemplatePickerOpen(false);
        }}
      />
    </>
  );
}
