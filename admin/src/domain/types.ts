export type Role = "student" | "teacher" | "operator" | "academic";
export type SchoolRole = "student" | "teacher" | "academic";
export type Phase = "preview" | "live" | "review";
export type SessionStatus = "published" | "cancelled" | "draft";
export type BookingStatus = "booked" | "pending_review" | "cancelled";
export type WaitlistStatus = "waiting" | "promoted" | "cancelled";
export type GradeCategory = "interaction" | "homework" | "exam";
export type AssessmentCategory = Exclude<GradeCategory, "interaction">;
export type AssessmentScoreStatus = "pending" | "graded" | "absent" | "excused";
export type InteractionType =
  | "match"
  | "memory"
  | "choice"
  | "order"
  | "fill"
  | "poll"
  | "picture"
  | "picture-match"
  | "situation"
  | "dialogue"
  | "pinyin-match"
  | "category"
  | "word-build"
  | "correction"
  | "listening"
  | "read-aloud"
  | "picture-talk"
  | "open-qa";

/** 语音题型（跟读 / 看图说话 / 开放问答）共用的评分项。 */
export interface InteractionScoreItem {
  id: string;
  label: string;
  stars: number;
}
export interface School {
  id: string;
  name: string;
  code: string;
  /** 学校所在地时区，用于课表和排课时间展示。 */
  timeZone: string;
  status: "active" | "archived";
  createdAt: string;
}

export interface SchoolMembership {
  id: string;
  schoolId: string;
  userId: string;
  role: SchoolRole;
  status: "active" | "left";
  joinedAt: string;
  leftAt?: string;
}

export interface PlatformUser {
  id: string;
  role: Role;
  name: string;
  nameZh?: string;
  phone?: string;
  /** 学生端 App 的绑定账号；为空表示尚未绑定。 */
  appAccount?: string;
  avatar: string;
  timeZone: string;
  locale: string;
  status: "active" | "paused";
  specialties?: string[];
  experienceYears?: number;
  bio?: string;
  title?: string;
}

export interface StudentProfile {
  userId: string;
  program: string;
  level: string;
  /** 学生所在班级，例如「周三晚 A 班」。 */
  className?: string;
  /** 学生主班级的稳定 id；约课加入的其他班级通过 ClassEnrollment 记录。 */
  primaryClassId?: string;
  learningGoal: string;
  preferredTeacherId: string;
  preferredTimeZone: string;
  joinedAt: string;
  tags: string[];
  notes: string;
}

export interface ClassGroup {
  id: string;
  schoolId: string;
  name: string;
  teacherId: string;
  status: "active" | "archived";
  createdAt: string;
}

export interface ClassEnrollment {
  id: string;
  classId: string;
  studentId: string;
  status: "active" | "left";
  joinedAt: string;
  leftAt?: string;
  source: "profile" | "booking" | "manual";
}

export interface CourseSubject {
  id: string;
  name: string;
  description: string;
  color: string;
  order: number;
}

export type CourseStatus = "draft" | "published" | "disabled";

/** 课程。持久化字段仍放在 folders 中，以兼容既有演示快照。 */
export interface Course {
  id: string;
  subjectId: string;
  name: string;
  description: string;
  color: string;
  tags: string[];
  order: number;
  status: CourseStatus;
  createdAt?: string;
}

export interface Lesson {
  id: string;
  /** 所属课程。字段名沿用历史快照中的 folderId。 */
  folderId: string;
  title: string;
  subtitle: string;
  description: string;
  durationMinutes: number;
  tags: string[];
  color: string;
  coverEmoji: string;
  status: CourseStatus;
  order: number;
  createdAt?: string;
}

export interface ClassSeries {
  id: string;
  schoolId: string;
  /** 系列主题对应的课程；同一系列内的课节来自同一课程。 */
  folderId: string;
  /** 系列包含的课节，按开课顺序排列。 */
  lessonIds: string[];
  /** 第一个课节，保留用于封面色、图标等展示。 */
  lessonId: string;
  title: string;
  description: string;
  teacherId: string;
  capacity: number;
  durationMinutes: number;
  sessionIds: string[];
  weekdays: number[];
  status: SessionStatus;
  createdAt: string;
}

export interface ClassSession {
  id: string;
  schoolId: string;
  lessonId: string;
  seriesId: string | null;
  teacherId: string;
  title: string;
  /** 该课次所属班级，例如“印尼圣心学校7年级A班”。 */
  className: string;
  /** 稳定班级 id，班级名称修改后仍保持不变。 */
  classId: string;
  startAt: string;
  endAt: string;
  capacity: number;
  status: SessionStatus;
  bookingCloseAt: string;
  cancelCloseAt: string;
  language: string;
  roomLabel: string;
  source: "single" | "series";
  /** 本次课单独的应到名单；建课时从班级成员生成，之后不随班级自动变化。 */
  roster?: SessionRosterEntry[];
  /** 老师在课堂里点「开始上课」的时间；之后课次进入进行中。 */
  liveStartedAt?: string;
  /** 老师在课堂里点「结束课堂」的时间；之后课次进入已结束。 */
  liveEndedAt?: string;
  /** 开始上课时冻结的课堂内容；之后课件与互动都按这份快照展示。 */
  contentSnapshot?: SessionContentSnapshot;
  /** 预约后需要教学管理审核，审核通过才占用名额并加入班级。 */
  approvalRequired?: boolean;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface SessionInteractionSnapshot {
  setId: string;
  versionId: string;
  phase: Phase;
  /** 开始时冻结的轮次标题与阶段，避免课后改名影响历史课次。 */
  title?: string;
  /** 开始时冻结的计分口径。 */
  countsTowardGrade?: boolean;
}

export interface SessionMaterialSnapshot {
  materialId: string;
  version: number;
  phase: Phase;
}

export interface SessionContentSnapshot {
  capturedAt: string;
  interactions: SessionInteractionSnapshot[];
  materials: SessionMaterialSnapshot[];
}

export interface SessionRosterEntry {
  studentId: string;
  source: "snapshot" | "sync" | "manual";
  addedAt: string;
}

export interface Booking {
  id: string;
  sessionId: string;
  studentId: string;
  status: BookingStatus;
  source: "student" | "operator" | "academic" | "waitlist";
  createdAt: string;
  enrollmentId: string | null;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
}

export interface WaitlistEntry {
  id: string;
  sessionId: string | null;
  sessionIds: string[];
  seriesId: string | null;
  studentId: string;
  status: WaitlistStatus;
  createdAt: string;
  enrollmentId: string | null;
  promotedAt?: string;
  cancelledAt?: string;
}

/** 图槽：image 有值时显示真图，为空时显示 emoji；alt 同时作为无障碍文案。 */
export interface InteractionMedia {
  icon: string;
  image: string;
  alt: string;
}

export interface InteractionPair {
  id: string;
  left: string;
  right: string;
  /** 图片—词语连线：左列的图槽；有值时左列显示图片，left 作为图片说明。 */
  media?: InteractionMedia;
  /** 图片—词语连线：右列词语的拼音。 */
  rightPinyin?: string;
}

export interface InteractionChoice {
  id: string;
  text: string;
  isCorrect?: boolean;
  /** 看图单选：选项拼音；情景选择：这个说法的点评。 */
  hint?: string;
}

export interface InteractionCategoryGroup {
  id: string;
  name: string;
  hint?: string;
}

export interface InteractionCategoryWord {
  id: string;
  text: string;
  pinyin?: string;
  /** 这个词正确归属的类别 id。 */
  group: string;
}

export interface InteractionBadWord {
  id: string;
  text: string;
  pinyin?: string;
  /** 用错的词，学生要把它点出来。 */
  wrong?: boolean;
}

export interface InteractionPinyinGroup {
  id: string;
  pinyin: string;
  word: string;
  meaning: string;
  wordOptions: string[];
  meaningOptions: string[];
}

export interface InteractionItem {
  id: string;
  type: InteractionType;
  prompt: string;
  explanation: string;
  multiple?: boolean;
  choices?: InteractionChoice[];
  pairs?: InteractionPair[];
  orderItems?: Array<{ id: string; text: string }>;
  correctOrder?: string[];
  sentence?: string;
  blanks?: Array<{ id: string; answers: string[] }>;
  pollOptions?: Array<{ id: string; text: string }>;
  /** 看图单选 / 情景选择：题干图槽。 */
  media?: InteractionMedia;
  /** 看图单选：题干拼音。 */
  promptPinyin?: string;
  /** 情景选择：场景中文描述。 */
  scene?: string;
  /** 情景选择：场景印尼语翻译。 */
  sceneTranslation?: string;
  /** 对话补全：对方说的上一句。 */
  dialogueThem?: string;
  /** 对话补全：我的气泡在作答前的提示文字。 */
  dialoguePlaceholder?: string;

  /* ---- 第三批新题型（与学生学习端同名页面字段保持一致） ---- */

  /** 分类归组：类别。 */
  groups?: InteractionCategoryGroup[];
  /** 分类归组：待归类的词，group 指向 groups[].id。 */
  words?: InteractionCategoryWord[];

  /** 拼字 / 组词：正确答案（按字拆分，支持重复字）。 */
  answer?: string[];
  /** 拼字 / 组词：答案词语。 */
  answerWord?: string;
  /** 拼字 / 组词：答案拼音。 */
  answerPinyin?: string;
  /** 拼字 / 组词：字块池；留空时按答案自动生成。 */
  tileBank?: string[];
  /** 拼字 / 组词：提示词（词语意思，通常是印尼语）。 */
  meaning?: string;

  /** 找错误 / 改错：句子切分后的词块，wrong 标出用错的词。 */
  badWords?: InteractionBadWord[];
  /** 找错误 / 改错：正确的词。 */
  fixText?: string;
  /** 找错误 / 改错：改好的整句。 */
  fixedSentence?: string;
  /** 找错误 / 改错：整句拼音。 */
  fixedPinyin?: string;

  /** 听音选图 / 选词：音频地址，留空时按占位播放。 */
  audioSrc?: string;
  /** 听音选图 / 选词：会读出来的内容，也是答案文本。 */
  audioText?: string;
  /** 听音选图 / 选词：答案拼音。 */
  audioPinyin?: string;

  /** 拼音—汉字—含义匹配：一组一轮，逐组作答。 */
  pinyinGroups?: InteractionPinyinGroup[];

  /** 看图说话：图片说明（印尼语含义）。 */
  mediaTranslation?: string;
  /** 语音题型：参考回答 / 范文，答题后展示。 */
  sampleAnswer?: string;
  /** 语音题型：参考回答拼音。 */
  sampleAnswerPinyin?: string;
  /** 语音题型：回答模板，用 ______ 表示要替换的部分。 */
  samplePattern?: string;
  /** 语音题型：思考提示（例：谁 ＋ 在做什么）。 */
  speakingHint?: string;
  /** 语音题型：提示词，学生可以选着用。 */
  speakingWords?: Array<{ id: string; text: string; pinyin?: string }>;
  /** 语音题型：占位评分项。 */
  scores?: InteractionScoreItem[];
}

export interface InteractionSet {
  id: string;
  lessonId: string;
  title: string;
  phase: Phase;
  status: "draft" | "published";
  currentVersionId: string;
  order: number;
  updatedAt: string;
  /** 为空 = 作用于该课节的所有课次；否则只在列出的课次出现。 */
  sessionIds?: string[];
  /** 从这里列出的课次中排除；用于「全课节」范围下单独移出某一课次。 */
  excludedSessionIds?: string[];
  /** 是否把该互动的成绩计入互动练习分类；纯投票和语音占位默认关闭。 */
  countsTowardGrade: boolean;
  /** library = 互动库母版；lesson = 课节副本。旧数据缺省按 lesson 处理。 */
  scope?: "library" | "lesson";
  /** 课节副本来源的互动库母版，仅用于溯源，不实时联动。 */
  sourceSetId?: string;
  /** 复制时母版的版本，仅用于溯源。 */
  sourceVersionId?: string;
  /** 互动库标签。 */
  tags?: string[];
  /** 来源：旧数据迁移、老师手动新建、从库复制、互动库母版。 */
  origin?: "legacy" | "manual" | "copied" | "library";
}

export interface GradePolicy {
  id: string;
  /** null = 平台默认规则；有值 = 指定学校覆盖规则。 */
  schoolId: string | null;
  effectiveFrom: string;
  weights: Record<GradeCategory, number>;
  updatedBy: string;
  updatedAt: string;
}

export interface GradeAssessment {
  id: string;
  schoolId: string;
  classId: string;
  title: string;
  category: AssessmentCategory;
  maxScore: number;
  assessedAt: string;
  teacherId: string;
  createdBy: string;
  createdAt: string;
  status: "published" | "archived";
  /** 创建时锁定的班级成员，后续成员变化不回写。 */
  rosterStudentIds: string[];
}

export interface AssessmentScore {
  id: string;
  assessmentId: string;
  studentId: string;
  score: number | null;
  normalizedScore: number | null;
  status: AssessmentScoreStatus;
  gradedBy?: string;
  gradedAt?: string;
  updatedAt: string;
  updatedBy: string;
}

export type InteractionTemplateLevel = "beginner" | "intermediate" | "advanced";

export type InteractionRoundScenario =
  | "warmup"
  | "vocabulary"
  | "sentence"
  | "scenario"
  | "review"
  | "speaking";

/** 一整轮可复用的互动模板；题目通过 itemTemplateIds 引用单题素材库。 */
export interface InteractionRoundTemplate {
  id: string;
  title: string;
  summary: string;
  scenarioId: InteractionRoundScenario;
  phase: Phase;
  topic: string;
  topicId: string;
  level: InteractionTemplateLevel;
  estimatedMinutes: number;
  tags: string[];
  itemTemplateIds: string[];
}

export interface InteractionTemplate {
  id: string;
  type: InteractionType;
  title: string;
  summary: string;
  topic: string;
  topicId: string;
  level: InteractionTemplateLevel;
  language: string;
  tags: string[];
  item: InteractionItem;
}

export interface InteractionTemplateSummary {
  total: number;
  byType: Record<string, number>;
  byTopic: Record<string, number>;
}

export interface InteractionVersion {
  id: string;
  setId: string;
  version: number;
  status: "published" | "archived";
  publishedAt: string;
  publishedBy: string;
  publishNote: string;
  items: InteractionItem[];
}

export interface InteractionAttempt {
  id: string;
  setId: string;
  versionId: string;
  studentId: string;
  sessionId: string | null;
  phase: Phase;
  score: number;
  bestScore: number;
  attempt: number;
  timeSpentSeconds: number;
  completedAt: string;
  answers: Record<string, unknown>;
  wrongItemIds: string[];
  pollAnswers: Record<string, string>;
  /** 作答时的互动标题与计分口径；用于锁定历史成绩展示。 */
  setTitle?: string;
  countsTowardGrade?: boolean;
}

export interface MaterialVersion {
  version: number;
  fileName: string;
  sizeLabel: string;
  url: string;
  publishedAt: string;
}

export interface Material {
  id: string;
  title: string;
  description: string;
  kind: "file" | "link" | "courseware";
  fileType: string;
  language: string;
  tags: string[];
  ownerId: string;
  status: "published" | "unpublished";
  currentVersion: number;
  downloadCount: number;
  createdAt: string;
  versions: MaterialVersion[];
  externalUrl?: string;
}

export interface LessonMaterialRef {
  id: string;
  materialId: string;
  lessonId: string;
  phase: Phase;
  order: number;
  published: boolean;
  /** 为空 = 作用于该课节的所有课次；否则只在列出的课次出现。 */
  sessionIds?: string[];
  /** 从这里列出的课次中排除；用于「全课节」范围下单独移出某一课次。 */
  excludedSessionIds?: string[];
}

export type ChangeRequestKind = "reschedule" | "add_session" | "new_lesson_plan" | "teacher_swap" | "cancel";

export interface ChangeRequest {
  id: string;
  sessionId: string;
  teacherId: string;
  kind: ChangeRequestKind;
  reason: string;
  status: "pending" | "handled" | "rejected";
  createdAt: string;
  handledAt?: string;
  handledBy?: string;
  resolutionNote?: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  link: string;
}

export interface AuditEvent {
  id: string;
  schoolId?: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  reason: string;
  createdAt: string;
}

export interface PlatformState {
  version: 2;
  generatedAt: string;
  currentUserId: string;
  ui: {
    language: "zh-CN" | "id-ID";
    timeZone: string;
    sidebarCollapsed: boolean;
  };
  users: PlatformUser[];
  schools: School[];
  schoolMemberships: SchoolMembership[];
  students: StudentProfile[];
  classes: ClassGroup[];
  classEnrollments: ClassEnrollment[];
  subjects: CourseSubject[];
  /** 课程列表。persisted key 沿用 folders 以兼容旧快照。 */
  folders: Course[];
  lessons: Lesson[];
  series: ClassSeries[];
  sessions: ClassSession[];
  bookings: Booking[];
  waitlist: WaitlistEntry[];
  interactionSets: InteractionSet[];
  interactionVersions: InteractionVersion[];
  interactionTemplates: InteractionTemplate[];
  interactionRoundTemplates: InteractionRoundTemplate[];
  interactionAttempts: InteractionAttempt[];
  gradePolicies: GradePolicy[];
  assessments: GradeAssessment[];
  assessmentScores: AssessmentScore[];
  materials: Material[];
  materialRefs: LessonMaterialRef[];
  notifications: NotificationItem[];
  changeRequests: ChangeRequest[];
  auditEvents: AuditEvent[];
}

export interface StoreResult<T = unknown> {
  ok: boolean;
  data: T | null;
  error: string;
  code: string;
}

export interface PlatformStoreApi {
  STORE_KEY: string;
  LEGACY_KEY: string;
  CHANGE_EVENT: string;
  getState(): PlatformState;
  subscribe(listener: (state: PlatformState) => void): () => void;
  resetDemo(): StoreResult<PlatformState>;
  setCurrentUser(userId: string): StoreResult<PlatformUser>;
  createSchool(input: { name: string; code: string; timeZone?: string; actorId?: string }): StoreResult<School>;
  updateSchool(input: { schoolId: string; patch: Partial<Pick<School, "name" | "code" | "timeZone" | "status">>; actorId?: string }): StoreResult<School>;
  deleteSchool(input: { schoolId: string; actorId?: string }): StoreResult<School>;
  createSchoolStaff(input: { schoolId: string; role: "academic" | "teacher"; name: string; phone: string; note?: string; timeZone?: string; actorId?: string }): StoreResult<{ user: PlatformUser; membership: SchoolMembership }>;
  saveSchoolMembership(input: { schoolId: string; userId: string; role: SchoolRole; status?: "active" | "left"; actorId?: string }): StoreResult<SchoolMembership>;
  updatePreferences(patch: { language?: "zh-CN" | "id-ID"; timeZone?: string; sidebarCollapsed?: boolean }): StoreResult<PlatformState["ui"]>;
  bookSession(input: { studentId: string; sessionId: string; force?: boolean; reason?: string; source?: string; actorId?: string }): StoreResult<Booking>;
  joinWaitlist(input: { studentId: string; sessionId: string; seriesId?: string | null; sessionIds?: string[] }): StoreResult<WaitlistEntry>;
  leaveWaitlist(input: { waitlistId: string; actorId?: string; reason?: string }): StoreResult<WaitlistEntry>;
  cancelBooking(input: { bookingId: string; actorId?: string; force?: boolean; reason?: string }): StoreResult<Booking[]>;
  reviewBooking(input: { bookingId: string; decision: "approve" | "reject"; reason: string; actorId?: string }): StoreResult<Booking>;
  enrollSeries(input: { studentId: string; seriesId: string; joinAsWaitlist?: boolean; force?: boolean; reason?: string; actorId?: string }): StoreResult<Booking[] | WaitlistEntry>;
  createClass(input: { name: string; teacherId?: string; status?: "active" | "archived"; schoolId?: string; actorId?: string }): StoreResult<ClassGroup>;
  updateClass(input: { classId: string; patch: Partial<Pick<ClassGroup, "name" | "teacherId" | "status">>; actorId?: string; reason?: string }): StoreResult<ClassGroup>;
  deleteClass(input: { classId: string; actorId?: string }): StoreResult<ClassGroup>;
  addClassMembers(input: { classId: string; studentIds: string[]; actorId?: string }): StoreResult<ClassEnrollment[]>;
  removeClassMember(input: { classId: string; studentId: string; actorId?: string }): StoreResult<ClassEnrollment>;
  createSession(input: Partial<ClassSession> & { title: string; lessonId: string; teacherId: string; startAt: string; endAt: string; capacity: number; actorId?: string; reason?: string }): StoreResult<ClassSession>;
  createSeries(input: { title: string; description?: string; className?: string; classId?: string; folderId?: string; lessonIds: string[]; sessionSchedule?: Array<{ lessonId: string; startAt: string }>; teacherId: string; startAt: string; intervalWeeks: number; durationMinutes: number; capacity: number; roomLabel?: string; schoolId?: string; actorId?: string; reason?: string }): StoreResult<ClassSeries>;
  updateSession(input: { sessionId: string; patch: Partial<ClassSession>; actorId?: string; reason?: string }): StoreResult<ClassSession>;
  startSession(input: { sessionId: string; actorId: string }): StoreResult<ClassSession>;
  endSession(input: { sessionId: string; actorId: string }): StoreResult<ClassSession>;
  syncSessionRoster(input: { sessionId: string; actorId?: string }): StoreResult<SessionRosterEntry[]>;
  addSessionRosterStudents(input: { sessionId: string; studentIds: string[]; actorId?: string }): StoreResult<SessionRosterEntry[]>;
  removeSessionRosterStudent(input: { sessionId: string; studentId: string; actorId?: string }): StoreResult<SessionRosterEntry[]>;
  updateSeriesSchedule(input: { seriesId: string; schedule: Array<{ sessionId: string; startAt: string; durationMinutes?: number }>; actorId?: string; reason?: string }): StoreResult<ClassSeries>;
  cancelSession(input: { sessionId: string; actorId: string; reason?: string }): StoreResult<ClassSession>;
  saveInteractionSet(input: Partial<InteractionSet> & { setId?: string; lessonId: string; title: string; phase: Phase; items: InteractionItem[]; countsTowardGrade?: boolean; scope?: "library" | "lesson"; tags?: string[]; actorId?: string; publishNote?: string }): StoreResult<{ set: InteractionSet; version: InteractionVersion }>;
  updateInteractionSetMeta(input: { setId: string; title?: string; phase?: Phase; tags?: string[]; countsTowardGrade?: boolean; actorId?: string }): StoreResult<{ set: InteractionSet }>;
  copyInteractionSetToLesson(input: { setId: string; lessonId: string; phase?: Phase; sessionIds?: string[]; actorId?: string }): StoreResult<{ set: InteractionSet; version: InteractionVersion; source: InteractionSet }>;
  saveInteractionSetToLibrary(input: { setId: string; versionId?: string; actorId?: string }): StoreResult<{ set: InteractionSet; version: InteractionVersion; source: InteractionSet }>;
  rollbackInteractionVersion(input: { setId: string; versionId: string; actorId?: string }): StoreResult<{ set: InteractionSet; version: InteractionVersion }>;
  assignInteractionSessions(input: { setId: string; sessionIds: string[]; actorId?: string }): StoreResult<InteractionSet>;
  excludeInteractionSession(input: { setId: string; sessionId: string; excluded: boolean; actorId?: string }): StoreResult<InteractionSet>;
  unassignInteractionSet(input: { setId: string; actorId?: string }): StoreResult<InteractionSet>;
  createSubject(input: { name: string; description?: string; color?: string; actorId?: string }): StoreResult<CourseSubject>;
  updateSubject(input: { subjectId: string; patch: Partial<Pick<CourseSubject, "name" | "description" | "color">>; actorId?: string }): StoreResult<CourseSubject>;
  deleteSubject(input: { subjectId: string; actorId?: string }): StoreResult<CourseSubject>;
  createCourse(input: { subjectId: string; name: string; description?: string; tags?: string[]; color?: string; actorId?: string }): StoreResult<Course>;
  updateCourse(input: { courseId: string; patch: Partial<Pick<Course, "subjectId" | "name" | "description" | "tags" | "color">>; actorId?: string }): StoreResult<Course>;
  setCourseStatus(input: { courseId: string; status: CourseStatus; actorId?: string }): StoreResult<Course>;
  deleteCourse(input: { courseId: string; actorId?: string }): StoreResult<Course>;
  createLesson(input: { folderId: string; title: string; subtitle?: string; description?: string; durationMinutes?: number; tags?: string[]; color?: string; coverEmoji?: string; actorId?: string }): StoreResult<Lesson>;
  updateLesson(input: { lessonId: string; patch: Partial<Pick<Lesson, "title" | "subtitle" | "description" | "durationMinutes" | "tags" | "color" | "coverEmoji">>; actorId?: string }): StoreResult<Lesson>;
  setLessonStatus(input: { lessonId: string; status: CourseStatus; actorId?: string }): StoreResult<Lesson>;
  deleteLesson(input: { lessonId: string; actorId?: string }): StoreResult<Lesson>;
  moveLesson(input: { lessonId: string; direction: "up" | "down"; actorId?: string }): StoreResult<Lesson[]>;
  reorderLesson(input: { lessonId: string; targetIndex: number; actorId?: string }): StoreResult<Lesson[]>;
  createStudent(input: { name: string; phone?: string; timeZone?: string; locale?: string; program?: string; level?: string; className?: string; learningGoal?: string; preferredTeacherId?: string; schoolId?: string; actorId?: string }): StoreResult<{ user: PlatformUser; profile: StudentProfile }>;
  addMockMaterial(input: { title: string; description: string; fileType?: string; language?: string; tags?: string[]; ownerId?: string; phase?: Phase; lessonId?: string; fileName?: string; sizeLabel?: string }): StoreResult<Material>;
  attachMaterial(input: { materialId: string; lessonId: string; phase: Phase; order?: number; sessionIds?: string[]; actorId?: string }): StoreResult<Material>;
  detachMaterial(input: { materialId: string; lessonId: string; phase: Phase; actorId?: string }): StoreResult<Material>;
  excludeMaterialSession(input: { materialId: string; lessonId: string; phase: Phase; sessionId: string; excluded: boolean; actorId?: string }): StoreResult<Material>;
  addMaterialVersion(input: { materialId: string; fileName: string; sizeLabel: string; actorId?: string }): StoreResult<Material>;
  setMaterialStatus(input: { materialId: string; status: "published" | "unpublished"; actorId?: string; reason?: string }): StoreResult<Material>;
  trackDownload(materialId: string): StoreResult<Material>;
  recordAttempt(input: { setId: string; studentId: string; sessionId?: string | null; phase: Phase; answers: Record<string, unknown>; score: number; timeSpentSeconds: number; wrongItemIds?: string[]; pollAnswers?: Record<string, string> }): StoreResult<InteractionAttempt>;
  createAssessment(input: { classId: string; title: string; category: AssessmentCategory; maxScore?: number; assessedAt: string; actorId?: string }): StoreResult<GradeAssessment>;
  saveAssessmentScores(input: { assessmentId: string; entries: Array<{ studentId: string; score?: number | null; status: AssessmentScoreStatus }>; actorId?: string }): StoreResult<AssessmentScore[]>;
  archiveAssessment(input: { assessmentId: string; actorId?: string; reason?: string }): StoreResult<GradeAssessment>;
  saveGradePolicy(input: { effectiveFrom: string; weights: Record<GradeCategory, number>; schoolId?: string | null; actorId?: string }): StoreResult<GradePolicy>;
  updateStudent(input: { studentId: string; patch: Partial<PlatformUser & StudentProfile>; actorId?: string; reason?: string }): StoreResult<{ user: PlatformUser; profile: StudentProfile }>;
  requestSessionChange(input: { sessionId: string; kind: ChangeRequestKind; reason: string; actorId?: string }): StoreResult<ChangeRequest>;
  resolveChangeRequest(input: { requestId: string; status?: "handled" | "rejected"; resolutionNote?: string; actorId?: string }): StoreResult<ChangeRequest>;
  markNotificationRead(notificationId: string): StoreResult<NotificationItem>;
  markAllNotificationsRead(userId: string): StoreResult<boolean>;
}

declare global {
  interface Window {
    AICloudPlatformStore: PlatformStoreApi;
  }
}
