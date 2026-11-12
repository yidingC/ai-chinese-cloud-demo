import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Download, Eye, FileAudio, FileImage, FileText, FileVideo, Link2, Pause, Play, PlayCircle, Presentation } from "lucide-react";
import type { Material } from "../domain/types";
import { isMaterialUsageTag, orderMaterialTags } from "../lib/materialTags";
import { Badge, Button } from "./ui";

export function MaterialCard({
  material,
  actions,
  onDownload,
  onOpen,
  onPlay,
  onView,
  showTags = false,
  playing = false,
  showVersion = false
}: {
  material: Material;
  actions?: ReactNode;
  onDownload?: () => void;
  onOpen?: () => void;
  onPlay?: () => void;
  /** 传入后卡片主操作为“查看详情”，下载退化成右侧的 icon 按钮。 */
  onView?: () => void;
  /** 材料库展示标签；学生端和课节内容保持简洁，不默认展示。 */
  showTags?: boolean;
  playing?: boolean;
  showVersion?: boolean;
}) {
  const { t } = useTranslation();
  const Icon =
    material.fileType === "pptx"
      ? Presentation
      : material.fileType === "wav" || material.fileType === "mp3"
        ? FileAudio
        : material.fileType === "video"
          ? FileVideo
          : material.fileType === "image" || material.fileType === "png"
            ? FileImage
            : material.kind === "link"
              ? Link2
              : FileText;
  const current = material.versions.find((version) => version.version === material.currentVersion) ?? material.versions.at(-1);
  const isAudio = material.fileType === "wav" || material.fileType === "mp3";
  const canDownload = Boolean(current?.url) || material.kind === "file";
  const orderedTags = orderMaterialTags(material.tags);

  function downloadMaterial() {
    onDownload?.();
    const url = current?.url;
    if (!url) return;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = current?.fileName ?? material.title;
    anchor.click();
  }

  return (
    <article className="material-card">
      <span className={`material-icon material-${material.fileType}`}>
        <Icon size={21} />
      </span>
      <div className="material-copy">
        <div className="material-title-row">
          <strong>{material.title}</strong>
          {material.status !== "published" && <Badge tone="danger">{t("student.materialCard.unpublished")}</Badge>}
        </div>
        <p>{material.description}</p>
        {showTags && orderedTags.length > 0 && (
          <div className="material-card-tags" aria-label="材料标签">
            {orderedTags.slice(0, 3).map((tag) => (
              <span className={isMaterialUsageTag(tag) ? "is-usage" : ""} key={tag}>{tag}</span>
            ))}
            {orderedTags.length > 3 && <span>+{orderedTags.length - 3}</span>}
          </div>
        )}
        <div className="material-meta">
          {showVersion && <span>v{material.currentVersion}</span>}
          <span>{current?.sizeLabel ?? t("student.materialCard.externalLink")}</span>
        </div>
      </div>
      <div className="material-actions">
        {isAudio && onPlay && (
          <Button size="sm" variant="ghost" onClick={onPlay}>
            {playing ? <Pause size={15} /> : <Play size={15} />} {playing ? t("student.materialCard.pause") : t("student.materialCard.play")}
          </Button>
        )}
        {onView ? (
          <>
            <Button size="sm" variant="soft" onClick={onView}>
              <Eye size={16} /> {t("student.materialCard.view")}
            </Button>
            {canDownload ? (
              <Button
                size="sm"
                variant="ghost"
                className="material-icon-button"
                aria-label={`${t("student.materialCard.download")} ${material.title}`}
                title={t("student.materialCard.download")}
                onClick={downloadMaterial}
              >
                <Download size={16} />
              </Button>
            ) : material.externalUrl ? (
              <Button
                size="sm"
                variant="ghost"
                className="material-icon-button"
                aria-label={`${t("student.materialCard.openLink")} ${material.title}`}
                title={t("student.materialCard.openLink")}
                onClick={() => window.open(material.externalUrl, "_blank", "noopener,noreferrer")}
              >
                <Link2 size={16} />
              </Button>
            ) : null}
          </>
        ) : material.kind === "courseware" && onOpen ? (
          <>
            <Button size="sm" variant="primary" onClick={onOpen}>
              <PlayCircle size={16} /> {t("student.materialCard.playCourseware")}
            </Button>
            {current?.url && (
              <Button size="sm" variant="ghost" onClick={downloadMaterial}>
                <Download size={15} /> {t("student.materialCard.download")}
              </Button>
            )}
          </>
        ) : material.kind === "file" || current?.url ? (
          <Button size="sm" variant="soft" onClick={downloadMaterial}>
            <Download size={16} /> {t("student.materialCard.download")}
          </Button>
        ) : (
          <Button size="sm" variant="soft" onClick={() => window.open(material.externalUrl, "_blank", "noopener,noreferrer")}>
            <Link2 size={16} /> {t("student.materialCard.open")}
          </Button>
        )}
        {actions}
      </div>
    </article>
  );
}
