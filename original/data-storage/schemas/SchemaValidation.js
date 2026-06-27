// 文件: SchemaValidation.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================

// --- L17028-17106: // ========== 数据加载时的Schema验证辅助函数 ========== ---

// ========== 数据加载时的Schema验证辅助函数 ==========
function validateAndMigrateStatData(data) {
  if (!data || !data.stat_data) {
    console.warn("[Schema验证] 数据无效，跳过验证");
    return data;
  }

  // 🌟 进入 SchemaDerivation 校验上下文（让产业 transform 能跨表读 npc_data 与人物关系列表）
  if (window.SchemaDerivation) {
    window.SchemaDerivation.enter(data);
  }

  try {
    // 🌟 拦截点：在任何处理之前，先把 AI 可能留下的英文键名全部洗成中文
    if (typeof translateEnKeysToCn === "function") {
      data.stat_data = translateEnKeysToCn(data.stat_data);
      if (data.world_data) {
        data.world_data = translateEnKeysToCn(data.world_data);
      }
    }

    migrateCurrentTimeEraDomain(data);

    // 1. 确保"辅助能力列表"存在
    if (!data.stat_data.辅助能力列表) {
      data.stat_data.辅助能力列表 = { $meta: { extensible: true } };
    }

    // 2. 将"主要扮演法"迁移到"扮演法"
    if (data.stat_data.主要扮演法 !== undefined) {
      if (!data.stat_data.扮演法) {
        data.stat_data.扮演法 = data.stat_data.主要扮演法;
      }
      delete data.stat_data.主要扮演法;
    }

    try {
      data.stat_data = window.statDataSchema.parse(data.stat_data);
      console.log("[Schema验证] 数据验证和迁移成功");
    } catch (e) {
      console.error("[Schema验证失败]:", e.issues || e.message);
      const result = window.statDataSchema.safeParse(data.stat_data);
      if (result.success) {
        data.stat_data = result.data;
        console.log("[Schema验证] 使用safeParse成功");
      }
    }

    try {
      data.world_data = window.worldDataSchema.parse(data.world_data || {});
    } catch (e) {
      console.error("[World Schema验证失败]:", e.issues || e.message);
      const result = window.worldDataSchema.safeParse(data.world_data || {});
      if (result.success) {
        data.world_data = result.data;
        console.log("[World Schema验证] 使用safeParse成功");
      }
    }

    migrateCurrentTimeEraDomain(data);

    // 🕒 时间流逝引擎接入：在 schema 校验完成后处理时间触发器
    if (window.TimePassageEngine) {
      try {
        window.TimePassageEngine.applyTimePassage(data);
      } catch (err) {
        console.warn("[TimePassage] applyTimePassage 抛出异常:", err);
      }
    }

    return data;
  } finally {
    // 🌟 无论成功/异常，必须清空 SchemaDerivation 上下文
    if (window.SchemaDerivation) {
      window.SchemaDerivation.exit();
    }
  }
}
// ========== Schema验证辅助函数结束 ==========
