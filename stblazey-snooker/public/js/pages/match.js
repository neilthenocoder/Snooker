import { html, mount, $, toast, fmtDate, fmtTime, safeHref, fmtLongDate } from "../core/dom.js";
import { countdown, startCountdowns } from "../core/countdown.js";
import { seasonContext } from "../core/context.js";
import { loadFixture, headToHead, subscribe, setMatchPhotos, fixtureBoards } from "../core/api.js";
import { onTable } from "../core/live-score.js";
import { uploadImage } from "../core/upload.js";
import { matchScore, frameWinner, breakPoints, isShieldMatch, RULES } from "../core/rules.js";
import { canEditFixture, canAddMatchPhotos, MATCH_PHOTO_LIMIT } from "../core/auth.js";
import { breadcrumb, panel, dataTable, resultsList, statusBadge, urls, teamLink, playerLink, badge, gallery, outcomeTag, breakTag, breakList, liveSoonTag } from "../core/components.js";
import { setTitle, adminEdit, sideContext } from "../core/router.js";
import notFound from "./not-found.js";
import { matchChat } from "../core/comments.js";
import { headToHeadSummary } from "../core/h2h-summary.js";
import { openShareCard } from "../core/share-card.js";

export default async function match(view, { params, user }) {
  // Match night chat (Rich, round 24): a button near the top opens it from the bottom of the screen.
  // The button is kept for the whole visit and put back in its place after every redraw.
  let chat = null;
  const draw = async () => {
    const bundle = await loadFixture(params.id);
    if (!bundle) return notFound(view);
    const { fixture: fx, frames, breaks } = bundle;
    // Keep the short address in the bar (/match/2627-14) even when an old long link was followed.
    if (fx.code && params.id !== fx.code) history.replaceState(null, "", `${urls.match(fx)}${location.search}${location.hash}`);
    const ctx = await seasonContext(fx.season_id);
    const home = ctx.team.get(fx.home_team_id), away = ctx.team.get(fx.away_team_id);
    const title = `${home?.name} vs ${away?.name}`;
    setTitle(title);
    adminEdit("fixtures", null, { href: urls.scorecard(fx), label: "Edit scorecard" });
    sideContext({ league: ctx.league.get(fx.league_id) });
    const score = matchScore(frames);
    const played = frames.length > 0;
    // An old result brought in with only its final score has no frame details to show.
    const scoreOnly = played && frames.every((f) => f.legacy);
    const sides = [["home", home], ["away", away]];

    // Per-player lines for each side, in frame order.
    const lines = (side) => {
      const rows = new Map();
      for (const fr of frames) {
        const pid = fr[`${side}_player_id`];
        if (!pid) continue;
        const r = rows.get(pid) ?? rows.set(pid, { player: ctx.player.get(pid), points: 0, wins: 0, loss: 0, brks: 0, breakPts: 0 }).get(pid);
        r.points += Number(fr[`${side}_points`]) || 0;
        const w = frameWinner(fr);
        if (w) w === side ? r.wins++ : r.loss++;
      }
      for (const b of breaks) {
        const r = rows.get(b.player_id);
        if (!r) continue;
        r.brks = Math.max(r.brks, b.value);
        r.breakPts += breakPoints(b.value);
      }
      // Ranking points earned in this match: 5 for each frame won, plus break points.
      return [...rows.values()].map((r) => ({ ...r, winPts: r.wins * RULES.frameWinPoints, rankPts: r.wins * RULES.frameWinPoints + r.breakPts }));
    };
    const sideLines = Object.fromEntries(sides.map(([s]) => [s, lines(s)]));
    const total = (side, key) => sideLines[side].reduce((n, r) => n + r[key], 0);

    const h2h = await headToHead(fx.home_team_id, fx.away_team_id);
    const h2hFrames = new Map();
    for (const f of h2h.frames) (h2hFrames.get(f.fixture_id) ?? h2hFrames.set(f.fixture_id, []).get(f.fixture_id)).push(f);
    const past = h2h.fixtures.filter((f) => f.id !== fx.id && h2hFrames.has(f.id));
    // Round 37 (Rich): the match preview ends with a short write-up of earlier meetings between the two teams.
    const summary = headToHeadSummary({ fixture: fx, home, away, meetings: past, framesBy: h2hFrames, breaks: h2h.breaks ?? [],
      playerName: (id) => ctx.player.get(id)?.full_name ?? null, leagueName: (id) => ctx.league.get(id)?.name ?? "" });

    // Win in green, loss in red — the same colours as the scorecard below it.
    const outcome = (side) => {
      if (!played) return "–";
      const other = side === "home" ? "away" : "home";
      const what = score[side] > score[other] ? "won" : score[side] < score[other] ? "lost" : "drawn";
      const word = { won: "Win", lost: "Loss", drawn: "Draw" }[what];
      return outcomeTag(what, fx.status === "in_progress" ? `${word} (so far)` : word);
    };
    // The bars at the bottom: wins are green, losses red, the rest a plain grey.
    const bar = (label, key) => {
      const h = total("home", key), a = total("away", key), sum = h + a || 1;
      return html`<h4>${label}</h4><div class="bar bar-${key}"><span>${h}</span>
        <div class="track"><i style="width:${(h / sum) * 100}%"></i></div><span>${a}</span></div>`;
    };
    const lost = (s) => played && fx.status !== "in_progress" && score[s] < score[s === "home" ? "away" : "home"];
    const playerName = (id) => ctx.player.get(id)?.full_name ?? "–";
    const nameLink = (id, ext) => { const p = ctx.player.get(id); return p ? html`<a href="${urls.player(p)}">${p.full_name}</a>${ext ? html` <span class="ext-tag" title="Extra player">Ext</span>` : ""}` : "–"; };
    const league = ctx.league.get(fx.league_id);
    const shield = league?.shield_team_id ? isShieldMatch(league, fx, ctx.fixtures, ctx.framesByFixture) : { isShield: false };
    const won = (s) => played && fx.status !== "in_progress" && score[s] > score[s === "home" ? "away" : "home"];
    // Match night photos: added by the home captain / vice captain, shown here and in that week's news report.
    const photos = fx.gallery ?? [], mayAddPhotos = canAddMatchPhotos(user, fx);
    // A frame of this match being scored ball by ball right now (a captain using the scorecard's third view).
    const board = fx.status === "in_progress" ? (await fixtureBoards(fx.id)).find((m) => onTable(m)) : null;

    mount(view, html`
      <div class="wrap cm-row">${breadcrumb([["Home", "/"], [title]])}<span data-chat-slot></span></div>
      <div class="wrap"><div class="match-hero">
        <div class="mh-band">${league?.name ?? ""} · ${fmtDate(fx.starts_at)} ${fmtTime(fx.starts_at)}</div>
        <div class="mh-body">
          <a class="mh-side ${won("home") ? "won" : lost("home") ? "lost" : ""}" href="${home ? urls.team(home) : "#"}">${badge(home)}<span>${home?.name}</span></a>
          <div class="mh-score"><b class="${won("home") ? "won" : lost("home") ? "lost" : ""}">${played ? score.home : "–"}</b><i>:</i><b class="${won("away") ? "won" : lost("away") ? "lost" : ""}">${played ? score.away : "–"}</b>
            ${fx.status === "in_progress" ? html`<span class="live-dot">Live</span>` : played ? html`<small>${fx.status === "approved" ? "Final" : fx.status.replace("_", " ")}</small>` : ctx.notUpdated?.(fx) ? html`<small class="not-upd">Not updated yet</small>` : html`<small>${fmtTime(fx.starts_at)}</small>${liveSoonTag(fx)}`}</div>
          <a class="mh-side ${won("away") ? "won" : lost("away") ? "lost" : ""}" href="${away ? urls.team(away) : "#"}">${badge(away)}<span>${away?.name}</span></a>
        </div>
        ${!played && !["in_progress", "postponed"].includes(fx.status) && !ctx.notUpdated?.(fx) ? countdown(fx.starts_at) : ""}
        ${shield.isShield ? html`<div class="mh-foot">🛡 <a href="${urls.shield(league)}">${league.shield_name || "Shield"}</a> match — ${ctx.team.get(shield.holderId)?.name} defending</div>` : ""}
      </div></div>
      <div class="wrap stack" style="margin-top:24px">
        ${board ? html`<a class="live-draw-note" href="${urls.scoreboard(board)}"><span class="live-dot">Live</span> <b>Frame ${board.frame_no}</b> is being scored ball by ball: ${playerName(board.player_a_id)} ${board.state?.frame?.a ?? 0} – ${board.state?.frame?.b ?? 0} ${playerName(board.player_b_id)} — watch it →</a>` : ""}
        <div class="btn-row">
          ${canEditFixture(user, fx) ? html`<a class="btn" href="${urls.scorecard(fx)}">${played ? "Edit scorecard" : "Enter scorecard"}</a>` : ""}
          ${safeHref(fx.scorecard_url) ? html`<a class="btn ghost" href="${safeHref(fx.scorecard_url)}" target="_blank" rel="noopener">Photo of the paper scorecard</a>` : ""}
          ${played && !scoreOnly && fx.status !== "in_progress" ? html`<button type="button" class="btn blue" data-share-card>Share the result</button>` : ""}
        </div>
        ${panel("Results", dataTable([
          { label: "Team", cell: ([, t]) => teamLink(t) },
          { label: "Score", cell: ([s]) => (played ? html`<b class="res-num ${won(s) ? "won" : lost(s) ? "lost" : ""}">${score[s]}</b>` : "–"), cls: "num" },
          { label: "Outcome", cell: ([s]) => outcome(s) },
        ], sides))}
        ${panel("Details", dataTable([
          { label: "Date", cell: () => `${fmtDate(fx.starts_at)} ${fmtTime(fx.starts_at)}` },
          { label: "League", cell: () => ctx.league.get(fx.league_id)?.name },
          { label: "Season", cell: () => ctx.season?.name },
          { label: "Venue", cell: () => { const v = ctx.venue.get(fx.venue_id); return v ? html`<a href="${urls.venue(v)}">${v.name}</a>` : "–"; } },
          { label: "Status", cell: () => statusBadge(fx.status) },
        ], [fx]))}
        ${fx.notes ? html`<div class="notice">${fx.notes}</div>` : ""}
        ${photos.length || mayAddPhotos ? html`<div id="match-photos">${panel("Match night photos", html`<div class="mn-photos">
          ${!photos.length ? html`<p class="muted" style="margin:0">No photos yet.</p>` : mayAddPhotos ? "" : gallery(photos)}
          ${mayAddPhotos ? html`<div class="mn-manage">
            ${photos.length ? html`<div class="gal-thumbs">${photos.map((u, i) => html`<figure class="gal-thumb"><img src="${u}" alt="" data-lightbox="${u}"><button type="button" data-photo-remove="${i}" aria-label="Remove this photo">×</button></figure>`)}</div>` : ""}
            <div class="btn-row">
              ${photos.length < MATCH_PHOTO_LIMIT ? html`<label class="btn small blue">Add match night photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-photo-add></label>` : ""}
              <small class="muted">${photos.length} of ${MATCH_PHOTO_LIMIT} · home captain or vice captain · they also appear in this week's news report</small>
            </div></div>` : ""}
        </div>`)}</div>` : ""}
        ${scoreOnly ? html`<div class="notice">Only the final score was recorded for this match — there's no frame-by-frame scorecard.</div>` : played ? html`
          ${sides.map(([s, t]) => panel(t?.name ?? "", html`${dataTable([
            { label: "Player", cell: (r) => playerLink(r.player) },
            { label: "Position", cell: (r) => r.player?.position ?? "", cls: "hide-sm" },
            { label: "Points", cell: (r) => r.points, cls: "num" },
            { label: "Wins", cell: (r) => html`<span class="tally ${r.wins ? "win" : ""}">${r.wins}</span>`, cls: "num" },
            { label: "Loss", cell: (r) => html`<span class="tally ${r.loss ? "loss" : ""}">${r.loss}</span>`, cls: "num" },
            { label: "Best break", cell: (r) => breakTag(r.brks), cls: "num" },
            { label: "Win pts", cell: (r) => r.winPts, cls: "num hide-sm" },
            { label: "Break pts", cell: (r) => r.breakPts, cls: "num hide-sm" },
            { label: "Ranking pts", cell: (r) => r.rankPts, cls: "num strong" },
          ], sideLines[s])}<p class="table-note">Ranking points: ${RULES.frameWinPoints} for each frame won, plus break points (${RULES.breakMinimum}–39 = 3, 40–49 = 4 … 140+ = ${RULES.maxBreakPoints}).</p>`))}
          ${panel("Frame by frame", dataTable([
            { label: "Frame", cell: (f) => f.frame_no, cls: "num" },
            { label: home?.name, cell: (f) => html`<span class="${frameWinner(f) === "home" ? "strong" : ""}">${nameLink(f.home_player_id, f.home_ext)}</span>`, cls: "right" },
            { label: "Score", cell: (f) => `${f.home_points ?? "–"} - ${f.away_points ?? "–"}`, cls: "num" },
            { label: away?.name, cell: (f) => html`<span class="${frameWinner(f) === "away" ? "strong" : ""}">${nameLink(f.away_player_id, f.away_ext)}</span>` },
            { label: "Breaks", cell: (f) => breakList(breaks.filter((b) => b.frame_no === f.frame_no).map((b) => ({ name: playerName(b.player_id), value: b.value, extra: breakPoints(b.value) ? `+${breakPoints(b.value)} ranking pts` : "" }))), cls: "hide-sm" },
          ], frames))}
          <div class="compare">${bar("Points", "points")}${bar("Wins", "wins")}${bar("Loss", "loss")}${bar("Brks", "brks")}</div>
        ` : html`<div class="notice">No frames entered yet${fx.status === "scheduled" ? " — check back on match night." : "."}</div>`}
        ${summary?.sentences.length ? panel("Head to head", html`<div class="h2h-summary">${summary.sentences.map((s) => html`<p>${s}</p>`)}</div>`) : ""}
        ${panel("Past Meetings", resultsList(ctx, past, { scoreFn: (f) => { const s = matchScore(h2hFrames.get(f.id)); return `${s.home} - ${s.away}`; } }))}
      </div>`);
    if (chat) $("[data-chat-slot]", view)?.replaceWith(chat.button);
    // Round 40: the result as a square picture for social media.
    startCountdowns(view);
    $("[data-share-card]", view)?.addEventListener("click", () => {
      const best = [...breaks].sort((a, b) => b.value - a.value)[0];
      const stars = sides.map(([s, t]) => [t, [...sideLines[s]].sort((a, b) => b.wins - a.wins || b.points - a.points)[0]]);
      const top = stars.filter(([, r]) => r?.wins >= 2).sort((a, b) => b[1].wins - a[1].wins)[0];
      // The winning team's frame winners ("Frames won by A. Smith, B. Jones and C. Brown").
      const winSide = score.home > score.away ? "home" : score.away > score.home ? "away" : null;
      const winners = winSide ? sideLines[winSide].filter((r) => r.wins > 0).map((r) => r.player?.full_name).filter(Boolean) : [];
      const listText = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a.at(-1)}` : a[0] ?? "");
      openShareCard({
        title: league?.name ?? "League match", sub: `${fmtLongDate(fx.starts_at)}${ctx.venue.get(fx.venue_id) ? ` · ${ctx.venue.get(fx.venue_id).name}` : ""}`,
        home: { name: home?.name ?? "Home", logo: home?.logo_url }, away: { name: away?.name ?? "Away", logo: away?.logo_url }, score: [score.home, score.away],
        tag: fx.status === "approved" ? "Result" : "Result (to be approved)",
        footer: [best ? `Highest break: ${best.value} — ${playerName(best.player_id)}` : "",
          top ? `${top[1].player?.full_name} won ${top[1].wins} frames for ${top[0]?.name}` : winners.length && winners.length <= 4 ? `Frames won by ${listText(winners)}` : ""].filter(Boolean),
        file: `${home?.name ?? "home"}-v-${away?.name ?? "away"}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      });
    });
    // The photo controls live inside the panel, which is rebuilt on every draw — so nothing is left listening.
    const box = $("#match-photos", view);
    if (box && mayAddPhotos) {
      const store = async (list, message) => {
        try { await setMatchPhotos(fx.id, list); toast(message); await draw(); }
        catch (err) { toast(err.message, "error"); }
      };
      box.addEventListener("change", async (e) => {
        if (!e.target.matches("[data-photo-add]")) return;
        const files = [...e.target.files].slice(0, MATCH_PHOTO_LIMIT - photos.length);
        if (!files.length) return;
        e.target.closest("label").classList.add("busy");
        try {
          const added = [];
          for (const file of files) added.push(await uploadImage(file, { folder: "matchnight", maxSize: 1600, library: false }));
          await store([...photos, ...added], `${added.length} photo${added.length > 1 ? "s" : ""} added`);
        } catch (err) { toast(err.message, "error"); e.target.closest("label")?.classList.remove("busy"); }
      });
      box.addEventListener("click", (e) => {
        const i = e.target.dataset.photoRemove;
        if (i == null || !confirm("Remove this photo?")) return;
        store(photos.filter((_, n) => n !== Number(i)), "Photo removed");
      });
    }
    return fx;
  };

  const fx = await draw();
  if (fx) { chat = await matchChat({ fixture_id: fx.id }, fx, user, { title: document.title.split(" | ")[0] }); $("[data-chat-slot]", view)?.replaceWith(chat.button); }
  const stopChat = () => chat?.stop();
  // Keep the page updating while a match is being played.
  const stop = fx && ["scheduled", "in_progress", "submitted"].includes(fx.status) ? subscribe(["frames", "breaks", "fixtures"], draw) : () => {};
  return () => { stop(); stopChat(); };
}
