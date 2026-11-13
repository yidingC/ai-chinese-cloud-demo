import { useEffect, useState } from "react";
import type { InteractionSet, Phase } from "../domain/types";
import { platform } from "../lib/platform";
import { usePlatformStore } from "../store/usePlatformStore";
import { Button, Field, Modal, Select, TextInput } from "./ui";

export interface InteractionSettingsValue {
  title: string;
  phase: Phase;
  tags: string[];
}

/** 互动壳层设置：低频配置与题目编辑分开，保存时不生成新的题目版本。 */
export function InteractionSetSettingsModal({
  open,
  set,
  initialValue,
  destination = "library",
  onSubmit,
  teacherId,
  onClose
}: {
  open: boolean;
  set: InteractionSet | null;
  /** 新建互动时使用本地草稿，不直接写库。 */
  initialValue?: InteractionSettingsValue;
  /** 新建内容最终保存到互动库，还是当前课堂。 */
  destination?: "library" | "lesson";
  /** 提供时改为提交本地草稿；设置保存到互动库仍走默认逻辑。 */
  onSubmit?: (value: InteractionSettingsValue) => void;
  teacherId: string;
  onClose: () => void;
}) {
  const { run } = usePlatformStore();
  const [form, setForm] = useState({ title: "", phase: "live" as Phase, tags: "" });
  /** 已进入编辑器的本地草稿，设置只回写标题、阶段和标签。 */
  const editingDraft = Boolean(onSubmit);

  useEffect(() => {
    if (!open) return;
    const source = set
      ? {
          title: set.title,
          phase: set.phase,
          tags: set.tags ?? []
        }
      : initialValue;
    if (source) {
      setForm({
        title: source.title,
        phase: source.phase,
        tags: source.tags.join("，")
      });
    }
    // 每次打开时用当前来源重置；编辑过程中不跟随父级重渲染。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, set?.id]);

  if (!set && !onSubmit) return null;

  function save() {
    if (!form.title.trim()) return;
    const value: InteractionSettingsValue = {
      title: form.title.trim(),
      phase: form.phase,
      tags: form.tags.split(/[，,]/u).map((tag) => tag.trim()).filter(Boolean)
    };
    if (onSubmit) {
      onSubmit(value);
      return;
    }
    if (!set) return;
    const result = run(
      () =>
        platform.updateInteractionSetMeta({
          setId: set.id,
          title: value.title,
          phase: value.phase,
          tags: value.tags,
          actorId: teacherId
        }),
      "互动设置已更新"
    );
    if (result.ok) onClose();
  }

  return (
    <Modal
      open={open}
      title={set || editingDraft ? "互动设置" : destination === "lesson" ? "新建互动轮次" : "新建互动"}
      onClose={onClose}
      width="520px"
      stacked
      footer={
        <div className="modal-footer-split">
          <span>
            {set || editingDraft
              ? "只更新互动信息，不改动题目内容"
              : destination === "lesson"
                ? "下一步进入题目编辑，保存后加入本节课"
                : "下一步进入题目编辑，发布后加入互动库"}
          </span>
          <div>
            <Button variant="ghost" onClick={onClose}>取消</Button>
            <Button onClick={save} disabled={!form.title.trim()}>{set || editingDraft ? "保存设置" : "下一步：编辑题目"}</Button>
          </div>
        </div>
      }
    >
      <div className="interaction-settings-form">
        <Field label="互动标题">
          <TextInput
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="例如：餐厅点餐情景问答"
            autoFocus
          />
        </Field>
        <Field
          label="阶段"
          hint={destination === "lesson"
            ? "决定这一轮互动出现在本节课的哪个阶段。"
            : "决定这份互动在预习、课中或复习场景中被筛选。"}
        >
          <Select value={form.phase} onChange={(event) => setForm((current) => ({ ...current, phase: event.target.value as Phase }))}>
            <option value="preview">课前预习</option>
            <option value="live">课中互动</option>
            <option value="review">课后复习</option>
          </Select>
        </Field>
        <Field label="标签" hint="用逗号分隔，方便搜索和组织同类互动。">
          <TextInput
            value={form.tags}
            onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
            placeholder="餐厅，口语，复习"
          />
        </Field>
        <p className="interaction-settings-note">
          {set || editingDraft
            ? "保存设置只更新标题、阶段和标签，不会改动题目内容，也不会生成新的题目版本。"
            : destination === "lesson"
              ? "这些信息先保存在本地草稿里；下一步编辑题目，保存后正式加入本节课。"
              : "这些信息先保存在本地草稿里；下一步编辑题目，点击发布后再正式加入互动库。"}
        </p>
      </div>
    </Modal>
  );
}
