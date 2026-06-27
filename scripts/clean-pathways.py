#!/usr/bin/env python3
"""
清理 data/pathways/ 下所有 JSON 文件，去掉数值数据，保留叙事先验信息。

保留字段：
  - name: 能力名称
  - description: 能力描述
  - type: 能力类型（非凡能力 / 旧日象征等）

去除字段：
  - power (数值/映射表)
  - cost (消耗)
  - damageType (伤害类型)
  - targetType (目标类型)
  - isHeal / healAmt / healType / healValueType (治疗相关)
  - customDamageCalculator (自定义伤害计算器)
  - effects (效果数组)
  - conditionalParams (条件参数)
  - cooldown (冷却回合)
  - 任何其他以 data_pathway_clean_开头的不认识字段
"""

import json
import os
import sys

PATHWAYS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "pathways"
)

# 保留字段白名单
KEEP_FIELDS = {"name", "description", "type"}

def clean_entry(entry: dict) -> dict:
    """保留白名单内的字段，忽略其他所有字段。"""
    return {k: v for k, v in entry.items() if k in KEEP_FIELDS and v is not None}

def main():
    if not os.path.isdir(PATHWAYS_DIR):
        print(f"错误: pathways 目录不存在: {PATHWAYS_DIR}", file=sys.stderr)
        sys.exit(1)

    total_files = 0
    total_entries = 0
    removed_files = 0

    for dirname in sorted(os.listdir(PATHWAYS_DIR)):
        dirpath = os.path.join(PATHWAYS_DIR, dirname)
        if not os.path.isdir(dirpath):
            continue

        for filename in sorted(os.listdir(dirpath)):
            if not filename.endswith(".json"):
                continue

            filepath = os.path.join(dirpath, filename)
            total_files += 1

            with open(filepath, "r", encoding="utf-8") as f:
                try:
                    data = json.load(f)
                except json.JSONDecodeError as e:
                    print(f"  !! JSON 解析失败: {filepath}: {e}", file=sys.stderr)
                    continue

            if not isinstance(data, list):
                print(f"  !! 非数组结构: {filepath}", file=sys.stderr)
                continue

            removed = 0
            for entry in data:
                # 检查是否有需要清理的字段
                extra = set(entry.keys()) - KEEP_FIELDS
                if extra:
                    removed += len(extra)

            if removed == 0:
                continue  # 无需修改

            cleaned = [clean_entry(e) for e in data]
            total_entries += len(cleaned)
            removed_files += 1

            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(cleaned, f, ensure_ascii=False, indent=2)

            print(f"  {dirname}/{filename}: 清理 {removed} 个字段, {len(cleaned)} 条能力")

    print(f"\n完成: 扫描 {total_files} 个文件, 清理 {removed_files} 个文件, {total_entries} 条能力")

if __name__ == "__main__":
    main()