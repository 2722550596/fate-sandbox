// 文件: misc-systems.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L32600-32755: // ==================================================================== ---

// ====================================================================
// 核心装备加载函数 (Equipment Loading Core Functions)
// ====================================================================

async saveEquipmentState() {
  // 狸猫换太子：保留空壳，防止外部调用报错。
  // 真正的装备状态（isEquipped）已经随着 stat_data 自动持久化了，无需单独往 IndexDB 写垃圾数据！
  console.log(
    "[装备保存] 状态已由 stat_data 接管，跳过单独保存，给存档瘦身。",
  );
  return Promise.resolve();
},
//已躺平
async loadEquipmentState() {
  console.log("[装备加载] 初始化 UI 槽位缓存...");
  try {
    // 顺手抹除 IndexDB 里可能残留的根目录垃圾数据
    if (typeof AppStorage.deleteData === "function") {
      AppStorage.deleteData("equipped_items").catch(() => {});
    }

    // 核心：直接基于内存重构 UI 缓存
    if (this.currentMvuState && this.currentMvuState.stat_data) {
      this.syncEquippedItemsFromBooleans(
        this.currentMvuState.stat_data,
      );
    } else {
      this.equippedItems = {
        wuqi: null,
        yiwu: null,
        shipin: null,
        fengyinwu: null,
        banyanfa: null,
        fuzhu: null,
      };
    }

    // 接管渲染
    this.refreshEquipmentSlots();
    this.updateDisplayedAttributes();
  } catch (e) {
    console.error("[装备加载] 发生异常，执行兜底渲染:", e);
    this.refreshEquipmentSlots();
  }
},
/**
  * UI 缓存同步（极致优化版）：依赖外部纯函数进行内存清洗
  */
syncEquippedItemsFromBooleans(statData) {
  if (!statData) return;

  const listToSlotMap = {
    武器列表: "wuqi",
    衣物列表: "yiwu",
    饰品列表: "shipin",
    封印物列表: "fengyinwu",
    扮演法列表: "banyanfa",
    辅助能力列表: "fuzhu",
  };

  const newEquippedItems = {
    wuqi: null,
    yiwu: null,
    shipin: null,
    fengyinwu: null,
    banyanfa: null,
    fuzhu: null,
  };

  for (const [listKey, slotKey] of Object.entries(listToSlotMap)) {
    // 1. 提取真实内存中的列表
    const itemsObj = this.SafeGetValue(statData, listKey, {});

    // 2. 双保险：直接用外部纯函数清洗一次内存指针！（专治变量编辑器绕过验证的修改）
    constrainSingleEquipment(itemsObj);

    // 3. 此时内存已绝对安全，安心查找唯一 true 即可
    const equippedItem = Object.values(itemsObj).find(
      (item) => item && item.isEquipped === true,
    );
    if (equippedItem) {
      newEquippedItems[slotKey] = equippedItem;
    }
  }

  this.equippedItems = newEquippedItems;
  console.log(
    "[同步完毕] UI 装备缓存已对齐绝对干净的底层内存",
    this.equippedItems,
  );
},
refreshEquipmentSlots() {
  // 1. 渲染前先确保缓存和内存是对齐的
  if (this.currentMvuState && this.currentMvuState.stat_data) {
    this.syncEquippedItemsFromBooleans(
      this.currentMvuState.stat_data,
    );
  }

  const defaultTextMap = {
    wuqi: "武器",
    yiwu: "衣物",
    shipin: "饰品",
    fengyinwu: "封印物",
    banyanfa: "扮演法",
    fuzhu: "辅助能力",
  };

  // 2. 遍历所有标准槽位更新 DOM
  for (const slotKey in defaultTextMap) {
    const slotElement = document.getElementById(`equip-${slotKey}`);
    if (!slotElement) continue;

    // 💡 强力清扫：因为不再把 tierClass 加给外层，直接重置为最纯净的状态
    slotElement.className = "equipment-slot";

    const itemData = this.equippedItems[slotKey];

    if (
      itemData &&
      typeof itemData === "object" &&
      itemData.isEquipped
    ) {
      // 有装备：渲染数据
      const tier = this.SafeGetValue(
        itemData,
        ["品阶", "tier", "序列"],
        "普通",
      );
      const formattedTier =
        !isNaN(tier) && tier !== "普通" ? `序列${tier}` : tier;
      const tierClass = this.getTierClass(formattedTier);
      const itemName = this.safeEscapeHtml(
        this.SafeGetValue(itemData, "名称", "未知装备"),
      );

      // 🌟🌟🌟 核心修复：分离魔法！外层负责画框 (.equipped)，内层 span 负责发光渐变 (.tierClass)
      slotElement.innerHTML = /* HTML */ `<span
        class="${tierClass}"
        >${itemName}</span
      >`;

      slotElement.classList.add("equipped");
      slotElement.removeAttribute("style");

      slotElement.dataset.itemDetails = JSON.stringify(itemData);
      slotElement.onclick = (e) => this.handleSlotClick(e);
    } else {
      // 无装备：彻底剥离所有残留，恢复纯文本
      slotElement.textContent = defaultTextMap[slotKey];
      slotElement.removeAttribute("style");
      delete slotElement.dataset.itemDetails;
      slotElement.onclick = (e) => this.handleSlotClick(e);
    }
  }
},

