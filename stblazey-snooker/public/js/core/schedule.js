// Date and fixture-scheduling helpers shared by the admin fixture
// generator and the demo data.

export const slugify = (s) =>
  String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-");

/** ISO timestamp for a UK wall-clock date/time (handles BST/GMT). */
export function londonISO(date, time = "19:30") {
  const [y, m, d] = date.split("-").map(Number);
  const lastSunday = (month) => { const x = new Date(Date.UTC(y, month + 1, 0)); return x.getUTCDate() - x.getUTCDay(); };
  const bst = (m > 3 && m < 10) || (m === 3 && d >= lastSunday(2)) || (m === 10 && d < lastSunday(9));
  return `${date}T${time}:00${bst ? "+01:00" : "+00:00"}`;
}

/** Double round-robin (circle method). Returns [[homeId, awayId], ...] per round. */
export function roundRobin(teamIds) {
  const ids = [...teamIds];
  if (ids.length % 2) ids.push(null);
  const rounds = [];
  const n = ids.length;
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i], b = ids[n - 1 - i];
      if (a && b) pairs.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    ids.splice(1, 0, ids.pop());
  }
  return [...rounds, ...rounds.map((pairs) => pairs.map(([h, a]) => [a, h]))];
}

export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
