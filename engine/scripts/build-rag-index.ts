/**
 * 一次性脚本：构建 RAG 向量索引并缓存到 .rag-cache/
 *
 * 用法：
 *   node --import jiti/register engine/scripts/build-rag-index.ts
 *
 * 依赖：
 *   - jiti（已存在于 package.json）
 *   - .env 文件（需配置 SILICONFLOW_API_KEY）
 */

import { buildChunks, embedTexts, saveCachedIndex } from "../tools/lookup/lookup-rag.ts";

async function main(): Promise<void> {
  console.error("[build-rag-index] 开始构建索引…");

  // 1. 分块
  console.error("[build-rag-index] 正在扫描 data/ 目录并分块…");
  const chunks = buildChunks();
  console.error(`[build-rag-index] 共 ${chunks.length} 个文本块`);

  // 2. 嵌入
  const texts = chunks.map((c) => {
    const parts: string[] = [];
    if (c.title) parts.push(`标题: ${c.title}`);
    if (c.type) parts.push(`类型: ${c.type}`);
    if (c.sectionHeading) parts.push(c.sectionHeading);
    if (c.tags.length > 0) parts.push(`标签: ${c.tags.join("、")}`);
    if (c.text) parts.push(c.text);
    return parts.join("\n");
  });

  const model = process.env["EMBEDDING_MODEL"] ?? "Qwen/Qwen3-Embedding-0.6B";
  console.error(`[build-rag-index] 正在嵌入（模型: ${model}，${texts.length} 条）…`);
  const embeddings = await embedTexts(texts, model);
  console.error(`[build-rag-index] 嵌入完成，共 ${embeddings.length} 条向量`);

  // 3. 构建索引条目
  const entries = chunks.map((chunk, i) => ({
    chunk,
    embedding: embeddings[i] ?? [],
  }));

  // 4. 保存缓存
  saveCachedIndex(entries);
  console.error(`[build-rag-index] ✅ 索引已保存到 .rag-cache/chunk-index.json`);
  console.error(`[build-rag-index] 总计 ${entries.length} 条`);
}

main().catch((err) => {
  console.error("[build-rag-index] ❌ 失败:", err);
  process.exit(1);
});
