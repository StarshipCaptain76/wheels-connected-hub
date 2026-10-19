/** The configured count is the entire member questionnaire. Guest draws use the full bank. */
export function selectConcoursQuestionIds(bank: string[], selected: string[], total: number, seed: string) {
  function hash(value: string) {
    let h = 2166136261;
    for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  const pool = [...new Set(bank)].sort((a, b) => hash(`${seed}:${a}`) - hash(`${seed}:${b}`) || a.localeCompare(b));
  const adminIds = [...new Set(selected)].filter((id) => pool.includes(id)).slice(0, total);
  const randomIds = pool.filter((id) => !adminIds.includes(id)).slice(0, Math.max(0, total - adminIds.length));
  return { adminIds, randomIds, allIds: [...adminIds, ...randomIds], spectatorIds: pool.slice(0, Math.ceil(total / 2)) };
}

export function canSeeIdleCompetition(member: boolean, admin: boolean) {
  return member || admin;
}