import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  Eye,
  Save,
  Settings2,
  Shapes,
  Trash2,
  X
} from "lucide-react";
import type { InteractionItem, InteractionSet, InteractionType, Phase } from "../../domain/types";
import { currentUser, getCurrentInteractionVersion } from "../../lib/domain";
import { INTERACTION_TYPES, interactionTypeLabel, interactionTypeShortLabel } from "../../lib/interactionTypes";
import { platform } from "../../lib/platform";
import { usePlatformStore } from "../../store/usePlatformStore";
import { Badge, Button, Card, EmptyState, Modal, PageHeader } from "../../components/ui";
import {
  InteractionEditor,
  INTERACTION_TYPE_OPTIONS,
  changeInteractionItemType,
  createInteractionItem
} from "../../components/InteractionEditor";
import { InteractionSetSettingsModal, type InteractionSettingsValue } from "../../components/InteractionSetSettingsModal";
import { StudentPhonePreview } from "../../components/InteractionPlayer";

const phaseLabel: Record<Phase, string> = {
  preview: "预习",
  live: "课中",
  review: "复习"
};

const QUESTION_TYPE_GROUPS: Array<{ label: string; types: InteractionType[] }> = [
  { label: "基础题型", types: ["choice", "picture", "match", "memory", "order", "fill", "poll"] },
  { label: "句子与练习", types: ["situation", "dialogue", "pinyin-match", "category", "word-build", "correction", "listening"] },
  { label: "口语表达", types: ["read-aloud", "picture-talk", "open-qa"] }
];

interface LibraryQuestionDraft {
  item: InteractionItem;
  dirty: boolean;
}

function upsertItem(items: InteractionItem[], item: InteractionItem) {
  return items.some((current) => current.id === item.id)
    ? items.map((current) => (current.id === item.id ? item : current))
    : [...items, item];
}

export interface InteractionLibraryDraft extends InteractionSettingsValue {
  items: InteractionItem[];
  /** 公共模板在保存到个人互动库之前只读，避免看起来像在编辑母版。 */
  readOnlyTemplate?: boolean;
}

/** 独立页面入口：直接访问时使用。 */
export function TeacherInteractionLibraryEditor() {
  const { setId = "" } = useParams();
  const navigate = useNavigate();

  return (
    <InteractionLibraryEditorContent
      setId={setId}
      variant="page"
      scope="library"
      createLabel="新建互动"
      onClose={() => navigate("/teacher/interactions")}
    />
  );
}

/** 大弹窗入口：互动库卡片点击「编辑题目」时使用。 */
export function InteractionLibraryEditorModal({
  open,
  setId,
  draft,
  scope = "library",
  lessonId,
  createLabel = "新建互动",
  onTemplateSaved,
  onSaved,
  onClose
}: {
  open: boolean;
  setId?: string;
  draft?: InteractionLibraryDraft;
  scope?: "library" | "lesson";
  lessonId?: string;
  createLabel?: string;
  onTemplateSaved?: (setId: string) => void;
  onSaved?: (set: InteractionSet) => void;
  onClose: () => void;
}) {
  if (!open || (!setId && !draft)) return null;

  return (
    <Modal
      open
      title={draft ? createLabel : "编辑题目"}
      onClose={onClose}
      width="1280px"
      panelClassName="interaction-library-editor-modal"
      hideHeader
    >
      <InteractionLibraryEditorContent
        setId={setId ?? ""}
        draft={draft}
        variant="modal"
        scope={scope}
        lessonId={lessonId}
        createLabel={createLabel}
        onTemplateSaved={onTemplateSaved}
        onSaved={onSaved}
        onClose={onClose}
      />
    </Modal>
  );
}

/** 互动库母版编辑工作区：一张互动卡对应一轮，内部只编辑题目。 */
function InteractionLibraryEditorContent({
  setId,
  draft,
  variant,
  scope,
  lessonId,
  createLabel,
  onTemplateSaved,
  onSaved,
  onClose
}: {
  setId: string;
  draft?: InteractionLibraryDraft;
  variant: "page" | "modal";
  scope: "library" | "lesson";
  lessonId?: string;
  createLabel: string;
  onTemplateSaved?: (setId: string) => void;
  onSaved?: (set: InteractionSet) => void;
  onClose: () => void;
}) {
  const { state, run } = usePlatformStore();
  const user = currentUser(state);
  const isCreating = Boolean(draft);
  const libraryMode = scope === "library";
  const readOnlyTemplate = isCreating && Boolean(draft?.readOnlyTemplate);
  const set = state.interactionSets.find(
    (item) => item.id === setId && !item.deletedAt && (libraryMode ? item.scope === "library" : item.scope !== "library")
  );
  const version = set ? getCurrentInteractionVersion(state, set) : undefined;

  const [draftMeta, setDraftMeta] = useState<InteractionSettingsValue>(() => ({
    title: draft?.title ?? "",
    phase: draft?.phase ?? "live",
    tags: draft?.tags ?? []
  }));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [items, setItems] = useState<InteractionItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [questionDraft, setQuestionDraft] = useState<LibraryQuestionDraft | null>(null);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [questionTypeOpen, setQuestionTypeOpen] = useState(false);
  const [questionPreviewOpen, setQuestionPreviewOpen] = useState(false);
  const [roundTitle, setRoundTitle] = useState(draft?.title ?? "");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const questionTypeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCreating) {
      const nextItems = structuredClone(draft?.items ?? []);
      setItems(nextItems);
      setSelectedItemId(nextItems[0]?.id ?? "");
      setRoundTitle(draft?.title ?? "");
      setQuestionDraft(null);
      setAddingQuestion(false);
      setQuestionTypeOpen(false);
      setQuestionPreviewOpen(false);
      return;
    }
    if (!set) {
      setItems([]);
      setRoundTitle("");
      setQuestionDraft(null);
      return;
    }
    const current = getCurrentInteractionVersion(state, set);
    const nextItems = current ? structuredClone(current.items) : [];
    setItems(nextItems);
    setSelectedItemId((currentId) => nextItems.some((item) => item.id === currentId) ? currentId : nextItems[0]?.id ?? "");
    setRoundTitle(set.title);
    setQuestionDraft(null);
    setAddingQuestion(false);
    setQuestionTypeOpen(false);
    setQuestionPreviewOpen(false);
    // 只在切换互动或保存出新版本时，用最新母版重置工作区。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreating, set?.id, version?.id]);

  useEffect(() => {
    if (!isCreating) setRoundTitle(set?.title ?? "");
  }, [isCreating, set?.title]);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 1800);
    return () => window.clearTimeout(timer);
  }, [saved]);

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

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0] ?? null;
  const selectedIndex = selectedItem ? items.findIndex((item) => item.id === selectedItem.id) : -1;
  const activeQuestionDraft = selectedItem && questionDraft?.item.id === selectedItem.id ? questionDraft : null;
  const activeQuestion = activeQuestionDraft?.item ?? selectedItem;
  const questionDirty = Boolean(activeQuestionDraft?.dirty);
  const itemsForSave = questionDirty && activeQuestion ? upsertItem(items, activeQuestion) : items;

  function selectItem(itemId: string) {
    const item = items.find((current) => current.id === itemId);
    setSelectedItemId(itemId);
    setQuestionDraft(item ? { item: structuredClone(item), dirty: false } : null);
    setAddingQuestion(false);
    setQuestionTypeOpen(false);
    setQuestionPreviewOpen(false);
  }

  function updateSelectedItem(nextItems: InteractionItem[]) {
    const next = nextItems[0];
    if (!next) return;
    setQuestionDraft({ item: next, dirty: true });
  }

  function addItem(type: (typeof INTERACTION_TYPES)[number]) {
    const next = createInteractionItem(type);
    setItems((current) => [...current, next]);
    setSelectedItemId(next.id);
    setQuestionDraft({ item: next, dirty: false });
    setAddingQuestion(false);
    setQuestionTypeOpen(false);
    setQuestionPreviewOpen(false);
  }

  function changeQuestionType(type: InteractionType) {
    if (!activeQuestion || readOnlyTemplate || type === activeQuestion.type) {
      setQuestionTypeOpen(false);
      return;
    }
    setQuestionDraft({ item: changeInteractionItemType(activeQuestion, type), dirty: true });
    setQuestionTypeOpen(false);
  }

  function saveQuestion() {
    if (!activeQuestion || readOnlyTemplate) return;
    setItems((current) => upsertItem(current, activeQuestion));
    if (questionDraft?.item.id === activeQuestion.id) setQuestionDraft({ ...questionDraft, dirty: false });
  }

  function moveItem(itemId: string, direction: -1 | 1) {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === itemId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeItem(itemId: string) {
    const next = items.filter((item) => item.id !== itemId);
    setItems(next);
    if (selectedItemId === itemId) setQuestionDraft(null);
    if (!next.some((item) => item.id === selectedItemId)) setSelectedItemId(next[0]?.id ?? "");
  }

  const activeTitle = isCreating ? draftMeta.title : roundTitle;
  const activePhase = isCreating ? draftMeta.phase : set?.phase ?? "live";

  function save() {
    const title = activeTitle.trim() || "未命名互动";
    const result = run(
      () =>
        platform.saveInteractionSet({
          setId: set?.id,
          lessonId: libraryMode ? (set?.lessonId ?? "") : (set?.lessonId ?? lessonId ?? ""),
          scope,
          title,
          phase: activePhase,
          items: itemsForSave,
          tags: isCreating ? draftMeta.tags : set?.tags ?? [],
          actorId: user.id,
          publishNote: readOnlyTemplate
            ? "从公共模板保存到我的互动库"
            : isCreating
              ? (libraryMode ? "创建互动库母版" : "创建课堂互动轮次")
              : (libraryMode ? "编辑互动库题目" : "编辑课堂互动轮次")
        }),
      readOnlyTemplate
        ? "已保存到我的互动库，现在可以自由编辑"
        : isCreating
          ? (libraryMode ? "互动已创建并发布" : "互动轮次已加入本节课")
          : "互动已保存并发布新版本"
    );
    if (!result.ok) return;
    setItems(itemsForSave);
    if (questionDraft) setQuestionDraft({ ...questionDraft, dirty: false });
    const createdSet = result.data?.set;
    if (readOnlyTemplate && createdSet && onTemplateSaved) {
      onTemplateSaved(createdSet.id);
      return;
    }
    if (createdSet) onSaved?.(createdSet);
    setSaved(true);
    if (isCreating) onClose();
  }

  if (!set && !isCreating) {
    if (variant === "modal") {
      return <EmptyState title="找不到这条互动" description="它可能已经被删除。" action={<Button onClick={onClose}>关闭</Button>} />;
    }
    return (
      <>
        <PageHeader
          eyebrow="Interaction library"
          title="互动不存在"
          description="这条互动可能已经被删除，或者不属于当前互动库。"
          actions={<Button variant="secondary" onClick={onClose}><ArrowLeft size={16} /> 返回互动库</Button>}
        />
        <EmptyState title="找不到这条互动" description="回到互动库重新选择一条互动。" action={<Button onClick={onClose}>返回互动库</Button>} />
      </>
    );
  }

  const actions = (
    <>
      {variant === "page" && (
        <Button variant="secondary" onClick={onClose}>
          <ArrowLeft size={16} /> 返回互动库
        </Button>
      )}
      {!readOnlyTemplate && (
        <Button variant="ghost" onClick={() => setSettingsOpen(true)}>
          <Settings2 size={16} /> 互动设置
        </Button>
      )}
      <Button variant="ghost" onClick={() => setPreviewOpen(true)} disabled={itemsForSave.length === 0}>
        <Eye size={16} /> 学生预览
      </Button>
      <Button variant={saved ? "soft" : "primary"} onClick={save}>
        <Save size={16} /> {saved
          ? "已保存"
          : isCreating
            ? (libraryMode ? "保存到我的互动库" : "保存并加入本节课")
            : "保存更改"}
      </Button>
      {variant === "modal" && (
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="关闭">
          <X size={18} />
        </Button>
      )}
    </>
  );

  return (
    <>
      {variant === "page" ? (
        <PageHeader
          eyebrow="Interaction library"
          title={activeTitle || "未命名互动"}
          description={`${readOnlyTemplate ? "公共模板只读副本" : isCreating ? "新建互动库母版" : "编辑互动库母版"} · ${items.length} 道题 · ${readOnlyTemplate ? "保存后复制到你的互动库" : isCreating ? "保存后加入互动库" : "保存后不会影响已经复制到课次的副本"}`}
          actions={actions}
        />
      ) : (
        <div className="interaction-library-editor-modal-head">
          <div>
            <div className="interaction-library-editor-modal-title-row">
              <h2>{isCreating ? createLabel : "编辑互动"}</h2>
              <Badge tone="neutral">{phaseLabel[activePhase]}</Badge>
            </div>
            <p>
              {itemsForSave.length} 道题 · {readOnlyTemplate
                ? "公共模板，保存后复制到你的互动库"
                : isCreating
                  ? (libraryMode ? "保存后加入互动库" : "保存后加入本节课")
                  : (libraryMode ? "保存后只更新互动库母版" : "保存后只更新本节课副本")}
            </p>
          </div>
          <div className="interaction-library-editor-modal-actions">{actions}</div>
        </div>
      )}

      <div className="design-workspace interaction-library-editor-workspace">
        <Card className="design-workspace-column design-rounds-column interaction-library-questions-column">
          <div className="design-panel-head design-panel-head-stacked">
            <div className="design-panel-heading-row">
              <div>
                <span className="eyebrow">Rounds</span>
                <h2>互动轮次</h2>
              </div>
            </div>
          </div>

          <div className="design-round-list">
            <article className="design-round-card is-selected">
              <div className="design-round-top">
                <div className="design-round-main">
                  <button
                    type="button"
                    className="design-round-select"
                    aria-label={`选择第 1 轮：${activeTitle || "未命名互动"}`}
                    aria-pressed="true"
                    onClick={() => titleInputRef.current?.focus()}
                  >
                    <span className="design-round-index">#1</span>
                  </button>
                  <input
                    ref={titleInputRef}
                    className="design-round-title-input"
                    aria-label="互动标题"
                    value={activeTitle}
                    placeholder="轮次主题"
                    readOnly={readOnlyTemplate}
                    autoFocus={isCreating && !readOnlyTemplate}
                    onChange={(event) => {
                      const title = event.target.value;
                      if (isCreating) setDraftMeta((current) => ({ ...current, title }));
                      else setRoundTitle(title);
                    }}
                  />
                </div>
              </div>

              <div className="design-round-question-list">
                {items.map((item, index) => {
                  const isSelected = selectedItem?.id === item.id;
                  return (
                    <div key={item.id} className={`design-round-question-row ${isSelected ? "is-selected" : ""}`}>
                      <button
                        type="button"
                        className="design-round-question-main"
                        onClick={() => selectItem(item.id)}
                        aria-pressed={isSelected}
                      >
                        <span className="design-round-question-number">{index + 1}</span>
                        <span className="design-round-question-type">{interactionTypeShortLabel(item.type)}</span>
                        <strong>{item.prompt || "未填写题干"}</strong>
                      </button>
                      {!readOnlyTemplate && (
                        <div className="design-round-question-actions">
                          <button
                            type="button"
                            className="design-row-icon"
                            aria-label={`上移题目 ${item.prompt || index + 1}`}
                            title="上移"
                            disabled={index === 0}
                            onClick={() => moveItem(item.id, -1)}
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            className="design-row-icon"
                            aria-label={`下移题目 ${item.prompt || index + 1}`}
                            title="下移"
                            disabled={index === items.length - 1}
                            onClick={() => moveItem(item.id, 1)}
                          >
                            <ArrowDown size={12} />
                          </button>
                          <button
                            type="button"
                            className="design-row-icon is-danger"
                            aria-label={`删除题目 ${item.prompt || index + 1}`}
                            title="删除题目"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {items.length === 0 && <p className="design-round-question-empty">这一轮还没有题目</p>}
                {!readOnlyTemplate && (
                  <button
                    type="button"
                    className="design-round-add-question"
                    aria-label="添加题目"
                    onClick={() => {
                      setAddingQuestion(true);
                      setQuestionTypeOpen(false);
                      setQuestionPreviewOpen(false);
                    }}
                  >
                    ＋ 加题
                  </button>
                )}
              </div>
            </article>
          </div>
          <p className="design-panel-foot">共 1 轮</p>
        </Card>

        <Card className="design-workspace-column design-editor-column interaction-library-question-column">
          <div className="design-panel-head">
            <div>
              <span className="eyebrow">Question editor</span>
              <h2>{addingQuestion ? "选择题型" : "题目编辑"}</h2>
            </div>
            {!addingQuestion && activeQuestion && (
              <div className="design-question-editor-actions">
                {readOnlyTemplate ? (
                  <Badge tone="purple">{interactionTypeLabel(activeQuestion.type)}</Badge>
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
                      <span>{interactionTypeLabel(activeQuestion.type)}</span>
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
                                const selected = type === activeQuestion.type;
                                return (
                                  <button
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    className={`design-question-type-option ${selected ? "is-selected" : ""}`}
                                    key={type}
                                    onClick={() => changeQuestionType(type)}
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
                {!readOnlyTemplate && (
                  <Button size="sm" onClick={saveQuestion}>
                    <Save size={14} /> 保存本题
                  </Button>
                )}
              </div>
            )}
          </div>

          {addingQuestion ? (
            <div className="design-question-type-picker">
              <div className="design-question-type-picker-head">
                <p>选一种题型开始编辑</p>
                <Button size="sm" variant="ghost" onClick={() => setAddingQuestion(false)}>取消</Button>
              </div>
              {QUESTION_TYPE_GROUPS.map((group) => (
                <section className="design-question-type-group" key={group.label}>
                  <h3>{group.label}</h3>
                  <div className="design-question-type-grid">
                    {group.types.map((type) => {
                      const option = INTERACTION_TYPE_OPTIONS.find((item) => item.type === type);
                      if (!option) return null;
                      return (
                        <button type="button" className="design-question-type-card" key={type} onClick={() => addItem(type)}>
                          <strong>{option.label}</strong>
                          <span>{option.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : activeQuestion ? (
            <div className="design-question-editor">
              <div className="design-question-editor-meta">
                <span>第 {selectedIndex + 1} 题</span>
                {questionDirty && <span className="design-question-save-state is-dirty">有未保存修改</span>}
              </div>
              <fieldset className="interaction-library-readonly-fieldset" disabled={readOnlyTemplate}>
                <InteractionEditor
                  single
                  items={[activeQuestion]}
                  onChange={updateSelectedItem}
                  activeItemId={activeQuestion.id}
                />
              </fieldset>
            </div>
          ) : (
            <div className="design-empty design-editor-empty">
              <strong>这一轮还没有题目</strong>
              <p>先选一种题型，再填写题干和选项。</p>
              {!readOnlyTemplate && (
                <Button variant="soft" size="sm" onClick={() => setAddingQuestion(true)}>＋ 加题</Button>
              )}
            </div>
          )}
        </Card>
      </div>

      {!readOnlyTemplate && (
        <InteractionSetSettingsModal
          open={settingsOpen}
          set={isCreating ? null : set ?? null}
          initialValue={isCreating ? draftMeta : undefined}
          destination={libraryMode ? "library" : "lesson"}
          onSubmit={isCreating ? (value) => {
              setDraftMeta(value);
              setSettingsOpen(false);
            } : undefined}
          teacherId={user.id}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <Modal open={previewOpen} title="学生端互动预览" onClose={() => setPreviewOpen(false)} width="520px">
        {itemsForSave.length > 0 ? <StudentPhonePreview items={itemsForSave} /> : <EmptyState title="还没有题目" description="先加一道题再预览。" />}
      </Modal>

      <Modal open={questionPreviewOpen} title="学生端互动预览" onClose={() => setQuestionPreviewOpen(false)} width="520px">
        {activeQuestion
          ? <StudentPhonePreview items={[activeQuestion]} onClose={() => setQuestionPreviewOpen(false)} />
          : <EmptyState title="还没有题目" description="先选择一道题再预览。" />}
      </Modal>
    </>
  );
}
