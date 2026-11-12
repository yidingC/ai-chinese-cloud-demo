import { Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import type {
  InteractionBadWord,
  InteractionCategoryGroup,
  InteractionCategoryWord,
  InteractionChoice,
  InteractionItem,
  InteractionMedia,
  InteractionPair,
  InteractionPinyinGroup,
  InteractionScoreItem,
  InteractionType
} from "../domain/types";
import { Button, Field, LabeledInput, Select, TextInput } from "./ui";

const typeOptions: Array<{ type: InteractionType; label: string; hint: string }> = [
  { type: "match", label: "连线配对", hint: "左右点击配对，适合词汇和释义。" },
  { type: "memory", label: "翻牌记忆", hint: "翻开两张卡片寻找配对。" },
  { type: "choice", label: "单选 / 多选", hint: "选择一个或多个正确选项。" },
  { type: "order", label: "排序", hint: "拖动词语组成正确句子。" },
  { type: "fill", label: "填空", hint: "在句子中输入缺失词语。" },
  { type: "poll", label: "投票", hint: "收集课堂选择，不计分。" },
  { type: "picture", label: "看图单选", hint: "看一张图，从选项里选出正确的词。" },
  { type: "picture-match", label: "图片—词语连线", hint: "把左列的图配到右列的词。" },
  { type: "situation", label: "情景选择", hint: "看场景，选出最得体的说法。" },
  { type: "dialogue", label: "对话补全", hint: "看上一句，选出合适的下一句。" },
  { type: "pinyin-match", label: "拼音匹配", hint: "看拼音选汉字，再选意思，一组一组闯关。" },
  { type: "category", label: "分类归组", hint: "把词语放进正确的类别里。" },
  { type: "word-build", label: "拼字 / 组词", hint: "点字块把词语拼进空格。" },
  { type: "correction", label: "找错误 / 改错", hint: "点出句子里用错的词。" },
  { type: "listening", label: "听音选词", hint: "听音频，从选项里选出听到的内容。" },
  { type: "read-aloud", label: "跟读模仿", hint: "听范读后跟读，展示占位评分。" },
  { type: "picture-talk", label: "看图说话", hint: "看图用中文说一句话，展示占位评分。" },
  { type: "open-qa", label: "开放问答", hint: "回答开放问题，展示占位评分。" }
];

export function emptyMedia(): InteractionMedia {
  return { icon: "🖼️", image: "", alt: "" };
}

function editorId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createInteractionItem(type: InteractionType): InteractionItem {
  const base = {
    id: editorId("item"),
    type,
    prompt: type === "match" ? "把中文和印尼语正确配对。" : type === "poll" ? "你今天最喜欢的活动是什么？" : "请完成下面题目。",
    explanation: "这里填写答题后的解释。"
  };
  if (type === "match" || type === "memory") {
    return {
      ...base,
      pairs: [
        { id: editorId("pair"), left: "你好", right: "Halo" },
        { id: editorId("pair"), left: "再见", right: "Sampai jumpa" }
      ]
    };
  }
  if (type === "choice") {
    return {
      ...base,
      multiple: false,
      choices: [
        { id: editorId("choice"), text: "选项 A", isCorrect: true },
        { id: editorId("choice"), text: "选项 B", isCorrect: false },
        { id: editorId("choice"), text: "选项 C", isCorrect: false }
      ]
    };
  }
  if (type === "order") {
    const items = [
      { id: editorId("order"), text: "你好" },
      { id: editorId("order"), text: "我是 Anisa" },
      { id: editorId("order"), text: "很高兴认识你" }
    ];
    return { ...base, orderItems: items, correctOrder: items.map((item) => item.id) };
  }
  if (type === "fill") {
    return {
      ...base,
      prompt: "填写缺失的词语。",
      sentence: "早上见面时说：____ 好！",
      blanks: [{ id: editorId("blank"), answers: ["早上"] }]
    };
  }
  if (type === "picture") {
    return {
      ...base,
      prompt: "这是什么？",
      promptPinyin: "Zhè shì shénme?",
      media: { icon: "🐱", image: "", alt: "一只猫" },
      choices: [
        { id: editorId("choice"), text: "猫", hint: "māo", isCorrect: true },
        { id: editorId("choice"), text: "狗", hint: "gǒu", isCorrect: false },
        { id: editorId("choice"), text: "鸟", hint: "niǎo", isCorrect: false }
      ]
    };
  }
  if (type === "picture-match") {
    return {
      ...base,
      prompt: "把图片和词语配成对。",
      pairs: [
        { id: editorId("pair"), left: "学校", right: "学校", rightPinyin: "xué xiào", media: { icon: "🏫", image: "", alt: "学校的教学楼" } },
        { id: editorId("pair"), left: "医院", right: "医院", rightPinyin: "yī yuàn", media: { icon: "🏥", image: "", alt: "医院的大楼" } },
        { id: editorId("pair"), left: "商店", right: "商店", rightPinyin: "shāng diàn", media: { icon: "🏪", image: "", alt: "商店的门面" } }
      ]
    };
  }
  if (type === "situation") {
    return {
      ...base,
      prompt: "看场景，选出这个场合里最得体的说法。",
      scene: "你想借同学的笔。",
      sceneTranslation: "Kamu mau meminjam pulpen temanmu.",
      media: { icon: "✏️", image: "", alt: "一支铅笔" },
      choices: [
        { id: editorId("choice"), text: "喂，给我笔！", hint: "太生硬", isCorrect: false },
        { id: editorId("choice"), text: "请问，我可以借你的笔吗？", hint: "借东西先问一句，最得体", isCorrect: true },
        { id: editorId("choice"), text: "笔。", hint: "话没说完", isCorrect: false }
      ]
    };
  }
  if (type === "dialogue") {
    return {
      ...base,
      prompt: "选出合适的下一句。",
      dialogueThem: "请问，洗手间在哪儿？",
      dialoguePlaceholder: "？",
      choices: [
        { id: editorId("choice"), text: "在二楼，往左走。", isCorrect: true },
        { id: editorId("choice"), text: "我叫小明。", isCorrect: false },
        { id: editorId("choice"), text: "今天很热。", isCorrect: false }
      ]
    };
  }
  if (type === "pinyin-match") {
    return {
      ...base,
      prompt: "看拼音，先选汉字，再选意思。",
      pinyinGroups: [
        {
          id: editorId("pgroup"),
          pinyin: "shū",
          word: "书",
          meaning: "buku",
          wordOptions: ["书", "笔", "本子"],
          meaningOptions: ["buku", "pena", "buku tulis"]
        },
        {
          id: editorId("pgroup"),
          pinyin: "bǐ",
          word: "笔",
          meaning: "pena",
          wordOptions: ["本子", "笔", "书"],
          meaningOptions: ["buku tulis", "pena", "buku"]
        },
        {
          id: editorId("pgroup"),
          pinyin: "běnzi",
          word: "本子",
          meaning: "buku tulis",
          wordOptions: ["书", "本子", "笔"],
          meaningOptions: ["pena", "buku tulis", "buku"]
        }
      ]
    };
  }
  if (type === "category") {
    const helloGroup = editorId("group");
    const thanksGroup = editorId("group");
    return {
      ...base,
      prompt: "把下面的词放到对应的类别里。",
      groups: [
        { id: helloGroup, name: "打招呼", hint: "见面的时候说" },
        { id: thanksGroup, name: "道谢", hint: "表示感谢" }
      ],
      words: [
        { id: editorId("word"), text: "你好", pinyin: "nǐ hǎo", group: helloGroup },
        { id: editorId("word"), text: "谢谢", pinyin: "xièxie", group: thanksGroup },
        { id: editorId("word"), text: "再见", pinyin: "zàijiàn", group: helloGroup },
        { id: editorId("word"), text: "不客气", pinyin: "bú kèqi", group: thanksGroup }
      ]
    };
  }
  if (type === "word-build") {
    const answer = ["妈", "妈"];
    return {
      ...base,
      prompt: "拼出这个词",
      meaning: "ibu",
      answer,
      answerWord: answer.join(""),
      answerPinyin: "māma",
      tileBank: ["妈", "妈", "爸", "姐", "哥", "弟"]
    };
  }
  if (type === "correction") {
    return {
      ...base,
      prompt: "下面这句话里有一个词用错了，点出来。",
      badWords: [
        { id: editorId("bad"), text: "我", pinyin: "wǒ" },
        { id: editorId("bad"), text: "买", pinyin: "mǎi" },
        { id: editorId("bad"), text: "一", pinyin: "yī" },
        { id: editorId("bad"), text: "个", pinyin: "gè", wrong: true },
        { id: editorId("bad"), text: "书", pinyin: "shū" },
        { id: editorId("bad"), text: "。", pinyin: "" }
      ],
      fixText: "本",
      fixedSentence: "我买一本书。",
      fixedPinyin: "Wǒ mǎi yì běn shū."
    };
  }
  if (type === "listening") {
    return {
      ...base,
      prompt: "听一听，选出你听到的内容。",
      audioSrc: "",
      audioText: "三",
      audioPinyin: "sān",
      choices: [
        { id: editorId("choice"), text: "三", hint: "sān", isCorrect: true },
        { id: editorId("choice"), text: "四", hint: "sì", isCorrect: false },
        { id: editorId("choice"), text: "山", hint: "shān", isCorrect: false },
        { id: editorId("choice"), text: "伞", hint: "sǎn", isCorrect: false }
      ]
    };
  }
  if (type === "read-aloud") {
    return {
      ...base,
      prompt: "听一遍，然后跟着读。",
      sentence: "你好",
      promptPinyin: "nǐ hǎo",
      explanation: "「你好」两个字都是第三声，连读时前一个字会变成第二声。",
      scores: defaultSpeakingScores()
    };
  }
  if (type === "picture-talk") {
    return {
      ...base,
      prompt: "看这张图，用中文说一句话。",
      speakingHint: "试试说：谁 ＋ 在做什么",
      media: { icon: "🏃", image: "", alt: "一个小朋友在跑步" },
      mediaTranslation: "Seorang anak sedang berlari.",
      sampleAnswer: "小朋友在跑步。",
      scores: defaultSpeakingScores()
    };
  }
  if (type === "open-qa") {
    return {
      ...base,
      prompt: "你周末喜欢做什么？",
      speakingWords: [
        { id: editorId("speak"), text: "听音乐", pinyin: "tīng yīnyuè" },
        { id: editorId("speak"), text: "打篮球", pinyin: "dǎ lánqiú" },
        { id: editorId("speak"), text: "和朋友玩", pinyin: "hé péngyou wán" }
      ],
      sampleAnswer: "我周末喜欢听音乐。",
      sampleAnswerPinyin: "Wǒ zhōumò xǐhuan tīng yīnyuè.",
      samplePattern: "我周末喜欢 ______ 。",
      scores: defaultSpeakingScores()
    };
  }
  return {
    ...base,
    pollOptions: [
      { id: editorId("poll"), text: "词汇连线" },
      { id: editorId("poll"), text: "翻牌记忆" },
      { id: editorId("poll"), text: "开口表达" }
    ]
  };
}

/** 语音题型（跟读 / 看图说话 / 开放问答）的占位评分项。 */
function defaultSpeakingScores(): InteractionScoreItem[] {
  return [
    { id: editorId("score"), label: "发音", stars: 3 },
    { id: editorId("score"), label: "流利度", stars: 4 },
    { id: editorId("score"), label: "完整度", stars: 3 }
  ];
}

export function InteractionEditor({
  items,
  onChange,
  activeItemId = "",
  onActiveItemChange,
  single = false
}: {
  items: InteractionItem[];
  onChange: (items: InteractionItem[]) => void;
  /** 当前高亮的题目：决定哪张题目卡片处于编辑态。 */
  activeItemId?: string;
  onActiveItemChange?: (itemId: string) => void;
  /** 单题编辑：去掉新增、删除和题型工具条，供页面右侧详情栏使用。 */
  single?: boolean;
}) {
  function updateItem(itemId: string, patch: Partial<InteractionItem>) {
    onChange(items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  }

  function removeItem(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId));
  }

  function addItem(type: InteractionType) {
    const nextItem = createInteractionItem(type);
    onChange([...items, nextItem]);
    // 新加的题目直接成为当前编辑项，老师可以边填边改。
    onActiveItemChange?.(nextItem.id);
  }

  return (
    <div className={`interaction-editor ${single ? "is-single" : ""}`}>
      {!single && (
      <div className="editor-toolbar">
        <div>
          <strong>互动题目</strong>
          <span>共 {items.length} 题，拖动功能在学生学习端呈现。</span>
        </div>
        <div className="editor-add-group">
          {typeOptions.map((option) => (
            <Button key={option.type} size="sm" variant="secondary" onClick={() => addItem(option.type)} title={option.hint}>
              <Plus size={15} /> {option.label}
            </Button>
          ))}
        </div>
      </div>
      )}

      {items.length === 0 && (
        <div className="editor-empty">
          <strong>还没有互动题目</strong>
          <span>从上方选择一种模板开始配置。</span>
        </div>
      )}

      <div className="editor-item-list">
        {items.map((item, index) => {
          const isActive = item.id === activeItemId;
          return (
          <article
            className={`editor-item-card ${isActive ? "is-active" : ""}`}
            key={item.id}
            onClick={() => onActiveItemChange?.(item.id)}
            onFocusCapture={() => onActiveItemChange?.(item.id)}
          >
            <header>
              <span className="editor-index">{index + 1}</span>
              <div>
                <strong>
                  {typeOptions.find((option) => option.type === item.type)?.label}
                  {!single && isActive && <span className="editor-active-chip">编辑中</span>}
                </strong>
                <small>{typeOptions.find((option) => option.type === item.type)?.hint}</small>
              </div>
              {!single && (
                <Button size="icon" variant="ghost" onClick={() => removeItem(item.id)} aria-label="删除题目">
                  <Trash2 size={17} />
                </Button>
              )}
            </header>

            <div className="editor-grid">
              <Field label="题目说明" className="field-span-2">
                <textarea className="input textarea" value={item.prompt} onChange={(event) => updateItem(item.id, { prompt: event.target.value })} />
              </Field>
              <Field label="答题解释" className="field-span-2">
                <textarea className="input textarea" value={item.explanation} onChange={(event) => updateItem(item.id, { explanation: event.target.value })} />
              </Field>
            </div>

            {(item.type === "match" || item.type === "memory" || item.type === "picture-match") && (
              <PairEditor
                item={item}
                withMedia={item.type === "picture-match"}
                onChange={(patch) => updateItem(item.id, patch)}
              />
            )}
            {item.type === "choice" && <OptionEditor item={item} onChange={(patch) => updateItem(item.id, patch)} allowMultiple />}
            {item.type === "picture" && (
              <>
                <MediaEditor media={item.media} onChange={(media) => updateItem(item.id, { media })} title="题图" />
                <OptionEditor
                  item={item}
                  onChange={(patch) => updateItem(item.id, patch)}
                  hintLabel="拼音"
                  hintPlaceholder="māo"
                />
              </>
            )}
            {item.type === "situation" && (
              <>
                <MediaEditor media={item.media} onChange={(media) => updateItem(item.id, { media })} title="场景图（可选）" />
                <div className="editor-grid editor-grid-compact">
                  <Field label="场景描述">
                    <TextInput
                      value={item.scene ?? ""}
                      onChange={(event) => updateItem(item.id, { scene: event.target.value })}
                      placeholder="你想借同学的笔。"
                    />
                  </Field>
                  <Field label="场景翻译（印尼语）">
                    <TextInput
                      value={item.sceneTranslation ?? ""}
                      onChange={(event) => updateItem(item.id, { sceneTranslation: event.target.value })}
                      placeholder="Kamu mau meminjam pulpen temanmu."
                    />
                  </Field>
                </div>
                <OptionEditor
                  item={item}
                  onChange={(patch) => updateItem(item.id, patch)}
                  hintLabel="点评"
                  hintPlaceholder="为什么合适 / 不合适"
                />
              </>
            )}
            {item.type === "dialogue" && (
              <>
                <div className="editor-grid editor-grid-compact">
                  <Field label="对方的上一句">
                    <TextInput
                      value={item.dialogueThem ?? ""}
                      onChange={(event) => updateItem(item.id, { dialogueThem: event.target.value })}
                      placeholder="请问，洗手间在哪儿？"
                    />
                  </Field>
                  <Field label="我的气泡提示">
                    <TextInput
                      value={item.dialoguePlaceholder ?? ""}
                      onChange={(event) => updateItem(item.id, { dialoguePlaceholder: event.target.value })}
                      placeholder="？"
                    />
                  </Field>
                </div>
                <OptionEditor item={item} onChange={(patch) => updateItem(item.id, patch)} />
              </>
            )}
            {item.type === "order" && <OrderEditor item={item} onChange={(patch) => updateItem(item.id, patch)} />}
            {item.type === "fill" && <FillEditor item={item} onChange={(patch) => updateItem(item.id, patch)} />}
            {item.type === "poll" && <PollEditor item={item} onChange={(patch) => updateItem(item.id, patch)} />}
            {item.type === "pinyin-match" && <PinyinMatchEditor item={item} onChange={(patch) => updateItem(item.id, patch)} />}
            {item.type === "category" && <CategoryEditor item={item} onChange={(patch) => updateItem(item.id, patch)} />}
            {item.type === "word-build" && <WordBuildEditor item={item} onChange={(patch) => updateItem(item.id, patch)} />}
            {item.type === "correction" && <CorrectionEditor item={item} onChange={(patch) => updateItem(item.id, patch)} />}
            {item.type === "listening" && (
              <>
                <div className="editor-grid editor-grid-compact">
                  <Field label="音频地址" hint="留空时学生端按占位播放处理。">
                    <TextInput value={item.audioSrc ?? ""} onChange={(event) => updateItem(item.id, { audioSrc: event.target.value })} placeholder="demo-materials/ting-san.mp3" />
                  </Field>
                  <Field label="会读出来的内容">
                    <TextInput value={item.audioText ?? ""} onChange={(event) => updateItem(item.id, { audioText: event.target.value })} placeholder="三" />
                  </Field>
                  <Field label="答案拼音">
                    <TextInput value={item.audioPinyin ?? ""} onChange={(event) => updateItem(item.id, { audioPinyin: event.target.value })} placeholder="sān" />
                  </Field>
                </div>
                <OptionEditor
                  item={item}
                  onChange={(patch) => updateItem(item.id, patch)}
                  hintLabel="拼音"
                  hintPlaceholder="sān"
                />
              </>
            )}
            {(item.type === "read-aloud" || item.type === "picture-talk" || item.type === "open-qa") && (
              <SpeakingEditor item={item} onChange={(patch) => updateItem(item.id, patch)} />
            )}
          </article>
          );
        })}
      </div>
    </div>
  );
}

function PairEditor({
  item,
  withMedia = false,
  onChange
}: {
  item: InteractionItem;
  withMedia?: boolean;
  onChange: (patch: Partial<InteractionItem>) => void;
}) {
  const pairs = item.pairs ?? [];
  function updatePair(pairId: string, patch: Partial<InteractionPair>) {
    onChange({ pairs: pairs.map((pair) => (pair.id === pairId ? { ...pair, ...patch } : pair)) });
  }
  function addPair() {
    const next: InteractionPair = withMedia
      ? { id: editorId("pair"), left: "图片说明", right: "词语", rightPinyin: "", media: emptyMedia() }
      : { id: editorId("pair"), left: "中文", right: "Bahasa Indonesia" };
    onChange({ pairs: [...pairs, next] });
  }
  return (
    <div className="editor-subsection">
      <div className="subsection-heading">
        <strong>{withMedia ? "图片与词语配对" : "配对内容"}</strong>
        <Button size="sm" variant="secondary" onClick={addPair}>
          <Plus size={14} /> 添加配对
        </Button>
      </div>
      <div className={withMedia ? "pair-editor-list with-media" : "pair-editor-list"}>
        {pairs.map((pair, index) => (
          <div className={withMedia ? "pair-editor-card" : "pair-editor-row"} key={pair.id}>
            {withMedia ? (
              <>
                <div className="pair-editor-card-head">
                  <span>{index + 1}</span>
                  <MediaEditor
                    compact
                    title="图片"
                    media={pair.media}
                    onChange={(media) => updatePair(pair.id, { media })}
                  />
                  <Button size="icon" variant="ghost" onClick={() => onChange({ pairs: pairs.filter((entry) => entry.id !== pair.id) })}>
                    <Trash2 size={16} />
                  </Button>
                </div>
                <div className="pair-editor-card-body">
                  <TextInput
                    value={pair.left}
                    onChange={(event) => updatePair(pair.id, { left: event.target.value })}
                    placeholder="图片说明（无障碍）"
                  />
                  <TextInput value={pair.right} onChange={(event) => updatePair(pair.id, { right: event.target.value })} placeholder="词语" />
                  <TextInput
                    value={pair.rightPinyin ?? ""}
                    onChange={(event) => updatePair(pair.id, { rightPinyin: event.target.value })}
                    placeholder="拼音 xué xiào"
                  />
                </div>
              </>
            ) : (
              <>
                <span>{index + 1}</span>
                <TextInput value={pair.left} onChange={(event) => updatePair(pair.id, { left: event.target.value })} placeholder="中文" />
                <TextInput value={pair.right} onChange={(event) => updatePair(pair.id, { right: event.target.value })} placeholder="印尼语" />
                <Button size="icon" variant="ghost" onClick={() => onChange({ pairs: pairs.filter((entry) => entry.id !== pair.id) })}>
                  <Trash2 size={16} />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
      {withMedia && <small className="editor-help">图片留空时显示 emoji；填了图片地址就换成真图，学生端学生看到左图右词。</small>}
    </div>
  );
}

/** 题型选项编辑器：choice / picture / situation / dialogue 共用一份。 */
function OptionEditor({
  item,
  onChange,
  allowMultiple = false,
  hintLabel,
  hintPlaceholder
}: {
  item: InteractionItem;
  onChange: (patch: Partial<InteractionItem>) => void;
  allowMultiple?: boolean;
  hintLabel?: string;
  hintPlaceholder?: string;
}) {
  const choices = item.choices ?? [];
  function updateChoice(choiceId: string, patch: Partial<InteractionChoice>) {
    let next = choices.map((choice) => (choice.id === choiceId ? { ...choice, ...patch } : choice));
    if (!item.multiple && patch.isCorrect) {
      next = next.map((choice) => ({ ...choice, isCorrect: choice.id === choiceId }));
    }
    onChange({ choices: next });
  }
  function addChoice() {
    const next: InteractionChoice = { id: editorId("choice"), text: "新选项", isCorrect: false };
    if (hintLabel) next.hint = "";
    onChange({ choices: [...choices, next] });
  }
  return (
    <div className="editor-subsection">
      <div className="subsection-heading">
        {allowMultiple ? (
          <label className="inline-check">
            <input type="checkbox" checked={Boolean(item.multiple)} onChange={(event) => onChange({ multiple: event.target.checked })} />
            允许多选
          </label>
        ) : (
          <strong>选项与正确答案</strong>
        )}
        <Button size="sm" variant="secondary" onClick={addChoice}>
          <Plus size={14} /> 添加选项
        </Button>
      </div>
      <div className="choice-editor-list">
        {choices.map((choice, index) => (
          <div className={hintLabel ? "option-editor-row with-hint" : "option-editor-row"} key={choice.id}>
            <button className={choice.isCorrect ? "answer-toggle active" : "answer-toggle"} onClick={() => updateChoice(choice.id, { isCorrect: !choice.isCorrect })}>
              {choice.isCorrect ? "✓" : String.fromCharCode(65 + index)}
            </button>
            <TextInput value={choice.text} onChange={(event) => updateChoice(choice.id, { text: event.target.value })} placeholder="选项内容" />
            {hintLabel && (
              <TextInput
                value={choice.hint ?? ""}
                onChange={(event) => updateChoice(choice.id, { hint: event.target.value })}
                placeholder={hintPlaceholder ?? ""}
                aria-label={hintLabel}
              />
            )}
            <Button size="icon" variant="ghost" onClick={() => onChange({ choices: choices.filter((entry) => entry.id !== choice.id) })}>
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </div>
      <small className="editor-help">
        点击左侧字母按钮，把答案标记为正确{allowMultiple ? "（勾选可多选后可以标记多个）" : "（每题一个正确答案）"}。
      </small>
    </div>
  );
}

/** 图槽编辑器：emoji / 图片地址 / 图片说明，三件套和学生学习端的 interaction-picture 一致。 */
function MediaEditor({
  media,
  onChange,
  title = "图槽",
  compact = false
}: {
  media?: InteractionMedia;
  onChange: (media: InteractionMedia) => void;
  title?: string;
  compact?: boolean;
}) {
  const value = media ?? emptyMedia();
  const patch = (next: Partial<InteractionMedia>) => onChange({ ...value, ...next });
  return (
    <div className={compact ? "media-editor compact" : "media-editor"}>
      <div className="media-editor-preview" aria-hidden="true">
        {value.image ? <img src={value.image} alt="" /> : <span>{value.icon || "🖼️"}</span>}
      </div>
      <div className="media-editor-fields">
        <div className="media-editor-head">
          <ImageIcon size={14} />
          <strong>{title}</strong>
          <small>留空图片地址时学生看到 emoji</small>
        </div>
        <div className="media-editor-inputs">
          <TextInput value={value.icon} onChange={(event) => patch({ icon: event.target.value })} placeholder="🐱" aria-label="Emoji 图" />
          <TextInput value={value.image} onChange={(event) => patch({ image: event.target.value })} placeholder="图片地址（可留空）" aria-label="图片地址" />
          <TextInput value={value.alt} onChange={(event) => patch({ alt: event.target.value })} placeholder="图片说明，例如：一只猫" aria-label="图片说明" />
        </div>
      </div>
    </div>
  );
}

function OrderEditor({ item, onChange }: { item: InteractionItem; onChange: (patch: Partial<InteractionItem>) => void }) {
  const orderItems = item.orderItems ?? [];
  return (
    <div className="editor-subsection">
      <div className="subsection-heading">
        <strong>正确顺序</strong>
        <Button size="sm" variant="secondary" onClick={() => {
          const next = [...orderItems, { id: editorId("order"), text: "新词语" }];
          onChange({ orderItems: next, correctOrder: next.map((entry) => entry.id) });
        }}>
          <Plus size={14} /> 添加词语
        </Button>
      </div>
      <div className="order-editor-list">
        {orderItems.map((entry, index) => (
          <div key={entry.id} className="order-editor-row">
            <span>{index + 1}</span>
            <TextInput
              value={entry.text}
              onChange={(event) => {
                const next = orderItems.map((candidate) => (candidate.id === entry.id ? { ...candidate, text: event.target.value } : candidate));
                onChange({ orderItems: next, correctOrder: next.map((candidate) => candidate.id) });
              }}
            />
            <Button size="icon" variant="ghost" onClick={() => {
              const next = orderItems.filter((candidate) => candidate.id !== entry.id);
              onChange({ orderItems: next, correctOrder: next.map((candidate) => candidate.id) });
            }}>
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FillEditor({ item, onChange }: { item: InteractionItem; onChange: (patch: Partial<InteractionItem>) => void }) {
  const blanks = item.blanks ?? [];
  return (
    <div className="editor-subsection">
      <div className="subsection-heading">
        <strong>填空答案</strong>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const next = [...blanks, { id: editorId("blank"), answers: ["答案"] }];
            onChange({ blanks: next, sentence: `${item.sentence ?? ""}____`.trim() });
          }}
        >
          <Plus size={14} /> 添加空格
        </Button>
      </div>
      <Field label="带空格的句子" hint="每个 ____ 对应下面的一个空格答案。">
        <TextInput value={item.sentence ?? ""} onChange={(event) => onChange({ sentence: event.target.value })} />
      </Field>
      <div className="blank-editor-list">
        {blanks.map((blank, index) => (
          <div className="blank-editor-row" key={blank.id}>
            <span>空 {index + 1}</span>
            <TextInput
              value={blank.answers.join(" / ")}
              onChange={(event) => onChange({ blanks: blanks.map((entry) => (entry.id === blank.id ? { ...entry, answers: event.target.value.split("/").map((value) => value.trim()).filter(Boolean) } : entry)) })}
              placeholder="多个答案用 / 分隔"
            />
            <Button size="icon" variant="ghost" onClick={() => onChange({ blanks: blanks.filter((entry) => entry.id !== blank.id) })}>
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PollEditor({ item, onChange }: { item: InteractionItem; onChange: (patch: Partial<InteractionItem>) => void }) {
  const options = item.pollOptions ?? [];
  return (
    <div className="editor-subsection">
      <div className="subsection-heading">
        <strong>投票选项</strong>
        <Button size="sm" variant="secondary" onClick={() => onChange({ pollOptions: [...options, { id: editorId("poll"), text: "新选项" }] })}>
          <Plus size={14} /> 添加选项
        </Button>
      </div>
      <div className="choice-editor-list">
        {options.map((option, index) => (
          <div className="choice-editor-row" key={option.id}>
            <span className="choice-letter">{String.fromCharCode(65 + index)}</span>
            <TextInput value={option.text} onChange={(event) => onChange({ pollOptions: options.map((entry) => (entry.id === option.id ? { ...entry, text: event.target.value } : entry)) })} />
            <Button size="icon" variant="ghost" onClick={() => onChange({ pollOptions: options.filter((entry) => entry.id !== option.id) })}>
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 拼音—汉字—含义匹配：一组一轮，wordOptions / meaningOptions 各含一个正确项。 */
function PinyinMatchEditor({ item, onChange }: { item: InteractionItem; onChange: (patch: Partial<InteractionItem>) => void }) {
  const groups = item.pinyinGroups ?? [];
  function updateGroup(groupId: string, patch: Partial<InteractionPinyinGroup>) {
    onChange({ pinyinGroups: groups.map((group) => (group.id === groupId ? { ...group, ...patch } : group)) });
  }
  return (
    <div className="editor-subsection">
      <div className="subsection-heading">
        <strong>闯关分组（每组 3 个汉字选项 + 3 个意思选项）</strong>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onChange({
            pinyinGroups: [...groups, {
              id: editorId("pgroup"),
              pinyin: "māma",
              word: "妈妈",
              meaning: "ibu",
              wordOptions: ["妈妈", "爸爸", "哥哥"],
              meaningOptions: ["ibu", "ayah", "kakak laki-laki"]
            }]
          })}
        >
          <Plus size={14} /> 添加一组
        </Button>
      </div>
      <div className="pinyin-group-list">
        {groups.map((group, index) => (
          <div className="pinyin-group-card" key={group.id}>
            <div className="pinyin-group-head">
              <span>{index + 1}</span>
              <strong>{group.pinyin || "拼音"}</strong>
              <Button size="icon" variant="ghost" onClick={() => onChange({ pinyinGroups: groups.filter((entry) => entry.id !== group.id) })}>
                <Trash2 size={16} />
              </Button>
            </div>
            <div className="pinyin-group-row">
              <LabeledInput label="拼音" value={group.pinyin} onChange={(event) => updateGroup(group.id, { pinyin: event.target.value })} />
              <LabeledInput label="正确汉字" value={group.word} onChange={(event) => updateGroup(group.id, { word: event.target.value })} />
              <LabeledInput label="正确意思" value={group.meaning} onChange={(event) => updateGroup(group.id, { meaning: event.target.value })} />
            </div>
            <LabeledInput
              label="汉字选项（用 / 分隔，必须包含正确汉字）"
              value={group.wordOptions.join(" / ")}
              onChange={(event) => updateGroup(group.id, { wordOptions: splitOptions(event.target.value) })}
            />
            <LabeledInput
              label="意思选项（用 / 分隔，必须包含正确意思）"
              value={group.meaningOptions.join(" / ")}
              onChange={(event) => updateGroup(group.id, { meaningOptions: splitOptions(event.target.value) })}
            />
          </div>
        ))}
      </div>
      <small className="editor-help">学生先看拼音选汉字，再选它的意思；选错原地重试，三组都完成后弹结果。</small>
    </div>
  );
}

/** 分类归组：类别 + 待归类词语，词语选择自己该去的类别。 */
function CategoryEditor({ item, onChange }: { item: InteractionItem; onChange: (patch: Partial<InteractionItem>) => void }) {
  const groups = item.groups ?? [];
  const words = item.words ?? [];
  const fallbackGroup = groups[0]?.id ?? "";

  function updateGroup(groupId: string, patch: Partial<InteractionCategoryGroup>) {
    onChange({ groups: groups.map((group) => (group.id === groupId ? { ...group, ...patch } : group)) });
  }

  function removeGroup(groupId: string) {
    const nextGroups = groups.filter((group) => group.id !== groupId);
    const nextWords = words
      .filter((word) => word.group !== groupId)
      .map((word) => (word.group === groupId ? { ...word, group: nextGroups[0]?.id ?? "" } : word));
    onChange({ groups: nextGroups, words: nextWords });
  }

  function updateWord(wordId: string, patch: Partial<InteractionCategoryWord>) {
    onChange({ words: words.map((word) => (word.id === wordId ? { ...word, ...patch } : word)) });
  }

  return (
    <div className="editor-subsection">
      <div className="subsection-heading">
        <strong>类别与待归类词语</strong>
        <div className="editor-subsection-actions">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onChange({ groups: [...groups, { id: editorId("group"), name: "新类别", hint: "" }] })}
          >
            <Plus size={14} /> 添加类别
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!fallbackGroup}
            onClick={() => onChange({ words: [...words, { id: editorId("word"), text: "新词语", pinyin: "", group: fallbackGroup }] })}
          >
            <Plus size={14} /> 添加词语
          </Button>
        </div>
      </div>
      <div className="category-group-editor-list">
        {groups.map((group, index) => (
          <div className="category-group-editor-row" key={group.id}>
            <span>{index + 1}</span>
            <LabeledInput label="类别名称" value={group.name} onChange={(event) => updateGroup(group.id, { name: event.target.value })} />
            <LabeledInput label="类别提示" value={group.hint ?? ""} onChange={(event) => updateGroup(group.id, { hint: event.target.value })} placeholder="可留空" />
            <Button size="icon" variant="ghost" onClick={() => removeGroup(group.id)} aria-label="删除类别">
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </div>
      <div className="category-word-editor-list">
        {words.map((word, index) => (
          <div className="category-word-editor-row" key={word.id}>
            <span>{index + 1}</span>
            <LabeledInput label="词语" value={word.text} onChange={(event) => updateWord(word.id, { text: event.target.value })} />
            <LabeledInput label="拼音" value={word.pinyin ?? ""} onChange={(event) => updateWord(word.id, { pinyin: event.target.value })} />
            <label className="labeled-input">
              <span>正确类别</span>
              <Select value={word.group} onChange={(event) => updateWord(word.id, { group: event.target.value })}>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name || "未命名类别"}</option>
                ))}
              </Select>
            </label>
            <Button size="icon" variant="ghost" onClick={() => onChange({ words: words.filter((entry) => entry.id !== word.id) })}>
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </div>
      <small className="editor-help">每个词语都要选一个正确类别；学生把词卡放进类别后提交，放错的会退回重试。</small>
    </div>
  );
}

/** 拼字 / 组词：答案按字拆分，字块池可留空由答案自动生成。 */
function WordBuildEditor({ item, onChange }: { item: InteractionItem; onChange: (patch: Partial<InteractionItem>) => void }) {
  const answer = item.answer ?? [];
  return (
    <div className="editor-subsection">
      <div className="subsection-heading">
        <strong>答案与字块</strong>
      </div>
      <div className="editor-grid editor-grid-compact">
        <Field label="答案词语" hint="按答案里的每个字生成作答空格，支持重复字。">
          <TextInput
            value={item.answerWord ?? ""}
            onChange={(event) => {
              const text = event.target.value;
              onChange({ answerWord: text, answer: Array.from(text) });
            }}
            placeholder="妈妈"
          />
        </Field>
        <Field label="答案拼音">
          <TextInput value={item.answerPinyin ?? ""} onChange={(event) => onChange({ answerPinyin: event.target.value })} placeholder="māma" />
        </Field>
        <Field label="词语意思（提示）">
          <TextInput value={item.meaning ?? ""} onChange={(event) => onChange({ meaning: event.target.value })} placeholder="ibu" />
        </Field>
      </div>
      {answer.length > 0 && <p className="editor-inline-note">按顺序要拼出的字：{answer.join(" · ")}</p>}
      <Field label="字块池（用 / 分隔）" hint="留空时自动使用答案里的字；混入干扰字更像拼字游戏。">
        <TextInput
          value={(item.tileBank ?? []).join(" / ")}
          onChange={(event) => onChange({ tileBank: splitOptions(event.target.value) })}
          placeholder="妈 / 妈 / 爸 / 姐 / 哥 / 弟"
        />
      </Field>
    </div>
  );
}

/** 找错误 / 改错：词块里标一个用错的词，并给出正确说法。 */
function CorrectionEditor({ item, onChange }: { item: InteractionItem; onChange: (patch: Partial<InteractionItem>) => void }) {
  const words = item.badWords ?? [];
  function updateWord(wordId: string, patch: Partial<InteractionBadWord>) {
    const next = words.map((word) => {
      if (word.id === wordId && patch.wrong) return { ...word, ...patch, wrong: true };
      if (word.id !== wordId && patch.wrong && !item.multiple) return { ...word, wrong: false };
      return word.id === wordId ? { ...word, ...patch } : word;
    });
    onChange({ badWords: next });
  }
  return (
    <div className="editor-subsection">
      <div className="subsection-heading">
        <strong>句子词块（点亮左侧按钮标出用错的词）</strong>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onChange({ badWords: [...words, { id: editorId("bad"), text: "新词", pinyin: "" }] })}
        >
          <Plus size={14} /> 添加词块
        </Button>
      </div>
      <div className="correction-editor-list">
        {words.map((word, index) => (
          <div className={word.wrong ? "correction-editor-row wrong" : "correction-editor-row"} key={word.id}>
            <span>{index + 1}</span>
            <TextInput value={word.text} onChange={(event) => updateWord(word.id, { text: event.target.value })} placeholder="词" />
            <TextInput value={word.pinyin ?? ""} onChange={(event) => updateWord(word.id, { pinyin: event.target.value })} placeholder="拼音" />
            <button
              className={word.wrong ? "answer-toggle active" : "answer-toggle"}
              title="标为用错的词"
              onClick={() => updateWord(word.id, { wrong: !word.wrong })}
            >
              {word.wrong ? "✓" : "错"}
            </button>
            <Button size="icon" variant="ghost" onClick={() => onChange({ badWords: words.filter((entry) => entry.id !== word.id) })}>
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </div>
      <div className="editor-grid editor-grid-compact">
        <Field label="正确的词">
          <TextInput value={item.fixText ?? ""} onChange={(event) => onChange({ fixText: event.target.value })} placeholder="本" />
        </Field>
        <Field label="改好的整句">
          <TextInput value={item.fixedSentence ?? ""} onChange={(event) => onChange({ fixedSentence: event.target.value })} placeholder="我买一本书。" />
        </Field>
        <Field label="整句拼音">
          <TextInput value={item.fixedPinyin ?? ""} onChange={(event) => onChange({ fixedPinyin: event.target.value })} placeholder="Wǒ mǎi yì běn shū." />
        </Field>
      </div>
      <small className="editor-help">答题后一定展示改好的整句，学生才能看到正确说法。</small>
    </div>
  );
}

/** 语音题型共用编辑器：跟读 / 看图说话 / 开放问答按类型只显示相关字段。 */
function SpeakingEditor({ item, onChange }: { item: InteractionItem; onChange: (patch: Partial<InteractionItem>) => void }) {
  const scores = item.scores ?? [];
  const words = item.speakingWords ?? [];
  function updateScore(scoreId: string, patch: Partial<InteractionScoreItem>) {
    onChange({ scores: scores.map((score) => (score.id === scoreId ? { ...score, ...patch } : score)) });
  }
  return (
    <>
      {item.type === "read-aloud" && (
        <div className="editor-grid editor-grid-compact">
          <Field label="跟读文本">
            <TextInput value={item.sentence ?? ""} onChange={(event) => onChange({ sentence: event.target.value })} placeholder="你好" />
          </Field>
          <Field label="跟读文本拼音">
            <TextInput value={item.promptPinyin ?? ""} onChange={(event) => onChange({ promptPinyin: event.target.value })} placeholder="nǐ hǎo" />
          </Field>
          <Field label="范读音频地址" hint="留空时学生端按占位播放处理。">
            <TextInput value={item.audioSrc ?? ""} onChange={(event) => onChange({ audioSrc: event.target.value })} placeholder="demo-materials/ni-hao.mp3" />
          </Field>
        </div>
      )}
      {item.type === "picture-talk" && (
        <>
          <MediaEditor media={item.media} onChange={(media) => onChange({ media })} title="看图说话题图" />
          <div className="editor-grid editor-grid-compact">
            <Field label="图片说明（印尼语）">
              <TextInput value={item.mediaTranslation ?? ""} onChange={(event) => onChange({ mediaTranslation: event.target.value })} placeholder="Seorang anak sedang berlari." />
            </Field>
            <Field label="说话提示">
              <TextInput value={item.speakingHint ?? ""} onChange={(event) => onChange({ speakingHint: event.target.value })} placeholder="试试说：谁 ＋ 在做什么" />
            </Field>
          </div>
        </>
      )}
      {item.type === "open-qa" && (
        <>
          <div className="subsection-heading">
            <strong>可以选用的提示词</strong>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onChange({ speakingWords: [...words, { id: editorId("speak"), text: "新提示", pinyin: "" }] })}
            >
              <Plus size={14} /> 添加提示词
            </Button>
          </div>
          <div className="choice-editor-list">
            {words.map((word, index) => (
              <div className="option-editor-row" key={word.id}>
                <span className="choice-letter">{index + 1}</span>
                <TextInput
                  value={word.text}
                  onChange={(event) => onChange({ speakingWords: words.map((entry) => (entry.id === word.id ? { ...entry, text: event.target.value } : entry)) })}
                  placeholder="听音乐"
                />
                <TextInput
                  value={word.pinyin ?? ""}
                  onChange={(event) => onChange({ speakingWords: words.map((entry) => (entry.id === word.id ? { ...entry, pinyin: event.target.value } : entry)) })}
                  placeholder="tīng yīnyuè"
                />
                <Button size="icon" variant="ghost" onClick={() => onChange({ speakingWords: words.filter((entry) => entry.id !== word.id) })}>
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="editor-grid editor-grid-compact">
        <Field label="参考回答" className="field-span-2">
          <TextInput value={item.sampleAnswer ?? ""} onChange={(event) => onChange({ sampleAnswer: event.target.value })} placeholder="我周末喜欢听音乐。" />
        </Field>
        <Field label="参考回答拼音">
          <TextInput value={item.sampleAnswerPinyin ?? ""} onChange={(event) => onChange({ sampleAnswerPinyin: event.target.value })} placeholder="Wǒ zhōumò xǐhuan tīng yīnyuè." />
        </Field>
        <Field label="回答模板" hint="用 ______ 表示要替换的部分。">
          <TextInput value={item.samplePattern ?? ""} onChange={(event) => onChange({ samplePattern: event.target.value })} placeholder="我周末喜欢 ______ 。" />
        </Field>
      </div>

      <div className="subsection-heading">
        <strong>占位评分项</strong>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onChange({ scores: [...scores, { id: editorId("score"), label: "新评分项", stars: 3 }] })}
        >
          <Plus size={14} /> 添加评分项
        </Button>
        <small className="editor-help">语音识别未接入前，评分只是占位演示值。</small>
      </div>
      <div className="score-editor-list">
        {scores.map((score) => (
          <div className="score-editor-row" key={score.id}>
            <TextInput value={score.label} onChange={(event) => updateScore(score.id, { label: event.target.value })} placeholder="评分项名称" />
            <Select value={String(score.stars)} onChange={(event) => updateScore(score.id, { stars: Number(event.target.value) })}>
              {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} 星</option>)}
            </Select>
            <Button size="icon" variant="ghost" onClick={() => onChange({ scores: scores.filter((entry) => entry.id !== score.id) })}>
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </div>
    </>
  );
}

function splitOptions(value: string) {
  return value.split("/").map((entry) => entry.trim()).filter(Boolean);
}
