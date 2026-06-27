// CPUManager.js - 来源: original.js

// === class CPUManager (行 6174-6265) ===

class CPUManager {
  constructor(difficulty = "easy") {
    this.difficulty = difficulty;
    console.log(`[CPUManager] AI管理器已初始化，难度: ${difficulty}`);
  }

  selectAction(hero, skills, allyTeam, enemyTeam) {
    // 🆕 第一步：过滤掉被动技能，只考虑主动技能
    const activeSkills = skills.filter((skill) => !skill.isPassive);

    if (!activeSkills || activeSkills.length === 0) {
      console.warn(`[CPUManager] ${hero.name} 没有可用的主动技能`);
      return null;
    }

    const usableSkills = activeSkills.filter((skill) => {
      const canUse = skill.canUse(hero);
      return canUse.canAfford;
    });

    if (usableSkills.length === 0) {
      console.warn(`[CPUManager] ${hero.name} 没有足够资源使用任何主动技能`);
      return null;
    }

    let selectedSkill;
    switch (this.difficulty) {
      case "super-easy":
        selectedSkill = usableSkills[0];
        break;
      case "easy":
        selectedSkill = usableSkills[Math.floor(Math.random() * usableSkills.length)];
        break;
      case "normal":
        selectedSkill = this.selectBestSkill(usableSkills, hero);
        break;
      default:
        selectedSkill = usableSkills[0];
    }

    const targets = this.selectTargets(selectedSkill, hero, allyTeam, enemyTeam);

    console.log(
      `[CPUManager] ${hero.name} 选择使用 ${selectedSkill.name}，目标: ${targets.map((t) => t.name).join(", ")}`,
    );

    return {
      skill: selectedSkill,
      targets: targets,
    };
  }

  selectBestSkill(skills, hero) {
    return skills.reduce((best, current) => {
      return current.getPower() > best.getPower() ? current : best;
    }, skills[0]);
  }

  selectTargets(skill, hero, allyTeam, enemyTeam) {
    const targetType = skill.targetType || "single";
    const isFriendly = hero.teamType === "ally";
    const friendlyTeam = isFriendly ? allyTeam : enemyTeam;
    const hostileTeam = isFriendly ? enemyTeam : allyTeam;
    const aliveHostile = hostileTeam.filter((h) => h.additionalStats.当前活力 > 0);
    const aliveFriendly = friendlyTeam.filter((h) => h.additionalStats.当前活力 > 0);

    switch (targetType) {
      case "single":
        if (aliveHostile.length > 0) {
          return [aliveHostile[Math.floor(Math.random() * aliveHostile.length)]];
        }
        break;
      case "all":
      case "allEnemies":
        return aliveHostile;
      case "allAllies":
        return aliveFriendly;
      case "ally":
        // 🔥 新增：单个友军目标选择
        if (aliveFriendly.length > 0) {
          return [aliveFriendly[Math.floor(Math.random() * aliveFriendly.length)]];
        }
        break;
      case "self":
        return [hero];
      default:
        if (aliveHostile.length > 0) {
          return [aliveHostile[Math.floor(Math.random() * aliveHostile.length)]];
        }
    }

    return [];
  }
}
