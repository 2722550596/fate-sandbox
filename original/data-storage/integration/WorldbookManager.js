// 文件: WorldbookManager.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================

// --- L12229-12476: // ====== 🛠️ 全局工具：世界书读写管家 (重构与架构升级版) ====== ---

// ====== 🛠️ 全局工具：世界书读写管家 (重构与架构升级版) ======
const WorldbookManager = {
  PRIMARY_BOOK: "1源堡",
  LIBRARY_BOOK: "2历史孔隙",

  // 内部微型缓存，存在于单文件生命周期内
  _cache: {
    primaryAll: null,
    libraryAll: null,
    lastFetchTime: 0,
    TTL: 5000, // 缓存有效期：5秒（短时缓存，防并发重复读取）
  },

  /**
   * 统一读取接口 (已迁移至新版 getWorldbook API)
   * @param {String} prefix - 匹配的前缀或全名
   * @param {Object} options - { exactMatch: 是否全等匹配, strategy: 'fallback' | 'merge' }
   */
  // ==========================================
  // 修改 WorldbookManager.fetchEntries
  // ==========================================
  async fetchEntries(prefix, options = {}) {
    // ✨ 新增 scope 参数，默认值为 'all' 保持向下兼容
    const { exactMatch = false, strategy = "merge", scope = "all" } = options;
    const now = Date.now();

    // 1. 缓存拦截
    if (this._cache.primaryAll && now - this._cache.lastFetchTime < this._cache.TTL) {
      // 命中缓存，跳过 await
    } else {
      // 缓存失效，使用新 API 重新拉取
      try {
        const rawPrimary = await getWorldbook(this.PRIMARY_BOOK).catch(() => []);
        const rawLibrary = await getWorldbook(this.LIBRARY_BOOK).catch(() => []);

        // ✨ 向下兼容核心：将新版的 name 字段动态映射一份为 comment
        this._cache.primaryAll = rawPrimary.map((e) => ({ ...e, comment: e.name }));
        this._cache.libraryAll = rawLibrary.map((e) => ({ ...e, comment: e.name }));
        this._cache.lastFetchTime = now;
      } catch (e) {
        console.warn(`[世界书管家] 核心库读取异常:`, e);
      }
    }

    // 2. 匹配过滤条件
    const filterFn = (e) =>
      e.comment && (exactMatch ? e.comment.trim() === prefix : e.comment.startsWith(prefix));

    const primaryFiltered = (this._cache.primaryAll || [])
      .filter(filterFn)
      .map((e) => ({ ...e, _origin: this.PRIMARY_BOOK }));
    const libraryFiltered = (this._cache.libraryAll || [])
      .filter(filterFn)
      .map((e) => ({ ...e, _origin: this.LIBRARY_BOOK }));

    // 🚀 [核心拦截点] 如果外界明确指明了 scope，直接无视 strategy，强行隔离！
    if (scope === "primary") return primaryFiltered;
    if (scope === "library") return libraryFiltered;

    // 3. 按照策略返回数据
    if (strategy === "fallback") {
      return primaryFiltered.length > 0 ? primaryFiltered : libraryFiltered;
    } else {
      const entryMap = new Map();
      libraryFiltered.forEach((e) => entryMap.set(e.comment, e));
      primaryFiltered.forEach((e) => entryMap.set(e.comment, e));
      return Array.from(entryMap.values());
    }
  },

  /**
   * 统一写入接口 (已重构：原子化更新、防抖渲染、自动分离 Update/Create、全面支持官方字段)
   * @param {Array} saveTasks - 任务列表。支持传入官方 PartialDeep<WorldbookEntry> 的嵌套结构，或为了方便提供的一些扁平化别名。
   * @param {Object} options - { backupToLibrary: true/false }
   */
  async saveEntries(saveTasks, options = { backupToLibrary: false }) {
    if (!saveTasks || saveTasks.length === 0) return;

    // ✨ 内部提取出的流线型写入器 (支持给主库/备用库复用)
    const processBook = async (bookName, tasks, isBackup = false) => {
      try {
        const currentBook = await getWorldbook(bookName).catch(() => []);
        const getSafeName = (e) => (e?.name || e?.comment || "").trim();
        const existingNames = new Set(currentBook.map((e) => e.name)); // 使用 name 进行判重

        const toUpdate = [];
        const toCreate = [];

        for (const task of tasks) {
          // 字段转换：把上层业务代码传来的 comment 转正为合法的 name
          const taskName = getSafeName(task);
          if (!taskName) continue; // 安全兜底：抛弃没有名字的坏账数据

          // 🎯 核心映射：将传入的任务字段转换为官方严格支持的 PartialDeep<WorldbookEntry>
          const payload = {
            name: taskName,
            enabled: isBackup ? false : task.enabled !== undefined ? task.enabled : true,
            ...(task.content !== undefined && { content: task.content }),
            ...(task.probability !== undefined && { probability: task.probability }),
            ...(task.extra !== undefined && { extra: task.extra }),
          };

          // --- 1. 组装 Strategy (激活策略) ---
          // 兼容扁平传入的 task.keys 或 完整的 task.strategy
          if (task.keys || task.strategy) {
            payload.strategy = { ...(task.strategy || {}) };

            // 如果扁平传入了 keys，覆盖进去
            if (task.keys) {
              payload.strategy.keys = task.keys;
            }

            // 智能补全 type：如果有 keys，默认给 'selective' (绿灯)，否则保持 'constant' (蓝灯)
            if (
              !payload.strategy.type &&
              payload.strategy.keys &&
              payload.strategy.keys.length > 0
            ) {
              payload.strategy.type = "selective";
            }
          }

          // --- 2. 组装 Position (插入位置) ---
          // 兼容扁平传入的 task.positionType / task.order 等，或完整的 task.position
          if (
            task.position ||
            task.positionType ||
            task.order !== undefined ||
            task.depth !== undefined
          ) {
            payload.position = { ...(task.position || {}) };

            if (task.positionType) payload.position.type = task.positionType;
            if (task.order !== undefined) payload.position.order = task.order;

            // 只有当 type 为 'at_depth' 时，role 和 depth 才有效
            if (task.depth !== undefined) payload.position.depth = task.depth;
            if (task.role !== undefined) payload.position.role = task.role;
          }

          // --- 3. 组装 Recursion (递归设置) ---
          // 默认开启 prevent_incoming (不被别人扫) 和 prevent_outgoing (不扫别人)
          payload.recursion = {
            prevent_incoming: task.recursion?.prevent_incoming ?? task.recursion?.exclude ?? true,
            prevent_outgoing: task.recursion?.prevent_outgoing ?? task.recursion?.prevent ?? true,
            delay_until: task.recursion?.delay_until ?? null,
          };

          // --- 4. 组装 Effect (效果：粘性/冷却/延迟) ---
          if (task.effect) {
            payload.effect = { ...task.effect };
          }

          // 分发到更新或创建队列
          if (existingNames.has(taskName)) {
            toUpdate.push(payload);
          } else {
            toCreate.push(payload);
          }
        }

        // 🎯 批量原子化更新
        if (toUpdate.length > 0) {
          await updateWorldbookWith(
            bookName,
            (worldbook) => {
              return worldbook.map((entry) => {
                const entrySafeName = (entry.name || entry.comment || "").trim();
                const updateData = toUpdate.find((u) => u.name === entrySafeName);
                if (!updateData) return entry;

                // 深度合并逻辑：保留原有的内部字段(如 uid)，同时合并嵌套对象
                return {
                  ...entry,
                  ...updateData,
                  strategy: updateData.strategy
                    ? { ...entry.strategy, ...updateData.strategy }
                    : entry.strategy,
                  position: updateData.position
                    ? { ...entry.position, ...updateData.position }
                    : entry.position,
                  recursion: updateData.recursion
                    ? { ...entry.recursion, ...updateData.recursion }
                    : entry.recursion,
                  effect: updateData.effect
                    ? { ...entry.effect, ...updateData.effect }
                    : entry.effect,
                };
              });
            },
            { render: "debounced" },
          ); // 防抖渲染：性能拉满
        }

        // 🎯 批量新增 (底层自动补全缺失的系统默认字段)
        if (toCreate.length > 0) {
          await createWorldbookEntries(bookName, toCreate, { render: "debounced" });
        }
      } catch (e) {
        console.warn(`[世界书管家] 写入 ${bookName} 时发生异常:`, e);
      }
    };

    // 1. 执行主库写入
    await processBook(this.PRIMARY_BOOK, saveTasks, false);

    // 2. 执行备用库同步
    if (options.backupToLibrary) {
      await processBook(this.LIBRARY_BOOK, saveTasks, true);
    }

    // 3. 强制清空缓存
    this._cache.lastFetchTime = 0;
  },

  // =========================================================
  // 👇 🚧 以下为新增预留：专供“双世界书管理系统”使用的管理层 API
  // =========================================================

  /**
   * [系统预留] 交叉比对工具：一键扫描主备两库的状态差异
   * @returns {Array} 差异报告列表
   */
  async compareBooks() {
    const primary = await getWorldbook(this.PRIMARY_BOOK).catch(() => []);
    const library = await getWorldbook(this.LIBRARY_BOOK).catch(() => []);

    const primaryMap = new Map(primary.map((e) => [e.name, e]));
    const libraryMap = new Map(library.map((e) => [e.name, e]));
    const result = [];

    // 合并所有独一无二的名字
    const allNames = new Set([...primaryMap.keys(), ...libraryMap.keys()]);

    allNames.forEach((name) => {
      const pData = primaryMap.get(name);
      const lData = libraryMap.get(name);

      let status = "";
      if (pData && lData) {
        // ✨ 新增：深度比对内容和开关状态，完全一样则判定为 'identical'（已同步）
        if (pData.content === lData.content && pData.enabled === lData.enabled) {
          status = "identical";
        } else {
          status = "conflict";
        }
      } else if (pData) status = "primary_only";
      else status = "library_only";

      result.push({ name, status, primaryData: pData, libraryData: lData });
    });

    return result;
  },

  /**
   * [系统预留] 终极删库工具：原子化安全删除
   * @param {String} bookName - 目标世界书
   * @param {Function} predicateFn - 规则函数，例如: entry => entry.name.includes('影心')
   */
  async removeEntries(bookName, predicateFn) {
    try {
      await deleteWorldbookEntries(bookName, predicateFn, { render: "debounced" });
      this._cache.lastFetchTime = 0; // 删完清缓存
      return true;
    } catch (e) {
      console.error(`[世界书管家] 删除条目失败 (${bookName}):`, e);
      return false;
    }
  },
};
