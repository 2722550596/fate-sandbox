// 文件: InteractionPanel.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L30873-31092: // =================================================================== ---

// ===================================================================
// ==========交互面板功能（物品栏和一大堆乱七八糟的拓展功能）===============
// =================================================================

//=========人物关系列表============
//读取人物关系列表
async showRelationships() {
  this.openModal("relationships-modal");
  const body = document.querySelector(
    "#relationships-modal .modal-body",
  );
  if (!body) return;

  // 🌟 核心新增：1. 捕获重绘前的状态 
  let previousScrollTop = 0;
  const expandedCards = new Set();
  
  // 确保里面有旧卡片时才去读取状态（避免初次打开时读取到奇怪的值）
  if (body.querySelector('.relationship-card')) {
    previousScrollTop = body.scrollTop;
    // 收集所有当前处于展开状态的卡片名称
    const expandedElements = body.querySelectorAll('.relationship-card.expanded');
    expandedElements.forEach(el => {
      if (el.dataset.charName) {
        expandedCards.add(el.dataset.charName);
      }
    });
  }


  body.innerHTML =
    '<p class=\"modal-placeholder\">正在梳理人际关系...</p>';

  try {
    let stat_data = this.currentMvuState?.stat_data;
    if (!stat_data || Object.keys(stat_data).length === 0) {
      console.log(
        "[人物关系列表] 内存数据无效，尝试从快照中读取",
      );
      const latestSnapshot = this.chatHistoryCache.at(-1);
      if (latestSnapshot?.data?.stat_data) {
        stat_data = latestSnapshot.data.stat_data;
        this.currentMvuState = latestSnapshot.data;
        console.log("[人物关系列表] 从快照读取数据成功");
      } else {
        body.innerHTML =
          '<p class=\"modal-placeholder\">暂无人物关系快照数据。</p>';
        return;
      }
    }
    const relationshipsObj = this.SafeGetValue(
      stat_data,
      "人物关系列表",
      {},
    );

    body.innerHTML = this.renderRelationships(relationshipsObj);

    // 🌟 核心新增：2. DOM 重绘后恢复状态
    // 恢复卡片的展开类名
    if (expandedCards.size > 0) {
      const newCards = body.querySelectorAll('.relationship-card');
      newCards.forEach(card => {
        if (expandedCards.has(card.dataset.charName)) {
          card.classList.add('expanded');
        }
      });
    }

    // 延迟一帧恢复滚动条位置
    // 必须要用 requestAnimationFrame，因为刚填入 innerHTML 时浏览器可能还没算好高度，直接设 scrollTop 会失效
    requestAnimationFrame(() => {
      body.scrollTop = previousScrollTop;
    });

    const container = document.getElementById(
      "relationship-cards-container",
    );
    if (container) {
      // 移除旧的事件监听器（通过克隆节点）
      const newContainer = container.cloneNode(true);
      container.parentNode.replaceChild(newContainer, container);

      // 在新容器上添加事件监听器
      newContainer.addEventListener("click", (e) => {
        const button = e.target.closest(".rel-action-btn");
        if (button) {
          e.stopPropagation(); // 阻止事件继续传播，避免触发折叠
          const card = button.closest(".relationship-card");
          const action = button.dataset.action;
          const charName = card.dataset.charName;
          this.handleRelationshipAction(action, charName);
          return;
        }

        // 处理折叠/展开
        const header = e.target.closest(".relationship-header");
        if (header) {
          this.toggleRelationshipItem(header);
        }
      });
    }
  } catch (error) {
    console.error("加载人物关系时出错:", error);
    body.innerHTML = /* HTML */ `<p class="modal-placeholder">
      加载人物关系时出错: ${error.message}
    </p>`;
  }
},
// 人物关系列表的操作（标记为重点、删除、双轨同调等）
handleRelationshipAction(action, charName) {
  if (!this.currentMvuState || !this.currentMvuState.stat_data) {
    this.showTemporaryMessage("无法操作，状态数据丢失。");
    return;
  }
  
  const newState = _.cloneDeep(this.currentMvuState);
  // 兜底创建 npc_data 防报错
  if (!newState.npc_data) newState.npc_data = {};

  const originalCharName = this.unescapeHtml(charName);
  
  // 🌟 双轨抓取：分别获取主观表和客观表的数据
  const subjChar = _.get(newState, `stat_data.人物关系列表.${originalCharName}`);
  const objChar = _.get(newState, `npc_data.${originalCharName}`);

  if (!subjChar && !objChar) {
    this.showTemporaryMessage(`未找到名为 “${originalCharName}” 的角色。`);
    return;
  }

  // 获取主要操作对象（优先客观数据，兼容旧档退化为主观数据）
  const targetObjChar = objChar || subjChar;

  switch (action) {
    case "toggle-important": {
      // 🌟 核心：转移到 npc_data 中管理 (上帝视角的标记)
      const isCurrentlyImportant = targetObjChar.isImportant || false;
      targetObjChar.isImportant = !isCurrentlyImportant;
      
      // 向下兼容：如果旧档 stat_data 里有这个字段，顺手同步过去防止撕裂
      if (subjChar) subjChar.isImportant = targetObjChar.isImportant;

      this.updateAndRefreshRelationshipState(newState);
      this.showTemporaryMessage(
        `已将 “${originalCharName}” ${targetObjChar.isImportant ? "标记为重要人物" : "取消重要标记"}`
      );
      break;
    }
    case "trade": {
      // 交易/克隆需要上帝视角的真实数值，所以传入 targetObjChar
      this.initiateTradeFromRelationship(originalCharName, targetObjChar);
      break;
    }
    case "delete": {
      this.showConfirmModal(
        `确定要永久删除人物 “${originalCharName}” 吗？此操作不可恢复。`,
        () => {
          // 🌟 核心：双轨绞杀，两头同时删除！
          if (newState.stat_data && newState.stat_data.人物关系列表) {
            delete newState.stat_data.人物关系列表[originalCharName];
          }
          if (newState.npc_data) {
            delete newState.npc_data[originalCharName];
          }
          
          this.updateAndRefreshRelationshipState(newState);
          this.showTemporaryMessage(`已彻底删除人物 “${originalCharName}”。`);
        }
      );
      break;
    }
    case "refresh-abilities": {
      // 重抽能力是干涉客观真理，必须传客观对象
      this.refreshNpcAbilities(targetObjChar);
      
      // 假设你的 refreshNpcAbilities 是就地修改对象，修改完后我们需要固化 newState
      this.updateAndRefreshRelationshipState(newState);
      break;
    }
    default:
      console.warn(`未知的关系操作: ${action}`);
  }
},
/**
 * 新增：刷新/重新抽取 NPC 序列能力的专属函数
 * 供人物关系界面内的按钮调用
 * @param {object} npc 需要更新的 NPC 对象引用，或其 id
 */
refreshNpcAbilities(npc) {
  if (!npc || typeof npc !== 'object') {
    console.warn("未传入有效的 NPC 对象");
    return;
  }

  const seqRank = parseSequenceRank(npc.当前序列);

  // 安全拦截
  if (seqRank > 9 || !npc.当前序列 || npc.当前序列.includes("普通人")) {
    this.showTemporaryMessage(`${npc.名称} 是普通人，无法抽取序列能力！`, 3000);
    return;
  }

  const abilitiesPool = fetchAvailableAbilities(npc.当前序列, false);

  if (abilitiesPool.length === 0) {
    this.showTemporaryMessage(`未从数据库中找到匹配 [${npc.当前序列}] 的途径数据！`, 3000);
    return;
  }

  // 走相同的算法抽取全新的能力（现在返回数组）
  const newAbilitiesArray = generateNpcAbilities(abilitiesPool, seqRank);
  
  // 覆盖当前状态
  npc.能力清单 = newAbilitiesArray;

  this.showTemporaryMessage(`已为 ${npc.名称} 重新抽取了序列能力！`, 3000);
},



