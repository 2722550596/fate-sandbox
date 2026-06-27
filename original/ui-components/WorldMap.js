// 文件: WorldMap.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L44174-45387:  ---


let aiContextConfigUIInstance = null;


// ==================== 世界地图 ====================
// 完整原生地图 (Map 1)
// ==========================================

// ==========================================
// 🗺️ 全局双核地图引擎 (GameMapManager)
// 替代原 GeorgeMapSystem 与 ShenqiMapController
// ==========================================

const GameMapManager = {
  // 1. 统一管理双地图的 DOM 配置与独立状态
  configs: {
    main: {
      id: 'main',
      modalId: 'map-modal', viewportId: 'map-viewport', pannableId: 'map-pannable',
      locationsId: 'map-locations', // 主地图独有：SVG 渲染层
      btnOpen: 'btn-map', btnClose: 'close-map', btnZoomIn: 'zoom-in', btnZoomOut: 'zoom-out', btnReset: 'reset-map',
      state: { x: 0, y: 0, scale: 1.0 },
      hasRendered: false, // 标记是否已经渲染过底图 SVG
      lodTimer: null
    },
    shenqi: {
      id: 'shenqi',
      modalId: 'map-modal-2', viewportId: 'map-viewport-2', pannableId: 'map-pannable-2',
      btnOpen: 'btn-map-2', btnClose: 'close-map-2', btnZoomIn: 'zoom-in-2', btnZoomOut: 'zoom-out-2', btnReset: 'reset-map-2',
      state: { x: 0, y: 0, scale: 1.0 }
      // 神弃之地是静态图，不需要 hasRendered 和 locationsId
    }
  },

  // 共享的拖拽状态机
  dragState: {
    isDragging: false,
    activeMapId: null,
    startX: 0,
    startY: 0,
    isTicking: false // ✨ 新增：用于 requestAnimationFrame 的帧锁
  },

  isInitialized: false,

  // 1. 把你的 HTML 结构变成字符串模板
  mapHtmlTemplate: `
    <div id="map-modal" class="modal-overlay map-modal-overlay" style="display: none;">
      <div class="modal-content map-modal-content">
        <div class="modal-header">
          <h2 class="modal-title">世界地图</h2>
          <button id="close-map" class="modal-close-btn">&times;</button>
        </div>
        <div class="map-controls">
          <button id="zoom-in" class="interaction-btn">放大</button>
          <button id="zoom-out" class="interaction-btn">缩小</button>
          <button id="reset-map" class="interaction-btn">重置视图</button>
        </div>
        <div id="map-viewport" class="map-viewport">
          <div id="map-pannable" class="map-pannable">
            <img id="map-image" src="https://files.catbox.moe/wpsj51.png" alt="世界地图" />
            <div id="map-locations" class="map-locations"></div>
          </div>
        </div>
      </div>
    </div>

    <div id="map-modal-2" class="modal-overlay map-modal-overlay" style="display: none;">
      <div class="modal-content map-modal-content">
        <div class="modal-header">
          <h2 class="modal-title">神弃之地地图</h2>
          <button id="close-map-2" class="modal-close-btn">&times;</button>
        </div>
        <div class="map-controls">
          <button id="zoom-in-2" class="interaction-btn">放大</button>
          <button id="zoom-out-2" class="interaction-btn">缩小</button>
          <button id="reset-map-2" class="interaction-btn">重置视图</button>
        </div>
        <div id="map-viewport-2" class="map-viewport">
          <div id="map-pannable-2" class="map-pannable">
            <img id="map-image-2" src="https://www.helloimg.com/i/2026/03/01/69a4494492705.png" alt="自定义地图" />
          </div>
        </div>
      </div>
    </div>
  `,

  // 🌟 全局唯一启动入口（脚本加载后只需调用一次即可）
  init() {
    if (this.isInitialized) return;

    // 🌟 核心修复：像悬浮编辑器一样，强制把弹窗注入到 body 最末尾
    // 并且先检查是否已经注入，防止重复生成
    if (!document.getElementById('map-modal')) {
      document.body.insertAdjacentHTML('beforeend', this.mapHtmlTemplate);
      console.log("[地图引擎] 地图 DOM 节点已成功动态注入到 body 中！");
    }

    this.bindGlobalEvents();
    this.isInitialized = true;
    console.log("[地图引擎] 双核事件委托已启动，无惧 DOM 刷新！");
  },

  // ==========================================
  // 🕹️ 核心事件引擎 (Event Delegation - 终极防御版)
  // ==========================================
  bindGlobalEvents() {
    const self = this;

    // (1) 点击事件总控：绑定在 document 上，并且开启 useCapture (true)
    // 这样无论那个抽屉组件怎么阻止冒泡，我们都能强制拦截到点击！
    document.addEventListener('click', (e) => {
      const target = e.target;
      
      Object.values(self.configs).forEach(cfg => {
        if (target.closest(`#${cfg.btnOpen}`)) {
          e.preventDefault(); // 阻止按钮默认行为
          self.openMap(cfg.id);
        }
        else if (target.closest(`#${cfg.btnClose}`)) self.closeMap(cfg.id);
        else if (target.closest(`#${cfg.btnZoomIn}`)) self.zoom(cfg.id, 0.2);
        else if (target.closest(`#${cfg.btnZoomOut}`)) self.zoom(cfg.id, -0.2);
        else if (target.closest(`#${cfg.btnReset}`)) self.resetView(cfg.id);
      });
    }, true); // 🌟 关键魔法：true 代表捕获阶段

    // (2) 拖拽引擎总控 (同理，绑定在 document)
    document.addEventListener('pointerdown', (e) => {
      const target = e.target;
      const cfg = Object.values(self.configs).find(c => target.closest(`#${c.pannableId}`));
      if (!cfg) return;

      const pannable = document.getElementById(cfg.pannableId);
      if (!pannable) return;

      self.dragState.isDragging = true;
      self.dragState.activeMapId = cfg.id;
      self.dragState.startX = e.clientX - cfg.state.x;
      self.dragState.startY = e.clientY - cfg.state.y;

      pannable.style.cursor = 'grabbing';
      e.preventDefault();
      pannable.setPointerCapture(e.pointerId); 
    }, true);

    document.body.addEventListener('pointermove', (e) => {
      if (!self.dragState.isDragging || !self.dragState.activeMapId) return;
      const cfg = self.configs[self.dragState.activeMapId];
      
      // 仅计算，不操作 DOM
      cfg.state.x = e.clientX - self.dragState.startX;
      cfg.state.y = e.clientY - self.dragState.startY;

      // ✨ 性能优化：如果上一帧还没渲染完，就丢弃多余的 DOM 更新请求
      if (!self.dragState.isTicking) {
        window.requestAnimationFrame(() => {
          self.updateTransform(cfg.id);
          self.dragState.isTicking = false; // 渲染完毕，解锁
        });
        self.dragState.isTicking = true; // 上锁
      }
    });

    const stopDragging = (e) => {
      if (!self.dragState.isDragging || !self.dragState.activeMapId) return;
      const cfg = self.configs[self.dragState.activeMapId];
      const pannable = document.getElementById(cfg.pannableId);
      
      if (pannable) {
        pannable.style.cursor = 'grab';
        if (pannable.hasPointerCapture(e.pointerId)) pannable.releasePointerCapture(e.pointerId);
      }
      self.dragState.isDragging = false;
      self.dragState.activeMapId = null;
    };

    document.addEventListener('pointerup', stopDragging, true);
    document.addEventListener('pointercancel', stopDragging, true);

    // (3) 滚轮缩放总控
    document.addEventListener('wheel', (e) => {
      const cfg = Object.values(self.configs).find(c => e.target.closest(`#${c.viewportId}`));
      if (cfg) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.2 : -0.2;
        self.zoom(cfg.id, delta);
      }
    }, { passive: false, capture: true });
  },

  // ==========================================
  // 👁️ 视图控制器
  // ==========================================
  openMap(mapId) {
    const cfg = this.configs[mapId];
    const modal = document.getElementById(cfg.modalId);
    
    // ✨ 关键修复点 3：增加防御性日志，防止因为 HTML 里没有弹窗元素而“死得不明不白”
    if (!modal) {
      console.error(`[地图引擎] 致命错误：找得到按钮，但找不到对应的地图弹窗！(需要 id="${cfg.modalId}")，请检查 HTML 文件！`);
      return;
    }

    modal.style.display = 'flex';
    modal.style.zIndex = '99999';
    console.log(`[地图引擎] 弹窗 ${cfg.modalId} 已成功显示！`);
    
    const pannable = document.getElementById(cfg.pannableId);
    if (pannable) pannable.style.cursor = 'grab';

    if (mapId === 'main') {
      if (!cfg.hasRendered) {
        console.log(`[地图引擎] 首次渲染主地图 SVG...`);
        this.renderMainMap(cfg);
        cfg.hasRendered = true;
      }
      this.updatePlayerMarker();
    }
  },

  closeMap(mapId) {
    const modal = document.getElementById(this.configs[mapId].modalId);
    if (modal) modal.style.display = 'none';
  },

  zoom(mapId, delta) {
    const cfg = this.configs[mapId];
    const newScale = cfg.state.scale + delta;
    if (newScale >= 0.4 && newScale <= 5.0) {
      cfg.state.scale = newScale;
      
      // 使用帧渲染优化缩放动画
      window.requestAnimationFrame(() => {
        this.updateTransform(mapId);
      });

      // ✨ 性能优化：防抖处理，用户疯狂滚滚轮时，不执行 LOD 更新，停下 100ms 后再执行
      if (mapId === 'main') {
        if (cfg.lodTimer) clearTimeout(cfg.lodTimer);
        cfg.lodTimer = setTimeout(() => {
          this.updateLOD(cfg);
        }, 100);
      }
    }
  },

  resetView(mapId) {
    const cfg = this.configs[mapId];
    cfg.state.scale = 1.0;
    cfg.state.x = 0;
    cfg.state.y = 0;
    
    window.requestAnimationFrame(() => {
      this.updateTransform(mapId);
    });
    if (mapId === 'main') this.updateLOD(cfg);
  },

  updateTransform(mapId) {
    const cfg = this.configs[mapId];
    const pannable = document.getElementById(cfg.pannableId);
    const viewport = document.getElementById(cfg.viewportId);
    if (!pannable || !viewport) return;

    const cx = viewport.clientWidth / 2;
    const cy = viewport.clientHeight / 2;

    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
    if (typeof isMobile !== 'undefined' && isMobile) {
      pannable.style.willChange = 'transform';
    }

    pannable.style.transformOrigin = `${cx}px ${cy}px`;
    pannable.style.transform = `translate(${cfg.state.x}px, ${cfg.state.y}px) scale(${cfg.state.scale})`;
  
  },

  // ==========================================
  // 🎨 主地图专属：从 DB 动态渲染逻辑
  // ==========================================
  renderMainMap(cfg) {
    const mapLocations = document.getElementById(cfg.locationsId);
    if (!mapLocations) return;
    mapLocations.innerHTML = ""; // 清空旧图

    // 🌟 从 GameDBManager 直接拉取数据
    const dbData = GameDBManager.DB.mapData;
    if (!dbData) return;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", "0 0 100 51.35"); // 匹配宽高比

    dbData.mainRegions?.forEach(region => {
      const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      polygon.setAttribute("class", "main-region-poly");
      polygon.setAttribute("points", region.points.outer.map(p => `${p.x} ${p.y}`).join(' '));
      polygon.setAttribute("style", `--region-fill: ${region.style.fill}; --region-stroke: ${region.style.stroke}`);
      polygon.setAttribute("data-id", region.id);
      polygon.setAttribute("data-name", region.name);

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("class", "region-label");
      label.setAttribute("x", this.getCenterX(region.points.outer));
      label.setAttribute("y", this.getCenterY(region.points.outer));
      label.setAttribute("text-anchor", "middle");
      label.textContent = region.name;

      svg.appendChild(polygon);
      svg.appendChild(label);
    });
    mapLocations.appendChild(svg);

    dbData.landmarks?.forEach(landmark => {
      const dot = document.createElement("div");
      dot.className = "landmark-dot";
      dot.style.top = landmark.marker.top;
      dot.style.left = landmark.marker.left;
      dot.setAttribute("data-name", landmark.name);
      dot.setAttribute("data-description", landmark.description);
      mapLocations.appendChild(dot);

      const label = document.createElement("div");
      label.className = "landmark-label";
      label.style.top = landmark.marker.top;
      label.style.left = landmark.marker.left;
      label.textContent = landmark.name;
      mapLocations.appendChild(label);
    });

    this.updateLOD(cfg);
  },

  updatePlayerMarker() {
    const cfg = this.configs.main;
    const mapLocations = document.getElementById(cfg.locationsId);
    if (!mapLocations) return;

    // 获取主引擎数据 (防止 GameManager 未就绪)
    const statData = typeof GameManager !== 'undefined' && GameManager.currentMvuState?.stat_data 
      ? GameManager.currentMvuState.stat_data 
      : { "当前区域": "未知", "当前地标": "未知", "当前坐标": { x: 50.0, y: 50.0 } };

    const coord = statData["当前坐标"];
    const markerText = statData["当前区域"] === "未知" ? "未知位置" : (statData["当前地标"] || statData["当前区域"]);

    const oldMarker = mapLocations.querySelector(".map-location-marker.current-location");
    if (oldMarker) oldMarker.remove();

    const Y_SCALE = typeof GameManager !== 'undefined' && GameManager.Y_SCALE ? GameManager.Y_SCALE : 1;
    const visualY = coord.y / Y_SCALE;

    const marker = document.createElement("div");
    marker.className = "map-location-marker current-location";
    marker.style.position = "absolute";
    marker.style.left = `${coord.x}%`;
    marker.style.top = `${visualY}%`;
    marker.style.transform = "translate(-50%, -50%)";
    marker.innerHTML = `<div class="dot"></div><div class="label">${markerText}</div>`;

    mapLocations.appendChild(marker);
    this.updateLOD(cfg);
  },

  updateLOD(cfg) {
    const scale = cfg.state.scale;
    const inverseScale = 1 / scale;

    document.querySelectorAll('#map-locations .landmark-dot, #map-locations .landmark-label').forEach(el => {
      el.style.setProperty('--landmark-scale', inverseScale);
    });

    document.querySelectorAll('#map-locations .map-location-marker.current-location').forEach(marker => {
      marker.style.setProperty('--player-scale', inverseScale);
    });

    document.querySelectorAll(".region-label").forEach(label => {
      label.classList.toggle("hidden", !(scale >= 0.5 && scale <= 5.0));
    });

    document.querySelectorAll(".landmark-dot").forEach(dot => {
      const label = dot.nextElementSibling;
      dot.classList.toggle("hidden", !(scale >= 0 && scale <= Infinity));
      if (label) label.classList.toggle("hidden", !(scale >= 1.2 && scale <= Infinity));
    });

    const playerMarker = document.querySelector(".map-location-marker.current-location");
    if (playerMarker) {
      const markerLabel = playerMarker.querySelector("div:last-child");
      if (markerLabel) markerLabel.classList.toggle("hidden", scale < 0.5);
    }
  },

  getCenterX(points) {
    const xs = points.map(p => p.x);
    return (Math.min(...xs) + Math.max(...xs)) / 2;
  },
  getCenterY(points) {
    const ys = points.map(p => p.y);
    return (Math.min(...ys) + Math.max(...ys)) / 2;
  },

  // 为了兼容旧代码中的 mapSystem.updateStatData 调用
  updateStatData(statData) {
    if (this.configs.main.hasRendered) {
      this.updatePlayerMarker();
    }
  },

  // 🌟 新增：独立的地缘空间逻辑引擎
  LocationEngine: {
    // 获取合法区域列表
    getValidRegions() {
      return GameDBManager.DB.mapData?.mainRegions?.map(r => r.name) || ["未知"];
    },
    // 获取合法地标列表
    getValidLandmarks() {
      return GameDBManager.DB.mapData?.landmarks?.map(l => l.name) || ["未知"];
    },
    // 判断是否异世界
    isAnotherWorld(region, landmark) {
      return !this.getValidRegions().includes(region) && !this.getValidLandmarks().includes(landmark);
    },
    // 根据地标查区域
    getRegionByLandmark(landmarkName) {
      const landmark = GameDBManager.DB.mapData?.landmarks?.find(l => l.name === landmarkName);
      if (landmark && landmark.mainRegionName) {
        return GameDBManager.DB.mapData?.mainRegions?.find(r => r.name === landmark.mainRegionName);
      }
      return null;
    },
    // 根据坐标查区域
    getRegionByCoord(coord) {
      return GameDBManager.DB.mapData?.mainRegions?.find(region => {
        const polygon = region.points?.outer;
        return polygon && GeometryHelper.isPointInPolygon(coord, polygon);
      });
    },
    // 计算区域中心点
    getRegionCenter(region) {
      const points = region?.points?.outer || [];
      if (!points.length) return { x: 50.0, y: 50.0 };
      const xs = points.map(p => p.x);
      const ys = points.map(p => p.y);
      return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    },

    /**
     * 核心校验函数：传入 stat_data，直接在原对象上进行空间规则修正
     * @returns {boolean} 是否发生了数据变更
     */
    validateAndCorrectLocation(statData) {
      let modified = false;
      const currentRegion = statData["当前区域"];
      const currentLandmark = statData["当前地标"];
      let currentCoord = statData["当前坐标"];

      // 1. 坐标基础容错
      if (!currentCoord || typeof currentCoord !== 'object' || currentCoord.x === undefined || currentCoord.y === undefined) {
        currentCoord = { x: 50.0, y: 50.0 };
        statData["当前坐标"] = currentCoord;
        modified = true;
      } else {
        // 限制在 0-100 范围
        const validX = Math.max(0, Math.min(100, currentCoord.x));
        const validY = Math.max(0, Math.min(100, currentCoord.y));
        if (validX !== currentCoord.x || validY !== currentCoord.y) {
          currentCoord = { x: validX, y: validY };
          statData["当前坐标"] = currentCoord;
          modified = true;
        }
      }

      const anotherWorld = this.isAnotherWorld(currentRegion, currentLandmark);

      // 异世界：不做任何边缘检测，保留玩家输入
      if (anotherWorld) {
        console.log(`[地图引擎] 检测到异世界坐标，跳过地理逻辑强制修正。`);
        return modified;
      }

      // 2. 正常世界：地理逻辑强制纠偏
      const targetRegion = GameDBManager.DB.mapData?.mainRegions?.find(r => r.name === currentRegion);
      
      if (targetRegion) {
        // 如果在已知区域，但坐标出界了，强行拉回到边缘或中心
        if (!GeometryHelper.isPointInPolygon(currentCoord, targetRegion.points.outer)) {
          const clampedPoint = GeometryHelper.getClampedPointToPolygon(currentCoord, targetRegion.points.outer);
          statData["当前坐标"] = clampedPoint;
          console.log(`[地图引擎] 坐标越界，已修正至 ${currentRegion} 边缘:`, clampedPoint);
          modified = true;
        }
      } else {
        // 区域不合法，但地标合法，通过地标反推区域
        if (currentLandmark) {
          const regionByLandmark = this.getRegionByLandmark(currentLandmark);
          if (regionByLandmark) {
            statData["当前区域"] = regionByLandmark.name;
            console.log(`[地图引擎] 按地标补全区域: ${regionByLandmark.name}`);
            modified = true;
          }
        } 
        // 连地标都没有，通过坐标反推区域
        else {
          const regionByCoord = this.getRegionByCoord(currentCoord);
          if (regionByCoord) {
            statData["当前区域"] = regionByCoord.name;
            console.log(`[地图引擎] 按坐标反推区域: ${regionByCoord.name}`);
            modified = true;
          }
        }
      }

      return modified;
    }
  }
};


// ==========================================
// 地图工具类
// ==========================================

const MapEarthTool = {
  // 地球级比例尺配置（常量）
  EARTH_CONFIG: {
  mapScaleKm: 40075, // 地球赤道周长（地图横向对应赤道）
  earthTotalArea: 510072000 // 地球总表面积(km²)，用于校验
  },
  // 计算区域实际面积
  calculatePolygonArea: (pointsData) => {
  let points = [];
  // 兼容不同格式的points数据
  if (pointsData?.outer) {
    points = pointsData.outer;
  } else if (Array.isArray(pointsData) && pointsData[0]?.outer) {
    points = pointsData[0].outer;
  } else if (Array.isArray(pointsData)) {
    points = pointsData;
  }
  if (points.length < 3) return 0;

  // 鞋带公式计算百分比面积
  const area = points.reduce((acc, p1, i) => {
    const p2 = points[(i + 1) % points.length];
    return acc + (p1.x * p2.y - p2.x * p1.y);
  }, 0);
  const percentageArea = Math.abs(area / 2);

  // 获取地图宽高比
  const mapImg = document.getElementById('map-image');
  const aspectRatio = mapImg && mapImg.naturalWidth > 0 && mapImg.naturalHeight > 0
    ? mapImg.naturalHeight / mapImg.naturalWidth
    : 7400 / 3800; // 地图原始宽高比

  // 换算成地球级实际面积
  const { mapScaleKm } = MapEarthTool.EARTH_CONFIG;
  return (percentageArea / (100 * 100)) * mapScaleKm * (mapScaleKm / aspectRatio);
  }
};

const GeometryHelper = {
  /**
   * 判断点是否在多边形内（射线法）
   * @param {Object} point - {x,y} 待判断坐标
   * @param {Array} polygon - 多边形顶点数组 [{x,y},...]
   */
  isPointInPolygon: (point, polygon) => {
  let inside = false;
  const x = point.x;
  const y = point.y;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
  },

  /**
   * 将点修正到多边形边缘（超出时拉回最近边缘）
   * @param {Object} point - 异常坐标
   * @param {Array} polygon - 目标多边形顶点
   */
  getClampedPointToPolygon: (point, polygon) => {
  const x = point.x;
  const y = point.y;
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // 情况1：点在x范围外 → 修正到x边界，y保持原比例
  if (x < minX || x > maxX) {
    const targetX = x < minX ? minX : maxX;
    const yRatio = (y - minY) / (maxY - minY) || 0.5;
    const targetY = minY + yRatio * (maxY - minY);
    return { x: targetX, y: targetY };
  }
  // 情况2：点在y范围外 → 修正到y边界，x保持原比例
  if (y < minY || y > maxY) {
    const targetY = y < minY ? minY : maxY;
    const xRatio = (x - minX) / (maxX - minX) || 0.5;
    const targetX = minX + xRatio * (maxX - minX);
    return { x: targetX, y: targetY };
  }
  // 情况3：在范围内 → 直接返回
  return { x, y };
  }
};

// 【修复 3】确保 GameManager 存在，并使用引用传递取代浅拷贝
if (typeof GameManager !== 'undefined') {
    window.GameManagerInstance = GameManager;
    window.GameManagerInstance.isInitializing = false;
    
    // 建立引用别名，直接把内存地址贴过去，两者数据永远同步！
    window.GAME_DATA = window.GameManagerInstance; 
    console.log('[源堡 - 实例挂载] GameManager 已成功挂载全局并建立 GAME_DATA 别名');
} else {
    toastr.error('[源堡 - 致命错误] GameManager 未定义！脚本加载顺序错误或文件丢失。');
    // 如果没有 GameManager，后续全会崩溃，必须在这里打断
    return; 
}

if (window.isGameInitTriggered === undefined) {
window.isGameInitTriggered = false; // 仅在全局未定义时初始化
}

// 防止重复注册事件监听器
if (window.isGameEventsRegistered === undefined) {
  window.isGameEventsRegistered = false;
}

async function checkAndBindSefirot() {
    const targetName = WorldbookManager.PRIMARY_BOOK;

    // 1. 检查系统中是否存在目标世界书
    const allWorldbooks = getWorldbookNames();
    const exists = allWorldbooks.includes(targetName);

    if (!exists) {
        // 如果系统里根本没这个世界书，弹出红色错误
        toastr.error(`系统内未发现名为 "${targetName}" 的世界书，请先导入！`, "关键错误");
        return;
    }

    // 2. 获取当前聊天绑定的世界书
    const currentWbName = getChatWorldbookName('current');

    // 3. 逻辑判定
    if (!currentWbName) {
        // 情况 A: 当前聊天世界书为 null (或空) -> 自动绑定
        try {
            await rebindChatWorldbook('current', targetName);
            toastr.success(`检测到未绑定世界书，已自动绑定为 "${targetName}"`, "自动绑定成功");
        } catch (error) {
            toastr.error(`自动绑定过程中出现错误: ${error.message}`, "操作失败");
        }
    } else if (currentWbName !== targetName) {
        // 情况 B: 当前已绑定世界书，但不是“1源堡” -> 弹出黄色警告
        toastr.warning(
            `注意：当前聊天绑定的世界书为「${currentWbName}」，并非「${targetName}」。请检查是否会造成设定冲突。`, 
            "世界书不匹配"
        );
    } else {
        // 情况 C: 已经是“1源堡”
        console.log(`[WorldbookCheck] 校验通过：当前已处于 "${targetName}"`);
    }
}
/**
 * 全局世界书基石检测与纠正
 * 确保核心设定条目存在，且注入状态、层级完全符合底层运转要求。
 */
async function checkWorldBooks() {
  console.log("[系统初始化] 开始检测核心世界书条目...");

  // 1. 严格使用官方的 PartialDeep<WorldbookEntry> 结构
  const coreBlueprints = [
    {
      name: "玩家人设", // 🌟 抛弃 comment，拥抱 name
      enabled: true,
      strategy: { type: 'constant' }, 
      position: { type: 'before_character_definition', order: 1001 }, 
      content: "名称: <User>\n" 
    },
    {
      name: "本周目经历",
      enabled: false,                 
      strategy: { type: 'selective' }, 
      position: { type: 'at_depth', role: 'system', depth: 0, order: 5000 },
      content: ""
    },
    {
      name: "本周目核心记忆",
      enabled: false,
      strategy: { type: 'selective' },
      position: { type: 'at_depth', role: 'system', depth: 0, order: 5000 },
      content: ""
    },
    {
      name: "历史的投影",
      enabled: true,
      strategy: { type: 'constant' }, 
      position: { type: 'before_character_definition', order: 1004 },
      content: ""
    }
  ];

  for (const blueprint of coreBlueprints) {
    try {
      // 兼容旧版的 fetchEntries，我们把 name 传进去作为前缀搜索
      const entries = await WorldbookManager.fetchEntries(blueprint.name, { exactMatch: true });

      if (!entries || entries.length === 0) {
        console.warn(`[源堡校验] 未找到核心条目【${blueprint.name}】，正在创建...`);
        // saveEntries 会自动把 prevent_incoming 和 prevent_outgoing 设为 true
        await WorldbookManager.saveEntries([{ ...blueprint }]);
        if (typeof toastr !== 'undefined') toastr.success(`已创建核心世界书：${blueprint.name}`, "初始化");
      } else {
        const existing = entries[0];
        let needsCorrection = false;

        // 🎯 1. 基础属性比对
        if (existing.enabled !== blueprint.enabled) needsCorrection = true;
        if (existing.strategy?.type !== blueprint.strategy?.type) needsCorrection = true;
        
        // 🎯 2. 精准智能的位置比对 (解决无限 Warning 的核心)
        const ep = existing.position || {};
        const bp = blueprint.position;
        
        if (ep.type !== bp.type) needsCorrection = true;
        if (ep.order !== bp.order) needsCorrection = true;
        
        // 只有在使用 at_depth 时，官方引擎的 role 和 depth 才有意义，才需要严格对比
        if (bp.type === 'at_depth') {
          if (ep.depth !== bp.depth || ep.role !== bp.role) needsCorrection = true;
        }

        if (needsCorrection) {
          console.log(`[源堡校验] 发现【${blueprint.name}】状态异常，执行强行纠正...`);
          
          const correctedEntry = {
            ...existing,
            enabled: blueprint.enabled,
            strategy: blueprint.strategy,
            position: blueprint.position 
          };

          await WorldbookManager.saveEntries([correctedEntry]);
          if (typeof toastr !== 'undefined') toastr.warning(`检测到【${blueprint.name}】配置异常，已强行修复！`, "系统维护");
        } else {
          console.log(`[源堡校验] 核心条目【${blueprint.name}】状态绿灯。`);
        }
      }
    } catch (error) {
      console.error(`[源堡校验] 修复【${blueprint.name}】时发生崩溃:`, error);
    }
  }
}


// 【新增】统一的初始化函数，防止重复调用
async function performGameInit() {
  if (window.isGameInitTriggered) return;
  window.isGameInitTriggered = true;

  await checkAndBindSefirot();
  await checkWorldBooks();

  console.log('[源堡 - 初始化] 启动双核并行模式...');
  console.time('[性能监控] 总初始化耗时');

  try {
    // 1. 底层日志系统最优先（轻量级，先跑）
    await GameLogsManager.init();

    // 2. 【关键改动】将两个重量级初始化打包，并行执行
    // 这样即便 DB 耗时 600ms，GM 的 300ms 也会在这 600ms 内重叠完成
    await Promise.all([
      (async () => {
        console.time('⏱️ [并行核-A] GameDBManager');
        await GameDBManager.init(); // 恢复你原本的快逻辑
        console.timeEnd('⏱️ [并行核-A] GameDBManager');
      })(),
      (async () => {
        console.time('⏱️ [并行核-B] GameManager');
        await GameManager.init();
        console.timeEnd('⏱️ [并行核-B] GameManager');
      })()
    ]);

    // 3. 地图系统紧随其后
    if (typeof GameMapManager !== 'undefined') {
      GameMapManager.init();
      window.mapSystem = GameMapManager; 
    }

    // 4. 解决【判定美化系统】的脚本跨区调用问题
    // 因为它在下方的 <script>，我们通过事件通知它，而不是直接硬调用
    window.dispatchEvent(new CustomEvent('SOURCE_BORG_READY'));

    console.timeEnd('[性能监控] 总初始化耗时');
  } catch (error) {
    console.error('[源堡 - 初始化] ✗ 失败:', error);
    window.isGameInitTriggered = false;
  }
}

// 防止重复注册事件监听器
if (window.isGameEventsRegistered) {
  console.log('[源堡 - 防重复] 事件监听器已注册，跳过');
} else {
  window.isGameEventsRegistered = true;

// 【方案1】绑定APP_READY事件（主要初始化路径）
console.log('[源堡 - 事件] 尝试绑定 APP_READY 事件...');
try {
  if (typeof eventOn !== 'undefined' && typeof tavern_events !== 'undefined') {
    eventOn(tavern_events.APP_READY, async () => {
      console.log('[源堡 - 事件] APP_READY 事件触发');
      await performGameInit();
    });
    console.log('[源堡 - 事件] ✓ APP_READY 事件监听器已注册');
  } else {
    console.warn('[源堡 - 事件] eventOn 或 tavern_events 未定义，跳过 APP_READY 绑定');
  }
} catch (error) {
  console.error('[源堡 - 事件] APP_READY 绑定失败:', error);
}

// 【方案2】DOMContentLoaded 备用初始化（防止 APP_READY 未触发）
console.log('[源堡 - 备用] 注册 DOMContentLoaded 备用初始化...');
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    console.log('[源堡 - 备用] DOMContentLoaded 触发');
    // 等待一小段时间，给 APP_READY 机会先执行
    setTimeout(async () => {
      if (!window.isGameInitTriggered) {
        console.warn('[源堡 - 备用] APP_READY 未触发，使用 DOMContentLoaded 备用初始化');
        await performGameInit();
      }
    }, 500);
  });
} else {
  console.log('[源堡 - 备用] DOM 已加载，直接执行备用检查');
  setTimeout(async () => {
    if (!window.isGameInitTriggered) {
      console.warn('[源堡 - 备用] APP_READY 未触发，使用延迟备用初始化');
      await performGameInit();
    }
  }, 1000);
}

} // 结束防重复检查

// 终极兜底：5秒后强制检查
setTimeout(async () => {
  if (!window.isGameInitTriggered) {
    console.error('[源堡 - 兜底] 5秒后仍未初始化，强制执行初始化');
    await performGameInit();
  } else {
    console.log('[源堡 - 兜底] 初始化已完成，无需兜底');
  }
}, 5000);




})();



// ===== 自动化系统折叠功能 =====
window.toggleAutoSystemPanel = function(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const btn = panel.querySelector('.auto-system-collapse-btn');
  if (!btn) return;

  // 切换折叠状态
  panel.classList.toggle('collapsed');

  // 更新按钮图标
  if (panel.classList.contains('collapsed')) {
  btn.textContent = '▶'; // 折叠状态显示右箭头
  } else {
  btn.textContent = '▶'; // 展开状态显示下箭头
  }
};

//宏规则
(function() {
    'use strict';

    const timer = setInterval(() => {
        // 检查核心 API 是否就绪
        if (typeof registerMacroLike === 'function' && typeof getChatMessages === 'function') {
            clearInterval(timer);

            /**
             * 核心工具：从第 0 楼消息中提取 stat_data 及其子路径
             * @param {string} path 路径字符串，如 "inventory.items"
             */
            const getStatValue = (path) => {
                const msgs = getChatMessages(0);
                if (!msgs || msgs.length === 0) return null;
                
                // 获取 0 楼的 data 对象
                const rootData = msgs[0].data || {};
                const statData = rootData.stat_data || {};
                
                // 递归解析路径 (处理 a.b.c 的情况)
                return path.split('.').reduce((obj, key) => 
                    (obj && obj[key] !== undefined) ? obj[key] : null, 
                    statData
                );
            };

            // 过滤黑名单键名的工具
            const getValidKeys = (data) => {
                if (!data || typeof data !== 'object') return [];
                return Object.keys(data).filter(k => k !== '$meta' && k !== 'initialized');
            };

            // --- 1. [[COUNT:路径]] ---
            registerMacroLike(/\[\[COUNT:(.*?)]]/gi, (context, substring, path) => {
                const data = getStatValue(path.trim());
                return getValidKeys(data).length.toString();
            });

            // --- 2. [[JOIN:路径:默认值]] ---
            registerMacroLike(/\[\[JOIN:(.*?):(.*?)\]\]/gi, (context, substring, path, defaultValue) => {
                const data = getStatValue(path.trim());
                const keys = getValidKeys(data);
                return keys.length > 0 ? keys.join(', ') : defaultValue;
            });

            // --- 完善后的 [[LIST:路径]] 宏 ---
            registerMacroLike(/\[\[LIST:(.*?)]]/gi, (context, substring, path) => {
                const data = getStatValue(path.trim());
                const keys = getValidKeys(data);
                if (keys.length === 0) return '无';

                return keys.map(key => {
                    const item = data[key];
                    if (!item || typeof item !== 'object') return key;

                    let displayText = item.名称 || key; // 优先使用对象内的名称
                    
                    // 数量与单位统计
                    if (item.数量 !== undefined) {
                        displayText += ` x${item.数量}${item.单位 || ''}`;
                    }

                    // 标签提取
                    const tags = [];
                    
                    // 1. 基础装备与序列状态
                    if (item.isEquipped) tags.push('已装备');
                    if (item.序列 && item.序列 !== '普通') tags.push(`序列:${item.序列}`);
                    if (item.等阶 && item.等阶 !== '普通') tags.push(`等阶:${item.等阶}`);
                    if (item.途径 && item.途径 !== '无') tags.push(`途径:${item.途径}`);
                    
                    // 2. 消耗品/物品特殊属性
                    if (item.类型) tags.push(`类型:${item.类型}`);
                    if (item.效果) tags.push(`效果:${item.效果}`);
                    if (item.作用属性) tags.push(`作用于:${item.作用属性}`);
                    if (item.伤害加成) tags.push(`伤害加成:${item.伤害加成}`);
                    
                    // 3. 装备特质与副作用
                    if (item.特质) tags.push(`特质:${item.特质}`);
                    if (item.副作用) tags.push(`副作用:${item.副作用}`);
                    
                    // 4. 阵营与社交（兼容性保留）
                    if (item.职位) tags.push(`职位:${item.职位}`);
                    if (item.声望 !== undefined && item.声望 > 0) tags.push(`声望:${item.声望}`);
                    
                    return tags.length > 0 ? `${displayText}(${tags.join(', ')})` : displayText;
                }).join('； ');
            });

            // --- 终极万能物品宏 [[ITEM:路径]] ---
            // 适用范围：所有物品列表（武器、衣物、饰品、封印物、消耗品、非凡特性、扮演法、其他杂物等）
            registerMacroLike(/\[\[ITEM:(.*?)]]/gi, (context, substring, path) => {
                const data = getStatValue(path.trim());
                const keys = getValidKeys(data);
                if (keys.length === 0) return '无';

                return keys.map(key => {
                    const item = data[key];
                    if (!item || typeof item !== 'object') return `- ${key}`;

                    // 1. 基础名称、数量与装备状态
                    const name = item.名称 || key;
                    const quantityText = (item.数量 !== undefined && item.数量 !== 1) ? ` x${item.数量}${item.单位 || ''}` : ''; // 数量为1时省略，让排版更干净
                    const equippedText = item.isEquipped ? ' [★已装备]' : '';
                    let text = `- **${name}**${quantityText}${equippedText}`;

                    const details = [];     // 核心分类/效果/特质
                    const attributes = [];  // 属性与加成
                    const others = [];      // Passthrough 自定义扩展字段

                    // 记录已处理的键，防止兜底时重复显示
                    const processedKeys = new Set(['名称', '数量', '单位', 'isEquipped', '描述', '$meta', 'initialized', 'id']);

                    // 2. 核心分类与效果 (白名单优先级提取)
                    const emphasisKeys = ['序列', '等阶', '途径', '类型', '特质', '副作用', '效果', '作用属性', '伤害加成'];
                    emphasisKeys.forEach(k => {
                        // 过滤掉空值和无意义的默认值（如序列:普通）
                        if (item[k] !== undefined && item[k] !== '' && item[k] !== '无' && item[k] !== '普通' && item[k] !== '空') {
                            if (k === '伤害加成' && typeof item[k] === 'number' && item[k] > 0) {
                                details.push(`伤害加成:+${item[k]}`); // 伤害加成特殊带+号
                            } else {
                                details.push(`${k}:${item[k]}`);
                            }
                        }
                        processedKeys.add(k);
                    });

                    // 3. 六维基础属性提取
                    const sixAttrs = ['活力', '灵性', '理智', '人性', '敏捷', '运气'];
                    sixAttrs.forEach(attr => {
                        const value = item[attr];
                        if (value !== undefined && value !== 0) {
                            // 如果值大于 0，加上 '+'；如果小于 0，数值本身自带 '-'
                            const prefix = value > 0 ? '+' : '';
                            attributes.push(`${attr} ${prefix}${value}`);
                        }
                        processedKeys.add(attr);
                    });

                    // 4. 百分比加成处理 (针对扮演法/非凡特性的 Record 结构)
                    if (item.百分比加成 && typeof item.百分比加成 === 'object') {
                        const bonusEntries = Object.entries(item.百分比加成)
                            .filter(([k, v]) => k !== '$meta' && v !== undefined && v !== '')
                            .map(([k, v]) => `${k}:+${v}`);
                        if (bonusEntries.length > 0) {
                            attributes.push(`加成:[${bonusEntries.join(', ')}]`);
                        }
                        processedKeys.add('百分比加成');
                    }

                    // 5. Passthrough 动态兼容 (抓取未知的扩展字段，绝对不会漏掉任何 AI 后期生成的词条)
                    Object.keys(item).forEach(k => {
                        if (!processedKeys.has(k) && item[k] !== '' && item[k] !== null && item[k] !== undefined) {
                            const val = item[k];
                            if (typeof val !== 'object') {
                                others.push(`${k}:${val}`);
                            } else if (Array.isArray(val)) {
                                others.push(`${k}:[${val.join(',')}]`);
                            } else {
                                others.push(`${k}:{...}`); // 避免深层嵌套刷屏影响 AI 阅读
                            }
                        }
                    });

                    // 6. 组装第一行：名称 + (分类 | 属性 | 其他)
                    const allTags = [...details, ...attributes, ...others];
                    if (allTags.length > 0) {
                        text += ` (${allTags.join(' | ')})`;
                    }

                    // 7. 组装第二行：描述文本独立换行显示（大幅提高 AI 关注度）
                    if (item.描述) {
                        text += `\n  └ 描述: ${item.描述}`;
                    }

                    return text;
                }).join('\n'); 
            });

            // --- 完美兼容的 [[NPC:路径]] 人物宏 ---
            registerMacroLike(/\[\[NPC:(.*?)]]/gi, (context, substring, path) => {
                const data = getStatValue(path.trim());
                const keys = getValidKeys(data);
                if (keys.length === 0) return '无';

                return keys.map(key => {
                    const npc = data[key];
                    if (!npc || typeof npc !== 'object') return `- ${key}`;

                    // 1. 首行基础：名称
                    const name = npc.名称 || key;
                    let text = `- **${name}**`;

                    const tags = [];      // 核心标签与属性
                    const others = [];    // Passthrough 未知扩展字段
                    const lines = [];     // 独立换行的长文本描述

                    // 记录已处理的键，防止兜底遍历时重复
                    const processedKeys = new Set([
                        '名称', '$meta', 'initialized', '当前状态', '外貌', '性格', 
                        '正在做的事', '近期打算', '长期目标', '能力清单', '关键记忆', '事件历史', '基础活力', '基础灵性', '基础敏捷', '基础运气', '基础人性', '基础理智'
                    ]);

                    // 2. 核心标签提取 (身份/序列/好感/关系/地点等)
                    const emphasisKeys = ['身份', '当前序列', '模板', '能力体系', '神性', '关系', '好感度', '所处地点', '持有物品'];
                    emphasisKeys.forEach(k => {
                        const val = npc[k];
                        if (val !== undefined && val !== '' && val !== '无' && val !== '普通人' && val !== '普通' && val !== 0) {
                            tags.push(`${k}:${val}`);
                        }
                        processedKeys.add(k);
                    });

                    // 3. 动态状态提取
                    if (npc.当前状态 && typeof npc.当前状态 === 'object') {
                        const statusKeys = Object.keys(npc.当前状态).filter(k => k !== '$meta');
                        if (statusKeys.length > 0) {
                            tags.push(`状态:[${statusKeys.join(', ')}]`);
                        }
                    }

                    // 4. 六维属性合并显示 (当前值/上限值)
                    const sixAttrs = ['活力', '灵性', '理智', '人性', '敏捷', '运气'];
                    sixAttrs.forEach(attr => {
                        const maxVal = npc[attr];
                        const currVal = npc[`当前${attr}`];

                        if (maxVal !== undefined && maxVal !== 0) {
                            // 如果有当前值，显示为 当前/上限；否则只显示上限
                            if (currVal !== undefined) {
                                tags.push(`${attr}:${currVal}/${maxVal}`);
                            } else {
                                tags.push(`${attr}:${maxVal}`);
                            }
                        }
                        processedKeys.add(attr);
                        processedKeys.add(`当前${attr}`); // 当前属性也标记为已处理
                    });

                    // 5. Passthrough 兜底兼容 (抓取未知的数值或短文本字段)
                    Object.keys(npc).forEach(k => {
                        if (!processedKeys.has(k) && npc[k] !== '' && npc[k] !== null && npc[k] !== undefined) {
                            const val = npc[k];
                            if (typeof val !== 'object') {
                                others.push(`${k}:${val}`);
                            } else if (Array.isArray(val)) {
                                others.push(`${k}:[${val.join(',')}]`);
                            } else {
                                others.push(`${k}:{...}`); // 避免深层嵌套
                            }
                        }
                    });

                    // 6. 拼装首行标签
                    const allTags = [...tags, ...others];
                    if (allTags.length > 0) {
                        text += ` (${allTags.join(' | ')})`;
                    }

                    // 7. 处理长文本与复杂结构 (树状向下展开)
                    
                    // 设定合并 (外貌与性格)
                    const desc = [];
                    if (npc.外貌) desc.push(`外貌:${npc.外貌}`);
                    if (npc.性格) desc.push(`性格:${npc.性格}`);
                    if (desc.length > 0) lines.push(`  ├ 设定: ${desc.join('，')}`);

                    // 动态行为与计划
                    if (npc.正在做的事) lines.push(`  ├ 动作: ${npc.正在做的事}`);
                    if (npc.近期打算) lines.push(`  ├ 计划: ${npc.近期打算}`);
                    if (npc.长期目标) lines.push(`  ├ 目标: ${npc.长期目标}`);

                    // 能力清单（默认显示详情）
                    if (npc.能力清单 && npc.能力清单.length > 0) {
                        const abilitiesText = npc.能力清单.map(ab => 
                            ab.描述 ? `${ab.名称}（${ab.描述}）` : ab.名称
                        ).join("、");
                        
                        lines.push(`  ├ 能力: ${abilitiesText}`);
                    }

                    // 当前状态
                    if (npc.当前状态 && typeof npc.当前状态 === 'object') {
                        const statusKeys = Object.entries(npc.当前状态).filter(([k]) => k !== '$meta').map(([k, v]) => `[${k}] ${v}`);
                        if (statusKeys.length > 0) lines.push(`  ├ 状态: ${statusKeys.join('； ')}`);
                    }

                    // 记忆与历史 (解析 Record)
                    if (npc.关键记忆 && typeof npc.关键记忆 === 'object') {
                        const mems = Object.entries(npc.关键记忆).filter(([k]) => k !== '$meta').map(([k, v]) => `[${k}] ${v}`);
                        if (mems.length > 0) lines.push(`  ├ 记忆: ${mems.join('； ')}`);
                    }

                    if (npc.事件历史 && typeof npc.事件历史 === 'object') {
                        const evts = Object.entries(npc.事件历史).filter(([k]) => k !== '$meta').map(([k, v]) => `[${k}] ${v}`);
                        if (evts.length > 0) lines.push(`  ├ 历史: ${evts.join('； ')}`);
                    }

                    // 8. 修正树状结构的最后一个符号 (把最后一个 ├ 改成 └)
                    if (lines.length > 0) {
                        const lastIdx = lines.length - 1;
                        lines[lastIdx] = lines[lastIdx].replace('  ├', '  └');
                        text += '\n' + lines.join('\n');
                    }

                    return text;
                }).join('\n'); // 多个NPC之间用换行隔开
            });

            console.log("✅ 宏注册成功！已关联第 0 楼消息数据。");
        }
    }, 500);
})();


