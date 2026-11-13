import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarCheck, Clock3, Copy, Eye, Layers3, Pencil, Plus, Search, Settings2, Sparkles, Trash2 } from "lucide-react";
import { platform } from "../../lib/platform";
import { usePlatformStore } from "../../store/usePlatformStore";
import { currentUser, getCurrentInteractionVersion } from "../../lib/domain";
import type {
  InteractionItem,
  InteractionRoundScenario,
  InteractionRoundTemplate,
  InteractionSet,
  Phase
} from "../../domain/types";
import { interactionTypeShortLabel } from "../../lib/interactionTypes";
import { Button, Card, EmptyState, Modal, PageHeader, Select, Tabs, TextInput } from "../../components/ui";
import { CopyInteractionToLessonModal } from "../../components/CopyInteractionToLessonModal";
import { templateToItem } from "../../components/InteractionTemplatePicker";
import { roundTemplateQuestionTemplates, roundTemplateScenarioLabel } from "../../lib/roundTemplates";
import { InteractionRoundTemplateChips } from "../../components/InteractionRoundTemplateChips";
import { StudentPhonePreview } from "../../components/InteractionPlayer";
import { InteractionSetEditorModal } from "../../components/InteractionSetEditorModal";
import { InteractionSetSettingsModal } from "../../components/InteractionSetSettingsModal";
import { InteractionLibraryEditorModal, type InteractionLibraryDraft } from "./TeacherInteractionLibraryEditor";
import { PmNote } from "../../components/PmNote";
import { formatDateTime } from "../../lib/format";

export function TeacherInteractions() {
  const { t } = useTranslation();
  const { state, run } = usePlatformStore();
  const navigate = useNavigate();
  const user = currentUser(state);
  /** 互动库只展示全局母版；课节里的是各自的副本。 */
  const teacherSets = state.interactionSets.filter((set) => set.scope === "library" && !set.deletedAt);
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<"all" | Phase>("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"updated-desc" | "updated-asc">("updated-desc");
  const [libraryTab, setLibraryTab] = useState<"designs" | "templates">("designs");
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateScenario, setTemplateScenario] = useState<InteractionRoundScenario | "all">("all");
  const [templatePhase, setTemplatePhase] = useState<"all" | Phase>("all");
  const [templateVisible, setTemplateVisible] = useState(12);
  const [copyTarget, setCopyTarget] = useState<InteractionSet | null>(null);
  const [editingSet, setEditingSet] = useState<InteractionSet | null | undefined>(undefined);
  const [editorView, setEditorView] = useState<"design" | "preview">("design");
  const [editorScope, setEditorScope] = useState<"library" | "lesson">("library");
  const [editorSeed, setEditorSeed] = useState<{ phase?: Phase; title?: string; items?: InteractionItem[] }>({});
  const [editorCopyTarget, setEditorCopyTarget] = useState<{ lessonId: string; phase: Phase; sessionIds: string[] } | null>(null);
  const [previewItems, setPreviewItems] = useState<InteractionItem[] | null>(null);
  const [editingLibrarySetId, setEditingLibrarySetId] = useState("");
  const [libraryDraft, setLibraryDraft] = useState<InteractionLibraryDraft | null>(null);
  const [settingsTarget, setSettingsTarget] = useState<InteractionSet | null>(null);

  /** 卡片上显示的日期就是互动最近一次编辑（创建版本）的时间。 */
  const filteredSets = teacherSets
    .filter((set) => {
      const matchesTab = tab === "all" || set.phase === tab;
      const keyword = query.trim().toLowerCase();
      const matchesQuery = !keyword ||
        set.title.toLowerCase().includes(keyword) ||
        (set.tags ?? []).join(" ").toLowerCase().includes(keyword);
      return matchesTab && matchesQuery;
    })
    .sort((a, b) => {
      const delta = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      return sortKey === "updated-desc" ? delta : -delta;
    });

  const roundTemplates = useMemo(() => {
    const keyword = templateQuery.trim().toLowerCase();
    return state.interactionRoundTemplates.filter((template) => {
      const scenarioMatch = templateScenario === "all" || template.scenarioId === templateScenario;
      const phaseMatch = templatePhase === "all" || template.phase === templatePhase;
      const queryMatch =
        !keyword ||
        template.title.toLowerCase().includes(keyword) ||
        template.topic.toLowerCase().includes(keyword) ||
        template.summary.toLowerCase().includes(keyword) ||
        template.tags.join(" ").toLowerCase().includes(keyword);
      return scenarioMatch && phaseMatch && queryMatch;
    });
  }, [state.interactionRoundTemplates, templateQuery, templateScenario, templatePhase]);

  function openCreate(options?: { phase?: Phase; title?: string; items?: InteractionItem[] }) {
    setLibraryDraft(null);
    setEditorCopyTarget(null);
    setEditorScope("library");
    setEditorView("design");
    setEditorSeed({ phase: options?.phase, title: options?.title, items: options?.items });
    setEditingSet(null);
  }

  /** 互动库新建：直接进入单轮编辑器，标题在编辑区内填写。 */
  function openLibraryCreate(options?: { phase?: Phase; title?: string; items?: InteractionItem[]; readOnlyTemplate?: boolean }) {
    setEditingSet(undefined);
    setEditorCopyTarget(null);
    setEditingLibrarySetId("");
    setLibraryDraft({
      title: options?.title ?? "",
      phase: options?.phase ?? "live",
      tags: [],
      items: options?.items ?? [],
      readOnlyTemplate: options?.readOnlyTemplate
    });
  }

  function useRoundTemplate(template: InteractionRoundTemplate) {
    const questionTemplates = roundTemplateQuestionTemplates(template, state.interactionTemplates);
    if (questionTemplates.length === 0) return;
    openLibraryCreate({
      phase: template.phase,
      title: template.title,
      items: questionTemplates.map(templateToItem),
      readOnlyTemplate: true
    });
  }

  // 从课表进入：/teacher/interactions?sessionId=..&lessonId=..&phase=.. 或 ?editSetId=..
  useEffect(() => {
    const editSetId = searchParams.get("editSetId");
    const previewSetId = searchParams.get("previewSetId");
    const sessionId = searchParams.get("sessionId");
    const templateId = searchParams.get("templateId");
    if (!editSetId && !previewSetId && !sessionId && !templateId) return;
    if (templateId) {
      const template = state.interactionTemplates.find((item) => item.id === templateId);
      if (template) {
        openLibraryCreate({ title: template.title, items: [templateToItem(template)], readOnlyTemplate: true });
      }
    } else if (previewSetId) {
      const target = state.interactionSets.find((item) => item.id === previewSetId);
      if (target) openEdit(target, "preview");
    } else if (editSetId) {
      const target = state.interactionSets.find((item) => item.id === editSetId);
      if (target) openEdit(target);
    } else if (sessionId) {
      const session = state.sessions.find((item) => item.id === sessionId);
      if (session) {
        const phase = (searchParams.get("phase") as Phase) ?? "live";
        openCreate({ phase });
        setEditorCopyTarget({ lessonId: session.lessonId, phase, sessionIds: [session.id] });
      }
    }
    const next = new URLSearchParams(searchParams);
    next.delete("editSetId");
    next.delete("previewSetId");
    next.delete("sessionId");
    next.delete("lessonId");
    next.delete("phase");
    next.delete("templateId");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function openEdit(set: InteractionSet, initialView: "design" | "preview" = "design") {
    if (set.scope === "library" && initialView === "design") {
      setEditingLibrarySetId(set.id);
      return;
    }
    setEditorCopyTarget(null);
    setEditorScope(set.scope === "library" ? "library" : "lesson");
    setEditorView(initialView);
    setEditingSet(set);
  }

  function deleteLibrarySet(set: InteractionSet) {
    const result = run(
      () => platform.deleteInteractionSet({ setId: set.id, actorId: user.id }),
      `已删除“${set.title}”；已复制到课次的版本不受影响`
    );
    if (!result.ok) return;
    if (editingLibrarySetId === set.id) setEditingLibrarySetId("");
    if (copyTarget?.id === set.id) setCopyTarget(null);
  }

  return (
    <>
      <PageHeader
        eyebrow="Interaction library"
        title={t("teacher.interactionLibrary")}
        description="这里存放可被任意课次取用的互动轮次；复制到课次后各改各的，互不影响。"
      />

      <Card className="content-filter-bar library-tab-bar">
        <Tabs
          value={libraryTab}
          onChange={(value) => setLibraryTab(value as "designs" | "templates")}
          items={[
            { value: "designs", label: "我的互动轮次", count: teacherSets.length },
            { value: "templates", label: "互动模板库", count: state.interactionRoundTemplates.length }
          ]}
        />
        <div className="library-tab-actions">
          <Button variant="secondary" onClick={() => navigate("/teacher/schedule")}><CalendarCheck size={16} /> 去我的课表</Button>
          <PmNote kind="流程" note="点击后创建互动；保存到互动库时会立即生成学生看到的当前版本。">
            <Button onClick={() => openLibraryCreate()}><Plus size={17} /> {t("teacher.createInteraction")}</Button>
          </PmNote>
        </div>
      </Card>

      {libraryTab === "designs" && (
      <>

      <Card className="content-filter-bar">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "all", label: "全部", count: teacherSets.length },
            { value: "preview", label: "预习", count: teacherSets.filter((set) => set.phase === "preview").length },
            { value: "live", label: "课中", count: teacherSets.filter((set) => set.phase === "live").length },
            { value: "review", label: "复习", count: teacherSets.filter((set) => set.phase === "review").length }
          ]}
        />
        <div className="filter-bar-trailing">
          <div className="search-box">
            <Search size={17} />
            <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索互动轮次或标签" />
          </div>
            <PmNote kind="口径" note="互动库不绑定课节；卡片时间显示最近一次发布或编辑时间。">
            <Select
              className="sort-select"
              value={sortKey}
                onChange={(event) => setSortKey(event.target.value as "updated-desc" | "updated-asc")}
              aria-label="排序方式"
            >
                <option value="updated-desc">按更新时间：新→旧</option>
                <option value="updated-asc">按更新时间：旧→新</option>
            </Select>
          </PmNote>
        </div>
      </Card>

      <PmNote block kind="规则" note="互动库母版不直接出现在课堂；复制到课次时生成独立副本，课堂里改题不会回写母版，母版更新也不会改已经复制出去的课堂。">
        <div className="interaction-list-grid">
        {filteredSets.map((set) => {
          const version = getCurrentInteractionVersion(state, set);
          const items = version?.items ?? [];
          const types = [...new Set(items.map((item) => item.type))];
          return (
            <Card className="interaction-manage-card interaction-round-card round-card" key={set.id}>
              <div className="round-card-top">
                <span className={`phase-badge phase-${set.phase}`}>
                  {set.phase === "preview" ? "预习" : set.phase === "live" ? "课中" : "复习"}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="round-card-settings-button"
                  aria-label={`互动设置 ${set.title}`}
                  title="互动设置"
                  onClick={() => setSettingsTarget(set)}
                >
                  <Settings2 size={14} />
                </Button>
              </div>
              <h2 data-interaction-set-id={set.id}>{set.title}</h2>
              {types.length > 0 && (
                <div className="interaction-type-chips round-card-chips">
                  {types.slice(0, 4).map((type) => (
                    <span key={type}>{interactionTypeShortLabel(type)}</span>
                  ))}
                  {types.length > 4 && <span>+{types.length - 4}</span>}
                </div>
              )}
              <div className="round-card-stats">
                <span><Layers3 size={14} /> {items.length} 道题 · {types.length} 种题型</span>
              </div>
              <div className="round-card-footer">
                <small><Clock3 size={14} /> 最近编辑 · {formatDateTime(set.updatedAt, state.ui.timeZone, state.ui.language)}</small>
                <div className="round-card-actions">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(set, "preview")}><Eye size={15} /> 预览</Button>
                  <Button size="sm" variant="ghost" onClick={() => setCopyTarget(set)}><Copy size={15} /> 复制到课次</Button>
                  <Button size="sm" variant="soft" onClick={() => openEdit(set)}><Pencil size={15} /> 编辑题目</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="round-card-delete"
                    aria-label={`删除互动 ${set.title}`}
                    title="删除"
                    onClick={() => deleteLibrarySet(set)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
        {filteredSets.length === 0 && <EmptyState title="还没有互动轮次" description="新建一轮互动，把同一目标下的题目放在一起。" action={<Button onClick={() => openLibraryCreate()}>新建互动</Button>} />}
        </div>
      </PmNote>
      </>
      )}

      {libraryTab === "templates" && (
      <>
        <Card className="content-filter-bar round-template-filter-bar">
          <div className="round-template-filter-stack">
            <div className="round-template-filter-row">
              <Tabs
                value={templatePhase}
                onChange={(value) => { setTemplatePhase(value as "all" | Phase); setTemplateVisible(12); }}
                items={[
                  { value: "all", label: "全部", count: state.interactionRoundTemplates.length },
                  { value: "preview", label: "预习", count: state.interactionRoundTemplates.filter((template) => template.phase === "preview").length },
                  { value: "live", label: "课中", count: state.interactionRoundTemplates.filter((template) => template.phase === "live").length },
                  { value: "review", label: "复习", count: state.interactionRoundTemplates.filter((template) => template.phase === "review").length }
                ]}
              />
              <div className="round-template-filter-tools">
                <div className="search-box">
                  <Search size={17} />
                  <TextInput
                    value={templateQuery}
                    onChange={(event) => { setTemplateQuery(event.target.value); setTemplateVisible(12); }}
                    placeholder="搜索模板主题，例如“餐厅”“天气”"
                  />
                </div>
              </div>
            </div>
            <div className="round-template-filter-main">
              <span className="round-template-filter-label">教学场景</span>
              <InteractionRoundTemplateChips
                templates={state.interactionRoundTemplates}
                value={templateScenario}
                onChange={(next) => { setTemplateScenario(next); setTemplateVisible(12); }}
              />
            </div>
          </div>
        </Card>

        <p className="muted-copy">匹配 {roundTemplates.length} 轮互动模板</p>

        <div className="template-grid">
          {roundTemplates.slice(0, templateVisible).map((template) => {
            const questionTemplates = roundTemplateQuestionTemplates(template, state.interactionTemplates);
            const items = questionTemplates.map((item) => item.item);
            const types = [...new Set(items.map((item) => item.type))];
            return (
              <Card key={template.id} className="round-card round-template-card">
                <div className="round-card-top">
                  <span className={`round-template-scene-badge is-${template.scenarioId}`}>
                    {roundTemplateScenarioLabel(template.scenarioId)}
                  </span>
                </div>
                <h2>{template.topic}</h2>
                <div className="round-template-meta-bar">
                  <div className="round-card-chips">
                    {types.slice(0, 3).map((type) => <span key={type}>{interactionTypeShortLabel(type)}</span>)}
                    {types.length > 3 && <span>+{types.length - 3}</span>}
                  </div>
                  <div className="round-template-meta">
                    <span>{items.length} 题</span>
                    <span>约 {template.estimatedMinutes} 分钟</span>
                  </div>
                </div>
                <div className="round-card-footer">
                  <span />
                  <div className="round-card-actions">
                  <Button size="sm" variant="ghost" onClick={() => setPreviewItems(items)}><Eye size={15} /> 预览</Button>
                  <Button size="sm" variant="soft" onClick={() => useRoundTemplate(template)}>
                    <Sparkles size={14} /> 复用这一轮
                  </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {roundTemplates.length > templateVisible && (
          <div className="template-more">
            <Button variant="ghost" onClick={() => setTemplateVisible((value) => value + 12)}>
              显示更多（还有 {roundTemplates.length - templateVisible} 轮）
            </Button>
          </div>
        )}
        {roundTemplates.length === 0 && <EmptyState title="没有匹配的互动模板" description="换个教学场景或关键词再试。" />}
      </>
      )}

      <InteractionSetEditorModal
        open={editingSet !== undefined}
        set={editingSet ?? null}
        scope={editorScope}
        initialView={editorView}
        defaultLessonId={editingSet?.lessonId}
        defaultPhase={editorSeed.phase ?? "preview"}
        presetTitle={editorSeed.title}
        presetItems={editorSeed.items}
        teacherId={user.id}
        copyTarget={editorCopyTarget ?? undefined}
        onClose={() => {
          setEditingSet(undefined);
          setEditorCopyTarget(null);
        }}
      />

      <Modal open={Boolean(previewItems)} title="学生端互动预览" onClose={() => setPreviewItems(null)} width="520px">
        {previewItems && <StudentPhonePreview items={previewItems} onClose={() => setPreviewItems(null)} />}
      </Modal>

      <InteractionLibraryEditorModal
        open={Boolean(editingLibrarySetId || libraryDraft)}
        setId={editingLibrarySetId}
        draft={libraryDraft ?? undefined}
        onTemplateSaved={(setId) => {
          setLibraryDraft(null);
          setEditingLibrarySetId(setId);
        }}
        onClose={() => {
          setEditingLibrarySetId("");
          setLibraryDraft(null);
        }}
      />

      <InteractionSetSettingsModal
        open={Boolean(settingsTarget)}
        set={settingsTarget}
        teacherId={user.id}
        onClose={() => setSettingsTarget(null)}
      />

      <CopyInteractionToLessonModal
        open={Boolean(copyTarget)}
        onClose={() => setCopyTarget(null)}
        state={state}
        set={copyTarget}
        teacherId={user.id}
      />
    </>
  );
}
