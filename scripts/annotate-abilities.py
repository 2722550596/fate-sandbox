#!/usr/bin/env python3
"""
给 pathway_abilities.json 的每个能力条目加上 sequenceName 字段。
同时清理 JSON key 中的多余空格。

映射规则：
  键名 "{途径}途径-序列{N}" → 神之途径[途径][seq-N] 的序列名
  键名 "{途径}途径-支柱"   → 神之途径[途径][pillar] 的序列名
  键名 "{途径}途径-旧日"   → 神之途径[途径][old-one] 的序列名

例：
  键 "占卜家途径-序列9" → 神之途径["占卜家"]["seq-9"] = "占卜家"
  → 给该数组每个对象加上 "sequenceName": "占卜家"
"""

import json
import re

ABILITIES_PATH = "data/abilities/pathway_abilities.json"
GOD_PATHWAY_PATH = "data/config/神之途径.json"

# 键名解析："{途径}途径-序列{N}" 或 "{途径}途径-支柱" 或 "{途径}途径-旧日"
KEY_PATTERN = re.compile(r"^(.+?)途径-(?:序列(\d+)|支柱|旧日)$")


def main():
    # 读取文件
    with open(ABILITIES_PATH, encoding="utf-8") as f:
        abilities = json.load(f)
    with open(GOD_PATHWAY_PATH, encoding="utf-8") as f:
        god_pathway = json.load(f)

    total_entries = 0
    assigned = 0
    skipped_keys = []
    cleaned_keys = 0
    new_abilities = {}

    for key, entries in abilities.items():
        clean_key = key.strip()
        if clean_key != key:
            cleaned_keys += 1

        if not isinstance(entries, list):
            skipped_keys.append(f"{clean_key}（非数组）")
            new_abilities[clean_key] = entries
            continue

        match = KEY_PATTERN.match(clean_key)
        if not match:
            skipped_keys.append(f"{clean_key}（无法解析）")
            new_abilities[clean_key] = entries
            continue

        pathway_name = match.group(1)
        seq_num = match.group(2)

        # 确定神之途径里的 key
        if seq_num is not None:
            god_key = f"seq-{seq_num}"
        elif "支柱" in clean_key:
            god_key = "pillar"
        elif "旧日" in clean_key:
            god_key = "old-one"
        else:
            skipped_keys.append(f"{clean_key}（无法确定序列等级）")
            new_abilities[clean_key] = entries
            continue

        # 查找序列名
        pathway_data = god_pathway.get(pathway_name)
        if pathway_data is None:
            skipped_keys.append(f"{clean_key}（途径 {pathway_name} 不在神之途径.json）")
            new_abilities[clean_key] = entries
            continue

        seq_name = pathway_data.get(god_key)
        if seq_name is None:
            skipped_keys.append(
                f"{clean_key}（途径 {pathway_name} 没有 {god_key} 序列）"
            )
            new_abilities[clean_key] = entries
            continue

        # 给每个条目加上 sequenceName
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            entry["sequenceName"] = seq_name
            total_entries += 1
            assigned += 1

        new_abilities[clean_key] = entries

    # 写回文件
    with open(ABILITIES_PATH, "w", encoding="utf-8") as f:
        json.dump(new_abilities, f, ensure_ascii=False, indent=2)

    print(f"处理完成：")
    print(f"  - 共 {total_entries} 条能力")
    print(f"  - 已添加 sequenceName: {assigned} 条")
    if cleaned_keys:
        print(f"  - 已清理 key 空格: {cleaned_keys} 个")
    if skipped_keys:
        print(f"  - 跳过 {len(skipped_keys)} 个 key：")
        for k in skipped_keys:
            print(f"    · {k}")
    else:
        print(f"  - 无跳过，全部成功")


if __name__ == "__main__":
    main()