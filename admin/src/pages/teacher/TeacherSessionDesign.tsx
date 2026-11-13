import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarClock,
  Check,
  ChevronDown,
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
  Shapes,
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
  InteractionType,
  LessonMaterialRef,
  Material,
  Phase
} from "../../domain/types";
import { Avatar, Badge, Button, Card, EmptyState, Field, Modal, ProgressBar, Select, Tabs, TextInput } from "../../components/ui";
import {
  InteractionEditor,
  changeInteractionItemType,
  createInteractionItem,
  INTERACTION_TYPE_OPTIONS
} from "../../components/InteractionEditor";
import { StudentPhonePreview } from "../../components/InteractionPlayer";
import { PmNote } from "../../components/PmNote";
import { interactionTypeLabel, interactionTypeShortLabel } from "../../lib/interactionTypes";
import { roundTemplateQuestionTemplates } from "../../lib/roundTemplates";
import { InteractionRoundTemplateChips } from "../../components/InteractionRoundTemplateChips";
import { templateToItem } from "../../components/InteractionTemplatePicker";

const PHASES: Array<{ phase: Phase; label: string; short: string; hint: string; open: string }> = [
  { phase: "preview", label: "课前预习", short: "课前", hint: "提前熟悉词汇与句型，学生上课前完成。", open: "上课前开放" },
  { phase: "live", label: "课中互动", short: "课中", hint: "课堂投屏使用，老师按节奏逐个开启。", open: "课堂中开放" },
  { phase: "review", label: "课后复习", short: "课后", hint: "课堂结束后延续练习与巩固。", open: "下课后开放" }
];

type PendingDesignAction = {
  label: string;
  run: () => void;
};

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
function RoundTitleInput({
  value,
  onFocus,
  onCommit,
  autoFocus = false,
  onAutoFocus
}: {
  value: string;
  onFocus: () => void;
  onCommit: (title: string) => void;
  autoFocus?: boolean;
  onAutoFocus?: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const cancelledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
    inputRef.current?.select();
    onAutoFocus?.();
  }, [autoFocus]);

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
      ref={inputRef}
      className="design-round-title-input"
      value={draft}
      aria-label={`轮次名称：${value}`}
      placeholder="轮次主题"
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

const QUESTION_TYPE_GROUPS: Array<{ label: string; types: InteractionType[] }> = [
  { label: "基础题型", types: ["choice", "picture", "match", "memory", "order", "fill", "poll"] },
  { label: "句子与练习", types: ["situation", "dialogue", "pinyin-match", "category", "word-build", "correction", "listening"] },
  { label: "口语表达", types: ["read-aloud", "picture-talk", "open-qa"] }
];

/** 加题时在右栏选择题型；选中后直接进入该题的编辑状态。 */
function QuestionTypePicker({
  onPick,
  onCancel
}: {
  onPick: (type: InteractionType) => void;
  onCancel: () => void;
}) {
  return (
    <div className="design-question-type-picker">
      <div className="design-question-type-picker-head">
        <p>选一种题型开始编辑</p>
        <Button size="sm" variant="ghost" onClick={onCancel}>取消</Button>
      </div>
      {QUESTION_TYPE_GROUPS.map((group) => (
        <section className="design-question-type-group" key={group.label}>
          <h3>{group.label}</h3>
          <div className="design-question-type-grid">
            {group.types.map((type) => {
              const option = INTERACTION_TYPE_OPTIONS.find((item) => item.type === type);
              if (!option) return null;
              return (
                <button type="button" className="design-question-type-card" key={type} onClick={() => onPick(type)}>
                  <strong>{option.label}</strong>
                  <span>{option.hint}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
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
  const [addingToRoundId, setAddingToRoundId] = useState("");
  const [focusRoundId, setFocusRoundId] = useState("");
  const [questionDraft, setQuestionDraft] = useState<{ roundId: string; item: InteractionItem; dirty: boolean } | null>(null);
  const [questionPreviewOpen, setQuestionPreviewOpen] = useState(false);
  const [questionTypeOpen, setQuestionTypeOpen] = useState(false);
  const questionTypeMenuRef = useRef<HTMLDivElement>(null);
  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: "", fileType: "pptx", fileName: "" });
  const [materialPhase, setMaterialPhase] = useState<Phase | null>(null);
  const [materialSelection, setMaterialSelection] = useState<string[]>([]);
  const [materialScope, setMaterialScope] = useState<"session" | "lesson">("session");
  const [materialQuery, setMaterialQuery] = useState("");
  const [materialView, setMaterialView] = useState<"phase" | "all">("phase");
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [addExistingTab, setAddExistingTab] = useState<"library" | "templates">("library");
  const [importSelection, setImportSelection] = useState<string[]>([]);
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateScenario, setTemplateScenario] = useState<InteractionRoundScenario | "all">("all");
  const [templateVisible, setTemplateVisible] = useState(12);
  const [scopeMaterial, setScopeMaterial] = useState<Material | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ ref: LessonMaterialRef; material: Material } | null>(null);
  const [removeScope, setRemoveScope] = useState<"session" | "lesson">("session");
  const [designSaved, setDesignSaved] = useState(false);
  const [pendingDesignAction, setPendingDesignAction] = useState<PendingDesignAction | null>(null);
  const [libraryQuery, setLibraryQuery] = useState("");

  const questionDraftDirty = Boolean(questionDraft?.dirty);

  useEffect(() => {
    if (!designSaved) return;
    const timer = window.setTimeout(() => setDesignSaved(false), 1800);
    return () => window.clearTimeout(timer);
  }, [designSaved]);

  useEffect(() => {
    if (!questionDraftDirty) return;
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [questionDraftDirty]);

  useEffect(() => {
    if (!questionDraftDirty) return;
    function interceptInternalLink(event: MouseEvent) {
      if (event.defaultPrevented) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href.startsWith("#/") || href === window.location.hash) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingDesignAction({
        label: "离开当前设计页",
        run: () => navigate(href.slice(1))
      });
    }
    document.addEventListener("click", interceptInternalLink, true);
    return () => document.removeEventListener("click", interceptInternalLink, true);
  }, [navigate, questionDraftDirty]);

  useEffect(() => {
    if (!questionTypeOpen) return;
    function closeOnOutside(event: PointerEvent) {
      if (!questionTypeMenuRef.current?.contains(event.target as Node)) setQuestionTypeOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setQuestionTypeOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [questionTypeOpen]);

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
        .filter((set) => set.scope === "library" && !set.deletedAt)
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
      const queryMatch =
        !keyword ||
        template.title.toLowerCase().includes(keyword) ||
        template.topic.toLowerCase().includes(keyword) ||
        template.summary.toLowerCase().includes(keyword) ||
        template.tags.join(" ").toLowerCase().includes(keyword);
      return scenarioMatch && queryMatch;
    });
  }, [state.interactionRoundTemplates, templateQuery, templateScenario]);

  const accessDenied = Boolean(!operatorView && session && session.teacherId !== user.id);
  if (!session || !lesson || accessDenied) {
    return (
      <EmptyState
        title={accessDenied ? "无权访问该课次" : "课程不存在"}
        description={accessDenied ? "这个课次不属于当前老师，请返回自己的课表。" : "请返回课表重新选择。"}
        action={<Button onClick={() => navigate(backPath)}>{backLabel}</Button>}
      />
    );
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
  const activeQuestionDraft = selectedRound && selectedItem
    ? (questionDraft && questionDraft.roundId === selectedRound.id && questionDraft.item.id === selectedItem.id
        ? questionDraft
        : { roundId: selectedRound.id, item: selectedItem, dirty: false })
    : null;
  const previewQuestion = activeQuestionDraft?.item ?? selectedItem;
  const phaseWorkTitle = activePhase === "preview" ? "预习练习" : activePhase === "review" ? "复习练习" : "互动轮次";

  function guardQuestionDraft(label: string, proceed: () => void) {
    if (!questionDraft?.dirty) {
      proceed();
      return;
    }
    setPendingDesignAction({ label, run: proceed });
  }

  function cancelPendingDesignAction() {
    setPendingDesignAction(null);
  }

  function resolvePendingDesignAction(save: boolean) {
    const pending = pendingDesignAction;
    if (!pending) return;
    if (save && !commitQuestionDraft()) return;
    setPendingDesignAction(null);
    if (!save) setQuestionDraft(null);
    pending.run();
  }

  function changePhase(phase: Phase) {
    if (phase === activePhase) return;
    const phaseLabel = PHASES.find((item) => item.phase === phase)?.label ?? phase;
    guardQuestionDraft(`切换到${phaseLabel}`, () => {
      setActivePhase(phase);
      setSelectedRoundId("");
      setSelectedItemId("");
      setAddingToRoundId("");
      setQuestionDraft(null);
      setQuestionPreviewOpen(false);
      setQuestionTypeOpen(false);
    });
  }

  function saveDesign() {
    if (readOnly) return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (!commitQuestionDraft()) return;
    setDesignSaved(true);
  }

  /** 新建轮次直接落在中栏，随后由老师点「加题」选题型。 */
  function createRound(phase: Phase) {
    if (readOnly) return;
    guardQuestionDraft("新建互动轮次", () => {
      const result = run(
        () => platform.saveInteractionSet({
          lessonId: session!.lessonId,
          title: "",
          phase,
          items: [],
          actorId: user.id,
          publishNote: "新增互动轮次"
        }),
        "已新增互动轮次"
      );
      const created = result.data?.set;
      if (!result.ok || !created) return;
      run(
        () => platform.assignInteractionSessions({ setId: created.id, sessionIds: [session!.id], actorId: user.id })
      );
      setSelectedRoundId(created.id);
      setSelectedItemId("");
      setAddingToRoundId("");
      setQuestionDraft(null);
      setFocusRoundId(created.id);
    });
  }

  function selectRound(set: InteractionSet) {
    if (selectedRound?.id === set.id) return;
    guardQuestionDraft(`切换到“${set.title || "未命名轮次"}”`, () => {
      setSelectedRoundId(set.id);
      setSelectedItemId("");
      setAddingToRoundId("");
      setQuestionDraft(null);
      setQuestionPreviewOpen(false);
      setQuestionTypeOpen(false);
    });
  }

  function startAddQuestion(set: InteractionSet) {
    if (readOnly) return;
    guardQuestionDraft("开始添加题目", () => {
      setSelectedRoundId(set.id);
      setSelectedItemId("");
      setAddingToRoundId(set.id);
      setQuestionPreviewOpen(false);
      setQuestionTypeOpen(false);
    });
  }

  function selectQuestion(set: InteractionSet, item: InteractionItem) {
    if (selectedRound?.id === set.id && selectedItem?.id === item.id) return;
    guardQuestionDraft("切换题目", () => {
      setSelectedRoundId(set.id);
      setSelectedItemId(item.id);
      setAddingToRoundId("");
      setQuestionDraft(null);
      setQuestionPreviewOpen(false);
      setQuestionTypeOpen(false);
    });
  }

  function addQuestion(set: InteractionSet, type: InteractionType) {
    if (readOnly) return;
    const item = createInteractionItem(type);
    const items = [...(getCurrentInteractionVersion(state, set)?.items ?? []), item];
    const result = saveRoundItems(set, items, "新增题目", "题目已添加");
    if (!result.ok) return;
    setSelectedRoundId(set.id);
    setSelectedItemId(item.id);
    setAddingToRoundId("");
    setQuestionDraft({ roundId: set.id, item, dirty: false });
  }

  /** 题目编辑先落在本地草稿，点「保存本题」后才生成一个新版本。 */
  function commitQuestionDraft(): boolean {
    const draft = questionDraft;
    if (!draft || !draft.dirty) return true;
    const target = state.interactionSets.find((set) => set.id === draft.roundId);
    if (!target) return false;
    const persisted = getCurrentInteractionVersion(state, target)?.items ?? [];
    const exists = persisted.some((item) => item.id === draft.item.id);
    const nextItems = exists
      ? persisted.map((item) => (item.id === draft.item.id ? draft.item : item))
      : [...persisted, draft.item];
    const result = saveRoundItems(target, nextItems, "编辑题目", "题目已保存");
    if (!result.ok) return false;
    setQuestionDraft((current) =>
      current && current.item.id === draft.item.id ? { ...current, dirty: false } : current
    );
    return true;
  }

  /** 换题型保留公共内容，并等待老师手动保存。 */
  function changeQuestionType(type: InteractionType) {
    if (readOnly || !activeQuestionDraft || type === activeQuestionDraft.item.type) return;
    setDesignSaved(false);
    setQuestionDraft({
      roundId: activeQuestionDraft.roundId,
      item: changeInteractionItemType(activeQuestionDraft.item, type),
      dirty: true
    });
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
          actorId: user.id,
          publishNote: "修改轮次名称"
        }),
      "轮次名称已更新"
    );
    if (result.ok) setSelectedRoundId(set.id);
  }

  /** 只调整轮次在本节课里的上下顺序，不复制内容。 */
  function moveRound(set: InteractionSet, direction: -1 | 1) {
    if (readOnly) return;
    const index = currentSets.findIndex((item) => item.id === set.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= currentSets.length) return;
    const next = [...currentSets];
    [next[index], next[target]] = [next[target], next[index]];
    const result = run(
      () => platform.reorderInteractionSets({ ids: next.map((item) => item.id), actorId: user.id }),
      "轮次顺序已更新"
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

  /** 删除轮次：直接从该课节全部课次移除，保留互动库中的母版。 */
  function deleteRound(set: InteractionSet) {
    if (readOnly) return;
    const result = run(
      () => platform.unassignInteractionSet({ setId: set.id, actorId: user.id }),
      "轮次已删除"
    );
    if (!result.ok) return;
    if (selectedRoundId === set.id) {
      setSelectedRoundId("");
      setSelectedItemId("");
      setQuestionDraft(null);
      setQuestionPreviewOpen(false);
    }
  }

  /** 删除题目：直接写入当前轮次的新版本，不再弹确认框。 */
  function deleteQuestion(set: InteractionSet, item: InteractionItem) {
    if (readOnly) return;
    const remainingItems = (getCurrentInteractionVersion(state, set)?.items ?? []).filter(
      (current) => current.id !== item.id
    );
    const result = saveRoundItems(set, remainingItems, "删除题目", "题目已删除");
    if (!result.ok) return;
    setSelectedRoundId(set.id);
    if (selectedItemId === item.id) {
      setQuestionDraft(null);
      setSelectedItemId(remainingItems[0]?.id ?? "");
    }
  }

  function confirmRemoveMaterial() {
    if (readOnly || !removeTarget) return;
    const { ref, material } = removeTarget;
    if (removeScope === "lesson") {
      run(
        () => platform.detachMaterial({ materialId: material.id, lessonId: session!.lessonId, phase: ref.phase, actorId: user.id }),
        "已从该课节全部课次移出该材料"
      );
    } else if (ref.sessionIds && ref.sessionIds.length === 1 && ref.sessionIds[0] === session!.id) {
      // 只属于本节课的材料直接解除关联；课节共用的材料只从本节课移出。
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
    setRemoveTarget(null);
  }

  /** 互动库和模板库合并成一个入口，用弹窗里的两个标签页区分。 */
  function openAddExisting(tab: "library" | "templates" = "library") {
    if (readOnly) return;
    setAddExistingTab(tab);
    setAddExistingOpen(true);
    setImportSelection([]);
    setLibraryQuery("");
    setTemplateQuery("");
    setTemplateScenario("all");
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
    if (result.ok) setAddExistingOpen(false);
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
    if (importSelection.length === 0) return;
    const createdIds: string[] = [];
    importSelection.forEach((templateId) => {
      const template = state.interactionRoundTemplates.find((item) => item.id === templateId);
      if (!template) return;
      const items = roundTemplateQuestionTemplates(template, state.interactionTemplates).map(templateToItem);
      if (items.length === 0) return;
      const saved = platform.saveInteractionSet({
        lessonId: session!.lessonId,
        title: template.title,
        phase: activePhase,
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
    setAddExistingOpen(false);
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
        <Button
          className="design-back-button"
          variant="secondary"
          size="sm"
          onClick={() => guardQuestionDraft(backLabel, () => navigate(backPath))}
        >
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
                        <Button size="sm" variant="ghost" className="danger-ghost" onClick={() => { setRemoveScope("session"); setRemoveTarget({ ref, material }); }}>
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
                  <PmNote kind="流程" note="从我的互动库或公共模板库复制一份到本节课；修改副本不会影响原内容。">
                    <Button variant="secondary" size="sm" onClick={() => openAddExisting("library")}>
                      <LibraryBig size={15} /> 添加已有互动
                    </Button>
                  </PmNote>
                  <PmNote kind="流程" note="点击后创建新的互动轮次；保存发布后学生才能看到。">
                    <Button size="sm" onClick={() => createRound(activePhase)}>
                      <Layers3 size={15} /> 新建互动轮次
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
                        onClick={() => selectRound(set)}
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
                          autoFocus={focusRoundId === set.id}
                          onAutoFocus={() => setFocusRoundId("")}
                          onFocus={() => selectRound(set)}
                          onCommit={(title) => renameRound(set, title)}
                        />
                      )}
                    </div>
                    {!readOnly && (
                      <div className="design-round-actions">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`上移轮次 ${set.title || `#${index + 1}`}`}
                          title="上移轮次"
                          disabled={index === 0}
                          onClick={() => moveRound(set, -1)}
                        >
                          <ArrowUp size={14} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`下移轮次 ${set.title || `#${index + 1}`}`}
                          title="下移轮次"
                          disabled={index === currentSets.length - 1}
                          onClick={() => moveRound(set, 1)}
                        >
                          <ArrowDown size={14} />
                        </Button>
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
                          aria-label={`删除轮次 ${set.title}`}
                          title="删除轮次"
                          onClick={() => deleteRound(set)}
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
                            onClick={() => selectQuestion(set, item)}
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
                                onClick={() => deleteQuestion(set, item)}
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
                      <button type="button" className="design-round-add-question" onClick={() => startAddQuestion(set)}>
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
                    <Button variant="soft" size="sm" onClick={() => createRound(activePhase)}>
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
              <h2>{readOnly ? "题目详情" : addingToRoundId ? "选择题型" : "题目编辑"}</h2>
            </div>
            {addingToRoundId !== selectedRound?.id && previewQuestion && (
              <div className="design-question-editor-actions">
                {readOnly || !activeQuestionDraft ? (
                  <Badge tone="purple">{interactionTypeLabel(previewQuestion.type)}</Badge>
                ) : (
                  <div className="design-question-type-menu" ref={questionTypeMenuRef}>
                    <button
                      type="button"
                      className={`design-question-type-trigger ${questionTypeOpen ? "is-open" : ""}`}
                      aria-label="更换题型"
                      aria-haspopup="listbox"
                      aria-expanded={questionTypeOpen}
                      title="更换题型，已有公共内容会尽量保留"
                      onClick={() => setQuestionTypeOpen((value) => !value)}
                    >
                      <Shapes size={14} />
                      <span>{interactionTypeLabel(activeQuestionDraft.item.type)}</span>
                      <ChevronDown size={13} className="design-question-type-chevron" />
                    </button>
                    {questionTypeOpen && (
                      <div className="design-question-type-popover" role="listbox" aria-label="更换题型">
                        {QUESTION_TYPE_GROUPS.map((group) => (
                          <section className="design-question-type-group" key={group.label}>
                            <span className="design-question-type-group-label">{group.label}</span>
                            <div className="design-question-type-options">
                              {group.types.map((type) => {
                                const option = INTERACTION_TYPE_OPTIONS.find((item) => item.type === type);
                                const selected = type === activeQuestionDraft.item.type;
                                return (
                                  <button
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    className={`design-question-type-option ${selected ? "is-selected" : ""}`}
                                    key={type}
                                    onClick={() => {
                                      changeQuestionType(type);
                                      setQuestionTypeOpen(false);
                                    }}
                                  >
                                    <span>{option?.label ?? interactionTypeLabel(type)}</span>
                                    {selected && <Check size={13} />}
                                  </button>
                                );
                              })}
                            </div>
                          </section>
                        ))}
                        <p className="design-question-type-hint">换题型会尽量保留题干、解析、图片和选项。</p>
                      </div>
                    )}
                  </div>
                )}
                <Button size="sm" variant="secondary" aria-label="预览本题" onClick={() => setQuestionPreviewOpen(true)}>
                  <Eye size={14} /> 预览
                </Button>
                {!readOnly && activeQuestionDraft && (
                  <Button size="sm" onClick={commitQuestionDraft}>
                    <Save size={14} /> 保存本题
                  </Button>
                )}
              </div>
            )}
          </div>

          {selectedRound ? (
            <>
              <div className="design-editor-round">
                <span className="design-round-index">#{selectedRoundIndex + 1}</span>
                <span>
                  <strong>{selectedRound.title}</strong>
                </span>
              </div>

              {readOnly ? (
                selectedItems.length > 0 && selectedItem ? (
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
                  <p>这一轮在本节课中没有题目。</p>
                </div>
                )
              ) : addingToRoundId === selectedRound.id ? (
                <QuestionTypePicker
                  onPick={(type) => addQuestion(selectedRound, type)}
                  onCancel={() => setAddingToRoundId("")}
                />
              ) : activeQuestionDraft ? (
                <div className="design-question-editor">
                  <div className="design-question-editor-meta">
                    <span>第 {selectedItemIndex + 1} 题</span>
                    {activeQuestionDraft.dirty && <span className="design-question-save-state is-dirty">有未保存修改</span>}
                  </div>
                  <InteractionEditor
                    single
                    items={[activeQuestionDraft.item]}
                    activeItemId={activeQuestionDraft.item.id}
                    onChange={(nextItems) => {
                      const next = nextItems[0];
                      if (!next) return;
                      setDesignSaved(false);
                      setQuestionDraft({ roundId: selectedRound.id, item: next, dirty: true });
                    }}
                  />
                </div>
              ) : (
                <div className="design-empty design-editor-empty">
                  <strong>这一轮还没有题目</strong>
                  <p>先选一种题型，再填写题干和选项。</p>
                  <Button variant="soft" size="sm" onClick={() => startAddQuestion(selectedRound)}>
                    ＋ 加题
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="design-empty design-editor-empty">
              <strong>先选一个轮次</strong>
              <p>{readOnly ? "这节课没有留下可查看的互动轮次。" : "从中栏新建或选中轮次后，这里会显示题目编辑。"}</p>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={addExistingOpen}
        title={`添加已有互动 · ${currentPhase.label}`}
        onClose={() => setAddExistingOpen(false)}
        width="900px"
        footer={addExistingTab === "templates" ? (
          <div className="modal-footer-split">
            <span>已选 {importSelection.length} 套模板</span>
            <div>
              <Button variant="ghost" onClick={() => setAddExistingOpen(false)}>取消</Button>
              <PmNote kind="流程" note="点击后复制成新互动，只配置到本节课，原模板和其他课次不变。">
                <Button disabled={importSelection.length === 0} onClick={confirmImport}>
                  引入到本节课（{importSelection.length}）
                </Button>
              </PmNote>
            </div>
          </div>
        ) : (
          <div className="modal-footer-split">
            <span>选中的互动会复制成新轮次，只配置到本节课</span>
            <Button variant="ghost" onClick={() => setAddExistingOpen(false)}>关闭</Button>
          </div>
        )}
      >
        <Tabs
          value={addExistingTab}
          onChange={setAddExistingTab}
          items={[
            { value: "library", label: "我的互动库" },
            { value: "templates", label: "互动模板库" }
          ]}
        />

        <div className="add-existing-modal-body">
          {addExistingTab === "library" ? (
            <>
              <p className="muted-copy">
                选择一轮自己的互动，复制一份到本节课。副本可以独立改题，不会影响互动库里的母版。
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
            </>
          ) : (
            <>
              <p className="muted-copy">
                共 {state.interactionRoundTemplates.length} 轮互动模板，按教学场景和主题挑选。选中的模板会整轮复制成
                {currentPhase.label}的互动设计，只配置到本节课，模板库本身不受影响。
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
                        <Badge tone="blue">{template.topic}</Badge>
                        <Badge tone="mint">{types.slice(0, 2).map(interactionTypeShortLabel).join(" · ")}</Badge>
                      </span>
                    </label>
                  );
                })}
                {libraryTemplates.length === 0 && <p className="muted-copy">没有匹配的互动模板，换个教学场景或关键词再试。</p>}
              </div>

              {libraryTemplates.length > templateVisible && (
                <div className="template-more">
                  <Button variant="ghost" size="sm" onClick={() => setTemplateVisible((value) => value + 12)}>
                    显示更多（还有 {libraryTemplates.length - templateVisible} 轮）
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(removeTarget)}
        title={`移出材料 · ${removeTarget?.material.title ?? ""}`}
        onClose={() => setRemoveTarget(null)}
        width="560px"
        footer={
          <div className="modal-footer-split">
            <small>只影响课堂配置，不会删除材料本身</small>
            <div>
              <Button variant="ghost" onClick={() => setRemoveTarget(null)}>取消</Button>
              <Button variant="danger" onClick={confirmRemoveMaterial}>确认移出</Button>
            </div>
          </div>
        }
      >
        <p className="muted-copy">请选择移出范围，移出后材料仍会保留在材料库中。</p>
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

      <Modal
        open={questionPreviewOpen}
        title={`学生端预览 · 第 ${selectedItemIndex + 1} 题`}
        onClose={() => setQuestionPreviewOpen(false)}
        width="520px"
      >
        {previewQuestion && (
          <StudentPhonePreview items={[previewQuestion]} onClose={() => setQuestionPreviewOpen(false)} />
        )}
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
        open={Boolean(pendingDesignAction)}
        title="有未保存的题目修改"
        onClose={cancelPendingDesignAction}
        width="500px"
        footer={
          <div className="modal-footer-split modal-footer-end">
            <div>
              <Button variant="ghost" onClick={cancelPendingDesignAction}>取消</Button>
              <Button variant="secondary" onClick={() => resolvePendingDesignAction(false)}>不保存并继续</Button>
              <Button onClick={() => resolvePendingDesignAction(true)}>保存并继续</Button>
            </div>
          </div>
        }
      >
        <p className="muted-copy">
          当前题目还有修改没有保存。要{pendingDesignAction?.label ?? "继续"}，先保存这些修改吗？
        </p>
      </Modal>

    </>
  );
}
