// 文件: SchemaSave.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L17107-17553:  ---








//==============================================
//===========全局初始化开始======================
//==============================================

$(() => {
  // registerMvuSchema(schema);
  console.log('[Schema] 已完成全局挂载');
});

// 在所有函数外定义全局一次性锁
const GLOBAL_LOCK_KEY = 'SEFIROT_CASTLE_LOCK';
const LOCK_EXPIRE_MS = 3 * 1000;

// 【修复 1】包裹 try-catch，防止浏览器无痕模式直接拦截报错导致完全瘫痪
const checkLock = () => {
  try {
    const lockStr = localStorage.getItem(GLOBAL_LOCK_KEY);
    if (!lockStr) return false;
    return Date.now() - parseInt(lockStr, 10) < LOCK_EXPIRE_MS;
  } catch (e) {
    toastr.warn('无法访问本地存储 (可能处于无痕模式)，跳过锁检测');
    return false; 
  }
};

if (checkLock()) {
  toastr.warn('已存在另一个游戏实例，终止执行！');
  // 【关键】直接抛出异常中断当前脚本顶层执行，防止下方代码继续乱跑
  throw new Error("Sefirot Castle is already initializing. Halting duplicate script.");
} 

// 加锁也要安全
try {
  localStorage.setItem(GLOBAL_LOCK_KEY, Date.now().toString());
  console.log('[源堡-全局锁] 无实例，已加锁');
} catch (e) {}

window.isGameInitTriggered = false;
window.GameInitState = 'IDLE';


//开始执行
(function () {
      'use strict';

// Dexie数据库配置（替代原生IndexedDB）
const db = new Dexie('SefirotCastleDB');
    db.version(1).stores({
      saveData: '&key' // 主键为key（带命名空间）
    });

    // 新增 V2，采用去掉了 & 的正确主键。
    // Dexie 会在后台自动帮老玩家无损升级到 V2，不会丢失任何数据！
    db.version(2).stores({
      saveData: 'key' 
    });



// --- 自动备份系统存储键常量 ---
const PERIODIC_BACKUP_KEYS = {
      ENABLED: 'periodic_backup_enabled',       // 启用状态
      INTERVAL: 'periodic_backup_interval',     // 备份间隔回合数
      TURN_COUNT: 'periodic_backup_turn_count',   // 当前回合计数
      SLOT: 'periodic_backup_slot'          // 备份数据槽位
};


//开始执行数据库
const AppStorage = ((showTempMsg) => {
// 命名空间（与原逻辑保持一致，确保数据兼容）
const STORAGE_NAMESPACE = 'SEFIROT_CASTLE_REVISION_';



let dbInitialized = false;
    //let dbInitPromise = null; // 用于缓存初始化Promise
    //const MAX_DB_RETRIES = 3; // 最多重试3次
    //let dbRetryCount = 0; // 当前重试次数

// 【增强版】数据库打开检测，主键冲突手动修复
const ensureDbOpen = async () => {
    if (dbInitialized) return true;
    try {
      await db.open();
      dbInitialized = true;
      return true;
    } catch (error) {
      console.error(`[数据库访问异常] ${error.name}: ${error.message}`);

      // ✅ 检测主键冲突错误，提供手动修复选项
      if (error.name === 'UpgradeError' && error.message.includes('primary key')) {
        console.warn('[数据库错误] 检测到主键冲突，需要重建数据库');

        // 提供用户确认的修复选项
        const userConfirm = confirm(
          '⚠️ 数据库结构冲突\n\n' +
          '检测到数据库主键配置不一致，这通常发生在清除缓存后。\n\n' +
          '修复方法：\n' +
          '1. 点击"确定"将删除并重建数据库（会清空所有存档）\n' +
          '2. 点击"取消"后，请前往开局页面点击"清空缓存"按钮\n\n' +
          '是否立即删除并重建数据库？'
        );

        if (userConfirm) {
          try {
            // 关闭当前连接
            if (db.isOpen()) {
              db.close();
            }

            // 删除旧数据库
            await Dexie.delete('SefirotCastleDB');
            console.log('[数据库修复] 旧数据库已删除');

            // 等待确保删除完成
            await new Promise(resolve => setTimeout(resolve, 500));

            // 重新打开数据库
            await db.open();
            dbInitialized = true;
            console.log('[数据库修复] ✓ 数据库已重建');

            alert('✓ 数据库已成功重建，可以正常使用了。');
            return true;
          } catch (repairError) {
            console.error('[数据库修复失败]', repairError);
            alert('❌ 数据库修复失败\n\n请前往开局页面点击"清空缓存"按钮，或手动清除浏览器IndexedDB数据。\n\n错误信息：' + repairError.message);
            return false;
          }
        } else {
          // 用户选择取消，提供指引
          alert('请前往开局页面点击"清空缓存"按钮来解决此问题。');
          return false;
        }
      }

      // 其他错误，显示原有提示
      console.error(`请通过开局前端点击清空缓存解决,并且关闭无痕模式并重启酒馆重试，否则容易出现无法正确存档的情况`);
      return false;
    }
    };

const isMobileDevice = () => {
      return /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
    };

// 循环引用处理（完全复用原逻辑）
const getCircularReplacer = () => {
      const seen = new WeakSet();
      return (key, value) => {
        if (typeof value === 'undefined') return null;
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return;
          seen.add(value);
        }
        return value;
      };
    };

// 调用栈提取（保留调试能力）
const getCallStack = () => {
      const stack = Error().stack || '';
      const lines = stack.split('\n').filter(line =>
        !line.includes('AppStorage') && !line.includes('Dexie')
      );
      const callStack = lines.slice(1, 4).map((line, index) => {
        const match = line.match(/(at )?([\w_$]+)?\s*\(?(.+?:\d+:\d+)?\)?/);
        const funcName = match[2] || '匿名函数';
        const location = match[3] || '未知位置';
        return `[${index+1}] ${funcName} → ${location}`;
      }).join('\n  ');
      return callStack;
    };
// 统一弹窗调试函数（避免重复代码）
const showDebugMessage = (msg, duration = 2000) => {
      //if (typeof showTempMsg === 'function') {
        //alert(`[调试] ${msg}`);

      //}
      //console.log(`[调试] ${msg}`);
    };

/**
* 保存数据（保留原有重试+验证逻辑，替换为Dexie实现）
*/
const saveData = async (key, value) => {
    const dbReady = await ensureDbOpen();
    if (!dbReady) {
      showDebugMessage('数据库未就绪，保存失败', 3000);
      return;
    }

// ========== 关键：保存前调用Schema.parse()，触发所有校验和转换 ==========
if (key === 'statData' || key.includes('statData')) {
  try {
    // 🌟 拦截点：先翻译，再校验！
    let translatedValue = typeof translateEnKeysToCn === 'function' ? translateEnKeysToCn(value) : value;
    
    // 调用完整Schema，自动执行所有transform
    value = window.statDataSchema.parse(translatedValue);
    console.log('[保存前] Schema自动校验+转换完成，数据已修正');
  } catch (e) {
    console.error('[Schema校验失败]：', e.issues);
    let translatedValue = typeof translateEnKeysToCn === 'function' ? translateEnKeysToCn(value) : value;
    const result = window.statDataSchema.safeParse(translatedValue);
    value = result.success ? result.data : value;
  }
}
if (typeof key !== 'string') {
      showDebugMessage('键必须是字符串', 3000);
      return;
    }
const isMobile = isMobileDevice();
const maxRetries = key === 'multi_save_data' && isMobile ? 2 : 0;
let retry = 0;
let success = false;

while (retry <= maxRetries && !success) {
      try {
        // 简化命名空间（去掉复杂后缀，避免兼容问题）
        const namespacedKey = `${STORAGE_NAMESPACE}${key}`;
        const stringifiedValue = JSON.stringify(value, getCircularReplacer());

        // 弹窗1：展示要保存的键和数据长度（确认参数正常）
        showDebugMessage(`保存键：${namespacedKey}，数据长度：${stringifiedValue.length}`, 3000);

        // 精简存储逻辑（去掉多余日志，只保留核心put）
        await db.saveData.put({ key: namespacedKey, value: stringifiedValue });

        // 弹窗2：提示保存成功
        showDebugMessage(`保存成功（重试${retry}次）`, 2000);

        // 移动端验证（简化延迟，只查是否能读到）
        if (isMobile) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const savedValue = await loadData(key);
            if (savedValue && Object.keys(savedValue).length > 0) {
              showDebugMessage(`验证成功：已读到数据`, 2000);
            } else {
              showDebugMessage(`验证警告：数据为空，已保存`, 2000);
            }
            success = true; // 即使数据空，也视为保存成功（避免重试循环）
          } else {
          success = true;
        }
      } catch (error) {
        retry++;
        // 弹窗3：提示失败原因（简化错误信息）
        showDebugMessage(`保存失败（重试${retry}次）：${error.message.slice(0, 15)}`, 3000);
        if (retry > maxRetries) {
          showTemporaryMessage('存档保存失败，请稍后重试', 3000);
        }
      }
    }
  };

/**
* 加载数据（保留原有提示+解析逻辑，替换为Dexie实现）
*/
const loadData = async (key, defaultValue = null) => {
      const dbReady = await ensureDbOpen();
      if (!dbReady) {
        showDebugMessage('数据库未就绪，加载失败', 3000);
        return defaultValue;
      }
    if (typeof key !== 'string') {
      showDebugMessage('键必须是字符串', 3000);
      return defaultValue;
    }
    const isMobile = isMobileDevice();
    const namespacedKey = `${STORAGE_NAMESPACE}${key}`;

    try {
      // 弹窗1：展示要读取的键（确认和保存的一致）
      showDebugMessage(`读取键：${namespacedKey}`, 2000);

      const data = await db.saveData.get(namespacedKey);

      // 弹窗2：展示是否找到数据
      if (data) {
        showDebugMessage(`找到数据：${data.value.length}字符`, 2000);
        const parsedData = JSON.parse(data.value);
        showDebugMessage(`解析成功`, 1500);
        return parsedData;
      } else {
        showDebugMessage(`未找到数据`, 2000);
        return defaultValue;
      }
    } catch (error) {
      showDebugMessage(`读取失败：${error.message.slice(0, 15)}`, 3000);
      return defaultValue;
    }
  };

/**
* 删除数据（Dexie实现）
*/
const removeData = async (key) => {
      if (typeof key !== 'string') {
        console.error('AppStorage Error: Key must be a string.');
        return;
      }
      try {
        const namespacedKey = `${STORAGE_NAMESPACE}${key}`;
        await db.saveData.delete(namespacedKey); // Dexie删除
      } catch (error) {
        console.error(`AppStorage Error: Failed to remove data for key "${key}".`, error);
      }
    };

/**
* 清空所有带命名空间的数据（Dexie实现）
*/
const clearAllData = async () => {
      try {
        // Dexie批量删除带命名空间的键
        await db.saveData.where('key').startsWith(STORAGE_NAMESPACE).delete();
        console.log('[AppStorage] Cleared all namespaced data.');
      } catch (error) {
        console.error('AppStorage Error: Failed to clear all data.', error);
      }
    };

/**
* 从localStorage迁移旧数据（保留原有逻辑，适配Dexie）
*/
const migrateFromLocalStorage = async () => {
      const isMigrated = await loadData('__migrated_to_indexeddb__', false);
      if (isMigrated) {
        console.log('[迁移] 已完成过旧数据迁移，跳过');
        return;
      }

      let migratedCount = 0;
      const failedKeys = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(STORAGE_NAMESPACE)) {
          try {
            const originalKey = key.replace(STORAGE_NAMESPACE, '');
            const valueStr = localStorage.getItem(key);
            // 增加JSON.parse容错，跳过格式损坏的数据
            let value;
            try {
              value = JSON.parse(valueStr);
            } catch (parseErr) {
              console.error(`[迁移失败] 键${key}格式损坏，跳过`, parseErr);
              failedKeys.push(key);
              continue;
            }
            // 迁移前确保数据库就绪（双重保险）
            const dbReady = await ensureDbOpen();
            if (!dbReady) {
              throw new Error('数据库未就绪');
            }
            await saveData(originalKey, value); // 复用改造后的saveData
            localStorage.removeItem(key);
            migratedCount++;
            console.log(`[迁移成功] 键: ${originalKey}`);
          } catch (error) {
            console.error(`[迁移失败] 键: ${key}`, error);
            failedKeys.push(key);
          }
        }
      }

      await saveData('__migrated_to_indexeddb__', true);

      // 告知用户失败的键（可选）
      if (migratedCount > 0 && typeof showTemporaryMessage === 'function') {
        let msg = `检测到${migratedCount}个旧版存档，已自动更新到新存档格式`;
        if (failedKeys.length > 0) {
          msg += `\n${failedKeys.length}个键迁移失败（格式损坏或数据库忙）`;
        }
        showTemporaryMessage(msg, 5000);
      }

      console.log(`[迁移总结] 成功: ${migratedCount}个，失败: ${failedKeys.length}个`);
    };

// 暴露与原接口完全一致的方法
return {
      saveData,
      loadData,
      removeData,
      clearAllData,
      migrateFromLocalStorage,
      getCircularReplacer,
      ensureDbOpen
    };
  })();

// [性能优化] 在JS一解析完就立刻异步开启DB连接，不阻塞主线程，不等待 init
window._preWarmedDbPromise = AppStorage.ensureDbOpen().catch(e => console.error("DB预热失败", e));

//开始检查环境。如果确实存在旧实例（以防万一），仍然执行清理
if (window.GameManagerInstance) {
  try { window.GameManagerInstance.cleanup (); } catch (e) {}
  }

  console.log('[源堡 - 环境检查] 开始检查 TavernHelper API...');
  console.log('[源堡 - 环境检查] TavernHelper:', typeof TavernHelper);
  console.log('[源堡 - 环境检查] eventOn:', typeof eventOn);
  console.log('[源堡 - 环境检查] tavern_events:', typeof tavern_events);
  console.log('[源堡 - 环境检查] getChatMessages:', typeof getChatMessages);
  console.log('[源堡 - 环境检查] getCurrentMessageId:', typeof getCurrentMessageId);
  console.log('[源堡 - 环境检查] lodash (_):', typeof _);

if (
      typeof TavernHelper === 'undefined' ||
      typeof eventOn === 'undefined' ||
      typeof tavern_events === 'undefined' ||
      typeof getChatMessages === 'undefined' ||
      typeof getCurrentMessageId === 'undefined' ||
      typeof _ === 'undefined'
) {
console.error('[源堡 - 环境检查] ✗ TavernHelper API, event system, or lodash not found.');
console.error('[源堡 - 环境检查] 缺失的 API:', {
  TavernHelper: typeof TavernHelper === 'undefined',
  eventOn: typeof eventOn === 'undefined',
  tavern_events: typeof tavern_events === 'undefined',
  getChatMessages: typeof getChatMessages === 'undefined',
  getCurrentMessageId: typeof getCurrentMessageId === 'undefined',
  lodash: typeof _ === 'undefined'
});
document.addEventListener('DOMContentLoaded', () => {
  document.body.innerHTML =
  '<h1 style="color: red; text-align: center;">错误：SillyTavern 环境 API 未找到或版本不兼容</h1><p style="color:grey; text-align:center;">请确保已安装并启用 TavernHelper 扩展。</p>';
});
return;
}

  console.log('[源堡 - 环境检查] ✓ 所有必需的 API 都已就绪');


//==============全局环境准备就绪===========



