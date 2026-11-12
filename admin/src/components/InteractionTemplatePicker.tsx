import { useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import type { InteractionItem, InteractionTemplate, InteractionType } from "../domain/types";
import { INTERACTION_TYPE_SHORT_LABELS } from "../lib/interactionTypes";
import { orderTemplatesForBrowse, TEMPLATE_LEVEL_LABELS, templateLevelLabel } from "../lib/templateLibrary";
import { TemplateTypeChips } from "./TemplateTypeChips";
import { Badge, Button, Modal, TextInput } from "./ui";

const typeLabels: Record<InteractionType, string> = INTERACTION_TYPE_SHORT_LABELS;

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** 把模板题目复制成本次编辑可用的新题目（所有 id 重新生成，排序题的答案映射同步更新）。 */
export function templateToItem(template: InteractionTemplate): InteractionItem {
  const item = structuredClone(template.item);
  const idMap = new Map<string, string>();
  const nextId = (oldId: string, prefix: string) => {
    const value = makeId(prefix);
    idMap.set(oldId, value);
    return value;
  };
  item.id = nextId(item.id, "item");
  if (item.pairs) item.pairs = item.pairs.map((pair) => ({ ...pair, id: nextId(pair.id, "pair") }));
  if (item.choices) item.choices = item.choices.map((choice) => ({ ...choice, id: nextId(choice.id, "choice") }));
  if (item.orderItems) item.orderItems = item.orderItems.map((entry) => ({ ...entry, id: nextId(entry.id, "order") }));
  if (item.correctOrder) item.correctOrder = item.correctOrder.map((id) => idMap.get(id) ?? id);
  if (item.blanks) item.blanks = item.blanks.map((blank) => ({ ...blank, id: nextId(blank.id, "blank") }));
  if (item.pollOptions) item.pollOptions = item.pollOptions.map((option) => ({ ...option, id: nextId(option.id, "poll") }));
  // 第三批新题型：各自带 id 的结构都要重发，分类归组还要把词的归属改到新类别 id 上。
  if (item.groups) item.groups = item.groups.map((group) => ({ ...group, id: nextId(group.id, "group") }));
  if (item.words) {
    item.words = item.words.map((word) => ({ ...word, id: nextId(word.id, "word"), group: idMap.get(word.group) ?? word.group }));
  }
  if (item.badWords) item.badWords = item.badWords.map((word) => ({ ...word, id: nextId(word.id, "bad") }));
  if (item.pinyinGroups) {
    item.pinyinGroups = item.pinyinGroups.map((group) => ({ ...group, id: nextId(group.id, "pgroup") }));
  }
  if (item.speakingWords) item.speakingWords = item.speakingWords.map((word) => ({ ...word, id: nextId(word.id, "speak") }));
  if (item.scores) item.scores = item.scores.map((score) => ({ ...score, id: nextId(score.id, "score") }));
  return item;
}

export function InteractionTemplatePicker({
  open,
  onClose,
  templates,
  onPick
}: {
  open: boolean;
  onClose: () => void;
  templates: InteractionTemplate[];
  onPick: (template: InteractionTemplate) => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<InteractionType | "all">("all");
  const [level, setLevel] = useState<string>("all");
  const [visible, setVisible] = useState(12);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const matched = templates.filter((template) => {
      const typeMatch = type === "all" || template.type === type;
      const levelMatch = level === "all" || template.level === level;
      const queryMatch =
        !keyword ||
        template.title.toLowerCase().includes(keyword) ||
        template.topic.toLowerCase().includes(keyword) ||
        template.summary.toLowerCase().includes(keyword) ||
        template.tags.join(" ").toLowerCase().includes(keyword);
      return typeMatch && levelMatch && queryMatch;
    });
    return orderTemplatesForBrowse(matched, type);
  }, [templates, query, type, level]);

  return (
    <Modal
      open={open}
      title={`单题模板库 · 共 ${templates.length} 道`}
      onClose={onClose}
      width="980px"
      footer={
        <div className="modal-footer-split">
          <span>挑一道题插入当前互动；多道题可以共同组成一轮课堂互动。</span>
          <Button variant="ghost" onClick={onClose}>关闭</Button>
        </div>
      }
    >
      <div className="template-picker">
        <div className="template-picker-filter">
          <div className="search-box">
            <Search size={17} />
            <TextInput
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisible(12);
              }}
              placeholder="搜索主题、题型或关键词，例如“餐厅”“排序”"
            />
          </div>
          <TemplateTypeChips
            templates={templates}
            value={type}
            onChange={(next) => { setType(next); setVisible(12); }}
          />
          <div className="template-chip-row muted">
            <button className={level === "all" ? "active" : ""} onClick={() => { setLevel("all"); setVisible(12); }}>全部难度</button>
            {Object.keys(TEMPLATE_LEVEL_LABELS).map((key) => (
              <button key={key} className={level === key ? "active" : ""} onClick={() => { setLevel(key); setVisible(12); }}>
                {TEMPLATE_LEVEL_LABELS[key as keyof typeof TEMPLATE_LEVEL_LABELS]}
              </button>
            ))}
          </div>
        </div>

        <p className="muted-copy">筛选结果 {filtered.length} 套模板</p>

        <div className="template-grid">
          {filtered.slice(0, visible).map((template) => (
            <article key={template.id} className="template-card">
              <div className="template-card-head">
                <span className={`phase-badge phase-live`}>{typeLabels[template.type]}</span>
                <Badge tone="neutral">{templateLevelLabel(template.level)}</Badge>
              </div>
              <strong>{template.title}</strong>
              <small>{template.summary}</small>
              <div className="template-tags">
                {template.tags.slice(1, 3).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <Button size="sm" variant="secondary" onClick={() => onPick(template)}>
                <Sparkles size={14} /> 插入这道题
              </Button>
            </article>
          ))}
        </div>

        {filtered.length === 0 && <p className="muted-copy">没有匹配的模板，换个关键词试试。</p>}

        {filtered.length > visible && (
          <div className="template-more">
            <Button variant="ghost" onClick={() => setVisible((value) => value + 12)}>
              显示更多（还有 {filtered.length - visible} 套）
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
