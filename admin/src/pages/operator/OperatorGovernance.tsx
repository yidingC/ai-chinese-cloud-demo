import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, FileText, History, Layers3, RotateCcw, ShieldCheck, ToggleLeft, ToggleRight } from "lucide-react";
import { platform } from "../../lib/platform";
import { usePlatformStore } from "../../store/usePlatformStore";
import { currentUser, getCurrentInteractionVersion, getLesson, getUser } from "../../lib/domain";
import type { InteractionSet } from "../../domain/types";
import { Badge, Button, Card, EmptyState, PageHeader, Tabs } from "../../components/ui";
import { MaterialCard } from "../../components/MaterialCard";
import { formatDateTime } from "../../lib/format";

export function OperatorGovernance() {
  const { t } = useTranslation();
  const { state, run } = usePlatformStore();
  const user = currentUser(state);
  const [tab, setTab] = useState<"interactions" | "materials">("interactions");
  const lessonInteractionSets = state.interactionSets.filter((set) => set.scope !== "library");

  function rollback(set: InteractionSet, versionId: string) {
    const reason = window.prompt("请输入内容回滚原因");
    if (!reason) return;
    run(() => platform.rollbackInteractionVersion({ setId: set.id, versionId, actorId: user.id }), "内容已回滚");
  }

  return (
    <>
      <PageHeader
        eyebrow="Content governance"
        title={t("operator.governanceTitle")}
        description={t("operator.governanceSubtitle")}
      />

      <Card className="content-filter-bar">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "interactions", label: "互动内容", count: lessonInteractionSets.length },
            { value: "materials", label: "课程材料", count: state.materials.length }
          ]}
        />
        <Badge tone="blue"><ShieldCheck size={13} /> 教学管理可下架与回滚</Badge>
      </Card>

      {tab === "interactions" && (
        <div className="governance-list">
          {lessonInteractionSets.map((set) => {
            const currentVersion = getCurrentInteractionVersion(state, set);
            const versions = state.interactionVersions.filter((version) => version.setId === set.id).sort((a, b) => b.version - a.version);
            const owner = currentVersion ? getUser(state, currentVersion.publishedBy) : undefined;
            return (
              <Card className="governance-card" key={set.id}>
                <div className="governance-card-head">
                  <span className={`phase-badge phase-${set.phase}`}>{set.phase === "preview" ? "预习" : set.phase === "live" ? "课中" : "复习"}</span>
                  <Badge tone="mint">v{currentVersion?.version}</Badge>
                  <span>{owner?.name} 发布</span>
                </div>
                <h2>{set.title}</h2>
                <div className="governance-meta">
                  <span><BookOpen size={15} /> {getLesson(state, set.lessonId)?.title}</span>
                  <span><Layers3 size={15} /> {currentVersion?.items.length ?? 0} 题</span>
                  <span><History size={15} /> {versions.length} 个版本</span>
                </div>
                <div className="version-inline-list">
                  {versions.map((version) => (
                    <div key={version.id}>
                      <span>v{version.version}</span>
                      <p>{version.publishNote}</p>
                      <small>{formatDateTime(version.publishedAt, state.ui.timeZone, state.ui.language)}</small>
                      {version.id !== set.currentVersionId && <Button size="sm" variant="ghost" onClick={() => rollback(set, version.id)}><RotateCcw size={14} /> 回滚到此版本</Button>}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "materials" && (
        <div className="material-grid">
          {state.materials.map((material) => (
            <div className="material-card-wrap" key={material.id}>
              <MaterialCard
                material={material}
                showVersion
                actions={
                  <Button
                    size="sm"
                    variant={material.status === "published" ? "ghost" : "soft"}
                    onClick={() => {
                      const reason = material.status === "published" ? window.prompt("请输入下架原因") : "";
                      if (material.status === "published" && !reason) return;
                      run(
                        () => platform.setMaterialStatus({ materialId: material.id, status: material.status === "published" ? "unpublished" : "published", actorId: user.id, reason: reason ?? "" }),
                        material.status === "published" ? "材料已下架" : "材料已恢复发布"
                      );
                    }}
                  >
                    {material.status === "published" ? <ToggleLeft size={15} /> : <ToggleRight size={15} />}
                    {material.status === "published" ? "下架" : "恢复"}
                  </Button>
                }
              />
            </div>
          ))}
        </div>
      )}

      {tab === "interactions" && state.interactionSets.length === 0 && <EmptyState title="暂无互动内容" />}
    </>
  );
}
