const EXPORT_TYPE = "wtc-matchup-ratings";
const EXPORT_VERSION = 2;

const state = {
  teams: [],
  myTeamId: "",
  myPlayerId: "",
  ratings: {},
  listRatings: {},
  listChoice: {},
  oppTeamId: "",
  focusIdx: 0,
  teamQuery: "",
  pairFiles: [],
  pairMode: "sum",
  pairResults: null,
  pairQuery: "",
};

const els = {
  myTeam: document.getElementById("my-team"),
  myPlayer: document.getElementById("my-player"),
  teamSearch: document.getElementById("team-search"),
  teamList: document.getElementById("team-list"),
  progressLabel: document.getElementById("rate-progress-label"),
  progressFill: document.getElementById("rate-progress-fill"),
  progressHint: document.getElementById("rate-progress-hint"),
  exportBtn: document.getElementById("export-btn"),
  myListsBtn: document.getElementById("my-lists-btn"),
  importOwn: document.getElementById("import-own"),
  rateEmpty: document.getElementById("rate-empty"),
  rateBoard: document.getElementById("rate-board"),
  oppRegion: document.getElementById("opp-region"),
  oppName: document.getElementById("opp-team-name"),
  oppIndex: document.getElementById("opp-index"),
  playerRows: document.getElementById("player-rows"),
  prevTeam: document.getElementById("prev-team"),
  nextTeam: document.getElementById("next-team"),
  pairDrop: document.getElementById("pair-drop"),
  pairFiles: document.getElementById("pair-files"),
  pairBrowse: document.getElementById("pair-browse"),
  pairImports: document.getElementById("pair-imports"),
  generateBtn: document.getElementById("generate-btn"),
  exportPairings: document.getElementById("export-pairings"),
  pairResults: document.getElementById("pair-results"),
  listsModal: document.getElementById("lists-modal"),
  listsTitle: document.getElementById("lists-title"),
  listsMeta: document.getElementById("lists-meta"),
  listsBody: document.getElementById("lists-body"),
  listsClose: document.getElementById("lists-close"),
  listsBackdrop: document.getElementById("lists-backdrop"),
};

function storageKey(teamId, playerId) {
  return `wtc-ratings:${teamId}||${playerId}`;
}

function teamById(id) {
  return state.teams.find((t) => t.id === id);
}

function opponentTeams() {
  return state.teams.filter((t) => t.id !== state.myTeamId);
}

function playerById(playerId) {
  for (const team of state.teams) {
    const player = team.players.find((p) => p.id === playerId);
    if (player) return { team, player };
  }
  return null;
}

function listLabels(player) {
  return (player.lists || []).map((lst, i) => shortListLabel(lst, i));
}

function shortListLabel(list, index) {
  if (!list) return `List ${index + 1}`;
  const name = list.name || `List ${index + 1}`;
  const caster = list.caster || "";
  const label = caster && name !== caster ? `${name} · ${caster}` : caster || name;
  return label.length > 52 ? `${label.slice(0, 49)}…` : label;
}

function myPlayerRecord() {
  return teamById(state.myTeamId)?.players.find((p) => p.id === state.myPlayerId) || null;
}

function listKeyFor(oppId) {
  return state.listChoice[oppId] || "any";
}

function ratingsBucket(listKey) {
  if (listKey === "any") return state.ratings;
  if (!state.listRatings[listKey]) state.listRatings[listKey] = {};
  return state.listRatings[listKey];
}

function ratingFor(oppId, listKey = listKeyFor(oppId)) {
  return ratingsBucket(listKey)[oppId];
}

function hasAnyRating(oppId) {
  if (Number.isInteger(state.ratings[oppId])) return true;
  return Object.values(state.listRatings).some((map) => Number.isInteger(map?.[oppId]));
}

function myListOptionsHtml(selected) {
  const me = myPlayerRecord();
  const lists = me?.lists || [];
  return [`<option value="any"${selected === "any" ? " selected" : ""}>Not selected</option>`]
    .concat(
      lists.map((lst, i) => {
        const key = String(i);
        return `<option value="${key}"${key === selected ? " selected" : ""}>List ${i + 1}: ${escapeHtml(shortListLabel(lst, i))}</option>`;
      })
    )
    .join("");
}

function otherRatingsHint(oppId, listKey) {
  const parts = [];
  if (listKey !== "any" && Number.isInteger(state.ratings[oppId])) {
    parts.push(`Any ${state.ratings[oppId]}`);
  }
  const me = myPlayerRecord();
  (me?.lists || []).forEach((lst, i) => {
    const key = String(i);
    if (key === listKey) return;
    const value = state.listRatings[key]?.[oppId];
    if (Number.isInteger(value)) parts.push(`L${i + 1} ${value}`);
  });
  return parts.join(" · ");
}

function renderListCard(list, index) {
  const entries = (list.entries || []).map((e) => {
    const cls = e.attachment ? "list-entry attachment" : "list-entry";
    const pts = e.points == null ? "" : e.points;
    return `<div class="${cls}"><span class="pts">${pts}</span><span>${escapeHtml(e.name)}</span></div>`;
  }).join("");
  const commands = (list.commands || []).length
    ? `<div class="commands">${list.commands.map((c) => `<span>${escapeHtml(c)}</span>`).join("")}</div>`
    : "";
  return `<article class="list-card">
    <p class="eyebrow">List ${index + 1}</p>
    <h3>${escapeHtml(list.name || `List ${index + 1}`)}</h3>
    <p class="caster">${escapeHtml(list.caster || "")}</p>
    ${entries}
    ${commands}
  </article>`;
}

function openLists(playerId) {
  const found = playerById(playerId);
  if (!found) return;
  const { team, player } = found;
  els.listsMeta.textContent = `${team.region} · ${team.name} · ${player.faction}`;
  els.listsTitle.textContent = player.name;
  const lists = player.lists || [];
  els.listsBody.innerHTML = lists.length
    ? lists.map((lst, i) => renderListCard(lst, i)).join("")
    : `<p class="hint">No lists found for this player.</p>`;
  els.listsModal.hidden = false;
}

function closeLists() {
  els.listsModal.hidden = true;
}

function toast(message) {
  document.querySelectorAll(".toast").forEach((n) => n.remove());
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function slug(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

function loadRatings() {
  state.ratings = {};
  state.listRatings = {};
  state.listChoice = {};
  if (!state.myTeamId || !state.myPlayerId) return;
  try {
    const raw = localStorage.getItem(storageKey(state.myTeamId, state.myPlayerId));
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.ratings = saved.ratings || {};
    state.listRatings = saved.listRatings || {};
    state.listChoice = saved.listChoice || {};
  } catch {
    state.ratings = {};
    state.listRatings = {};
    state.listChoice = {};
  }
}

function saveRatings() {
  if (!state.myTeamId || !state.myPlayerId) return;
  localStorage.setItem(
    storageKey(state.myTeamId, state.myPlayerId),
    JSON.stringify({
      team: state.myTeamId,
      player: state.myPlayerId,
      ratings: state.ratings,
      listRatings: state.listRatings,
      listChoice: state.listChoice,
    })
  );
}

function ratedCountForTeam(team) {
  return team.players.filter((p) => hasAnyRating(p.id)).length;
}

function progress() {
  const opps = opponentTeams();
  const done = opps.filter((t) => ratedCountForTeam(t) === t.players.length).length;
  const ratedPlayers = opps.reduce((sum, t) => sum + ratedCountForTeam(t), 0);
  const totalPlayers = opps.reduce((sum, t) => sum + t.players.length, 0);
  return { done, teams: opps.length, ratedPlayers, totalPlayers };
}

function fillTeamSelect() {
  const current = state.myTeamId;
  els.myTeam.innerHTML = `<option value="">— select —</option>` +
    state.teams
      .map((t) => `<option value="${escapeAttr(t.id)}">${escapeHtml(t.name)}</option>`)
      .join("");
  els.myTeam.value = current;
}

function fillPlayerSelect() {
  const team = teamById(state.myTeamId);
  if (!team) {
    els.myPlayer.innerHTML = `<option value="">— pick a team first —</option>`;
    return;
  }
  els.myPlayer.innerHTML = `<option value="">— select yourself —</option>` +
    team.players
      .map((p) => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)} (${escapeHtml(p.army || p.faction)})</option>`)
      .join("");
  if (team.players.some((p) => p.id === state.myPlayerId)) {
    els.myPlayer.value = state.myPlayerId;
  } else {
    state.myPlayerId = "";
  }
}

function renderProgress() {
  const { done, teams, ratedPlayers, totalPlayers } = progress();
  els.progressLabel.textContent = `${done} / ${teams}`;
  els.progressFill.style.width = teams ? `${(done / teams) * 100}%` : "0%";
  els.progressHint.textContent = state.myPlayerId
    ? `${ratedPlayers} of ${totalPlayers} matchups`
    : "Pick your team and yourself, then rate the opponents.";
  els.exportBtn.disabled = !state.myPlayerId;
  if (els.myListsBtn) els.myListsBtn.disabled = !state.myPlayerId;
}

function renderTeamList() {
  const q = state.teamQuery.trim().toLowerCase();
  const opps = opponentTeams();
  const visible = opps.filter((t) => {
    if (!q) return true;
    const hay = [
      t.name,
      t.region,
      ...t.players.flatMap((p) => [
        p.name,
        p.faction,
        p.army,
        ...listLabels(p),
        ...(p.lists || []).flatMap((lst) => (lst.entries || []).map((e) => e.name)),
      ]),
    ].join(" ").toLowerCase();
    return hay.includes(q);
  });

  els.teamList.innerHTML = visible.map((t) => {
    const n = ratedCountForTeam(t);
    const cls = [
      "team-item",
      t.id === state.oppTeamId ? "active" : "",
      n === t.players.length ? "done" : n > 0 ? "partial" : "",
    ].join(" ");
    return `<button type="button" class="${cls}" data-team="${escapeAttr(t.id)}">
      <span>
        <span class="name">${escapeHtml(t.name)}</span>
        <span class="meta">${escapeHtml(t.region)}</span>
      </span>
      <span class="meta">${n}/${t.players.length}</span>
    </button>`;
  }).join("");
}

function setOppTeam(id) {
  const opps = opponentTeams();
  if (!opps.length) return;
  state.oppTeamId = id && opps.some((t) => t.id === id) ? id : opps[0].id;
  state.focusIdx = 0;
  renderBoard();
  renderTeamList();
}

function shiftOppTeam(delta) {
  const opps = opponentTeams();
  const idx = Math.max(0, opps.findIndex((t) => t.id === state.oppTeamId));
  const next = opps[(idx + delta + opps.length) % opps.length];
  setOppTeam(next.id);
}

function renderBoard() {
  const ready = Boolean(state.myTeamId && state.myPlayerId);
  els.rateEmpty.hidden = ready;
  els.rateBoard.hidden = !ready;
  if (!ready) return;

  const opps = opponentTeams();
  const team = teamById(state.oppTeamId) || opps[0];
  if (!team) return;
  state.oppTeamId = team.id;
  const idx = opps.findIndex((t) => t.id === team.id);

  els.oppRegion.textContent = team.region;
  els.oppName.textContent = team.name;
  els.oppIndex.textContent = `${idx + 1} / ${opps.length}`;

  els.playerRows.innerHTML = team.players.map((p, i) => {
    const labels = listLabels(p);
    const listKey = listKeyFor(p.id);
    const current = ratingFor(p.id, listKey);
    const extra = otherRatingsHint(p.id, listKey);
    const buttons = Array.from({ length: 10 }, (_, n) => {
      const val = n + 1;
      const selected = current === val ? `selected s${val}` : "";
      return `<button type="button" class="score-btn ${selected}" data-player="${escapeAttr(p.id)}" data-score="${val}">${val}</button>`;
    }).join("");
    return `<article class="player-row ${i === state.focusIdx ? "focused" : ""}" data-idx="${i}">
      <div>
        <div class="player-name">${escapeHtml(p.name)}</div>
        <div class="faction-row">
          <span class="chip army">${escapeHtml(p.army || p.faction)}</span>
          ${p.theme ? `<span class="chip">${escapeHtml(p.theme)}</span>` : ""}
        </div>
        <div class="list-summary">${labels.map((l) => escapeHtml(l)).join("  ·  ") || "No lists parsed"}</div>
        ${extra ? `<div class="list-summary">Other ratings: ${escapeHtml(extra)}</div>` : ""}
        <div class="list-actions">
          <button type="button" class="btn ghost" data-lists="${escapeAttr(p.id)}">View lists</button>
        </div>
      </div>
      <div class="rate-side">
        <label class="field matchup-list">
          <span>Your list</span>
          <select data-my-list="${escapeAttr(p.id)}">${myListOptionsHtml(listKey)}</select>
        </label>
        <div class="scores">${buttons}</div>
      </div>
    </article>`;
  }).join("");
}

function setRating(playerId, score) {
  ratingsBucket(listKeyFor(playerId))[playerId] = score;
  saveRatings();
  const team = teamById(state.oppTeamId);
  if (team) {
    const idx = team.players.findIndex((p) => p.id === playerId);
    if (idx >= 0 && idx < team.players.length - 1) state.focusIdx = idx + 1;
    else if (idx === team.players.length - 1 && ratedCountForTeam(team) === team.players.length) {
      shiftOppTeam(1);
      renderProgress();
      return;
    }
  }
  renderBoard();
  renderTeamList();
  renderProgress();
}

function exportOwn() {
  const team = teamById(state.myTeamId);
  const player = team?.players.find((p) => p.id === state.myPlayerId);
  if (!team || !player) return;
  const payload = {
    version: EXPORT_VERSION,
    type: EXPORT_TYPE,
    team: team.name,
    teamId: team.id,
    player: player.name,
    playerId: player.id,
    faction: player.faction,
    exportedAt: new Date().toISOString(),
    ratings: state.ratings,
    listRatings: state.listRatings,
    listChoice: state.listChoice,
  };
  downloadJson(payload, `wtc-ratings-${slug(team.name)}-${slug(player.name)}.json`);
  toast("Ratings export saved.");
}

async function importOwnFile(file) {
  const data = await readJsonFile(file);
  if (data.type !== EXPORT_TYPE) throw new Error("This is not a WTC ratings file.");
  const team = teamById(data.teamId) || state.teams.find((t) => t.name === data.team);
  if (!team) throw new Error("Could not find the team from this file.");
  const player = team.players.find((p) => p.id === data.playerId) || team.players.find((p) => p.name === data.player);
  if (!player) throw new Error("Could not find the player from this file.");
  state.myTeamId = team.id;
  state.myPlayerId = player.id;
  state.ratings = data.ratings || {};
  state.listRatings = data.listRatings || {};
  state.listChoice = data.listChoice || {};
  saveRatings();
  fillTeamSelect();
  fillPlayerSelect();
  setOppTeam(opponentTeams()[0]?.id);
  renderProgress();
  toast("Loaded your ratings.");
}

function renderPairImports() {
  els.pairImports.innerHTML = state.pairFiles.map((f, i) => `
    <span class="import-chip">
      ${escapeHtml(f.player)} · ${escapeHtml(f.team)}
      <button type="button" data-remove="${i}" aria-label="Remove">×</button>
    </span>
  `).join("");
  els.generateBtn.disabled = state.pairFiles.length !== 5;
}

async function addPairFiles(fileList) {
  for (const file of fileList) {
    try {
      const data = await readJsonFile(file);
      if (data.type !== EXPORT_TYPE) throw new Error(`${file.name}: invalid format.`);
      if (state.pairFiles.some((f) => f.playerId === data.playerId || f.player === data.player)) {
        throw new Error(`${data.player} is already imported.`);
      }
      if (state.pairFiles.length && state.pairFiles[0].teamId !== data.teamId && state.pairFiles[0].team !== data.team) {
        throw new Error("All exports must come from the same team.");
      }
      state.pairFiles.push(data);
    } catch (err) {
      toast(err.message);
    }
  }
  if (state.pairFiles.length > 5) state.pairFiles = state.pairFiles.slice(0, 5);
  renderPairImports();
}

function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const perm of permutations(rest)) out.push([arr[i], ...perm]);
  }
  return out;
}

function scoreOf(exportFile, opponentId) {
  return scoreDetail(exportFile, opponentId).score;
}

function scoreDetail(exportFile, opponentId) {
  const found = [];
  const general = exportFile.ratings?.[opponentId];
  if (Number.isInteger(general)) found.push({ score: general, listKey: "any", label: "" });
  const player = playerById(exportFile.playerId)?.player;
  Object.entries(exportFile.listRatings || {}).forEach(([key, map]) => {
    const value = map?.[opponentId];
    if (!Number.isInteger(value)) return;
    const idx = Number(key);
    const list = player?.lists?.[idx];
    found.push({
      score: value,
      listKey: key,
      label: list ? `List ${idx + 1}: ${shortListLabel(list, idx)}` : `List ${idx + 1}`,
    });
  });
  if (!found.length) return { score: 5, missing: true, listLabel: "" };
  found.sort((a, b) => b.score - a.score || (a.listKey === "any" ? 1 : -1));
  return { score: found[0].score, missing: false, listLabel: found[0].label };
}

function bestAssignment(matrix, mode) {
  const n = matrix.length;
  const idxs = Array.from({ length: n }, (_, i) => i);
  let best = null;
  for (const perm of permutations(idxs)) {
    const scores = perm.map((j, i) => matrix[i][j]);
    const sum = scores.reduce((a, b) => a + b, 0);
    const min = Math.min(...scores);
    const better = !best
      || (mode === "min" && (min > best.min || (min === best.min && sum > best.sum)))
      || (mode !== "min" && (sum > best.sum || (sum === best.sum && min > best.min)));
    if (better) best = { perm, scores, sum, min };
  }
  return best;
}

function generatePairings() {
  if (state.pairFiles.length !== 5) {
    toast("Exactly 5 player exports are required.");
    return;
  }
  const ourTeamId = state.pairFiles[0].teamId || state.pairFiles[0].team;
  const ourTeam = teamById(ourTeamId) || state.teams.find((t) => t.name === state.pairFiles[0].team);
  if (!ourTeam) {
    toast("Could not recognize the team.");
    return;
  }

  const ours = state.pairFiles;
  const opps = state.teams.filter((t) => t.id !== ourTeam.id);
  const results = opps.map((opp) => {
    const details = ours.map((me) => opp.players.map((them) => scoreDetail(me, them.id)));
    const matrix = details.map((row) => row.map((d) => d.score));
    const best = bestAssignment(matrix, state.pairMode);
    const lines = best.perm.map((j, i) => ({
      us: ours[i].player,
      usId: ours[i].playerId,
      usFaction: ours[i].faction,
      usList: details[i][j].listLabel,
      them: opp.players[j].name,
      themId: opp.players[j].id,
      themFaction: opp.players[j].faction,
      score: best.scores[i],
      missing: details[i][j].missing,
    }));
    return {
      team: opp.name,
      region: opp.region,
      sum: best.sum,
      min: best.min,
      avg: best.sum / 5,
      lines,
      matrix,
      ours: ours.map((p) => p.player),
      them: opp.players.map((p) => p.name),
      pick: best.perm,
    };
  });

  results.sort((a, b) => a.sum - b.sum);
  state.pairResults = { ourTeam: ourTeam.name, results };
  renderPairResults();
  els.exportPairings.hidden = false;
}

function scoreClass(n) {
  if (n <= 4) return "low";
  if (n <= 6) return "mid";
  return "high";
}

function heatScore(n) {
  const score = Number(n);
  if (!Number.isInteger(score)) return 5;
  return Math.min(10, Math.max(1, score));
}

function renderPairResults() {
  const data = state.pairResults;
  if (!data) {
    els.pairResults.hidden = true;
    return;
  }
  const q = state.pairQuery.trim().toLowerCase();
  const rows = data.results.filter((r) => !q || r.team.toLowerCase().includes(q) || r.region.toLowerCase().includes(q));
  const avg = data.results.reduce((s, r) => s + r.sum, 0) / data.results.length;
  const hardest = data.results[0];
  const easiest = data.results[data.results.length - 1];

  els.pairResults.hidden = false;
  els.pairResults.innerHTML = `
    <div class="pair-summary">
      <div class="stat"><span>Team</span><strong>${escapeHtml(data.ourTeam)}</strong></div>
      <div class="stat"><span>Avg. total vs field</span><strong>${avg.toFixed(1)} / 50</strong></div>
      <div class="stat"><span>Hardest</span><strong>${escapeHtml(hardest.team)} (${hardest.sum})</strong></div>
      <div class="stat"><span>Easiest</span><strong>${escapeHtml(easiest.team)} (${easiest.sum})</strong></div>
    </div>
    <div class="pair-toolbar">
      <p class="hint">Sorted from hardest (lowest total). Missing ratings count as 5.</p>
      <input type="search" id="pair-search" placeholder="Filter teams…" value="${escapeAttr(state.pairQuery)}">
    </div>
    ${rows.map((r) => `
      <article class="pair-card">
        <div class="pair-card-head">
          <div>
            <p class="eyebrow">${escapeHtml(r.region)}</p>
            <h3>${escapeHtml(r.team)}</h3>
          </div>
          <div class="pair-score">Total ${r.sum}/50 · min ${r.min}</div>
        </div>
        <div class="pairing-grid pairing-head">
          <div>Our player</div>
          <div>Opponent</div>
          <div>Rating</div>
        </div>
        ${r.lines.map((l) => `
          <div class="pairing-grid pairing-row">
            <div>
              <button type="button" class="linkish" data-lists="${escapeAttr(l.usId || "")}">${escapeHtml(l.us)}</button>
              <div class="pair-sub">${escapeHtml(l.usFaction || "")}</div>
              ${l.usList ? `<div class="pair-sub">${escapeHtml(l.usList)}</div>` : ""}
            </div>
            <div>
              <button type="button" class="linkish" data-lists="${escapeAttr(l.themId || "")}">${escapeHtml(l.them)}</button>
              <div class="pair-sub">${escapeHtml(l.themFaction || "")}</div>
            </div>
            <div class="pair-rating"><span class="score-num ${scoreClass(l.score)}">${l.score}${l.missing ? "*" : ""}</span></div>
          </div>
        `).join("")}
        <details class="matrix-wrap">
          <summary>5×5 matrix</summary>
          <table class="matrix">
            <thead>
              <tr><th></th>${r.them.map((n) => `<th>${escapeHtml(n)}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${r.matrix.map((row, i) => `
                <tr>
                  <th>${escapeHtml(r.ours[i])}</th>
                  ${row.map((v, j) => `<td class="heat-${heatScore(v)}${r.pick[i] === j ? " pick" : ""}">${v}</td>`).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
        </details>
      </article>
    `).join("")}
  `;
}

function exportPairingsCsv() {
  const data = state.pairResults;
  if (!data) return;
  const lines = [["Opponent", "Region", "Total", "Min", "Our player", "Their player", "Rating"]];
  for (const r of data.results) {
    for (const l of r.lines) {
      lines.push([r.team, r.region, r.sum, r.min, l.us, l.them, l.score]);
    }
  }
  const csv = lines.map((row) => row.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";")).join("\n");
  downloadText("\uFEFF" + csv, `wtc-pairings-${slug(data.ourTeam)}.csv`, "text/csv;charset=utf-8");
}

function downloadJson(obj, filename) {
  downloadText(JSON.stringify(obj, null, 2), filename, "application/json");
}

function downloadText(text, filename, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function readJsonFile(file) {
  return file.text().then((t) => JSON.parse(t));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function onIdentityChange() {
  loadRatings();
  const opps = opponentTeams();
  if (!state.oppTeamId || state.oppTeamId === state.myTeamId) {
    state.oppTeamId = opps[0]?.id || "";
  }
  renderProgress();
  renderTeamList();
  renderBoard();
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      document.getElementById("tab-rate").hidden = btn.dataset.tab !== "rate";
      document.getElementById("tab-pair").hidden = btn.dataset.tab !== "pair";
    });
  });

  els.myTeam.addEventListener("change", () => {
    state.myTeamId = els.myTeam.value;
    state.myPlayerId = "";
    fillPlayerSelect();
    onIdentityChange();
  });

  els.myPlayer.addEventListener("change", () => {
    state.myPlayerId = els.myPlayer.value;
    onIdentityChange();
  });

  els.teamSearch.addEventListener("input", () => {
    state.teamQuery = els.teamSearch.value;
    renderTeamList();
  });

  els.teamList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-team]");
    if (btn) setOppTeam(btn.dataset.team);
  });

  els.playerRows.addEventListener("change", (e) => {
    const select = e.target.closest("[data-my-list]");
    if (!select) return;
    const playerId = select.dataset.myList;
    const row = select.closest(".player-row");
    if (row) state.focusIdx = Number(row.dataset.idx);
    state.listChoice[playerId] = select.value || "any";
    saveRatings();
    renderBoard();
    renderTeamList();
    renderProgress();
  });

  els.playerRows.addEventListener("click", (e) => {
    const listsBtn = e.target.closest("[data-lists]");
    if (listsBtn) {
      openLists(listsBtn.dataset.lists);
      return;
    }
    const btn = e.target.closest("[data-score]");
    if (!btn) return;
    const row = btn.closest(".player-row");
    if (row) state.focusIdx = Number(row.dataset.idx);
    const select = row?.querySelector("[data-my-list]");
    if (select) state.listChoice[btn.dataset.player] = select.value || "any";
    setRating(btn.dataset.player, Number(btn.dataset.score));
  });

  els.prevTeam.addEventListener("click", () => shiftOppTeam(-1));
  els.nextTeam.addEventListener("click", () => shiftOppTeam(1));
  els.exportBtn.addEventListener("click", exportOwn);
  els.myListsBtn.addEventListener("click", () => {
    if (state.myPlayerId) openLists(state.myPlayerId);
  });
  els.listsClose.addEventListener("click", closeLists);
  els.listsBackdrop.addEventListener("click", closeLists);
  els.importOwn.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await importOwnFile(file);
    } catch (err) {
      toast(err.message);
    }
    e.target.value = "";
  });

  document.addEventListener("keydown", (e) => {
    if (!els.listsModal.hidden) {
      if (e.key === "Escape" || e.key.toLowerCase() === "l") closeLists();
      return;
    }
    if (document.getElementById("tab-rate").hidden) return;
    if (!state.myPlayerId || !state.oppTeamId) return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

    if (e.key >= "1" && e.key <= "9") {
      const team = teamById(state.oppTeamId);
      const player = team?.players[state.focusIdx];
      if (player) setRating(player.id, Number(e.key));
    } else if (e.key === "0") {
      const team = teamById(state.oppTeamId);
      const player = team?.players[state.focusIdx];
      if (player) setRating(player.id, 10);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      state.focusIdx = Math.min(4, state.focusIdx + 1);
      renderBoard();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      state.focusIdx = Math.max(0, state.focusIdx - 1);
      renderBoard();
    } else if (e.key.toLowerCase() === "l") {
      const team = teamById(state.oppTeamId);
      const player = team?.players[state.focusIdx];
      if (player) openLists(player.id);
    } else if (e.key.toLowerCase() === "n") {
      shiftOppTeam(1);
    } else if (e.key.toLowerCase() === "p") {
      shiftOppTeam(-1);
    }
  });

  els.pairBrowse.addEventListener("click", () => els.pairFiles.click());
  els.pairDrop.addEventListener("click", (e) => {
    if (e.target !== els.pairBrowse) els.pairFiles.click();
  });
  els.pairDrop.addEventListener("dragover", (e) => {
    e.preventDefault();
    els.pairDrop.classList.add("dragover");
  });
  els.pairDrop.addEventListener("dragleave", () => els.pairDrop.classList.remove("dragover"));
  els.pairDrop.addEventListener("drop", (e) => {
    e.preventDefault();
    els.pairDrop.classList.remove("dragover");
    addPairFiles(e.dataTransfer.files);
  });
  els.pairFiles.addEventListener("change", (e) => {
    addPairFiles(e.target.files);
    e.target.value = "";
  });
  els.pairImports.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    state.pairFiles.splice(Number(btn.dataset.remove), 1);
    renderPairImports();
  });
  document.querySelectorAll('input[name="pair-mode"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      state.pairMode = radio.value;
      if (state.pairResults) generatePairings();
    });
  });
  els.generateBtn.addEventListener("click", generatePairings);
  els.exportPairings.addEventListener("click", exportPairingsCsv);
  els.pairResults.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-lists]");
    if (btn?.dataset.lists) openLists(btn.dataset.lists);
  });
  els.pairResults.addEventListener("input", (e) => {
    if (e.target.id === "pair-search") {
      state.pairQuery = e.target.value;
      renderPairResults();
      const input = document.getElementById("pair-search");
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  });
}

async function init() {
  const res = await fetch("data/teams.json");
  const data = await res.json();
  state.teams = data.teams;
  fillTeamSelect();
  fillPlayerSelect();
  renderProgress();
  renderTeamList();
  bindEvents();
}

init().catch((err) => {
  toast("Could not load team data.");
  console.error(err);
});
