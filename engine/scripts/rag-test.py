#!/usr/bin/env python3
"""
快速测试脚本：加载缓存索引 + 语义搜索 + 重排序
用法：
    python3 engine/scripts/rag-test.py "序列2有什么能力"
    python3 engine/scripts/rag-test.py "阿蒙" --top 5
    python3 engine/scripts/rag-test.py "廷根市黑荆棘安保公司"
"""

import json
import math
import os
import sys
import urllib.request
import urllib.error

# ===========================================================================
# 环境变量
# ===========================================================================

def load_env():
    """读取 .env"""
    # 从脚本位置向上 2 层到项目根
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(script_dir, "..", "..", ".env")
    try:
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip("\"'")
                if key not in os.environ:
                    os.environ[key] = value
    except FileNotFoundError:
        pass


load_env()

API_BASE = os.environ.get("SILICONFLOW_BASE_URL", "https://api.siliconflow.cn/v1")
API_KEY = os.environ.get("SILICONFLOW_API_KEY", "")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "Qwen/Qwen3-Embedding-0.6B")
RERANKER_MODEL = os.environ.get("RERANKER_MODEL", "Qwen/Qwen3-Reranker-0.6B")

if not API_KEY:
    print("❌ 错误: 未找到 SILICONFLOW_API_KEY，请检查 .env 文件")
    sys.exit(1)

# ===========================================================================
# API 调用
# ===========================================================================

def api_post(path: str, payload: dict):
    url = f"{API_BASE}/{path}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"API 错误 {e.code}: {body[:300]}")


def embed(texts: list[str]) -> list[list[float]]:
    """批量嵌入"""
    results = []
    batch_size = 50
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        resp = api_post("embeddings", {
            "model": EMBEDDING_MODEL,
            "input": batch,
            "encoding_format": "float",
        })
        sorted_data = sorted(resp.get("data", []), key=lambda x: x["index"])
        for entry in sorted_data:
            results.append(entry["embedding"])
    return results


def rerank(query: str, docs: list[str]) -> list[float]:
    """重排序，返回每个 doc 的相关性分数"""
    try:
        resp = api_post("rerank", {
            "model": RERANKER_MODEL,
            "query": query,
            "documents": docs,
        })
        results = resp.get("results", [])
        scores = [0.0] * len(docs)
        for r in results:
            idx = r["index"]
            if 0 <= idx < len(scores):
                scores[idx] = r["relevance_score"]
        return scores
    except Exception as e:
        print(f"  ⚠ 重排序失败（降级为向量排序）: {e}")
        return [0.0] * len(docs)


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    return dot / (norm_a * norm_b) if norm_a * norm_b > 0 else 0.0


# ===========================================================================
# 加载索引
# ===========================================================================

def load_index(path: str) -> list[dict]:
    with open(path, "r") as f:
        entries = json.load(f)
    print(f"📂 加载索引: {len(entries)} 条")
    return entries


# ===========================================================================
# 搜索
# ===========================================================================

def search(query: str, index: list[dict], top_k: int = 30, top_n: int = 10):
    print(f"\n🔍 查询: 「{query}」\n")

    # 1. 构造查询文本（同 TS 端逻辑）
    query_vec = embed([query])[0]

    # 2. 向量相似度
    scored = []
    for entry in index:
        chunk = entry["chunk"]
        emb = entry["embedding"]
        if not emb:
            continue
        score = cosine_similarity(query_vec, emb)
        scored.append((score, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    top_vec = scored[:top_k]

    # 3. 重排序
    docs = []
    for _, chunk in top_vec:
        parts = []
        if chunk["title"]:
            parts.append(f"标题: {chunk['title']}")
        if chunk["type"]:
            parts.append(f"类型: {chunk['type']}")
        if chunk["sectionHeading"]:
            parts.append(chunk["sectionHeading"])
        if chunk["tags"]:
            parts.append(f"标签: {'、'.join(chunk['tags'])}")
        if chunk["text"]:
            parts.append(chunk["text"])
        docs.append("\n".join(parts))

    print(f"  📊 向量初筛: {top_k} 条 → 重排序中…")
    rerank_scores = rerank(query, docs)

    # 合并分数：rerank > 0 用 rerank，否则用向量分
    merged = []
    for i, (vec_score, chunk) in enumerate(top_vec):
        rr = rerank_scores[i] if i < len(rerank_scores) else 0.0
        final_score = rr if rr > 0 else vec_score * 0.6
        merged.append((final_score, chunk, vec_score, rr))

    merged.sort(key=lambda x: x[0], reverse=True)
    top_n_results = merged[:top_n]

    # 4. 展示结果
    print()
    for rank, (final_score, chunk, vec_score, rr_score) in enumerate(top_n_results, 1):
        rel_path = chunk["filePath"].split("/data/", 1)[-1] if "/data/" in chunk["filePath"] else chunk["filePath"]
        print(f"━━━ 结果 {rank} ━━━  (向量 {vec_score:.3f} | 重排序 {rr_score:.3f})")
        print(f"  来源: data/{rel_path}")
        print(f"  标题: {chunk['title']}")
        print(f"  类型: {chunk['type']}")
        if chunk.get("tags"):
            print(f"  标签: {'、'.join(chunk['tags'])}")
        if chunk.get("sectionHeading"):
            print(f"  章节: {chunk['sectionHeading']}")
        print()

        print(text)
        print()

    return top_n_results


# ===========================================================================
# 主入口
# ===========================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="RAG 搜索测试")
    parser.add_argument("query", nargs="?", help="搜索关键词")
    parser.add_argument("--top", type=int, default=10, help="返回结果数")
    parser.add_argument("--index", default=None, help="索引路径")

    args = parser.parse_args()

    if not args.query:
        # 交互模式
        script_dir = os.path.dirname(os.path.abspath(__file__))
        index_path = args.index or os.path.join(
            script_dir, "..", "..", ".rag-cache", "chunk-index.json"
        )

        index = load_index(index_path)
        print("输入查询（空行退出）:")
        while True:
            try:
                q = input("> ").strip()
                if not q:
                    break
                search(q, index, top_n=args.top)
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"❌ 错误: {e}")
    else:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        index_path = args.index or os.path.join(
            script_dir, "..", "..", ".rag-cache", "chunk-index.json"
        )

        index = load_index(index_path)
        search(args.query, index, top_n=args.top)