// 文件: CloudSave.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L41112-41352: // ==================== 云存档系统 ==================== ---

// ==================== 云存档系统 ====================
// 云存档服务器地址
CLOUD_SAVE_SERVER: "http://107.151.244.45:3001",

// 用于邮件检查的退避状态
_mailCheckState: {
  failCount: 0,
  nextCheckTime: 0
},

async showCloudUploadModal() {
  this.openModal("cloud-upload-modal");
  const container = document.getElementById("cloud-upload-slots");
  if (!container) return;

  // 隐藏上次的结果
  document.getElementById("cloud-upload-result").style.display =
    "none";

  const allSaves = await this.getSavesFromStorage();
  const saveIds = Object.keys(allSaves).filter(
    (id) => !id.startsWith("auto_") && !id.startsWith("periodic_"),
  );

  if (saveIds.length === 0) {
    container.innerHTML =
      '<p style="color: var(--text-muted); text-align: center;">暂无可上传的存档</p>';
    return;
  }

  container.innerHTML = saveIds
    .map((slotId) => {
      const save = allSaves[slotId];
      return /* HTML */ `
        <div
          class="save-slot"
          style="cursor: pointer;"
          data-slot-id="${slotId}"
        >
          <div class="save-slot-info">
            <div class="save-slot-name">
              ${save.save_name || "未命名存档"}
            </div>
            <div class="save-slot-meta">
              ${new Date(
                save.saved_at || Date.now(),
              ).toLocaleString("zh-CN")}
            </div>
          </div>
          <button
            class="interaction-btn cloud-upload-btn"
            data-slot-id="${slotId}"
            style="background: var(--color-info);"
          >
            上传
          </button>
        </div>
      `;
    })
    .join("");

  // 绑定上传按钮事件
  container.querySelectorAll(".cloud-upload-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const slotId = btn.dataset.slotId;
      await this.uploadToCloud(slotId);
    });
  });
},

async uploadToCloud(slotId) {
  this.showTemporaryMessage("正在上传云存档...");
  try {
    const allSaves = await this.getSavesFromStorage();
    const saveData = allSaves[slotId];
    if (!saveData) {
      this.showTemporaryMessage("错误：找不到要上传的存档");
      return;
    }

    const response = await fetch(`${this.CLOUD_SAVE_SERVER}/api/save/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saveData: saveData,
        saveName: saveData.save_name || "未命名存档",
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    if (result.success) {
      const resultDiv = document.getElementById("cloud-upload-result");
      const codeSpan = document.getElementById("cloud-save-code");
      if (resultDiv) resultDiv.style.display = "block";
      if (codeSpan) codeSpan.textContent = result.code;
      this.lastCloudCode = result.code;
      this.showTemporaryMessage("云存档上传成功！");
    } else {
      this.showTemporaryMessage(`上传失败: ${result.error}`);
    }
  } catch (error) {
    // 这种手动触发的操作，保留一个简短的 warn 方便调试
    console.warn("[云存档] 上传失败:", error.message);
    this.showTemporaryMessage("上传失败：服务器目前不可用，请稍后再试");
  }
},

copyCloudCode() {
  const code =
    this.lastCloudCode ||
    document.getElementById("cloud-save-code")?.textContent;
  if (code) {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        this.showTemporaryMessage("编码已复制到剪贴板！");
      })
      .catch(() => {
        // 降级方案
        const input = document.createElement("input");
        input.value = code;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
        this.showTemporaryMessage("编码已复制！");
      });
  }
},

showCloudDownloadModal() {
  this.openModal("cloud-download-modal");
  // 重置状态
  document.getElementById("cloud-download-code-input").value = "";
  document.getElementById("cloud-download-preview").style.display =
    "none";
  document.getElementById("btn-cloud-download-confirm").disabled =
    true;
  this.pendingCloudSave = null;
},

async checkCloudSave() {
  const codeInput = document.getElementById("cloud-download-code-input");
  const code = codeInput.value.trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(code)) {
    this.showTemporaryMessage("请输入有效的8位编码");
    return;
  }

  this.showTemporaryMessage("正在查询云存档...");
  try {
    const response = await fetch(`${this.CLOUD_SAVE_SERVER}/api/save/info/${code}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    if (result.success) {
      const preview = document.getElementById("cloud-download-preview");
      document.getElementById("cloud-preview-name").textContent = result.data.saveName;
      document.getElementById("cloud-preview-time").textContent = new Date(result.data.createdAt).toLocaleString("zh-CN");
      document.getElementById("cloud-preview-count").textContent = `${result.data.accessCount} 次`;
      preview.style.display = "block";
      document.getElementById("btn-cloud-download-confirm").disabled = false;
      this.pendingCloudCode = code;
      this.showTemporaryMessage("找到云存档！");
    } else {
      document.getElementById("cloud-download-preview").style.display = "none";
      document.getElementById("btn-cloud-download-confirm").disabled = true;
      this.showTemporaryMessage(`未找到该编码的存档`);
    }
  } catch (error) {
    console.warn("[云存档] 查询失败:", error.message);
    this.showTemporaryMessage("查询失败：连接服务器超时");
  }
},

async downloadCloudSave() {
  if (!this.pendingCloudCode) {
    this.showTemporaryMessage("请先查询云存档");
    return;
  }

  this.showTemporaryMessage("正在下载云存档...");

  try {
    const url = `${this.CLOUD_SAVE_SERVER}/api/save/download/${this.pendingCloudCode}`;
    const response = await fetch(url);

    if (!response.ok) {
      this.showTemporaryMessage(
        `下载失败: HTTP ${response.status}`,
        3000,
      );
      return;
    }

    const result = await response.json();

    if (result.success) {
      const cloudSaveData = result.data.saveData;

      // 获取所有存档
      const allSaves = await this.getSavesFromStorage();

      // 生成新槽位ID (必须以slot_开头才能显示在列表中)
      const slotId = `slot_cloud_${this.pendingCloudCode}`;

      // 设置存档信息
      cloudSaveData.save_name = `[云] ${result.data.saveName}`;
      cloudSaveData.saved_at = new Date().toISOString();
      cloudSaveData.cloud_code = this.pendingCloudCode;

      // 保存到新槽位
      allSaves[slotId] = cloudSaveData;
      await AppStorage.saveData("multi_save_data", allSaves);

      // 关闭下载模态框
      const modal = document.getElementById(
        "cloud-download-modal",
      );
      if (modal) modal.style.display = "none";

      this.showTemporaryMessage(
        `云存档 "${result.data.saveName}" 导入成功！`,
        3000,
      );

      // 刷新存档管理界面
      await this.showSaveLoadManager();
    } else {
      this.showTemporaryMessage(
        `下载失败: ${result.error}`,
        3000,
      );
    }
  } catch (error) {
    this.showTemporaryMessage(`下载错误: ${error.message}`, 3000);
  }
},

