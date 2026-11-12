import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, Save, Settings2, Trash2, X } from "lucide-react";
import type { InteractionItem, Phase } from "../../domain/types";
import { currentUser, getCurrentInteractionVersion } from "../../lib/domain";
import { INTERACTION_TYPES, interactionTypeLabel, interactionTypeShortLabel } from "../../lib/interactionTypes";
import { platform } from "../../lib/platform";
import { usePlatformStore } from "../../store/usePlatformStore";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Select } from "../../components/ui";
import { InteractionEditor, createInteractionItem } from "../../components/InteractionEditor";
import { InteractionSetSettingsModal, type InteractionSettingsValue } from "../../components/InteractionSetSettingsModal";
import { StudentPhonePreview } from "../../components/InteractionPlayer";

const phaseLabel: Record<Phase, string> = {
  preview: "预习",
  live: "课中",
  review: "复习"
};

export interface InteractionLibraryDraft extends InteractionSettingsValue {
  items: InteractionItem[];
  /** 新建空白互动时先弹出设置，只有模板预填时直接进入题目编辑。 */
  openSettings?: boolean;
}

/** 独立页面入口：直接访问时使用。 */
export function TeacherInteractionLibraryEditor() {
  const { setId = "" } = useParams();
  const navigate = useNavigate();

  return (
    <InteractionLibraryEditorContent
      setId={setId}
      variant="page"
      onClose={() => navigate("/teacher/interactions")}
    />
  );
}

/** 大弹窗入口：互动库卡片点击「编辑题目」时使用。 */
export function InteractionLibraryEditorModal({
  open,
  setId,
  draft,
  onClose
}: {
  open: boolean;
  setId?: string;
  draft?: InteractionLibraryDraft;
  onClose: () => void;
}) {
  if (!open || (!setId && !draft)) return null;

  return (
    <Modal
      open
      title={draft ? "新建互动 · 编辑题目" : "编辑题目"}
      onClose={onClose}
      width="1280px"
      panelClassName="interaction-library-editor-modal"
      hideHeader
    >
      <InteractionLibraryEditorContent setId={setId ?? ""} draft={draft} variant="modal" onClose={onClose} />
    </Modal>
  );
}

/** 互动库母版编辑工作区：沿用备课页的「轮次 + 题目编辑」双栏结构。 */
function InteractionLibraryEditorContent({
  setId,
  draft,
  variant,
  onClose
}: {
  setId: string;
  draft?: InteractionLibraryDraft;
  variant: "page" | "modal";
  onClose: () => void;
}) {
  const { state, run } = usePlatformStore();
  const user = currentUser(state);
  const isCreating = Boolean(draft);
  const set = state.interactionSets.find((item) => item.id === setId && item.scope === "library");
  const version = set ? getCurrentInteractionVersion(state, set) : undefined;

  const [draftMeta, setDraftMeta] = useState<InteractionSettingsValue>(() => ({
    title: draft?.title ?? "",
    phase: draft?.phase ?? "live",
    tags: draft?.tags ?? [],
    countsTowardGrade: draft?.countsTowardGrade ?? true
  }));
  const [settingsOpen, setSettingsOpen] = useState(Boolean(draft?.openSettings));
  const [items, setItems] = useState<InteractionItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isCreating) {
      const nextItems = structuredClone(draft?.items ?? []);
      setItems(nextItems);
      setSelectedItemId(nextItems[0]?.id ?? "");
      return;
    }
    if (!set) {
      setItems([]);
      return;
    }
    const current = getCurrentInteractionVersion(state, set);
    const nextItems = current ? structuredClone(current.items) : [];
    setItems(nextItems);
    setSelectedItemId((currentId) => nextItems.some((item) => item.id === currentId) ? currentId : nextItems[0]?.id ?? "");
    // 只在切换互动或保存出新版本时，用最新母版重置工作区。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreating, set?.id, version?.id]);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 1800);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0] ?? null;
  const selectedIndex = selectedItem ? items.findIndex((item) => item.id === selectedItem.id) : -1;

  function selectItem(itemId: string) {
    setSelectedItemId(itemId);
  }

  function updateSelectedItem(nextItems: InteractionItem[]) {
    const next = nextItems[0];
    if (!next) return;
    setItems((current) => current.map((item) => (item.id === next.id ? next : item)));
  }

  function addItem(type: (typeof INTERACTION_TYPES)[number]) {
    const next = createInteractionItem(type);
    setItems((current) => [...current, next]);
    setSelectedItemId(next.id);
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
    if (!next.some((item) => item.id === selectedItemId)) setSelectedItemId(next[0]?.id ?? "");
  }

  const activeTitle = isCreating ? draftMeta.title : set?.title ?? "";
  const activePhase = isCreating ? draftMeta.phase : set?.phase ?? "live";

  function save() {
    const title = activeTitle.trim();
    if (!title) {
      if (isCreating) setSettingsOpen(true);
      return;
    }
    const result = run(
      () =>
        platform.saveInteractionSet({
          setId: set?.id,
          lessonId: set?.lessonId ?? "",
          scope: "library",
          title,
          phase: activePhase,
          items,
          countsTowardGrade: isCreating ? draftMeta.countsTowardGrade : set?.countsTowardGrade,
          tags: isCreating ? draftMeta.tags : set?.tags ?? [],
          actorId: user.id,
          publishNote: isCreating ? "创建互动库母版" : "编辑互动库题目"
        }),
      isCreating ? "互动已创建并发布" : "互动已保存并发布新版本"
    );
    if (!result.ok) return;
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
      {isCreating && (
        <Button variant="ghost" onClick={() => setSettingsOpen(true)}>
          <Settings2 size={16} /> 互动设置
        </Button>
      )}
      <Button variant="ghost" onClick={() => setPreviewOpen(true)} disabled={items.length === 0}>
        <Eye size={16} /> 学生预览
      </Button>
      <Button variant={saved ? "soft" : "primary"} onClick={save} disabled={isCreating && !draftMeta.title.trim()}>
        <Save size={16} /> {saved ? "已保存" : "保存并发布"}
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
          description={`${isCreating ? "新建互动库母版" : "编辑互动库母版"} · ${items.length} 道题 · ${isCreating ? "发布后加入互动库" : "保存后不会影响已经复制到课次的副本"}`}
          actions={actions}
        />
      ) : (
        <div className="interaction-library-editor-modal-head">
          <div>
            <div className="interaction-library-editor-modal-title-row">
              <h2>{activeTitle || "新建互动"}</h2>
              <Badge tone="neutral">{phaseLabel[activePhase]}</Badge>
            </div>
            <p>{items.length} 道题 · {isCreating ? "发布后加入互动库" : "保存后只更新互动库母版"}</p>
          </div>
          <div className="interaction-library-editor-modal-actions">{actions}</div>
        </div>
      )}

      <div className="design-workspace interaction-library-editor-workspace">
        <Card className="design-workspace-column interaction-library-questions-column">
          <div className="design-panel-head">
            <div>
              <h2>互动轮次</h2>
            </div>
            <span className="interaction-library-question-count">{items.length} 道题</span>
          </div>

          <div className="design-round-question-list interaction-library-question-list">
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
                </div>
              );
            })}
            <Select
              className="interaction-library-add-question"
              value=""
              aria-label="添加题目"
              onChange={(event) => {
                if (!event.target.value) return;
                addItem(event.target.value as (typeof INTERACTION_TYPES)[number]);
              }}
            >
              <option value="">＋ 加题</option>
              {INTERACTION_TYPES.map((type) => (
                <option key={type} value={type}>{interactionTypeLabel(type)}</option>
              ))}
            </Select>
          </div>
        </Card>

        <Card className="design-workspace-column design-editor-column interaction-library-question-column">
          <div className="design-panel-head">
            <div>
              <h2>题目编辑</h2>
            </div>
            {selectedItem && <Badge tone="neutral">第 {selectedIndex + 1} 题</Badge>}
          </div>

          {selectedItem ? (
            <InteractionEditor
              single
              items={[selectedItem]}
              onChange={updateSelectedItem}
              activeItemId={selectedItem.id}
            />
          ) : (
            <EmptyState title="还没有题目" description="在左侧轮次里点「＋ 加题」开始编辑。" />
          )}
        </Card>
      </div>

      {isCreating && (
        <InteractionSetSettingsModal
          open={settingsOpen}
          set={null}
          initialValue={draftMeta}
          onSubmit={(value) => {
            setDraftMeta(value);
            setSettingsOpen(false);
          }}
          teacherId={user.id}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <Modal open={previewOpen} title="学生端互动预览" onClose={() => setPreviewOpen(false)} width="520px">
        {items.length > 0 ? <StudentPhonePreview items={items} /> : <EmptyState title="还没有题目" description="先加一道题再预览。" />}
      </Modal>
    </>
  );
}
