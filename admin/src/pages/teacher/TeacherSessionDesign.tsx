import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarClock,
  Eye,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  GraduationCap,
  Layers3,
  LibraryBig,
  Link2,
  MapPin,
  Presentation,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
  UsersRound
} from "lucide-react";
import { platform } from "../../lib/platform";
import { usePlatformStore } from "../../store/usePlatformStore";
import {
  currentUser,
  getBookedCount,
  getCurrentInteractionVersion,
  getLesson,
  getLessonSessions,
  getSchoolTimeZone,
  getSession,
  getUser,
  scopeLabel,
  sessionMaterials,
  sessionRuntimeStatus,
  setAppliesToSession,
  setsForSession
} from "../../lib/domain";
import { formatDateTime, formatRange, formatTime, timeZoneLabel } from "../../lib/format";
import type {
  ClassSession,
  InteractionItem,
  InteractionRoundScenario,
  InteractionSet,
  InteractionTemplateLevel,
  LessonMaterialRef,
  Material,
  Phase
} from "../../domain/types";
import { Avatar, Badge, Button, Card, EmptyState, Field, Modal, ProgressBar, Select, Tabs, TextInput } from "../../components/ui";
import { InteractionSetEditorModal } from "../../components/InteractionSetEditorModal";
import { PmNote } from "../../components/PmNote";
import { interactionTypeLabel, interactionTypeShortLabel } from "../../lib/interactionTypes";
import { templateLevelLabel } from "../../lib/templateLibrary";
import { roundTemplateQuestionTemplates } from "../../lib/roundTemplates";
import { InteractionRoundTemplateChips } from "../../components/InteractionRoundTemplateChips";
import { templateToItem } from "../../components/InteractionTemplatePicker";

const PHASES: Array<{ phase: Phase; label: string; short: string; hint: string; open: string }> = [
  { phase: "preview", label: "课前预习", short: "课前", hint: "提前熟悉词汇与句型，学生上课前完成。", open: "上课前开放" },
  { phase: "live", label: "课中互动", short: "课中", hint: "课堂投屏使用，老师按节奏逐个开启。", open: "课堂中开放" },
  { phase: "review", label: "课后复习", short: "课后", hint: "课堂结束后延续练习与巩固。", open: "下课后开放" }
];

function materialIcon(material: Material) {
  if (material.fileType === "pptx") return Presentation;
  if (material.fileType === "wav" || material.fileType === "mp3") return FileAudio;
  if (material.fileType === "video") return FileVideo;
  if (material.fileType === "image" || material.fileType === "png") return FileImage;
  return material.kind === "link" ? Link2 : FileText;
}

function materialVersion(material: Material) {
  return material.versions.find((version) => version.version === material.currentVersion) ?? material.versions.at(-1);
}

function sessionDateLabels(value: string, timeZone: string, language: string) {
  const date = new Intl.DateTimeFormat(language, { timeZone, month: "2-digit", day: "2-digit" }).format(new Date(value));
  const weekday = new Intl.DateTimeFormat(language, { timeZone, weekday: "short" }).format(new Date(value));
  return { date, weekday };
}

/** 轮次名称直接在中栏编辑；失焦或回车保存，Esc 取消。 */
function RoundTitleInput({ value, onFocus, onCommit }: { value: string; onFocus: () => void; onCommit: (title: string) => void }) {
  const [draft, setDraft] = useState(value);
  const cancelledRef = useRef(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit() {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    const next = draft.trim();
    if (!next) {
      setDraft(value);
      return;
    }
    if (next !== value) onCommit(next);
  }

  return (
    <input
      className="design-round-title-input"
      value={draft}
      aria-label={`轮次名称：${value}`}
      title="点击直接修改轮次名称"
      spellCheck={false}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={onFocus}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          cancelledRef.current = true;
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

/** 材料作用范围：勾选课次 = 只在勾选的课次出现；不勾选 = 该课节全部课次。 */
function MaterialScopeModal({
  open,
  state,
  session,
  phase,
  material,
  teacherId,
  onClose
}: {
  open: boolean;
  state: ReturnType<typeof usePlatformStore.getState>["state"];
  session: ClassSession;
  phase: Phase;
  material: Material | null;
  teacherId: string;
  onClose: () => void;
}) {
  const { run } = usePlatformStore();
  const [selected, setSelected] = useState<string[]>([]);
  const sessions = getLessonSessions(state, session.lessonId);
  const ref = material
    ? state.materialRefs.find((item) => item.materialId === material.id && item.lessonId === session.lessonId && item.phase === phase)
    : undefined;

  useEffect(() => {
    if (!open || !ref) return;
    setSelected(ref.sessionIds ? [...ref.sessionIds] : []);
    // 只在打开或切换材料时重置选择。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ref?.id]);

  if (!material) return null;

  return (
    <Modal
      open={open}
      title={`配置材料范围 · ${material.title}`}
      onClose={onClose}
      width="720px"
      footer={
        <div className="modal-footer-split">
          <span>{selected.length ? `已选 ${selected.length} 节课次` : "作用于该课节全部课次"}</span>
          <div>
            <Button variant="ghost" onClick={onClose}>取消</Button>
            <PmNote kind="流程" note="点击后更新材料范围；留空会覆盖该课节全部课次和后续新排课。">
              <Button
                onClick={() => {
                  run(
                    () =>
                      platform.attachMaterial({
                        materialId: material.id,
                        lessonId: session.lessonId,
                        phase,
                        order: ref?.order ?? 1,
                        sessionIds: selected,
                        actorId: teacherId
                      }),
                    selected.length ? `材料已配置到 ${selected.length} 节课次` : "材料已改为作用于全部课次"
                  );
                  onClose();
                }}
              >
                保存配置
              </Button>
            </PmNote>
          </div>
        </div>
      }
    >
      <PmNote kind="规则" note="不勾选任何课次时，材料出现在这门课节的所有课次和后续新课次。">
        <p className="muted-copy">不勾选任何课次时，材料出现在这门课节的所有课次（含后续新排的课）。</p>
      </PmNote>
      <div className="assign-session-toolbar">
        <Button size="sm" variant="ghost" onClick={() => setSelected(sessions.map((item) => item.id))}>全选本课节课次</Button>
        <Button size="sm" variant="ghost" onClick={() => setSelected([])}>清空（全部课次）</Button>
      </div>
      <div className="assign-session-list">
        {sessions.map((item) => {
          const checked = selected.includes(item.id);
          return (
            <label key={item.id} className={`assign-session-row ${checked ? "selected" : ""}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => setSelected((value) => (checked ? value.filter((id) => id !== item.id) : [...value, item.id]))}
              />
              <span className="assign-session-copy">
                <strong>{item.title}</strong>
                <small><CalendarClock size={13} /> {formatDateTime(item.startAt, state.ui.timeZone, state.ui.language)} · {item.roomLabel}</small>
              </span>
              {item.id === session.id && <Badge tone="purple">本节课</Badge>}
            </label>
          );
        })}
      </div>
    </Modal>
  );
}

export function TeacherSessionDesign({ mode = "teacher" }: { mode?: "teacher" | "operator" } = {}) {
  const { sessionId = "" } = useParams();
  const navigate = useNavigate();
  const store = usePlatformStore();
  const { state, run } = store;
  const user = currentUser(state);
  const operatorView = mode === "operator";
  const backPath = operatorView ? "/operator/scheduling" : "/teacher/schedule";
  const backLabel = operatorView ? "返回排课" : "返回课表";
  const session = getSession(state, sessionId);
  const lesson = session ? getLesson(state, session.lessonId) : undefined;
  const course = lesson ? state.folders.find((folder) => folder.id === lesson.folderId) : undefined;

  const [activePhase, setActivePhase] = useState<Phase>(() => {
    if (!session) return "live";
    const applicableSets = state.interactionSets.filter(
      (set) => set.scope !== "library" && set.lessonId === session.lessonId && set.status === "published" && setAppliesToSession(set, session.id)
    );
    if (applicableSets.some((set) => set.phase === "live")) return "live";
    const firstPopulatedPhase = (["preview", "review"] as Phase[]).find((phase) =>
      applicableSets.some((set) => set.phase === phase)
    );
    return firstPopulatedPhase ?? "live";
  });
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [editorSeed, setEditorSeed] = useState<{ phase: Phase; set: InteractionSet | null } | null>(null);
  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: "", fileType: "pptx", fileName: "" });
  const [materialPhase, setMaterialPhase] = useState<Phase | null>(null);
  const [materialSelection, setMaterialSelection] = useState<string[]>([]);
  const [materialScope, setMaterialScope] = useState<"session" | "lesson">("session");
  const [materialQuery, setMaterialQuery] = useState("");
  const [materialView, setMaterialView] = useState<"phase" | "all">("phase");
  const [importPhase, setImportPhase] = useState<Phase | null>(null);
  const [importSelection, setImportSelection] = useState<string[]>([]);
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateScenario, setTemplateScenario] = useState<InteractionRoundScenario | "all">("all");
  const [templateLevel, setTemplateLevel] = useState<InteractionTemplateLevel | "all">("all");
  const [templateVisible, setTemplateVisible] = useState(12);
  const [scopeMaterial, setScopeMaterial] = useState<Material | null>(null);
  const [removeTarget, setRemoveTarget] = useState<
    | { kind: "material"; ref: LessonMaterialRef; material: Material }
    | { kind: "interaction"; set: InteractionSet }
    | { kind: "question"; set: InteractionSet; item: InteractionItem }
    | null
  >(null);
  const [removeScope, setRemoveScope] = useState<"session" | "lesson">("session");
  const [designSaved, setDesignSaved] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");

  useEffect(() => {
    if (!designSaved) return;
    const timer = window.setTimeout(() => setDesignSaved(false), 1800);
    return () => window.clearTimeout(timer);
  }, [designSaved]);

  const sessionSets = useMemo(
    () =>
      session
        ? setsForSession(state, session)
            .filter((set) => set.status === "published")
            .sort((a, b) => a.order - b.order)
        : [],
    [state, session]
  );
  const setsByPhase = (phase: Phase) => sessionSets.filter((set) => set.phase === phase);
  const materialsByPhase = (phase: Phase) => (session ? sessionMaterials(state, session, phase) : []);
  /** 互动库母版：全局仓库，不绑定任何课节。 */
  const librarySets = useMemo(
    () =>
      state.interactionSets
        .filter((set) => set.scope === "library")
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [state.interactionSets]
  );
  const filteredLibrarySets = librarySets.filter((set) => {
    const keyword = libraryQuery.trim().toLowerCase();
    if (!keyword) return true;
    return set.title.toLowerCase().includes(keyword) || (set.tags ?? []).join(" ").toLowerCase().includes(keyword);
  });
  /** 互动模板库：按教学场景组织的一整轮互动，选中后整轮复制到本节课。 */
  const libraryTemplates = useMemo(() => {
    const keyword = templateQuery.trim().toLowerCase();
    return state.interactionRoundTemplates.filter((template) => {
      const scenarioMatch = templateScenario === "all" || template.scenarioId === templateScenario;
      const levelMatch = templateLevel === "all" || template.level === templateLevel;
      const queryMatch =
        !keyword ||
        template.title.toLowerCase().includes(keyword) ||
        template.topic.toLowerCase().includes(keyword) ||
        template.summary.toLowerCase().includes(keyword) ||
        template.tags.join(" ").toLowerCase().includes(keyword);
      return scenarioMatch && levelMatch && queryMatch;
    });
  }, [state.interactionRoundTemplates, templateQuery, templateScenario, templateLevel]);

  if (!session || !lesson) {
    return <EmptyState title="课程不存在" description="请返回课表重新选择。" action={<Button onClick={() => navigate(backPath)}>{backLabel}</Button>} />;
  }

  const booked = getBookedCount(state, session.id);
  const expected = session.roster?.length ?? booked;
  const teacher = getUser(state, session.teacherId);
  const displayTimeZone = operatorView ? getSchoolTimeZone(state, session.schoolId) : state.ui.timeZone;
  const sessionDate = sessionDateLabels(session.startAt, displayTimeZone, state.ui.language);
  const runtimeStatus = sessionRuntimeStatus(session);
  const sessionStatus =
    runtimeStatus === "cancelled"
      ? { key: "cancelled", label: "已取消", tone: "danger" as const }
      : runtimeStatus === "ended"
        ? { key: "ended", label: "已结束", tone: "neutral" as const }
        : runtimeStatus === "live"
          ? { key: "live", label: "进行中", tone: "mint" as const }
          : { key: "upcoming", label: "未开始", tone: "blue" as const };
  const readOnly = operatorView || runtimeStatus !== "upcoming";
  const phaseStat = (phase: Phase) => ({ sets: setsByPhase(phase).length, materials: materialsByPhase(phase).length });
  const currentPhase = PHASES.find((item) => item.phase === activePhase)!;
  const currentSets = setsByPhase(activePhase);
  const currentMaterials = materialsByPhase(activePhase);
  const selectedRound = currentSets.find((set) => set.id === selectedRoundId) ?? currentSets[0] ?? null;
  const selectedRoundIndex = selectedRound ? currentSets.findIndex((set) => set.id === selectedRound.id) : -1;
  const selectedItems = selectedRound ? getCurrentInteractionVersion(state, selectedRound)?.items ?? [] : [];
  const selectedItem = selectedItems.find((item) => item.id === selectedItemId) ?? selectedItems[0] ?? null;
  const selectedItemIndex = selectedItem ? selectedItems.findIndex((item) => item.id === selectedItem.id) : -1;
  const phaseWorkTitle = activePhase === "preview" ? "预习练习" : activePhase === "review" ? "复习练习" : "互动轮次";

  function changePhase(phase: Phase) {
    setActivePhase(phase);
    setSelectedRoundId("");
    setSelectedItemId("");
  }

  function saveDesign() {
    if (readOnly) return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setDesignSaved(true);
  }

  function openEditor(phase: Phase, set: InteractionSet | null) {
    if (readOnly) return;
    setEditorSeed({ phase, set });
  }

  function saveRoundItems(set: InteractionSet, items: InteractionItem[], note: string, successMessage: string) {
    return run(
      () =>
        platform.saveInteractionSet({
          setId: set.id,
          lessonId: set.lessonId,
          title: set.title,
          phase: set.phase,
          items,
          countsTowardGrade: set.countsTowardGrade,
          actorId: user.id,
          publishNote: note
        }),
      successMessage
    );
  }

  function renameRound(set: InteractionSet, title: string) {
    if (readOnly) return;
    const items = getCurrentInteractionVersion(state, set)?.items ?? [];
    const result = run(
      () =>
        platform.saveInteractionSet({
          setId: set.id,
          lessonId: set.lessonId,
          title,
          phase: set.phase,
          items,
          countsTowardGrade: set.countsTowardGrade,
          actorId: user.id,
          publishNote: "修改轮次名称"
        }),
      "轮次名称已更新"
    );
    if (result.ok) setSelectedRoundId(set.id);
  }

  /** 显式把课堂副本另存进互动库；不会自动回写，也不覆盖原母版。 */
  function saveRoundToLibrary(set: InteractionSet) {
    if (readOnly) return;
    const version = getCurrentInteractionVersion(state, set);
    run(
      () => platform.saveInteractionSetToLibrary({ setId: set.id, versionId: version?.id, actorId: user.id }),
      "已另存到互动库"
    );
  }

  function moveQuestion(set: InteractionSet, itemId: string, direction: -1 | 1) {
    if (readOnly) return;
    const items = [...(getCurrentInteractionVersion(state, set)?.items ?? [])];
    const index = items.findIndex((item) => item.id === itemId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return;
    [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
    const result = saveRoundItems(set, items, "调整题目顺序", "题目顺序已更新");
    if (result.ok) {
      setSelectedRoundId(set.id);
      setSelectedItemId(itemId);
    }
  }

  function confirmRemove() {
    if (readOnly) return;
    if (!removeTarget) return;
    if (removeTarget.kind === "question") {
      const remainingItems = (getCurrentInteractionVersion(state, removeTarget.set)?.items ?? []).filter(
        (item) => item.id !== removeTarget.item.id
      );
      const result = saveRoundItems(removeTarget.set, remainingItems, "删除题目", "题目已删除");
      if (result.ok) {
        setSelectedItemId(remainingItems[0]?.id ?? "");
        setRemoveTarget(null);
      }
      return;
    }
    if (removeScope === "lesson") {
      if (removeTarget.kind === "interaction") {
        run(
          () => platform.unassignInteractionSet({ setId: removeTarget.set.id, actorId: user.id }),
          "已从该课节全部课次移出，设计仍保留在互动设计库"
        );
      } else {
        const { ref, material } = removeTarget;
        run(
          () => platform.detachMaterial({ materialId: material.id, lessonId: session!.lessonId, phase: ref.phase, actorId: user.id }),
          "已从该课节全部课次移出该材料"
        );
      }
    } else if (removeTarget.kind === "interaction") {
      run(
        () => platform.excludeInteractionSession({ setId: removeTarget.set.id, sessionId: session!.id, excluded: true, actorId: user.id }),
        "已从本次课移出，设计仍保留在互动设计库"
      );
    } else {
      const { ref, material } = removeTarget;
      // 只属于本节课的材料直接解除关联；课节共用的材料只从本节课移出。
      if (ref.sessionIds && ref.sessionIds.length === 1 && ref.sessionIds[0] === session!.id) {
        run(
          () => platform.detachMaterial({ materialId: material.id, lessonId: session!.lessonId, phase: ref.phase, actorId: user.id }),
          "已移除该材料"
        );
      } else {
        run(
          () => platform.excludeMaterialSession({ materialId: material.id, lessonId: session!.lessonId, phase: ref.phase, sessionId: session!.id, excluded: true, actorId: user.id }),
          "已从本次课移出该材料"
        );
      }
    }
    setRemoveTarget(null);
  }

  function openTemplateLibrary(phase: Phase) {
    if (readOnly) return;
    setImportPhase(phase);
    setImportSelection([]);
    setTemplateQuery("");
    setTemplateScenario("all");
    setTemplateLevel("all");
    setTemplateVisible(12);
  }

  function openMaterialLibrary(phase: Phase) {
    if (readOnly) return;
    setMaterialPhase(phase);
    setMaterialSelection([]);
    setMaterialScope("session");
    setMaterialQuery("");
    setMaterialView("phase");
  }

  /** 从互动库复制一份到当前课次；副本可独立改，不影响库里的母版。 */
  function copyFromLibrary(set: InteractionSet) {
    if (readOnly) return;
    const result = run(
      () =>
        platform.copyInteractionSetToLesson({
          setId: set.id,
          lessonId: session!.lessonId,
          phase: activePhase,
          sessionIds: [session!.id],
          actorId: user.id
        }),
      `已把“${set.title}”复制到本节课`
    );
    if (result.ok) setLibraryOpen(false);
  }

  function confirmMaterials() {
    if (!materialPhase || materialSelection.length === 0) return;
    const existing = materialsByPhase(materialPhase).length;
    materialSelection.forEach((materialId, index) => {
      run(
        () =>
          platform.attachMaterial({
            materialId,
            lessonId: session!.lessonId,
            phase: materialPhase,
            order: existing + index + 1,
            sessionIds: materialScope === "session" ? [session!.id] : undefined,
            actorId: user.id
          }),
        "材料已引入本节课"
      );
    });
    setMaterialPhase(null);
    setMaterialSelection([]);
  }

  function saveCoursewareUpload() {
    if (readOnly) return;
    if (!uploadForm.title.trim()) return;
    const extension = uploadForm.fileType === "video" ? "mp4" : uploadForm.fileType;
    const added = run(
      () =>
        platform.addMockMaterial({
          title: uploadForm.title.trim(),
          description: "",
          fileType: uploadForm.fileType,
          language: "zh-id",
          ownerId: user.id,
          fileName: uploadForm.fileName || `demo-upload.${extension}`,
          sizeLabel: "36 KB"
        }),
      "课件已上传"
    );
    if (!added.ok || !added.data) return;
    run(
      () =>
        platform.attachMaterial({
          materialId: added.data!.id,
          lessonId: session!.lessonId,
          phase: activePhase,
          order: currentMaterials.length + 1,
          sessionIds: [session!.id],
          actorId: user.id
        }),
      "课件已加入本节课"
    );
    setUploadOpen(false);
    setUploadForm({ title: "", fileType: "pptx", fileName: "" });
  }

  /** 把选中的整轮模板复制成本节课的互动设计，并只配置到本节课。 */
  function confirmImport() {
    if (!importPhase || importSelection.length === 0) return;
    const createdIds: string[] = [];
    importSelection.forEach((templateId) => {
      const template = state.interactionRoundTemplates.find((item) => item.id === templateId);
      if (!template) return;
      const items = roundTemplateQuestionTemplates(template, state.interactionTemplates).map(templateToItem);
      if (items.length === 0) return;
      const saved = platform.saveInteractionSet({
        lessonId: session!.lessonId,
        title: template.title,
        phase: importPhase,
        items,
        actorId: user.id,
        publishNote: `从互动模板库引入（${template.topic}）`
      });
      if (saved.ok && saved.data) createdIds.push(saved.data.set.id);
    });
    createdIds.forEach((setId) => {
      platform.assignInteractionSessions({ setId, sessionIds: [session!.id], actorId: user.id });
    });
    store.refresh();
    store.showToast(
      createdIds.length ? `已从互动模板库引入 ${createdIds.length} 个互动到本节课` : "引入未完成，请稍后重试",
      createdIds.length ? "success" : "error"
    );
    setImportPhase(null);
    setImportSelection([]);
  }

  const activeMaterialVersion = previewMaterial ? materialVersion(previewMaterial) : undefined;
  const materialPreviewUrl = activeMaterialVersion?.url ?? previewMaterial?.externalUrl ?? "";
  const materialPreviewKind = previewMaterial
    ? previewMaterial.fileType === "png" || previewMaterial.fileType === "image"
      ? "image"
      : previewMaterial.fileType === "wav" || previewMaterial.fileType === "mp3"
        ? "audio"
        : materialPreviewUrl.endsWith(".html") || materialPreviewUrl.endsWith(".pdf")
          ? "frame"
          : "external"
    : "external";

  const libraryMaterials = state.materials
    .filter((material) => material.status === "published")
    .filter((material) => {
      if (materialView === "all" || !materialPhase) return true;
      return state.materialRefs.some((ref) => ref.materialId === material.id && ref.phase === materialPhase);
    })
    .filter((material) => !materialQuery || material.title.toLowerCase().includes(materialQuery.toLowerCase()) || material.description.toLowerCase().includes(materialQuery.toLowerCase()));
  const attachedIds = materialPhase ? materialsByPhase(materialPhase).map((item) => item.material.id) : [];

  return (
    <>
      <div className="design-page-backbar">
        <Button className="design-back-button" variant="secondary" size="sm" onClick={() => navigate(backPath)}>
          <ArrowLeft size={16} /> {backLabel}
        </Button>
      </div>

      <Card className="design-hero">
        <div className="design-hero-body">
          <span className="design-hero-accent" style={{ background: lesson.color }} />
          <div className="design-hero-time">
            <span className="design-hero-zone">{timeZoneLabel(displayTimeZone)}</span>
            <span className="design-hero-date">
              {sessionDate.date}
              <em>{sessionDate.weekday}</em>
            </span>
            <strong>{formatRange(session.startAt, session.endAt, displayTimeZone, state.ui.language)}</strong>
          </div>
          <div className="design-hero-copy">
            <div className="design-hero-primary">
              <div className="design-hero-heading">
                <div className="design-hero-title">
                  <h2>{lesson.title}</h2>
                  {session.source === "series" && <Badge tone="blue">系列班</Badge>}
                </div>
                <span className={`design-hero-status is-${sessionStatus.key}`}>{sessionStatus.label}</span>
              </div>
              {course && <p className="design-hero-course">{course.name}</p>}
              <p className="design-hero-class"><GraduationCap size={14} /> {session.className}</p>
            </div>
            <div className="design-hero-meta">
              {teacher && (
                <span className="design-hero-teacher">
                  <Avatar label={teacher.avatar} size="sm" tone="orange" />
                  <strong>{teacher.name}</strong> 老师
                </span>
              )}
              <span><UsersRound size={14} /> 应到 <strong>{expected}</strong> 人</span>
              <span><MapPin size={14} /> {session.roomLabel}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="content-filter-bar design-tab-bar">
        <Tabs
          value={activePhase}
          onChange={changePhase}
          items={PHASES.map((item) => ({
            value: item.phase,
            label: item.label,
            count: phaseStat(item.phase).sets + phaseStat(item.phase).materials
          }))}
        />
        <div className="design-tab-tools">
          <span className="design-tab-hint">{currentPhase.hint}（{currentPhase.open}）</span>
          {!readOnly && (
            <Button
              className="design-save-button"
              size="sm"
              variant={designSaved ? "soft" : "primary"}
              onClick={saveDesign}
            >
              <Save size={15} /> {designSaved ? "已保存" : "保存"}
            </Button>
          )}
        </div>
      </Card>

      <div className="design-workspace">
        <Card className="design-workspace-column design-materials-column">
          <div className="design-panel-head design-panel-head-stacked">
            <div className="design-panel-heading-row">
              <div>
                <span className="eyebrow">Courseware</span>
                <h2>课件</h2>
              </div>
              {!readOnly && (
                <div className="design-panel-actions">
                  <PmNote kind="流程" note="上传后文件会成为材料库中的新课件，并加入当前课次的所选阶段。">
                    <Button size="sm" variant="secondary" onClick={() => setUploadOpen(true)}>
                      <UploadCloud size={15} /> 上传课件
                    </Button>
                  </PmNote>
                  <PmNote kind="流程" note="点击后从材料库选择文件；引入时决定它只服务本节课，还是覆盖整个课节。">
                    <Button size="sm" variant="soft" onClick={() => openMaterialLibrary(activePhase)}>
                      <LibraryBig size={15} /> 引入课件
                    </Button>
                  </PmNote>
                </div>
              )}
            </div>
          </div>

          <PmNote block kind="规则" note="未选择课次时覆盖全部课次和后续新课次；指定课次后只作用于勾选项。">
            <div className="design-item-list">
            {currentMaterials.map(({ ref, material }) => {
              const Icon = materialIcon(material);
              return (
                <article className="design-item" key={ref.id}>
                  <span className={`material-icon material-${material.fileType}`}><Icon size={18} /></span>
                  <div className="design-item-copy">
                    <strong>{material.title}</strong>
                    <div className="design-item-meta">
                      <span>{(material.fileType || "file").toUpperCase()} · {materialVersion(material)?.sizeLabel ?? "外链"}</span>
                      <span className="design-scope-chip">{scopeLabel(ref, session.id)}</span>
                    </div>
                  </div>
                  <div className="design-item-actions">
                    <Button size="sm" variant="ghost" onClick={() => setPreviewMaterial(material)}><Eye size={15} /> 查看</Button>
                    {!readOnly && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setScopeMaterial(material)}><SlidersHorizontal size={15} /> 配置</Button>
                        <Button size="sm" variant="ghost" className="danger-ghost" onClick={() => { setRemoveScope("session"); setRemoveTarget({ kind: "material", ref, material }); }}>
                          移出
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
            {currentMaterials.length === 0 && (
              <p className="design-empty">
                {readOnly ? "这个阶段没有课件。" : "这个阶段还没有课件，可上传新课件或从材料库引入。"}
              </p>
            )}
            {currentMaterials.length > 0 && (
              <p className="design-panel-foot">标记「全课次共用」的材料会出现在同一课节的每一节课次</p>
            )}
            </div>
          </PmNote>
        </Card>

        <Card className="design-workspace-column design-rounds-column">
          <div className="design-panel-head design-panel-head-stacked">
            <div className="design-panel-heading-row">
              <div>
                <span className="eyebrow">Rounds</span>
                <h2>{phaseWorkTitle}</h2>
              </div>
              {!readOnly && (
                <div className="design-panel-actions">
                  <PmNote kind="流程" note="点击后创建新的互动轮次；保存发布后学生才能看到。">
                    <Button size="sm" onClick={() => openEditor(activePhase, null)}>
                      <Layers3 size={15} /> 新建互动轮次
                    </Button>
                  </PmNote>
                  <PmNote kind="流程" note="从互动库复制一份到本节课；之后修改副本不会影响库里的母版。">
                    <Button variant="secondary" size="sm" onClick={() => { setLibraryQuery(""); setLibraryOpen(true); }}>
                      <LibraryBig size={15} /> 从互动库添加
                    </Button>
                  </PmNote>
                  <PmNote kind="流程" note="模板会复制成一个新的轮次，只配置到本节课。">
                    <Button variant="ghost" size="sm" onClick={() => openTemplateLibrary(activePhase)}>
                      <LibraryBig size={15} /> 从模板库选用
                    </Button>
                  </PmNote>
                </div>
              )}
            </div>
          </div>

          <PmNote block kind="规则" note="配置决定轮次出现在哪些课次；点击「移出」可选择只移出本次课，或移出该课节全部课次。设计仍保留在互动设计库。">
            <div className="design-round-list">
            {currentSets.map((set, index) => {
              const version = getCurrentInteractionVersion(state, set);
              const items = version?.items ?? [];
              const isSelected = selectedRound?.id === set.id;
              return (
                <article className={`design-round-card ${isSelected ? "is-selected" : ""}`} key={set.id}>
                  <div className="design-round-top">
                    <div className="design-round-main">
                      <button
                        type="button"
                        className="design-round-select"
                        onClick={() => { setSelectedRoundId(set.id); setSelectedItemId(""); }}
                        aria-label={`选择第 ${index + 1} 轮：${set.title}`}
                        aria-pressed={isSelected}
                      >
                        <span className="design-round-index">#{index + 1}</span>
                      </button>
                      {readOnly ? (
                        <strong className="design-round-title-static">{set.title}</strong>
                      ) : (
                        <RoundTitleInput
                          value={set.title}
                          onFocus={() => { setSelectedRoundId(set.id); setSelectedItemId(""); }}
                          onCommit={(title) => renameRound(set, title)}
                        />
                      )}
                    </div>
                    {!readOnly && (
                      <div className="design-round-actions">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`另存到互动库 ${set.title}`}
                          title="另存到互动库"
                          onClick={() => saveRoundToLibrary(set)}
                        >
                          <Save size={14} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="danger-ghost"
                          aria-label={`移出轮次 ${set.title}`}
                          title="移出轮次"
                          onClick={() => { setRemoveScope("session"); setRemoveTarget({ kind: "interaction", set }); }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="design-round-question-list">
                    {items.map((item, itemIndex) => {
                      const isItemSelected = isSelected && selectedItem?.id === item.id;
                      return (
                        <div key={item.id} className={`design-round-question-row ${isItemSelected ? "is-selected" : ""}`}>
                          <button
                            type="button"
                            className="design-round-question-main"
                            onClick={() => { setSelectedRoundId(set.id); setSelectedItemId(item.id); }}
                            aria-pressed={isItemSelected}
                          >
                            <span className="design-round-question-number">{itemIndex + 1}</span>
                            <span className="design-round-question-type">{interactionTypeShortLabel(item.type)}</span>
                            <strong>{item.prompt || "未填写题干"}</strong>
                          </button>
                          {!readOnly && (
                            <div className="design-round-question-actions">
                              <button
                                type="button"
                                className="design-row-icon"
                                aria-label={`上移题目 ${item.prompt || itemIndex + 1}`}
                                title="上移"
                                disabled={itemIndex === 0}
                                onClick={() => moveQuestion(set, item.id, -1)}
                              >
                                <ArrowUp size={12} />
                              </button>
                              <button
                                type="button"
                                className="design-row-icon"
                                aria-label={`下移题目 ${item.prompt || itemIndex + 1}`}
                                title="下移"
                                disabled={itemIndex === items.length - 1}
                                onClick={() => moveQuestion(set, item.id, 1)}
                              >
                                <ArrowDown size={12} />
                              </button>
                              <button
                                type="button"
                                className="design-row-icon is-danger"
                                aria-label={`删除题目 ${item.prompt || itemIndex + 1}`}
                                title="删除题目"
                                onClick={() => setRemoveTarget({ kind: "question", set, item })}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {items.length === 0 && <p className="design-round-question-empty">这一轮还没有题目</p>}
                    {!readOnly && (
                      <button type="button" className="design-round-add-question" onClick={() => openEditor(set.phase, set)}>
                        ＋ 加题
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
            {currentSets.length === 0 && (
              <div className="design-empty design-round-empty">
                <strong>还没有{phaseWorkTitle}</strong>
                {readOnly ? (
                  <p>这个阶段没有互动内容。</p>
                ) : (
                  <>
                    <p>先新建一个轮次，再往这一轮里加题；也可以从模板库复制一套现成互动。</p>
                    <Button variant="soft" size="sm" onClick={() => openEditor(activePhase, null)}>
                      <Layers3 size={15} /> 创建第一个轮次
                    </Button>
                  </>
                )}
              </div>
            )}
            {currentSets.length > 0 && (
              <p className="design-panel-foot">共 {currentSets.length} 轮</p>
            )}
            </div>
          </PmNote>
        </Card>

        <Card className="design-workspace-column design-editor-column">
          <div className="design-panel-head">
            <div>
              <span className="eyebrow">Question editor</span>
              <h2>{readOnly ? "题目详情" : "题目编辑"}</h2>
            </div>
          </div>

          {selectedRound ? (
            <>
              <div className="design-editor-round">
                <span className="design-round-index">#{selectedRoundIndex + 1}</span>
                <span>
                  <strong>{selectedRound.title}</strong>
                </span>
              </div>

              {selectedItems.length > 0 && selectedItem ? (
                <>
                  <div className="design-question-detail">
                    <div className="design-question-detail-head">
                      <Badge tone="purple">{interactionTypeLabel(selectedItem.type)}</Badge>
                      <span>第 {selectedItemIndex + 1} 题</span>
                    </div>
                    <strong>{selectedItem.prompt || "未填写题干"}</strong>
                    <p className={selectedItem.explanation ? "" : "is-muted"}>
                      <span>解析</span>
                      {selectedItem.explanation || "还没有填写解析。"}
                    </p>
                  </div>
                </>
              ) : (
                <div className="design-empty design-editor-empty">
                  <strong>这一轮还没有题目</strong>
                  <p>{readOnly ? "这一轮在本节课中没有题目。" : "从中栏轮次底部点「加题」，或在完整编辑器里添加第一道题。"}</p>
                </div>
              )}
            </>
          ) : (
            <div className="design-empty design-editor-empty">
              <strong>先选一个轮次</strong>
              <p>{readOnly ? "这节课没有留下可查看的互动轮次。" : "左侧新建或选中互动轮次后，这里会列出该轮里的题目。"}</p>
            </div>
          )}
        </Card>
      </div>

      <InteractionSetEditorModal
        open={Boolean(editorSeed)}
        set={editorSeed?.set ?? null}
        defaultLessonId={lesson.id}
        defaultPhase={editorSeed?.phase ?? activePhase}
        lockLesson
        teacherId={user.id}
        pendingSessionIds={editorSeed?.set ? [] : [session.id]}
        onClose={() => setEditorSeed(null)}
      />

      <Modal
        open={libraryOpen}
        title={`从互动库添加 · ${currentPhase.label}`}
        onClose={() => setLibraryOpen(false)}
        width="880px"
      >
        <p className="muted-copy">
          选择一轮互动，复制一份到本节课。副本可以独立改题，不会影响互动库里的母版。
        </p>
        <div className="search-box" style={{ marginBottom: 16 }}>
          <Search size={17} />
          <TextInput
            value={libraryQuery}
            onChange={(event) => setLibraryQuery(event.target.value)}
            placeholder="搜索互动名称或标签"
          />
        </div>
        <div className="template-grid">
          {filteredLibrarySets.map((set) => {
            const version = getCurrentInteractionVersion(state, set);
            const items = version?.items ?? [];
            return (
              <article key={set.id} className="template-card">
                <div className="template-card-head">
                  <span className={`phase-badge phase-${set.phase}`}>
                    {set.phase === "preview" ? "预习" : set.phase === "live" ? "课中" : "复习"}
                  </span>
                  <Badge tone="neutral">{items.length} 道题</Badge>
                </div>
                <strong>{set.title}</strong>
                <small>{(set.tags ?? []).join(" · ") || "互动库内容"}</small>
                <div className="template-tags">
                  {[...new Set(items.map((item) => item.type))].slice(0, 3).map((type) => (
                    <span key={type}>{interactionTypeShortLabel(type)}</span>
                  ))}
                </div>
                <Button size="sm" variant="secondary" onClick={() => copyFromLibrary(set)}>
                  复制到本节课
                </Button>
              </article>
            );
          })}
        </div>
        {filteredLibrarySets.length === 0 && (
          <EmptyState title="互动库里还没有内容" description="先到互动库新建一轮，或换个关键词再试。" />
        )}
      </Modal>

      <Modal
        open={Boolean(removeTarget)}
        title={
          removeTarget?.kind === "interaction"
            ? `移出互动 · ${removeTarget.set.title}`
            : removeTarget?.kind === "question"
              ? `删除题目 · ${removeTarget.item.prompt || "未填写题干"}`
              : removeTarget
                ? `移出材料 · ${removeTarget.material.title}`
                : "移出内容"
        }
        onClose={() => setRemoveTarget(null)}
        width="560px"
        footer={
          <div className="modal-footer-split">
            <small>
              {removeTarget?.kind === "question"
                ? "删除后会发布新版本，历史版本仍可追溯"
                : "只影响课堂配置，不会删除材料或互动本身"}
            </small>
            <div>
              <Button variant="ghost" onClick={() => setRemoveTarget(null)}>取消</Button>
              <Button variant="danger" onClick={confirmRemove}>
                {removeTarget?.kind === "question" ? "确认删除" : "确认移出"}
              </Button>
            </div>
          </div>
        }
      >
        {removeTarget?.kind === "question" ? (
          <p className="muted-copy">这道题会从当前互动轮次中删除，并同步给使用该设计的课次。</p>
        ) : (
          <>
            <p className="muted-copy">请选择移出范围，移出后内容仍会保留在材料库或互动库中。</p>
            <div className="remove-scope-grid" role="radiogroup" aria-label="移出范围">
              <button
                type="button"
                className={removeScope === "session" ? "active" : ""}
                onClick={() => setRemoveScope("session")}
                role="radio"
                aria-checked={removeScope === "session"}
              >
                <span className="remove-scope-radio" />
                <span className="remove-scope-copy">
                  <strong>从本次课移出</strong>
                  <small>只影响当前课次，其它课次保持原样。</small>
                </span>
              </button>
              <button
                type="button"
                className={removeScope === "lesson" ? "active" : ""}
                onClick={() => setRemoveScope("lesson")}
                role="radio"
                aria-checked={removeScope === "lesson"}
              >
                <span className="remove-scope-radio" />
                <span className="remove-scope-copy">
                  <strong>从该课节全部课次移出</strong>
                  <small>当前课节的所有课次都不再显示。</small>
                </span>
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={uploadOpen}
        title="上传课件"
        onClose={() => setUploadOpen(false)}
        width="560px"
        footer={
          <div className="modal-footer-split">
            <small>上传后自动加入{currentPhase.label}</small>
            <div>
              <Button variant="ghost" onClick={() => setUploadOpen(false)}>取消</Button>
              <Button disabled={!uploadForm.title.trim()} onClick={saveCoursewareUpload}>上传并加入</Button>
            </div>
          </div>
        }
      >
        <div className="editor-grid">
          <Field label="课件标题" className="field-span-2">
            <TextInput
              value={uploadForm.title}
              onChange={(event) => setUploadForm((value) => ({ ...value, title: event.target.value }))}
              placeholder="例如：问候句型速查卡"
            />
          </Field>
          <Field label="文件类型">
            <Select
              value={uploadForm.fileType}
              onChange={(event) => setUploadForm((value) => ({ ...value, fileType: event.target.value, fileName: "" }))}
            >
              <option value="pptx">PPTX</option>
              <option value="pdf">PDF</option>
              <option value="png">图片</option>
              <option value="wav">音频</option>
              <option value="video">视频</option>
            </Select>
          </Field>
          <Field label="加入位置">
            <div className="editor-static-field">{currentPhase.label}</div>
          </Field>
        </div>
        <div
          className="mock-upload-zone"
          onClick={() => setUploadForm((value) => ({
            ...value,
            fileName: value.fileName || `demo-upload.${value.fileType === "video" ? "mp4" : value.fileType}`
          }))}
        >
          <UploadCloud size={30} />
          <strong>{uploadForm.fileName || "点击选择演示文件"}</strong>
          <small>原型只保存文件元数据</small>
        </div>
      </Modal>

      <MaterialScopeModal
        open={Boolean(scopeMaterial)}
        state={state}
        session={session}
        phase={activePhase}
        material={scopeMaterial}
        teacherId={user.id}
        onClose={() => setScopeMaterial(null)}
      />

      <Modal
        open={Boolean(previewMaterial)}
        title={previewMaterial?.title ?? "材料预览"}
        onClose={() => setPreviewMaterial(null)}
        width="980px"
        footer={
          <div className="modal-footer-split">
            <span>{activeMaterialVersion?.sizeLabel ?? "外链"} · {previewMaterial?.downloadCount ?? 0} 次下载</span>
            <div>
              <Button variant="ghost" onClick={() => setPreviewMaterial(null)}>关闭</Button>
              {materialPreviewUrl && <Button onClick={() => window.open(materialPreviewUrl, "_blank", "noopener,noreferrer")}>在新窗口打开</Button>}
            </div>
          </div>
        }
      >
        <p className="muted-copy">{previewMaterial?.description}</p>
        {materialPreviewUrl && materialPreviewKind === "frame" && <iframe className="material-preview-frame" src={materialPreviewUrl} title={previewMaterial?.title} />}
        {materialPreviewUrl && materialPreviewKind === "image" && <img className="material-preview-image" src={materialPreviewUrl} alt={previewMaterial?.title} />}
        {materialPreviewUrl && materialPreviewKind === "audio" && <audio className="material-preview-audio" src={materialPreviewUrl} controls />}
        {materialPreviewKind === "external" && (
          <div className="material-preview-placeholder">
            <FileText size={26} />
            <strong>{(previewMaterial?.fileType ?? "file").toUpperCase()} 材料</strong>
            <small>该类型无法内嵌预览，可在新窗口打开查看。</small>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(materialPhase)}
        title={`从材料库引入 · ${PHASES.find((item) => item.phase === materialPhase)?.label ?? ""}`}
        onClose={() => setMaterialPhase(null)}
        width="860px"
        footer={
          <div className="modal-footer-split">
            <span>已选 {materialSelection.length} 个材料</span>
            <div className="material-import-footer-actions">
              <div className="scope-choice">
                <button className={materialScope === "session" ? "active" : ""} onClick={() => setMaterialScope("session")}>仅本节课</button>
                <button className={materialScope === "lesson" ? "active" : ""} onClick={() => setMaterialScope("lesson")}>该课节全部课次</button>
              </div>
              <Button variant="ghost" onClick={() => setMaterialPhase(null)}>取消</Button>
              <PmNote kind="流程" note="点击后把所选材料关联到当前课节阶段，并按作用范围立即发布。">
                <Button disabled={materialSelection.length === 0} onClick={confirmMaterials}>
                  {materialScope === "session" ? "引入到本节课" : "引入到该课节全部课次"}
                </Button>
              </PmNote>
            </div>
          </div>
        }
      >
        <div className="material-library-toolbar">
          <div className="search-box">
            <Search size={17} />
            <TextInput value={materialQuery} onChange={(event) => setMaterialQuery(event.target.value)} placeholder="搜索材料名称或说明" />
          </div>
          <div className="scope-choice">
            <button className={materialView === "phase" ? "active" : ""} onClick={() => setMaterialView("phase")}>
              仅看{PHASES.find((item) => item.phase === materialPhase)?.label ?? "当前阶段"}材料
            </button>
            <button className={materialView === "all" ? "active" : ""} onClick={() => setMaterialView("all")}>
              查看全部材料
            </button>
          </div>
        </div>
        <div className="assign-session-list">
          {libraryMaterials.map((material) => {
            const attached = attachedIds.includes(material.id);
            const checked = materialSelection.includes(material.id);
            const Icon = materialIcon(material);
            return (
              <div
                key={material.id}
                className={`assign-session-row assign-session-row-material ${checked ? "selected" : ""} ${attached ? "is-disabled" : ""}`}
              >
                <input
                  id={`material-choice-${material.id}`}
                  type="checkbox"
                  disabled={attached}
                  checked={checked}
                  onChange={() =>
                    setMaterialSelection((value) => (checked ? value.filter((id) => id !== material.id) : [...value, material.id]))
                  }
                />
                <label className="assign-session-row-material-choice" htmlFor={`material-choice-${material.id}`}>
                  <span className={`material-icon material-${material.fileType}`}><Icon size={18} /></span>
                  <span className="assign-session-copy">
                    <strong>{material.title}</strong>
                    <small>{material.description}</small>
                  </span>
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="material-preview-button"
                  onClick={() => setPreviewMaterial(material)}
                >
                  <Eye size={15} /> 预览
                </Button>
                {attached ? <Badge tone="mint">本阶段已引入</Badge> : <Badge tone="neutral">{(material.fileType || "file").toUpperCase()}</Badge>}
              </div>
            );
          })}
          {libraryMaterials.length === 0 && <p className="muted-copy">材料库里没有匹配的材料，可以先去材料库上传。</p>}
        </div>
      </Modal>

      <Modal
        open={Boolean(importPhase)}
        title={`从互动模板库引入 · ${PHASES.find((item) => item.phase === importPhase)?.label ?? ""}`}
        onClose={() => setImportPhase(null)}
        width="900px"
        footer={
          <div className="modal-footer-split">
            <span>已选 {importSelection.length} 套模板</span>
            <div>
              <Button variant="ghost" onClick={() => setImportPhase(null)}>取消</Button>
              <PmNote kind="流程" note="点击后复制成新互动，只配置到本节课，原模板和其他课次不变。">
                <Button disabled={importSelection.length === 0} onClick={confirmImport}>
                  引入到本节课（{importSelection.length}）
                </Button>
              </PmNote>
            </div>
          </div>
        }
      >
        <p className="muted-copy">
          共 {state.interactionRoundTemplates.length} 轮互动模板，按教学场景、主题和难度挑选。选中的模板会整轮复制成
          {PHASES.find((item) => item.phase === importPhase)?.label ?? "该阶段"}的互动设计，只配置到本节课，模板库本身不受影响。
        </p>

        <div className="material-library-toolbar">
          <div className="search-box">
            <Search size={17} />
            <TextInput
              value={templateQuery}
              onChange={(event) => { setTemplateQuery(event.target.value); setTemplateVisible(12); }}
              placeholder="搜索模板主题，例如「餐厅」「天气」"
            />
          </div>
          <Select
            className="sort-select"
            value={templateLevel}
            onChange={(event) => { setTemplateLevel(event.target.value as InteractionTemplateLevel | "all"); setTemplateVisible(12); }}
            aria-label="模板难度"
          >
            <option value="all">全部难度</option>
            <option value="beginner">初级</option>
            <option value="intermediate">中级</option>
            <option value="advanced">高级</option>
          </Select>
          <span className="design-template-count">匹配 {libraryTemplates.length} 轮</span>
        </div>

        <InteractionRoundTemplateChips
          templates={state.interactionRoundTemplates}
          value={templateScenario}
          onChange={(next) => { setTemplateScenario(next); setTemplateVisible(12); }}
        />

        <div className="assign-session-list design-template-list">
          {libraryTemplates.slice(0, templateVisible).map((template) => {
            const checked = importSelection.includes(template.id);
            const questionTemplates = roundTemplateQuestionTemplates(template, state.interactionTemplates);
            const types = [...new Set(questionTemplates.map((item) => item.item.type))];
            return (
              <label key={template.id} className={`assign-session-row ${checked ? "selected" : ""}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => setImportSelection((value) => (checked ? value.filter((id) => id !== template.id) : [...value, template.id]))}
                />
                <span className="assign-session-copy">
                  <strong>{template.title}</strong>
                  <small>{template.summary}</small>
                </span>
                <span className="design-template-tags">
                  <Badge tone="purple">{questionTemplates.length} 道题</Badge>
                  <Badge tone="neutral">{templateLevelLabel(template.level)}</Badge>
                  <Badge tone="blue">{template.topic}</Badge>
                  <Badge tone="mint">{types.slice(0, 2).map(interactionTypeShortLabel).join(" · ")}</Badge>
                </span>
              </label>
            );
          })}
          {libraryTemplates.length === 0 && <p className="muted-copy">没有匹配的互动模板，换个教学场景、难度或关键词再试。</p>}
        </div>

        {libraryTemplates.length > templateVisible && (
          <div className="template-more">
            <Button variant="ghost" size="sm" onClick={() => setTemplateVisible((value) => value + 12)}>
              显示更多（还有 {libraryTemplates.length - templateVisible} 轮）
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
