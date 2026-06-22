/**
 * Offscreen pressure 分类（backlog #1）。
 *
 * pressureType 现在是 offscreen event 的 canonical 字段，由写入方显式提供。
 * 这个纯函数只在两处兜底：迁移旧档时回填缺失的 pressureType，以及需要
 * 从自由文本猜测时的最后手段。运行期的 cooldown/多样性纪律一律读 canonical
 * 字段，不再对 summary 做正则推断。
 */
export function inferOffscreenPressureType(actorIds: readonly string[], summary: string): string {
  const haystack = `${actorIds.join(" ")} ${summary}`.toLowerCase();
  if (
    /police|government|faldeus|orlando|calatin|karatin|监测|封锁|巡逻|警方|警察|媒体|政府/.test(
      haystack,
    )
  )
    return "authority-surveillance";
  if (/church|executor|hansa|kotomine|教会|代行者|监督者/.test(haystack))
    return "church-supervision";
  if (/clock tower|association|el-melloi|时钟塔|协会|魔术师协会|贵族|专利/.test(haystack))
    return "mage-association-politics";
  if (
    /workshop|bounded field|leyline|familiar|caster|工房|结界|灵脉|使魔|术式|魔术师/.test(haystack)
  )
    return "magecraft-infrastructure";
  if (
    /servant|saber|archer|lancer|rider|caster|assassin|berserker|从者|英灵|宝具|真名/.test(haystack)
  )
    return "servant-autonomy";
  if (/civilian|school|hospital|news|rumor|市民|学校|医院|新闻|传闻|社交|交通/.test(haystack))
    return "civilian-society";
  if (
    /dream|disease|curse|origin|dead apostle|vampire|梦|疾病|诅咒|起源|死徒|吸血鬼/.test(haystack)
  )
    return "occult-contagion";
  if (/land|forest|temple|desert|crater|土地|森林|寺|沙漠|陨坑|地脉/.test(haystack))
    return "territory-environment";
  return "other";
}
