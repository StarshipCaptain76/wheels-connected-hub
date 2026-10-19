export function concoursQuestionPool<T extends { category: string; active?: boolean }>(bank: T[], category: string | null) {
  return bank.filter((q) => q.active !== false && (!category || q.category === category));
}

export function prepareConcoursSelection(bank: string[], selected: string[], total: number, manual: boolean, shuffle = false) {
  const eligible = [...new Set(bank)];
  if (eligible.length < total) throw new Error(`Only ${eligible.length} active questions available; ${total} required.`);
  const chosen = [...new Set(selected)];
  if (manual && (chosen.length !== total || chosen.some((id) => !eligible.includes(id)))) {
    throw new Error(`Choose exactly ${total} active questions from the selected category.`);
  }
  if (manual) return chosen;
  const retained = shuffle ? [] : chosen.filter((id) => eligible.includes(id)).slice(0, total);
  const rest = eligible.filter((id) => !retained.includes(id));
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [...retained, ...rest.slice(0, total - retained.length)];
}

/** The configured count is the entire member questionnaire. Guest draws use the scoped bank. */
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