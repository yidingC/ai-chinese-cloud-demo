import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, RotateCcw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { InteractionItem, InteractionMedia } from "../domain/types";
import { INTERACTION_TYPE_LABELS, INTERACTION_TYPE_SHORT_LABELS, isScorableInteractionType } from "../lib/interactionTypes";
import { scoreInteractionItems } from "../lib/interactionScoring";
import { Badge, Button, ProgressBar } from "./ui";
import { StudentPhoneMock } from "./StudentPhoneMock";

export interface PlayerResult {
  /** 没有可判分题时为 null，只记录参与。 */
  score: number | null;
  scoredItemCount: number;
  answers: Record<string, unknown>;
  wrongItemIds: string[];
  pollAnswers: Record<string, string>;
  elapsedSeconds: number;
}

interface InteractionPlayerProps {
  items: InteractionItem[];
  onComplete?: (result: PlayerResult) => void;
  onClose?: () => void;
  preview?: boolean;
  /** 投影原题场景：只演示当前这一题，底部不显示“关闭”和“下一题/完成”。 */
  projection?: boolean;
  /** app = 学生端手机画面：隐藏后台用的题号、题型角标、进度条和底部操作，只留题目与反馈。 */
  variant?: "default" | "app";
  /** 手机壳预览从第几题开始（编辑器里预览当前编辑的那一题）。 */
  initialIndex?: number;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

export function InteractionPlayer({
  items,
  onComplete,
  onClose,
  preview = false,
  projection = false,
  variant = "default",
  initialIndex = 0
}: InteractionPlayerProps) {
  const appMode = variant === "app";
  const { t } = useTranslation();
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(0, items.length - 1))
  );
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [results, setResults] = useState<Record<string, boolean | null>>({});
  const [pollAnswers, setPollAnswers] = useState<Record<string, string>>({});
  const [startedAt] = useState(() => Date.now());
  /** 手机壳预览答完最后一题后的结果页，只在 app 模式使用。 */
  const [finalResult, setFinalResult] = useState<PlayerResult | null>(null);
  const current = items[index];

  function resolveItem(itemId: string, correct: boolean, answer: unknown) {
    setResults((previous) => ({ ...previous, [itemId]: correct }));
    setAnswers((previous) => ({ ...previous, [itemId]: answer }));
  }

  function next() {
    if (index < items.length - 1) {
      setIndex((value) => value + 1);
      return;
    }
    const { score, scoredItemCount, wrongItemIds } = scoreInteractionItems(items, results);
    const payload = {
      score,
      scoredItemCount,
      answers,
      wrongItemIds,
      pollAnswers,
      elapsedSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000))
    };
    setFinalResult(payload);
    onComplete?.(payload);
  }

  /** 手机壳预览的「重做」：清空作答，从第一题重新开始。 */
  function resetRun() {
    setResults({});
    setAnswers({});
    setPollAnswers({});
    setIndex(0);
    setFinalResult(null);
  }

  if (!current) {
    return (
      <div className="player-empty">
        <strong>暂无互动内容</strong>
        <span>教师在编辑器中添加题目后会显示在这里。</span>
      </div>
    );
  }

  const isResolved = current.type === "poll" ? Boolean(pollAnswers[current.id]) : results[current.id] !== undefined && results[current.id] !== null;
  const isCorrect = results[current.id] === true;
  const isParticipationOnly = !isScorableInteractionType(current.type);
  const correctChoices = (current.choices ?? []).filter((choice) => choice.isCorrect).map((choice) => choice.text);
  const correctAnswerText =
    current.type === "picture" || current.type === "situation" || current.type === "dialogue" || current.type === "listening"
      ? correctChoices.join("、")
      : current.type === "word-build"
        ? `${current.answerWord ?? (current.answer ?? []).join("")}（${current.answerPinyin ?? ""}）`
        : current.type === "correction"
          ? current.fixedSentence ?? ""
          : current.type === "read-aloud"
            ? `${current.sentence ?? ""}（${current.promptPinyin ?? ""}）`
            : "";

  const done = appMode && finalResult !== null;
  const player = (
    <section className={`interaction-player ${appMode ? "player-app-mode" : ""} ${done ? "is-done" : ""}`}>
      <header className="player-header">
        <div>
          {!appMode && (
            <span className="eyebrow">
              互动 {index + 1} / {items.length}
            </span>
          )}
          <h2>{current.prompt}</h2>
        </div>
        {!appMode && (
          <Badge tone={current.type === "poll" ? "blue" : "purple"}>
            {INTERACTION_TYPE_SHORT_LABELS[current.type]}
          </Badge>
        )}
      </header>

      {!appMode && (
        <ProgressBar value={((index + (isResolved ? 1 : 0)) / Math.max(1, items.length)) * 100} />
      )}

      {done ? (
        <div className="player-app-done">
          <span className="player-app-score">{finalResult?.score ?? t("student.player.participationComplete")}</span>
          <strong>本节互动已完成</strong>
          <p>
            {finalResult?.score === null
              ? t("student.player.participationSummary", { seconds: finalResult?.elapsedSeconds ?? 0 })
              : t("student.player.summary", { seconds: finalResult?.elapsedSeconds ?? 0, wrong: finalResult?.wrongItemIds.length ?? 0 })}
          </p>
          <Button onClick={resetRun}><RotateCcw size={15} /> 重做一遍</Button>
        </div>
      ) : (
        <>
      <div className="player-stage">
        {current.type === "match" && (
          <PairingStage
            key={current.id}
            item={current}
            disabled={isResolved}
            onResolved={(correct) => resolveItem(current.id, correct, current.pairs)}
          />
        )}
        {current.type === "picture-match" && (
          <PairingStage
            key={current.id}
            mediaLeft
            item={current}
            disabled={isResolved}
            onResolved={(correct) => resolveItem(current.id, correct, current.pairs)}
          />
        )}
        {current.type === "picture" && (
          <PictureStage
            key={current.id}
            item={current}
            disabled={isResolved}
            onResolved={(correct, selected) => resolveItem(current.id, correct, selected)}
          />
        )}
        {current.type === "situation" && (
          <SituationStage
            key={current.id}
            item={current}
            disabled={isResolved}
            onResolved={(correct, selected) => resolveItem(current.id, correct, selected)}
          />
        )}
        {current.type === "dialogue" && (
          <DialogueStage
            key={current.id}
            item={current}
            disabled={isResolved}
            onResolved={(correct, selected) => resolveItem(current.id, correct, selected)}
          />
        )}
        {current.type === "memory" && (
          <MemoryStage
            key={current.id}
            item={current}
            disabled={isResolved}
            onResolved={(correct) => resolveItem(current.id, correct, current.pairs)}
          />
        )}
        {current.type === "choice" && (
          <ChoiceStage
            key={current.id}
            item={current}
            disabled={isResolved}
            onResolved={(correct, selected) => resolveItem(current.id, correct, selected)}
          />
        )}
        {current.type === "order" && (
          <OrderStage
            key={current.id}
            item={current}
            disabled={isResolved}
            onResolved={(correct, order) => resolveItem(current.id, correct, order)}
          />
        )}
        {current.type === "fill" && (
          <FillStage
            key={current.id}
            item={current}
            disabled={isResolved}
            onResolved={(correct, values) => resolveItem(current.id, correct, values)}
          />
        )}
        {current.type === "poll" && (
          <PollStage
            key={current.id}
            item={current}
            disabled={isResolved}
            selected={pollAnswers[current.id]}
            onSelect={(optionId) => {
              setPollAnswers((previous) => ({ ...previous, [current.id]: optionId }));
              setResults((previous) => ({ ...previous, [current.id]: true }));
              setAnswers((previous) => ({ ...previous, [current.id]: optionId }));
            }}
          />
        )}
        {current.type === "category" && (
          <CategoryStage
            key={current.id}
            item={current}
            disabled={isResolved}
            onResolved={(correct, placements) => resolveItem(current.id, correct, placements)}
          />
        )}
        {current.type === "word-build" && (
          <WordBuildStage
            key={current.id}
            item={current}
            disabled={isResolved}
            onResolved={(correct, built) => resolveItem(current.id, correct, built)}
          />
        )}
        {current.type === "correction" && (
          <CorrectionStage
            key={current.id}
            item={current}
            disabled={isResolved}
            onResolved={(correct, picked) => resolveItem(current.id, correct, picked)}
          />
        )}
        {current.type === "pinyin-match" && (
          <PinyinMatchStage
            key={current.id}
            item={current}
            disabled={isResolved}
            onResolved={(correct, groups) => resolveItem(current.id, correct, groups)}
          />
        )}
        {current.type === "listening" && (
          <ListeningStage
            key={current.id}
            item={current}
            disabled={isResolved}
            onResolved={(correct, selected) => resolveItem(current.id, correct, selected)}
          />
        )}
        {(current.type === "read-aloud" || current.type === "picture-talk" || current.type === "open-qa") && (
          <SpeakingStage
            key={current.id}
            item={current}
            disabled={isResolved}
            onResolved={(correct, spoken) => resolveItem(current.id, correct, spoken)}
          />
        )}
      </div>

      {isResolved && (
        <div className={`answer-feedback ${isCorrect || isParticipationOnly ? "correct" : "incorrect"}`}>
          {isCorrect || isParticipationOnly ? <Check size={18} /> : <X size={18} />}
          <div>
            <strong>
              {current.type === "poll"
                ? t("student.pollThanks")
                : isParticipationOnly
                  ? t("student.player.participationRecorded")
                  : isCorrect
                    ? t("student.correct")
                    : t("student.incorrect")}
            </strong>
            {!isCorrect && !isParticipationOnly && correctAnswerText && <p>正确答案：{correctAnswerText}</p>}
            <p>{current.explanation}</p>
          </div>
        </div>
      )}

      {appMode && !projection && (
        <div className="player-app-actions">
          <Button variant="ghost" size="sm" onClick={resetRun}>
            <RotateCcw size={14} /> 重做
          </Button>
          <Button disabled={!isResolved} onClick={next}>
            {index === items.length - 1 ? "完成" : "下一题"}
          </Button>
        </div>
      )}
        </>
      )}

      {!appMode && (
      <footer className="player-footer">
        {!projection && (
          <Button variant="ghost" onClick={onClose}>
            {t("common.close")}
          </Button>
        )}
        <div className="player-actions">
          {preview && (
            <Button variant="secondary" size="sm" onClick={resetRun}>
              <RotateCcw size={16} /> 重置预览
            </Button>
          )}
          {!projection && (
            <Button onClick={next} disabled={!isResolved}>
              {index === items.length - 1 ? t("student.finish") : t("student.nextItem")}
            </Button>
          )}
        </div>
      </footer>
      )}
    </section>
  );

  if (!appMode) return player;

  return (
    <StudentPhoneMock
      typeLabel={INTERACTION_TYPE_LABELS[current.type]}
      current={index + 1}
      total={items.length}
    >
      {player}
    </StudentPhoneMock>
  );
}

/** 「预览全部互动」弹窗内容：手机壳 + 说明，按学生做题顺序连播。 */
export function StudentPhonePreview({
  items,
  onClose
}: {
  items: InteractionItem[];
  onClose?: () => void;
}) {
  return (
    <div className="student-preview-modal">
      <InteractionPlayer items={items} preview variant="app" onClose={onClose} />
      <p className="student-preview-modal-hint">按学生在 APP 里做题的顺序预览，不计入成绩、不写作答记录。</p>
    </div>
  );
}

/** 连线 / 图片—词语连线共用一套点选配对逻辑，mediaLeft 决定左列显示图片还是文字。 */
function PairingStage({
  item,
  disabled,
  mediaLeft = false,
  onResolved
}: {
  item: InteractionItem;
  disabled: boolean;
  mediaLeft?: boolean;
  onResolved: (correct: boolean) => void;
}) {
  const [rightItems] = useState(() => shuffle(item.pairs ?? []));
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string[]>([]);

  function chooseRight(rightId: string) {
    if (disabled || !selectedLeft) return;
    if (selectedLeft === rightId) {
      const nextMatched = [...matched, selectedLeft];
      setMatched(nextMatched);
      setSelectedLeft(null);
      if (nextMatched.length === (item.pairs?.length ?? 0)) onResolved(true);
      return;
    }
    setWrong([selectedLeft, rightId]);
    window.setTimeout(() => {
      setWrong([]);
      setSelectedLeft(null);
    }, 650);
  }

  return (
    <div className="match-player-grid">
      <div className="match-player-column">
        {(item.pairs ?? []).map((pair) => (
          <button
            key={pair.id}
            className={`match-tile ${selectedLeft === pair.id ? "selected" : ""} ${matched.includes(pair.id) ? "matched" : ""} ${wrong.includes(pair.id) ? "wrong" : ""}`}
            disabled={disabled || matched.includes(pair.id)}
            onClick={() => setSelectedLeft(pair.id)}
          >
            {mediaLeft ? <MediaSlot media={pair.media} fallback={pair.left} /> : <strong>{pair.left}</strong>}
          </button>
        ))}
      </div>
      <div className="match-player-column">
        {rightItems.map((pair) => (
          <button
            key={`right-${pair.id}`}
            className={`match-tile ${matched.includes(pair.id) ? "matched" : ""} ${wrong.includes(pair.id) ? "wrong" : ""}`}
            disabled={disabled || matched.includes(pair.id)}
            onClick={() => chooseRight(pair.id)}
          >
            <strong>{pair.right}</strong>
            {mediaLeft && pair.rightPinyin && <small className="match-tile-hint">{pair.rightPinyin}</small>}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 图槽：有图片地址就显示真图，否则显示 emoji。 */
function MediaSlot({ media, fallback }: { media?: InteractionMedia; fallback?: string }) {
  if (!media || (!media.image && !media.icon)) {
    return <strong>{fallback}</strong>;
  }
  if (media.image) {
    return <img className="media-slot-image" src={media.image} alt={media.alt || fallback || ""} />;
  }
  return (
    <span className="media-slot" role="img" aria-label={media.alt || fallback || ""}>
      {media.icon}
    </span>
  );
}

function ImageChoiceStage({
  item,
  disabled,
  leading,
  onResolved
}: {
  item: InteractionItem;
  disabled: boolean;
  leading?: ReactNode;
  onResolved: (correct: boolean, selected: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  function toggle(choiceId: string) {
    if (disabled) return;
    setSelected((current) => (current.includes(choiceId) ? [] : [choiceId]));
  }
  const correct = (item.choices ?? []).filter((choice) => choice.isCorrect).map((choice) => choice.id);
  return (
    <div className="image-choice-player">
      {leading}
      <div className="choice-player-list">
        {(item.choices ?? []).map((choice, choiceIndex) => (
          <button
            key={choice.id}
            className={`choice-player-item ${selected.includes(choice.id) ? "selected" : ""}`}
            onClick={() => toggle(choice.id)}
            disabled={disabled}
          >
            <span>{LETTERS[choiceIndex]}</span>
            <strong>
              {choice.text}
              {item.type === "picture" && choice.hint && <i className="option-hint">{choice.hint}</i>}
            </strong>
          </button>
        ))}
      </div>
      {!disabled && <p className="stage-hint">先选一个答案，提交后不能改。</p>}
      <Button
        className="stage-submit"
        disabled={disabled || selected.length === 0}
        onClick={() => onResolved(selected[0] === correct[0], selected)}
      >
        提交本题
      </Button>
    </div>
  );
}

function PictureStage({
  item,
  disabled,
  onResolved
}: {
  item: InteractionItem;
  disabled: boolean;
  onResolved: (correct: boolean, selected: string[]) => void;
}) {
  return (
    <ImageChoiceStage
      item={item}
      disabled={disabled}
      onResolved={onResolved}
      leading={
        <figure className="picture-player-figure">
          <div className="picture-player-slot">
            <MediaSlot media={item.media} />
          </div>
          {item.promptPinyin && <figcaption className="picture-player-pinyin">{item.promptPinyin}</figcaption>}
        </figure>
      }
    />
  );
}

function SituationStage({
  item,
  disabled,
  onResolved
}: {
  item: InteractionItem;
  disabled: boolean;
  onResolved: (correct: boolean, selected: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const choices = item.choices ?? [];
  const correctId = choices.find((choice) => choice.isCorrect)?.id;
  return (
    <div className="situation-player">
      <div className="situation-scene-card">
        <div className="situation-scene-slot">
          <MediaSlot media={item.media} fallback="🙋" />
        </div>
        <div>
          {item.sceneTranslation && <p className="situation-scene-translation">{item.sceneTranslation}</p>}
          <h3>{item.scene || item.prompt}</h3>
        </div>
      </div>
      <div className="choice-player-list">
        {choices.map((choice, choiceIndex) => {
          const revealHint = disabled && choice.hint;
          return (
            <button
              key={choice.id}
              className={`choice-player-item ${selected.includes(choice.id) ? "selected" : ""} ${disabled && choice.id === correctId ? "answer-correct" : ""}`}
              onClick={() => {
                if (!disabled) setSelected([choice.id]);
              }}
              disabled={disabled}
            >
              <span>{LETTERS[choiceIndex]}</span>
              <strong>
                {choice.text}
                {revealHint && <i className="option-hint">{choice.hint}</i>}
              </strong>
            </button>
          );
        })}
      </div>
      <Button
        className="stage-submit"
        disabled={disabled || selected.length === 0}
        onClick={() => onResolved(selected[0] === correctId, selected)}
      >
        提交本题
      </Button>
    </div>
  );
}

function DialogueStage({
  item,
  disabled,
  onResolved
}: {
  item: InteractionItem;
  disabled: boolean;
  onResolved: (correct: boolean, selected: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const choices = item.choices ?? [];
  const correctId = choices.find((choice) => choice.isCorrect)?.id;
  const picked = choices.find((choice) => choice.id === selected[0]);
  return (
    <div className="dialogue-player">
      <ul className="dialogue-thread">
        <li className="dialogue-turn is-them">
          <span>对方</span>
          <p>{item.dialogueThem || "……"}</p>
        </li>
        <li className="dialogue-turn is-me">
          <span>我</span>
          <p className={picked ? "" : "is-placeholder"}>{picked ? picked.text : item.dialoguePlaceholder || "？"}</p>
        </li>
      </ul>
      <div className="choice-player-list">
        {choices.map((choice, choiceIndex) => (
          <button
            key={choice.id}
            className={`choice-player-item ${selected.includes(choice.id) ? "selected" : ""} ${disabled && choice.id === correctId ? "answer-correct" : ""}`}
            onClick={() => {
              if (!disabled) setSelected([choice.id]);
            }}
            disabled={disabled}
          >
            <span>{LETTERS[choiceIndex]}</span>
            <strong>{choice.text}</strong>
          </button>
        ))}
      </div>
      <Button
        className="stage-submit"
        disabled={disabled || selected.length === 0}
        onClick={() => onResolved(selected[0] === correctId, selected)}
      >
        提交本题
      </Button>
    </div>
  );
}

function MemoryStage({
  item,
  disabled,
  onResolved
}: {
  item: InteractionItem;
  disabled: boolean;
  onResolved: (correct: boolean) => void;
}) {
  const cards = useMemo(
    () =>
      shuffle(
        (item.pairs ?? []).flatMap((pair) => [
          { id: `${pair.id}-left`, pairId: pair.id, text: pair.left },
          { id: `${pair.id}-right`, pairId: pair.id, text: pair.right }
        ])
      ),
    [item.pairs]
  );
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const resolving = useRef(false);

  function flip(card: (typeof cards)[number]) {
    if (disabled || resolving.current || flipped.includes(card.id) || matched.includes(card.pairId)) return;
    if (flipped.length === 0) {
      setFlipped([card.id]);
      return;
    }
    const firstId = flipped[0];
    const first = cards.find((candidate) => candidate.id === firstId);
    if (!first) return;
    setFlipped([firstId, card.id]);
    if (first.pairId === card.pairId) {
      const nextMatched = [...matched, card.pairId];
      setMatched(nextMatched);
      setFlipped([]);
      if (nextMatched.length === (item.pairs?.length ?? 0)) onResolved(true);
      return;
    }
    resolving.current = true;
    window.setTimeout(() => {
      setFlipped([]);
      resolving.current = false;
    }, 750);
  }

  return (
    <div className="memory-player-grid">
      {cards.map((card) => {
        const isOpen = flipped.includes(card.id) || matched.includes(card.pairId);
        return (
          <button key={card.id} className={`memory-player-card ${isOpen ? "open" : ""} ${matched.includes(card.pairId) ? "matched" : ""}`} onClick={() => flip(card)}>
            <span>{isOpen ? card.text : "?"}</span>
          </button>
        );
      })}
    </div>
  );
}

function ChoiceStage({
  item,
  disabled,
  onResolved
}: {
  item: InteractionItem;
  disabled: boolean;
  onResolved: (correct: boolean, selected: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  function toggle(choiceId: string) {
    if (disabled) return;
    if (item.multiple) {
      setSelected((current) => (current.includes(choiceId) ? current.filter((id) => id !== choiceId) : [...current, choiceId]));
    } else {
      setSelected([choiceId]);
    }
  }
  const correct = (item.choices ?? []).filter((choice) => choice.isCorrect).map((choice) => choice.id).sort();
  return (
    <div className="choice-player-list">
      {(item.choices ?? []).map((choice, choiceIndex) => (
        <button key={choice.id} className={`choice-player-item ${selected.includes(choice.id) ? "selected" : ""}`} onClick={() => toggle(choice.id)} disabled={disabled}>
          <span>{LETTERS[choiceIndex]}</span>
          <strong>{choice.text}</strong>
        </button>
      ))}
      <Button
        className="stage-submit"
        disabled={disabled || selected.length === 0}
        onClick={() => onResolved(JSON.stringify([...selected].sort()) === JSON.stringify(correct), selected)}
      >
        提交本题
      </Button>
    </div>
  );
}

function SortableOrderItem({ id, text }: { id: string; text: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`sortable-item ${isDragging ? "dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <GripVertical size={18} />
      <strong>{text}</strong>
    </div>
  );
}

function OrderStage({
  item,
  disabled,
  onResolved
}: {
  item: InteractionItem;
  disabled: boolean;
  onResolved: (correct: boolean, order: string[]) => void;
}) {
  const [order, setOrder] = useState(() => shuffle(item.orderItems ?? []));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((items) => {
      const oldIndex = items.findIndex((entry) => entry.id === active.id);
      const newIndex = items.findIndex((entry) => entry.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  }
  const ids = order.map((entry) => entry.id);
  const correct = JSON.stringify(ids) === JSON.stringify(item.correctOrder);
  return (
    <div className="order-player">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="sortable-list">
            {order.map((entry) => (
              <SortableOrderItem key={entry.id} id={entry.id} text={entry.text} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <Button className="stage-submit" disabled={disabled} onClick={() => onResolved(correct, ids)}>
        提交本题
      </Button>
    </div>
  );
}

function FillStage({
  item,
  disabled,
  onResolved
}: {
  item: InteractionItem;
  disabled: boolean;
  onResolved: (correct: boolean, values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const blanks = item.blanks ?? [];
  const allCorrect = blanks.every((blank) => {
    const value = (values[blank.id] ?? "").trim().toLowerCase();
    return blank.answers.some((answer) => answer.trim().toLowerCase() === value);
  });
  const parts = (item.sentence ?? item.prompt).split("____");
  return (
    <div className="fill-player">
      <div className="fill-sentence">
        {parts.map((part, index) => (
          <span key={`${part}-${index}`}>
            {part}
            {index < blanks.length && (
              <input
                className="fill-input"
                value={values[blanks[index].id] ?? ""}
                onChange={(event) => setValues((previous) => ({ ...previous, [blanks[index].id]: event.target.value }))}
                disabled={disabled}
                aria-label={`空 ${index + 1}`}
              />
            )}
          </span>
        ))}
      </div>
      <Button className="stage-submit" disabled={disabled || blanks.some((blank) => !values[blank.id]?.trim())} onClick={() => onResolved(allCorrect, values)}>
        提交本题
      </Button>
    </div>
  );
}

function PollStage({
  item,
  disabled,
  selected,
  onSelect
}: {
  item: InteractionItem;
  disabled: boolean;
  selected?: string;
  onSelect: (optionId: string) => void;
}) {
  return (
    <div className="poll-player">
      {(item.pollOptions ?? []).map((option, optionIndex) => (
        <button key={option.id} className={`poll-option ${selected === option.id ? "selected" : ""}`} onClick={() => onSelect(option.id)} disabled={disabled}>
          <span>{LETTERS[optionIndex]}</span>
          <strong>{option.text}</strong>
          <i>{selected === option.id ? "已选择" : "选择"}</i>
        </button>
      ))}
    </div>
  );
}

/* ---------------- 第三批新题型：分类 / 组词 / 改错 / 拼音匹配 / 听力 / 语音 ---------------- */

/** 分类归组：选中一个词，再点类别放进；放错的原样退回。 */
function CategoryStage({
  item,
  disabled,
  onResolved
}: {
  item: InteractionItem;
  disabled: boolean;
  onResolved: (correct: boolean, placements: Record<string, string>) => void;
}) {
  const groups = item.groups ?? [];
  const words = useMemo(() => shuffle(item.words ?? []), [item.words]);
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string>();
  const [flash, setFlash] = useState<{ word: string; group: string }>();
  const [mistakes, setMistakes] = useState(0);
  const pool = words.filter((word) => placed[word.id] === undefined);

  function place(wordId: string, groupId: string) {
    if (disabled || placed[wordId] !== undefined) return;
    const word = words.find((entry) => entry.id === wordId);
    if (!word) return;
    if (word.group === groupId) {
      setPlaced((previous) => ({ ...previous, [wordId]: groupId }));
      setSelectedId(undefined);
      return;
    }
    setMistakes((value) => value + 1);
    setFlash({ word: wordId, group: groupId });
    window.setTimeout(() => {
      setFlash(undefined);
      setSelectedId(undefined);
    }, 700);
  }

  return (
    <div className="category-player">
      <div className="category-player-pool">
        <span>待归类</span>
        <div>
          {pool.map((word) => (
            <button
              key={word.id}
              className={`category-word-chip ${selectedId === word.id ? "selected" : ""} ${flash?.word === word.id ? "wrong" : ""}`}
              onClick={() => setSelectedId((value) => (value === word.id ? undefined : word.id))}
              disabled={disabled}
            >
              <strong>{word.text}</strong>
              {word.pinyin && <small>{word.pinyin}</small>}
            </button>
          ))}
          {pool.length === 0 && <em>词都归好类了，点「提交」看看结果。</em>}
        </div>
      </div>
      <div className="category-player-groups">
        {groups.map((group) => (
          <section key={group.id} className={`category-player-group ${flash?.group === group.id ? "wrong" : ""}`}>
            <header>
              <strong>{group.name}</strong>
              {group.hint && <small>{group.hint}</small>}
            </header>
            <div>
              {words.filter((word) => placed[word.id] === group.id).map((word) => (
                <span key={word.id} className="category-placed-chip">{word.text}</span>
              ))}
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={disabled || !selectedId}
              onClick={() => selectedId && place(selectedId, group.id)}
            >
              放进这一类
            </Button>
          </section>
        ))}
      </div>
      <Button
        className="stage-submit"
        disabled={disabled || pool.length > 0}
        onClick={() => onResolved(mistakes === 0, placed)}
      >
        提交本题
      </Button>
    </div>
  );
}

/** 拼字 / 组词：点字块填进空格，点空格取回；按位置逐字判分。 */
function WordBuildStage({
  item,
  disabled,
  onResolved
}: {
  item: InteractionItem;
  disabled: boolean;
  onResolved: (correct: boolean, built: string) => void;
}) {
  const answer = useMemo(() => item.answer ?? [], [item.answer]);
  const tiles = useMemo(() => {
    const source = item.tileBank && item.tileBank.length > 0 ? item.tileBank : answer;
    return shuffle(source.map((text, index) => ({ id: `tile-${index}-${text}`, text })));
  }, [item.tileBank, answer]);
  const [slots, setSlots] = useState<Array<string | undefined>>(() => answer.map(() => undefined));
  const built = slots.map((tileId) => tiles.find((tile) => tile.id === tileId)?.text ?? "").join("");
  const usedTiles = slots.filter(Boolean);

  function fill(tileId: string) {
    if (disabled || usedTiles.includes(tileId)) return;
    setSlots((current) => {
      const next = [...current];
      const empty = next.findIndex((value) => value === undefined);
      if (empty >= 0) next[empty] = tileId;
      return next;
    });
  }

  return (
    <div className="word-build-player">
      <div className="word-build-stem">
        <span>{item.meaning || "看提示拼词"}</span>
        <strong>{item.answerPinyin}</strong>
      </div>
      <div className="word-build-slots">
        {slots.map((tileId, index) => {
          const tile = tiles.find((entry) => entry.id === tileId);
          return (
            <button
              key={`slot-${index}`}
              className={tile ? "word-build-slot filled" : "word-build-slot"}
              onClick={() => {
                if (disabled) return;
                setSlots((current) => current.map((value, position) => (position === index ? undefined : value)));
              }}
              aria-label={`第 ${index + 1} 个空格`}
            >
              {tile?.text ?? ""}
            </button>
          );
        })}
      </div>
      <div className="word-build-bank">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            className={usedTiles.includes(tile.id) ? "word-build-tile used" : "word-build-tile"}
            onClick={() => fill(tile.id)}
            disabled={disabled || usedTiles.includes(tile.id)}
          >
            {tile.text}
          </button>
        ))}
      </div>
      <Button
        className="stage-submit"
        disabled={disabled || slots.some((value) => value === undefined)}
        onClick={() => onResolved(built === answer.join(""), built)}
      >
        提交本题
      </Button>
    </div>
  );
}

/** 找错误 / 改错：点出用错的词，答后展示改好的整句。 */
function CorrectionStage({
  item,
  disabled,
  onResolved
}: {
  item: InteractionItem;
  disabled: boolean;
  onResolved: (correct: boolean, picked: string) => void;
}) {
  const words = item.badWords ?? [];
  const [picked, setPicked] = useState<string>();
  const wrongWord = words.find((word) => word.wrong);
  return (
    <div className="correction-player">
      <div className="correction-sentence">
        {words.map((word) => (
          <button
            key={word.id}
            className={`correction-word ${picked === word.id ? "selected" : ""} ${disabled && word.wrong ? "answer-correct" : ""}`}
            onClick={() => !disabled && setPicked(word.id)}
            disabled={disabled}
          >
            <strong>{word.text}</strong>
            {word.pinyin && <small>{word.pinyin}</small>}
          </button>
        ))}
      </div>
      {disabled && item.fixedSentence && (
        <div className="correction-fixed">
          <strong>改好的句子</strong>
          <p>{item.fixedSentence}</p>
          {item.fixedPinyin && <small>{item.fixedPinyin}</small>}
        </div>
      )}
      <Button className="stage-submit" disabled={disabled || !picked} onClick={() => onResolved(picked === wrongWord?.id, picked ?? "")}>
        提交本题
      </Button>
    </div>
  );
}

/** 拼音—汉字—含义匹配：一屏一组，先选汉字再选意思，选错原地重试。 */
function PinyinMatchStage({
  item,
  disabled,
  onResolved
}: {
  item: InteractionItem;
  disabled: boolean;
  onResolved: (correct: boolean, answers: string[]) => void;
}) {
  const groups = item.pinyinGroups ?? [];
  const [groupIndex, setGroupIndex] = useState(0);
  const [stage, setStage] = useState<"word" | "meaning">("word");
  const [completed, setCompleted] = useState(0);
  const [wrong, setWrong] = useState<string>();
  const [pickedWord, setPickedWord] = useState<string>();
  const group = groups[groupIndex];
  const finished = completed >= groups.length;

  function flashWrong(value: string) {
    setWrong(value);
    window.setTimeout(() => setWrong(undefined), 700);
  }

  function chooseWord(option: string) {
    if (disabled || !group || stage !== "word") return;
    if (option === group.word) {
      setPickedWord(option);
      setStage("meaning");
      return;
    }
    flashWrong(`word-${option}`);
  }

  function chooseMeaning(option: string) {
    if (disabled || !group || stage !== "meaning") return;
    if (option !== group.meaning) {
      flashWrong(`meaning-${option}`);
      return;
    }
    const done = completed + 1;
    setCompleted(done);
    setPickedWord(undefined);
    setStage("word");
    if (done >= groups.length) {
      setGroupIndex(groups.length);
      return;
    }
    window.setTimeout(() => setGroupIndex((value) => value + 1), 400);
  }

  return (
    <div className="pinyin-match-player">
      <div className="pinyin-match-progress">
        {groups.map((entry, index) => (
          <span key={entry.id} className={index < completed ? "done" : index === groupIndex ? "active" : ""} />
        ))}
      </div>
      {group ? (
        <>
          <div className="pinyin-match-card">
            <strong>{group.pinyin}</strong>
            <small>{pickedWord ? `${pickedWord} · 再选它的意思` : "先选出这个拼音对应的汉字"}</small>
          </div>
          <div className="pinyin-match-columns">
            <div className="pinyin-match-options">
              {group.wordOptions.map((option) => (
                <button
                  key={option}
                  className={`pinyin-match-option ${pickedWord === option ? "selected" : ""} ${wrong === `word-${option}` ? "wrong" : ""}`}
                  onClick={() => chooseWord(option)}
                  disabled={disabled || stage !== "word"}
                >
                  {option}
                </button>
              ))}
            </div>
            {stage === "meaning" && (
              <div className="pinyin-match-options">
                {group.meaningOptions.map((option) => (
                  <button
                    key={option}
                    className={`pinyin-match-option ${wrong === `meaning-${option}` ? "wrong" : ""}`}
                    onClick={() => chooseMeaning(option)}
                    disabled={disabled}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="stage-hint">选错会重新开始这一组，但不会显示答案。</p>
        </>
      ) : (
        <p className="stage-hint">全部组都完成了，提交后看结果。</p>
      )}
      <Button className="stage-submit" disabled={disabled || !finished} onClick={() => onResolved(true, groups.map((entry) => entry.word))}>
        提交本题
      </Button>
    </div>
  );
}

/** 听音选图 / 选词：播放音频（占位时用计时器模拟），再选听到的内容。 */
function ListeningStage({
  item,
  disabled,
  onResolved
}: {
  item: InteractionItem;
  disabled: boolean;
  onResolved: (correct: boolean, selected: string) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string>();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const correctId = (item.choices ?? []).find((choice) => choice.isCorrect)?.id;

  function play() {
    if (disabled || playing) return;
    if (item.audioSrc) {
      const audio = audioRef.current;
      if (audio) {
        void audio.play().catch(() => undefined);
        return;
      }
    }
    setPlaying(true);
    window.setTimeout(() => setPlaying(false), 1000);
  }

  return (
    <div className="listening-player">
      <div className="listening-audio-card">
        <button className={`listening-play ${playing ? "playing" : ""}`} onClick={play} disabled={disabled || playing} aria-label="播放音频">
          {playing ? "🔊" : "▶"}
        </button>
        <div>
          <strong>{playing ? "播放中…" : "点一下听音频"}</strong>
          <small>{item.audioSrc ? "来自题目的音频文件" : "音频待录制（占位播放）"}</small>
        </div>
      </div>
      {item.audioSrc && <audio ref={audioRef} src={item.audioSrc} onEnded={() => setPlaying(false)} />}
      <div className="choice-player-list">
        {(item.choices ?? []).map((choice, choiceIndex) => (
          <button
            key={choice.id}
            className={`choice-player-item ${selected === choice.id ? "selected" : ""} ${disabled && choice.id === correctId ? "answer-correct" : ""}`}
            onClick={() => !disabled && setSelected(choice.id)}
            disabled={disabled}
          >
            <span>{LETTERS[choiceIndex]}</span>
            <strong>
              {choice.text}
              {choice.hint && <i className="option-hint">{choice.hint}</i>}
            </strong>
          </button>
        ))}
      </div>
      <Button className="stage-submit" disabled={disabled || !selected} onClick={() => onResolved(selected === correctId, selected ?? "")}>
        提交本题
      </Button>
    </div>
  );
}

const SPEAKING_MIN_MS = 700;

/** 范读播放：有音频地址时真播放，否则按占位播放提示一下。 */
function PlayModelButton({ item, disabled }: { item: InteractionItem; disabled: boolean }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function play() {
    if (disabled || playing) return;
    if (item.audioSrc) {
      const audio = audioRef.current;
      if (audio) {
        void audio.play().catch(() => undefined);
        return;
      }
    }
    setPlaying(true);
    window.setTimeout(() => setPlaying(false), 1000);
  }

  return (
    <>
      <button className={`listening-play ${playing ? "playing" : ""}`} onClick={play} aria-label="播放范读" disabled={disabled || playing}>
        {playing ? "🔊" : "▶"}
      </button>
      {item.audioSrc && <audio ref={audioRef} src={item.audioSrc} onEnded={() => setPlaying(false)} />}
    </>
  );
}

/** 跟读模仿 / 看图说话 / 开放问答共用的占位录音流程（不调用麦克风、不弹授权）。 */
function SpeakingStage({
  item,
  disabled,
  onResolved
}: {
  item: InteractionItem;
  disabled: boolean;
  onResolved: (correct: boolean, spoken: string) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "recording" | "recognizing" | "result">("idle");
  const startedAt = useRef(0);
  const isReadAloud = item.type === "read-aloud";
  const isPictureTalk = item.type === "picture-talk";
  const leadText = isReadAloud ? item.sentence ?? "" : item.prompt;
  const leadPinyin = isReadAloud ? item.promptPinyin : item.sampleAnswerPinyin;

  useEffect(() => {
    if (phase !== "recognizing") return;
    const timer = window.setTimeout(() => setPhase("result"), 1000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  function startRecording() {
    if (disabled || phase !== "idle") return;
    startedAt.current = Date.now();
    setPhase("recording");
  }

  function stopRecording() {
    if (phase !== "recording") return;
    const elapsed = Date.now() - startedAt.current;
    if (elapsed < SPEAKING_MIN_MS) {
      window.setTimeout(stopRecording, SPEAKING_MIN_MS - elapsed);
      return;
    }
    setPhase("recognizing");
  }

  return (
    <div className="speaking-player">
      {isReadAloud && (
        <div className="speaking-model-card">
          <PlayModelButton item={item} disabled={disabled} />
          <div>
            <strong>{item.sentence}</strong>
            {item.promptPinyin && <small>{item.promptPinyin}</small>}
          </div>
          <em>听一遍再跟读</em>
        </div>
      )}

      {isPictureTalk && (
        <figure className="picture-player-figure">
          <div className="picture-player-slot">
            <MediaSlot media={item.media} />
          </div>
          {(item.mediaTranslation || item.speakingHint) && (
            <figcaption className="picture-player-pinyin">{item.mediaTranslation || item.speakingHint}</figcaption>
          )}
        </figure>
      )}

      {item.type === "open-qa" && (item.speakingWords ?? []).length > 0 && (
        <div className="speaking-hints">
          {(item.speakingWords ?? []).map((word) => (
            <span key={word.id}>{word.text}{word.pinyin && <small>{word.pinyin}</small>}</span>
          ))}
        </div>
      )}

      {!isReadAloud && !isPictureTalk && (
        <div className="speaking-prompt-card">
          <strong>{leadText}</strong>
          {item.speakingHint && <small>{item.speakingHint}</small>}
        </div>
      )}

      <button
        className={`speaking-mic ${phase}`}
        onClick={phase === "recording" ? stopRecording : startRecording}
        disabled={disabled || phase === "recognizing" || phase === "result"}
      >
        <span>🎤</span>
        <strong>
          {phase === "idle" && "点一下开始说"}
          {phase === "recording" && "正在录音…点一下结束"}
          {phase === "recognizing" && "识别中…"}
          {phase === "result" && "已完成"}
        </strong>
        {phase === "recording" && <i className="speaking-wave" aria-hidden="true" />}
      </button>

      {phase === "result" && (
        <div className="speaking-result">
          <div className="speaking-answer">
            <strong>参考回答</strong>
            <p>{item.sampleAnswer || leadText}</p>
            {leadPinyin && <small>{leadPinyin}</small>}
            {item.samplePattern && <em>可以说：{item.samplePattern}</em>}
          </div>
          <div className="speaking-scores">
            {(item.scores ?? []).map((score) => (
              <div key={score.id}>
                <span>{score.label}</span>
                <strong>{"★".repeat(score.stars)}{"☆".repeat(Math.max(0, 5 - score.stars))}</strong>
              </div>
            ))}
          </div>
          <p className="stage-hint">语音识别未接入前，评分只是占位演示，不代表真实水平。</p>
        </div>
      )}

      <Button className="stage-submit" disabled={disabled || phase !== "result"} onClick={() => onResolved(true, item.sampleAnswer ?? "")}>
        提交本题
      </Button>
    </div>
  );
}
