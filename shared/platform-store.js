(function attachPlatformStore(global) {
  "use strict";

  const STORE_KEY = "ai-chinese-cloud-platform-v2";
  const LEGACY_KEY = "ai-chinese-cloud-classroom-demo-v1";
  const CHANGE_EVENT = "aicloud:store-changed";
  const seedFactory = global.AICloudSeedData;

  if (!seedFactory) {
    throw new Error("AICloudSeedData must be loaded before AICloudPlatformStore");
  }

  let state = null;
  const listeners = new Set();

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function makeId(prefix) {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return `${prefix}-${global.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function result(ok, data, error, code) {
    return { ok, data: data ?? null, error: error ?? "", code: code ?? "" };
  }

  function emit(source) {
    listeners.forEach((listener) => listener(clone(state), source));
    if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
      global.dispatchEvent(new global.CustomEvent(CHANGE_EVENT, { detail: { source } }));
    }
  }

  function save(mutator, source) {
    const draft = clone(state);
    const output = mutator(draft);
    state = draft;
    try {
      global.localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Unable to persist demo state", error);
    }
    emit(source);
    return output;
  }

  function normalize(input) {
    const seeded = seedFactory.createSeedData();
    const merged = {
      ...seeded,
      ...(input || {}),
      version: 2,
      ui: { ...seeded.ui, ...(input && input.ui ? input.ui : {}) }
    };
    const collectionKeys = [
      "users",
      "schools",
      "schoolMemberships",
      "students",
      "classes",
      "classEnrollments",
      "subjects",
      "folders",
      "lessons",
      "series",
      "sessions",
      "bookings",
      "waitlist",
      "interactionSets",
      "interactionVersions",
      "interactionTemplates",
      "interactionAttempts",
      "gradePolicies",
      "assessments",
      "assessmentScores",
      "materials",
      "materialRefs",
      "notifications",
      "changeRequests",
      "auditEvents"
    ];
    collectionKeys.forEach((key) => {
      if (!Array.isArray(merged[key])) merged[key] = seeded[key];
    });

    /* 课程体系从“自由目录 + 课节”升级为“科目 → 课程 → 课节”。
       旧快照里的 folder-root 只作为分类容器存在，迁移时提升为科目；
       其余目录全部保留为课程，课节上的 folderId 因此无需改写。 */
    const seededSubject = (seeded.subjects || [])[0] || {
      id: "subject-chinese",
      name: "中文",
      description: "",
      color: "#6552ff",
      order: 1
    };
    if (!Array.isArray(merged.subjects) || merged.subjects.length === 0) {
      merged.subjects = [clone(seededSubject)];
    }
    const defaultSubject = merged.subjects[0];
    const legacyRoot = merged.folders.find((folder) => folder.id === "folder-root");
    if (legacyRoot && !(Array.isArray(input?.subjects) && input.subjects.length > 0)) {
      const legacyName = String(legacyRoot.name || "").replace(/课程库$/u, "").trim();
      if (legacyName) defaultSubject.name = legacyName;
      if (!defaultSubject.description && legacyRoot.description) defaultSubject.description = legacyRoot.description;
      const rootLessons = merged.lessons.filter((lesson) => lesson.folderId === legacyRoot.id);
      if (rootLessons.length === 0) {
        merged.folders = merged.folders.filter((folder) => folder.id !== legacyRoot.id);
      } else {
        legacyRoot.subjectId = defaultSubject.id;
        legacyRoot.name = legacyRoot.name === "中文课程库" ? "未分类课程" : legacyRoot.name;
      }
    }
    const subjectIds = new Set(merged.subjects.map((subject) => subject.id));
    merged.folders.forEach((course, index) => {
      course.subjectId = subjectIds.has(course.subjectId) ? course.subjectId : defaultSubject.id;
      course.status = ["draft", "published", "disabled"].includes(course.status) ? course.status : "published";
      course.tags = Array.isArray(course.tags) ? course.tags.filter(Boolean) : [];
      course.order = Number(course.order) || index + 1;
      delete course.parentId;
    });
    const lessonSequence = new Map();
    merged.lessons.forEach((lesson) => {
      const nextOrder = (lessonSequence.get(lesson.folderId) || 0) + 1;
      lesson.order = Number(lesson.order) || nextOrder;
      lessonSequence.set(lesson.folderId, Math.max(nextOrder, lesson.order));
    });

    const seededSchoolById = new Map((seeded.schools || []).map((school) => [school.id, school]));
    merged.schools.forEach((school) => {
      school.timeZone = school.timeZone || seededSchoolById.get(school.id)?.timeZone || "Asia/Jakarta";
    });

    // 班级名称是新增字段：老快照按课次 id 从种子补齐，找不到的旧课次显示“待分配班级”。
    const seededSessionById = new Map((seeded.sessions || []).map((session) => [session.id, session]));
    merged.sessions.forEach((session) => {
      if (!session.className) {
        session.className = seededSessionById.get(session.id)?.className || "待分配班级";
      }
      // 课次名单是后加的快照字段：老快照按当前班级有效成员补齐，后续不再随班级自动变化。
      if (!Array.isArray(session.roster)) {
        session.roster = merged.classEnrollments
          .filter((item) => item.classId === session.classId && item.status === "active")
          .map((item) => ({
            studentId: item.studentId,
            source: "snapshot",
            addedAt: item.joinedAt || merged.generatedAt || nowIso()
          }));
      }
    });

    // 演示名单瘦身：早期种子里用于凑数的填充学生已下线，老快照里一并清掉，
    // 否则角色预览会继续列出这些账号。
    const retiredDemoStudentIds = new Set([
      "student-siti",
      "student-ardi",
      "student-citra",
      "student-fajar",
      "student-gita"
    ]);
    const isRetiredStudent = (id) => retiredDemoStudentIds.has(id);
    merged.users = merged.users.filter((user) => !isRetiredStudent(user.id));
    merged.students = merged.students.filter((profile) => !isRetiredStudent(profile.userId));
    merged.schoolMemberships = merged.schoolMemberships.filter((item) => !isRetiredStudent(item.userId));
    merged.classEnrollments = merged.classEnrollments.filter((item) => !isRetiredStudent(item.studentId));
    merged.bookings = merged.bookings.filter((item) => !isRetiredStudent(item.studentId));
    merged.waitlist = merged.waitlist.filter((item) => !isRetiredStudent(item.studentId));
    merged.sessions.forEach((session) => {
      if (Array.isArray(session.roster)) {
        session.roster = session.roster.filter((entry) => !isRetiredStudent(entry.studentId));
      }
    });
    merged.interactionAttempts = merged.interactionAttempts.filter((item) => !isRetiredStudent(item.studentId));
    merged.assessmentScores = merged.assessmentScores.filter((item) => !isRetiredStudent(item.studentId));
    merged.notifications = merged.notifications.filter((item) => !isRetiredStudent(item.userId));
    merged.assessments.forEach((assessment) => {
      if (Array.isArray(assessment.rosterStudentIds)) {
        assessment.rosterStudentIds = assessment.rosterStudentIds.filter((id) => !isRetiredStudent(id));
      }
    });
    if (isRetiredStudent(merged.currentUserId)) {
      merged.currentUserId = seeded.currentUserId;
    }

    // 角色显示名由「运营」调整为「教学管理」：老快照里的用户名、职务与历史文案一并迁移。
    function renameLegacyRoleCopy(value) {
      if (typeof value === "string") return value.replace(/运营/g, "教学管理");
      if (Array.isArray(value)) return value.map(renameLegacyRoleCopy);
      if (value && typeof value === "object") {
        Object.keys(value).forEach((key) => {
          value[key] = renameLegacyRoleCopy(value[key]);
        });
      }
      return value;
    }
    renameLegacyRoleCopy(merged);

    // 预制模板库以种子为准：老快照里的内置模板按 id 覆盖成最新内容，
    // 老师自己（未来）保存的模板不在种子里，原样保留。
    const retiredTemplateIdPattern = /^tpl-(scene|b3)-/;
    const seededTemplateIds = new Set((seeded.interactionTemplates || []).map((template) => template.id));
    merged.interactionTemplates = [
      ...(seeded.interactionTemplates || []).map((template) => clone(template)),
      ...merged.interactionTemplates.filter(
        (template) => !seededTemplateIds.has(template.id) && !retiredTemplateIdPattern.test(template.id)
      )
    ];
    // 互动集的「给学生的说明」字段已下线，老快照里残留的顺手清掉。
    merged.interactionSets.forEach((set) => {
      delete set.description;
    });
    // 旧版把一道题拆成多题一组，这里按“一个互动一道题”替换成单题互动。
    const retiredInteractionSetIds = ["set-food-preview", "set-food-live", "set-food-review"];
    merged.interactionSets = merged.interactionSets.filter((set) => !retiredInteractionSetIds.includes(set.id));
    merged.interactionVersions = merged.interactionVersions.filter((version) => !retiredInteractionSetIds.includes(version.setId));
    const demoInteractionSetIds = [
      "set-friends-preview",
      "set-greetings-review-voice",
      "set-greetings-scenario",
      "set-greetings-batch-three",
      "set-food-picture",
      "set-food-match",
      "set-food-fill",
      "set-food-situation",
      "set-food-dialogue",
      "set-food-choice",
      "set-food-order",
      "set-food-category",
      "set-food-poll"
    ];
    demoInteractionSetIds.forEach((setId) => {
      const demoSet = (seeded.interactionSets || []).find((set) => set.id === setId);
      if (!demoSet) return;
      if (!merged.interactionSets.some((set) => set.id === demoSet.id)) {
        merged.interactionSets.push(clone(demoSet));
      }
      (seeded.interactionVersions || [])
        .filter((version) => version.setId === demoSet.id)
        .forEach((version) => {
          if (!merged.interactionVersions.some((item) => item.id === version.id)) {
            merged.interactionVersions.push(clone(version));
          }
        });
    });

    // 「餐厅中文」系列改成多课节后，点餐互动从旧的第 2 课次迁到新的第 1 课次。
    merged.interactionSets.forEach((set) => {
      if (
        set.lessonId === "lesson-food" &&
        Array.isArray(set.sessionIds) &&
        set.sessionIds.length === 1 &&
        set.sessionIds[0] === "series-session-2"
      ) {
        set.sessionIds = ["series-session-1"];
      }
    });

    /* 新增的「报名需审核」课次：老快照按 id 补齐课节和课次，并恢复审核标记。 */
    const reviewSessionId = "session-review";
    const seededReviewSession = (seeded.sessions || []).find((item) => item.id === reviewSessionId);
    if (seededReviewSession) {
      const reviewLesson = (seeded.lessons || []).find((item) => item.id === seededReviewSession.lessonId);
      if (reviewLesson && !merged.lessons.some((item) => item.id === reviewLesson.id)) {
        merged.lessons.push(clone(reviewLesson));
      }
      const existingReviewSession = merged.sessions.find((item) => item.id === reviewSessionId);
      if (!existingReviewSession) {
        merged.sessions.push(clone(seededReviewSession));
      } else {
        existingReviewSession.approvalRequired = true;
      }
    }

    /* 新增的「中文社团课」学期系列班：老快照按 id 补齐主题目录、24 个课节、课次和系列班本体。 */
    const clubSeriesId = "series-club-semester";
    const seededClubSeries = (seeded.series || []).find((item) => item.id === clubSeriesId);
    if (seededClubSeries && !merged.series.some((item) => item.id === clubSeriesId)) {
      const clubFolder = (seeded.folders || []).find((item) => item.id === seededClubSeries.folderId);
      if (clubFolder && !merged.folders.some((item) => item.id === clubFolder.id)) {
        merged.folders.push(clone(clubFolder));
      }
      (seededClubSeries.lessonIds || [seededClubSeries.lessonId]).forEach((lessonId) => {
        const clubLesson = (seeded.lessons || []).find((item) => item.id === lessonId);
        if (clubLesson && !merged.lessons.some((item) => item.id === clubLesson.id)) {
          merged.lessons.push(clone(clubLesson));
        }
      });
      seededClubSeries.sessionIds.forEach((sessionId) => {
        const session = (seeded.sessions || []).find((item) => item.id === sessionId);
        if (session && !merged.sessions.some((item) => item.id === sessionId)) {
          merged.sessions.push(clone(session));
        }
      });
      merged.series.push(clone(seededClubSeries));
    }

    /* 系列班模型升级：从“同一课节多个课次”改为“同一主题目录下多个课节”。
       演示系列按种子补齐主题目录、课节和课次上的课节指向，避免老快照继续显示旧结构。 */
    (seeded.series || []).forEach((seededSeries) => {
      const series = merged.series.find((item) => item.id === seededSeries.id);
      if (!series) return;
      const themeFolder = (seeded.folders || []).find((item) => item.id === seededSeries.folderId);
      if (themeFolder && !merged.folders.some((item) => item.id === themeFolder.id)) {
        merged.folders.push(clone(themeFolder));
      }
      (seededSeries.lessonIds || [seededSeries.lessonId]).forEach((lessonId) => {
        const seededLesson = (seeded.lessons || []).find((item) => item.id === lessonId);
        if (seededLesson && !merged.lessons.some((item) => item.id === lessonId)) {
          merged.lessons.push(clone(seededLesson));
        }
      });
      (seededSeries.sessionIds || []).forEach((sessionId, index) => {
        const seededSession = (seeded.sessions || []).find((item) => item.id === sessionId);
        if (!seededSession) return;
        const existingSession = merged.sessions.find((item) => item.id === sessionId);
        if (existingSession) {
          existingSession.seriesId = seededSeries.id;
          existingSession.lessonId = (seededSeries.lessonIds || [])[index] || existingSession.lessonId;
        } else {
          merged.sessions.push(clone(seededSession));
        }
      });
      series.folderId = seededSeries.folderId;
      series.lessonIds = [...(seededSeries.lessonIds || [seededSeries.lessonId])];
      series.lessonId = seededSeries.lessonId || series.lessonIds[0];
      series.sessionIds = [...(seededSeries.sessionIds || [])];
    });

    /* 系列班课节列表兜底：用户自己创建的系列班如果还没记录 lessonIds，
       按系列内课次的开课顺序补齐；套用第一个课节的目录作为系列主题。 */
    const sessionById = new Map((merged.sessions || []).map((session) => [session.id, session]));
    merged.series.forEach((series) => {
      if (!Array.isArray(series.lessonIds) || series.lessonIds.length === 0) {
        const orderedLessonIds = (series.sessionIds || [])
          .map((sessionId) => sessionById.get(sessionId))
          .filter(Boolean)
          .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
          .map((session) => session.lessonId)
          .filter(Boolean);
        series.lessonIds = orderedLessonIds.length
          ? [...new Set(orderedLessonIds)]
          : series.lessonId
            ? [series.lessonId]
            : [];
      }
      if (!series.lessonId) series.lessonId = series.lessonIds[0] || "";
      if (!series.folderId) {
        const anchorLesson = (merged.lessons || []).find((item) => item.id === series.lessonId);
        series.folderId = anchorLesson?.folderId || "";
      }
    });

    /* 班级主数据迁移：老快照只有 className 字符串，这里按名称补齐稳定班级、
       课次关联、学生主班级和有效成员关系。 */
    const classByName = new Map(merged.classes.map((item) => [item.name, item]));
    const ensureClass = (name, teacherId) => {
      const normalizedName = name || "待分配班级";
      let classGroup = classByName.get(normalizedName);
      if (!classGroup) {
        classGroup = {
          id: makeId("class"),
          name: normalizedName,
          teacherId: teacherId || "teacher-lina",
          status: "active",
          createdAt: nowIso()
        };
        merged.classes.push(classGroup);
        classByName.set(normalizedName, classGroup);
      }
      return classGroup;
    };
    merged.sessions.forEach((session) => {
      if (!session.className) session.className = "待分配班级";
      const classGroup = session.classId
        ? merged.classes.find((item) => item.id === session.classId)
        : undefined;
      const resolved = classGroup || ensureClass(session.className, session.teacherId);
      session.classId = resolved.id;
      session.className = resolved.name;
      classByName.set(resolved.name, resolved);
    });
    merged.students.forEach((profile) => {
      if (!profile.className) profile.className = "待分班";
      const classGroup = profile.primaryClassId
        ? merged.classes.find((item) => item.id === profile.primaryClassId)
        : undefined;
      const resolved = classGroup || ensureClass(profile.className, profile.preferredTeacherId);
      profile.primaryClassId = resolved.id;
      profile.className = resolved.name;
    });
    const enrollmentByKey = new Map(
      merged.classEnrollments.map((enrollment) => [`${enrollment.classId}:${enrollment.studentId}`, enrollment])
    );
    const ensureEnrollment = (classId, studentId, source, joinedAt) => {
      const key = `${classId}:${studentId}`;
      let enrollment = enrollmentByKey.get(key);
      if (!enrollment) {
        enrollment = {
          id: makeId("class-enrollment"),
          classId,
          studentId,
          status: "active",
          joinedAt: joinedAt || nowIso(),
          source
        };
        merged.classEnrollments.push(enrollment);
        enrollmentByKey.set(key, enrollment);
      }
      return enrollment;
    };
    merged.students.forEach((profile) => {
      if (profile.primaryClassId) ensureEnrollment(profile.primaryClassId, profile.userId, "profile", profile.joinedAt);
    });
    merged.bookings.filter((booking) => booking.status === "booked").forEach((booking) => {
      const session = merged.sessions.find((item) => item.id === booking.sessionId);
      if (session?.classId) ensureEnrollment(session.classId, booking.studentId, "booking", booking.createdAt);
    });

    /* 校区与成员关系迁移：老快照没有学校字段时，根据班级名称补出稳定学校，
       并按班级、任课教师和有效成员关系生成多校成员记录。 */
    (seeded.schools || []).forEach((school) => {
      if (!merged.schools.some((item) => item.id === school.id)) merged.schools.push(clone(school));
    });
    (seeded.users || []).filter((user) => user.role === "academic" || user.role === "student").forEach((user) => {
      if (!merged.users.some((item) => item.id === user.id)) merged.users.push(clone(user));
    });
    function migratedSchoolIdForClass(name) {
      if (String(name || "").includes("圣心")) return "school-sacred-heart";
      if (String(name || "").includes("希望")) return "school-hope";
      if (String(name || "").includes("光明")) return "school-light";
      if (String(name || "").includes("培民")) return "school-bina";
      return "school-demo";
    }

    // 旧快照补入 8B 第二教师演示课次；班级按名称稳定匹配，不覆盖用户已有班级。
    const seededEightB = (seeded.sessions || []).find((item) => item.id === "session-8b-past");
    if (seededEightB && !merged.sessions.some((item) => item.id === seededEightB.id)) {
      const classGroup = merged.classes.find((item) => item.name === seededEightB.className) ||
        ensureClass(seededEightB.className, seededEightB.teacherId);
      classGroup.schoolId = classGroup.schoolId || "school-sacred-heart";
      merged.sessions.push({ ...clone(seededEightB), classId: classGroup.id });
    }
    merged.classes.forEach((classGroup) => {
      if (!classGroup.schoolId || !merged.schools.some((school) => school.id === classGroup.schoolId)) {
        classGroup.schoolId = migratedSchoolIdForClass(classGroup.name);
      }
    });
    merged.sessions.forEach((session) => {
      const classGroup = merged.classes.find((item) => item.id === session.classId);
      session.schoolId = classGroup?.schoolId || migratedSchoolIdForClass(session.className);
    });
    merged.series.forEach((series) => {
      const firstSession = (series.sessionIds || [])
        .map((sessionId) => merged.sessions.find((item) => item.id === sessionId))
        .find(Boolean);
      if (!series.schoolId || !merged.schools.some((school) => school.id === series.schoolId)) {
        series.schoolId = firstSession?.schoolId || migratedSchoolIdForClass(firstSession?.className);
      }
    });
    merged.assessments.forEach((assessment) => {
      const classGroup = merged.classes.find((item) => item.id === assessment.classId);
      assessment.schoolId = assessment.schoolId || classGroup?.schoolId || "school-demo";
    });
    (seeded.students || []).forEach((seededProfile) => {
      if (merged.students.some((item) => item.userId === seededProfile.userId)) return;
      if (!merged.users.some((item) => item.id === seededProfile.userId)) return;
      const profile = clone(seededProfile);
      const classGroup = merged.classes.find((item) => item.id === profile.primaryClassId) ||
        merged.classes.find((item) => item.name === profile.className);
      if (classGroup) {
        profile.primaryClassId = classGroup.id;
        profile.className = classGroup.name;
        merged.students.push(profile);
        ensureEnrollment(classGroup.id, profile.userId, "profile", profile.joinedAt);
      }
    });
    (seeded.bookings || []).filter((booking) => booking.sessionId === "session-8b-past").forEach((booking) => {
      if (merged.bookings.some((item) => item.id === booking.id)) return;
      const session = merged.sessions.find((item) => item.id === booking.sessionId);
      if (!session || !merged.users.some((item) => item.id === booking.studentId)) return;
      merged.bookings.push(clone(booking));
      ensureEnrollment(session.classId, booking.studentId, "booking", booking.createdAt);
    });
    (seeded.assessments || []).filter((assessment) => assessment.id.startsWith("assessment-") && assessment.id.includes("-8b-")).forEach((assessment) => {
      if (merged.assessments.some((item) => item.id === assessment.id)) return;
      const classGroup = merged.classes.find((item) => item.name === "印尼圣心学校8年级B班");
      if (classGroup) merged.assessments.push({ ...clone(assessment), classId: classGroup.id, schoolId: classGroup.schoolId });
    });

    function ensureSchoolMembership(schoolId, userId, role, joinedAt) {
      if (!schoolId || !userId) return;
      const existing = merged.schoolMemberships.find(
        (item) => item.schoolId === schoolId && item.userId === userId && item.status === "active"
      );
      if (existing) return;
      merged.schoolMemberships.push({
        id: makeId("school-membership"),
        schoolId,
        userId,
        role,
        status: "active",
        joinedAt: joinedAt || nowIso()
      });
    }
    merged.classes.forEach((classGroup) => {
      ensureSchoolMembership(classGroup.schoolId, classGroup.teacherId, "teacher", classGroup.createdAt);
      merged.classEnrollments
        .filter((item) => item.classId === classGroup.id && item.status === "active")
        .forEach((enrollment) => ensureSchoolMembership(classGroup.schoolId, enrollment.studentId, "student", enrollment.joinedAt));
    });
    ensureSchoolMembership("school-sacred-heart", "academic-shengxin", "academic", nowIso());
    ensureSchoolMembership("school-demo", "academic-demo", "academic", nowIso());

    // 学校级成绩政策：旧版全局规则变成平台默认，种子学校覆盖按 id 回填。
    merged.gradePolicies.forEach((policy) => {
      if (!Object.prototype.hasOwnProperty.call(policy, "schoolId")) policy.schoolId = null;
    });
    (seeded.gradePolicies || []).forEach((policy) => {
      if (policy.schoolId && !merged.gradePolicies.some((item) => item.id === policy.id)) {
        merged.gradePolicies.push(clone(policy));
      }
    });

    // 补回学校教务演示所需的成绩与互动记录，不影响既有 id。
    (seeded.assessmentScores || []).forEach((score) => {
      if (merged.assessmentScores.some((item) => item.id === score.id)) return;
      if (merged.assessments.some((item) => item.id === score.assessmentId)) merged.assessmentScores.push(clone(score));
    });
    (seeded.interactionAttempts || [])
      .filter((attempt) => attempt.id.startsWith("attempt-student-"))
      .forEach((attempt) => {
        if (!merged.interactionAttempts.some((item) => item.id === attempt.id)) merged.interactionAttempts.push(clone(attempt));
      });
    merged.auditEvents.forEach((event) => {
      if (event.schoolId) return;
      const session = event.targetType === "session" || event.targetType === "booking"
        ? merged.sessions.find((item) => item.id === event.targetId)
        : null;
      const classGroup = merged.classes.find((item) => item.id === event.targetId) ||
        merged.classes.find((item) => item.id === session?.classId);
      const assessment = merged.assessments.find((item) => item.id === event.targetId);
      event.schoolId = classGroup?.schoolId || assessment?.schoolId || undefined;
    });

    // 新增报名审核演示：老快照按 id 回填，便于学校教务直接查看待办闭环。
    (seeded.bookings || []).filter((booking) => booking.status === "pending_review").forEach((booking) => {
      if (merged.bookings.some((item) => item.id === booking.id)) return;
      const session = merged.sessions.find((item) => item.id === booking.sessionId);
      const student = merged.users.find((item) => item.id === booking.studentId);
      if (session && student) merged.bookings.push(clone(booking));
    });

    // 近期成绩演示记录按 id 回填，老快照无需重置也能看到互动 / 作业 / 考试的完整明细。
    const demoGradeAssessmentIds = [
      "assessment-homework-greetings-3",
      "assessment-exam-greetings-3"
    ];
    demoGradeAssessmentIds.forEach((assessmentId) => {
      if (merged.assessments.some((item) => item.id === assessmentId)) return;
      const assessment = (seeded.assessments || []).find((item) => item.id === assessmentId);
      if (assessment) merged.assessments.push(clone(assessment));
    });
    const demoAssessmentScoreIds = [
      "assessment-score-13",
      "assessment-score-14",
      "assessment-score-15",
      "assessment-score-16",
      "assessment-score-17",
      "assessment-score-18"
    ];
    demoAssessmentScoreIds.forEach((scoreId) => {
      if (merged.assessmentScores.some((item) => item.id === scoreId)) return;
      const score = (seeded.assessmentScores || []).find((item) => item.id === scoreId);
      if (score && merged.assessments.some((item) => item.id === score.assessmentId)) {
        merged.assessmentScores.push(clone(score));
      }
    });
    const demoGradeAttemptIds = [
      "attempt-raymond-review-greetings",
      "attempt-raymond-scenario-greetings",
      "attempt-raymond-batch-three"
    ];
    demoGradeAttemptIds.forEach((attemptId) => {
      if (merged.interactionAttempts.some((item) => item.id === attemptId)) return;
      const attempt = (seeded.interactionAttempts || []).find((item) => item.id === attemptId);
      if (attempt) merged.interactionAttempts.push(clone(attempt));
    });

    // 计分口径迁移：投票与语音占位互动默认不计入成绩，其他客观互动默认计入。
    merged.interactionSets.forEach((set) => {
      if (typeof set.countsTowardGrade === "boolean") return;
      const items = merged.interactionVersions
        .filter((version) => version.setId === set.id)
        .flatMap((version) => version.items || []);
      const onlyPoll = items.length > 0 && items.every((item) => item.type === "poll");
      const hasPlaceholderSpeaking = items.some((item) => ["read-aloud", "picture-talk", "open-qa"].includes(item.type));
      set.countsTowardGrade = !onlyPoll && !hasPlaceholderSpeaking;
    });
    if (!merged.gradePolicies.length) {
      merged.gradePolicies.push({
        id: "grade-policy-default",
        effectiveFrom: new Date(new Date().getFullYear(), 0, 1).toISOString(),
        weights: { interaction: 40, homework: 30, exam: 30 },
        updatedBy: "system",
        updatedAt: nowIso()
      });
    }
    merged.assessmentScores.forEach((score) => {
      const assessment = merged.assessments.find((item) => item.id === score.assessmentId);
      if (!assessment) return;
      if (score.status === "graded" && typeof score.score === "number") {
        score.normalizedScore = Math.round((score.score / assessment.maxScore) * 1000) / 10;
      } else if (score.status === "absent") {
        score.score = 0;
        score.normalizedScore = 0;
      } else {
        score.score = null;
        score.normalizedScore = null;
      }
    });

    // Repair core demo scenarios for users who already have an older v2 snapshot.
    if (merged.sessions.some((session) => session.id === "session-preview") &&
        !merged.bookings.some((booking) => booking.sessionId === "session-preview" && booking.studentId === "student-anisa" && booking.status === "booked")) {
      merged.bookings.push({
        id: "booking-preview-anisa",
        sessionId: "session-preview",
        studentId: "student-anisa",
        status: "booked",
        source: "student",
        createdAt: nowIso(),
        enrollmentId: null
      });
    }
    /* 演示课次按"今天"对齐：老快照隔天再打开时，学生端首页的三档任务窗口（课前 / 课中 / 课后）会全空。
       每天最多对齐一次，当天在后台改过的排课不会被覆盖。 */
    // 带版本号：对齐规则本身改了（比如课名也要跟着改）时，老快照当天也能再对齐一次。
    const DEMO_ALIGN_REVISION = 4;
    const todayKey = (() => {
      const today = new Date();
      return `v${DEMO_ALIGN_REVISION}:${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    })();
    if (merged.demoSessionsAlignedOn !== todayKey) {
      const atLocalTime = (dayOffset, hour, minute) => {
        const date = new Date();
        date.setDate(date.getDate() + dayOffset);
        date.setHours(hour, minute, 0, 0);
        return date;
      };
      // 课次整体平移：时长与"预约截止 / 取消截止"的提前量都保持不变。
      const alignSession = (sessionId, startAt) => {
        const session = merged.sessions.find((item) => item.id === sessionId);
        if (!session) return;
        const delta = startAt.getTime() - new Date(session.startAt).getTime();
        session.startAt = startAt.toISOString();
        session.endAt = new Date(new Date(session.endAt).getTime() + delta).toISOString();
        if (session.bookingCloseAt) session.bookingCloseAt = new Date(new Date(session.bookingCloseAt).getTime() + delta).toISOString();
        if (session.cancelCloseAt) session.cancelCloseAt = new Date(new Date(session.cancelCloseAt).getTime() + delta).toISOString();
      };
      // 课名里的"周五晚 / 周末 / 已结束"跟对齐后的时间对不上，一并改成中性写法。
      const demoTitles = {
        "session-live": "问候口语大班课",
        "session-preview": "认识新朋友 · 体验课",
        "session-past": "问候复习课"
      };
      Object.keys(demoTitles).forEach((sessionId) => {
        const session = merged.sessions.find((item) => item.id === sessionId);
        if (session) session.title = demoTitles[sessionId];
      });
      alignSession("session-live", new Date(Date.now() - 10 * 60 * 1000)); // 正在上课 → 课中任务
      alignSession("session-past", atLocalTime(-1, 20, 0)); // 昨天上完 → 课后任务
      alignSession("session-preview", atLocalTime(1, 20, 0)); // 明天上课 → 课前任务
      alignSession("session-waitlist-full", atLocalTime(2, 19, 30));
      alignSession("session-review", atLocalTime(4, 19, 0));
      ["series-session-1", "series-session-2", "series-session-3", "series-session-4"].forEach((sessionId, index) => {
        alignSession(sessionId, atLocalTime([3, 10, 17, 24][index], 18, 30));
      });
      // 社团课：每周一次，共 24 节，首课同样落在三天后。
      (seededClubSeries ? seededClubSeries.sessionIds : []).forEach((sessionId, index) => {
        alignSession(sessionId, atLocalTime(3 + index * 7, 15, 30));
      });

      // 三档窗口的演示预约：Anisa 三档都有，Raymond / Maya 看课中，Kevin 看课前。
      [
        { id: "booking-live-anisa", sessionId: "session-live", studentId: "student-anisa" },
        { id: "booking-live-maya", sessionId: "session-live", studentId: "student-maya" },
        { id: "booking-live-raymond", sessionId: "session-live", studentId: "student-raymond" },
        { id: "booking-past-anisa", sessionId: "session-past", studentId: "student-anisa" },
        { id: "booking-past-raymond", sessionId: "session-past", studentId: "student-raymond" },
        { id: "booking-preview-anisa", sessionId: "session-preview", studentId: "student-anisa" },
        { id: "booking-preview-kevin", sessionId: "session-preview", studentId: "student-kevin" }
      ].forEach((entry) => {
        const session = merged.sessions.find((item) => item.id === entry.sessionId);
        if (!session || session.status !== "published") return;
        const existing = merged.bookings.find(
          (booking) => booking.sessionId === entry.sessionId && booking.studentId === entry.studentId
        );
        if (existing) {
          if (existing.status !== "booked") {
            existing.status = "booked";
            delete existing.cancelledAt;
            delete existing.cancelledBy;
            delete existing.cancelReason;
          }
          return;
        }
        merged.bookings.push({
          id: entry.id,
          sessionId: entry.sessionId,
          studentId: entry.studentId,
          status: "booked",
          source: "student",
          createdAt: nowIso(),
          enrollmentId: null
        });
      });
      merged.demoSessionsAlignedOn = todayKey;
    }

    /* 新增材料与课件上线后按 id 补齐：老快照不必重置也能在学习页看到它们。 */
    const backfillRefIds = [
      "ref-friends-preview",
      "ref-time-courseware",
      "ref-time-review-sheet",
      "ref-time-review-audio"
    ];
    backfillRefIds.forEach((refId) => {
      const ref = (seeded.materialRefs || []).find((item) => item.id === refId);
      if (!ref) return;
      const material = (seeded.materials || []).find((item) => item.id === ref.materialId);
      if (material) {
        const existing = merged.materials.find((item) => item.id === material.id);
        if (!existing) {
          merged.materials.push(clone(material));
        } else if (material.kind === "courseware" && existing.kind !== "courseware") {
          existing.title = material.title;
          existing.description = material.description;
          existing.kind = material.kind;
          existing.fileType = material.fileType;
          existing.versions = clone(material.versions);
        }
      }
      if (!merged.materialRefs.some((item) => item.id === ref.id)) {
        merged.materialRefs.push(clone(ref));
      }
    });
    return merged;
  }

  function applyLegacyState(loaded) {
    try {
      const raw = global.localStorage.getItem(LEGACY_KEY);
      if (!raw) return loaded;
      const legacy = JSON.parse(raw);
      if (!legacy || (!legacy.task1Done && !legacy.task2Done)) return loaded;
      const studentId = "student-anisa";
      if (legacy.task1Done && !loaded.interactionAttempts.some((item) => item.id === "legacy-task-1")) {
        loaded.interactionAttempts.push({
          id: "legacy-task-1",
          setId: "set-greetings-live",
          versionId: "ver-greetings-live-1",
          studentId,
          sessionId: "session-live",
          phase: "live",
          score: 100,
          bestScore: 100,
          attempt: 1,
          timeSpentSeconds: 80,
          completedAt: nowIso(),
          answers: {},
          wrongItemIds: [],
          pollAnswers: {}
        });
      }
      if (legacy.task2Done && !loaded.interactionAttempts.some((item) => item.id === "legacy-task-2")) {
        loaded.interactionAttempts.push({
          id: "legacy-task-2",
          setId: "set-greetings-live",
          versionId: "ver-greetings-live-1",
          studentId,
          sessionId: "session-live",
          phase: "live",
          score: 100,
          bestScore: 100,
          attempt: 2,
          timeSpentSeconds: 110,
          completedAt: nowIso(),
          answers: {},
          wrongItemIds: [],
          pollAnswers: {}
        });
      }
      return loaded;
    } catch (error) {
      return loaded;
    }
  }

  function loadState() {
    try {
      const raw = global.localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 2) return normalize(parsed);
      }
    } catch (error) {
      console.warn("Unable to read demo state, loading seed data", error);
    }
    return applyLegacyState(normalize(seedFactory.createSeedData()));
  }

  function getState() {
    if (!state) state = loadState();
    return clone(state);
  }

  function subscribe(listener) {
    if (!state) state = loadState();
    listeners.add(listener);
    const onCustom = () => listener(clone(state), "custom");
    const onStorage = (event) => {
      if (event.key === STORE_KEY && event.newValue) {
        try {
          state = normalize(JSON.parse(event.newValue));
          listener(clone(state), "storage");
        } catch (error) {
          console.warn("Unable to sync demo state", error);
        }
      }
    };
    global.addEventListener(CHANGE_EVENT, onCustom);
    global.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      global.removeEventListener(CHANGE_EVENT, onCustom);
      global.removeEventListener("storage", onStorage);
    };
  }

  function addNotification(draft, notification) {
    draft.notifications.unshift({
      id: makeId("notice"),
      read: false,
      createdAt: nowIso(),
      ...notification
    });
  }

  function addAudit(draft, event) {
    draft.auditEvents.unshift({
      id: makeId("audit"),
      createdAt: nowIso(),
      reason: "",
      ...event,
      schoolId: event.schoolId !== undefined ? event.schoolId : resolveAuditSchoolId(draft, event)
    });
  }

  function getUser(draft, userId) {
    return draft.users.find((user) => user.id === userId);
  }

  function getSession(draft, sessionId) {
    return draft.sessions.find((session) => session.id === sessionId);
  }

  function getClass(draft, classId) {
    return draft.classes.find((item) => item.id === classId);
  }

  function activeAcademicSchoolId(draft, userId) {
    const membership = draft.schoolMemberships.find(
      (item) => item.userId === userId && item.role === "academic" && item.status === "active"
    );
    return membership?.schoolId || "";
  }

  function schoolIdForSession(draft, sessionId) {
    const session = getSession(draft, sessionId);
    return session?.schoolId || getClass(draft, session?.classId)?.schoolId || "";
  }

  function schoolIdForBooking(draft, bookingId) {
    const booking = draft.bookings.find((item) => item.id === bookingId);
    return booking ? schoolIdForSession(draft, booking.sessionId) : "";
  }

  function schoolIdForChangeRequest(draft, requestId) {
    const request = draft.changeRequests.find((item) => item.id === requestId);
    return request ? schoolIdForSession(draft, request.sessionId) : "";
  }

  function studentBelongsToSchool(draft, studentId, schoolId) {
    if (!studentId || !schoolId) return false;
    return draft.schoolMemberships.some(
      (item) => item.schoolId === schoolId && item.userId === studentId && item.role === "student" && item.status === "active"
    );
  }

  function ensureSchoolMembership(draft, schoolId, userId, role, joinedAt = nowIso()) {
    if (!schoolId || !userId) return null;
    let membership = draft.schoolMemberships.find(
      (item) => item.schoolId === schoolId && item.userId === userId && item.role === role
    );
    if (membership) {
      membership.status = "active";
      delete membership.leftAt;
      return membership;
    }
    membership = {
      id: makeId("school-membership"),
      schoolId,
      userId,
      role,
      status: "active",
      joinedAt
    };
    draft.schoolMemberships.push(membership);
    return membership;
  }

  function resolveAuditSchoolId(draft, event) {
    if (event.targetType === "session" || event.targetType === "booking") return schoolIdForSession(draft, event.targetId) || schoolIdForBooking(draft, event.targetId);
    if (event.targetType === "class") return getClass(draft, event.targetId)?.schoolId || "";
    if (event.targetType === "series") return draft.series.find((item) => item.id === event.targetId)?.schoolId || "";
    if (event.targetType === "assessment") return draft.assessments.find((item) => item.id === event.targetId)?.schoolId || "";
    if (event.targetType === "grade_policy") {
      const policy = draft.gradePolicies.find((item) => item.id === event.targetId);
      return policy?.schoolId || "";
    }
    if (event.targetType === "student") {
      const profile = draft.students.find((item) => item.userId === event.targetId);
      return getClass(draft, profile?.primaryClassId)?.schoolId ||
        draft.schoolMemberships.find((item) => item.userId === event.targetId && item.role === "student" && item.status === "active")?.schoolId ||
        activeAcademicSchoolId(draft, event.actorId) ||
        "";
    }
    if (event.targetType === "school") return event.targetId || "";
    return "";
  }

  function getStudentBookings(draft, studentId) {
    return draft.bookings.filter((booking) => booking.studentId === studentId && booking.status === "booked");
  }

  function ensureClassEnrollment(draft, classId, studentId, source = "booking", joinedAt = nowIso()) {
    if (!classId) return null;
    let enrollment = draft.classEnrollments.find((item) => item.classId === classId && item.studentId === studentId);
    if (enrollment) {
      if (enrollment.status !== "active") {
        enrollment.status = "active";
        enrollment.joinedAt = joinedAt;
        delete enrollment.leftAt;
      }
      return enrollment;
    }
    enrollment = {
      id: makeId("class-enrollment"),
      classId,
      studentId,
      status: "active",
      joinedAt,
      source
    };
    draft.classEnrollments.push(enrollment);
    return enrollment;
  }

  function activeClassStudents(draft, classId) {
    return draft.classEnrollments
      .filter((item) => item.classId === classId && item.status === "active")
      .map((item) => item.studentId);
  }

  function buildSessionRoster(draft, classId, source = "snapshot") {
    const addedAt = nowIso();
    return activeClassStudents(draft, classId).map((studentId) => ({ studentId, source, addedAt }));
  }

  function sessionRosterFrozen(session) {
    return new Date(session.startAt).getTime() <= Date.now();
  }

  function bookedCount(draft, sessionId) {
    return draft.bookings.filter((booking) => booking.sessionId === sessionId && booking.status === "booked").length;
  }

  function overlaps(aStart, aEnd, bStart, bEnd) {
    return new Date(aStart).getTime() < new Date(bEnd).getTime() && new Date(bStart).getTime() < new Date(aEnd).getTime();
  }

  function studentHasConflict(draft, studentId, session) {
    return getStudentBookings(draft, studentId).some((booking) => {
      if (booking.sessionId === session.id) return false;
      const existing = getSession(draft, booking.sessionId);
      return existing && overlaps(session.startAt, session.endAt, existing.startAt, existing.endAt);
    });
  }

  function teacherHasConflict(draft, teacherId, session, ignoreSessionId) {
    return draft.sessions.some((existing) => {
      if (existing.id === ignoreSessionId) return false;
      if (existing.teacherId !== teacherId) return false;
      if (existing.status === "cancelled") return false;
      return overlaps(session.startAt, session.endAt, existing.startAt, existing.endAt);
    });
  }

  function prepareAutomaticPromotions(draft, sessionId) {
    const session = getSession(draft, sessionId);
    if (!session) return;
    const openSeats = Math.max(0, session.capacity - bookedCount(draft, sessionId));
    if (openSeats <= 0) return;

    const candidates = draft.waitlist
      .filter((entry) => entry.status === "waiting" && (entry.sessionId === sessionId || (entry.sessionIds || []).includes(sessionId)))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const candidate of candidates) {
      if (bookedCount(draft, sessionId) >= session.capacity) break;
      if (candidate.sessionIds && candidate.sessionIds.length > 0) {
        const allAvailable = candidate.sessionIds.every((id) => {
          const current = getSession(draft, id);
          return current && current.status !== "cancelled" && bookedCount(draft, id) < current.capacity;
        });
        if (!allAvailable) continue;
        const enrollmentId = candidate.enrollmentId || makeId("enrollment");
        candidate.sessionIds.forEach((id) => {
          const targetSession = getSession(draft, id);
          draft.bookings.push({
            id: makeId("booking"),
            sessionId: id,
            studentId: candidate.studentId,
            status: "booked",
            source: "waitlist",
            createdAt: nowIso(),
            enrollmentId
          });
          if (targetSession) {
            ensureSchoolMembership(draft, targetSession.schoolId, candidate.studentId, "student", nowIso());
            ensureClassEnrollment(draft, targetSession.classId, candidate.studentId, "booking", nowIso());
          }
        });
      } else {
        ensureSchoolMembership(draft, session.schoolId, candidate.studentId, "student", nowIso());
        ensureClassEnrollment(draft, session.classId, candidate.studentId, "booking", nowIso());
        draft.bookings.push({
          id: makeId("booking"),
          sessionId,
          studentId: candidate.studentId,
          status: "booked",
          source: "waitlist",
          createdAt: nowIso(),
          enrollmentId: candidate.enrollmentId || null
        });
      }
      candidate.status = "promoted";
      candidate.promotedAt = nowIso();
      addNotification(draft, {
        userId: candidate.studentId,
        type: "waitlist_promoted",
        title: "候补转正",
        body: `你已成功候补到“${session.title}”，请查看最新课表。`,
        link: "/student/schedule"
      });
      addAudit(draft, {
        actorId: "system",
        action: "waitlist_promoted",
        targetType: "session",
        targetId: sessionId,
        summary: `候补学生 ${candidate.studentId} 自动转正`
      });
    }
  }

  function setCurrentUser(userId) {
    const found = getState().users.find((user) => user.id === userId);
    if (!found) return result(false, null, "找不到演示账号", "USER_NOT_FOUND");
    return save((draft) => {
      draft.currentUserId = userId;
      draft.ui.timeZone = found.timeZone || draft.ui.timeZone;
      draft.ui.language = found.locale === "id-ID" ? "id-ID" : "zh-CN";
      return found;
    }, "current-user");
  }

  function createSchool({ name, code, timeZone = "Asia/Jakarta", actorId }) {
    return save((draft) => {
      const schoolName = String(name || "").trim();
      const schoolCode = String(code || "").trim().toUpperCase();
      if (!schoolName || !schoolCode) return result(false, null, "学校名称和编码不能为空", "INVALID_SCHOOL");
      if (draft.schools.some((item) => item.code === schoolCode)) return result(false, null, "学校编码已存在", "SCHOOL_CODE_EXISTS");
      const school = { id: makeId("school"), name: schoolName, code: schoolCode, timeZone: String(timeZone || "Asia/Jakarta"), status: "active", createdAt: nowIso() };
      draft.schools.push(school);
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "create_school",
        targetType: "school",
        targetId: school.id,
        summary: `创建学校“${school.name}”`
      });
      return result(true, school);
    }, "school");
  }

  function createSchoolStaff({ schoolId, role, name, phone = "", note = "", timeZone, actorId }) {
    return save((draft) => {
      const school = draft.schools.find((item) => item.id === schoolId);
      if (!school) return result(false, null, "学校不存在", "NOT_FOUND");
      if (school.status !== "active") return result(false, null, "归档学校不能新增教职工", "SCHOOL_ARCHIVED");
      if (!["academic", "teacher"].includes(role)) return result(false, null, "教职工角色不正确", "INVALID_ROLE");
      const displayName = String(name || "").trim();
      const normalizedPhone = String(phone || "").trim();
      if (!displayName || !normalizedPhone) return result(false, null, "姓名和手机号不能为空", "INVALID_STAFF");
      if (draft.users.some((user) => String(user.phone || "").replace(/\s+/g, "") === normalizedPhone.replace(/\s+/g, ""))) {
        return result(false, null, "该手机号已存在账号", "PHONE_EXISTS");
      }
      const user = {
        id: makeId(role),
        role,
        name: displayName,
        phone: normalizedPhone,
        avatar: displayName.slice(0, 2),
        timeZone: String(timeZone || school.timeZone || "Asia/Jakarta"),
        locale: "id-ID",
        status: "active",
        bio: String(note || "").trim(),
        title: role === "academic" ? `${school.name}教务` : undefined
      };
      const membership = {
        id: makeId("school-membership"),
        schoolId,
        userId: user.id,
        role,
        status: "active",
        joinedAt: nowIso()
      };
      draft.users.push(user);
      draft.schoolMemberships.push(membership);
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "create_school_staff",
        targetType: "school",
        targetId: schoolId,
        summary: `为“${school.name}”新增${role === "academic" ? "教务" : "教师"}“${user.name}”`
      });
      return result(true, { user, membership });
    }, "school-staff");
  }

  function updateSchool({ schoolId, patch, actorId }) {
    return save((draft) => {
      const school = draft.schools.find((item) => item.id === schoolId);
      if (!school) return result(false, null, "学校不存在", "NOT_FOUND");
      if (patch.code) {
        const code = String(patch.code).trim().toUpperCase();
        if (draft.schools.some((item) => item.id !== schoolId && item.code === code)) {
          return result(false, null, "学校编码已存在", "SCHOOL_CODE_EXISTS");
        }
        patch = { ...patch, code };
      }
      Object.assign(school, patch);
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "update_school",
        targetType: "school",
        targetId: school.id,
        summary: `更新学校“${school.name}”`
      });
      return result(true, school);
    }, "school");
  }

  function deleteSchool({ schoolId, actorId }) {
    return save((draft) => {
      const schoolIndex = draft.schools.findIndex((item) => item.id === schoolId);
      const school = draft.schools[schoolIndex];
      if (!school) return result(false, null, "学校不存在", "NOT_FOUND");
      const hasMemberships = draft.schoolMemberships.some((item) => item.schoolId === schoolId);
      const hasClasses = draft.classes.some((item) => item.schoolId === schoolId);
      const hasSessions = draft.sessions.some((item) => item.schoolId === schoolId);
      const hasSeries = draft.series.some((item) => item.schoolId === schoolId);
      const hasAssessments = draft.assessments.some((item) => item.schoolId === schoolId);
      const hasGradePolicies = draft.gradePolicies.some((item) => item.schoolId === schoolId);
      if (hasMemberships || hasClasses || hasSessions || hasSeries || hasAssessments || hasGradePolicies) {
        return result(false, null, "学校已有成员、班级、课次或历史记录，只能停用", "SCHOOL_IN_USE");
      }
      draft.schools.splice(schoolIndex, 1);
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "delete_school",
        targetType: "school",
        targetId: school.id,
        summary: `删除空学校“${school.name}”`
      });
      return result(true, school);
    }, "school");
  }

  function saveSchoolMembership({ schoolId, userId, role, status = "active", actorId }) {
    return save((draft) => {
      const school = draft.schools.find((item) => item.id === schoolId);
      const user = getUser(draft, userId);
      if (!school) return result(false, null, "学校不存在", "NOT_FOUND");
      if (!user) return result(false, null, "用户不存在", "USER_NOT_FOUND");
      if (!["student", "teacher", "academic"].includes(role)) return result(false, null, "成员角色不正确", "INVALID_ROLE");
      if (user.role !== role) return result(false, null, "成员角色与账号角色不一致", "INVALID_ROLE");
      if (role === "teacher" && status === "left") {
        const linkedClassCount = draft.classes.filter(
          (item) => item.schoolId === schoolId && item.teacherId === userId && item.status === "active"
        ).length;
        if (linkedClassCount > 0) {
          return result(false, null, `该教师仍关联 ${linkedClassCount} 个进行中班级，请先解除班级关联`, "TEACHER_HAS_CLASSES");
        }
      }
      let membership = draft.schoolMemberships.find(
        (item) => item.schoolId === schoolId && item.userId === userId && item.role === role
      );
      if (role === "academic" && status === "active") {
        draft.schoolMemberships
          .filter((item) => item.userId === userId && item.role === "academic" && item.id !== membership?.id)
          .forEach((item) => { item.status = "left"; item.leftAt = nowIso(); });
      }
      if (!membership) {
        membership = { id: makeId("school-membership"), schoolId, userId, role, status, joinedAt: nowIso() };
        draft.schoolMemberships.push(membership);
      } else {
        membership.status = status;
        if (status === "left") membership.leftAt = nowIso();
        else delete membership.leftAt;
      }
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: status === "active" ? "add_school_member" : "remove_school_member",
        targetType: "school",
        targetId: schoolId,
        summary: `${status === "active" ? "加入" : "移出"}“${school.name}”：${user.name}`
      });
      return result(true, membership);
    }, "school-membership");
  }

  function reviewBooking({ bookingId, decision, reason, actorId }) {
    return save((draft) => {
      const booking = draft.bookings.find((item) => item.id === bookingId);
      const session = booking ? getSession(draft, booking.sessionId) : null;
      if (!booking || !session) return result(false, null, "报名记录不存在", "NOT_FOUND");
      if (booking.status !== "pending_review") return result(false, null, "该报名当前不需要审核", "INVALID_BOOKING_STATUS");
      if (decision === "reject") {
        booking.status = "cancelled";
        booking.cancelledAt = nowIso();
        booking.cancelledBy = actorId || draft.currentUserId;
        booking.cancelReason = reason || "报名未通过审核";
        booking.reviewedBy = actorId || draft.currentUserId;
        booking.reviewedAt = nowIso();
        booking.reviewNote = reason || "";
        addNotification(draft, {
          userId: booking.studentId,
          type: "booking_rejected",
          title: "报名未通过",
          body: `“${session.title}”报名未通过${reason ? `：${reason}` : "。"}`,
          link: "/student/schedule"
        });
        addAudit(draft, {
          actorId: actorId || draft.currentUserId,
          action: "reject_booking",
          targetType: "booking",
          targetId: booking.id,
          summary: `驳回“${session.title}”报名`,
          reason
        });
        return result(true, booking);
      }
      if (bookedCount(draft, booking.sessionId) >= session.capacity) {
        return result(false, null, "课堂已满，无法通过报名", "SESSION_FULL");
      }
      booking.status = "booked";
      booking.reviewedBy = actorId || draft.currentUserId;
      booking.reviewedAt = nowIso();
      booking.reviewNote = reason || "";
      ensureSchoolMembership(draft, session.schoolId, booking.studentId, "student", nowIso());
      booking.enrollmentId = ensureClassEnrollment(draft, session.classId, booking.studentId, "manual", nowIso())?.id || booking.enrollmentId;
      addNotification(draft, {
        userId: booking.studentId,
        type: "booking_approved",
        title: "报名已通过",
        body: `你已成功加入“${session.title}”，请按时上课。`,
        link: `/student/lesson/${session.lessonId}?phase=preview&sessionId=${session.id}`
      });
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "approve_booking",
        targetType: "booking",
        targetId: booking.id,
        summary: `通过“${session.title}”报名`,
        reason
      });
      return result(true, booking);
    }, "booking-review");
  }

  function updatePreferences({ language, timeZone, sidebarCollapsed }) {
    return save((draft) => {
      if (language) draft.ui.language = language;
      if (timeZone) draft.ui.timeZone = timeZone;
      if (typeof sidebarCollapsed === "boolean") draft.ui.sidebarCollapsed = sidebarCollapsed;
      const current = getUser(draft, draft.currentUserId);
      if (current && timeZone) current.timeZone = timeZone;
      return draft.ui;
    }, "preferences");
  }

  function bookSession({ studentId, sessionId, force = false, reason = "", source = "student", actorId = studentId }) {
    return save((draft) => {
      const session = getSession(draft, sessionId);
      const student = getUser(draft, studentId);
      const actor = getUser(draft, actorId);
      if (!session || !student) return result(false, null, "班次或学生不存在", "NOT_FOUND");
      const bookingSource = actor?.role === "academic" ? "academic" : source;
      if (session.status !== "published") return result(false, null, "该班次当前不可预约", "SESSION_CLOSED");
      const existing = draft.bookings.find(
        (booking) => booking.sessionId === sessionId &&
          booking.studentId === studentId &&
          (booking.status === "booked" || booking.status === "pending_review")
      );
      if (existing) {
        const pendingReview = existing.status === "pending_review";
        return result(
          false,
          existing,
          pendingReview ? "报名已提交，等待教学管理审核" : "你已经预约该班次",
          pendingReview ? "ALREADY_PENDING_REVIEW" : "ALREADY_BOOKED"
        );
      }
      const waiting = draft.waitlist.find((entry) => entry.studentId === studentId && (entry.sessionId === sessionId || (entry.sessionIds || []).includes(sessionId)) && entry.status === "waiting");
      if (waiting) return result(false, waiting, "你已在候补队列中", "ALREADY_WAITLISTED");
      if (new Date(session.bookingCloseAt).getTime() < Date.now() && !force) {
        return result(false, null, "已超过预约截止时间", "BOOKING_CLOSED");
      }
      if (studentHasConflict(draft, studentId, session) && !force) {
        return result(false, null, "该时间与已有课程冲突", "STUDENT_CONFLICT");
      }
      if (bookedCount(draft, sessionId) >= session.capacity && !force) {
        return result(false, null, "该班次已满，可加入候补", "SESSION_FULL");
      }
      if (force && !reason.trim()) {
        return result(false, null, "强制预约必须填写原因", "REASON_REQUIRED");
      }
      // 学生报名需审核的课次时先进入待审核；教学管理代约或强制预约则直接生效。
      const pendingReview = Boolean(session.approvalRequired) && !force && bookingSource === "student";
      const booking = {
        id: makeId("booking"),
        sessionId,
        studentId,
        status: pendingReview ? "pending_review" : "booked",
        source: bookingSource,
        createdAt: nowIso(),
        enrollmentId: null
      };
      draft.bookings.push(booking);
      if (!pendingReview) {
        ensureSchoolMembership(draft, session.schoolId, studentId, "student", booking.createdAt);
        ensureClassEnrollment(draft, session.classId, studentId, bookingSource === "student" ? "booking" : "manual", booking.createdAt);
      }
      if (pendingReview) {
        addNotification(draft, {
          userId: studentId,
          type: "booking_pending_review",
          title: "报名已提交",
          body: `已提交“${session.title}”报名，等待学校教务审核确认后即可加入班级。`,
          link: "/student/schedule"
        });
        draft.schoolMemberships
          .filter((item) => item.schoolId === session.schoolId && item.role === "academic" && item.status === "active")
          .forEach((membership) => addNotification(draft, {
            userId: membership.userId,
            type: "academic_booking_review",
            title: "有新的报名待审核",
            body: `${getUser(draft, studentId)?.name || "学生"}申请报名“${session.title}”。`,
            link: "/academic" + "/students"
          }));
      } else {
        addNotification(draft, {
          userId: studentId,
          type: "booking_confirmed",
          title: "预约成功",
          body: `已预约“${session.title}”，预习内容现在可以查看。`,
          link: `/student/lesson/${session.lessonId}?phase=preview&sessionId=${session.id}`
        });
      }
      addAudit(draft, {
        actorId,
        action: pendingReview ? "booking_pending_review" : (force ? "proxy_booking_override" : (bookingSource !== "student" ? "proxy_booking" : "booking_created")),
        targetType: "session",
        targetId: sessionId,
        summary: pendingReview
          ? `提交“${session.title}”报名审核`
          : `${bookingSource !== "student" ? "代" : ""}预约“${session.title}”`,
        reason
      });
      return result(true, booking);
    }, "booking");
  }

  function joinWaitlist({ studentId, sessionId, seriesId = null, sessionIds = [] }) {
    return save((draft) => {
      const session = getSession(draft, sessionId);
      if (!session) return result(false, null, "班次不存在", "NOT_FOUND");
      const exists = draft.waitlist.some((entry) => entry.studentId === studentId && entry.status === "waiting" && (entry.sessionId === sessionId || (entry.sessionIds || []).includes(sessionId)));
      if (exists) return result(false, null, "你已在候补队列中", "ALREADY_WAITLISTED");
      const bookingExists = draft.bookings.find(
        (booking) => booking.studentId === studentId &&
          booking.sessionId === sessionId &&
          (booking.status === "booked" || booking.status === "pending_review")
      );
      if (bookingExists) {
        const pendingReview = bookingExists.status === "pending_review";
        return result(
          false,
          bookingExists,
          pendingReview ? "报名正在审核，暂时无法加入候补" : "你已经预约该班次",
          pendingReview ? "ALREADY_PENDING_REVIEW" : "ALREADY_BOOKED"
        );
      }
      const entry = {
        id: makeId("wait"),
        sessionId: sessionIds.length > 1 ? null : sessionId,
        sessionIds,
        seriesId,
        studentId,
        status: "waiting",
        createdAt: nowIso(),
        enrollmentId: seriesId ? makeId("enrollment") : null
      };
      draft.waitlist.push(entry);
      addNotification(draft, {
        userId: studentId,
        type: "waitlist_joined",
        title: "已加入候补",
        body: seriesId ? "系列班已整套加入候补，有名额时会自动转正。" : `你已加入“${session.title}”候补队列。`,
        link: "/student/schedule"
      });
      return result(true, entry);
    }, "waitlist");
  }

  function leaveWaitlist({ waitlistId, actorId = "", reason = "" }) {
    return save((draft) => {
      const entry = draft.waitlist.find((item) => item.id === waitlistId);
      if (!entry) return result(false, null, "候补记录不存在", "NOT_FOUND");
      entry.status = "cancelled";
      entry.cancelledAt = nowIso();
      addAudit(draft, {
        actorId: actorId || entry.studentId,
        action: "waitlist_cancelled",
        targetType: "waitlist",
        targetId: waitlistId,
        summary: "退出候补队列",
        reason
      });
      return result(true, entry);
    }, "waitlist");
  }

  function cancelBooking({ bookingId, actorId = "", force = false, reason = "" }) {
    return save((draft) => {
      const booking = draft.bookings.find((item) => item.id === bookingId);
      if (!booking) return result(false, null, "预约不存在", "NOT_FOUND");
      const session = getSession(draft, booking.sessionId);
      if (!session) return result(false, null, "班次不存在", "NOT_FOUND");
      if (!force && new Date(session.cancelCloseAt).getTime() < Date.now()) {
        return result(false, null, "已超过学生自主取消截止时间，请联系教学管理", "CANCEL_CLOSED");
      }
      const affected = booking.enrollmentId
        ? draft.bookings.filter((item) => item.enrollmentId === booking.enrollmentId && item.status === "booked")
        : [booking];
      affected.forEach((item) => {
        item.status = "cancelled";
        item.cancelledAt = nowIso();
        item.cancelledBy = actorId || booking.studentId;
        item.cancelReason = reason;
      });
      affected.forEach((item) => prepareAutomaticPromotions(draft, item.sessionId));
      addNotification(draft, {
        userId: booking.studentId,
        type: "booking_cancelled",
        title: booking.enrollmentId ? "系列班已取消" : "预约已取消",
        body: booking.enrollmentId ? "整套系列班预约已取消，名额已释放。" : `“${session.title}”的预约已取消。`,
        link: "/student/schedule"
      });
      addAudit(draft, {
        actorId: actorId || booking.studentId,
        action: force ? "booking_force_cancelled" : "booking_cancelled",
        targetType: "booking",
        targetId: booking.id,
        summary: `取消“${session.title}”预约`,
        reason
      });
      return result(true, affected);
    }, "booking");
  }

  function enrollSeries({ studentId, seriesId, joinAsWaitlist = false, force = false, reason = "", actorId = studentId }) {
    return save((draft) => {
      const series = draft.series.find((item) => item.id === seriesId);
      if (!series) return result(false, null, "系列班不存在", "NOT_FOUND");
      const sessions = series.sessionIds.map((id) => getSession(draft, id)).filter(Boolean);
      if (sessions.length !== series.sessionIds.length) return result(false, null, "系列班课次不完整", "INVALID_SERIES");
      const existing = draft.bookings.some((booking) => booking.studentId === studentId && series.sessionIds.includes(booking.sessionId) && booking.status === "booked");
      if (existing) return result(false, null, "你已报名该系列班", "ALREADY_ENROLLED");
      const full = sessions.some((session) => bookedCount(draft, session.id) >= session.capacity);
      const conflict = sessions.some((session) => studentHasConflict(draft, studentId, session));
      if (conflict && !force) return result(false, null, "系列班中有课次与你的现有课程冲突", "STUDENT_CONFLICT");
      if (full || joinAsWaitlist) {
        if (!joinAsWaitlist) return result(false, null, "系列班中有课次已满，可整套加入候补", "SERIES_FULL");
        const enrollmentId = makeId("enrollment");
        const entry = {
          id: makeId("wait"),
          sessionId: null,
          sessionIds: [...series.sessionIds],
          seriesId,
          studentId,
          status: "waiting",
          createdAt: nowIso(),
          enrollmentId
        };
        draft.waitlist.push(entry);
        addNotification(draft, {
          userId: studentId,
          type: "waitlist_joined",
          title: "系列班已加入候补",
          body: `“${series.title}”已整套加入候补，有名额时自动转正。`,
          link: "/student/schedule"
        });
        return result(true, entry);
      }
      if (force && !reason.trim()) return result(false, null, "强制报名必须填写原因", "REASON_REQUIRED");
      const enrollmentId = makeId("enrollment");
      const created = sessions.map((session) => ({
        id: makeId("booking"),
        sessionId: session.id,
        studentId,
        status: "booked",
        source: actorId === studentId ? "student" : "operator",
        createdAt: nowIso(),
        enrollmentId
      }));
      draft.bookings.push(...created);
      sessions.forEach((session) => ensureSchoolMembership(draft, session.schoolId, studentId, "student", nowIso()));
      addNotification(draft, {
        userId: studentId,
        type: "series_enrolled",
        title: "系列班报名成功",
        body: `“${series.title}”的 ${created.length} 次课程已全部加入课表。`,
        link: "/student/schedule"
      });
      addAudit(draft, {
        actorId,
        action: force ? "series_force_enrolled" : "series_enrolled",
        targetType: "series",
        targetId: seriesId,
        summary: `报名“${series.title}”`,
        reason
      });
      return result(true, created);
    }, "series-enrollment");
  }

  function createSession(payload) {
    return save((draft) => {
      const actor = getUser(draft, payload.actorId || draft.currentUserId);
      const requestedSchoolId = payload.schoolId || (actor?.role === "academic" ? activeAcademicSchoolId(draft, actor.id) : "");
      const lesson = draft.lessons.find((item) => item.id === payload.lessonId);
      if (!lesson) return result(false, null, "课节不存在", "NOT_FOUND");
      if (lesson.status !== "published") return result(false, null, "仅可选择已发布课节", "LESSON_UNAVAILABLE");
      const course = draft.folders.find((item) => item.id === lesson.folderId);
      if (!course || course.status !== "published") return result(false, null, "所属课程尚未发布", "COURSE_UNAVAILABLE");
      let classGroup = payload.classId
        ? draft.classes.find((item) => item.id === payload.classId)
        : draft.classes.find((item) => item.name === (payload.className || "待分配班级") && (!requestedSchoolId || item.schoolId === requestedSchoolId));
      const schoolId = classGroup?.schoolId || requestedSchoolId || "school-demo";
      if (!classGroup) {
        classGroup = {
          id: makeId("class"),
          schoolId,
          name: payload.className || "待分配班级",
          teacherId: payload.teacherId,
          status: "active",
          createdAt: nowIso()
        };
        draft.classes.push(classGroup);
      }
      ensureSchoolMembership(draft, schoolId, payload.teacherId, "teacher");
      const session = {
        id: makeId("session"),
        status: "published",
        language: "zh-id",
        roomLabel: "大班教室",
        className: classGroup.name,
        classId: classGroup.id,
        source: "single",
        seriesId: null,
        schoolId,
        title: payload.title || "未命名大班课",
        capacity: Number(payload.capacity) || 30,
        ...payload,
        startAt: new Date(payload.startAt).toISOString(),
        endAt: new Date(payload.endAt).toISOString()
      };
      session.roster = buildSessionRoster(draft, classGroup.id);
      if (teacherHasConflict(draft, session.teacherId, session)) {
        return result(false, null, "教师在该时间段已有其他课程", "TEACHER_CONFLICT");
      }
      draft.sessions.push(session);
      addAudit(draft, {
        actorId: payload.actorId || draft.currentUserId,
        action: "create_session",
        targetType: "session",
        targetId: session.id,
        summary: `创建“${session.title}”`,
        reason: payload.reason || ""
      });
      return result(true, session);
    }, "session");
  }

  function createSeries(payload) {
    return save((draft) => {
      /* 系列班 = 同一课程下按顺序排列的多个课节。
         每个课节生成一个课次，课次之间默认间隔 N 周。 */
      const rawLessonIds = Array.isArray(payload.lessonIds) && payload.lessonIds.length
        ? payload.lessonIds
        : payload.lessonId
          ? [payload.lessonId]
          : [];
      const lessonIds = [...new Set(rawLessonIds.filter(Boolean))];
      if (lessonIds.length < 2) {
        return result(false, null, "系列班至少包含两个课节", "SERIES_MIN_LESSONS");
      }
      const lessons = lessonIds.map((lessonId) => draft.lessons.find((lesson) => lesson.id === lessonId));
      if (lessons.some((lesson) => !lesson)) {
        return result(false, null, "系列班包含不存在的课节", "LESSON_NOT_FOUND");
      }
      const folderId = lessons[0].folderId;
      if (lessons.some((lesson) => lesson.folderId !== folderId)) {
        return result(false, null, "系列班的课节必须来自同一课程", "LESSON_THEME_MISMATCH");
      }
      const course = draft.folders.find((item) => item.id === folderId);
      if (!course || course.status !== "published") {
        return result(false, null, "仅可选择已发布课程", "COURSE_UNAVAILABLE");
      }
      if (lessons.some((lesson) => lesson.status !== "published")) {
        return result(false, null, "系列班只能选择已发布课节", "LESSON_UNAVAILABLE");
      }
      if (payload.folderId && payload.folderId !== folderId) {
        return result(false, null, "系列主题与所选课节不一致", "LESSON_THEME_MISMATCH");
      }

      const actor = getUser(draft, payload.actorId || draft.currentUserId);
      const requestedSchoolId = payload.schoolId || (actor?.role === "academic" ? activeAcademicSchoolId(draft, actor.id) : "");
      const existingScopedClass = payload.classId ? getClass(draft, payload.classId) : null;
      const schoolId = existingScopedClass?.schoolId || requestedSchoolId || "school-demo";
      ensureSchoolMembership(draft, schoolId, payload.teacherId, "teacher");

      const start = new Date(payload.startAt);
      const intervalWeeks = Math.max(1, Number(payload.intervalWeeks) || 1);
      const durationMinutes = Number(payload.durationMinutes) || 40;
      const capacity = Number(payload.capacity) || 30;

      // 逐节课次时间：AI/表单可以先预排，人工再调整；缺失的课节回落到自动排期。
      const scheduleByLesson = new Map(
        (Array.isArray(payload.sessionSchedule) ? payload.sessionSchedule : [])
          .filter((item) => item && item.lessonId && item.startAt)
          .map((item) => [item.lessonId, item.startAt])
      );
      const invalidSchedule = [...scheduleByLesson.values()].find((value) => Number.isNaN(new Date(value).getTime()));
      if (invalidSchedule) {
        return result(false, null, "课次时间格式不正确", "INVALID_SCHEDULE");
      }

      const existingClass = payload.classId
        ? draft.classes.find((item) => item.id === payload.classId)
        : draft.classes.find((item) => item.name === (payload.className || "待分配班级") && item.schoolId === schoolId);
      const resolvedClassName = existingClass?.name || payload.className || "待分配班级";

      // 先把课次全部建好并检查冲突，再统一写入，避免创建到一半失败留下半套系列班。
      const plannedSessions = lessonIds.map((lessonId, index) => {
        const autoStart = new Date(start);
        autoStart.setDate(autoStart.getDate() + index * 7 * intervalWeeks);
        const sessionStart = scheduleByLesson.has(lessonId) ? new Date(scheduleByLesson.get(lessonId)) : autoStart;
        return {
          id: makeId("series-session"),
          schoolId,
          lessonId,
          seriesId: "",
          teacherId: payload.teacherId,
          title: `${payload.title} · 第 ${index + 1} 课`,
          startAt: sessionStart.toISOString(),
          endAt: new Date(sessionStart.getTime() + durationMinutes * 60 * 1000).toISOString(),
          capacity,
          status: "published",
          bookingCloseAt: new Date(sessionStart.getTime() - 30 * 60 * 1000).toISOString(),
          cancelCloseAt: new Date(sessionStart.getTime() - 2 * 60 * 60 * 1000).toISOString(),
          language: "zh-id",
          roomLabel: payload.roomLabel || "系列教室",
          className: resolvedClassName,
          classId: existingClass?.id || "",
          source: "series"
        };
      });
      const conflictIndex = plannedSessions.findIndex((session) => teacherHasConflict(draft, session.teacherId, session));
      if (conflictIndex >= 0) {
        return result(false, null, `第 ${conflictIndex + 1} 次课与教师现有课程冲突`, "TEACHER_CONFLICT");
      }

      let classGroup = existingClass;
      if (!classGroup) {
        classGroup = {
          id: makeId("class"),
          schoolId,
          name: resolvedClassName,
          teacherId: payload.teacherId,
          status: "active",
          createdAt: nowIso()
        };
        draft.classes.push(classGroup);
      }

      const sessionIds = [];
      plannedSessions.forEach((session) => {
        session.classId = classGroup.id;
        session.className = classGroup.name;
        session.roster = buildSessionRoster(draft, classGroup.id);
        draft.sessions.push(session);
        sessionIds.push(session.id);
      });

      const series = {
        id: makeId("series"),
        schoolId,
        folderId,
        lessonIds: [...lessonIds],
        lessonId: lessonIds[0],
        title: payload.title,
        description: payload.description || "",
        teacherId: payload.teacherId,
        capacity,
        durationMinutes,
        sessionIds,
        weekdays: [],
        status: "published",
        createdAt: nowIso()
      };
      sessionIds.forEach((id) => {
        const session = getSession(draft, id);
        session.seriesId = series.id;
      });
      draft.series.push(series);
      addAudit(draft, {
        actorId: payload.actorId || draft.currentUserId,
        action: "create_series",
        targetType: "series",
        targetId: series.id,
        summary: `创建系列班“${series.title}”（${lessonIds.length} 个课节）`,
        reason: payload.reason || ""
      });
      return result(true, series);
    }, "series");
  }

  function updateSession({ sessionId, patch, actorId, reason = "" }) {
    return save((draft) => {
      const session = getSession(draft, sessionId);
      if (!session) return result(false, null, "班次不存在", "NOT_FOUND");
      const candidate = { ...session, ...patch };
      if (patch.classId || patch.className) {
        const classGroup = patch.classId
          ? draft.classes.find((item) => item.id === patch.classId)
          : draft.classes.find((item) => item.name === patch.className);
        if (!classGroup) return result(false, null, "班级不存在", "NOT_FOUND");
        if (classGroup.schoolId !== session.schoolId) return result(false, null, "课次不能跨校迁移", "OUT_OF_SCOPE");
        candidate.classId = classGroup.id;
        candidate.className = classGroup.name;
      }
      candidate.schoolId = getClass(draft, candidate.classId)?.schoolId || session.schoolId;
      ensureSchoolMembership(draft, candidate.schoolId, candidate.teacherId, "teacher");
      if (teacherHasConflict(draft, candidate.teacherId, candidate, sessionId)) {
        return result(false, null, "修改后教师时间冲突", "TEACHER_CONFLICT");
      }
      const previousClassId = session.classId;
      Object.assign(session, patch, patch.classId || patch.className ? { classId: candidate.classId, className: candidate.className } : {});
      session.schoolId = candidate.schoolId;
      if (session.classId !== previousClassId) {
        session.roster = buildSessionRoster(draft, session.classId);
      }
      if (patch.startAt) session.startAt = new Date(patch.startAt).toISOString();
      if (patch.endAt) session.endAt = new Date(patch.endAt).toISOString();
      if (patch.bookingCloseAt) session.bookingCloseAt = new Date(patch.bookingCloseAt).toISOString();
      if (patch.cancelCloseAt) session.cancelCloseAt = new Date(patch.cancelCloseAt).toISOString();
      const bookedStudents = draft.bookings.filter((booking) => booking.sessionId === sessionId && booking.status === "booked");
      bookedStudents.forEach((booking) => {
        addNotification(draft, {
          userId: booking.studentId,
          type: "session_updated",
          title: "课程信息有更新",
          body: `“${session.title}”的课程安排已更新，请重新查看时间。`,
          link: `/student/lesson/${session.lessonId}?phase=preview&sessionId=${session.id}`
        });
      });
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "update_session",
        targetType: "session",
        targetId: sessionId,
        summary: `更新“${session.title}”`,
        reason
      });
      return result(true, session);
    }, "session");
  }

  /** 同步只处理自动来源：补入新班级成员、移出已离开班级者，人工补录的学生保留。 */
  function syncSessionRoster({ sessionId, actorId }) {
    return save((draft) => {
      const session = getSession(draft, sessionId);
      if (!session) return result(false, null, "课次不存在", "NOT_FOUND");
      if (sessionRosterFrozen(session)) {
        return result(false, null, "课堂已开始，课次名单已冻结", "ROSTER_FROZEN");
      }
      const entries = Array.isArray(session.roster) ? session.roster : [];
      const activeIds = activeClassStudents(draft, session.classId);
      const activeSet = new Set(activeIds);
      const existingIds = new Set(entries.map((entry) => entry.studentId));
      const kept = entries.filter(
        (entry) => entry.source === "manual" || activeSet.has(entry.studentId)
      );
      const added = activeIds
        .filter((studentId) => !existingIds.has(studentId))
        .map((studentId) => ({ studentId, source: "sync", addedAt: nowIso() }));
      session.roster = [...kept, ...added];
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "sync_session_roster",
        targetType: "session",
        targetId: session.id,
        summary: `同步“${session.title}”的课次名单（新增 ${added.length} 人）`
      });
      return result(true, session.roster);
    }, "session-roster");
  }

  function addSessionRosterStudents({ sessionId, studentIds, actorId }) {
    return save((draft) => {
      const session = getSession(draft, sessionId);
      if (!session) return result(false, null, "课次不存在", "NOT_FOUND");
      if (sessionRosterFrozen(session)) {
        return result(false, null, "课堂已开始，课次名单已冻结", "ROSTER_FROZEN");
      }
      const requested = [...new Set((Array.isArray(studentIds) ? studentIds : []).filter(Boolean))];
      if (!requested.length) return result(false, null, "请选择要补录的学生", "EMPTY_SELECTION");
      const outsideSchool = requested.find((studentId) => !studentBelongsToSchool(draft, studentId, session.schoolId));
      if (outsideSchool) return result(false, null, "只能补录本校学生", "OUT_OF_SCOPE");
      const entries = Array.isArray(session.roster) ? session.roster : [];
      const existingIds = new Set(entries.map((entry) => entry.studentId));
      const added = requested
        .filter((studentId) => !existingIds.has(studentId))
        .map((studentId) => ({ studentId, source: "manual", addedAt: nowIso() }));
      if (!added.length) return result(false, null, "所选学生已在课次名单中", "ALREADY_IN_ROSTER");
      session.roster = [...entries, ...added];
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "add_session_roster_students",
        targetType: "session",
        targetId: session.id,
        summary: `为“${session.title}”补录 ${added.length} 名学生`
      });
      return result(true, session.roster);
    }, "session-roster");
  }

  function removeSessionRosterStudent({ sessionId, studentId, actorId }) {
    return save((draft) => {
      const session = getSession(draft, sessionId);
      if (!session) return result(false, null, "课次不存在", "NOT_FOUND");
      if (sessionRosterFrozen(session)) {
        return result(false, null, "课堂已开始，课次名单已冻结", "ROSTER_FROZEN");
      }
      const entries = Array.isArray(session.roster) ? session.roster : [];
      if (!entries.some((entry) => entry.studentId === studentId)) {
        return result(false, null, "学生不在本次课名单中", "NOT_FOUND");
      }
      session.roster = entries.filter((entry) => entry.studentId !== studentId);
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "remove_session_roster_student",
        targetType: "session",
        targetId: session.id,
        summary: `从“${session.title}”的课次名单移出 1 名学生`
      });
      return result(true, session.roster);
    }, "session-roster");
  }

  /** 系列班整组课次时间更新：任一课次冲突则整组不写入，避免留下半套时间。 */
  function updateSeriesSchedule({ seriesId, schedule, actorId, reason = "" }) {
    return save((draft) => {
      const series = draft.series.find((item) => item.id === seriesId);
      if (!series) return result(false, null, "系列班不存在", "NOT_FOUND");
      const requested = new Map(
        (Array.isArray(schedule) ? schedule : [])
          .filter((item) => item && item.sessionId)
          .map((item) => [item.sessionId, item])
      );
      if (!requested.size) return result(false, null, "请先设置课次时间", "INVALID_SCHEDULE");
      const seriesSessionIds = new Set(series.sessionIds);
      if ([...requested.keys()].some((sessionId) => !seriesSessionIds.has(sessionId))) {
        return result(false, null, "课次不属于该系列班", "OUT_OF_SCOPE");
      }

      // 按系列班自身的课次顺序解析，保证冲突提示里的“第 N 次课”与列表一致。
      const planned = [];
      for (const sessionId of series.sessionIds) {
        const patch = requested.get(sessionId);
        if (!patch) continue;
        const session = getSession(draft, sessionId);
        if (!session || session.seriesId !== series.id) {
          return result(false, null, "课次不属于该系列班", "OUT_OF_SCOPE");
        }
        const start = new Date(patch.startAt);
        if (Number.isNaN(start.getTime())) {
          return result(false, null, "课次时间格式不正确", "INVALID_SCHEDULE");
        }
        const currentDuration = Math.round(
          (new Date(session.endAt).getTime() - new Date(session.startAt).getTime()) / 60000
        );
        const durationMinutes = Math.max(1, Number(patch.durationMinutes) || currentDuration || series.durationMinutes || 40);
        planned.push({
          session,
          startAt: start.toISOString(),
          endAt: new Date(start.getTime() + durationMinutes * 60000).toISOString()
        });
      }
      if (!planned.length) return result(false, null, "没有需要更新的课次", "INVALID_SCHEDULE");

      const batchIds = new Set(planned.map((item) => item.session.id));
      const conflictIndex = planned.findIndex((candidate, index) => {
        const batchConflict = planned.some(
          (other, otherIndex) =>
            otherIndex !== index &&
            other.session.teacherId === candidate.session.teacherId &&
            overlaps(candidate.startAt, candidate.endAt, other.startAt, other.endAt)
        );
        if (batchConflict) return true;
        return draft.sessions.some(
          (existing) =>
            !batchIds.has(existing.id) &&
            existing.teacherId === candidate.session.teacherId &&
            existing.status !== "cancelled" &&
            overlaps(candidate.startAt, candidate.endAt, existing.startAt, existing.endAt)
        );
      });
      if (conflictIndex >= 0) {
        return result(false, null, `第 ${conflictIndex + 1} 次课与教师现有课程冲突`, "TEACHER_CONFLICT");
      }

      planned.forEach(({ session, startAt, endAt }) => {
        const startMs = new Date(startAt).getTime();
        session.startAt = startAt;
        session.endAt = endAt;
        session.bookingCloseAt = new Date(startMs - 30 * 60000).toISOString();
        session.cancelCloseAt = new Date(startMs - 2 * 60 * 60000).toISOString();
        draft.bookings
          .filter((booking) => booking.sessionId === session.id && booking.status === "booked")
          .forEach((booking) => {
            addNotification(draft, {
              userId: booking.studentId,
              type: "session_updated",
              title: "课程信息有更新",
              body: `“${session.title}”的课程安排已更新，请重新查看时间。`,
              link: `/student/lesson/${session.lessonId}?phase=preview&sessionId=${session.id}`
            });
          });
      });

      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "update_series_schedule",
        targetType: "series",
        targetId: series.id,
        summary: `调整系列班“${series.title}”的课次时间（${planned.length} 次课）`,
        reason
      });
      return result(true, series);
    }, "series");
  }

  function cancelSession({ sessionId, actorId, reason = "" }) {
    const cancelReason = typeof reason === "string" ? reason.trim() : "";
    return save((draft) => {
      const session = getSession(draft, sessionId);
      if (!session) return result(false, null, "班次不存在", "NOT_FOUND");
      session.status = "cancelled";
      session.cancelledAt = nowIso();
      session.cancelReason = cancelReason;
      const affected = draft.bookings.filter((booking) => booking.sessionId === sessionId && booking.status === "booked");
      affected.forEach((booking) => {
        booking.status = "cancelled";
        booking.cancelledAt = nowIso();
        booking.cancelledBy = actorId;
        addNotification(draft, {
          userId: booking.studentId,
          type: "session_cancelled",
          title: "课堂已取消",
          body: `“${session.title}”已取消，请查看最新课表。`,
          link: "/student/schedule"
        });
      });
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "cancel_session",
        targetType: "session",
        targetId: sessionId,
        summary: `取消“${session.title}”`,
        reason: cancelReason
      });
      return result(true, session);
    }, "session");
  }

  function saveInteractionSet({ setId = "", lessonId, title, phase, items, countsTowardGrade, actorId, publishNote = "" }) {
    return save((draft) => {
      let set = setId ? draft.interactionSets.find((item) => item.id === setId) : null;
      if (!set) {
        set = {
          id: makeId("set"),
          lessonId,
          title,
          phase,
          status: "published",
          currentVersionId: "",
          order: draft.interactionSets.filter((item) => item.lessonId === lessonId && item.phase === phase).length + 1,
          updatedAt: nowIso(),
          countsTowardGrade: true
        };
        draft.interactionSets.push(set);
      }
      const versions = draft.interactionVersions.filter((version) => version.setId === set.id);
      const nextVersionNumber = versions.reduce((max, version) => Math.max(max, version.version), 0) + 1;
      versions.forEach((version) => {
        version.status = "archived";
      });
      const version = {
        id: makeId("ver"),
        setId: set.id,
        version: nextVersionNumber,
        status: "published",
        publishedAt: nowIso(),
        publishedBy: actorId || draft.currentUserId,
        publishNote: publishNote || "保存并发布",
        items: clone(items || [])
      };
      draft.interactionVersions.push(version);
      Object.assign(set, {
        lessonId,
        title,
        phase,
        status: "published",
        currentVersionId: version.id,
        updatedAt: nowIso(),
        ...(typeof countsTowardGrade === "boolean" ? { countsTowardGrade } : {})
      });
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "publish_interaction",
        targetType: "interaction_set",
        targetId: set.id,
        summary: `发布“${set.title}”第 ${version.version} 版`,
        reason: publishNote
      });
      return result(true, { set, version });
    }, "interaction");
  }

  function assignInteractionSessions({ setId, sessionIds = [], actorId }) {
    return save((draft) => {
      const set = draft.interactionSets.find((item) => item.id === setId);
      if (!set) return result(false, null, "互动不存在", "NOT_FOUND");
      const ids = [...new Set(sessionIds)];
      const invalid = ids.filter((id) => !draft.sessions.some((session) => session.id === id));
      if (invalid.length) return result(false, null, "课次不存在", "NOT_FOUND");
      // 不勾选任何课次 = 作用于该课节全部课次（含后续新排的课）。
      if (ids.length) {
        set.sessionIds = ids;
      } else {
        delete set.sessionIds;
      }
      delete set.excludedSessionIds;
      set.updatedAt = nowIso();
      const scope = ids.length
        ? draft.sessions.filter((session) => ids.includes(session.id)).map((session) => session.title).join("、")
        : "该课节的全部课次";
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "assign_interaction",
        targetType: "interaction_set",
        targetId: setId,
        summary: `把“${set.title}”配置到：${scope}`
      });
      return result(true, set);
    }, "interaction");
  }

  /** 把互动从该课节全部课次移出，但保留在互动设计库中。 */
  function unassignInteractionSet({ setId, actorId }) {
    return save((draft) => {
      const set = draft.interactionSets.find((item) => item.id === setId);
      if (!set) return result(false, null, "互动不存在", "NOT_FOUND");
      set.sessionIds = [];
      delete set.excludedSessionIds;
      set.updatedAt = nowIso();
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "unassign_interaction",
        targetType: "interaction_set",
        targetId: setId,
        summary: `把“${set.title}”从该课节全部课次移出`
      });
      return result(true, set);
    }, "interaction");
  }

  /** 把互动从单个课次移出 / 恢复，不改动同一课节的其它课次。 */
  function excludeInteractionSession({ setId, sessionId, excluded = true, actorId }) {
    return save((draft) => {
      const set = draft.interactionSets.find((item) => item.id === setId);
      if (!set) return result(false, null, "互动不存在", "NOT_FOUND");
      if (excluded) {
        if (set.sessionIds) {
          set.sessionIds = set.sessionIds.filter((id) => id !== sessionId);
        } else {
          const list = new Set(set.excludedSessionIds || []);
          list.add(sessionId);
          set.excludedSessionIds = [...list];
        }
      } else if (set.sessionIds) {
        set.sessionIds = [...new Set([...set.sessionIds, sessionId])];
      } else {
        const list = new Set(set.excludedSessionIds || []);
        list.delete(sessionId);
        set.excludedSessionIds = [...list];
      }
      if (set.excludedSessionIds && !set.excludedSessionIds.length) delete set.excludedSessionIds;
      set.updatedAt = nowIso();
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: excluded ? "exclude_interaction_session" : "restore_interaction_session",
        targetType: "interaction_set",
        targetId: setId,
        summary: `${excluded ? "从单个课次移出" : "恢复到单个课次"}“${set.title}”`
      });
      return result(true, set);
    }, "interaction");
  }

  function rollbackInteractionVersion({ setId, versionId, actorId }) {
    return save((draft) => {
      const set = draft.interactionSets.find((item) => item.id === setId);
      if (!set) return result(false, null, "互动不存在", "NOT_FOUND");
      const version = draft.interactionVersions.find((item) => item.id === versionId && item.setId === setId);
      if (!version) return result(false, null, "版本不存在", "NOT_FOUND");
      draft.interactionVersions.filter((item) => item.setId === setId).forEach((item) => {
        item.status = item.id === versionId ? "published" : "archived";
      });
      set.currentVersionId = versionId;
      set.updatedAt = nowIso();
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "rollback_interaction",
        targetType: "interaction_set",
        targetId: setId,
        summary: `回滚“${set.title}”到第 ${version.version} 版`
      });
      return result(true, { set, version });
    }, "interaction");
  }

  const changeRequestLabels = {
    reschedule: "申请改期",
    add_session: "申请加课",
    new_lesson_plan: "申请新增课节",
    teacher_swap: "申请更换授课老师",
    cancel: "申请取消课次"
  };

  function requestSessionChange({ sessionId, kind, reason, actorId }) {
    return save((draft) => {
      const session = getSession(draft, sessionId);
      if (!session) return result(false, null, "课次不存在", "NOT_FOUND");
      if (!reason || reason.trim().length < 6) {
        return result(false, null, "请填写至少 6 个字的申请原因，方便教学管理判断", "REASON_REQUIRED");
      }
      const request = {
        id: makeId("request"),
        sessionId,
        teacherId: session.teacherId,
        kind,
        reason: reason.trim(),
        status: "pending",
        createdAt: nowIso()
      };
      draft.changeRequests.unshift(request);
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "teacher_request",
        targetType: "session",
        targetId: sessionId,
        summary: `${changeRequestLabels[kind] || "申请调整"}：${session.title}`,
        reason: request.reason
      });
      const operators = draft.users.filter((user) => user.role === "operator");
      operators.forEach((operator) => {
        draft.notifications.unshift({
          id: makeId("notice"),
          userId: operator.id,
          type: "change_request",
          title: `${changeRequestLabels[kind] || "教师申请"}待处理`,
          body: `${session.title}：${request.reason}`,
          read: false,
          createdAt: nowIso(),
          link: "/operator/scheduling"
        });
      });
      draft.schoolMemberships
        .filter((item) => item.schoolId === session.schoolId && item.role === "academic" && item.status === "active")
        .forEach((membership) => {
          draft.notifications.unshift({
            id: makeId("notice"),
            userId: membership.userId,
            type: "change_request",
            title: `${changeRequestLabels[kind] || "教师申请"}待处理`,
            body: `${session.title}：${request.reason}`,
            read: false,
            createdAt: nowIso(),
            link: "/academic/scheduling"
          });
        });
      return result(true, request);
    }, "session");
  }

  function resolveChangeRequest({ requestId, status = "handled", resolutionNote = "", actorId }) {
    return save((draft) => {
      const request = draft.changeRequests.find((item) => item.id === requestId);
      if (!request) return result(false, null, "申请不存在", "NOT_FOUND");
      request.status = status;
      request.handledAt = nowIso();
      request.handledBy = actorId || draft.currentUserId;
      request.resolutionNote = resolutionNote;
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: status === "handled" ? "resolve_change_request" : "reject_change_request",
        targetType: "session",
        targetId: request.sessionId,
        summary: `${status === "handled" ? "已处理" : "已驳回"}教师申请：${changeRequestLabels[request.kind] || request.kind}`,
        reason: resolutionNote
      });
      draft.notifications.unshift({
        id: makeId("notice"),
        userId: request.teacherId,
        type: "change_request_result",
        title: status === "handled" ? "你的申请已处理" : "你的申请未通过",
        body: resolutionNote || "教学管理已更新排课，请查看最新课表。",
        read: false,
        createdAt: nowIso(),
        link: "/teacher/schedule"
      });
      return result(true, request);
    }, "session");
  }

  function createSubject({ name, description = "", color = "#6552ff", actorId }) {
    return save((draft) => {
      const normalizedName = String(name || "").trim();
      if (!normalizedName) return result(false, null, "科目名称不能为空", "INVALID_NAME");
      if (draft.subjects.some((subject) => subject.name.trim().toLowerCase() === normalizedName.toLowerCase())) {
        return result(false, null, "该科目已存在", "DUPLICATE_NAME");
      }
      const subject = {
        id: makeId("subject"),
        name: normalizedName,
        description: String(description || "").trim(),
        color,
        order: Math.max(0, ...draft.subjects.map((item) => Number(item.order) || 0)) + 1
      };
      draft.subjects.push(subject);
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "create_subject",
        targetType: "subject",
        targetId: subject.id,
        summary: `创建科目“${subject.name}”`
      });
      return result(true, subject);
    }, "catalog");
  }

  function updateSubject({ subjectId, patch, actorId }) {
    return save((draft) => {
      const subject = draft.subjects.find((item) => item.id === subjectId);
      if (!subject) return result(false, null, "科目不存在", "NOT_FOUND");
      const nextName = patch?.name === undefined ? subject.name : String(patch.name).trim();
      if (!nextName) return result(false, null, "科目名称不能为空", "INVALID_NAME");
      if (draft.subjects.some((item) => item.id !== subjectId && item.name.trim().toLowerCase() === nextName.toLowerCase())) {
        return result(false, null, "该科目已存在", "DUPLICATE_NAME");
      }
      if (patch?.name !== undefined) subject.name = nextName;
      if (patch?.description !== undefined) subject.description = String(patch.description || "").trim();
      if (patch?.color !== undefined) subject.color = patch.color;
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "update_subject",
        targetType: "subject",
        targetId: subject.id,
        summary: `更新科目“${subject.name}”`
      });
      return result(true, subject);
    }, "catalog");
  }

  function deleteSubject({ subjectId, actorId }) {
    return save((draft) => {
      const subject = draft.subjects.find((item) => item.id === subjectId);
      if (!subject) return result(false, null, "科目不存在", "NOT_FOUND");
      const courseCount = draft.folders.filter((course) => course.subjectId === subjectId).length;
      if (courseCount > 0) {
        return result(false, null, `该科目下还有 ${courseCount} 门课程，请先移走或删除课程`, "SUBJECT_IN_USE");
      }
      draft.subjects = draft.subjects.filter((item) => item.id !== subjectId);
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "delete_subject",
        targetType: "subject",
        targetId: subject.id,
        summary: `删除科目“${subject.name}”`
      });
      return result(true, subject);
    }, "catalog");
  }

  function createCourse({ subjectId, name, description = "", tags = [], color = "#6552ff", actorId }) {
    return save((draft) => {
      const subject = draft.subjects.find((item) => item.id === subjectId);
      if (!subject) return result(false, null, "科目不存在", "NOT_FOUND");
      const normalizedName = String(name || "").trim();
      if (!normalizedName) return result(false, null, "课程名称不能为空", "INVALID_NAME");
      if (draft.folders.some((course) => course.subjectId === subjectId && course.name.trim().toLowerCase() === normalizedName.toLowerCase())) {
        return result(false, null, "该科目下已有同名课程", "DUPLICATE_NAME");
      }
      const course = {
        id: makeId("course"),
        subjectId,
        name: normalizedName,
        description: String(description || "").trim(),
        tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
        color,
        order: Math.max(0, ...draft.folders.filter((item) => item.subjectId === subjectId).map((item) => Number(item.order) || 0)) + 1,
        status: "draft",
        createdAt: nowIso()
      };
      draft.folders.push(course);
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "create_course",
        targetType: "course",
        targetId: course.id,
        summary: `在“${subject.name}”下创建课程“${course.name}”`
      });
      return result(true, course);
    }, "catalog");
  }

  function updateCourse({ courseId, patch, actorId }) {
    return save((draft) => {
      const course = draft.folders.find((item) => item.id === courseId);
      if (!course) return result(false, null, "课程不存在", "NOT_FOUND");
      const nextName = patch?.name === undefined ? course.name : String(patch.name).trim();
      if (!nextName) return result(false, null, "课程名称不能为空", "INVALID_NAME");
      const nextSubjectId = patch?.subjectId || course.subjectId;
      if (!draft.subjects.some((subject) => subject.id === nextSubjectId)) {
        return result(false, null, "科目不存在", "NOT_FOUND");
      }
      if (draft.folders.some((item) => item.id !== courseId && item.subjectId === nextSubjectId && item.name.trim().toLowerCase() === nextName.toLowerCase())) {
        return result(false, null, "该科目下已有同名课程", "DUPLICATE_NAME");
      }
      if (patch?.subjectId !== undefined) course.subjectId = nextSubjectId;
      if (patch?.name !== undefined) course.name = nextName;
      if (patch?.description !== undefined) course.description = String(patch.description || "").trim();
      if (patch?.tags !== undefined) course.tags = Array.isArray(patch.tags) ? patch.tags.filter(Boolean) : [];
      if (patch?.color !== undefined) course.color = patch.color;
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "update_course",
        targetType: "course",
        targetId: course.id,
        summary: `更新课程“${course.name}”`
      });
      return result(true, course);
    }, "catalog");
  }

  function setCourseStatus({ courseId, status, actorId }) {
    return save((draft) => {
      const course = draft.folders.find((item) => item.id === courseId);
      if (!course) return result(false, null, "课程不存在", "NOT_FOUND");
      if (!["draft", "published", "disabled"].includes(status)) return result(false, null, "课程状态无效", "INVALID_STATUS");
      if (status === "published" && !draft.lessons.some((lesson) => lesson.folderId === courseId && lesson.status === "published")) {
        return result(false, null, "发布课程前至少需要一个已发布课节", "COURSE_EMPTY");
      }
      course.status = status;
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: status === "published" ? "publish_course" : status === "disabled" ? "disable_course" : "draft_course",
        targetType: "course",
        targetId: course.id,
        summary: `${status === "published" ? "发布" : status === "disabled" ? "停用" : "转为草稿"}课程“${course.name}”`
      });
      return result(true, course);
    }, "catalog");
  }

  function deleteCourse({ courseId, actorId }) {
    return save((draft) => {
      const course = draft.folders.find((item) => item.id === courseId);
      if (!course) return result(false, null, "课程不存在", "NOT_FOUND");
      const lessonIds = draft.lessons.filter((lesson) => lesson.folderId === courseId).map((lesson) => lesson.id);
      const inUse = draft.series.some((series) => series.folderId === courseId)
        || draft.sessions.some((session) => lessonIds.includes(session.lessonId))
        || draft.interactionSets.some((set) => lessonIds.includes(set.lessonId))
        || draft.materialRefs.some((ref) => lessonIds.includes(ref.lessonId));
      if (inUse) {
        return result(false, null, "课程已被班级或内容引用，只能停用，不能删除", "COURSE_IN_USE");
      }
      draft.lessons = draft.lessons.filter((lesson) => lesson.folderId !== courseId);
      draft.folders = draft.folders.filter((item) => item.id !== courseId);
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "delete_course",
        targetType: "course",
        targetId: course.id,
        summary: `删除课程“${course.name}”`
      });
      return result(true, course);
    }, "catalog");
  }

  function createLesson({ folderId, title, subtitle = "", description = "", durationMinutes = 40, tags = [], color = "#6552ff", coverEmoji = "📘", actorId }) {
    return save((draft) => {
      const folder = draft.folders.find((item) => item.id === folderId);
      if (!folder) return result(false, null, "课程不存在", "NOT_FOUND");
      const normalizedTitle = String(title || "").trim();
      if (!normalizedTitle) return result(false, null, "课节标题不能为空", "INVALID_NAME");
      const lesson = {
        id: makeId("lesson"),
        folderId,
        title: normalizedTitle,
        subtitle,
        description,
        durationMinutes: Number(durationMinutes) || 40,
        tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
        color,
        coverEmoji,
        status: "draft",
        order: Math.max(0, ...draft.lessons.filter((item) => item.folderId === folderId).map((item) => Number(item.order) || 0)) + 1,
        createdAt: nowIso()
      };
      draft.lessons.push(lesson);
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "create_lesson",
        targetType: "lesson",
        targetId: lesson.id,
        summary: `创建课节“${lesson.title}”`
      });
      return result(true, lesson);
    }, "catalog");
  }

  function updateLesson({ lessonId, patch, actorId }) {
    return save((draft) => {
      const lesson = draft.lessons.find((item) => item.id === lessonId);
      if (!lesson) return result(false, null, "课节不存在", "NOT_FOUND");
      const nextTitle = patch?.title === undefined ? lesson.title : String(patch.title).trim();
      if (!nextTitle) return result(false, null, "课节标题不能为空", "INVALID_NAME");
      lesson.title = nextTitle;
      if (patch?.subtitle !== undefined) lesson.subtitle = String(patch.subtitle || "");
      if (patch?.description !== undefined) lesson.description = String(patch.description || "");
      if (patch?.durationMinutes !== undefined) lesson.durationMinutes = Math.max(1, Number(patch.durationMinutes) || 40);
      if (patch?.tags !== undefined) lesson.tags = Array.isArray(patch.tags) ? patch.tags.filter(Boolean) : [];
      if (patch?.color !== undefined) lesson.color = patch.color;
      if (patch?.coverEmoji !== undefined) lesson.coverEmoji = patch.coverEmoji;
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "update_lesson",
        targetType: "lesson",
        targetId: lesson.id,
        summary: `更新课节“${lesson.title}”`
      });
      return result(true, lesson);
    }, "catalog");
  }

  function setLessonStatus({ lessonId, status, actorId }) {
    return save((draft) => {
      const lesson = draft.lessons.find((item) => item.id === lessonId);
      if (!lesson) return result(false, null, "课节不存在", "NOT_FOUND");
      if (!["draft", "published", "disabled"].includes(status)) return result(false, null, "课节状态无效", "INVALID_STATUS");
      lesson.status = status;
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: status === "published" ? "publish_lesson" : status === "disabled" ? "disable_lesson" : "draft_lesson",
        targetType: "lesson",
        targetId: lesson.id,
        summary: `${status === "published" ? "发布" : status === "disabled" ? "停用" : "转为草稿"}课节“${lesson.title}”`
      });
      return result(true, lesson);
    }, "catalog");
  }

  function deleteLesson({ lessonId, actorId }) {
    return save((draft) => {
      const lesson = draft.lessons.find((item) => item.id === lessonId);
      if (!lesson) return result(false, null, "课节不存在", "NOT_FOUND");
      const inUse = draft.sessions.some((session) => session.lessonId === lessonId)
        || draft.series.some((series) => series.lessonId === lessonId || (series.lessonIds || []).includes(lessonId))
        || draft.interactionSets.some((set) => set.lessonId === lessonId)
        || draft.materialRefs.some((ref) => ref.lessonId === lessonId);
      if (inUse) return result(false, null, "课节已被班级或内容引用，只能停用，不能删除", "LESSON_IN_USE");
      draft.lessons = draft.lessons.filter((item) => item.id !== lessonId);
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "delete_lesson",
        targetType: "lesson",
        targetId: lesson.id,
        summary: `删除课节“${lesson.title}”`
      });
      return result(true, lesson);
    }, "catalog");
  }

  function moveLesson({ lessonId, direction, actorId }) {
    return save((draft) => {
      const lesson = draft.lessons.find((item) => item.id === lessonId);
      if (!lesson) return result(false, null, "课节不存在", "NOT_FOUND");
      if (direction !== "up" && direction !== "down") return result(false, null, "移动方向无效", "INVALID_DIRECTION");
      const sequence = draft.lessons
        .filter((item) => item.folderId === lesson.folderId)
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
      const index = sequence.findIndex((item) => item.id === lessonId);
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= sequence.length) return result(true, sequence);
      [sequence[index], sequence[targetIndex]] = [sequence[targetIndex], sequence[index]];
      sequence.forEach((item, orderIndex) => { item.order = orderIndex + 1; });
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "move_lesson",
        targetType: "lesson",
        targetId: lesson.id,
        summary: `${direction === "up" ? "上移" : "下移"}课节“${lesson.title}”`
      });
      return result(true, sequence);
    }, "catalog");
  }

  function createStudent({ name, phone = "", timeZone = "Asia/Jakarta", locale = "id-ID", program = "Mandarin Explorer", level = "初级 1", className = "待分班", learningGoal = "", preferredTeacherId = "", schoolId, actorId }) {
    return save((draft) => {
      if (!name.trim()) return result(false, null, "学生姓名不能为空", "INVALID_NAME");
      const actor = getUser(draft, actorId || draft.currentUserId);
      const resolvedSchoolId = schoolId || (actor?.role === "academic" ? activeAcademicSchoolId(draft, actor.id) : "school-demo");
      const userId = makeId("student");
      const user = {
        id: userId,
        role: "student",
        name: name.trim(),
        nameZh: name.trim().slice(0, 1),
        phone,
        avatar: name.trim().slice(0, 2),
        timeZone,
        locale,
        status: "active"
      };
      const profile = {
        userId,
        program,
        level,
        className,
        primaryClassId: "",
        learningGoal,
        preferredTeacherId,
        preferredTimeZone: timeZone,
        joinedAt: nowIso(),
        tags: ["新建学生"],
        notes: ""
      };
      draft.users.push(user);
      const isSchoolTeacher = (teacherId) => draft.schoolMemberships.some(
        (item) => item.schoolId === resolvedSchoolId && item.userId === teacherId && item.role === "teacher" && item.status === "active"
      );
      let classGroup = draft.classes.find((item) => item.name === className && item.schoolId === resolvedSchoolId);
      if (!classGroup) {
        const fallbackTeacher = draft.users.find((item) => item.id === preferredTeacherId && item.role === "teacher" && isSchoolTeacher(item.id))
          || draft.users.find((item) => item.role === "teacher" && isSchoolTeacher(item.id));
        if (!fallbackTeacher) return result(false, null, "请先为学校加入教师成员", "TEACHER_REQUIRED");
        classGroup = {
          id: makeId("class"),
          schoolId: resolvedSchoolId,
          name: className,
          teacherId: fallbackTeacher?.id || "",
          status: "active",
          createdAt: nowIso()
        };
        draft.classes.push(classGroup);
      }
      profile.primaryClassId = classGroup.id;
      draft.students.push(profile);
      ensureSchoolMembership(draft, resolvedSchoolId, userId, "student", profile.joinedAt);
      ensureSchoolMembership(draft, resolvedSchoolId, classGroup.teacherId, "teacher", profile.joinedAt);
      ensureClassEnrollment(draft, classGroup.id, userId, "profile", profile.joinedAt);
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "create_student",
        targetType: "student",
        targetId: userId,
        summary: `创建学生“${user.name}”`
      });
      return result(true, { user, profile });
    }, "student");
  }

  function addMockMaterial({ title, description, fileType = "pdf", language = "zh-id", ownerId, phase = "preview", lessonId, fileName = "uploaded-demo.pdf", sizeLabel = "32 KB" }) {
    return save((draft) => {
      const material = {
        id: makeId("material"),
        title,
        description,
        kind: "file",
        fileType,
        language,
        ownerId,
        status: "published",
        currentVersion: 1,
        downloadCount: 0,
        createdAt: nowIso(),
        versions: [
          {
            version: 1,
            fileName,
            sizeLabel,
            url: "/shared/demo-materials/greeting-preview.pdf",
            publishedAt: nowIso()
          }
        ]
      };
      draft.materials.unshift(material);
      if (lessonId) {
        draft.materialRefs.push({
          id: makeId("ref"),
          materialId: material.id,
          lessonId,
          phase,
          order: draft.materialRefs.filter((ref) => ref.lessonId === lessonId && ref.phase === phase).length + 1,
          published: true
        });
      }
      addAudit(draft, {
        actorId: ownerId || draft.currentUserId,
        action: "create_material",
        targetType: "material",
        targetId: material.id,
        summary: `模拟上传“${material.title}”`
      });
      return result(true, material);
    }, "material");
  }

  function attachMaterial({ materialId, lessonId, phase, order = 1, sessionIds, actorId }) {
    return save((draft) => {
      const material = draft.materials.find((item) => item.id === materialId);
      if (!material) return result(false, null, "材料不存在", "NOT_FOUND");
      // sessionIds 传数组表示“指定这些课次”，空数组 = 恢复成该课节全部课次；不传 = 保持原样。
      const scope = Array.isArray(sessionIds) ? [...new Set(sessionIds)] : undefined;
      const existing = draft.materialRefs.find((ref) => ref.materialId === materialId && ref.lessonId === lessonId && ref.phase === phase);
      if (existing) {
        existing.order = order;
        existing.published = true;
        if (scope) {
          if (scope.length) {
            existing.sessionIds = scope;
          } else {
            delete existing.sessionIds;
          }
          delete existing.excludedSessionIds;
        }
      } else {
        draft.materialRefs.push({
          id: makeId("ref"),
          materialId,
          lessonId,
          phase,
          order,
          published: true,
          ...(scope && scope.length ? { sessionIds: scope } : {})
        });
      }
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "attach_material",
        targetType: "material",
        targetId: materialId,
        summary: `将“${material.title}”加入 ${phase} 阶段`
      });
      return result(true, material);
    }, "material");
  }

  function detachMaterial({ materialId, lessonId, phase, actorId }) {
    return save((draft) => {
      const material = draft.materials.find((item) => item.id === materialId);
      if (!material) return result(false, null, "材料不存在", "NOT_FOUND");
      const before = draft.materialRefs.length;
      draft.materialRefs = draft.materialRefs.filter(
        (ref) => !(ref.materialId === materialId && ref.lessonId === lessonId && ref.phase === phase)
      );
      if (draft.materialRefs.length === before) return result(false, null, "材料未关联到该课节", "NOT_FOUND");
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "detach_material",
        targetType: "material",
        targetId: materialId,
        summary: `将“${material.title}”从课节内容中移除`
      });
      return result(true, material);
    }, "material");
  }

  /** 把材料从单个课次移出 / 恢复到单个课次（不改动其它课次的配置）。 */
  function excludeMaterialSession({ materialId, lessonId, phase, sessionId, excluded = true, actorId }) {
    return save((draft) => {
      const material = draft.materials.find((item) => item.id === materialId);
      if (!material) return result(false, null, "材料不存在", "NOT_FOUND");
      const ref = draft.materialRefs.find(
        (item) => item.materialId === materialId && item.lessonId === lessonId && item.phase === phase
      );
      if (!ref) return result(false, null, "材料未关联到该课节", "NOT_FOUND");
      if (excluded) {
        if (ref.sessionIds) {
          ref.sessionIds = ref.sessionIds.filter((id) => id !== sessionId);
        } else {
          const list = new Set(ref.excludedSessionIds || []);
          list.add(sessionId);
          ref.excludedSessionIds = [...list];
        }
      } else if (ref.sessionIds) {
        ref.sessionIds = [...new Set([...ref.sessionIds, sessionId])];
      } else {
        const list = new Set(ref.excludedSessionIds || []);
        list.delete(sessionId);
        ref.excludedSessionIds = [...list];
      }
      if (ref.excludedSessionIds && !ref.excludedSessionIds.length) delete ref.excludedSessionIds;
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: excluded ? "exclude_material_session" : "restore_material_session",
        targetType: "material",
        targetId: materialId,
        summary: `${excluded ? "从单个课次移出" : "恢复到单个课次"}“${material.title}”`
      });
      return result(true, material);
    }, "material");
  }

  function addMaterialVersion({ materialId, fileName, sizeLabel, actorId }) {
    return save((draft) => {
      const material = draft.materials.find((item) => item.id === materialId);
      if (!material) return result(false, null, "材料不存在", "NOT_FOUND");
      const version = material.currentVersion + 1;
      material.versions.push({
        version,
        fileName,
        sizeLabel,
        url: "/shared/demo-materials/greeting-preview.pdf",
        publishedAt: nowIso()
      });
      material.currentVersion = version;
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "version_material",
        targetType: "material",
        targetId: materialId,
        summary: `上传“${material.title}”第 ${version} 版`
      });
      return result(true, material);
    }, "material");
  }

  function setMaterialStatus({ materialId, status, actorId, reason = "" }) {
    return save((draft) => {
      const material = draft.materials.find((item) => item.id === materialId);
      if (!material) return result(false, null, "材料不存在", "NOT_FOUND");
      material.status = status;
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: status === "published" ? "publish_material" : "unpublish_material",
        targetType: "material",
        targetId: materialId,
        summary: `${status === "published" ? "恢复" : "下架"}“${material.title}”`,
        reason
      });
      return result(true, material);
    }, "material");
  }

  function trackDownload(materialId) {
    return save((draft) => {
      const material = draft.materials.find((item) => item.id === materialId);
      if (!material) return result(false, null, "材料不存在", "NOT_FOUND");
      material.downloadCount += 1;
      return result(true, material);
    }, "download");
  }

  function createClass({ name, teacherId, status = "active", schoolId, actorId }) {
    return save((draft) => {
      const className = String(name || "").trim();
      const teacher = getUser(draft, teacherId);
      const actor = getUser(draft, actorId || draft.currentUserId);
      const resolvedSchoolId = schoolId || (actor?.role === "academic" ? activeAcademicSchoolId(draft, actor.id) : "school-demo");
      if (!className) return result(false, null, "请填写班级名称", "NAME_REQUIRED");
      if (!teacher || teacher.role !== "teacher") return result(false, null, "授课教师不存在", "TEACHER_NOT_FOUND");
      if (draft.classes.some((item) => item.name === className && item.schoolId === resolvedSchoolId)) {
        return result(false, null, "本校内已存在同名班级", "CLASS_EXISTS");
      }
      const classGroup = {
        id: makeId("class"),
        schoolId: resolvedSchoolId,
        name: className,
        teacherId,
        status,
        createdAt: nowIso()
      };
      draft.classes.push(classGroup);
      ensureSchoolMembership(draft, resolvedSchoolId, teacherId, "teacher");
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "create_class",
        targetType: "class",
        targetId: classGroup.id,
        summary: `创建班级“${classGroup.name}”`
      });
      return result(true, classGroup);
    }, "class");
  }

  function updateClass({ classId, patch, actorId, reason = "" }) {
    return save((draft) => {
      const classGroup = draft.classes.find((item) => item.id === classId);
      if (!classGroup) return result(false, null, "班级不存在", "NOT_FOUND");
      if (patch.name !== undefined) {
        const name = String(patch.name).trim();
        if (!name) return result(false, null, "请填写班级名称", "NAME_REQUIRED");
        if (draft.classes.some((item) => item.id !== classId && item.name === name && item.schoolId === classGroup.schoolId)) {
          return result(false, null, "本校内已存在同名班级", "CLASS_EXISTS");
        }
      }
      if (patch.teacherId !== undefined) {
        const teacher = getUser(draft, patch.teacherId);
        if (!teacher || teacher.role !== "teacher") return result(false, null, "授课教师不存在", "TEACHER_NOT_FOUND");
        ensureSchoolMembership(draft, classGroup.schoolId, patch.teacherId, "teacher");
      }
      const safePatch = { ...patch };
      delete safePatch.schoolId;
      Object.assign(classGroup, safePatch);
      classGroup.schoolId = classGroup.schoolId || "school-demo";
      draft.sessions.forEach((session) => {
        if (session.classId === classId) session.className = classGroup.name;
      });
      draft.students.forEach((profile) => {
        if (profile.primaryClassId === classId) profile.className = classGroup.name;
      });
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "update_class",
        targetType: "class",
        targetId: classId,
        summary: `更新班级“${classGroup.name}”`,
        reason
      });
      return result(true, classGroup);
    }, "class");
  }

  function deleteClass({ classId, actorId }) {
    return save((draft) => {
      const classIndex = draft.classes.findIndex((item) => item.id === classId);
      const classGroup = draft.classes[classIndex];
      if (!classGroup) return result(false, null, "班级不存在", "NOT_FOUND");
      const hasEnrollments = draft.classEnrollments.some((item) => item.classId === classId);
      const hasSessions = draft.sessions.some((item) => item.classId === classId);
      const hasAssessments = draft.assessments.some((item) => item.classId === classId);
      const hasPrimaryStudents = draft.students.some((item) => item.primaryClassId === classId);
      if (hasEnrollments || hasSessions || hasAssessments || hasPrimaryStudents) {
        return result(false, null, "班级已有学生、课次或成绩，只能归档", "CLASS_IN_USE");
      }
      draft.classes.splice(classIndex, 1);
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "delete_class",
        targetType: "class",
        targetId: classId,
        summary: `删除空班级“${classGroup.name}”`
      });
      return result(true, classGroup);
    }, "class");
  }

  function addClassMembers({ classId, studentIds, actorId }) {
    return save((draft) => {
      const classGroup = draft.classes.find((item) => item.id === classId);
      if (!classGroup) return result(false, null, "班级不存在", "NOT_FOUND");
      const ids = [...new Set(studentIds || [])];
      const invalid = ids.filter((studentId) => {
        const user = getUser(draft, studentId);
        return !user || user.role !== "student";
      });
      if (invalid.length) return result(false, null, "学生不存在", "STUDENT_NOT_FOUND");
      const enrollments = ids.map((studentId) => {
        ensureSchoolMembership(draft, classGroup.schoolId, studentId, "student", nowIso());
        const enrollment = ensureClassEnrollment(draft, classId, studentId, "manual", nowIso());
        const profile = draft.students.find((item) => item.userId === studentId);
        const currentClass = getClass(draft, profile?.primaryClassId);
        if (profile && (!currentClass || currentClass.status !== "active" || ["待分班", "待分配班级"].includes(currentClass.name))) {
          profile.primaryClassId = classId;
          profile.className = classGroup.name;
        }
        return enrollment;
      });
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "add_class_members",
        targetType: "class",
        targetId: classId,
        summary: `向“${classGroup.name}”加入 ${ids.length} 名学生`
      });
      return result(true, enrollments);
    }, "class-enrollments");
  }

  function removeClassMember({ classId, studentId, actorId }) {
    return save((draft) => {
      const classGroup = draft.classes.find((item) => item.id === classId);
      const enrollment = draft.classEnrollments.find((item) => item.classId === classId && item.studentId === studentId);
      if (!classGroup || !enrollment) return result(false, null, "班级成员不存在", "NOT_FOUND");
      enrollment.status = "left";
      enrollment.leftAt = nowIso();
      const profile = draft.students.find((item) => item.userId === studentId);
      if (profile?.primaryClassId === classId) {
        const remainingClass = draft.classEnrollments
          .filter((item) => item.studentId === studentId && item.status === "active" && item.classId !== classId)
          .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())
          .map((item) => getClass(draft, item.classId))
          .find((item) => item && item.status === "active" && !["待分班", "待分配班级"].includes(item.name));
        if (remainingClass) {
          profile.primaryClassId = remainingClass.id;
          profile.className = remainingClass.name;
        } else {
          delete profile.primaryClassId;
          profile.className = "待分班";
        }
      }
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "remove_class_member",
        targetType: "class",
        targetId: classId,
        summary: `从“${classGroup.name}”移除学生 ${studentId}`
      });
      return result(true, enrollment);
    }, "class-enrollments");
  }

  function createAssessment({ classId, title, category, maxScore = 100, assessedAt, actorId }) {
    return save((draft) => {
      const classGroup = draft.classes.find((item) => item.id === classId);
      const assessmentTitle = String(title || "").trim();
      const numericMaxScore = Number(maxScore);
      if (!classGroup) return result(false, null, "班级不存在", "NOT_FOUND");
      if (!assessmentTitle) return result(false, null, "请填写考核名称", "TITLE_REQUIRED");
      if (!["homework", "exam"].includes(category)) return result(false, null, "成绩类别不正确", "INVALID_CATEGORY");
      if (!Number.isFinite(numericMaxScore) || numericMaxScore <= 0) {
        return result(false, null, "满分必须大于 0", "INVALID_MAX_SCORE");
      }
      const rosterStudentIds = [...new Set(activeClassStudents(draft, classId))];
      if (!rosterStudentIds.length) return result(false, null, "班级暂无有效成员", "EMPTY_CLASS");
      const assessment = {
        id: makeId("assessment"),
        schoolId: classGroup.schoolId,
        classId,
        title: assessmentTitle,
        category,
        maxScore: numericMaxScore,
        assessedAt: new Date(assessedAt).toISOString(),
        teacherId: classGroup.teacherId,
        createdBy: actorId || draft.currentUserId,
        createdAt: nowIso(),
        status: "published",
        rosterStudentIds
      };
      draft.assessments.push(assessment);
      rosterStudentIds.forEach((studentId) => {
        draft.assessmentScores.push({
          id: makeId("assessment-score"),
          assessmentId: assessment.id,
          studentId,
          score: null,
          normalizedScore: null,
          status: "pending",
          updatedAt: nowIso(),
          updatedBy: actorId || draft.currentUserId
        });
      });
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "create_assessment",
        targetType: "assessment",
        targetId: assessment.id,
        summary: `发布“${assessment.title}”并生成 ${rosterStudentIds.length} 人成绩名单`
      });
      return result(true, assessment);
    }, "assessment");
  }

  function saveAssessmentScores({ assessmentId, entries, actorId }) {
    return save((draft) => {
      const assessment = draft.assessments.find((item) => item.id === assessmentId);
      if (!assessment) return result(false, null, "考核不存在", "NOT_FOUND");
      if (assessment.status !== "published") return result(false, null, "已归档考核不能修改", "ASSESSMENT_ARCHIVED");
      const normalizedEntries = [];
      for (const entry of entries || []) {
        if (!assessment.rosterStudentIds.includes(entry.studentId)) {
          return result(false, null, "学生不在本次考核名单中", "STUDENT_NOT_IN_ROSTER");
        }
        if (!["pending", "graded", "absent", "excused"].includes(entry.status)) {
          return result(false, null, "成绩状态不正确", "INVALID_STATUS");
        }
        let score = null;
        let normalizedScore = null;
        if (entry.status === "graded") {
          if (entry.score === null || entry.score === undefined || entry.score === "") {
            return result(false, null, "已评分状态必须填写成绩", "SCORE_REQUIRED");
          }
          score = Number(entry.score);
          if (!Number.isFinite(score) || score < 0 || score > assessment.maxScore) {
            return result(false, null, `成绩必须在 0–${assessment.maxScore} 之间`, "INVALID_SCORE");
          }
          normalizedScore = Math.round((score / assessment.maxScore) * 1000) / 10;
        } else if (entry.status === "absent") {
          score = 0;
          normalizedScore = 0;
        }
        normalizedEntries.push({ ...entry, score, normalizedScore });
      }
      const now = nowIso();
      const updated = normalizedEntries.map((entry) => {
        let scoreRecord = draft.assessmentScores.find(
          (item) => item.assessmentId === assessmentId && item.studentId === entry.studentId
        );
        if (!scoreRecord) {
          scoreRecord = {
            id: makeId("assessment-score"),
            assessmentId,
            studentId: entry.studentId,
            score: null,
            normalizedScore: null,
            status: "pending",
            updatedAt: now,
            updatedBy: actorId || draft.currentUserId
          };
          draft.assessmentScores.push(scoreRecord);
        }
        scoreRecord.score = entry.score;
        scoreRecord.normalizedScore = entry.normalizedScore;
        scoreRecord.status = entry.status;
        scoreRecord.updatedAt = now;
        scoreRecord.updatedBy = actorId || draft.currentUserId;
        if (entry.status === "graded" || entry.status === "absent") {
          scoreRecord.gradedBy = actorId || draft.currentUserId;
          scoreRecord.gradedAt = now;
        } else {
          delete scoreRecord.gradedBy;
          delete scoreRecord.gradedAt;
        }
        return scoreRecord;
      });
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "save_assessment_scores",
        targetType: "assessment",
        targetId: assessmentId,
        summary: `更新“${assessment.title}”的 ${updated.length} 条成绩`
      });
      return result(true, updated);
    }, "assessment-scores");
  }

  function archiveAssessment({ assessmentId, actorId, reason = "" }) {
    return save((draft) => {
      const assessment = draft.assessments.find((item) => item.id === assessmentId);
      if (!assessment) return result(false, null, "考核不存在", "NOT_FOUND");
      assessment.status = "archived";
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "archive_assessment",
        targetType: "assessment",
        targetId: assessmentId,
        summary: `归档“${assessment.title}”`,
        reason
      });
      return result(true, assessment);
    }, "assessment");
  }

  function saveGradePolicy({ effectiveFrom, weights, schoolId, actorId }) {
    return save((draft) => {
      const normalizedWeights = {
        interaction: Number(weights?.interaction),
        homework: Number(weights?.homework),
        exam: Number(weights?.exam)
      };
      const values = Object.values(normalizedWeights);
      if (values.some((value) => !Number.isFinite(value) || value < 0) || values.reduce((sum, value) => sum + value, 0) !== 100) {
        return result(false, null, "三类权重之和必须等于 100", "INVALID_WEIGHTS");
      }
      const actor = getUser(draft, actorId || draft.currentUserId);
      const resolvedSchoolId = actor?.role === "academic"
        ? activeAcademicSchoolId(draft, actor.id)
        : (schoolId ?? null);
      if (resolvedSchoolId && !draft.schools.some((item) => item.id === resolvedSchoolId)) {
        return result(false, null, "学校不存在", "SCHOOL_NOT_FOUND");
      }
      const policy = {
        id: makeId("grade-policy"),
        schoolId: resolvedSchoolId || null,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        weights: normalizedWeights,
        updatedBy: actorId || draft.currentUserId,
        updatedAt: nowIso()
      };
      draft.gradePolicies.push(policy);
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "save_grade_policy",
        targetType: "grade_policy",
        targetId: policy.id,
        summary: `设置成绩权重：互动 ${normalizedWeights.interaction}% / 作业 ${normalizedWeights.homework}% / 考试 ${normalizedWeights.exam}%`
      });
      return result(true, policy);
    }, "grade-policy");
  }

  function recordAttempt({ setId, studentId, sessionId, phase, answers, score, timeSpentSeconds, wrongItemIds = [], pollAnswers = {} }) {
    return save((draft) => {
      const set = draft.interactionSets.find((item) => item.id === setId);
      if (!set) return result(false, null, "互动不存在", "NOT_FOUND");
      const previous = draft.interactionAttempts.filter((attempt) => attempt.setId === setId && attempt.studentId === studentId);
      const bestPrevious = previous.reduce((max, attempt) => Math.max(max, attempt.bestScore || 0), 0);
      const attempt = {
        id: makeId("attempt"),
        setId,
        versionId: set.currentVersionId,
        studentId,
        sessionId: sessionId || null,
        phase,
        score,
        bestScore: Math.max(bestPrevious, score),
        attempt: previous.length + 1,
        timeSpentSeconds,
        completedAt: nowIso(),
        answers: answers || {},
        wrongItemIds,
        pollAnswers
      };
      draft.interactionAttempts.push(attempt);
      if (score === 100) {
        addNotification(draft, {
          userId: studentId,
          type: "interaction_complete",
          title: "练习完成",
          body: `你完成了“${set.title}”，得分 ${score} 分。`,
          link: `/student/grades`
        });
      }
      return result(true, attempt);
    }, "attempt");
  }

  function updateStudent({ studentId, patch, actorId, reason = "" }) {
    return save((draft) => {
      const profile = draft.students.find((student) => student.userId === studentId);
      const user = getUser(draft, studentId);
      if (!profile || !user) return result(false, null, "学生不存在", "NOT_FOUND");
      const userFields = ["name", "nameZh", "phone", "timeZone", "locale", "status"];
      Object.entries(patch).forEach(([key, value]) => {
        if (userFields.includes(key)) user[key] = value;
        else profile[key] = value;
      });
      addAudit(draft, {
        actorId: actorId || draft.currentUserId,
        action: "update_student",
        targetType: "student",
        targetId: studentId,
        summary: `更新学生“${user.name}”档案`,
        reason
      });
      return result(true, { user, profile });
    }, "student");
  }

  function markNotificationRead(notificationId) {
    return save((draft) => {
      const notice = draft.notifications.find((item) => item.id === notificationId);
      if (!notice) return result(false, null, "通知不存在", "NOT_FOUND");
      notice.read = true;
      return result(true, notice);
    }, "notification");
  }

  function markAllNotificationsRead(userId) {
    return save((draft) => {
      draft.notifications.filter((item) => item.userId === userId).forEach((notice) => {
        notice.read = true;
      });
      return result(true, true);
    }, "notification");
  }

  const academicAllowedMethods = new Set([
    "setCurrentUser",
    "updatePreferences",
    "bookSession",
    "joinWaitlist",
    "leaveWaitlist",
    "cancelBooking",
    "enrollSeries",
    "reviewBooking",
    "createClass",
    "updateClass",
    "deleteClass",
    "addClassMembers",
    "removeClassMember",
    "createSession",
    "createSeries",
    "updateSession",
    "syncSessionRoster",
    "addSessionRosterStudents",
    "removeSessionRosterStudent",
    "updateSeriesSchedule",
    "cancelSession",
    "resolveChangeRequest",
    "createStudent",
    "createAssessment",
    "saveAssessmentScores",
    "archiveAssessment",
    "saveGradePolicy",
    "updateStudent",
    "markNotificationRead",
    "markAllNotificationsRead"
  ]);

  function academicMethodSchoolId(draft, method, input, actorId) {
    if (method === "updateClass" || method === "deleteClass" || method === "addClassMembers" || method === "removeClassMember") {
      return getClass(draft, input.classId)?.schoolId || "";
    }
    if (method === "createClass" || method === "createStudent") {
      return input.schoolId || activeAcademicSchoolId(draft, actorId);
    }
    if (method === "createSession" || method === "createSeries") {
      return getClass(draft, input.classId)?.schoolId || input.schoolId || activeAcademicSchoolId(draft, actorId);
    }
    if (method === "updateSeriesSchedule") return draft.series.find((item) => item.id === input.seriesId)?.schoolId || "";
    if (
      method === "updateSession" ||
      method === "cancelSession" ||
      method === "bookSession" ||
      method === "syncSessionRoster" ||
      method === "addSessionRosterStudents" ||
      method === "removeSessionRosterStudent"
    ) {
      return schoolIdForSession(draft, input.sessionId);
    }
    if (method === "cancelBooking" || method === "reviewBooking") {
      return schoolIdForBooking(draft, input.bookingId || input.sessionId);
    }
    if (method === "joinWaitlist") return schoolIdForSession(draft, input.sessionId) || draft.series.find((item) => item.id === input.seriesId)?.schoolId || "";
    if (method === "leaveWaitlist") {
      const entry = draft.waitlist.find((item) => item.id === input.waitlistId);
      return entry ? schoolIdForSession(draft, entry.sessionId) || (entry.sessionIds || []).map((id) => schoolIdForSession(draft, id)).find(Boolean) : "";
    }
    if (method === "enrollSeries") return draft.series.find((item) => item.id === input.seriesId)?.schoolId || "";
    if (method === "resolveChangeRequest") return schoolIdForChangeRequest(draft, input.requestId);
    if (method === "createAssessment") return getClass(draft, input.classId)?.schoolId || "";
    if (method === "saveAssessmentScores" || method === "archiveAssessment") {
      return draft.assessments.find((item) => item.id === input.assessmentId)?.schoolId || "";
    }
    if (method === "saveGradePolicy") return input.schoolId || activeAcademicSchoolId(draft, actorId);
    if (method === "updateStudent") {
      const ownSchoolId = activeAcademicSchoolId(draft, actorId);
      return studentBelongsToSchool(draft, input.studentId, ownSchoolId) ? ownSchoolId : "";
    }
    return "";
  }

  function guardAcademicOperation(method, input) {
    const draft = getState();
    const current = getUser(draft, draft.currentUserId);
    if (current?.role !== "academic") return null;
    if (input?.actorId && input.actorId !== current.id) {
      return result(false, null, "不能冒用其他账号执行操作", "FORBIDDEN");
    }
    const actorId = current.id;
    const actor = current;
    if (!academicAllowedMethods.has(method)) {
      return result(false, null, "学校教务无权执行该操作", "FORBIDDEN");
    }
    const schoolId = activeAcademicSchoolId(draft, actorId);
    if (!schoolId) return result(false, null, "账号未绑定学校", "FORBIDDEN");
    const teacherId = input?.teacherId || input?.patch?.teacherId;
    if (teacherId) {
      const member = draft.schoolMemberships.some(
        (item) => item.schoolId === schoolId && item.userId === teacherId && item.role === "teacher" && item.status === "active"
      );
      if (!member) return result(false, null, "授课教师不属于本校", "OUT_OF_SCOPE");
    }
    if (method === "bookSession" && !studentBelongsToSchool(draft, input.studentId, schoolId)) {
      return result(false, null, "学生不属于本校", "OUT_OF_SCOPE");
    }
    if (method === "updateStudent") {
      if (!studentBelongsToSchool(draft, input.studentId, schoolId)) {
        return result(false, null, "学生不属于本校", "OUT_OF_SCOPE");
      }
      const allowedFields = new Set(["program", "level", "learningGoal", "notes", "tags", "preferredTeacherId"]);
      const invalidField = Object.keys(input.patch || {}).find((field) => !allowedFields.has(field));
      if (invalidField) return result(false, null, "学校教务只能维护本校学习档案字段", "FORBIDDEN");
    }
    const resourceSchoolId = academicMethodSchoolId(draft, method, input || {}, actorId);
    if (Object.prototype.hasOwnProperty.call(input || {}, "schoolId") && input.schoolId !== schoolId) {
      return result(false, null, "不能操作其他学校的数据", "OUT_OF_SCOPE");
    }
    if (resourceSchoolId && resourceSchoolId !== schoolId) {
      return result(false, null, "不能操作其他学校的数据", "OUT_OF_SCOPE");
    }
    return null;
  }

  function resetDemo() {
    state = normalize(seedFactory.createSeedData());
    try {
      global.localStorage.setItem(STORE_KEY, JSON.stringify(state));
      global.localStorage.removeItem(LEGACY_KEY);
    } catch (error) {
      console.warn("Unable to reset demo state", error);
    }
    emit("reset");
    return result(true, clone(state));
  }

  const rawApi = {
    STORE_KEY,
    LEGACY_KEY,
    CHANGE_EVENT,
    getState,
    subscribe,
    resetDemo,
    setCurrentUser,
    updatePreferences,
    createSchool,
    createSchoolStaff,
    updateSchool,
    deleteSchool,
    saveSchoolMembership,
    bookSession,
    joinWaitlist,
    leaveWaitlist,
    cancelBooking,
    reviewBooking,
    enrollSeries,
    createClass,
    updateClass,
    deleteClass,
    addClassMembers,
    removeClassMember,
    createSession,
    createSeries,
    updateSession,
    syncSessionRoster,
    addSessionRosterStudents,
    removeSessionRosterStudent,
    updateSeriesSchedule,
    cancelSession,
    requestSessionChange,
    resolveChangeRequest,
    saveInteractionSet,
    rollbackInteractionVersion,
    assignInteractionSessions,
    excludeInteractionSession,
    unassignInteractionSet,
    createSubject,
    updateSubject,
    deleteSubject,
    createCourse,
    updateCourse,
    setCourseStatus,
    deleteCourse,
    createLesson,
    updateLesson,
    setLessonStatus,
    deleteLesson,
    moveLesson,
    createStudent,
    addMockMaterial,
    attachMaterial,
    detachMaterial,
    excludeMaterialSession,
    addMaterialVersion,
    setMaterialStatus,
    trackDownload,
    createAssessment,
    saveAssessmentScores,
    archiveAssessment,
    saveGradePolicy,
    recordAttempt,
    updateStudent,
    markNotificationRead,
    markAllNotificationsRead
  };
  const guardedMethodNames = Object.keys(rawApi).filter((name) => !["STORE_KEY", "LEGACY_KEY", "CHANGE_EVENT", "getState", "subscribe", "resetDemo"].includes(name));
  const api = { ...rawApi };
  guardedMethodNames.forEach((method) => {
    api[method] = (input, ...rest) => {
      const normalizedInput = input && typeof input === "object" ? input : {};
      const denied = guardAcademicOperation(method, normalizedInput);
      if (denied) return denied;
      return rawApi[method](input, ...rest);
    };
  });

  global.AICloudPlatformStore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
