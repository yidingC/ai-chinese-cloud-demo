(function attachSeedData(global) {
  "use strict";

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function atTime(date, hour, minute) {
    const next = new Date(date);
    next.setHours(hour, minute, 0, 0);
    return next;
  }

  function iso(date) {
    return date.toISOString();
  }

  function createSeedData() {
    const now = new Date();
    const todayAt = atTime(now, now.getHours(), Math.max(0, now.getMinutes() - 10));
    const liveStart = new Date(todayAt);
    const liveEnd = new Date(liveStart.getTime() + 40 * 60 * 1000);
    const previewStart = atTime(addDays(now, 1), 20, 0);
    const waitlistStart = atTime(addDays(now, 2), 19, 30);
    const reviewStart = atTime(addDays(now, 4), 19, 0);
    const pastStart = atTime(addDays(now, -1), 20, 0);
    const pastEnd = new Date(pastStart.getTime() + 40 * 60 * 1000);
    const seriesStarts = [3, 10, 17, 24].map((day) => atTime(addDays(now, day), 18, 30));
    const seriesIds = ["series-session-1", "series-session-2", "series-session-3", "series-session-4"];
    const foodSeriesLessonIds = ["lesson-food", "lesson-food-taste", "lesson-food-drinks", "lesson-food-pay"];

    // 印尼七年级中文社团课：一学期 24 节，每周一次，同一时间。
    const clubLessonTopics = [
      "你好，中文社团！",
      "我叫……",
      "数字 1 到 10",
      "你几岁？",
      "我的家人",
      "我的学校",
      "现在几点？",
      "今天星期几？",
      "天气怎么样？",
      "我喜欢……",
      "颜色和衣服",
      "我的身体",
      "我想吃……",
      "中国小吃",
      "在餐厅点餐",
      "买东西",
      "我的教室",
      "我的爱好",
      "运动真有趣",
      "动物朋友",
      "问路和方位",
      "打电话",
      "节日和祝福",
      "学期汇报演出"
    ];
    const clubLessonIds = clubLessonTopics.map((_, index) =>
      index === 0 ? "lesson-club-chinese" : `lesson-club-${String(index + 1).padStart(2, "0")}`
    );
    const clubSessionIds = clubLessonTopics.map((_, index) => `club-session-${index + 1}`);
    const clubStarts = clubLessonTopics.map((_, index) => atTime(addDays(now, 3 + index * 7), 15, 30));
    const clubWeekday = new Date(addDays(now, 3)).getDay();

    const users = [
      {
        id: "student-anisa",
        role: "student",
        name: "Anisa",
        nameZh: "安",
        phone: "+62 812 0000 1821",
        avatar: "安",
        timeZone: "Asia/Jakarta",
        locale: "id-ID",
        status: "active"
      },
      {
        id: "student-raymond",
        role: "student",
        name: "Raymond",
        nameZh: "雷",
        phone: "+86 139 0000 2333",
        avatar: "雷",
        timeZone: "Asia/Shanghai",
        locale: "zh-CN",
        status: "active"
      },
      {
        id: "student-maya",
        role: "student",
        name: "Maya Putri",
        nameZh: "玛雅",
        phone: "+62 813 8000 2121",
        avatar: "玛",
        timeZone: "Asia/Jakarta",
        locale: "id-ID",
        status: "active"
      },
      {
        id: "student-kevin",
        role: "student",
        name: "Kevin Tan",
        nameZh: "凯文",
        phone: "+65 9000 8801",
        avatar: "凯",
        timeZone: "Asia/Singapore",
        locale: "en-SG",
        status: "active"
      },
      {
        id: "teacher-lina",
        role: "teacher",
        name: "Lina 老师",
        avatar: "Li",
        timeZone: "Asia/Shanghai",
        locale: "zh-CN",
        status: "active",
        specialties: ["口语", "大班互动", "入门"],
        experienceYears: 8,
        bio: "擅长用游戏和情境对话，让零基础学习者在轻松氛围中开口说中文。"
      },
      {
        id: "teacher-berenice",
        role: "teacher",
        name: "Berenice 老师",
        avatar: "Be",
        timeZone: "Asia/Jakarta",
        locale: "zh-CN",
        status: "active",
        specialties: ["发音", "阅读", "儿童"],
        experienceYears: 6,
        bio: "关注每个学生的表达节奏，擅长把复习内容设计成可重复练习的小游戏。"
      },
      {
        id: "operator-ray",
        role: "operator",
        name: "Ray 教学管理",
        avatar: "Ra",
        timeZone: "Asia/Shanghai",
        locale: "zh-CN",
        status: "active",
        title: "课程教学管理负责人"
      },
      {
        id: "academic-shengxin",
        role: "academic",
        name: "Dewi 教务",
        avatar: "De",
        timeZone: "Asia/Jakarta",
        locale: "zh-CN",
        status: "active",
        title: "印尼圣心学校教务负责人"
      },
      {
        id: "academic-demo",
        role: "academic",
        name: "Sri 教务",
        avatar: "Sr",
        timeZone: "Asia/Jakarta",
        locale: "zh-CN",
        status: "active",
        title: "AI Chinese 合作校区教务"
      }
    ];

    const students = [
      {
        userId: "student-anisa",
        program: "Mandarin Explorer",
        level: "初级 2",
        className: "周三晚 A 班",
        learningGoal: "日常问候与旅行表达",
        preferredTeacherId: "teacher-lina",
        preferredTimeZone: "Asia/Jakarta",
        joinedAt: iso(addDays(now, -42)),
        tags: ["印尼", "移动端高频", "口语优先"],
        notes: "喜欢游戏化练习，预习完成率较高。"
      },
      {
        userId: "student-raymond",
        program: "Mandarin Explorer",
        level: "初级 1",
        className: "周三晚 B 班",
        learningGoal: "HSK 1 基础",
        preferredTeacherId: "teacher-berenice",
        preferredTimeZone: "Asia/Shanghai",
        joinedAt: iso(addDays(now, -16)),
        tags: ["上海", "晚间课", "需要复习提醒"],
        notes: "工作日晚上可上课。"
      },
      {
        userId: "student-maya",
        program: "Mandarin Junior",
        level: "启蒙 3",
        className: "周六少儿班",
        learningGoal: "学校场景与拼音",
        preferredTeacherId: "teacher-lina",
        preferredTimeZone: "Asia/Jakarta",
        joinedAt: iso(addDays(now, -80)),
        tags: ["少儿", "家长关注预习", "发音"],
        notes: "喜欢音频材料。"
      },
      {
        userId: "student-kevin",
        program: "Mandarin Explorer",
        level: "初级 3",
        className: "周二晚 A 班",
        learningGoal: "商务旅行中文",
        preferredTeacherId: "teacher-berenice",
        preferredTimeZone: "Asia/Singapore",
        joinedAt: iso(addDays(now, -110)),
        tags: ["新加坡", "商务", "进度快"],
        notes: "可接受临时候补通知。"
      }
    ];

    // 为学校教务演示补充同校学生样本：7年级A班 5 人、8年级B班 5 人，
    // 刚好满足“每位教师至少 5 名有效学生才能上榜”的排行门槛，演示名单不堆人。
    const schoolDemoStudents = [
      ["student-nadia", "Nadia Putri", "娜", "初级 2"],
      ["student-bayu", "Bayu Pratama", "Bay", "初级 2"]
    ];
    schoolDemoStudents.forEach(([id, name, avatar, level], index) => {
      users.push({
        id,
        role: "student",
        name,
        avatar,
        phone: `+62 812 9000 ${String(2100 + index)}`,
        timeZone: "Asia/Jakarta",
        locale: "id-ID",
        status: "active"
      });
      students.push({
        userId: id,
        program: "Mandarin Explorer",
        level,
        className: "印尼圣心学校7年级A班",
        learningGoal: "学校中文课程与日常表达",
        preferredTeacherId: "teacher-lina",
        preferredTimeZone: "Asia/Jakarta",
        joinedAt: iso(addDays(now, -35 + index * 3)),
        tags: ["印尼圣心学校", "校内班", index % 2 ? "口语" : "需要复习提醒"],
        notes: index % 2 ? "课堂参与积极，适合增加口语任务。" : "需要定期复习提醒。"
      });
    });

    // 8 年级 B 班用于第二位教师的排行样本（同样保持 5 人）。
    const schoolDemoStudentsB = [
      ["student-dewi", "Dewi Anggraini", "德", "初级 2"],
      ["student-putra", "Putra Santoso", "普", "初级 1"],
      ["student-laksmi", "Laksmi Wardani", "拉", "初级 3"],
      ["student-rio", "Rio Kurniawan", "里", "初级 2"],
      ["student-ayu", "Ayu Permata", "阿", "初级 1"]
    ];
    schoolDemoStudentsB.forEach(([id, name, avatar, level], index) => {
      users.push({
        id,
        role: "student",
        name,
        avatar,
        phone: `+62 812 7000 ${String(3100 + index)}`,
        timeZone: "Asia/Jakarta",
        locale: "id-ID",
        status: "active"
      });
      students.push({
        userId: id,
        program: "Mandarin Explorer",
        level,
        className: "印尼圣心学校8年级B班",
        learningGoal: "校内中文课程与综合表达",
        preferredTeacherId: "teacher-berenice",
        preferredTimeZone: "Asia/Jakarta",
        joinedAt: iso(addDays(now, -30 + index * 2)),
        tags: ["印尼圣心学校", "校内班", index % 2 ? "发音" : "阅读"],
        notes: index % 2 ? "发音基础较好，可增加阅读任务。" : "需要更多口语表达机会。"
      });
    });

    const subjects = [
      { id: "subject-chinese", name: "中文", description: "中文课程体系与课节内容", color: "#6552ff", order: 1 }
    ];

    const folders = [
      { id: "folder-greetings", subjectId: "subject-chinese", name: "问候与时间", order: 1, color: "#f4a2c1", tags: ["入门", "日常表达"], status: "published", description: "问候、时间、日期和日常表达" },
      { id: "folder-campus", subjectId: "subject-chinese", name: "校园与生活", order: 2, color: "#69d5c5", tags: ["校园", "对话"], status: "published", description: "校园、朋友、饮食和旅行场景" },
      { id: "folder-travel", subjectId: "subject-chinese", name: "旅行中文", order: 3, color: "#ffad67", tags: ["旅行", "场景"], status: "published", description: "机场、酒店与交通表达" },
      { id: "folder-food-series", subjectId: "subject-chinese", name: "餐厅中文", order: 4, color: "#ffad67", tags: ["饮食", "系列课"], status: "published", description: "餐厅点餐主题的系列课节" },
      { id: "folder-club", subjectId: "subject-chinese", name: "中文社团", order: 5, color: "#8c7bff", tags: ["社团", "学期课"], status: "published", description: "中文社团学期系列课节" }
    ];

    const lessons = [
      {
        id: "lesson-greetings",
        folderId: "folder-greetings",
        title: "嗨！你好！",
        subtitle: "Halo! Apa kabar?",
        description: "学习问候、自我介绍和一天中的不同时间。",
        durationMinutes: 40,
        tags: ["入门", "口语", "问候"],
        color: "#6552ff",
        coverEmoji: "👋",
        status: "published",
        order: 1
      },
      {
        id: "lesson-time",
        folderId: "folder-greetings",
        title: "现在几点？",
        subtitle: "Sekarang jam berapa?",
        description: "用中文询问和回答时间，并理解一天中的时段。",
        durationMinutes: 40,
        tags: ["时间", "听力", "大班课"],
        color: "#66b7f4",
        coverEmoji: "🕒",
        status: "published",
        order: 2
      },
      {
        id: "lesson-friends",
        folderId: "folder-campus",
        title: "认识新朋友",
        subtitle: "Berkenalan dengan teman baru",
        description: "练习姓名、国家和“很高兴认识你”。",
        durationMinutes: 40,
        tags: ["自我介绍", "对话", "初级"],
        color: "#69d5c5",
        coverEmoji: "🧑‍🤝‍🧑",
        status: "published",
        order: 1
      },
      ...clubLessonTopics.map((topic, index) => ({
        id: clubLessonIds[index],
        folderId: "folder-club",
        title: topic,
        subtitle: `Klub Mandarin · Pertemuan ${index + 1}`,
        description: `中文社团第 ${index + 1} 课：${topic}`,
        durationMinutes: 40,
        tags: ["社团课", "七年级", `第 ${index + 1} 课`],
        color: "#8c7bff",
        coverEmoji: "🎒",
        status: "published",
        order: index + 1
      })),
      {
        id: "lesson-food",
        folderId: "folder-food-series",
        title: "我想吃面条",
        subtitle: "Saya ingin makan mie",
        description: "在餐厅点餐，表达喜欢和不喜欢的食物。",
        durationMinutes: 40,
        tags: ["饮食", "情境对话", "词汇"],
        color: "#ffad67",
        coverEmoji: "🍜",
        status: "published",
        order: 1
      },
      {
        id: "lesson-food-taste",
        folderId: "folder-food-series",
        title: "有点辣，很好吃",
        subtitle: "Sedikit pedas, enak!",
        description: "表达口味和喜好，学会说辣、甜、酸、咸。",
        durationMinutes: 40,
        tags: ["饮食", "口味", "形容词"],
        color: "#ff8a5c",
        coverEmoji: "🌶️",
        status: "published",
        order: 2
      },
      {
        id: "lesson-food-drinks",
        folderId: "folder-food-series",
        title: "你想喝什么？",
        subtitle: "Mau minum apa?",
        description: "点饮料和甜点，练习询问和回答。",
        durationMinutes: 40,
        tags: ["饮食", "饮料", "对话"],
        color: "#66b7f4",
        coverEmoji: "🥤",
        status: "published",
        order: 3
      },
      {
        id: "lesson-food-pay",
        folderId: "folder-food-series",
        title: "一共多少钱？",
        subtitle: "Berapa totalnya?",
        description: "在餐厅结账、付款和道别。",
        durationMinutes: 40,
        tags: ["饮食", "付款", "情境对话"],
        color: "#69d5c5",
        coverEmoji: "💳",
        status: "published",
        order: 4
      }
    ];

    const sessions = [
      {
        id: "session-live",
        lessonId: "lesson-greetings",
        seriesId: null,
        teacherId: "teacher-lina",
        title: "问候口语大班课",
        className: "印尼圣心学校7年级A班",
        startAt: iso(liveStart),
        endAt: iso(liveEnd),
        capacity: 30,
        status: "published",
        bookingCloseAt: iso(new Date(liveStart.getTime() + 10 * 60 * 1000)),
        cancelCloseAt: iso(new Date(liveStart.getTime() - 2 * 60 * 60 * 1000)),
        language: "zh-id",
        roomLabel: "大班教室 A",
        source: "single"
      },
      {
        id: "session-preview",
        lessonId: "lesson-friends",
        seriesId: null,
        teacherId: "teacher-berenice",
        title: "认识新朋友 · 体验课",
        className: "印尼希望学校7年级体验班",
        startAt: iso(previewStart),
        endAt: iso(new Date(previewStart.getTime() + 40 * 60 * 1000)),
        capacity: 30,
        status: "published",
        bookingCloseAt: iso(new Date(previewStart.getTime() - 30 * 60 * 1000)),
        cancelCloseAt: iso(new Date(previewStart.getTime() - 2 * 60 * 60 * 1000)),
        language: "zh-id",
        roomLabel: "大班教室 B",
        source: "single"
      },
      {
        id: "session-waitlist-full",
        lessonId: "lesson-time",
        seriesId: null,
        teacherId: "teacher-lina",
        title: "时间表达 · 满员演练课",
        className: "印尼光明学校7年级B班",
        startAt: iso(waitlistStart),
        endAt: iso(new Date(waitlistStart.getTime() + 40 * 60 * 1000)),
        capacity: 2,
        status: "published",
        bookingCloseAt: iso(new Date(waitlistStart.getTime() - 30 * 60 * 1000)),
        cancelCloseAt: iso(new Date(waitlistStart.getTime() - 2 * 60 * 60 * 1000)),
        language: "zh-id",
        roomLabel: "大班教室 A",
        source: "single"
      },
      {
        id: "session-review",
        lessonId: "lesson-food",
        seriesId: null,
        teacherId: "teacher-lina",
        title: "餐厅点餐 · 报名审核课",
        className: "印尼圣心学校8年级A班",
        startAt: iso(reviewStart),
        endAt: iso(new Date(reviewStart.getTime() + 40 * 60 * 1000)),
        capacity: 16,
        status: "published",
        bookingCloseAt: iso(new Date(reviewStart.getTime() - 30 * 60 * 1000)),
        cancelCloseAt: iso(new Date(reviewStart.getTime() - 2 * 60 * 60 * 1000)),
        language: "zh-id",
        roomLabel: "大班教室 C",
        source: "single",
        approvalRequired: true
      },
      {
        id: "session-past",
        lessonId: "lesson-greetings",
        seriesId: null,
        teacherId: "teacher-lina",
        title: "问候复习课",
        className: "印尼圣心学校7年级A班",
        startAt: iso(pastStart),
        endAt: iso(pastEnd),
        capacity: 30,
        status: "published",
        bookingCloseAt: iso(new Date(pastStart.getTime() - 30 * 60 * 1000)),
        cancelCloseAt: iso(new Date(pastStart.getTime() - 2 * 60 * 60 * 1000)),
        language: "zh-id",
        roomLabel: "大班教室 A",
        source: "single"
      },
      {
        id: "session-8b-past",
        lessonId: "lesson-greetings",
        seriesId: null,
        teacherId: "teacher-berenice",
        title: "8B 班问候表达复习课",
        className: "印尼圣心学校8年级B班",
        startAt: iso(addDays(now, -5)),
        endAt: iso(new Date(addDays(now, -5).getTime() + 40 * 60 * 1000)),
        capacity: 24,
        status: "published",
        bookingCloseAt: iso(new Date(addDays(now, -5).getTime() - 30 * 60 * 1000)),
        cancelCloseAt: iso(new Date(addDays(now, -5).getTime() - 2 * 60 * 60 * 1000)),
        language: "zh-id",
        roomLabel: "大班教室 B",
        source: "single"
      },
      ...seriesStarts.map((start, index) => ({
        id: seriesIds[index],
        lessonId: foodSeriesLessonIds[index],
        seriesId: "series-weekly-food",
        teacherId: "teacher-lina",
        title: `餐厅中文系列 · 第 ${index + 1} 课`,
        className: "印尼圣心学校7年级A班",
        startAt: iso(start),
        endAt: iso(new Date(start.getTime() + 40 * 60 * 1000)),
        capacity: 24,
        status: "published",
        bookingCloseAt: iso(new Date(start.getTime() - 30 * 60 * 1000)),
        cancelCloseAt: iso(new Date(start.getTime() - 2 * 60 * 60 * 1000)),
        language: "zh-id",
        roomLabel: "系列教室 C",
        source: "series"
      })),
      ...clubLessonTopics.map((topic, index) => ({
        id: clubSessionIds[index],
        lessonId: clubLessonIds[index],
        seriesId: "series-club-semester",
        teacherId: "teacher-berenice",
        title: `社团中文 第 ${index + 1} 课 · ${topic}`,
        className: "印尼培民学校7年级中文社团",
        startAt: iso(clubStarts[index]),
        endAt: iso(new Date(clubStarts[index].getTime() + 40 * 60 * 1000)),
        capacity: 32,
        status: "published",
        bookingCloseAt: iso(new Date(clubStarts[index].getTime() - 30 * 60 * 1000)),
        cancelCloseAt: iso(new Date(clubStarts[index].getTime() - 2 * 60 * 60 * 1000)),
        language: "zh-id",
        roomLabel: "社团教室 D",
        source: "series"
      }))
    ];

    const series = [
      {
        id: "series-weekly-food",
        folderId: "folder-food-series",
        lessonIds: foodSeriesLessonIds,
        lessonId: "lesson-food",
        title: "餐厅中文 · 四周系列大班课",
        description: "每周一次，从点餐、口味到结账，连续练习餐厅场景。",
        teacherId: "teacher-lina",
        capacity: 24,
        durationMinutes: 40,
        sessionIds: seriesIds,
        weekdays: [1, 3, 5, 0],
        status: "published",
        createdAt: iso(addDays(now, -5))
      },
      {
        id: "series-club-semester",
        folderId: "folder-club",
        lessonIds: clubLessonIds,
        lessonId: "lesson-club-chinese",
        title: "中文社团 · 一学期 24 节",
        description: "印尼七年级中文社团课：每周一次，24 节课从问候、数字到校园生活，配合学期汇报演出。",
        teacherId: "teacher-berenice",
        capacity: 32,
        durationMinutes: 40,
        sessionIds: clubSessionIds,
        weekdays: [clubWeekday],
        status: "published",
        createdAt: iso(addDays(now, -2))
      }
    ];

    /* 班级主数据：课次班级负责教学过程，学生档案里的班级作为主班级。
       同一班级名只建一个稳定 id，后续改名不会拆散历史成绩。 */
    const classIdByName = new Map();
    const classes = [];
    const classSeedRows = [
      ...sessions.map((session) => ({ name: session.className, teacherId: session.teacherId })),
      ...students.map((profile) => ({ name: profile.className || "待分班", teacherId: profile.preferredTeacherId || "teacher-lina" }))
    ];
    classSeedRows.forEach((row) => {
      const name = row.name || "待分配班级";
      if (classIdByName.has(name)) return;
      const id = `class-${classes.length + 1}`;
      classIdByName.set(name, id);
      classes.push({
        id,
        name,
        teacherId: row.teacherId,
        status: "active",
        createdAt: iso(addDays(now, -120))
      });
    });
    sessions.forEach((session) => {
      session.classId = classIdByName.get(session.className) || classes[0].id;
    });
    students.forEach((profile) => {
      profile.primaryClassId = classIdByName.get(profile.className || "待分班") || classes[0].id;
    });

    const bookings = [
      { id: "booking-live-anisa", sessionId: "session-live", studentId: "student-anisa", status: "booked", source: "student", createdAt: iso(addDays(now, -3)), enrollmentId: null },
      { id: "booking-live-maya", sessionId: "session-live", studentId: "student-maya", status: "booked", source: "student", createdAt: iso(addDays(now, -2)), enrollmentId: null },
      { id: "booking-live-raymond", sessionId: "session-live", studentId: "student-raymond", status: "booked", source: "operator", createdAt: iso(addDays(now, -2)), enrollmentId: null },
      { id: "booking-waitlist-raymond", sessionId: "session-waitlist-full", studentId: "student-raymond", status: "booked", source: "student", createdAt: iso(addDays(now, -1)), enrollmentId: null },
      { id: "booking-waitlist-maya", sessionId: "session-waitlist-full", studentId: "student-maya", status: "booked", source: "student", createdAt: iso(addDays(now, -1)), enrollmentId: null },
      { id: "booking-past-anisa", sessionId: "session-past", studentId: "student-anisa", status: "booked", source: "student", createdAt: iso(addDays(now, -8)), enrollmentId: null },
      { id: "booking-past-raymond", sessionId: "session-past", studentId: "student-raymond", status: "booked", source: "operator", createdAt: iso(addDays(now, -7)), enrollmentId: null },
      { id: "booking-preview-kevin", sessionId: "session-preview", studentId: "student-kevin", status: "booked", source: "student", createdAt: iso(addDays(now, -1)), enrollmentId: null },
      { id: "booking-review-kevin", sessionId: "session-review", studentId: "student-kevin", status: "pending_review", source: "student", createdAt: iso(addDays(now, -1)), enrollmentId: null },
      ...schoolDemoStudentsB.map(([studentId], index) => ({
        id: `booking-8b-${index + 1}`,
        sessionId: "session-8b-past",
        studentId,
        status: "booked",
        source: "student",
        createdAt: iso(addDays(now, -10 + index)),
        enrollmentId: null
      }))
    ];

    const classEnrollmentByKey = new Map();
    const classEnrollments = [];
    function ensureClassEnrollment(classId, studentId, source, joinedAt) {
      const key = `${classId}:${studentId}`;
      if (classEnrollmentByKey.has(key)) return;
      const enrollment = {
        id: `class-enrollment-${classEnrollments.length + 1}`,
        classId,
        studentId,
        status: "active",
        joinedAt,
        source
      };
      classEnrollmentByKey.set(key, enrollment);
      classEnrollments.push(enrollment);
    }
    students.forEach((profile) => {
      if (profile.primaryClassId) ensureClassEnrollment(profile.primaryClassId, profile.userId, "profile", profile.joinedAt);
    });
    bookings.filter((booking) => booking.status === "booked").forEach((booking) => {
      const session = sessions.find((item) => item.id === booking.sessionId);
      if (session?.classId) ensureClassEnrollment(session.classId, booking.studentId, "booking", booking.createdAt);
    });

    const schools = [
      { id: "school-sacred-heart", name: "印尼圣心学校", code: "SH", timeZone: "Asia/Jakarta", status: "active", createdAt: iso(addDays(now, -180)) },
      { id: "school-hope", name: "印尼希望学校", code: "HOPE", timeZone: "Asia/Jakarta", status: "active", createdAt: iso(addDays(now, -150)) },
      { id: "school-light", name: "印尼光明学校", code: "LIGHT", timeZone: "Asia/Jakarta", status: "active", createdAt: iso(addDays(now, -140)) },
      { id: "school-bina", name: "印尼培民学校", code: "BINA", timeZone: "Asia/Jakarta", status: "active", createdAt: iso(addDays(now, -130)) },
      { id: "school-demo", name: "AI Chinese 合作校区", code: "DEMO", timeZone: "Asia/Jakarta", status: "active", createdAt: iso(addDays(now, -120)) }
    ];
    function schoolIdForClassName(name) {
      if (name.includes("圣心")) return "school-sacred-heart";
      if (name.includes("希望")) return "school-hope";
      if (name.includes("光明")) return "school-light";
      if (name.includes("培民")) return "school-bina";
      return "school-demo";
    }
    classes.forEach((classItem) => {
      classItem.schoolId = schoolIdForClassName(classItem.name);
    });
    sessions.forEach((session) => {
      const classGroup = classes.find((item) => item.id === session.classId);
      session.schoolId = classGroup?.schoolId || schoolIdForClassName(session.className);
    });
    series.forEach((series) => {
      const firstSession = (series.sessionIds || []).map((id) => sessions.find((session) => session.id === id)).find(Boolean);
      series.schoolId = firstSession?.schoolId || schoolIdForClassName(firstSession?.className || "");
    });

    const schoolMemberships = [];
    function ensureSchoolMembership(schoolId, userId, role, joinedAt) {
      if (!schoolId || !userId || schoolMemberships.some((item) => item.schoolId === schoolId && item.userId === userId && item.status === "active")) return;
      schoolMemberships.push({
        id: `school-membership-${schoolMemberships.length + 1}`,
        schoolId,
        userId,
        role,
        status: "active",
        joinedAt: joinedAt || iso(addDays(now, -90))
      });
    }
    classes.forEach((classGroup) => {
      ensureSchoolMembership(classGroup.schoolId, classGroup.teacherId, "teacher", classGroup.createdAt);
      classEnrollments.filter((item) => item.classId === classGroup.id && item.status === "active").forEach((enrollment) => {
        ensureSchoolMembership(classGroup.schoolId, enrollment.studentId, "student", enrollment.joinedAt);
      });
    });
    ensureSchoolMembership("school-sacred-heart", "academic-shengxin", "academic", iso(addDays(now, -100)));
    ensureSchoolMembership("school-demo", "academic-demo", "academic", iso(addDays(now, -90)));

    const waitlist = [
      { id: "wait-session-waitlist-anisa", sessionId: "session-waitlist-full", sessionIds: [], studentId: "student-anisa", status: "waiting", createdAt: iso(addDays(now, -1)), seriesId: null }
    ];


    // ---- 预制互动模板库：题型 × 主题 × 难度 ----
    // 学生端 18 种题型全部入库：14 个主题 × 18 种题型 × 3 个难度。
    // 每个主题除词表外还带一套素材（排序句 / 填空 / 情景 / 对话 / 改错 / 归类 / 看图说话 / 开放问答），
    // 18 种题型都从同一套素材生成，老师换题型时不用重写内容。
    const templateTopics = [
      {
        id: "greeting",
        label: "问候与寒暄",
        emoji: "👋",
        words: [
          ["你好", "nǐ hǎo", "Halo", "🙋"],
          ["谢谢", "xièxie", "Terima kasih", "🙏"],
          ["再见", "zàijiàn", "Sampai jumpa", "👋"],
          ["不客气", "bú kèqi", "Sama-sama", "🤝"],
          ["早上好", "zǎoshang hǎo", "Selamat pagi", "🌅"]
        ],
        order: "我 很 高兴 认识 你",
        orderAdvanced: "今天 早上 我 和 新朋友 打招呼",
        sentence: "你好，很高兴认识你。",
        sentencePinyin: "Nǐ hǎo, hěn gāoxìng rènshi nǐ.",
        advanced: "今天早上我和新朋友打招呼。",
        advancedPinyin: "Jīntiān zǎoshang wǒ hé xīn péngyou dǎ zhāohu.",
        poll: "见面时你最常用哪种问候？",
        pollOptions: ["你好", "早上好", "挥挥手"],
        fill: { sentence: "你好，很____认识你。", answers: [["高兴", "gāoxìng"]] },
        scene: {
          zh: "早上你在校门口遇到老师。",
          meaning: "Pagi hari kamu bertemu guru di gerbang sekolah.",
          options: [
            { text: "老师好！", hint: "见到老师先问好，最有礼貌。", correct: true },
            { text: "再见！", hint: "「再见」是离开的时候说。", correct: false },
            { text: "不客气！", hint: "「不客气」用来回应别人的感谢。", correct: false }
          ]
        },
        dialogue: {
          them: "你好！你叫什么名字？",
          placeholder: "？",
          options: [
            { text: "我叫 Anisa，你呢？", hint: "先回答名字，再问对方。", correct: true },
            { text: "我要一杯茶。", hint: "这是点饮料，答非所问。", correct: false },
            { text: "今天很热。", hint: "这是在说天气，接不上。", correct: false }
          ]
        },
        correction: {
          words: [["早上", "zǎoshang"], ["我", "wǒ"], ["对", "duì"], ["老师", "lǎoshī"], ["说", "shuō"], ["谢谢", "xièxie"], ["。", ""]],
          wrong: 5,
          fix: "早上好",
          fixed: "早上我对老师说：早上好。",
          fixedPinyin: "Zǎoshang wǒ duì lǎoshī shuō: zǎoshang hǎo.",
          explain: "见到老师问候要说「早上好」；「谢谢」用在别人帮了你之后。"
        },
        categories: {
          groups: [
            { id: "meet", name: "问候与道别", meaning: "salam dan perpisahan", hint: "见面和离开时说" },
            { id: "thanks", name: "感谢与回应", meaning: "terima kasih dan jawabannya", hint: "感谢和回答感谢" }
          ],
          words: [["你好", "nǐ hǎo", "meet"], ["早上好", "zǎoshang hǎo", "meet"], ["再见", "zàijiàn", "meet"], ["谢谢", "xièxie", "thanks"], ["不客气", "bú kèqi", "thanks"], ["明天见", "míngtiān jiàn", "meet"]]
        },
        talk: { icon: "🖐️", alt: "一个人在挥手打招呼", meaning: "Seseorang melambaikan tangan untuk menyapa.", answer: "他在跟我打招呼。", answerPinyin: "Tā zài gēn wǒ dǎ zhāohu.", hint: "试试说：谁 ＋ 在做什么" },
        open: { prompt: "见到新朋友，你会怎么打招呼？为什么？", pattern: "见到新朋友，我会说 ______ 。", sample: "见到新朋友，我会说「你好」。", samplePinyin: "Jiàndào xīn péngyou, wǒ huì shuō «nǐ hǎo»." },
        build: [{ word: "你好", pinyin: "nǐ hǎo", meaning: "halo" }, { word: "不客气", pinyin: "bú kèqi", meaning: "sama-sama" }, { word: "早上好", pinyin: "zǎoshang hǎo", meaning: "selamat pagi" }]
      },
      {
        id: "name",
        label: "自我介绍",
        emoji: "🙋",
        words: [
          ["我叫", "wǒ jiào", "Nama saya", "🙋"],
          ["你呢", "nǐ ne", "Kamu?", "👉"],
          ["老师", "lǎoshī", "Guru", "👩‍🏫"],
          ["同学", "tóngxué", "Teman sekelas", "🧑‍🎓"],
          ["很高兴", "hěn gāoxìng", "Senang", "😊"]
        ],
        order: "我 叫 Anisa 你 呢",
        orderAdvanced: "我 是 印尼 学生 我 喜欢 学 中文",
        sentence: "我叫 Anisa，你呢？",
        sentencePinyin: "Wǒ jiào Anisa, nǐ ne?",
        advanced: "我是印尼学生，我喜欢学中文。",
        advancedPinyin: "Wǒ shì Yìnní xuéshēng, wǒ xǐhuan xué Zhōngwén.",
        poll: "你学中文多久了？",
        pollOptions: ["不到一年", "一到三年", "三年以上"],
        fill: { sentence: "我叫 Anisa，你____？", answers: [["呢", "ne"]] },
        scene: {
          zh: "新同学问你叫什么名字。",
          meaning: "Teman baru bertanya namamu.",
          options: [
            { text: "我叫 Kevin，很高兴认识你。", hint: "先报名字，再说一句客气话。", correct: true },
            { text: "我今年二十岁。", hint: "问的是名字，不是年龄。", correct: false },
            { text: "我要回家了。", hint: "这句话和自我介绍没关系。", correct: false }
          ]
        },
        dialogue: {
          them: "你是印尼人吗？",
          placeholder: "？",
          options: [
            { text: "是的，我是印尼人。", hint: "先回答「是」，再补充信息。", correct: true },
            { text: "我叫安。", hint: "回答的是名字，没回答是不是。", correct: false },
            { text: "我喜欢吃面条。", hint: "这是说爱好，答非所问。", correct: false }
          ]
        },
        correction: {
          words: [["请问", "qǐngwèn"], ["你", "nǐ"], ["什么名字", "shénme míngzi"], ["？", ""]],
          wrong: 2,
          fix: "叫什么名字",
          fixed: "请问，你叫什么名字？",
          fixedPinyin: "Qǐngwèn, nǐ jiào shénme míngzi?",
          explain: "问名字要说「叫什么名字」，不能只说「什么名字」。"
        },
        categories: {
          groups: [
            { id: "person", name: "称呼", meaning: "sebutan", hint: "称呼别人" },
            { id: "intro", name: "自我介绍常用语", meaning: "ungkapan perkenalan", hint: "介绍自己时说" }
          ],
          words: [["老师", "lǎoshī", "person"], ["同学", "tóngxué", "person"], ["我叫", "wǒ jiào", "intro"], ["你呢", "nǐ ne", "intro"], ["很高兴", "hěn gāoxìng", "intro"], ["请问", "qǐngwèn", "intro"]]
        },
        talk: { icon: "🙋", alt: "一个人举着手做自我介绍", meaning: "Seseorang mengangkat tangan memperkenalkan diri.", answer: "她在介绍自己。", answerPinyin: "Tā zài jièshào zìjǐ.", hint: "试试说：谁 ＋ 在做什么" },
        open: { prompt: "请介绍一下你自己，说说你的名字和爱好。", pattern: "我叫 ______ ，我喜欢 ______ 。", sample: "我叫 Anisa，我喜欢看书。", samplePinyin: "Wǒ jiào Anisa, wǒ xǐhuan kàn shū." },
        build: [{ word: "我叫", pinyin: "wǒ jiào", meaning: "nama saya" }, { word: "很高兴", pinyin: "hěn gāoxìng", meaning: "senang" }, { word: "老师", pinyin: "lǎoshī", meaning: "guru" }]
      },
      {
        id: "number",
        label: "数字与年龄",
        emoji: "🔢",
        words: [
          ["一", "yī", "Satu", "1️⃣"],
          ["二", "èr", "Dua", "2️⃣"],
          ["三", "sān", "Tiga", "3️⃣"],
          ["十", "shí", "Sepuluh", "🔟"],
          ["二十", "èrshí", "Dua puluh", "🔢"]
        ],
        order: "我 今年 二十 岁",
        orderAdvanced: "我们 班 一共 有 三十五 个 学生",
        sentence: "我今年二十岁。",
        sentencePinyin: "Wǒ jīnnián èrshí suì.",
        advanced: "我们班一共有三十五个学生。",
        advancedPinyin: "Wǒmen bān yígòng yǒu sānshíwǔ gè xuéshēng.",
        poll: "你今天几点开始上课？",
        pollOptions: ["七点", "八点", "九点"],
        fill: { sentence: "我今年二十____。", answers: [["岁", "suì"]] },
        scene: {
          zh: "老师问你的年龄。",
          meaning: "Guru bertanya umurmu.",
          options: [
            { text: "我今年二十岁。", hint: "用「我今年＋数字＋岁」回答。", correct: true },
            { text: "我今年二十。", hint: "中文说年龄要加「岁」。", correct: false },
            { text: "我有二十。", hint: "「有」不能用来表示年龄。", correct: false }
          ]
        },
        dialogue: {
          them: "你们班有多少个学生？",
          placeholder: "？",
          options: [
            { text: "有三十五个学生。", hint: "用「有＋数字＋个」回答数量。", correct: true },
            { text: "我们八点上课。", hint: "这回答的是时间。", correct: false },
            { text: "我今年二十岁。", hint: "这回答的是年龄。", correct: false }
          ]
        },
        correction: {
          words: [["我", "wǒ"], ["有", "yǒu"], ["二十", "èrshí"], ["岁", "suì"], ["。", ""]],
          wrong: 1,
          fix: "今年",
          fixed: "我今年二十岁。",
          fixedPinyin: "Wǒ jīnnián èrshí suì.",
          explain: "中文说年龄用「今年……岁」，不用「有」。"
        },
        categories: {
          groups: [
            { id: "small", name: "十以内", meaning: "di bawah sepuluh", hint: "一到九" },
            { id: "big", name: "十和十以上", meaning: "sepuluh ke atas", hint: "十、二十、百" }
          ],
          words: [["一", "yī", "small"], ["二", "èr", "small"], ["三", "sān", "small"], ["十", "shí", "big"], ["二十", "èrshí", "big"], ["五", "wǔ", "small"]]
        },
        talk: { icon: "🔢", alt: "黑板上写着数字 20", meaning: "Di papan tulis ada angka 20.", answer: "黑板上写着二十。", answerPinyin: "Hēibǎn shàng xiězhe èrshí.", hint: "试试说：什么 ＋ 在哪里" },
        open: { prompt: "你家有几口人？你今年多大？", pattern: "我家有 ______ 口人，我今年 ______ 岁。", sample: "我家有四口人，我今年二十岁。", samplePinyin: "Wǒ jiā yǒu sì kǒu rén, wǒ jīnnián èrshí suì." },
        build: [{ word: "二十", pinyin: "èrshí", meaning: "dua puluh" }, { word: "三十五", pinyin: "sānshíwǔ", meaning: "tiga puluh lima" }, { word: "一百", pinyin: "yì bǎi", meaning: "seratus" }]
      },
      {
        id: "food",
        label: "食物与口味",
        emoji: "🍜",
        words: [
          ["面条", "miàntiáo", "Mi", "🍜"],
          ["米饭", "mǐfàn", "Nasi", "🍚"],
          ["辣", "là", "Pedas", "🌶️"],
          ["好吃", "hǎochī", "Enak", "😋"],
          ["喝水", "hē shuǐ", "Minum air", "🥤"]
        ],
        order: "我 想 吃 面条",
        orderAdvanced: "这家 餐厅 的 牛肉面 非常 好吃",
        sentence: "我想吃面条。",
        sentencePinyin: "Wǒ xiǎng chī miàntiáo.",
        advanced: "这家餐厅的牛肉面非常好吃。",
        advancedPinyin: "Zhè jiā cāntīng de niúròu miàn fēicháng hǎochī.",
        poll: "你最喜欢哪种中国菜？",
        pollOptions: ["面条", "米饭", "饺子"],
        fill: { sentence: "我____吃面条。", answers: [["想", "xiǎng"]] },
        scene: {
          zh: "点菜时服务员问你要不要辣。",
          meaning: "Saat memesan, pelayan bertanya apakah kamu mau pedas.",
          options: [
            { text: "不要辣，谢谢。", hint: "直接说清口味，再加一句谢谢。", correct: true },
            { text: "我不辣。", hint: "「不辣」是描述菜，不是你的要求。", correct: false },
            { text: "我要辣，不要。", hint: "前后矛盾，说不清要求。", correct: false }
          ]
        },
        dialogue: {
          them: "你想吃什么？",
          placeholder: "？",
          options: [
            { text: "我想吃一碗面条。", hint: "用「我想吃＋食物」回答。", correct: true },
            { text: "我喝水。", hint: "对方问的是吃的。", correct: false },
            { text: "我很好。", hint: "这是在回答身体或心情。", correct: false }
          ]
        },
        correction: {
          words: [["我", "wǒ"], ["喜欢", "xǐhuan"], ["吃", "chī"], ["水", "shuǐ"], ["。", ""]],
          wrong: 2,
          fix: "喝",
          fixed: "我喜欢喝水。",
          fixedPinyin: "Wǒ xǐhuan hē shuǐ.",
          explain: "「水」是液体，要用动词「喝」；「吃」后面接要嚼的食物。"
        },
        categories: {
          groups: [
            { id: "eat", name: "吃的喝的", meaning: "makanan dan minuman", hint: "可以用「吃」或「喝」" },
            { id: "taste", name: "味道评价", meaning: "rasa dan penilaian", hint: "形容味道" }
          ],
          words: [["面条", "miàntiáo", "eat"], ["米饭", "mǐfàn", "eat"], ["喝水", "hē shuǐ", "eat"], ["辣", "là", "taste"], ["好吃", "hǎochī", "taste"], ["饺子", "jiǎozi", "eat"]]
        },
        talk: { icon: "🍜", alt: "一碗热面条", meaning: "Semangkuk mi panas.", answer: "这是一碗面条。", answerPinyin: "Zhè shì yì wǎn miàntiáo.", hint: "试试说：这 ＋ 是 ＋ 什么" },
        open: { prompt: "你最喜欢哪一样中国菜？为什么？", pattern: "我最喜欢 ______ ，因为 ______ 。", sample: "我最喜欢饺子，因为它很好吃。", samplePinyin: "Wǒ zuì xǐhuan jiǎozi, yīnwèi tā hěn hǎochī." },
        build: [{ word: "面条", pinyin: "miàntiáo", meaning: "mi" }, { word: "米饭", pinyin: "mǐfàn", meaning: "nasi" }, { word: "好吃", pinyin: "hǎochī", meaning: "enak" }]
      },
      {
        id: "restaurant",
        label: "餐厅点餐",
        emoji: "🥟",
        words: [
          ["点菜", "diǎn cài", "Pesan makanan", "📋"],
          ["菜单", "càidān", "Menu", "📖"],
          ["买单", "mǎidān", "Bayar", "💳"],
          ["服务员", "fúwùyuán", "Pelayan", "🙋‍♀️"],
          ["不要辣", "bú yào là", "Jangan pedas", "🚫"]
        ],
        order: "服务员 我 想 点菜",
        orderAdvanced: "请 给 我 一份 饺子 不要 放辣",
        sentence: "服务员，我想点菜。",
        sentencePinyin: "Fúwùyuán, wǒ xiǎng diǎn cài.",
        advanced: "请给我一份饺子，不要放辣。",
        advancedPinyin: "Qǐng gěi wǒ yí fèn jiǎozi, bú yào fàng là.",
        poll: "在餐厅你最先做什么？",
        pollOptions: ["看菜单", "叫服务员", "点饮料"],
        fill: { sentence: "服务员，我想____。", answers: [["点菜", "diǎn cài"]] },
        scene: {
          zh: "你吃完饭想付钱。",
          meaning: "Kamu sudah selesai makan dan mau membayar.",
          options: [
            { text: "服务员，买单！", hint: "结账说「买单」，先叫服务员。", correct: true },
            { text: "服务员，点菜！", hint: "「点菜」是刚开始吃饭时说的。", correct: false },
            { text: "服务员，不要辣！", hint: "这是点餐时的要求，不是结账。", correct: false }
          ]
        },
        dialogue: {
          them: "请问，您要喝点什么？",
          placeholder: "？",
          options: [
            { text: "我要一杯茶，谢谢。", hint: "用「我要一＋量词＋饮料」回答。", correct: true },
            { text: "我吃饱了。", hint: "这回答的是吃饭，不是喝的。", correct: false },
            { text: "菜单在这儿。", hint: "这回答的是菜单在哪儿。", correct: false }
          ]
        },
        correction: {
          words: [["服务员", "fúwùyuán"], ["请", "qǐng"], ["给", "gěi"], ["我", "wǒ"], ["一个", "yí gè"], ["饺子", "jiǎozi"], ["。", ""]],
          wrong: 4,
          fix: "一份",
          fixed: "服务员，请给我一份饺子。",
          fixedPinyin: "Fúwùyuán, qǐng gěi wǒ yí fèn jiǎozi.",
          explain: "「饺子」按份来点，说「一份饺子」；说「一个饺子」就变成只买一只了。"
        },
        categories: {
          groups: [
            { id: "order", name: "点餐用词", meaning: "kata untuk memesan", hint: "点菜的时候说" },
            { id: "pay", name: "结账与称呼", meaning: "membayar dan sebutan", hint: "叫人和付钱" }
          ],
          words: [["点菜", "diǎn cài", "order"], ["菜单", "càidān", "order"], ["不要辣", "bú yào là", "order"], ["买单", "mǎidān", "pay"], ["服务员", "fúwùyuán", "pay"], ["打包", "dǎbāo", "order"]]
        },
        talk: { icon: "🥟", alt: "服务员端来一盘饺子", meaning: "Pelayan membawa sepiring jiaozi.", answer: "服务员端来了饺子。", answerPinyin: "Fúwùyuán duān lái le jiǎozi.", hint: "试试说：谁 ＋ 做了什么" },
        open: { prompt: "在餐厅点菜的时候，你会怎么跟服务员说？", pattern: "我要 ______ ，不要 ______ 。", sample: "我要一份饺子，不要辣。", samplePinyin: "Wǒ yào yí fèn jiǎozi, bú yào là." },
        build: [{ word: "点菜", pinyin: "diǎn cài", meaning: "memesan makanan" }, { word: "菜单", pinyin: "càidān", meaning: "menu" }, { word: "服务员", pinyin: "fúwùyuán", meaning: "pelayan" }]
      },
      {
        id: "time",
        label: "时间与日期",
        emoji: "🕒",
        words: [
          ["现在", "xiànzài", "Sekarang", "⏰"],
          ["早上", "zǎoshang", "Pagi", "🌅"],
          ["下午", "xiàwǔ", "Siang", "🌇"],
          ["晚上", "wǎnshang", "Malam", "🌙"],
          ["上课", "shàngkè", "Mulai kelas", "📚"]
        ],
        order: "我们 下午 三点 上课",
        orderAdvanced: "明天 晚上 七点 我们 一起 吃饭",
        sentence: "我们下午三点上课。",
        sentencePinyin: "Wǒmen xiàwǔ sān diǎn shàngkè.",
        advanced: "明天晚上七点我们一起吃饭。",
        advancedPinyin: "Míngtiān wǎnshang qī diǎn wǒmen yìqǐ chīfàn.",
        poll: "你习惯什么时间学习？",
        pollOptions: ["早上", "下午", "晚上"],
        fill: { sentence: "我们下午三点____。", answers: [["上课", "shàngkè"]] },
        scene: {
          zh: "同学想知道现在几点。",
          meaning: "Teman sekelas mau tahu sekarang jam berapa.",
          options: [
            { text: "现在下午三点。", hint: "先说「现在」，再说时间。", correct: true },
            { text: "我三点去。", hint: "这说的是行动，不是回答几点。", correct: false },
            { text: "今天星期三。", hint: "这回答的是日期，不是时间。", correct: false }
          ]
        },
        dialogue: {
          them: "请问，你几点上课？",
          placeholder: "？",
          options: [
            { text: "我早上八点上课。", hint: "用「时间＋动词」回答。", correct: true },
            { text: "我在学校。", hint: "这回答的是地点。", correct: false },
            { text: "我上中文课。", hint: "这回答的是上什么课。", correct: false }
          ]
        },
        correction: {
          words: [["我们", "wǒmen"], ["下午", "xiàwǔ"], ["点", "diǎn"], ["三", "sān"], ["上课", "shàngkè"], ["。", ""]],
          wrong: 2,
          fix: "三点",
          fixed: "我们下午三点上课。",
          fixedPinyin: "Wǒmen xiàwǔ sān diǎn shàngkè.",
          explain: "钟点说「三点」，数字要放在「点」前面。"
        },
        categories: {
          groups: [
            { id: "when", name: "时间词", meaning: "kata waktu", hint: "表示什么时候" },
            { id: "do", name: "动作词", meaning: "kata kerja", hint: "表示做什么" }
          ],
          words: [["现在", "xiànzài", "when"], ["早上", "zǎoshang", "when"], ["下午", "xiàwǔ", "when"], ["晚上", "wǎnshang", "when"], ["上课", "shàngkè", "do"], ["吃饭", "chīfàn", "do"]]
        },
        talk: { icon: "🕒", alt: "钟表指着三点", meaning: "Jam menunjukkan pukul tiga.", answer: "现在下午三点。", answerPinyin: "Xiànzài xiàwǔ sān diǎn.", hint: "试试说：现在 ＋ 几点" },
        open: { prompt: "你每天几点起床？几点上课？", pattern: "我每天 ______ 点起床，______ 点上课。", sample: "我每天七点起床，八点上课。", samplePinyin: "Wǒ měitiān qī diǎn qǐchuáng, bā diǎn shàngkè." },
        build: [{ word: "现在", pinyin: "xiànzài", meaning: "sekarang" }, { word: "上课", pinyin: "shàngkè", meaning: "mulai kelas" }, { word: "早上", pinyin: "zǎoshang", meaning: "pagi" }]
      },
      {
        id: "weather",
        label: "天气与季节",
        emoji: "🌦️",
        words: [
          ["天气", "tiānqì", "Cuaca", "🌤️"],
          ["下雨", "xià yǔ", "Hujan", "🌧️"],
          ["热", "rè", "Panas", "🥵"],
          ["冷", "lěng", "Dingin", "🥶"],
          ["带伞", "dài sǎn", "Bawa payung", "☂️"]
        ],
        order: "今天 天气 很 好",
        orderAdvanced: "雅加达 下午 常常 下雨 记得 带伞",
        sentence: "今天天气很好。",
        sentencePinyin: "Jīntiān tiānqì hěn hǎo.",
        advanced: "雅加达下午常常下雨，记得带伞。",
        advancedPinyin: "Yǎjiādá xiàwǔ chángcháng xià yǔ, jìde dài sǎn.",
        poll: "你喜欢什么天气？",
        pollOptions: ["晴天", "下雨", "阴天"],
        fill: { sentence: "今天天气很____。", answers: [["好", "hǎo"]] },
        scene: {
          zh: "外面下雨，你提醒同学。",
          meaning: "Di luar hujan, kamu mengingatkan teman.",
          options: [
            { text: "今天下雨，记得带伞。", hint: "先说天气，再给一句提醒。", correct: true },
            { text: "今天很热，记得带伞。", hint: "两句之间没有关系。", correct: false },
            { text: "我喜欢下雨。", hint: "这是在说喜好，不是提醒。", correct: false }
          ]
        },
        dialogue: {
          them: "今天天气怎么样？",
          placeholder: "？",
          options: [
            { text: "今天很热，没有下雨。", hint: "用「很＋形容词」描述天气。", correct: true },
            { text: "我带伞了。", hint: "这回答的是带伞，不是天气。", correct: false },
            { text: "我很好，谢谢。", hint: "这是在回答身体或心情。", correct: false }
          ]
        },
        correction: {
          words: [["明天", "míngtiān"], ["会", "huì"], ["下雨", "xià yǔ"], ["你", "nǐ"], ["要", "yào"], ["穿", "chuān"], ["伞", "sǎn"], ["。", ""]],
          wrong: 5,
          fix: "带",
          fixed: "明天会下雨，你要带伞。",
          fixedPinyin: "Míngtiān huì xià yǔ, nǐ yào dài sǎn.",
          explain: "伞要「带」——带伞；「穿」用在衣服和鞋子上。"
        },
        categories: {
          groups: [
            { id: "weather", name: "天气描述", meaning: "deskripsi cuaca", hint: "形容天气" },
            { id: "action", name: "要做的事", meaning: "yang perlu dilakukan", hint: "提醒别人做的事" }
          ],
          words: [["天气", "tiānqì", "weather"], ["下雨", "xià yǔ", "weather"], ["热", "rè", "weather"], ["冷", "lěng", "weather"], ["带伞", "dài sǎn", "action"], ["穿外套", "chuān wàitào", "action"]]
        },
        talk: { icon: "🌧️", alt: "下雨天，一个人打着伞", meaning: "Hari hujan, seseorang memakai payung.", answer: "今天下雨了，记得带伞。", answerPinyin: "Jīntiān xià yǔ le, jìde dài sǎn.", hint: "第一句说天气，第二句说怎么做" },
        open: { prompt: "雅加达的天气怎么样？下雨的时候你会做什么？", pattern: "雅加达经常 ______ ，下雨的时候我 ______ 。", sample: "雅加达经常下雨，下雨的时候我在家看书。", samplePinyin: "Yǎjiādá jīngcháng xià yǔ, xià yǔ de shíhou wǒ zài jiā kàn shū." },
        build: [{ word: "天气", pinyin: "tiānqì", meaning: "cuaca" }, { word: "下雨", pinyin: "xià yǔ", meaning: "hujan" }, { word: "带伞", pinyin: "dài sǎn", meaning: "bawa payung" }]
      },
      {
        id: "shopping",
        label: "购物与价格",
        emoji: "🛍️",
        words: [
          ["多少钱", "duōshao qián", "Berapa harganya", "💰"],
          ["便宜", "piányi", "Murah", "🏷️"],
          ["太贵", "tài guì", "Terlalu mahal", "💸"],
          ["买", "mǎi", "Beli", "🛒"],
          ["打折", "dǎzhé", "Diskon", "🎉"]
        ],
        order: "请问 这件 衣服 多少钱",
        orderAdvanced: "这件 衣服 太贵 了 可以 便宜 一点 吗",
        sentence: "请问，这件衣服多少钱？",
        sentencePinyin: "Qǐngwèn, zhè jiàn yīfu duōshao qián?",
        advanced: "这件衣服太贵了，可以便宜一点吗？",
        advancedPinyin: "Zhè jiàn yīfu tài guì le, kěyǐ piányi yìdiǎn ma?",
        poll: "买东西你最看重什么？",
        pollOptions: ["价格", "质量", "样式"],
        fill: { sentence: "请问，这件衣服____钱？", answers: [["多少", "duōshao"]] },
        scene: {
          zh: "在商店里你想知道这件衣服的价格。",
          meaning: "Di toko kamu ingin tahu harga baju ini.",
          options: [
            { text: "请问，这件衣服多少钱？", hint: "先「请问」再问价格，最礼貌。", correct: true },
            { text: "这件衣服太贵！", hint: "这是评价，不是问价格。", correct: false },
            { text: "我要买衣服。", hint: "这是告诉别人你要买。", correct: false }
          ]
        },
        dialogue: {
          them: "这件衣服两百块。",
          placeholder: "？",
          options: [
            { text: "太贵了，能便宜一点吗？", hint: "先回应价格，再试着还价。", correct: true },
            { text: "多少钱？", hint: "对方刚说完价格。", correct: false },
            { text: "我不要伞。", hint: "这说的不是衣服。", correct: false }
          ]
        },
        correction: {
          words: [["我", "wǒ"], ["想", "xiǎng"], ["买", "mǎi"], ["一双", "yì shuāng"], ["衣服", "yīfu"], ["。", ""]],
          wrong: 3,
          fix: "一件",
          fixed: "我想买一件衣服。",
          fixedPinyin: "Wǒ xiǎng mǎi yí jiàn yīfu.",
          explain: "衣服用「件」来数；「双」用在鞋子、袜子这些成对的东西上。"
        },
        categories: {
          groups: [
            { id: "price", name: "问价与评价", meaning: "tanya harga dan penilaian", hint: "说价格" },
            { id: "buy", name: "买的时候说", meaning: "saat membeli", hint: "买东西的动作和优惠" }
          ],
          words: [["多少钱", "duōshao qián", "price"], ["便宜", "piányi", "price"], ["太贵", "tài guì", "price"], ["买", "mǎi", "buy"], ["打折", "dǎzhé", "buy"], ["试穿", "shìchuān", "buy"]]
        },
        talk: { icon: "🏷️", alt: "衣服上挂着价格牌", meaning: "Ada label harga di baju.", answer: "这件衣服太贵了。", answerPinyin: "Zhè jiàn yīfu tài guì le.", hint: "试试说：什么 ＋ 怎么样" },
        open: { prompt: "买东西的时候你会看价格吗？为什么？", pattern: "买东西的时候我会 ______ ，因为 ______ 。", sample: "买东西的时候我会看价格，因为我想买便宜的。", samplePinyin: "Mǎi dōngxi de shíhou wǒ huì kàn jiàgé, yīnwèi wǒ xiǎng mǎi piányi de." },
        build: [{ word: "便宜", pinyin: "piányi", meaning: "murah" }, { word: "多少钱", pinyin: "duōshao qián", meaning: "berapa harganya" }, { word: "打折", pinyin: "dǎzhé", meaning: "diskon" }]
      },
      {
        id: "direction",
        label: "方位与问路",
        emoji: "🧭",
        words: [
          ["左边", "zuǒbian", "Sebelah kiri", "⬅️"],
          ["右边", "yòubian", "Sebelah kanan", "➡️"],
          ["前面", "qiánmiàn", "Di depan", "⬆️"],
          ["地铁站", "dìtiě zhàn", "Stasiun MRT", "🚇"],
          ["怎么走", "zěnme zǒu", "Bagaimana jalan", "🧭"]
        ],
        order: "请问 地铁站 怎么走",
        orderAdvanced: "一直 往前 走 然后 在 路口 向 右 转",
        sentence: "请问，地铁站怎么走？",
        sentencePinyin: "Qǐngwèn, dìtiě zhàn zěnme zǒu?",
        advanced: "一直往前走，然后在路口向右转。",
        advancedPinyin: "Yìzhí wǎng qián zǒu, ránhòu zài lùkǒu xiàng yòu zhuǎn.",
        poll: "你出门最常用的交通方式？",
        pollOptions: ["走路", "地铁", "打车"],
        fill: { sentence: "请问，地铁站怎么____？", answers: [["走", "zǒu"]] },
        scene: {
          zh: "你在路上想问陌生人地铁站怎么走。",
          meaning: "Kamu mau bertanya arah ke stasiun MRT kepada orang asing.",
          options: [
            { text: "请问，地铁站怎么走？", hint: "先「请问」再问路，最礼貌。", correct: true },
            { text: "喂，地铁站！", hint: "称呼和语气都不礼貌。", correct: false },
            { text: "我不知道。", hint: "你是问路的人，不该这样回答。", correct: false }
          ]
        },
        dialogue: {
          them: "请问，洗手间在哪儿？",
          placeholder: "？",
          options: [
            { text: "在二楼，往左走。", hint: "先说位置，再说方向。", correct: true },
            { text: "我叫小明。", hint: "这是在自我介绍。", correct: false },
            { text: "今天很热。", hint: "这是在说天气。", correct: false }
          ]
        },
        correction: {
          words: [["你", "nǐ"], ["一直", "yìzhí"], ["走前", "zǒu qián"], ["然后", "ránhòu"], ["向", "xiàng"], ["左", "zuǒ"], ["转", "zhuǎn"], ["。", ""]],
          wrong: 2,
          fix: "往前走",
          fixed: "你一直往前走，然后向左转。",
          fixedPinyin: "Nǐ yìzhí wǎng qián zǒu, ránhòu xiàng zuǒ zhuǎn.",
          explain: "中文说「往前走」，「往」不能省；「走前」是英语直译。"
        },
        categories: {
          groups: [
            { id: "position", name: "方位词", meaning: "kata arah", hint: "表示在哪儿" },
            { id: "place", name: "地点与问路", meaning: "tempat dan bertanya arah", hint: "问路的时候说" }
          ],
          words: [["左边", "zuǒbian", "position"], ["右边", "yòubian", "position"], ["前面", "qiánmiàn", "position"], ["地铁站", "dìtiě zhàn", "place"], ["怎么走", "zěnme zǒu", "place"], ["路口", "lùkǒu", "place"]]
        },
        talk: { icon: "🧭", alt: "地图上一个向左的箭头", meaning: "Panah ke kiri di peta.", answer: "往左走，在前面。", answerPinyin: "Wǎng zuǒ zǒu, zài qiánmiàn.", hint: "试试说：往 ＋ 哪里 ＋ 走" },
        open: { prompt: "从你家到学校怎么走？", pattern: "从我家到学校，先 ______ ，然后 ______ 。", sample: "从我家到学校，先坐地铁，然后走五分钟。", samplePinyin: "Cóng wǒ jiā dào xuéxiào, xiān zuò dìtiě, ránhòu zǒu wǔ fēnzhōng." },
        build: [{ word: "左边", pinyin: "zuǒbian", meaning: "sebelah kiri" }, { word: "前面", pinyin: "qiánmiàn", meaning: "di depan" }, { word: "地铁站", pinyin: "dìtiě zhàn", meaning: "stasiun MRT" }]
      },
      {
        id: "family",
        label: "家庭与朋友",
        emoji: "👨‍👩‍👧",
        words: [
          ["家人", "jiārén", "Keluarga", "👨‍👩‍👧"],
          ["爸爸", "bàba", "Ayah", "👨"],
          ["妈妈", "māma", "Ibu", "👩"],
          ["朋友", "péngyou", "Teman", "🧑‍🤝‍🧑"],
          ["一起", "yìqǐ", "Bersama", "🤝"]
        ],
        order: "我 家 有 四 个 人",
        orderAdvanced: "周末 我 和 家人 一起 去 公园",
        sentence: "我家有四个人。",
        sentencePinyin: "Wǒ jiā yǒu sì gè rén.",
        advanced: "周末我和家人一起去公园。",
        advancedPinyin: "Zhōumò wǒ hé jiārén yìqǐ qù gōngyuán.",
        poll: "你家里有几个人？",
        pollOptions: ["三个人", "四个人", "五个人以上"],
        fill: { sentence: "我家有____个人。", answers: [["四", "sì"]] },
        scene: {
          zh: "同学问你家有几口人。",
          meaning: "Teman bertanya ada berapa orang di keluargamu.",
          options: [
            { text: "我家有四口人。", hint: "用「我家有＋数字＋口人」回答。", correct: true },
            { text: "我有四个。", hint: "中文要说清「几口人」。", correct: false },
            { text: "我家在雅加达。", hint: "这回答的是地点。", correct: false }
          ]
        },
        dialogue: {
          them: "周末你和谁一起玩？",
          placeholder: "？",
          options: [
            { text: "我和朋友一起去公园。", hint: "用「我和……一起……」回答。", correct: true },
            { text: "我家有四个人。", hint: "这回答的是家里的人数。", correct: false },
            { text: "我喜欢看书。", hint: "这回答的是爱好。", correct: false }
          ]
        },
        correction: {
          words: [["我", "wǒ"], ["家", "jiā"], ["有", "yǒu"], ["四", "sì"], ["个", "gè"], ["人", "rén"], ["。", ""]],
          wrong: 4,
          fix: "口",
          fixed: "我家有四口人。",
          fixedPinyin: "Wǒ jiā yǒu sì kǒu rén.",
          explain: "说家里的人数常用「四口人」，「口」专门用来量家里人。"
        },
        categories: {
          groups: [
            { id: "relative", name: "家人称呼", meaning: "sebutan keluarga", hint: "称呼家里人" },
            { id: "friend", name: "朋友与一起", meaning: "teman dan bersama", hint: "和朋友有关" }
          ],
          words: [["爸爸", "bàba", "relative"], ["妈妈", "māma", "relative"], ["家人", "jiārén", "relative"], ["朋友", "péngyou", "friend"], ["一起", "yìqǐ", "friend"], ["同学", "tóngxué", "friend"]]
        },
        talk: { icon: "👨‍👩‍👧", alt: "一家三口的合影", meaning: "Foto keluarga bertiga.", answer: "我家有三口人。", answerPinyin: "Wǒ jiā yǒu sān kǒu rén.", hint: "试试说：我家有 ＋ 几口人" },
        open: { prompt: "介绍一下你的家人，你们周末一起做什么？", pattern: "我家有 ______ 口人，周末我们 ______ 。", sample: "我家有四口人，周末我们一起去公园。", samplePinyin: "Wǒ jiā yǒu sì kǒu rén, zhōumò wǒmen yìqǐ qù gōngyuán." },
        build: [{ word: "家人", pinyin: "jiārén", meaning: "keluarga" }, { word: "爸爸", pinyin: "bàba", meaning: "ayah" }, { word: "妈妈", pinyin: "māma", meaning: "ibu" }]
      },
      {
        id: "hobby",
        label: "爱好与运动",
        emoji: "⚽",
        words: [
          ["喜欢", "xǐhuan", "Suka", "❤️"],
          ["唱歌", "chànggē", "Bernyanyi", "🎤"],
          ["打球", "dǎ qiú", "Main bola", "🏀"],
          ["看书", "kàn shū", "Baca buku", "📖"],
          ["旅行", "lǚxíng", "Bepergian", "✈️"]
        ],
        order: "我 喜欢 唱歌 和 看书",
        orderAdvanced: "我 最喜欢 的 运动 是 周末 打羽毛球",
        sentence: "我喜欢唱歌和看书。",
        sentencePinyin: "Wǒ xǐhuan chànggē hé kàn shū.",
        advanced: "我最喜欢的运动是周末打羽毛球。",
        advancedPinyin: "Wǒ zuì xǐhuan de yùndòng shì zhōumò dǎ yǔmáoqiú.",
        poll: "你最喜欢的爱好是？",
        pollOptions: ["运动", "音乐", "旅行"],
        fill: { sentence: "我喜欢唱歌____看书。", answers: [["和", "hé"]] },
        scene: {
          zh: "同学约你周末打球。",
          meaning: "Teman mengajakmu bermain bola akhir pekan.",
          options: [
            { text: "好啊，我很喜欢打球！", hint: "先答应，再说自己的喜好。", correct: true },
            { text: "我不喜欢。", hint: "直接拒绝太生硬，可以先说谢谢。", correct: false },
            { text: "我是学生。", hint: "这回答的是身份，答非所问。", correct: false }
          ]
        },
        dialogue: {
          them: "你周末喜欢做什么？",
          placeholder: "？",
          options: [
            { text: "我周末喜欢听音乐。", hint: "用「我周末喜欢＋活动」回答。", correct: true },
            { text: "我周末很忙。", hint: "这没有回答喜欢做什么。", correct: false },
            { text: "我喜欢吃面条。", hint: "这是在说食物。", correct: false }
          ]
        },
        correction: {
          words: [["我", "wǒ"], ["最", "zuì"], ["喜欢", "xǐhuan"], ["的", "de"], ["运动", "yùndòng"], ["是", "shì"], ["唱歌", "chànggē"], ["。", ""]],
          wrong: 6,
          fix: "打球",
          fixed: "我最喜欢的运动是打球。",
          fixedPinyin: "Wǒ zuì xǐhuan de yùndòng shì dǎ qiú.",
          explain: "「唱歌」是音乐活动，不是运动；运动要说「打球」「跑步」。"
        },
        categories: {
          groups: [
            { id: "activity", name: "活动和爱好", meaning: "kegiatan dan hobi", hint: "喜欢做的事" },
            { id: "feeling", name: "表达喜好", meaning: "mengungkapkan kesukaan", hint: "说喜不喜欢" }
          ],
          words: [["唱歌", "chànggē", "activity"], ["打球", "dǎ qiú", "activity"], ["看书", "kàn shū", "activity"], ["旅行", "lǚxíng", "activity"], ["喜欢", "xǐhuan", "feeling"], ["不喜欢", "bù xǐhuan", "feeling"]]
        },
        talk: { icon: "🏀", alt: "一个小朋友在打球", meaning: "Seorang anak sedang bermain bola.", answer: "小朋友在打球。", answerPinyin: "Xiǎopéngyou zài dǎ qiú.", hint: "试试说：谁 ＋ 在做什么" },
        open: { prompt: "你最喜欢的运动是什么？为什么？", pattern: "我最喜欢的运动是 ______ ，因为 ______ 。", sample: "我最喜欢的运动是打羽毛球，因为它很有趣。", samplePinyin: "Wǒ zuì xǐhuan de yùndòng shì dǎ yǔmáoqiú, yīnwèi tā hěn yǒuqù." },
        build: [{ word: "唱歌", pinyin: "chànggē", meaning: "bernyanyi" }, { word: "打球", pinyin: "dǎ qiú", meaning: "main bola" }, { word: "看书", pinyin: "kàn shū", meaning: "baca buku" }]
      },
      {
        id: "transport",
        label: "交通与出行",
        emoji: "🚌",
        words: [
          ["坐车", "zuò chē", "Naik kendaraan", "🚗"],
          ["公交车", "gōngjiāo chē", "Bus", "🚌"],
          ["机场", "jīchǎng", "Bandara", "✈️"],
          ["几点出发", "jǐ diǎn chūfā", "Jam berapa berangkat", "⏰"],
          ["堵车", "dǔchē", "Macet", "🚦"]
        ],
        order: "我们 坐 公交车 去 学校",
        orderAdvanced: "因为 堵车 我 上课 迟到 了 十分钟",
        sentence: "我们坐公交车去学校。",
        sentencePinyin: "Wǒmen zuò gōngjiāo chē qù xuéxiào.",
        advanced: "因为堵车，我上课迟到了十分钟。",
        advancedPinyin: "Yīnwèi dǔchē, wǒ shàngkè chídào le shí fēnzhōng.",
        poll: "你上学路上要多久？",
        pollOptions: ["十五分钟", "半小时", "一小时以上"],
        fill: { sentence: "我们坐____去学校。", answers: [["公交车", "gōngjiāo chē"]] },
        scene: {
          zh: "你迟到了，向老师说明原因。",
          meaning: "Kamu terlambat dan menjelaskan kepada guru.",
          options: [
            { text: "对不起，路上堵车，我迟到了。", hint: "先道歉，再说明原因。", correct: true },
            { text: "我不知道。", hint: "说明原因才能让老师了解情况。", correct: false },
            { text: "我坐公交车。", hint: "这只是出行方式，不是迟到的原因。", correct: false }
          ]
        },
        dialogue: {
          them: "我们几点出发去机场？",
          placeholder: "？",
          options: [
            { text: "我们早上七点出发。", hint: "用「时间＋出发」回答。", correct: true },
            { text: "我们坐公交车。", hint: "这回答的是交通方式。", correct: false },
            { text: "机场很大。", hint: "这描述的是机场。", correct: false }
          ]
        },
        correction: {
          words: [["我", "wǒ"], ["坐", "zuò"], ["公交车", "gōngjiāo chē"], ["走", "zǒu"], ["学校", "xuéxiào"], ["。", ""]],
          wrong: 3,
          fix: "去",
          fixed: "我坐公交车去学校。",
          fixedPinyin: "Wǒ zuò gōngjiāo chē qù xuéxiào.",
          explain: "「去＋地点」表示去某处；「走」是用脚走路，和「坐公交车」冲突。"
        },
        categories: {
          groups: [
            { id: "travel", name: "出行方式与地点", meaning: "cara dan tempat bepergian", hint: "怎么走、去哪儿" },
            { id: "road", name: "路上的情况", meaning: "situasi di jalan", hint: "出发时间和路况" }
          ],
          words: [["坐车", "zuò chē", "travel"], ["公交车", "gōngjiāo chē", "travel"], ["机场", "jīchǎng", "travel"], ["几点出发", "jǐ diǎn chūfā", "road"], ["堵车", "dǔchē", "road"], ["迟到", "chídào", "road"]]
        },
        talk: { icon: "🚌", alt: "一辆公交车在路上", meaning: "Sebuah bus di jalan.", answer: "他坐公交车去学校。", answerPinyin: "Tā zuò gōngjiāo chē qù xuéxiào.", hint: "试试说：谁 ＋ 坐什么 ＋ 去哪里" },
        open: { prompt: "你平时怎么去学校？路上要多久？", pattern: "我平时 ______ 去学校，路上要 ______ 。", sample: "我平时坐公交车去学校，路上要半小时。", samplePinyin: "Wǒ píngshí zuò gōngjiāo chē qù xuéxiào, lùshang yào bàn xiǎoshí." },
        build: [{ word: "坐车", pinyin: "zuò chē", meaning: "naik kendaraan" }, { word: "公交车", pinyin: "gōngjiāo chē", meaning: "bus" }, { word: "机场", pinyin: "jīchǎng", meaning: "bandara" }]
      },
      {
        id: "school",
        label: "学校与学习用品",
        emoji: "🎒",
        words: [
          ["书", "shū", "Buku", "📕"],
          ["笔", "bǐ", "Pena", "✏️"],
          ["本子", "běnzi", "Buku tulis", "📒"],
          ["老师", "lǎoshī", "Guru", "👩‍🏫"],
          ["教室", "jiàoshì", "Ruang kelas", "🏫"]
        ],
        order: "这 是 我的 新 本子",
        orderAdvanced: "我 在 教室 里 和 新同学 一起 看书",
        sentence: "这是我的新本子。",
        sentencePinyin: "Zhè shì wǒ de xīn běnzi.",
        advanced: "我在教室里和新同学一起看书。",
        advancedPinyin: "Wǒ zài jiàoshì lǐ hé xīn tóngxué yìqǐ kàn shū.",
        poll: "上课前你会先做什么？",
        pollOptions: ["预习课文", "找笔记", "和同学聊天"],
        fill: { sentence: "这是我的新____。", answers: [["本子", "běnzi"]] },
        scene: {
          zh: "你想借同学的笔。",
          meaning: "Kamu mau meminjam pena temanmu.",
          options: [
            { text: "请问，我可以借你的笔吗？", hint: "借东西先问一句，最得体。", correct: true },
            { text: "喂，给我笔！", hint: "太生硬，不礼貌。", correct: false },
            { text: "笔。", hint: "话没说完，别人听不懂。", correct: false }
          ]
        },
        dialogue: {
          them: "你的书在哪儿？",
          placeholder: "？",
          options: [
            { text: "我的书在桌子上。", hint: "用「在＋地点」回答位置。", correct: true },
            { text: "这是我的书。", hint: "这回答的是谁的书。", correct: false },
            { text: "我喜欢看书。", hint: "这回答的是爱好。", correct: false }
          ]
        },
        correction: {
          words: [["我", "wǒ"], ["买", "mǎi"], ["一", "yī"], ["个", "gè"], ["书", "shū"], ["。", ""]],
          wrong: 3,
          fix: "本",
          fixed: "我买一本书。",
          fixedPinyin: "Wǒ mǎi yì běn shū.",
          explain: "「书」用量词「本」——一本；「个」不能用在书上。"
        },
        categories: {
          groups: [
            { id: "supply", name: "学习用品", meaning: "alat belajar", hint: "书包里放的东西" },
            { id: "person", name: "人与场所", meaning: "orang dan tempat", hint: "人和地方" }
          ],
          words: [["书", "shū", "supply"], ["笔", "bǐ", "supply"], ["本子", "běnzi", "supply"], ["老师", "lǎoshī", "person"], ["教室", "jiàoshì", "person"], ["同学", "tóngxué", "person"]]
        },
        talk: { icon: "🎒", alt: "书包里放着书和本子", meaning: "Di dalam tas ada buku dan buku tulis.", answer: "书包里有书和本子。", answerPinyin: "Shūbāo lǐ yǒu shū hé běnzi.", hint: "试试说：书包里有 ＋ 什么" },
        open: { prompt: "你的书包里有什么？你最喜欢哪一门课？", pattern: "我的书包里有 ______ ，我最喜欢 ______ 。", sample: "我的书包里有书和本子，我最喜欢中文课。", samplePinyin: "Wǒ de shūbāo lǐ yǒu shū hé běnzi, wǒ zuì xǐhuan Zhōngwén kè." },
        build: [{ word: "本子", pinyin: "běnzi", meaning: "buku tulis" }, { word: "教室", pinyin: "jiàoshì", meaning: "ruang kelas" }, { word: "老师", pinyin: "lǎoshī", meaning: "guru" }]
      },
      {
        id: "action",
        label: "动作与日常",
        emoji: "🏃",
        words: [
          ["跑步", "pǎobù", "Berlari", "🏃"],
          ["吃饭", "chīfàn", "Makan", "🍚"],
          ["睡觉", "shuìjiào", "Tidur", "😴"],
          ["起床", "qǐchuáng", "Bangun tidur", "⏰"],
          ["上课", "shàngkè", "Mulai kelas", "📚"]
        ],
        order: "我 每天 七点 起床",
        orderAdvanced: "他 吃完 饭 就 去 睡觉 了",
        sentence: "我每天七点起床。",
        sentencePinyin: "Wǒ měitiān qī diǎn qǐchuáng.",
        advanced: "他吃完饭就去睡觉了。",
        advancedPinyin: "Tā chī wán fàn jiù qù shuìjiào le.",
        poll: "你每天几点起床？",
        pollOptions: ["六点", "七点", "八点以后"],
        fill: { sentence: "我每天七点____。", answers: [["起床", "qǐchuáng"]] },
        scene: {
          zh: "同学想知道你早上的安排。",
          meaning: "Teman mau tahu kegiatanmu pagi hari.",
          options: [
            { text: "我早上七点起床，然后去跑步。", hint: "用「先……然后……」说清顺序。", correct: true },
            { text: "我喜欢睡觉。", hint: "这说的是喜好，不是安排。", correct: false },
            { text: "我吃了。", hint: "这句话不完整，别人不知道你吃了什么。", correct: false }
          ]
        },
        dialogue: {
          them: "你每天几点起床？",
          placeholder: "？",
          options: [
            { text: "我每天七点起床。", hint: "用「我每天＋几点＋动词」回答。", correct: true },
            { text: "我每天跑步。", hint: "这回答的是做什么，不是几点。", correct: false },
            { text: "我起床了。", hint: "这没有回答具体时间。", correct: false }
          ]
        },
        correction: {
          words: [["我", "wǒ"], ["每天", "měitiān"], ["晚上", "wǎnshang"], ["十点", "shí diǎn"], ["起床", "qǐchuáng"], ["。", ""]],
          wrong: 4,
          fix: "睡觉",
          fixed: "我每天晚上十点睡觉。",
          fixedPinyin: "Wǒ měitiān wǎnshang shí diǎn shuìjiào.",
          explain: "晚上十点是睡觉的时间；「起床」是早上做的事。"
        },
        categories: {
          groups: [
            { id: "act", name: "一天里的动作", meaning: "kegiatan sehari-hari", hint: "每天做的事" },
            { id: "when", name: "时间词", meaning: "kata waktu", hint: "什么时候做" }
          ],
          words: [["跑步", "pǎobù", "act"], ["吃饭", "chīfàn", "act"], ["睡觉", "shuìjiào", "act"], ["起床", "qǐchuáng", "act"], ["早上", "zǎoshang", "when"], ["晚上", "wǎnshang", "when"]]
        },
        talk: { icon: "🏃", alt: "一个小朋友在跑步", meaning: "Seorang anak sedang berlari.", answer: "小朋友在跑步。", answerPinyin: "Xiǎopéngyou zài pǎobù.", hint: "试试说：谁 ＋ 在做什么" },
        open: { prompt: "你每天的生活是怎样的？从起床开始说一说。", pattern: "我每天 ______ 点起床，然后 ______ 。", sample: "我每天七点起床，然后去跑步。", samplePinyin: "Wǒ měitiān qī diǎn qǐchuáng, ránhòu qù pǎobù." },
        build: [{ word: "起床", pinyin: "qǐchuáng", meaning: "bangun tidur" }, { word: "跑步", pinyin: "pǎobù", meaning: "berlari" }, { word: "睡觉", pinyin: "shuìjiào", meaning: "tidur" }]
      }
    ];

    /* 18 种题型与学生端 activity-types.js 一一对应，标题与后台短名保持一致。 */
    const templateTypeLabels = {
      match: "连线配对",
      memory: "翻牌记忆",
      choice: "单选 / 多选",
      order: "排序",
      fill: "填空",
      poll: "投票",
      picture: "看图单选",
      "picture-match": "图片—词语连线",
      situation: "情景选择",
      dialogue: "对话补全",
      "pinyin-match": "拼音—汉字—含义匹配",
      category: "分类归组",
      "word-build": "拼字 / 组词",
      correction: "找错误 / 改错",
      listening: "听音选图 / 选词",
      "read-aloud": "跟读模仿",
      "picture-talk": "看图说话",
      "open-qa": "开放问答"
    };
    const templateLevels = [
      { id: "beginner", label: "初级", size: 3 },
      { id: "intermediate", label: "中级", size: 4 },
      { id: "advanced", label: "高级", size: 5 }
    ];
    const templateItemId = (templateId) => `tpl-item-${templateId}`;
    const speakingScores = (templateId) => [
      { id: `${templateId}-score-1`, label: "发音", stars: 3 },
      { id: `${templateId}-score-2`, label: "流利度", stars: 3 },
      { id: `${templateId}-score-3`, label: "声调", stars: 3 }
    ];
    /** 词表按难度取前 n 个；选项顺序按难度轮转，避免永远正确答案排第一。 */
    function rotateOptions(entries, offset) {
      if (entries.length === 0) return entries;
      const step = offset % entries.length;
      return entries.slice(step).concat(entries.slice(0, step));
    }
    function pickWords(topic, size, offset) {
      return rotateOptions(topic.words.slice(0, size), offset);
    }
    function meaningChoices(templateId, topic, size, offset) {
      const words = pickWords(topic, size, offset);
      const target = topic.words[Math.min(offset, topic.words.length - 1)];
      return {
        target,
        prompt: `“${target[0]}”是什么意思？`,
        explanation: `「${target[0]}」读 ${target[1]}，意思是 ${target[2]}。`,
        choices: words.map((word, index) => ({
          id: `${templateId}-choice-${index}`,
          text: word[2],
          hint: word[1],
          isCorrect: word[0] === target[0]
        }))
      };
    }
    function pickOne(templateId, topic, size, offset, withMedia) {
      const words = pickWords(topic, size, offset);
      const target = topic.words[size - 1];
      const ordered = words.filter((word) => word[0] !== target[0]).concat([target]);
      return {
        words: ordered,
        target,
        choices: ordered.map((word, index) => ({
          id: `${templateId}-choice-${index}`,
          text: word[0],
          hint: word[1],
          isCorrect: word[0] === target[0]
        })),
        media: withMedia ? { icon: target[3], image: "", alt: `${target[0]}（${target[2]}）的图卡` } : undefined
      };
    }

    /** 每种题型从主题素材生成一道题；返回 { summary, item }。 */
    function buildTemplateContent(templateId, type, topic, level) {
      const levelLabel = level.label;
      const itemBase = {
        id: templateItemId(templateId),
        type,
        prompt: "请完成下面题目。",
        explanation: `来自模板库：${topic.label} · ${levelLabel}`
      };
      const wordCount = level.size;

      if (type === "match" || type === "memory") {
        const words = topic.words.slice(0, wordCount);
        return {
          summary: `${levelLabel}难度 · ${words.length} 组「${topic.label}」中文—印尼语配对。`,
          item: {
            ...itemBase,
            prompt: type === "match" ? `把${topic.label}的中文和印尼语配对。` : `翻开卡片，找到${topic.label}的配对。`,
            explanation: "先读中文，再找出对应的印尼语意思。",
            pairs: words.map((word, index) => ({ id: `${templateId}-pair-${index}`, left: word[0], right: word[2] }))
          }
        };
      }
      if (type === "choice") {
        const detail = meaningChoices(templateId, topic, wordCount, level.size - 3);
        const { target: choiceTarget, ...choiceFields } = detail;
        return {
          summary: `${levelLabel}难度 · 选词义：${choiceTarget[0]} → 印尼语，${wordCount} 个选项。`,
          item: { ...itemBase, ...choiceFields, multiple: false }
        };
      }
      if (type === "order") {
        const source = level.id === "advanced" ? topic.orderAdvanced : topic.order;
        const parts = source.split(" ");
        return {
          summary: `${levelLabel}难度 · 把 ${parts.length} 个词块排成「${source.replace(/ /g, "")}」。`,
          item: {
            ...itemBase,
            prompt: "点选词块，把它们排成通顺的一句话。",
            explanation: `正确顺序：${source.replace(/ /g, "")}`,
            orderItems: parts.map((text, index) => ({ id: `${templateId}-order-${index}`, text })),
            correctOrder: parts.map((_, index) => `${templateId}-order-${index}`)
          }
        };
      }
      if (type === "fill") {
        const blankCount = topic.fill.answers.length;
        return {
          summary: `${levelLabel}难度 · 填空：${topic.fill.sentence.replace(/____/g, "（　）")}`,
          item: {
            ...itemBase,
            prompt: "填写缺失的词语。",
            explanation: `标准答案：${topic.fill.answers.map((entry) => entry[0]).join("、")}`,
            sentence: topic.fill.sentence,
            blanks: topic.fill.answers.map((answers, index) => ({ id: `${templateId}-blank-${index}`, answers }))
          }
        };
      }
      if (type === "poll") {
        return {
          summary: `${levelLabel}难度 · 课堂投票：${topic.poll}`,
          item: {
            ...itemBase,
            prompt: topic.poll,
            explanation: "投票不计分，提交后老师查看统计结果。",
            pollOptions: topic.pollOptions.map((text, index) => ({ id: `${templateId}-poll-${index}`, text }))
          }
        };
      }
      if (type === "picture") {
        const detail = pickOne(templateId, topic, wordCount, level.size - 3, true);
        return {
          summary: `${levelLabel}难度 · 看图选词：${detail.target[0]}（${detail.target[2]}），${wordCount} 个选项。`,
          item: {
            ...itemBase,
            prompt: "看图片，选出正确的词语。",
            promptPinyin: "Kàn túpiàn, xuǎn chū zhèngquè de cíyǔ.",
            explanation: `图卡是「${detail.target[0]}」${detail.target[1]}，意思是 ${detail.target[2]}。`,
            media: detail.media,
            choices: detail.choices
          }
        };
      }
      if (type === "picture-match") {
        const words = topic.words.slice(0, wordCount);
        return {
          summary: `${levelLabel}难度 · ${words.length} 张图卡与词语配对，带拼音。`,
          item: {
            ...itemBase,
            prompt: "把图片和词语配成对。",
            explanation: "先看图，再找对应的词；右边带有拼音。",
            pairs: words.map((word, index) => ({
              id: `${templateId}-pair-${index}`,
              left: word[0],
              right: word[0],
              rightPinyin: word[1],
              media: { icon: word[3], image: "", alt: `${word[0]}（${word[2]}）的图卡` }
            }))
          }
        };
      }
      if (type === "situation") {
        return {
          summary: `${levelLabel}难度 · 情景：${topic.scene.zh}`,
          item: {
            ...itemBase,
            prompt: "看场景，选出这个场合里最得体的说法。",
            explanation: topic.scene.options.find((option) => option.correct)?.hint ?? "",
            scene: topic.scene.zh,
            sceneTranslation: topic.scene.meaning,
            media: { icon: topic.emoji, image: "", alt: topic.scene.zh },
            choices: topic.scene.options.map((option, index) => ({
              id: `${templateId}-choice-${index}`,
              text: option.text,
              hint: option.hint,
              isCorrect: option.correct === true
            }))
          }
        };
      }
      if (type === "dialogue") {
        return {
          summary: `${levelLabel}难度 · 接住上一句：${topic.dialogue.them}`,
          item: {
            ...itemBase,
            prompt: "看上一句，选出合适的下一句。",
            explanation: topic.dialogue.options.find((option) => option.correct)?.hint ?? "",
            dialogueThem: topic.dialogue.them,
            dialoguePlaceholder: topic.dialogue.placeholder,
            choices: topic.dialogue.options.map((option, index) => ({
              id: `${templateId}-choice-${index}`,
              text: option.text,
              hint: option.hint,
              isCorrect: option.correct === true
            }))
          }
        };
      }
      if (type === "pinyin-match") {
        const start = level.size - 3;
        const picked = [0, 1, 2].map((index) => topic.words[(start + index) % topic.words.length]);
        const wordOptions = picked.map((word) => word[0]);
        const meaningOptions = picked.map((word) => word[2]);
        return {
          summary: `${levelLabel}难度 · ${picked.length} 组拼音 → 汉字 → 印尼语含义。`,
          item: {
            ...itemBase,
            prompt: "看拼音，先选汉字，再选意思。",
            explanation: `这一组读 ${picked[0][1]}，是「${picked[0][0]}」，意思是 ${picked[0][2]}。`,
            pinyinGroups: picked.map((word, index) => ({
              id: `${templateId}-group-${index}`,
              pinyin: word[1],
              word: word[0],
              meaning: word[2],
              wordOptions: rotateOptions(wordOptions, index),
              meaningOptions: rotateOptions(meaningOptions, index)
            }))
          }
        };
      }
      if (type === "category") {
        const groups = topic.categories.groups.map((group) => ({
          id: `${templateId}-group-${group.id}`,
          name: group.name,
          hint: group.meaning
        }));
        const size = wordCount + 1;
        const words = topic.categories.words.slice(0, size).map((word, index) => ({
          id: `${templateId}-word-${index}`,
          text: word[0],
          pinyin: word[1],
          group: `${templateId}-group-${word[2]}`
        }));
        return {
          summary: `${levelLabel}难度 · 把 ${words.length} 个词分进「${groups[0].name}」和「${groups[1].name}」。`,
          item: {
            ...itemBase,
            prompt: "把下面的词放到对应的类别里。",
            explanation: `${groups[0].name}：${words.filter((word) => word.group === groups[0].id).map((word) => word.text).join("、")}；${groups[1].name}：${words.filter((word) => word.group === groups[1].id).map((word) => word.text).join("、")}。`,
            groups,
            words
          }
        };
      }
      if (type === "word-build") {
        const entry = topic.build[level.size - 3];
        const answer = entry.word.split("");
        const bank = answer.slice();
        topic.words.forEach((word) => {
          word[0].split("").forEach((char) => {
            if (bank.length < answer.length + 4 && !bank.includes(char)) bank.push(char);
          });
        });
        return {
          summary: `${levelLabel}难度 · 用字块拼出「${entry.word}」（${entry.meaning}）。`,
          item: {
            ...itemBase,
            prompt: "点字块，把词语拼进空格里。",
            explanation: `答案是「${entry.word}」${entry.pinyin}，意思是 ${entry.meaning}。`,
            meaning: entry.meaning,
            answer,
            answerWord: entry.word,
            answerPinyin: entry.pinyin,
            tileBank: bank
          }
        };
      }
      if (type === "correction") {
        const badWords = topic.correction.words.map(([text, pinyin], index) => ({
          id: `${templateId}-word-${index}`,
          text,
          pinyin,
          ...(index === topic.correction.wrong ? { wrong: true } : {})
        }));
        return {
          summary: `${levelLabel}难度 · 找出句子里用错的词，改成「${topic.correction.fix}」。`,
          item: {
            ...itemBase,
            prompt: "下面这句话里有一个词用错了，点出来。",
            explanation: topic.correction.explain,
            badWords,
            fixText: topic.correction.fix,
            fixedSentence: topic.correction.fixed,
            fixedPinyin: topic.correction.fixedPinyin
          }
        };
      }
      if (type === "listening") {
        const target = topic.words[wordCount - 1];
        const ordered = rotateOptions(topic.words.slice(0, wordCount), wordCount - 3)
          .filter((word) => word[0] !== target[0])
          .concat([target]);
        return {
          summary: `${levelLabel}难度 · 听「${target[0]}」选出正确词语，${ordered.length} 个选项。`,
          item: {
            ...itemBase,
            prompt: "听一听，选出你听到的内容。",
            explanation: `听到的是「${target[0]}」${target[1]}，意思是 ${target[2]}。`,
            audioSrc: "",
            audioText: target[0],
            audioPinyin: target[1],
            choices: ordered.map((word, index) => ({
              id: `${templateId}-choice-${index}`,
              text: word[0],
              hint: word[1],
              isCorrect: word[0] === target[0]
            }))
          }
        };
      }
      if (type === "read-aloud") {
        const useAdvanced = level.id === "advanced";
        const text = useAdvanced ? topic.advanced : level.id === "beginner" ? topic.words[0][0] : topic.sentence;
        const pinyin = useAdvanced ? topic.advancedPinyin : level.id === "beginner" ? topic.words[0][1] : topic.sentencePinyin;
        return {
          summary: `${levelLabel}难度 · 跟读「${text}」`,
          item: {
            ...itemBase,
            prompt: "听一遍，然后跟着读。",
            explanation: `参考读音：${pinyin}`,
            sentence: text,
            promptPinyin: pinyin,
            audioSrc: "",
            scores: speakingScores(templateId)
          }
        };
      }
      if (type === "picture-talk") {
        const twoSentences = level.id !== "beginner";
        return {
          summary: `${levelLabel}难度 · 看图说话：${topic.talk.answer}`,
          item: {
            ...itemBase,
            prompt: twoSentences ? "看这张图，用中文说两句话。" : "看这张图，用中文说一句话。",
            explanation: `参考答案：${topic.talk.answer} ${topic.talk.answerPinyin}`,
            speakingHint: topic.talk.hint,
            media: { icon: topic.talk.icon, image: "", alt: topic.talk.alt },
            mediaTranslation: topic.talk.meaning,
            sampleAnswer: topic.talk.answer,
            sampleAnswerPinyin: topic.talk.answerPinyin,
            scores: speakingScores(templateId)
          }
        };
      }
      if (type === "open-qa") {
        const useAdvanced = level.id === "advanced";
        const prompt = useAdvanced ? topic.open.prompt : topic.poll;
        const sampleAnswer = useAdvanced ? topic.open.sample : topic.sentence;
        const sampleAnswerPinyin = useAdvanced ? topic.open.samplePinyin : topic.sentencePinyin;
        const words = topic.words.slice(0, wordCount);
        return {
          summary: `${levelLabel}难度 · 开放问答：${prompt}`,
          item: {
            ...itemBase,
            prompt,
            explanation: `回答模板：${topic.open.pattern}`,
            speakingWords: words.map((word, index) => ({ id: `${templateId}-word-${index}`, text: word[0], pinyin: word[1] })),
            sampleAnswer,
            sampleAnswerPinyin,
            samplePattern: topic.open.pattern,
            scores: speakingScores(templateId)
          }
        };
      }
      return {
        summary: `${levelLabel}难度 · ${topic.label}`,
        item: { ...itemBase, prompt: topic.poll, pollOptions: topic.pollOptions.map((text, index) => ({ id: `${templateId}-poll-${index}`, text })) }
      };
    }

    const interactionTemplates = [];
    templateTopics.forEach((topic) => {
      Object.keys(templateTypeLabels).forEach((type) => {
        templateLevels.forEach((level) => {
          const templateId = `${topic.id}-${type}-${level.id}`;
          const content = buildTemplateContent(templateId, type, topic, level);
          interactionTemplates.push({
            id: templateId,
            type,
            title: `${topic.label} · ${templateTypeLabels[type]}`,
            summary: content.summary,
            topic: topic.label,
            topicId: topic.id,
            level: level.id,
            language: "zh-id",
            tags: [templateTypeLabels[type], topic.label, level.label, topic.emoji],
            item: content.item
          });
        });
      });
    });
    const interactionSets = [
      {
        id: "set-greetings-preview",
        lessonId: "lesson-greetings",
        title: "问候热身",
        phase: "preview",
        status: "published",
        currentVersionId: "ver-greetings-preview-2",
        order: 1,
        updatedAt: iso(addDays(now, -4))
      },
      {
        id: "set-greetings-live",
        lessonId: "lesson-greetings",
        title: "课堂互动 · 问候时间",
        phase: "live",
        status: "published",
        currentVersionId: "ver-greetings-live-1",
        order: 1,
        updatedAt: iso(addDays(now, -6))
      },
      {
        id: "set-greetings-review",
        lessonId: "lesson-greetings",
        title: "课后复习挑战",
        phase: "review",
        status: "published",
        currentVersionId: "ver-greetings-review-1",
        order: 1,
        updatedAt: iso(addDays(now, -6))
      },
      {
        id: "set-greetings-scenario",
        lessonId: "lesson-greetings",
        title: "情景演练 · 看图与对话",
        phase: "live",
        status: "published",
        currentVersionId: "ver-greetings-scenario-1",
        order: 2,
        updatedAt: iso(addDays(now, -3))
      },
      {
        id: "set-greetings-batch-three",
        lessonId: "lesson-greetings",
        title: "互动体验 · 八大新题型",
        phase: "live",
        status: "published",
        currentVersionId: "ver-greetings-batch-three-1",
        order: 3,
        updatedAt: iso(addDays(now, -2))
      },
      {
        id: "set-food-picture",
        lessonId: "lesson-food",
        title: "看图选词",
        phase: "preview",
        status: "published",
        currentVersionId: "ver-food-picture-1",
        order: 1,
        updatedAt: iso(addDays(now, -2)),
        sessionIds: ["series-session-1"]
      },
      {
        id: "set-food-match",
        lessonId: "lesson-food",
        title: "图词连线",
        phase: "preview",
        status: "published",
        currentVersionId: "ver-food-match-1",
        order: 2,
        updatedAt: iso(addDays(now, -2)),
        sessionIds: ["series-session-1"]
      },
      {
        id: "set-food-fill",
        lessonId: "lesson-food",
        title: "补全句子",
        phase: "preview",
        status: "published",
        currentVersionId: "ver-food-fill-1",
        order: 3,
        updatedAt: iso(addDays(now, -2)),
        sessionIds: ["series-session-1"]
      },
      {
        id: "set-food-situation",
        lessonId: "lesson-food",
        title: "点餐情景",
        phase: "live",
        status: "published",
        currentVersionId: "ver-food-situation-1",
        order: 1,
        updatedAt: iso(addDays(now, -2)),
        sessionIds: ["series-session-1"]
      },
      {
        id: "set-food-dialogue",
        lessonId: "lesson-food",
        title: "对话补全",
        phase: "live",
        status: "published",
        currentVersionId: "ver-food-dialogue-1",
        order: 2,
        updatedAt: iso(addDays(now, -2)),
        sessionIds: ["series-session-1"]
      },
      {
        id: "set-food-choice",
        lessonId: "lesson-food",
        title: "饮料选择",
        phase: "live",
        status: "published",
        currentVersionId: "ver-food-choice-1",
        order: 3,
        updatedAt: iso(addDays(now, -2)),
        sessionIds: ["series-session-1"]
      },
      {
        id: "set-food-order",
        lessonId: "lesson-food",
        title: "句子排序",
        phase: "review",
        status: "published",
        currentVersionId: "ver-food-order-1",
        order: 1,
        updatedAt: iso(addDays(now, -2)),
        sessionIds: ["series-session-1"]
      },
      {
        id: "set-food-category",
        lessonId: "lesson-food",
        title: "吃的与喝的",
        phase: "review",
        status: "published",
        currentVersionId: "ver-food-category-1",
        order: 2,
        updatedAt: iso(addDays(now, -2)),
        sessionIds: ["series-session-1"]
      },
      {
        id: "set-food-poll",
        lessonId: "lesson-food",
        title: "课堂投票",
        phase: "review",
        status: "published",
        currentVersionId: "ver-food-poll-1",
        order: 3,
        updatedAt: iso(addDays(now, -2)),
        sessionIds: ["series-session-1"]
      },
      {
        id: "set-time-preview",
        lessonId: "lesson-time",
        title: "时间词预习",
        phase: "preview",
        status: "published",
        currentVersionId: "ver-time-preview-1",
        order: 1,
        updatedAt: iso(addDays(now, -2))
      },
      {
        id: "set-greetings-review-voice",
        lessonId: "lesson-greetings",
        title: "课后语音练习",
        phase: "review",
        status: "published",
        currentVersionId: "ver-greetings-review-voice-1",
        order: 2,
        updatedAt: iso(addDays(now, -5))
      },
      {
        id: "set-friends-preview",
        lessonId: "lesson-friends",
        title: "认识新朋友 · 课前互动",
        phase: "preview",
        status: "published",
        currentVersionId: "ver-friends-preview-1",
        order: 1,
        updatedAt: iso(addDays(now, -3))
      }
    ];
    interactionSets.forEach((set) => {
      set.countsTowardGrade = !set.id.includes("poll") && !set.id.includes("voice");
    });

    const interactionVersions = [
      {
        id: "ver-greetings-preview-1",
        setId: "set-greetings-preview",
        version: 1,
        status: "archived",
        publishedAt: iso(addDays(now, -8)),
        publishedBy: "teacher-lina",
        publishNote: "初版",
        items: []
      },
      {
        id: "ver-greetings-preview-2",
        setId: "set-greetings-preview",
        version: 2,
        status: "published",
        publishedAt: iso(addDays(now, -4)),
        publishedBy: "teacher-lina",
        publishNote: "补充了“早上好”填空题与印尼语解释。",
        items: [
          {
            id: "item-preview-choice",
            type: "choice",
            prompt: "“你好”最接近哪一种印尼语表达？",
            explanation: "“你好”是通用问候，适合初次见面。",
            multiple: false,
            choices: [
              { id: "c1", text: "Halo", isCorrect: true },
              { id: "c2", text: "Terima kasih", isCorrect: false },
              { id: "c3", text: "Selamat tidur", isCorrect: false }
            ]
          },
          {
            id: "item-preview-fill",
            type: "fill",
            prompt: "早上见面时说：____ 好！",
            explanation: "“早上好”是早晨问候。",
            sentence: "____ 好！",
            blanks: [{ id: "b1", answers: ["早上", "zao shang"] }]
          }
        ]
      },
      {
        id: "ver-greetings-live-1",
        setId: "set-greetings-live",
        version: 1,
        status: "published",
        publishedAt: iso(addDays(now, -6)),
        publishedBy: "teacher-lina",
        publishNote: "首版课堂互动",
        items: [
          {
            id: "item-live-match",
            type: "match",
            prompt: "把中文问候与印尼语意思连起来。",
            explanation: "先看中文，再选择对应的印尼语。",
            pairs: [
              { id: "p1", left: "你好", right: "Halo" },
              { id: "p2", left: "老师好", right: "Halo, Guru" },
              { id: "p3", left: "大家好", right: "Halo semuanya" },
              { id: "p4", left: "再见", right: "Sampai jumpa" }
            ]
          },
          {
            id: "item-live-memory",
            type: "memory",
            prompt: "翻开卡片，找到中文和印尼语配对。",
            explanation: "记住卡片位置，可以帮助快速回忆词汇。",
            pairs: [
              { id: "m1", left: "早上", right: "Pagi" },
              { id: "m2", left: "中午", right: "Siang" },
              { id: "m3", left: "下午", right: "Sore" },
              { id: "m4", left: "晚上", right: "Malam" }
            ]
          }
        ]
      },
      {
        id: "ver-greetings-review-1",
        setId: "set-greetings-review",
        version: 1,
        status: "published",
        publishedAt: iso(addDays(now, -6)),
        publishedBy: "teacher-lina",
        publishNote: "首版课后复习",
        items: [
          {
            id: "item-review-order",
            type: "order",
            prompt: "把句子排成自然的中文问候。",
            explanation: "中文自我介绍常按“你好，我是……，很高兴认识你”的顺序。",
            orderItems: [
              { id: "o1", text: "你好" },
              { id: "o2", text: "我是 Anisa" },
              { id: "o3", text: "很高兴认识你" }
            ],
            correctOrder: ["o1", "o2", "o3"]
          },
          {
            id: "item-review-poll",
            type: "poll",
            prompt: "今天哪个互动最有挑战？",
            explanation: "投票不评分，用于老师了解课堂体验。",
            pollOptions: [
              { id: "poll1", text: "连线配对" },
              { id: "poll2", text: "翻牌记忆" },
              { id: "poll3", text: "开口表达" }
            ]
          }
        ]
      },
      {
        id: "ver-greetings-scenario-1",
        setId: "set-greetings-scenario",
        version: 1,
        status: "published",
        publishedAt: iso(addDays(now, -3)),
        publishedBy: "teacher-lina",
        publishNote: "新增看图单选、图片连线、情景选择和对话补全四道题型。",
        items: [
          {
            id: "item-scenario-picture",
            type: "picture",
            prompt: "看图，这是什么？",
            promptPinyin: "Kàn tú, zhè shì shénme?",
            explanation: "「猫」是 māo，是家里常见的小动物。",
            media: { icon: "🐱", image: "", alt: "一只猫" },
            choices: [
              { id: "sc-pic-cat", text: "猫", hint: "māo", isCorrect: true },
              { id: "sc-pic-dog", text: "狗", hint: "gǒu", isCorrect: false },
              { id: "sc-pic-bird", text: "鸟", hint: "niǎo", isCorrect: false }
            ]
          },
          {
            id: "item-scenario-picture-match",
            type: "picture-match",
            prompt: "把图片和词语配成对。",
            explanation: "学校 xué xiào、医院 yī yuàn、商店 shāng diàn、公园 gōng yuán。",
            pairs: [
              { id: "sc-pm-school", left: "学校", right: "学校", rightPinyin: "xué xiào", media: { icon: "🏫", image: "", alt: "学校的教学楼" } },
              { id: "sc-pm-hospital", left: "医院", right: "医院", rightPinyin: "yī yuàn", media: { icon: "🏥", image: "", alt: "医院的大楼" } },
              { id: "sc-pm-shop", left: "商店", right: "商店", rightPinyin: "shāng diàn", media: { icon: "🏪", image: "", alt: "商店的门面" } },
              { id: "sc-pm-park", left: "公园", right: "公园", rightPinyin: "gōng yuán", media: { icon: "🌳", image: "", alt: "公园里的大树" } }
            ]
          },
          {
            id: "item-scenario-situation",
            type: "situation",
            prompt: "看场景，选出这个场合里最得体的说法。",
            explanation: "向别人借东西要用「请问……可以吗」。",
            scene: "你想借同学的笔。",
            sceneTranslation: "Kamu mau meminjam pulpen temanmu.",
            media: { icon: "✏️", image: "", alt: "一支铅笔" },
            choices: [
              { id: "sc-sit-rude", text: "喂，给我笔！", hint: "太生硬", isCorrect: false },
              { id: "sc-sit-polite", text: "请问，我可以借你的笔吗？", hint: "先请问，再提出请求", isCorrect: true },
              { id: "sc-sit-blunt", text: "笔。", hint: "话没说完", isCorrect: false }
            ]
          },
          {
            id: "item-scenario-dialogue",
            type: "dialogue",
            prompt: "选出合适的下一句。",
            explanation: "上一句问的是「在哪儿」，所以要回答位置；另外两句接不上。",
            dialogueThem: "请问，洗手间在哪儿？",
            dialoguePlaceholder: "？",
            choices: [
              { id: "sc-dlg-place", text: "在二楼，往左走。", isCorrect: true },
              { id: "sc-dlg-name", text: "我叫小明。", isCorrect: false },
              { id: "sc-dlg-weather", text: "今天很热。", isCorrect: false }
            ]
          }
        ]
      },
      {
        id: "ver-greetings-batch-three-1",
        setId: "set-greetings-batch-three",
        version: 1,
        status: "published",
        publishedAt: iso(addDays(now, -2)),
        publishedBy: "teacher-lina",
        publishNote: "新增八类题型：拼音匹配、分类归组、拼字组词、找错误、听音选词、跟读、看图说话、开放问答。",
        items: [
          {
            id: "item-batch3-category",
            type: "category",
            prompt: "把下面的词放到对应的类别里。",
            explanation: "「吃」后面接要嚼的食物，「喝」后面接液体。",
            groups: [
              { id: "batch3-cat-eat", name: "吃的", hint: "用「吃」" },
              { id: "batch3-cat-drink", name: "喝的", hint: "用「喝」" }
            ],
            words: [
              { id: "batch3-cat-w1", text: "饺子", pinyin: "jiǎozi", group: "batch3-cat-eat" },
              { id: "batch3-cat-w2", text: "米饭", pinyin: "mǐfàn", group: "batch3-cat-eat" },
              { id: "batch3-cat-w3", text: "水", pinyin: "shuǐ", group: "batch3-cat-drink" },
              { id: "batch3-cat-w4", text: "果汁", pinyin: "guǒzhī", group: "batch3-cat-drink" }
            ]
          },
          {
            id: "item-batch3-word-build",
            type: "word-build",
            prompt: "拼出这个词",
            meaning: "ibu",
            answer: ["妈", "妈"],
            answerWord: "妈妈",
            answerPinyin: "māma",
            tileBank: ["妈", "妈", "爸", "姐", "哥", "弟"],
            explanation: "「妈妈」两个字一样，读 māma；「爸爸」是 bàba。"
          },
          {
            id: "item-batch3-correction",
            type: "correction",
            prompt: "下面这句话里有一个词用错了，点出来。",
            badWords: [
              { id: "batch3-fix-w1", text: "我", pinyin: "wǒ" },
              { id: "batch3-fix-w2", text: "买", pinyin: "mǎi" },
              { id: "batch3-fix-w3", text: "一", pinyin: "yī" },
              { id: "batch3-fix-w4", text: "个", pinyin: "gè", wrong: true },
              { id: "batch3-fix-w5", text: "书", pinyin: "shū" },
              { id: "batch3-fix-w6", text: "。", pinyin: "" }
            ],
            fixText: "本",
            fixedSentence: "我买一本书。",
            fixedPinyin: "Wǒ mǎi yì běn shū.",
            explanation: "「书」要用量词「本」——一本。"
          },
          {
            id: "item-batch3-pinyin-match",
            type: "pinyin-match",
            prompt: "看拼音，先选汉字，再选意思。",
            explanation: "书 shū、笔 bǐ、本子 běnzi：先听清拼音，再确认意思。",
            pinyinGroups: [
              { id: "batch3-py-g1", pinyin: "shū", word: "书", meaning: "buku", wordOptions: ["书", "笔", "本子"], meaningOptions: ["buku", "pena", "buku tulis"] },
              { id: "batch3-py-g2", pinyin: "bǐ", word: "笔", meaning: "pena", wordOptions: ["本子", "笔", "书"], meaningOptions: ["buku tulis", "pena", "buku"] },
              { id: "batch3-py-g3", pinyin: "běnzi", word: "本子", meaning: "buku tulis", wordOptions: ["书", "本子", "笔"], meaningOptions: ["pena", "buku tulis", "buku"] }
            ]
          },
          {
            id: "item-batch3-listening",
            type: "listening",
            prompt: "听一听，选出你听到的",
            audioSrc: "",
            audioText: "三",
            audioPinyin: "sān",
            choices: [
              { id: "batch3-listen-c1", text: "三", hint: "sān", isCorrect: true },
              { id: "batch3-listen-c2", text: "四", hint: "sì", isCorrect: false },
              { id: "batch3-listen-c3", text: "山", hint: "shān", isCorrect: false },
              { id: "batch3-listen-c4", text: "伞", hint: "sǎn", isCorrect: false }
            ],
            explanation: "三 sān 是第一声，读得又平又高；四 sì 是第四声。"
          },
          {
            id: "item-batch3-read-aloud",
            type: "read-aloud",
            prompt: "听一遍，然后跟着读",
            sentence: "你好",
            promptPinyin: "nǐ hǎo",
            audioSrc: "",
            explanation: "「你好」两个字都是第三声，连读时前一个字会变成第二声。",
            scores: [
              { id: "batch3-ra-s1", label: "发音", stars: 3 },
              { id: "batch3-ra-s2", label: "流利度", stars: 4 },
              { id: "batch3-ra-s3", label: "声调", stars: 3 }
            ]
          },
          {
            id: "item-batch3-picture-talk",
            type: "picture-talk",
            prompt: "看这张图，用中文说一句话。",
            speakingHint: "试试说：谁 ＋ 在做什么",
            media: { icon: "🏃", image: "", alt: "一个小朋友在跑步" },
            mediaTranslation: "Seorang anak sedang berlari.",
            sampleAnswer: "小朋友在跑步。",
            sampleAnswerPinyin: "Xiǎopéngyou zài pǎobù.",
            explanation: "中文说「谁 ＋ 在 ＋ 做什么」：小朋友 ＋ 在 ＋ 跑步。",
            scores: [
              { id: "batch3-pt-s1", label: "内容", stars: 3 },
              { id: "batch3-pt-s2", label: "完整度", stars: 3 },
              { id: "batch3-pt-s3", label: "发音", stars: 3 }
            ]
          },
          {
            id: "item-batch3-open-qa",
            type: "open-qa",
            prompt: "你周末喜欢做什么？",
            speakingWords: [
              { id: "batch3-oq-h1", text: "听音乐", pinyin: "tīng yīnyuè" },
              { id: "batch3-oq-h2", text: "打篮球", pinyin: "dǎ lánqiú" },
              { id: "batch3-oq-h3", text: "和朋友玩", pinyin: "hé péngyou wán" }
            ],
            sampleAnswer: "我周末喜欢听音乐。",
            sampleAnswerPinyin: "Wǒ zhōumò xǐhuan tīng yīnyuè.",
            samplePattern: "我周末喜欢 ______ 。",
            explanation: "用「我周末喜欢 ＋ 活动」就能完整回答这个问题。",
            scores: [
              { id: "batch3-oq-s1", label: "内容", stars: 3 },
              { id: "batch3-oq-s2", label: "完整度", stars: 3 },
              { id: "batch3-oq-s3", label: "发音", stars: 3 }
            ]
          }
        ]
      },
      {
        id: "ver-time-preview-1",
        setId: "set-time-preview",
        version: 1,
        status: "published",
        publishedAt: iso(addDays(now, -2)),
        publishedBy: "teacher-berenice",
        publishNote: "首版",
        items: [
          {
            id: "item-time-choice",
            type: "choice",
            prompt: "“晚上 8 点”的“晚上”是什么意思？",
            explanation: "“晚上”表示大概 18:00 之后的夜晚时段。",
            multiple: false,
            choices: [
              { id: "t1", text: "Malam", isCorrect: true },
              { id: "t2", text: "Pagi", isCorrect: false },
              { id: "t3", text: "Siang", isCorrect: false }
            ]
          }
        ]
      },
      {
        id: "ver-food-picture-1",
        setId: "set-food-picture",
        version: 1,
        status: "published",
        publishedAt: iso(addDays(now, -2)),
        publishedBy: "teacher-lina",
        publishNote: "餐厅中文系列第 2 课：看图选词。",
        items: [
          {
            id: "item-food-picture",
            type: "picture",
            prompt: "看图，这是什么？",
            promptPinyin: "Kàn tú, zhè shì shénme?",
            media: { icon: "🍜", image: "", alt: "一碗面条" },
            choices: [
              { id: "food-pic-noodles", text: "面条", hint: "miàntiáo", isCorrect: true },
              { id: "food-pic-rice", text: "米饭", hint: "mǐfàn", isCorrect: false },
              { id: "food-pic-juice", text: "果汁", hint: "guǒzhī", isCorrect: false }
            ],
            explanation: "面条 miàntiáo 是餐厅里很常见的食物。"
          }
        ]
      },
      {
        id: "ver-food-match-1",
        setId: "set-food-match",
        version: 1,
        status: "published",
        publishedAt: iso(addDays(now, -2)),
        publishedBy: "teacher-lina",
        publishNote: "餐厅中文系列第 2 课：图词连线。",
        items: [
          {
            id: "item-food-match",
            type: "picture-match",
            prompt: "把图片和词语配成对。",
            explanation: "米饭 mǐfàn、面条 miàntiáo、果汁 guǒzhī、茶 chá。",
            pairs: [
              { id: "food-pm-rice", left: "米饭", right: "米饭", rightPinyin: "mǐfàn", media: { icon: "🍚", image: "", alt: "一碗米饭" } },
              { id: "food-pm-noodles", left: "面条", right: "面条", rightPinyin: "miàntiáo", media: { icon: "🍜", image: "", alt: "一碗面条" } },
              { id: "food-pm-juice", left: "果汁", right: "果汁", rightPinyin: "guǒzhī", media: { icon: "🥤", image: "", alt: "一杯果汁" } },
              { id: "food-pm-tea", left: "茶", right: "茶", rightPinyin: "chá", media: { icon: "🍵", image: "", alt: "一杯茶" } }
            ]
          }
        ]
      },
      {
        id: "ver-food-fill-1",
        setId: "set-food-fill",
        version: 1,
        status: "published",
        publishedAt: iso(addDays(now, -2)),
        publishedBy: "teacher-lina",
        publishNote: "餐厅中文系列第 2 课：补全点餐句。",
        items: [
          {
            id: "item-food-fill",
            type: "fill",
            prompt: "补全点餐句子。",
            sentence: "我想吃____。",
            blanks: [{ id: "food-fill-b1", answers: ["面条", "miantiao"] }],
            explanation: "「我想吃 ＋ 食物」可以用来表达想吃什么。"
          }
        ]
      },
      {
        id: "ver-food-situation-1",
        setId: "set-food-situation",
        version: 1,
        status: "published",
        publishedAt: iso(addDays(now, -2)),
        publishedBy: "teacher-lina",
        publishNote: "餐厅中文系列第 2 课：点餐情景选择。",
        items: [
          {
            id: "item-food-situation",
            type: "situation",
            prompt: "在餐厅想点一碗面条，应该怎么说？",
            scene: "你坐在餐厅里，服务员正在等你点餐。",
            sceneTranslation: "Kamu sedang memesan makanan di restoran.",
            media: { icon: "🍜", image: "", alt: "餐厅里的一碗面条" },
            choices: [
              { id: "food-sit-rude", text: "面条！", hint: "太直接", isCorrect: false },
              { id: "food-sit-polite", text: "你好，我想吃面条。", hint: "先问候，再说想吃什么", isCorrect: true },
              { id: "food-sit-bye", text: "再见，面条。", hint: "场景不合适", isCorrect: false }
            ],
            explanation: "先问候，再用「我想吃……」表达点餐需求。"
          }
        ]
      },
      {
        id: "ver-food-dialogue-1",
        setId: "set-food-dialogue",
        version: 1,
        status: "published",
        publishedAt: iso(addDays(now, -2)),
        publishedBy: "teacher-lina",
        publishNote: "餐厅中文系列第 2 课：对话补全。",
        items: [
          {
            id: "item-food-dialogue",
            type: "dialogue",
            prompt: "选出合适的下一句。",
            dialogueThem: "你好，请问你想吃什么？",
            dialoguePlaceholder: "？",
            choices: [
              { id: "food-dlg-order", text: "你好，我想吃面条。", isCorrect: true },
              { id: "food-dlg-name", text: "我叫 Anisa。", isCorrect: false },
              { id: "food-dlg-weather", text: "今天很热。", isCorrect: false }
            ],
            explanation: "对方问想吃什么，直接回答「我想吃 ＋ 食物」。"
          }
        ]
      },
      {
        id: "ver-food-choice-1",
        setId: "set-food-choice",
        version: 1,
        status: "published",
        publishedAt: iso(addDays(now, -2)),
        publishedBy: "teacher-lina",
        publishNote: "餐厅中文系列第 2 课：饮料点单选择。",
        items: [
          {
            id: "item-food-choice",
            type: "choice",
            prompt: "服务员问：“要喝什么？”你想喝果汁，怎么说？",
            choices: [
              { id: "food-choice-juice", text: "我想喝果汁。", isCorrect: true },
              { id: "food-choice-eat", text: "我想吃果汁。", isCorrect: false },
              { id: "food-choice-short", text: "我果汁。", isCorrect: false }
            ],
            explanation: "液体饮料要用「喝」：我想喝果汁。"
          }
        ]
      },
      {
        id: "ver-food-order-1",
        setId: "set-food-order",
        version: 1,
        status: "published",
        publishedAt: iso(addDays(now, -2)),
        publishedBy: "teacher-lina",
        publishNote: "餐厅中文系列第 2 课：句子排序。",
        items: [
          {
            id: "item-food-order",
            type: "order",
            prompt: "把句子排成自然的点餐表达。",
            orderItems: [
              { id: "food-order-hello", text: "你好" },
              { id: "food-order-want", text: "我想吃" },
              { id: "food-order-noodles", text: "一碗面条" }
            ],
            correctOrder: ["food-order-hello", "food-order-want", "food-order-noodles"],
            explanation: "自然顺序是：你好，我想吃一碗面条。"
          }
        ]
      },
      {
        id: "ver-food-category-1",
        setId: "set-food-category",
        version: 1,
        status: "published",
        publishedAt: iso(addDays(now, -2)),
        publishedBy: "teacher-lina",
        publishNote: "餐厅中文系列第 2 课：吃的喝的分类。",
        items: [
          {
            id: "item-food-category",
            type: "category",
            prompt: "把词语放进「吃的」或「喝的」。",
            groups: [
              { id: "food-cat-eat", name: "吃的", hint: "用「吃」" },
              { id: "food-cat-drink", name: "喝的", hint: "用「喝」" }
            ],
            words: [
              { id: "food-cat-rice", text: "米饭", pinyin: "mǐfàn", group: "food-cat-eat" },
              { id: "food-cat-noodles", text: "面条", pinyin: "miàntiáo", group: "food-cat-eat" },
              { id: "food-cat-juice", text: "果汁", pinyin: "guǒzhī", group: "food-cat-drink" },
              { id: "food-cat-tea", text: "茶", pinyin: "chá", group: "food-cat-drink" }
            ],
            explanation: "米饭和面条是吃的，果汁和茶是喝的。"
          }
        ]
      },
      {
        id: "ver-food-poll-1",
        setId: "set-food-poll",
        version: 1,
        status: "published",
        publishedAt: iso(addDays(now, -2)),
        publishedBy: "teacher-lina",
        publishNote: "餐厅中文系列第 2 课：课堂投票。",
        items: [
          {
            id: "item-food-poll",
            type: "poll",
            prompt: "今天你最想用哪一句来点餐？",
            pollOptions: [
              { id: "food-poll-noodles", text: "我想吃面条。" },
              { id: "food-poll-juice", text: "我想喝果汁。" },
              { id: "food-poll-spicy", text: "请不要辣。" }
            ],
            explanation: "投票不计分，用来回顾今天最常用的点餐表达。"
          }
        ]
      },
      {
        id: "ver-greetings-review-voice-1",
        setId: "set-greetings-review-voice",
        version: 1,
        status: "published",
        publishedAt: iso(addDays(now, -5)),
        publishedBy: "teacher-lina",
        publishNote: "课后加一条跟读和一条开放问答，练开口。",
        items: [
          {
            id: "item-review-voice-readaloud",
            type: "read-aloud",
            prompt: "听一遍，然后跟着读。",
            explanation: "「你好，很高兴认识你」是第一次见面最常用的整句。",
            sentence: "你好，很高兴认识你。",
            promptPinyin: "Nǐ hǎo, hěn gāoxìng rènshi nǐ.",
            audioSrc: "",
            scores: [
              { id: "rv-s1", label: "发音", stars: 3 },
              { id: "rv-s2", label: "流利度", stars: 3 },
              { id: "rv-s3", label: "声调", stars: 3 }
            ]
          },
          {
            id: "item-review-voice-openqa",
            type: "open-qa",
            prompt: "你叫什么名字？见到新朋友你会说什么？",
            explanation: "先说名字，再说「很高兴认识你」，两句就能介绍完自己。",
            speakingWords: [
              { id: "rv-w1", text: "我叫", pinyin: "wǒ jiào" },
              { id: "rv-w2", text: "很高兴", pinyin: "hěn gāoxìng" },
              { id: "rv-w3", text: "认识你", pinyin: "rènshi nǐ" }
            ],
            sampleAnswer: "我叫 Anisa，很高兴认识你。",
            sampleAnswerPinyin: "Wǒ jiào Anisa, hěn gāoxìng rènshi nǐ.",
            samplePattern: "我叫 ______ ，很高兴认识你。",
            scores: [
              { id: "ro-s1", label: "内容", stars: 3 },
              { id: "ro-s2", label: "完整度", stars: 3 },
              { id: "ro-s3", label: "发音", stars: 3 }
            ]
          }
        ]
      },
      {
        id: "ver-friends-preview-1",
        setId: "set-friends-preview",
        version: 1,
        status: "published",
        publishedAt: iso(addDays(now, -3)),
        publishedBy: "teacher-berenice",
        publishNote: "认识新朋友课节的课前互动。",
        items: [
          {
            id: "item-friends-preview-country",
            type: "choice",
            prompt: "对方问「你是哪国人？」，最合适的回答是？",
            explanation: "问的是国家，回答先说「我是……人」，名字和年龄都答非所问。",
            multiple: false,
            choices: [
              { id: "fc1", text: "我是印尼人。", isCorrect: true },
              { id: "fc2", text: "我叫 Kevin。", isCorrect: false },
              { id: "fc3", text: "我今年二十岁。", isCorrect: false }
            ]
          },
          {
            id: "item-friends-preview-pinyin",
            type: "pinyin-match",
            prompt: "看拼音，先选汉字，再选意思。",
            explanation: "名字 míngzi、朋友 péngyou、高兴 gāoxìng 是自我介绍里最常出现的三个词。",
            pinyinGroups: [
              { id: "fpg-0", pinyin: "míngzi", word: "名字", meaning: "nama", wordOptions: ["名字", "朋友", "高兴"], meaningOptions: ["nama", "teman", "senang"] },
              { id: "fpg-1", pinyin: "péngyou", word: "朋友", meaning: "teman", wordOptions: ["高兴", "朋友", "名字"], meaningOptions: ["senang", "teman", "nama"] },
              { id: "fpg-2", pinyin: "gāoxìng", word: "高兴", meaning: "senang", wordOptions: ["朋友", "名字", "高兴"], meaningOptions: ["teman", "nama", "senang"] }
            ]
          }
        ]
      }
    ];

    const interactionAttempts = [
      {
        id: "attempt-anisa-preview-greetings",
        setId: "set-greetings-preview",
        versionId: "ver-greetings-preview-2",
        studentId: "student-anisa",
        sessionId: "session-past",
        phase: "preview",
        score: 100,
        bestScore: 100,
        attempt: 1,
        timeSpentSeconds: 96,
        completedAt: iso(addDays(now, -2)),
        answers: {},
        wrongItemIds: [],
        pollAnswers: {}
      },
      {
        id: "attempt-anisa-live-greetings",
        setId: "set-greetings-live",
        versionId: "ver-greetings-live-1",
        studentId: "student-anisa",
        sessionId: "session-past",
        phase: "live",
        score: 75,
        bestScore: 75,
        attempt: 1,
        timeSpentSeconds: 142,
        completedAt: iso(addDays(now, -1)),
        answers: {},
        wrongItemIds: ["item-live-memory"],
        pollAnswers: {}
      },
      {
        id: "attempt-maya-preview-greetings",
        setId: "set-greetings-preview",
        versionId: "ver-greetings-preview-2",
        studentId: "student-maya",
        sessionId: "session-past",
        phase: "preview",
        score: 80,
        bestScore: 80,
        attempt: 1,
        timeSpentSeconds: 118,
        completedAt: iso(addDays(now, -12)),
        answers: {},
        wrongItemIds: ["item-preview-choice"],
        pollAnswers: {}
      },
      {
        id: "attempt-maya-live-greetings",
        setId: "set-greetings-live",
        versionId: "ver-greetings-live-1",
        studentId: "student-maya",
        sessionId: "session-past",
        phase: "live",
        score: 90,
        bestScore: 90,
        attempt: 1,
        timeSpentSeconds: 132,
        completedAt: iso(addDays(now, -8)),
        answers: {},
        wrongItemIds: [],
        pollAnswers: {}
      },
      {
        id: "attempt-maya-review-greetings",
        setId: "set-greetings-review",
        versionId: "ver-greetings-review-1",
        studentId: "student-maya",
        sessionId: "session-past",
        phase: "review",
        score: 70,
        bestScore: 70,
        attempt: 1,
        timeSpentSeconds: 156,
        completedAt: iso(addDays(now, -3)),
        answers: {},
        wrongItemIds: ["item-review-order"],
        pollAnswers: {}
      },
      {
        id: "attempt-raymond-preview-greetings",
        setId: "set-greetings-preview",
        versionId: "ver-greetings-preview-2",
        studentId: "student-raymond",
        sessionId: "session-past",
        phase: "preview",
        score: 60,
        bestScore: 60,
        attempt: 1,
        timeSpentSeconds: 205,
        completedAt: iso(addDays(now, -21)),
        answers: {},
        wrongItemIds: ["item-preview-fill"],
        pollAnswers: {}
      },
      {
        id: "attempt-raymond-live-greetings",
        setId: "set-greetings-live",
        versionId: "ver-greetings-live-1",
        studentId: "student-raymond",
        sessionId: "session-past",
        phase: "live",
        score: 85,
        bestScore: 85,
        attempt: 1,
        timeSpentSeconds: 164,
        completedAt: iso(addDays(now, -14)),
        answers: {},
        wrongItemIds: ["item-live-match"],
        pollAnswers: {}
      },
      {
        id: "attempt-raymond-review-greetings",
        setId: "set-greetings-review",
        versionId: "ver-greetings-review-1",
        studentId: "student-raymond",
        sessionId: "session-past",
        phase: "review",
        score: 95,
        bestScore: 95,
        attempt: 1,
        timeSpentSeconds: 125,
        completedAt: iso(addDays(now, -5)),
        answers: {},
        wrongItemIds: [],
        pollAnswers: {}
      },
      {
        id: "attempt-raymond-scenario-greetings",
        setId: "set-greetings-scenario",
        versionId: "ver-greetings-scenario-1",
        studentId: "student-raymond",
        sessionId: "session-past",
        phase: "live",
        score: 88,
        bestScore: 88,
        attempt: 1,
        timeSpentSeconds: 118,
        completedAt: iso(addDays(now, -2)),
        answers: {},
        wrongItemIds: [],
        pollAnswers: {}
      },
      {
        id: "attempt-raymond-batch-three",
        setId: "set-greetings-batch-three",
        versionId: "ver-greetings-batch-three-1",
        studentId: "student-raymond",
        sessionId: "session-past",
        phase: "review",
        score: 78,
        bestScore: 78,
        attempt: 1,
        timeSpentSeconds: 176,
        completedAt: iso(addDays(now, -1)),
        answers: {},
        wrongItemIds: ["item-batch-category"],
        pollAnswers: {}
      }
    ];

    const gradePolicies = [
      {
        id: "grade-policy-default",
        schoolId: null,
        effectiveFrom: iso(addDays(now, -120)),
        weights: { interaction: 40, homework: 30, exam: 30 },
        updatedBy: "operator-ray",
        updatedAt: iso(addDays(now, -120))
      },
      {
        id: "grade-policy-sacred-heart",
        schoolId: "school-sacred-heart",
        effectiveFrom: iso(addDays(now, -60)),
        weights: { interaction: 35, homework: 35, exam: 30 },
        updatedBy: "operator-ray",
        updatedAt: iso(addDays(now, -60))
      }
    ];

    const shengxinClass = classes.find((item) => item.name === "印尼圣心学校7年级A班");
    const shengxinRoster = ["student-anisa", "student-maya", "student-raymond", ...schoolDemoStudents.map(([id]) => id)];
    shengxinRoster.slice(3).forEach((studentId, studentIndex) => {
      interactionAttempts.push(
        {
          id: `attempt-${studentId}-preview`,
          setId: "set-greetings-preview",
          versionId: "ver-greetings-preview-2",
          studentId,
          sessionId: "session-past",
          phase: "preview",
          score: 68 + ((studentIndex * 3) % 25),
          bestScore: 68 + ((studentIndex * 3) % 25),
          attempt: 1,
          timeSpentSeconds: 110 + studentIndex * 9,
          completedAt: iso(addDays(now, -4 + (studentIndex % 3))),
          answers: {},
          wrongItemIds: studentIndex % 2 ? ["item-preview-fill"] : [],
          pollAnswers: {}
        },
        {
          id: `attempt-${studentId}-review`,
          setId: "set-greetings-review",
          versionId: "ver-greetings-review-1",
          studentId,
          sessionId: "session-past",
          phase: "review",
          score: 72 + ((studentIndex * 4) % 22),
          bestScore: 72 + ((studentIndex * 4) % 22),
          attempt: 1,
          timeSpentSeconds: 135 + studentIndex * 7,
          completedAt: iso(addDays(now, -2 + (studentIndex % 2))),
          answers: {},
          wrongItemIds: studentIndex % 3 === 0 ? ["item-review-order"] : [],
          pollAnswers: {}
        }
      );
    });

    schoolDemoStudentsB.forEach(([studentId], studentIndex) => {
      interactionAttempts.push(
        {
          id: `attempt-${studentId}-preview`,
          setId: "set-greetings-preview",
          versionId: "ver-greetings-preview-2",
          studentId,
          sessionId: "session-8b-past",
          phase: "preview",
          score: 82 + ((studentIndex * 3) % 14),
          bestScore: 82 + ((studentIndex * 3) % 14),
          attempt: 1,
          timeSpentSeconds: 95 + studentIndex * 8,
          completedAt: iso(addDays(now, -3 + (studentIndex % 2))),
          answers: {},
          wrongItemIds: [],
          pollAnswers: {}
        },
        {
          id: `attempt-${studentId}-review`,
          setId: "set-greetings-review",
          versionId: "ver-greetings-review-1",
          studentId,
          sessionId: "session-8b-past",
          phase: "review",
          score: 85 + ((studentIndex * 2) % 12),
          bestScore: 85 + ((studentIndex * 2) % 12),
          attempt: 1,
          timeSpentSeconds: 120 + studentIndex * 6,
          completedAt: iso(addDays(now, -1)),
          answers: {},
          wrongItemIds: [],
          pollAnswers: {}
        }
      );
    });
    const assessments = shengxinClass
      ? [
          {
            id: "assessment-homework-greetings-1",
            classId: shengxinClass.id,
            title: "问候表达 · 第 1 次作业",
            category: "homework",
            maxScore: 100,
            assessedAt: iso(addDays(now, -24)),
            teacherId: "teacher-lina",
            createdBy: "teacher-lina",
            createdAt: iso(addDays(now, -27)),
            status: "published",
            rosterStudentIds: shengxinRoster
          },
          {
            id: "assessment-exam-greetings-1",
            classId: shengxinClass.id,
            title: "月度测验 · 问候与时间",
            category: "exam",
            maxScore: 100,
            assessedAt: iso(addDays(now, -17)),
            teacherId: "teacher-lina",
            createdBy: "teacher-lina",
            createdAt: iso(addDays(now, -20)),
            status: "published",
            rosterStudentIds: shengxinRoster
          },
          {
            id: "assessment-homework-greetings-2",
            classId: shengxinClass.id,
            title: "课后复习单 · 第 2 次作业",
            category: "homework",
            maxScore: 20,
            assessedAt: iso(addDays(now, -9)),
            teacherId: "teacher-lina",
            createdBy: "teacher-lina",
            createdAt: iso(addDays(now, -11)),
            status: "published",
            rosterStudentIds: shengxinRoster
          },
          {
            id: "assessment-exam-greetings-2",
            classId: shengxinClass.id,
            title: "课堂测验 · 点餐表达",
            category: "exam",
            maxScore: 50,
            assessedAt: iso(addDays(now, -3)),
            teacherId: "teacher-lina",
            createdBy: "teacher-lina",
            createdAt: iso(addDays(now, -5)),
            status: "published",
            rosterStudentIds: shengxinRoster
          },
          {
            id: "assessment-homework-greetings-3",
            classId: shengxinClass.id,
            title: "周末复习 · 第 3 次作业",
            category: "homework",
            maxScore: 100,
            assessedAt: iso(addDays(now, -6)),
            teacherId: "teacher-lina",
            createdBy: "teacher-lina",
            createdAt: iso(addDays(now, -8)),
            status: "published",
            rosterStudentIds: shengxinRoster
          },
          {
            id: "assessment-exam-greetings-3",
            classId: shengxinClass.id,
            title: "周测 · 问候与餐厅表达",
            category: "exam",
            maxScore: 50,
            assessedAt: iso(addDays(now, -2)),
            teacherId: "teacher-lina",
            createdBy: "teacher-lina",
            createdAt: iso(addDays(now, -4)),
            status: "published",
            rosterStudentIds: shengxinRoster
          }
        ]
      : [];
    assessments.forEach((assessment) => {
      assessment.schoolId = shengxinClass?.schoolId || "school-demo";
    });

    const scoreRows = [
      ["assessment-homework-greetings-1", "student-anisa", 88, "graded"],
      ["assessment-homework-greetings-1", "student-maya", 76, "graded"],
      ["assessment-homework-greetings-1", "student-raymond", null, "pending"],
      ["assessment-exam-greetings-1", "student-anisa", 91, "graded"],
      ["assessment-exam-greetings-1", "student-maya", 84, "graded"],
      ["assessment-exam-greetings-1", "student-raymond", 70, "graded"],
      ["assessment-homework-greetings-2", "student-anisa", 18, "graded"],
      ["assessment-homework-greetings-2", "student-maya", 15, "graded"],
      ["assessment-homework-greetings-2", "student-raymond", null, "absent"],
      ["assessment-exam-greetings-2", "student-anisa", 47, "graded"],
      ["assessment-exam-greetings-2", "student-maya", 38, "graded"],
      ["assessment-exam-greetings-2", "student-raymond", 32, "graded"],
      ["assessment-homework-greetings-3", "student-anisa", 94, "graded"],
      ["assessment-homework-greetings-3", "student-maya", 88, "graded"],
      ["assessment-homework-greetings-3", "student-raymond", 82, "graded"],
      ["assessment-exam-greetings-3", "student-anisa", 46, "graded"],
      ["assessment-exam-greetings-3", "student-maya", 40, "graded"],
      ["assessment-exam-greetings-3", "student-raymond", 44, "graded"]
    ];
    shengxinRoster.slice(3).forEach((studentId, studentIndex) => {
      assessments.forEach((assessment, assessmentIndex) => {
        const base = assessment.maxScore === 20 ? 15 : assessment.maxScore === 50 ? 34 : 72;
        const bump = (studentIndex * 3 + assessmentIndex * 2) % 18;
        scoreRows.push([assessment.id, studentId, Math.min(assessment.maxScore, base + bump), "graded"]);
      });
    });

    const eightBClass = classes.find((item) => item.name === "印尼圣心学校8年级B班");
    const eightBRoster = schoolDemoStudentsB.map(([id]) => id);
    if (eightBClass) {
      assessments.push(
        {
          id: "assessment-homework-8b-1",
          classId: eightBClass.id,
          schoolId: eightBClass.schoolId,
          title: "8B 问候表达 · 作业",
          category: "homework",
          maxScore: 100,
          assessedAt: iso(addDays(now, -8)),
          teacherId: "teacher-berenice",
          createdBy: "teacher-berenice",
          createdAt: iso(addDays(now, -10)),
          status: "published",
          rosterStudentIds: eightBRoster
        },
        {
          id: "assessment-exam-8b-1",
          classId: eightBClass.id,
          schoolId: eightBClass.schoolId,
          title: "8B 问候表达 · 单元测验",
          category: "exam",
          maxScore: 100,
          assessedAt: iso(addDays(now, -4)),
          teacherId: "teacher-berenice",
          createdBy: "teacher-berenice",
          createdAt: iso(addDays(now, -6)),
          status: "published",
          rosterStudentIds: eightBRoster
        }
      );
      eightBRoster.forEach((studentId, studentIndex) => {
        scoreRows.push([
          "assessment-homework-8b-1",
          studentId,
          78 + ((studentIndex * 3) % 13),
          "graded"
        ]);
        scoreRows.push([
          "assessment-exam-8b-1",
          studentId,
          80 + ((studentIndex * 2) % 12),
          "graded"
        ]);
      });
    }
    const assessmentScores = scoreRows.map(([assessmentId, studentId, score, status], index) => {
      const assessment = assessments.find((item) => item.id === assessmentId);
      const normalizedScore = score === null || !assessment ? null : Math.round((Number(score) / assessment.maxScore) * 1000) / 10;
      return {
        id: `assessment-score-${index + 1}`,
        assessmentId,
        studentId,
        score,
        normalizedScore,
        status,
        gradedBy: status === "graded" || status === "absent" ? "teacher-lina" : undefined,
        gradedAt: status === "graded" || status === "absent" ? assessment.updatedAt || assessment.createdAt : undefined,
        updatedAt: assessment.createdAt,
        updatedBy: status === "graded" || status === "absent" ? "teacher-lina" : "teacher-lina"
      };
    });

    const materials = [
      {
        id: "material-preview-pdf",
        title: "课前词汇卡：你好、早上好、再见",
        description: "带拼音和印尼语释义的 PDF 词汇卡。",
        kind: "file",
        fileType: "pdf",
        language: "zh-id",
        ownerId: "teacher-lina",
        status: "published",
        currentVersion: 2,
        downloadCount: 18,
        createdAt: iso(addDays(now, -12)),
        versions: [
          {
            version: 1,
            fileName: "greeting-preview-v1.pdf",
            sizeLabel: "18 KB",
            url: "/shared/demo-materials/greeting-preview.pdf",
            publishedAt: iso(addDays(now, -12))
          },
          {
            version: 2,
            fileName: "greeting-preview.pdf",
            sizeLabel: "24 KB",
            url: "/shared/demo-materials/greeting-preview.pdf",
            publishedAt: iso(addDays(now, -4))
          }
        ]
      },
      {
        id: "material-live-slides",
        title: "课堂互动投影提示",
        description: "包含课堂节奏和互动提示语的演示文件。",
        kind: "file",
        fileType: "pptx",
        language: "zh-id",
        ownerId: "teacher-lina",
        status: "published",
        currentVersion: 1,
        downloadCount: 6,
        createdAt: iso(addDays(now, -6)),
        versions: [
          {
            version: 1,
            fileName: "greeting-classroom-deck.pptx",
            sizeLabel: "36 KB",
            url: "/shared/demo-materials/greeting-classroom-deck.pptx",
            publishedAt: iso(addDays(now, -6))
          }
        ]
      },
      {
        id: "material-review-audio",
        title: "课后跟读音频",
        description: "学生可以反复播放并跟读四组问候。",
        kind: "file",
        fileType: "wav",
        language: "zh-id",
        ownerId: "teacher-berenice",
        status: "published",
        currentVersion: 1,
        downloadCount: 12,
        createdAt: iso(addDays(now, -5)),
        versions: [
          {
            version: 1,
            fileName: "greeting-review.wav",
            sizeLabel: "84 KB",
            url: "/shared/demo-materials/greeting-review.wav",
            publishedAt: iso(addDays(now, -5))
          }
        ]
      },
      {
        id: "material-friends-preview",
        title: "认识新朋友 · 互动课件",
        description: "包含词汇点读、选择练习和句子排序的课前互动课件。",
        kind: "courseware",
        fileType: "html",
        language: "zh-id",
        ownerId: "teacher-berenice",
        status: "published",
        currentVersion: 1,
        downloadCount: 5,
        createdAt: iso(addDays(now, -2)),
        versions: [
          {
            version: 1,
            fileName: "friends-courseware.html",
            sizeLabel: "互动课件",
            url: "/shared/demo-materials/friends-courseware.html",
            publishedAt: iso(addDays(now, -2))
          }
        ]
      },
      {
        id: "material-time-courseware",
        title: "现在几点？· 互动课件",
        description: "时间词点读、钟表读法、时间配对和句子排序，可在课前预习时播放。",
        kind: "courseware",
        fileType: "html",
        language: "zh-id",
        ownerId: "teacher-lina",
        status: "published",
        currentVersion: 1,
        downloadCount: 3,
        createdAt: iso(addDays(now, -3)),
        versions: [
          {
            version: 1,
            fileName: "time-courseware.html",
            sizeLabel: "互动课件",
            url: "/shared/demo-materials/time-courseware.html",
            publishedAt: iso(addDays(now, -3))
          }
        ]
      },
      {
        id: "material-time-review-sheet",
        title: "现在几点？· 课后复习单",
        description: "两页可打印复习单：时间词、句型、我会说、选一选、连一连和语音作业。",
        kind: "file",
        fileType: "pdf",
        language: "zh-id",
        ownerId: "teacher-lina",
        status: "published",
        currentVersion: 1,
        downloadCount: 2,
        createdAt: iso(addDays(now, -2)),
        versions: [
          {
            version: 1,
            fileName: "time-review-sheet.pdf",
            sizeLabel: "62 KB",
            url: "/shared/demo-materials/time-review-sheet.pdf",
            publishedAt: iso(addDays(now, -2))
          }
        ]
      },
      {
        id: "material-time-review-audio",
        title: "时间句型跟读音频",
        description: "四组时间句型的跟读示范音频，学生可以反复播放并录音上传。",
        kind: "file",
        fileType: "wav",
        language: "zh-id",
        ownerId: "teacher-lina",
        status: "published",
        currentVersion: 1,
        downloadCount: 1,
        createdAt: iso(addDays(now, -2)),
        versions: [
          {
            version: 1,
            fileName: "time-review-audio.wav",
            sizeLabel: "303 KB",
            url: "/shared/demo-materials/time-review-audio.wav",
            publishedAt: iso(addDays(now, -2))
          }
        ]
      },
      {
        id: "material-video-link",
        title: "情境视频：初次见面",
        description: "一段短视频外链，用于课后复习语境。",
        kind: "link",
        fileType: "video",
        language: "zh-id",
        ownerId: "teacher-lina",
        status: "published",
        currentVersion: 1,
        downloadCount: 3,
        createdAt: iso(addDays(now, -3)),
        externalUrl: "https://www.youtube.com/results?search_query=mandarin+greetings+for+beginners",
        versions: []
      }
    ];

    const materialRefs = [
      { id: "ref-preview-pdf", materialId: "material-preview-pdf", lessonId: "lesson-greetings", phase: "preview", order: 1, published: true },
      { id: "ref-friends-preview", materialId: "material-friends-preview", lessonId: "lesson-friends", phase: "preview", order: 1, published: true },
      { id: "ref-time-courseware", materialId: "material-time-courseware", lessonId: "lesson-time", phase: "preview", order: 1, published: true },
      { id: "ref-time-review-sheet", materialId: "material-time-review-sheet", lessonId: "lesson-time", phase: "review", order: 1, published: true },
      { id: "ref-time-review-audio", materialId: "material-time-review-audio", lessonId: "lesson-time", phase: "review", order: 2, published: true },
      { id: "ref-live-slides", materialId: "material-live-slides", lessonId: "lesson-greetings", phase: "live", order: 1, published: true },
      { id: "ref-review-audio", materialId: "material-review-audio", lessonId: "lesson-greetings", phase: "review", order: 1, published: true },
      { id: "ref-review-video", materialId: "material-video-link", lessonId: "lesson-greetings", phase: "review", order: 2, published: true }
    ];

    const notifications = [
      {
        id: "notice-anisa-live",
        userId: "student-anisa",
        type: "class_reminder",
        title: "课堂马上开始",
        body: "问候口语大班课已经开放，请进入课堂完成互动。",
        read: false,
        createdAt: iso(new Date(liveStart.getTime() - 30 * 60 * 1000)),
        link: "/student/schedule"
      },
      {
        id: "notice-anisa-preview",
        userId: "student-anisa",
        type: "content_published",
        title: "新的预习任务",
        body: "Lina 老师更新了“问候热身”，可以在上课前完成。",
        read: false,
        createdAt: iso(addDays(now, -4)),
        link: "/student/lesson/lesson-greetings?phase=preview&sessionId=session-live"
      },
      {
        id: "notice-teacher-roster",
        userId: "teacher-lina",
        type: "roster_update",
        title: "预约名单有更新",
        body: "Raymond 预约了今晚的问候口语大班课。",
        read: false,
        createdAt: iso(addDays(now, -2)),
        link: "/teacher/session/session-live"
      },
      {
        id: "notice-ops-waitlist",
        userId: "operator-ray",
        type: "waitlist",
        title: "候补队列需要关注",
        body: "“时间表达 · 满员演练课”已有 1 位候补学生。",
        read: false,
        createdAt: iso(addDays(now, -1)),
        link: "/operator/sessions/session-waitlist-full"
      }
    ];

    const changeRequests = [
      {
        id: "request-reschedule-1",
        sessionId: "series-session-2",
        teacherId: "teacher-lina",
        kind: "reschedule",
        reason: "9月26日学校有中文教研活动，希望这节课顺延一天到同一时间段。",
        status: "pending",
        createdAt: iso(addDays(now, -1))
      }
    ];

    const auditEvents = [
      {
        id: "audit-1",
        actorId: "operator-ray",
        action: "create_session",
        targetType: "session",
        targetId: "session-preview",
        summary: "创建“认识新朋友 · 体验课”",
        reason: "",
        createdAt: iso(addDays(now, -5))
      },
      {
        id: "audit-2",
        actorId: "teacher-lina",
        action: "publish_interaction",
        targetType: "interaction_set",
        targetId: "set-greetings-preview",
        summary: "发布“问候热身”第 2 版",
        reason: "补充印尼语解释",
        createdAt: iso(addDays(now, -4))
      },
      {
        id: "audit-3",
        actorId: "operator-ray",
        action: "proxy_booking",
        targetType: "session",
        targetId: "session-live",
        summary: "为 Raymond 代约问候口语大班课",
        reason: "学生家长通过客服渠道提出预约",
        createdAt: iso(addDays(now, -2))
      }
    ];
    auditEvents.forEach((event) => {
      if (event.targetType === "session" || event.targetType === "class") {
        const session = sessions.find((item) => item.id === event.targetId);
        const classGroup = classes.find((item) => item.id === event.targetId) || classes.find((item) => item.id === session?.classId);
        event.schoolId = classGroup?.schoolId;
      } else if (event.targetType === "assessment" || event.targetType === "grade_policy") {
        const assessment = assessments.find((item) => item.id === event.targetId);
        event.schoolId = assessment?.schoolId || (event.targetType === "grade_policy" ? null : undefined);
      }
    });

    return {
      version: 2,
      generatedAt: iso(now),
      currentUserId: "student-anisa",
      ui: {
        language: "zh-CN",
        timeZone: "Asia/Jakarta",
        sidebarCollapsed: false
      },
      users,
      schools,
      schoolMemberships,
      students,
      classes,
      classEnrollments,
      subjects,
      folders,
      lessons,
      series,
      sessions,
      bookings,
      waitlist,
      interactionSets,
      interactionVersions,
      interactionTemplates,
      interactionAttempts,
      gradePolicies,
      assessments,
      assessmentScores,
      materials,
      materialRefs,
      notifications,
      changeRequests,
      auditEvents
    };
  }

  const api = { createSeedData };
  global.AICloudSeedData = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
