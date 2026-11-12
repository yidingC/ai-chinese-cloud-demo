import { useEffect, useMemo, useState } from "react";
import { CalendarClock, GraduationCap, Layers3 } from "lucide-react";
import type { InteractionSet, Phase, PlatformState, StoreResult } from "../domain/types";
import { platform } from "../lib/platform";
import { usePlatformStore } from "../store/usePlatformStore";
import { formatDateTime } from "../lib/format";
import { Badge, Button, Field, Modal, Select } from "./ui";

const phaseLabels: Record<Phase, string> = {
  preview: "课前预习",
  live: "课中互动",
  review: "课后复习"
};

/**
 * 把互动库母版复制成课次副本。
 * 不绑定某个课节：直接从未来待上课次里勾选，支持一次复制到多节课。
 */
export function CopyInteractionToLessonModal({
  open,
  onClose,
  state,
  set,
  teacherId,
  onCopied
}: {
  open: boolean;
  onClose: () => void;
  state: PlatformState;
  set: InteractionSet | null;
  teacherId: string;
  onCopied?: (set: InteractionSet) => void;
}) {
  const { run } = usePlatformStore();
  const [phase, setPhase] = useState<Phase>("live");
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);

  const upcomingSessions = useMemo(
    () =>
      state.sessions
        .filter((session) => session.teacherId === teacherId && session.status !== "cancelled" && new Date(session.endAt).getTime() >= Date.now())
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [state.sessions, teacherId]
  );

  /** 当前阶段下，这一轮已经复制到哪些课次；已复制的不再重复生成副本。 */
  const copiedSessionIds = useMemo(() => {
    if (!set) return new Set<string>();
    const copied = new Set<string>();
    state.interactionSets
      .filter((item) => item.scope !== "library" && item.sourceSetId === set.id && item.phase === phase)
      .forEach((item) => {
        const excluded = new Set(item.excludedSessionIds ?? []);
        const sessionIds = item.sessionIds?.length
          ? item.sessionIds
          : state.sessions.filter((session) => session.lessonId === item.lessonId).map((session) => session.id);
        sessionIds.forEach((sessionId) => {
          if (!excluded.has(sessionId)) copied.add(sessionId);
        });
      });
    return copied;
  }, [state.interactionSets, state.sessions, set, phase]);

  const copyableSessions = upcomingSessions.filter((session) => !copiedSessionIds.has(session.id));

  useEffect(() => {
    if (!open || !set) return;
    setPhase(set.phase);
    setSelectedSessionIds([]);
    // 只在弹窗打开或换互动时重置。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, set?.id]);

  if (!set) return null;
  const sourceVersion = state.interactionVersions.find((version) => version.id === set.currentVersionId);
  const itemCount = sourceVersion?.items.length ?? 0;
  const typeCount = new Set(sourceVersion?.items.map((item) => item.type) ?? []).size;

  function save() {
    if (!set || selectedSessionIds.length === 0) return;
    const selected = upcomingSessions.filter((session) => selectedSessionIds.includes(session.id));
    const groups = new Map<string, string[]>();
    selected.forEach((session) => {
      const ids = groups.get(session.lessonId) ?? [];
      ids.push(session.id);
      groups.set(session.lessonId, ids);
    });

    const result = run<InteractionSet | null>(() => {
      let lastSet: InteractionSet | null = null;
      for (const [lessonId, sessionIds] of groups) {
        const copied = platform.copyInteractionSetToLesson({
          setId: set.id,
          lessonId,
          phase,
          sessionIds,
          actorId: teacherId
        });
        if (!copied.ok || !copied.data) {
          return { ok: false, data: null, error: copied.error, code: copied.code } satisfies StoreResult<InteractionSet | null>;
        }
        lastSet = copied.data.set;
      }
      return { ok: true, data: lastSet, error: "", code: "" } satisfies StoreResult<InteractionSet | null>;
    }, `已复制到 ${selected.length} 节课次`);

    if (!result.ok) return;
    if (result.data) onCopied?.(result.data);
    onClose();
  }

  return (
    <Modal
      open={open}
      title={`复制到课次 · ${set.title}`}
      onClose={onClose}
      width="760px"
      footer={
        <div className="modal-footer-split">
          <span>{selectedSessionIds.length ? `已选 ${selectedSessionIds.length} 节课次` : "请选择要复制的课次"}</span>
          <div>
            <Button variant="ghost" onClick={onClose}>取消</Button>
            <Button onClick={save} disabled={selectedSessionIds.length === 0}>
              {selectedSessionIds.length ? `复制到 ${selectedSessionIds.length} 节课次` : "复制到课次"}
            </Button>
          </div>
        </div>
      }
    >
      <p className="muted-copy">
        复制会在所选课次里各生成一份独立副本：老师可以按本班情况改题，不会改动互动库里的母版；之后母版更新也不会影响这些副本。
      </p>

      <div className="editor-grid">
        <Field label="复制到阶段">
          <Select value={phase} onChange={(event) => { setPhase(event.target.value as Phase); setSelectedSessionIds([]); }}>
            <option value="preview">{phaseLabels.preview}</option>
            <option value="live">{phaseLabels.live}</option>
            <option value="review">{phaseLabels.review}</option>
          </Select>
        </Field>
        <Field label="内容概览">
          <div className="editor-static-field">
            <Layers3 size={15} /> {itemCount} 道题 · {typeCount} 种题型
          </div>
        </Field>
      </div>

      <div className="assign-session-toolbar copy-session-toolbar">
        <span className="copy-session-title">待上课次 <small>{copyableSessions.length} 节可复制</small></span>
        <div className="copy-session-toolbar-actions">
          <Button size="sm" variant="ghost" onClick={() => setSelectedSessionIds(copyableSessions.map((session) => session.id))} disabled={copyableSessions.length === 0}>全选</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedSessionIds([])} disabled={selectedSessionIds.length === 0}>清空</Button>
        </div>
      </div>

      <div className="assign-session-list">
        {upcomingSessions.map((session) => {
          const copied = copiedSessionIds.has(session.id);
          const checked = selectedSessionIds.includes(session.id);
          return (
            <label key={session.id} className={`assign-session-row ${checked ? "selected" : ""} ${copied ? "is-disabled" : ""}`}>
              <input
                type="checkbox"
                checked={checked}
                disabled={copied}
                onChange={() =>
                  setSelectedSessionIds((value) => (checked ? value.filter((id) => id !== session.id) : [...value, session.id]))
                }
              />
              <span className="assign-session-copy">
                <strong>{session.title}</strong>
                <small><GraduationCap size={13} /> {session.className}</small>
                <small><CalendarClock size={13} /> {formatDateTime(session.startAt, state.ui.timeZone, state.ui.language)} · {session.roomLabel}</small>
              </span>
              <Badge tone={copied ? "neutral" : "mint"}>{copied ? "已复制" : "可复制"}</Badge>
            </label>
          );
        })}
        {upcomingSessions.length === 0 && <p className="muted-copy">近期没有待上课次，先去课表排课。</p>}
        {upcomingSessions.length > 0 && copyableSessions.length === 0 && (
          <p className="muted-copy">这个阶段下的待上课次都已经复制过这一轮。</p>
        )}
      </div>
    </Modal>
  );
}
