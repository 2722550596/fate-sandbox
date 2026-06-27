#!/usr/bin/env python3
"""
清理 data/abilities/pathway_abilities.json：只保留 name/description/type/sequenceName。
"""
import json

PATH = "data/abilities/pathway_abilities.json"
KEEP = {"name", "description", "type", "sequenceName"}

with open(PATH, encoding="utf-8") as f:
    data = json.load(f)

removed_total = 0
for key, entries in data.items():
    if not isinstance(entries, list):
        continue
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        extra = set(entry.keys()) - KEEP
        removed_total += len(extra)
        for k in extra:
            del entry[k]

with open(PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"清理完成：移除 {removed_total} 个残留字段")