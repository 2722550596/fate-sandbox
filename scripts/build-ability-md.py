#!/usr/bin/env python3
"""
将 data/pathways/ 下的 JSON 能力数据转为单途径一个 MD 文件，
放在 data/abilities/ 目录下，使用 frontmatter 标记 type=途径。

每个 MD 文件包含该途径全部序列等级的能力描述（name + description）。
"""
import json
import os
import sys

PATHWAYS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "pathways"
)
OUTPUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "abilities"
)

# 序列等级显示名称映射
SEQ_LABEL = {
    "pillar": "支柱",
    "old-one": "旧日",
    "seq-0": "序列 0",
    "seq-1": "序列 1",
    "seq-2": "序列 2",
    "seq-3": "序列 3",
    "seq-4": "序列 4",
    "seq-5": "序列 5",
    "seq-6": "序列 6",
    "seq-7": "序列 7",
    "seq-8": "序列 8",
    "seq-9": "序列 9",
}

def seq_sort_key(filename: str):
    """按序列等级排序：pillar → seq-0 → seq-9"""
    name = filename.replace(".json", "")
    if name == "pillar":
        return -3
    if name == "old-one":
        return -2
    if name.startswith("seq-"):
        try:
            return int(name[4:])
        except ValueError:
            return 99
    return 99

def main():
    if not os.path.isdir(PATHWAYS_DIR):
        print(f"错误: pathways 目录不存在: {PATHWAYS_DIR}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    total = 0

    for dirname in sorted(os.listdir(PATHWAYS_DIR)):
        dirpath = os.path.join(PATHWAYS_DIR, dirname)
        if not os.path.isdir(dirpath):
            continue

        # 收集该途径的所有 JSON 文件
        json_files = sorted(
            [f for f in os.listdir(dirpath) if f.endswith(".json")],
            key=seq_sort_key
        )
        if not json_files:
            continue

        lines = []
        lines.append("---")
        lines.append(f"title: {dirname}")
        lines.append("type: 途径")
        lines.append("tags: []")
        lines.append("aliases: []")
        lines.append("---")
        lines.append("")
        lines.append(f"# {dirname}")
        lines.append("")

        for filename in json_files:
            seq_name = filename.replace(".json", "")
            label = SEQ_LABEL.get(seq_name, seq_name)

            filepath = os.path.join(dirpath, filename)
            with open(filepath, "r", encoding="utf-8") as f:
                try:
                    data = json.load(f)
                except json.JSONDecodeError:
                    print(f"  !! JSON 解析失败: {filepath}", file=sys.stderr)
                    continue

            if not isinstance(data, list) or len(data) == 0:
                continue

            lines.append(f"## {label}")
            lines.append("")

            for entry in data:
                name = entry.get("name", "")
                desc = entry.get("description", "")
                etype = entry.get("type", "")
                if not name:
                    continue
                if desc:
                    lines.append(f"- **{name}**（{etype}）：{desc}")
                else:
                    lines.append(f"- **{name}**（{etype}）")

            lines.append("")

        # 写入 MD 文件
        md_filename = f"{dirname}.md"
        md_path = os.path.join(OUTPUT_DIR, md_filename)
        with open(md_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")

        print(f"  {md_filename} ({len(json_files)} 序列)")
        total += 1

    print(f"\n完成: 生成 {total} 个 MD 文件到 {OUTPUT_DIR}")

if __name__ == "__main__":
    main()