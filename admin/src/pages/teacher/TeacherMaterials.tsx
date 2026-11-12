import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileText, Plus, Search, UploadCloud, X } from "lucide-react";
import { platform } from "../../lib/platform";
import { usePlatformStore } from "../../store/usePlatformStore";
import { currentUser, getTeacherSessions } from "../../lib/domain";
import { isMaterialUsageTag, materialTagPriority, orderMaterialTags } from "../../lib/materialTags";
import type { Material } from "../../domain/types";
import { Button, Card, EmptyState, Field, Modal, PageHeader, Select, TextInput } from "../../components/ui";
import { MaterialCard } from "../../components/MaterialCard";
import { PmNote } from "../../components/PmNote";

type MaterialTypeKey = "pdf" | "pptx" | "audio" | "video" | "image" | "courseware" | "other";

/** 材料库的文件类型筛选项按这份顺序展示，只有实际存在的类型才会出现。 */
const materialTypeOrder: Array<{ key: MaterialTypeKey; label: string }> = [
  { key: "pdf", label: "PDF" },
  { key: "pptx", label: "PPT" },
  { key: "audio", label: "音频" },
  { key: "video", label: "视频外链" },
  { key: "image", label: "图片" },
  { key: "courseware", label: "互动课件" },
  { key: "other", label: "其他" }
];

function materialTypeKey(material: Material): MaterialTypeKey {
  const fileType = material.fileType.toLowerCase();
  if (fileType === "pdf") return "pdf";
  if (fileType === "ppt" || fileType === "pptx") return "pptx";
  if (["wav", "mp3", "m4a", "audio"].includes(fileType)) return "audio";
  if (["mp4", "mov", "video"].includes(fileType)) return "video";
  if (["png", "jpg", "jpeg", "gif", "image"].includes(fileType)) return "image";
  if (material.kind === "courseware" || fileType === "html") return "courseware";
  return "other";
}

function cleanMaterialTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function splitMaterialTags(value: string) {
  return cleanMaterialTags(value.split(/[,，]/u));
}

export function TeacherMaterials() {
  const { t } = useTranslation();
  const { state, run } = usePlatformStore();
  const user = currentUser(state);
  const teacherSessions = getTeacherSessions(state, user.id);
  const lessonIds = [...new Set(teacherSessions.map((session) => session.lessonId))];
  const [searchParams, setSearchParams] = useSearchParams();
  const [typeFilter, setTypeFilter] = useState<MaterialTypeKey[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewMaterialId, setPreviewMaterialId] = useState<string | null>(null);
  const previewMaterial = state.materials.find((material) => material.id === previewMaterialId);
  const previewVersion = previewMaterial
    ? previewMaterial.versions.find((version) => version.version === previewMaterial.currentVersion) ?? previewMaterial.versions.at(-1)
    : undefined;
  const previewUrl = previewVersion?.url ?? previewMaterial?.externalUrl ?? "";
  const previewKind = previewMaterial
    ? previewMaterial.fileType === "png" || previewMaterial.fileType === "image"
      ? "image"
      : previewMaterial.fileType === "wav" || previewMaterial.fileType === "mp3"
        ? "audio"
        : previewUrl.endsWith(".html") || previewUrl.endsWith(".pdf")
          ? "frame"
          : "external"
    : "external";

  // 从首页“最近添加”跳进来时，直接打开这条材料的预览。
  useEffect(() => {
    const materialId = searchParams.get("materialId");
    if (!materialId) return;
    if (state.materials.some((material) => material.id === materialId)) setPreviewMaterialId(materialId);
    const next = new URLSearchParams(searchParams);
    next.delete("materialId");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    fileType: "pdf",
    language: "zh-id",
    fileName: "",
    tags: [] as string[]
  });

  // 旧版把互动库挂在材料页的 ?library=interactions 下，统一送去新的互动库入口。
  if (searchParams.get("library") === "interactions") {
    const next = new URLSearchParams(searchParams);
    next.delete("library");
    const queryString = next.toString();
    return <Navigate to={`/teacher/interactions${queryString ? `?${queryString}` : ""}`} replace />;
  }

  // 先取“我能看到的材料”，再做类型 / 关键词筛选，类型下拉的计数才稳定。
  const scopedMaterials = state.materials.filter((material) => {
    const refs = state.materialRefs.filter((ref) => ref.materialId === material.id && lessonIds.includes(ref.lessonId));
    return material.ownerId === user.id || refs.length > 0;
  });
  const typeCounts = scopedMaterials.reduce<Partial<Record<MaterialTypeKey, number>>>((counts, material) => {
    const key = materialTypeKey(material);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const materialTypeOptions = materialTypeOrder.filter((item) => (typeCounts[item.key] ?? 0) > 0);
  const tagCounts = scopedMaterials.reduce<Record<string, number>>((counts, material) => {
    material.tags.forEach((tag) => {
      counts[tag] = (counts[tag] ?? 0) + 1;
    });
    return counts;
  }, {});
  const availableTags = Object.entries(tagCounts).sort(
    ([leftTag, leftCount], [rightTag, rightCount]) => {
      const priorityDifference = materialTagPriority(leftTag) - materialTagPriority(rightTag);
      return priorityDifference || rightCount - leftCount || leftTag.localeCompare(rightTag, "zh-CN");
    }
  );
  const usageTagOptions = availableTags.filter(([tag]) => isMaterialUsageTag(tag));
  const topicTagOptions = availableTags.filter(([tag]) => !isMaterialUsageTag(tag));
  const filteredByType = typeFilter.length
    ? scopedMaterials.filter((material) => typeFilter.includes(materialTypeKey(material)))
    : scopedMaterials;
  const filteredByTag = selectedTags.length
    ? filteredByType.filter((material) => material.tags.some((tag) => selectedTags.includes(tag)))
    : filteredByType;
  const normalizedQuery = query.trim().toLowerCase();
  const materials = filteredByTag.filter((material) => {
    const queryMatch =
      !normalizedQuery ||
      material.title.toLowerCase().includes(normalizedQuery) ||
      material.description.toLowerCase().includes(normalizedQuery) ||
      material.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));
    return queryMatch;
  });

  function addFormTags(value: string) {
    const additions = splitMaterialTags(value);
    if (!additions.length) return;
    setForm((current) => ({ ...current, tags: orderMaterialTags(cleanMaterialTags([...current.tags, ...additions])) }));
    setTagDraft("");
  }

  function removeFormTag(tag: string) {
    setForm((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }));
  }

  function saveUpload() {
    if (!form.title.trim()) return;
    const result = run(
      () =>
        platform.addMockMaterial({
          title: form.title,
          description: form.description,
          fileType: form.fileType,
          language: form.language,
          tags: orderMaterialTags(cleanMaterialTags([...form.tags, ...splitMaterialTags(tagDraft)])),
          ownerId: user.id,
          fileName: form.fileName || `${form.title}.${form.fileType}`,
          sizeLabel: "36 KB"
        }),
      "上传完成，材料已进入材料库"
    );
    if (result.ok) {
      setUploadOpen(false);
      setForm((value) => ({ ...value, title: "", description: "", fileName: "", tags: [] }));
      setTagDraft("");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Material library"
        title={t("teacher.materialLibrary")}
        description="文件与外链材料统一入库，用途与主题标签并存；材料在课节中的使用方式仍由课节设计决定。"
        actions={
          <Button onClick={() => setUploadOpen(true)}><UploadCloud size={17} /> 上传材料</Button>
        }
      />

      <Card className="content-filter-bar library-filter-bar">
        <div className="library-filter-stack">
          <div className="library-filter-group">
            <div className="material-type-chips" role="group" aria-label="按文件类型筛选">
              <button
                type="button"
                className={typeFilter.length === 0 ? "active" : ""}
                aria-pressed={typeFilter.length === 0}
                onClick={() => setTypeFilter([])}
              >
                全部类型<span className="material-type-count">{scopedMaterials.length}</span>
              </button>
              {materialTypeOptions.map((item) => {
                const active = typeFilter.includes(item.key);
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={active ? "active" : ""}
                    aria-pressed={active}
                    onClick={() =>
                      setTypeFilter((value) =>
                        value.includes(item.key) ? value.filter((key) => key !== item.key) : [...value, item.key]
                      )
                    }
                  >
                    {item.label}<span className="material-type-count">{typeCounts[item.key]}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {availableTags.length > 0 && (
            <div className="material-tag-filters" role="group" aria-label="按标签筛选">
              <div className="material-tag-filter material-tag-filter-usage" role="group" aria-label="按用途标签筛选">
                <span className="material-tag-filter-label">用途</span>
                <div className="material-tag-chips">
                  <button
                    type="button"
                    className={selectedTags.length === 0 ? "active" : ""}
                    aria-pressed={selectedTags.length === 0}
                    onClick={() => setSelectedTags([])}
                  >
                    全部标签<span className="material-tag-count">{scopedMaterials.length}</span>
                  </button>
                  {usageTagOptions.map(([tag, count]) => {
                    const active = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        className={active ? "active" : ""}
                        aria-pressed={active}
                        onClick={() =>
                          setSelectedTags((value) =>
                            value.includes(tag) ? value.filter((item) => item !== tag) : [...value, tag]
                          )
                        }
                      >
                        {tag}<span className="material-tag-count">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {topicTagOptions.length > 0 && (
                <div className="material-tag-filter material-tag-filter-topic" role="group" aria-label="按主题标签筛选">
                  <span className="material-tag-filter-label">主题</span>
                  <div className="material-tag-chips">
                    {topicTagOptions.map(([tag, count]) => {
                      const active = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          className={active ? "active" : ""}
                          aria-pressed={active}
                          onClick={() =>
                            setSelectedTags((value) =>
                              value.includes(tag) ? value.filter((item) => item !== tag) : [...value, tag]
                            )
                          }
                        >
                          {tag}<span className="material-tag-count">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="search-box">
          <Search size={17} />
          <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索材料名称或说明" />
        </div>
      </Card>

      <div className="material-grid">
        {materials.map((material) => (
          <div className="material-card-wrap" key={material.id}>
            <MaterialCard material={material} showTags onView={() => setPreviewMaterialId(material.id)} />
          </div>
        ))}
        {materials.length === 0 && (
          scopedMaterials.length > 0 ? (
            <EmptyState
              title="没有匹配的材料"
              description="换个标签、文件类型或关键词再试。"
              action={<Button variant="ghost" onClick={() => { setSelectedTags([]); setTypeFilter([]); setQuery(""); }}>清除筛选</Button>}
            />
          ) : (
            <EmptyState title="暂无材料" description="上传第一批课程材料，之后可在课节设计中引用。" action={<Button onClick={() => setUploadOpen(true)}>上传材料</Button>} />
          )
        )}
      </div>

      <Modal
        open={Boolean(previewMaterial)}
        title={`材料详情 · ${previewMaterial?.title ?? ""}`}
        onClose={() => setPreviewMaterialId(null)}
        width="980px"
      >
        <div className="material-detail-grid">
          <span><small>文件类型</small><strong>{(previewMaterial?.fileType ?? "file").toUpperCase()}</strong></span>
          <span><small>文件大小</small><strong>{previewVersion?.sizeLabel ?? "外链"}</strong></span>
        </div>

        {previewMaterial && previewMaterial.tags.length > 0 && (
          <div className="material-detail-tags">
            <small>标签</small>
            <div>
              {orderMaterialTags(previewMaterial.tags).map((tag) => (
                <span className={isMaterialUsageTag(tag) ? "is-usage" : ""} key={tag}>{tag}</span>
              ))}
            </div>
          </div>
        )}

        <p className="muted-copy material-detail-description">{previewMaterial?.description}</p>
        {previewUrl && previewKind === "frame" && (
          <iframe className="material-preview-frame" src={previewUrl} title={previewMaterial?.title} />
        )}
        {previewUrl && previewKind === "image" && (
          <img className="material-preview-image" src={previewUrl} alt={previewMaterial?.title} />
        )}
        {previewUrl && previewKind === "audio" && (
          <audio className="material-preview-audio" src={previewUrl} controls />
        )}
        {previewKind === "external" && (
          <div className="material-preview-placeholder">
            <FileText size={26} />
            <strong>{(previewMaterial?.fileType ?? "file").toUpperCase()} 材料</strong>
            <small>该类型无法内嵌预览，可在新窗口打开查看。</small>
          </div>
        )}
      </Modal>

      <Modal
        open={uploadOpen}
        title="上传材料"
        onClose={() => setUploadOpen(false)}
        footer={
          <div className="modal-footer-split">
            <small>标签只用于整理；材料在课节中的使用阶段不受限制</small>
            <div>
              <Button variant="ghost" onClick={() => setUploadOpen(false)}>取消</Button>
              <Button onClick={saveUpload}>上传材料</Button>
            </div>
          </div>
        }
      >
        <div className="editor-grid">
          <Field label="材料标题" className="field-span-2">
            <TextInput value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} placeholder="例如：问候句型速查卡" />
          </Field>
          <Field label="材料说明" className="field-span-2">
            <textarea className="input textarea" value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} />
          </Field>
          <div className="field field-span-2">
            <label className="field-label" htmlFor="material-tag-input">标签</label>
            <div className="material-tag-editor">
              <div className="material-tag-editor-values">
                {orderMaterialTags(form.tags).map((tag) => (
                  <span className={`material-tag-editor-chip${isMaterialUsageTag(tag) ? " is-usage" : ""}`} key={tag}>
                    {tag}
                    <button type="button" aria-label={`移除标签 ${tag}`} onClick={() => removeFormTag(tag)}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
                <input
                  id="material-tag-input"
                  className="material-tag-input"
                  value={tagDraft}
                  placeholder={form.tags.length ? "继续添加标签" : "输入标签，按回车添加"}
                  onChange={(event) => setTagDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === "," || event.key === "，") {
                      event.preventDefault();
                      addFormTags(tagDraft);
                    } else if (event.key === "Backspace" && !tagDraft && form.tags.length > 0) {
                      setForm((current) => ({ ...current, tags: current.tags.slice(0, -1) }));
                    }
                  }}
                />
              </div>
              <Button size="sm" variant="soft" disabled={!tagDraft.trim()} onClick={() => addFormTags(tagDraft)}>
                <Plus size={14} /> 添加
              </Button>
            </div>
            <small className="material-tag-hint">可用逗号分隔多个标签；预习 / 课堂使用 / 复习会固定置顶，一份材料可同时带多个用途。</small>
            {availableTags.some(([tag]) => !form.tags.includes(tag)) && (
              <div className="material-tag-suggestions">
                <small>推荐标签</small>
                <div>
                  {availableTags
                    .filter(([tag]) => !form.tags.includes(tag))
                    .slice(0, 10)
                    .map(([tag]) => (
                      <button type="button" key={tag} onClick={() => addFormTags(tag)}>+ {tag}</button>
                    ))}
                </div>
              </div>
            )}
          </div>
          <Field label="文件类型">
            <Select value={form.fileType} onChange={(event) => setForm((value) => ({ ...value, fileType: event.target.value }))}>
              <option value="pdf">PDF</option>
              <option value="pptx">PPTX</option>
              <option value="png">图片</option>
              <option value="wav">音频</option>
              <option value="video">视频外链</option>
            </Select>
          </Field>
          <Field label="语言">
            <Select value={form.language} onChange={(event) => setForm((value) => ({ ...value, language: event.target.value }))}>
              <option value="zh-id">中文 + 印尼语</option>
              <option value="zh-CN">中文</option>
              <option value="id-ID">印尼语</option>
            </Select>
          </Field>
        </div>
        <PmNote block kind="注意" note="文件保存后形成材料版本；替换文件不会覆盖历史版本和已有引用。">
          <div className="mock-upload-zone" onClick={() => setForm((value) => ({ ...value, fileName: value.fileName || "demo-upload.pdf" }))}>
            <UploadCloud size={30} />
            <strong>{form.fileName || "点击选择演示文件"}</strong>
            <small>原型不会把本地文件写入长期存储</small>
          </div>
        </PmNote>
      </Modal>
    </>
  );
}
