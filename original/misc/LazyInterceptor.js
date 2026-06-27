// 文件: LazyInterceptor.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================

// --- L42233-42253: // === 懒人拦截器：放在脚本最前面 === ---

// === 懒人拦截器：放在脚本最前面 ===
const originalFetch = window.fetch;
window.fetch = function (...args) {
  const url = args[0];
  // 如果请求地址包含那个云存档 IP，直接拦截
  if (typeof url === "string" && url.includes("107.151.244.45")) {
    console.warn("[云存档] 请求已被拦截（系统已禁用）");
    return Promise.resolve(
      new Response(
        JSON.stringify({
          success: false,
          error: "云存档服务暂时关闭",
        }),
        {
          status: 503, // 返回 503 状态码
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
  }
  // 其他请求正常通过
  return originalFetch.apply(this, args);
};
