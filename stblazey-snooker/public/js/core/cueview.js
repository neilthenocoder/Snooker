// ─────────────────────────────────────────────────────────────
//  CUEVIEW — the player interview questions. Add, remove or reword
//  a question here and both the admin form and the player page
//  follow. Answers are stored together in players.cueview.
// ─────────────────────────────────────────────────────────────
export const CUEVIEW = [
  { key: "hand", label: "Left or right handed", options: ["", "Left", "Right"] },
  { key: "started", label: "At what age did you start playing snooker and why?" },
  { key: "first_memory", label: "What was your first ever memory of snooker?" },
  { key: "highest_break", label: "What is your highest break?" },
  { key: "achievement", label: "What has been your greatest achievement in snooker?" },
  { key: "ambition", label: "Do you have any snooker ambitions you still have not achieved?" },
  { key: "memorable_match", label: "What has been the most memorable snooker match you have ever seen?" },
  { key: "favourite_pro", label: "Who is your favourite professional player and why?" },
  { key: "commentator", label: "Who is your favourite TV commentator?" },
  { key: "famous_met", label: "Who is the most famous professional player you have played or met?" },
  { key: "bogey", label: "Who is your bogey player?" },
  { key: "best_player", label: "Who is the best player in the league?" },
  { key: "underrated", label: "Who is the most under-rated player in the league?" },
  { key: "funniest", label: "Funniest moment in your snooker experience?" },
  { key: "biography", label: "Biography", long: true },
];

/** Questions this player has actually answered, in order. */
export const answered = (player) =>
  CUEVIEW.filter((q) => String(player?.cueview?.[q.key] ?? "").trim()).map((q) => ({ ...q, answer: player.cueview[q.key] }));
