(function () {
  "use strict";

  /* ---------------- Setup ---------------- */
  const S = Object.assign(
    { title: "Trivia League", subtitle: "", secondsPerQuestion: 25, questionsPerRound: 10, basePoints: 100, maxSpeedBonus: 100 },
    window.GAME_SETTINGS || {}
  );
  const CATS = (window.QUIZ_CATEGORIES || []).map(c => ({
    ...c,
    questions: (c.questions || []).filter(q => !q.draft && Array.isArray(q.options) && q.options.length === 4)
  }));
  const GAMES_KEY = "btl-games";     // local (offline) mode: every round played on this device
  const PLAYER_KEY = "btl-player";   // remembers the name on this device
  const SECTOR_KEY = "btl-sector";   // remembers the sector on this device
  const SECTORS = window.SECTORS || [];
  const DIVISIONS = window.DIVISIONS || [];

  const $ = s => document.querySelector(s);
  let st = null, timerId = null, lastCat = null, boardRange = "all", boardView = "players";

  /* ---------------- Online mode (Supabase) ---------------- */
  const CFG = window.QUIZ_CONFIG || {};
  const ONLINE = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
  const FROM_RESET_LINK = /type=recovery/.test(location.hash);   // read before Supabase clears the address
  const db = ONLINE ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { flowType: "implicit", persistSession: true, detectSessionInUrl: true } }) : null;
  const EMAIL_DOMAIN = (CFG.emailDomain || "brigit.co.za").toLowerCase();
  const ADMIN_EMAILS = (CFG.adminEmails || []).map(e => String(e).trim().toLowerCase());
  let user = null, profile = null, isApprover = false, GAMES = [], DRAFTS = {};

  /* ---------------- Fire-protection icon set ---------------- */
  const SHIELD = "M12 2.8l7.2 3v5.4c0 4.6-3.1 8.1-7.2 10-4.1-1.9-7.2-5.4-7.2-10V5.8z";
  const ICONS = {
    flame: '<path d="M12 2.8c1 3.6 5.2 5.6 5.2 10.4a5.2 5.2 0 0 1-10.4 0c0-2.3 1.2-3.8 2.5-4.8.2 1.7 1 2.7 2.2 3.2C11 9.4 11 6 12 2.8z"/><path d="M12 21.4a2.3 2.3 0 0 1-2.3-2.3c0-1.5 1.3-2.4 2.3-3.8 1 1.4 2.3 2.3 2.3 3.8a2.3 2.3 0 0 1-2.3 2.3z"/>',
    extinguisher: '<rect x="7.5" y="8.5" width="8" height="13" rx="3"/><path d="M9.5 8.5V6.3h4v2.2M8.5 4.2h6l2.3 1.6M13.5 5c3.4 0 5 1.6 5 4.4V13M7.5 13.5h8"/>',
    sprinkler: '<path d="M10 21.5h4v-3h-4zM9.3 18.5 8.2 9.3M14.7 18.5l1.1-9.2M5.5 8.5h13"/><ellipse cx="12" cy="13.6" rx="1.3" ry="2.5"/><path d="M4.8 11.8 3 14M19.2 11.8 21 14M6.5 5.6 5.3 3.4M17.5 5.6l1.2-2.2M12 5.2V2.6"/>',
    hazard: '<path d="M12 2.6 21.4 12 12 21.4 2.6 12z"/><path d="M12 7.8c.6 1.9 2.7 2.9 2.7 5.4a2.7 2.7 0 0 1-5.4 0c0-1.2.6-1.9 1.3-2.4.1.9.5 1.4 1 1.6-.1-1.6-.1-3.1.4-4.6z"/>',
    helmet: '<path d="M5.2 15.2a6.8 6.8 0 0 1 13.6 0"/><path d="M2.8 15.2h18.4c0 1.7-1.3 3-3 3H5.8c-1.7 0-3-1.3-3-3z"/><path d="M10.4 7.6h3.2v3.6L12 12.3l-1.6-1.1z"/>',
    shieldFlame: '<path d="' + SHIELD + '"/><path d="M12 7.6c.5 1.6 2.4 2.5 2.4 4.8a2.4 2.4 0 0 1-4.8 0c0-1 .5-1.7 1.1-2.1.1.7.4 1.2.9 1.4-.1-1.4-.1-2.7.4-4.1z"/>',
    shieldCheck: '<path d="' + SHIELD + '"/><path d="m8.6 12.1 2.4 2.4 4.5-4.7"/>',
    hydrant: '<path d="M8.6 5.2a3.4 3.4 0 0 1 6.8 0"/><path d="M7.6 5.2h8.8v2.2H7.6zM8.8 7.4v11.4h6.4V7.4M5.4 10.8h3.4v3.4H5.4zM15.2 10.8h3.4v3.4h-3.4zM6.8 18.8h10.4v2.6H6.8z"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4z"/><path d="M10 20.5a2 2 0 0 0 4 0M12 3v2"/>'
  };
  const icon = (name, cls = "ico") => ICONS[name]
    ? `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`
    : esc(name || "");
  const fillIcons = () => document.querySelectorAll("[data-icon]").forEach(el => { el.innerHTML = icon(el.dataset.icon); });

  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pts = v => Math.round(v).toLocaleString("en-ZA");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const show = id => { document.querySelectorAll(".screen").forEach(e => { e.hidden = e.id !== id; }); window.scrollTo(0, 0); };
  const key = n => String(n || "").trim().toLowerCase();
  const pidOf = g => g.pid || key(g.name);                 // player identity
  const myPid = () => ONLINE ? (user && user.id) : key($("#player").value);
  // League entries are per competitor per sector
  const entryKey = (pid, sector) => pid + "|" + (sector || "");
  const myKey = () => entryKey(myPid(), $("#sector").value);
  const mySectors = () => ONLINE && profile ? (profile.sectors && profile.sectors.length ? profile.sectors : [profile.sector]) : SECTORS;
  let boardSector = "", boardRace = "", boardDivision = "";

  /* ---------------- Storage ---------------- */
  const LIB_BY_ID = { fire: "fire", policies: "policies", datasheets: "datasheets", sds: "sds", ops: "ops", certification: "certification" };

  function loadGames() { return GAMES; }

  async function refreshGames() {
    if (!ONLINE) {
      try { GAMES = JSON.parse(localStorage.getItem(GAMES_KEY) || "[]"); } catch (e) { GAMES = []; }
      return;
    }
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("quiz_results_board")
        .select("created_at, points, correct, asked, user_id, display_name, sector, library, division")
        .order("created_at", { ascending: true }).range(from, from + 999);
      if (error) { console.error(error); break; }
      rows.push(...data);
      if (data.length < 1000) break;
    }
    GAMES = rows.map(r => ({ pid: r.user_id, name: r.display_name, sector: r.sector, division: r.division || "", library: r.library, points: r.points, correct: r.correct, asked: r.asked, date: r.created_at }));
  }

  async function saveGame(g) {
    if (!ONLINE) {
      const { answers, ...keep } = g;
      GAMES.push(keep);
      try { localStorage.setItem(GAMES_KEY, JSON.stringify(GAMES)); } catch (e) { /* storage unavailable */ }
      return true;
    }
    const { error } = await db.from("quiz_results").insert({
      library: g.library || "mixed", sector: g.sector || null, points: g.points, correct: g.correct, asked: g.asked, best_streak: g.bestStreak
    });
    if (error) { console.error(error); return false; }
    // Per-answer log for stats (best effort: never blocks saving the score)
    const answers = (g.answers || []).filter(a => a.qid).map(a => ({
      question_id: a.qid, library: g.library || "mixed", sector: g.sector || null,
      correct: !!a.right, timed_out: !!a.timedOut, seconds: a.secs, points: a.gained || 0
    }));
    if (answers.length) db.from("quiz_answers").insert(answers).then(({ error: e }) => { if (e) console.warn("answer log:", e.message); });
    GAMES.push({ ...g, pid: user.id, division: (profile && profile.division) || "" });
    return true;
  }

  async function loadQuestionsOnline() {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("quiz_questions")
        .select("id, library, question, options, correct_index, explanation, source_title")
        .eq("status", "approved").range(from, from + 999);
      if (error) { console.error(error); break; }
      rows.push(...data);
      if (data.length < 1000) break;
    }
    CATS.forEach(c => { c.questions = []; });
    rows.forEach(r => {
      const c = CATS.find(x => (LIB_BY_ID[x.id] || x.id) === r.library);
      if (c && Array.isArray(r.options) && r.options.length === 4)
        c.questions.push({ id: r.id, q: r.question, options: r.options, answer: r.correct_index, explain: r.explanation, ref: r.source_title });
    });
  }
  function getName() { try { return localStorage.getItem(PLAYER_KEY) || ""; } catch (e) { return ""; } }
  function setName(n) { try { localStorage.setItem(PLAYER_KEY, n); } catch (e) { /* ignore */ } }
  function getSector() { try { return localStorage.getItem(SECTOR_KEY) || ""; } catch (e) { return ""; } }
  function setSector(n) { try { localStorage.setItem(SECTOR_KEY, n); } catch (e) { /* ignore */ } }

  /* ---------------- Leaderboard maths ---------------- */
  function gamesIn(range, race) {
    const now = new Date();
    const since = range === "week" ? new Date(now - 7 * 864e5)
      : range === "month" ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(0);
    return loadGames().filter(g => new Date(g.date) >= since && (!race || g.library === race));
  }

  // One entry per competitor per sector. Pass a sector to see only that sector's table.
  function standings(range, sector, race, division) {
    const map = new Map();
    gamesIn(range, race).forEach(g => {
      if (sector && g.sector !== sector) return;
      if (division && g.division !== division) return;
      const pid = pidOf(g), k = entryKey(pid, g.sector);
      const p = map.get(k) || { key: k, pid, name: g.name, sector: g.sector || "", total: 0, games: 0, best: 0, correct: 0, asked: 0 };
      p.name = g.name; p.division = g.division || p.division || "";
      p.total += g.points; p.games++; p.best = Math.max(p.best, g.points);
      p.correct += g.correct; p.asked += g.asked;
      map.set(k, p);
    });
    return [...map.values()].sort((a, b) => b.total - a.total || b.best - a.best);
  }
  function divisionStandings(range, race) {
    const map = new Map(DIVISIONS.map(n => [n, { name: n, total: 0, games: 0, players: new Set(), correct: 0, asked: 0 }]));
    gamesIn(range, race).forEach(g => {
      if (!g.division) return;
      const p = map.get(g.division) || { name: g.division, total: 0, games: 0, players: new Set(), correct: 0, asked: 0 };
      p.total += g.points; p.games++; p.players.add(pidOf(g)); p.correct += g.correct; p.asked += g.asked;
      map.set(g.division, p);
    });
    return [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }
  function sectorStandings(range, race) {
    const map = new Map(SECTORS.map(n => [n, { name: n, total: 0, games: 0, players: new Set(), correct: 0, asked: 0 }]));
    gamesIn(range, race).forEach(g => {
      if (!g.sector) return;
      const p = map.get(g.sector) || { name: g.sector, total: 0, games: 0, players: new Set(), correct: 0, asked: 0 };
      p.total += g.points; p.games++; p.players.add(pidOf(g)); p.correct += g.correct; p.asked += g.asked;
      map.set(g.sector, p);
    });
    return [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }

  const raceName = id => id === "mixed" ? "Mixed Bag" : ((CATS.find(c => c.id === id) || {}).name || id);
  const rankOf = (list, k) => { const i = list.findIndex(p => p.key === k); return i < 0 ? null : i + 1; };

  /* ---------------- Required races (e.g. Company Policies) ---------------- */
  const REQUIRED = CATS.filter(c => c.required && !c.comingSoon);
  const doneRace = (catId, pid = myPid()) => loadGames().some(g => pidOf(g) === pid && g.library === catId);
  const missingRequired = () => REQUIRED.filter(c => !doneRace(c.id));

  /* ---------------- Home ---------------- */
  function card(id, ic, name, desc, n, soon, waiting, required) {
    const off = n === 0 || soon;
    const badge = !required ? "" : doneRace(id) ? `<span class="req done">✓ Completed</span>` : `<span class="req">Required</span>`;
    const status = soon ? "Coming soon"
      : n > 0 ? n + " question" + (n === 1 ? "" : "s")
      : isApprover && waiting ? `${waiting} waiting for approval`
      : isApprover ? "No questions yet. Generate some in Review"
      : "Questions on the way";
    return `<button class="cat${required ? " required" : ""}" data-cat="${esc(id)}" ${off ? "disabled" : ""}>${badge}
      <span class="icon">${icon(ic || "flame")}</span>
      <span class="cname">${esc(name)}</span>
      <span class="cdesc">${esc(desc || "")}</span>
      <span class="ccount">${esc(status)}</span>
    </button>`;
  }

  function renderHome() {
    document.title = S.title;
    $("#title").textContent = S.title;
    $("#subtitle").textContent = S.subtitle;
    const sel = $("#sector");
    const mine = mySectors();
    const keep = sel.value || getSector();
    sel.innerHTML = (ONLINE && profile ? "" : `<option value="">Your sector…</option>`) + mine.map(n => `<option>${esc(n)}</option>`).join("");
    sel.value = mine.includes(keep) ? keep : (ONLINE && profile ? mine[0] : "");
    sel.disabled = ONLINE && profile && mine.length < 2;
    const bs = $("#board-sector");
    bs.innerHTML = `<option value="">All sectors</option>` + SECTORS.map(n => `<option>${esc(n)}</option>`).join("");
    bs.value = boardSector;
    const br = $("#board-race");
    br.innerHTML = `<option value="">All races</option>` +
      [...CATS].sort((a, b) => (b.required ? 1 : 0) - (a.required ? 1 : 0)).filter(c => !c.comingSoon)
        .map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("") +
      `<option value="mixed">Mixed Bag</option>`;
    br.value = boardRace;
    const bd = $("#board-division");
    bd.innerHTML = `<option value="">All divisions</option>` + DIVISIONS.map(n => `<option>${esc(n)}</option>`).join("");
    bd.value = boardDivision;
    if (ONLINE && profile) {
      $("#player").value = profile.display_name;
      $("#player").disabled = true;
      $("#account").hidden = false;
      $("#edit-sectors").hidden = false;
      $("#acct-email").textContent = user.email;
      $("#review-link").hidden = !isApprover;
    } else {
      if (!$("#player").value) $("#player").value = getName();
    }
    $("#mode-note").hidden = ONLINE;
    const total = CATS.filter(c => !c.comingSoon).reduce((n, c) => n + c.questions.length, 0);
    const allWaiting = Object.values(DRAFTS).reduce((a, b) => a + b, 0);
    $("#cats").innerHTML = (isApprover && total === 0 && allWaiting
        ? `<p class="approve-note">No questions are approved yet, so the races are closed. <a href="review.html">Approve questions in Review →</a></p>` : "") +
      requiredNote() +
      [...CATS].sort((a, b) => (b.required ? 1 : 0) - (a.required ? 1 : 0))
        .map(c => card(c.id, c.icon, c.name, c.description, c.questions.length, c.comingSoon, DRAFTS[c.id] || 0, c.required)).join("") +
      card("mixed", "extinguisher", "Mixed Bag", "A bit of everything", total, false, allWaiting);
    $("#cats").querySelectorAll("button[data-cat]").forEach(b => { b.onclick = () => start(b.dataset.cat); });
    $("#cats").querySelectorAll("[data-start]").forEach(b => { b.onclick = () => start(b.dataset.start); });
    renderMe();
    renderBoard();
    show("home");
  }

  function requiredNote() {
    if (!$("#player").value.trim()) return "";
    return missingRequired().map(c => {
      const open = c.questions.length > 0;
      return `<div class="req-note"><span class="icon">${icon(c.icon || "shieldFlame")}</span>
        <div><b>Required for everyone:</b> finish the ${esc(c.name)} race at least once.
        ${open ? "" : `<br><small>It opens as soon as its questions are approved.</small>`}</div>
        ${open ? `<button class="btn go small" data-start="${esc(c.id)}">Start now</button>` : ""}</div>`;
    }).join("");
  }

  function renderMe() {
    const name = $("#player").value.trim();
    const box = $("#me");
    if (!name) { box.hidden = true; return; }
    const sec = $("#sector").value;
    const list = standings("all", sec);
    const r = rankOf(list, myKey());
    const p = r ? list[r - 1] : null;
    box.hidden = false;
    box.innerHTML = p
      ? `<div><small>Rank${sec ? " · " + esc(sec) : ""}</small><b>#${r}</b></div><div><small>Total points</small><b>${pts(p.total)}</b></div>
         <div><small>Races</small><b>${p.games}</b></div><div><small>Personal best</small><b>${pts(p.best)}</b></div>`
      : `<p>Welcome, <b>${esc(name)}</b>! Choose a race to get on the ${sec ? esc(sec) + " " : ""}leaderboard.</p>`;
  }

  function renderBoard() {
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.dataset.range === boardRange));
    document.querySelectorAll(".view").forEach(t => t.classList.toggle("on", t.dataset.view === boardView));
    $("#board").closest("table").classList.toggle("sectors", boardView === "sectors");
    $("#board").closest("table").classList.toggle("divisions", boardView === "divisions");
    $("#board-sector").hidden = boardView !== "players";
    $("#board-division").hidden = boardView !== "players";
    if (boardView === "sectors") return renderSectorBoard();
    if (boardView === "divisions") return renderGroupBoard("Division", divisionStandings(boardRange, boardRace), profile && profile.division ? [profile.division] : []);
    $("#board-head").innerHTML = `<tr><th></th><th>Competitor</th><th class="num">Races</th><th class="num hide-sm">Accuracy</th><th class="num hide-sm">PB</th><th class="num">Points</th></tr>`;
    const me = myPid();
    const list = standings(boardRange, boardSector, boardRace, boardDivision);
    $("#board").innerHTML = list.length
      ? list.slice(0, 20).map((p, i) => {
          const medal = ["🥇", "🥈", "🥉"][i] || `<span class="pos">${i + 1}</span>`;
          const acc = p.asked ? Math.round(p.correct / p.asked * 100) : 0;
          return `<tr class="${p.pid === me ? "mine" : ""} ${i < 3 ? "top" : ""}">
            <td class="r">${medal}</td><td class="n">${esc(p.name)}${p.sector ? `<small class="sec">${esc(p.sector)}${p.division ? " · " + esc(p.division) : ""}</small>` : ""}</td>
            <td class="num">${p.games}</td><td class="num hide-sm">${acc}%</td><td class="num hide-sm">${pts(p.best)}</td>
            <td class="num tot">${pts(p.total)}</td></tr>`;
        }).join("")
      : `<tr><td colspan="6" class="empty">No ${boardRace ? esc(raceName(boardRace)) + " " : ""}races yet${boardSector ? " for " + esc(boardSector) : ""}${boardDivision ? " in " + esc(boardDivision) : ""} this period — first to the start line takes top spot!</td></tr>`;
  }

  function renderGroupBoard(label, list, mine) {
    $("#board-head").innerHTML = `<tr><th></th><th>${label}</th><th class="num hide-sm">Players</th><th class="num hide-sm">Accuracy</th><th class="num">Races</th><th class="num">Points</th></tr>`;
    const anyPlayed = list.some(s => s.games);
    $("#board").innerHTML = list.map((p, i) => {
      const medal = anyPlayed && p.games ? (["🥇", "🥈", "🥉"][i] || `<span class="pos">${i + 1}</span>`) : `<span class="pos">–</span>`;
      const acc = p.asked ? Math.round(p.correct / p.asked * 100) + "%" : "–";
      return `<tr class="${mine.includes(p.name) ? "mine" : ""} ${anyPlayed && i < 3 && p.games ? "top" : ""}">
        <td class="r">${medal}</td><td class="n">${esc(p.name)}</td>
        <td class="num hide-sm">${p.players.size}</td><td class="num hide-sm">${acc}</td><td class="num">${p.games}</td>
        <td class="num tot">${pts(p.total)}</td></tr>`;
    }).join("");
  }

  function renderSectorBoard() {
    const mine = ONLINE && profile ? mySectors() : [$("#sector").value];
    $("#board-head").innerHTML = `<tr><th></th><th>Sector</th><th class="num hide-sm">Players</th><th class="num hide-sm">Accuracy</th><th class="num">Races</th><th class="num">Points</th></tr>`;
    const list = sectorStandings(boardRange, boardRace);
    const anyPlayed = list.some(s => s.games);
    $("#board").innerHTML = list.map((p, i) => {
      const medal = anyPlayed && p.games ? (["🥇", "🥈", "🥉"][i] || `<span class="pos">${i + 1}</span>`) : `<span class="pos">–</span>`;
      const acc = p.asked ? Math.round(p.correct / p.asked * 100) + "%" : "–";
      return `<tr class="${mine.includes(p.name) ? "mine" : ""} ${anyPlayed && i < 3 && p.games ? "top" : ""}">
        <td class="r">${medal}</td><td class="n">${esc(p.name)}</td>
        <td class="num hide-sm">${p.players.size}</td><td class="num hide-sm">${acc}</td><td class="num">${p.games}</td>
        <td class="num tot">${pts(p.total)}</td></tr>`;
    }).join("");
  }

  /* ---------------- Game ---------------- */
  function start(catId) {
    const input = $("#player");
    const name = input.value.trim();
    const sector = $("#sector").value;
    const nudge = el => { el.focus(); el.classList.add("shake"); setTimeout(() => el.classList.remove("shake"), 500); };
    if (!name) return nudge(input);
    if (SECTORS.length && !sector) return nudge($("#sector"));
    if (!ONLINE) setName(name);
    setSector(sector);
    lastCat = catId;

    let pool, catName;
    if (catId === "mixed") {
      pool = CATS.flatMap(c => c.questions.map(q => ({ ...q, _cat: c.name })));
      catName = "Mixed Bag";
    } else {
      const c = CATS.find(x => x.id === catId);
      pool = c.questions.map(q => ({ ...q, _cat: c.name }));
      catName = c.name;
    }
    const n = Math.min(S.questionsPerRound, pool.length);
    const qs = shuffle(pool).slice(0, n).map(q => ({ ...q, opts: shuffle(q.options.map((t, i) => ({ t, ok: i === q.answer }))) }));
    const before = standings("all", sector);
    const pid = myPid(), k = entryKey(pid, sector);
    const meBefore = before.find(p => p.key === k);

    st = { pid, key: k, library: catId, name, sector, catName, qs, i: 0, score: 0, streak: 0, bestStreak: 0, log: [], locked: false, rankBefore: rankOf(before, k), pbBefore: meBefore ? meBefore.best : null, reqBefore: doneRace(catId) };
    $("#hud-cat").textContent = catName;
    show("game");
    renderQ();
  }

  const multiplier = streak => streak >= 5 ? 2 : streak >= 3 ? 1.5 : 1;

  function renderHud() {
    $("#hud-score").textContent = pts(st.score);
    $("#hud-q").textContent = `${st.i + 1}/${st.qs.length}`;
    const m = multiplier(st.streak);
    $("#hud-streak").textContent = st.streak ? `🔥 ${st.streak}` : "–";
    $("#hud-mult").textContent = m > 1 ? `×${m} pace` : "";
    $("#hud-mult").hidden = m === 1;
    $("#dots").innerHTML = st.qs.map((_, k) => {
      const l = st.log[k];
      return `<i class="${l ? (l.right ? "hit" : "miss") : (k === st.i ? "now" : "")}"></i>`;
    }).join("");
  }

  function renderQ() {
    const q = st.qs[st.i];
    st.locked = false;
    renderHud();
    $("#qcat").textContent = q._cat;
    $("#question").textContent = q.q;
    $("#answers").innerHTML = q.opts.map((o, k) =>
      `<button class="ans" data-k="${k}"><span class="lt">${"ABCD"[k]}</span><span>${esc(o.t)}</span></button>`).join("");
    $("#answers").querySelectorAll(".ans").forEach(b => { b.onclick = () => answer(+b.dataset.k); });
    $("#feedback").hidden = true;
    startTimer();
  }

  function startTimer() {
    clearInterval(timerId);
    const total = (+S.secondsPerQuestion || 25) * 1000;
    const t0 = performance.now();
    st.timeLeft = 1;
    const bar = $("#timebar"), txt = $("#timetxt");
    const tick = () => {
      const left = Math.max(0, total - (performance.now() - t0));
      st.timeLeft = left / total;
      bar.style.transform = `scaleX(${st.timeLeft})`;
      bar.classList.toggle("low", st.timeLeft < 0.3);
      txt.textContent = Math.ceil(left / 1000) + "s";
      if (left <= 0) { clearInterval(timerId); answer(-1); }
    };
    tick();
    timerId = setInterval(tick, 100);
  }

  function answer(k) {
    if (!st || st.locked) return;
    st.locked = true;
    clearInterval(timerId);
    const q = st.qs[st.i];
    const btns = [...$("#answers").children];
    const okK = q.opts.findIndex(o => o.ok);
    const right = k === okK;
    btns.forEach(b => { b.disabled = true; });
    btns[okK].classList.add("correct");
    if (k >= 0 && !right) btns[k].classList.add("wrong");

    let gained = 0, speed = 0, mult = 1;
    if (right) {
      st.streak++;
      st.bestStreak = Math.max(st.bestStreak, st.streak);
      mult = multiplier(st.streak);
      speed = Math.round(S.maxSpeedBonus * st.timeLeft);
      gained = Math.round((S.basePoints + speed) * mult);
      st.score += gained;
      popPoints(btns[k], gained);
    } else {
      st.streak = 0;
    }
    st.log.push({ qid: q.id, secs: Math.round((1 - st.timeLeft) * S.secondsPerQuestion * 10) / 10, timedOut: k < 0, q: q.q, chosen: k >= 0 ? q.opts[k].t : "(time ran out)", correct: q.opts[okK].t, explain: q.explain, ref: q.ref, right, gained });
    renderHud();

    const last = st.i === st.qs.length - 1;
    const fb = $("#feedback");
    fb.className = "feedback " + (right ? "good" : "bad");
    fb.innerHTML =
      `<div class="fb-head"><h3>${right ? pick(CHEERS) + " +" + pts(gained) : (k < 0 ? "Time's up — DNF" : pick(MISSES))}</h3>` +
      (right ? `<span class="break">${S.basePoints} + ${speed} sprint${mult > 1 ? ` × ${mult} pace` : ""}</span>` : `<span class="break">Streak reset</span>`) + `</div>` +
      (right ? "" : `<p>Correct answer: <b>${esc(q.opts[okK].t)}</b></p>`) +
      (q.explain ? `<p>${esc(q.explain)}</p>` : "") +
      (q.ref ? `<p class="ref">📄 ${esc(q.ref)}</p>` : "") +
      `<button class="btn go" id="next">${last ? "Cross the finish line 🏁" : "Next lap →"}</button>`;
    fb.hidden = false;
    // keep the explanation and Next button on screen without the player having to scroll
    requestAnimationFrame(() => fb.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    $("#next").onclick = () => { if (last) finish(); else { st.i++; renderQ(); } };
    $("#next").focus({ preventScroll: true });
  }

  const CHEERS = ["Strong rep!", "On pace!", "Clean lift!", "PB pace!", "Smashed it!", "Full send!"];
  const MISSES = ["Dropped the rep", "Tripped up", "Off pace", "Missed the split"];
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function popPoints(el, n) {
    const p = document.createElement("span");
    p.className = "pop"; p.textContent = "+" + pts(n);
    el.appendChild(p);
  }

  /* ---------------- Results ---------------- */
  async function finish() {
    clearInterval(timerId);
    const correct = st.log.filter(l => l.right).length;
    const nextBtn = $("#next"); if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = "Saving…"; }
    const saved = await saveGame({ pid: st.pid, name: st.name, sector: st.sector, library: st.library, category: st.catName, points: st.score, correct, asked: st.log.length, bestStreak: st.bestStreak, date: new Date().toISOString(), answers: st.log });
    if (!saved) {
      if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = "Couldn't save — try again"; }
      return;
    }

    const list = standings("all", st.sector);
    const r = rankOf(list, st.key);
    const me = list[r - 1];
    let move = "";
    const where = st.sector ? ` in ${esc(st.sector)}` : "";
    if (st.rankBefore == null) move = `You're on the${where ? " " + esc(st.sector) : ""} leaderboard at <b>#${r}</b>`;
    else if (r < st.rankBefore) move = `▲ Up ${st.rankBefore - r} place${st.rankBefore - r > 1 ? "s" : ""} to <b>#${r}</b>${where}`;
    else move = `Holding at <b>#${r}</b>${where}`;
    const above = r > 1 ? list[r - 2] : null;

    $("#r-score").textContent = pts(st.score);
    $("#r-pb").innerHTML = st.pbBefore != null && st.score > st.pbBefore
      ? `<span class="pb">🎉 New personal best! (was ${pts(st.pbBefore)})</span>` : "";
    $("#r-stats").innerHTML =
      `<div><small>Correct</small><b>${correct}/${st.log.length}</b></div>
       <div><small>Longest streak</small><b>🔥 ${st.bestStreak}</b></div>
       <div><small>Season total</small><b>${pts(me.total)}</b></div>
       <div><small>Rank</small><b>#${r}</b></div>`;
    $("#r-move").innerHTML = move + (above ? ` · <span class="chase">${pts(above.total - me.total + 1)} pts to overtake ${esc(above.name)}</span>` : ` · <span class="chase">You're top of the table! 🏆</span>`);

    if (st.sector) {
      const secs = sectorStandings("all");
      const sr = secs.findIndex(x => x.name === st.sector) + 1;
      $("#r-sector").innerHTML = `These points count for <b>${esc(st.sector)}</b> — currently <b>#${sr}</b> of ${secs.length} sectors`;
    } else $("#r-sector").textContent = "";

    const reqCat = REQUIRED.find(c => c.id === st.library);
    if (reqCat && st.reqBefore === false) $("#r-sector").innerHTML += `<br><span class="good-t">✓ ${esc(reqCat.name)} requirement completed. Thank you!</span>`;
    const missed = st.log.filter(l => !l.right);
    $("#review").innerHTML = missed.length
      ? `<h3>Training review — what you missed</h3>` + missed.map(m => `<div class="rev">
          <p class="rq">${esc(m.q)}</p>
          <p>You said: <span class="bad-t">${esc(m.chosen)}</span></p>
          <p>Correct: <span class="good-t">${esc(m.correct)}</span></p>
          ${m.explain ? `<p class="muted">${esc(m.explain)}</p>` : ""}
          ${m.ref ? `<p class="ref">📄 ${esc(m.ref)}</p>` : ""}</div>`).join("")
      : `<p class="perfect">Flawless set — every rep counted! 💪</p>`;
    show("results");
  }

  /* ---------------- Wiring ---------------- */
  $("#player").addEventListener("input", () => { renderMe(); renderBoard(); });
  $("#sector").addEventListener("change", () => { setSector($("#sector").value); renderMe(); renderBoard(); });
  $("#board-sector").addEventListener("change", () => { boardSector = $("#board-sector").value; renderBoard(); });
  $("#board-race").addEventListener("change", () => { boardRace = $("#board-race").value; renderBoard(); });
  $("#board-division").addEventListener("change", () => { boardDivision = $("#board-division").value; renderBoard(); });
  document.querySelectorAll(".tab").forEach(t => { t.onclick = () => { boardRange = t.dataset.range; renderBoard(); }; });
  document.querySelectorAll(".view").forEach(t => { t.onclick = () => { boardView = t.dataset.view; renderBoard(); }; });
  $("#again").onclick = () => start(lastCat);
  $("#home-btn").onclick = async () => { if (ONLINE) await refreshGames(); renderHome(); };
  $("#quit").onclick = () => { if (confirm("Pull out of this race? Points from this round won't count.")) { clearInterval(timerId); renderHome(); } };
  document.addEventListener("keydown", e => {
    if ($("#game").hidden || !st) return;
    if (st.locked) { if (e.key === "Enter" && $("#next")) $("#next").click(); return; }
    const k = "abcd".indexOf(e.key.toLowerCase());
    if (k >= 0) answer(k);
  });

  /* ---------------- Sign-in (online mode) ---------------- */
  /* Accounts: register once (email + password, confirmed with an emailed code),
     then sign in with email + password. Forgot password = emailed code + new password. */
  let authEmail = "";
  const siteUrl = () => location.href.split("#")[0].split("?")[0];
  const okEmail = e => e.endsWith("@" + EMAIL_DOMAIN) || ADMIN_EMAILS.includes(e);
  function say(text, cls = "muted", html = false) {
    const m = $("#login-msg");
    m[html ? "innerHTML" : "textContent"] = text; m.className = "login-msg " + cls;
  }
  function setMode(mode) {
    document.querySelectorAll("#login .auth-form").forEach(f => { f.hidden = f.dataset.mode !== mode; });
    document.querySelectorAll("#login .auth-tab").forEach(t => t.classList.toggle("on", t.dataset.mode === mode));
    document.querySelectorAll("#login .auth-email").forEach(b => { b.textContent = authEmail; });
    const form = document.querySelector(`#login .auth-form[data-mode="${mode}"]`);
    if (form) {
      if (form.email && authEmail && !form.email.value) form.email.value = authEmail;
      const first = [...form.querySelectorAll("input:not([hidden])")].find(i => !i.value);
      if (first) setTimeout(() => first.focus(), 30);
    }
  }
  function busy(form, on) { form.querySelector("button[type=submit]").disabled = on; }
  function friendly(err) {
    const m = String(err && err.message || err || "");
    if (/invalid login credentials/i.test(m)) return "Wrong email or password. First time here? Click Register. Forgot it? Click Forgot password.";
    if (/rate limit|too many/i.test(m)) return "Too many emails were sent in a short time. Please wait a few minutes and try again.";
    if (/expired|invalid.*(otp|token)|token.*(invalid|expired)/i.test(m)) return "That code is wrong or has expired. Check the latest email, or send a new code.";
    if (/password should|weak|at least/i.test(m)) return "Please choose a stronger password (at least 8 characters).";
    return m;
  }

  async function signIn(e) {
    e.preventDefault();
    const f = e.target, email = f.email.value.trim().toLowerCase(), password = f.password.value;
    if (!okEmail(email)) return say(`Use your @${EMAIL_DOMAIN} email address.`, "bad-t");
    authEmail = email; busy(f, true); say("Signing in…");
    const { error } = await db.auth.signInWithPassword({ email, password });
    busy(f, false);
    if (error && /not confirmed/i.test(error.message)) {
      await db.auth.resend({ type: "signup", email, options: { emailRedirectTo: siteUrl() } });
      setMode("code");
      return say("Your email isn't confirmed yet, so we've sent you a new code.", "good-t");
    }
    if (error) return say(friendly(error), "bad-t");
    location.reload();
  }

  async function register(e) {
    e.preventDefault();
    const f = e.target, email = f.email.value.trim().toLowerCase();
    if (!okEmail(email)) return say(`Use your @${EMAIL_DOMAIN} email address.`, "bad-t");
    if (f.password.value.length < 8) return say("The password needs at least 8 characters.", "bad-t");
    if (f.password.value !== f.password2.value) return say("The two passwords don't match.", "bad-t");
    authEmail = email; busy(f, true); say("Registering…");
    const { data, error } = await db.auth.signUp({ email, password: f.password.value, options: { emailRedirectTo: siteUrl() } });
    busy(f, false);
    if (error) return say(friendly(error), "bad-t");
    if (data.session) return location.reload();                       // email confirmation switched off
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setMode("signin");
      return say("This email is already registered. Sign in with your password, or click Forgot password.", "bad-t");
    }
    setMode("code");
    say("Check your email for the code. It can take a minute to arrive.", "good-t");
  }

  async function confirmCode(e) {
    e.preventDefault();
    const f = e.target, token = f.code.value.replace(/\s+/g, "");
    if (!token) return;
    busy(f, true); say("Checking the code…");
    let { error } = await db.auth.verifyOtp({ email: authEmail, token, type: "signup" });
    if (error) ({ error } = await db.auth.verifyOtp({ email: authEmail, token, type: "email" }));
    busy(f, false);
    if (error) return say(friendly(error), "bad-t");
    location.reload();
  }

  async function resendCode(e) {
    e.preventDefault();
    if (!authEmail) return setMode("register");
    say("Sending a new code…");
    const { error } = await db.auth.resend({ type: "signup", email: authEmail, options: { emailRedirectTo: siteUrl() } });
    say(error ? friendly(error) : "A new code is on its way.", error ? "bad-t" : "good-t");
  }

  async function forgot(e) {
    e.preventDefault();
    const f = e.target, email = f.email.value.trim().toLowerCase();
    if (!okEmail(email)) return say(`Use your @${EMAIL_DOMAIN} email address.`, "bad-t");
    authEmail = email; busy(f, true); say("Sending…");
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: siteUrl() });
    busy(f, false);
    if (error) return say(friendly(error), "bad-t");
    $("#f-reset").code.hidden = false; $("#f-reset").code.required = true; $("#f-reset .reset-intro").hidden = false;
    $("#f-reset").email.value = email;
    setMode("reset");
    say("Check your email for the code.", "good-t");
  }

  let recovering = false;   // arrived from a password-reset link instead of typing the code
  async function resetPassword(e) {
    e.preventDefault();
    const f = e.target;
    if (f.password.value.length < 8) return say("The password needs at least 8 characters.", "bad-t");
    if (f.password.value !== f.password2.value) return say("The two passwords don't match.", "bad-t");
    busy(f, true); say("Saving…");
    if (!recovering) {
      const { error } = await db.auth.verifyOtp({ email: authEmail, token: f.code.value.replace(/\s+/g, ""), type: "recovery" });
      if (error) { busy(f, false); return say(friendly(error), "bad-t"); }
    }
    const { error } = await db.auth.updateUser({ password: f.password.value });
    busy(f, false);
    if (error) return say(friendly(error), "bad-t");
    say("Password saved. Signing you in…", "good-t");
    setTimeout(() => location.reload(), 600);
  }

  function syncAll() {
    const boxes = [...document.querySelectorAll("#pf-list input")], n = boxes.filter(b => b.checked).length;
    $("#pf-all").checked = n === boxes.length;
    $("#pf-all").indeterminate = n > 0 && n < boxes.length;
  }

  // Change sectors later (name stays fixed). Past races keep the sector they were played for.
  function editSectors(e) {
    if (e) e.preventDefault();
    const mine = mySectors();
    document.querySelectorAll("#pf-list input").forEach(b => { b.checked = mine.includes(b.value); });
    syncAll();
    $("#pf-division").value = profile.division || "";
    $("#pf-title").textContent = profile.division ? "Your sectors and division" : "Choose your business division";
    $("#pf-intro").textContent = profile.division
      ? "Tick every sector you work in. Races you've already played keep the sector they were played for."
      : "We've added business divisions to the league. Please choose yours, and check your sectors.";
    $("#pf-name").value = profile.display_name; $("#pf-name").disabled = true;
    $("#pf-save").textContent = "Save";
    $("#pf-cancel-row").hidden = !profile.division; $("#pf-review").hidden = true; $("#pf-msg").textContent = "";
    show("profile");
  }

  async function saveProfile() {
    const name = $("#pf-name").value.trim();
    const sectors = [...document.querySelectorAll("#pf-list input:checked")].map(i => i.value);
    if (name.length < 2) return $("#pf-name").focus();
    const division = $("#pf-division").value;
    if (!division) { $("#pf-msg").textContent = "Choose your business division."; $("#pf-division").focus(); return; }
    if (!sectors.length) { $("#pf-msg").textContent = "Tick at least one sector."; return; }
    $("#pf-msg").textContent = "";
    $("#pf-save").disabled = true;
    if (profile) {                                   // editing sectors
      const main = sectors.includes(profile.sector) ? profile.sector : sectors[0];
      const { data, error } = await db.from("quiz_profiles").update({ sector: main, sectors, division }).eq("user_id", user.id).select().single();
      $("#pf-save").disabled = false;
      if (error || !data) { $("#pf-msg").textContent = "Couldn't save: " + (error ? error.message : "no permission (run supabase/divisions.sql)"); return; }
      profile = data;
      if (!entered) return enterGame();            // came here straight from sign-in
      await refreshGames();
      return renderHome();
    }
    const { data, error } = await db.from("quiz_profiles").insert({ user_id: user.id, display_name: name, sector: sectors[0], sectors, division }).select().single();
    $("#pf-save").disabled = false;
    if (error) { $("#pf-msg").textContent = "Couldn't save: " + error.message; return; }
    profile = data;
    await enterGame();
  }

  let entered = false;
  async function enterGame() {
    entered = true;
    $("#loading").hidden = false;
    const [, , appr] = await Promise.all([
      loadQuestionsOnline(),
      refreshGames(),
      db.rpc("quiz_is_approver")
    ]);
    isApprover = !!(appr && appr.data);
    if (isApprover) {                      // approvers: how many drafts wait in each library
      const { data } = await db.from("quiz_questions").select("library").eq("status", "draft").limit(5000);
      DRAFTS = {}; (data || []).forEach(r => { DRAFTS[r.library] = (DRAFTS[r.library] || 0) + 1; });
    }
    $("#loading").hidden = true;
    renderHome();
  }

  async function bootOnline() {
    $("#f-signin").addEventListener("submit", signIn);
    $("#f-register").addEventListener("submit", register);
    $("#f-code").addEventListener("submit", confirmCode);
    $("#f-forgot").addEventListener("submit", forgot);
    $("#f-reset").addEventListener("submit", resetPassword);
    $("#resend-code").onclick = resendCode;
    document.querySelectorAll("#login .auth-tab").forEach(t => { t.onclick = () => { say(""); setMode(t.dataset.mode); }; });
    document.querySelectorAll("#login [data-goto]").forEach(a => { a.onclick = ev => {
      ev.preventDefault(); const m = a.closest("form"); if (m && m.email) authEmail = m.email.value.trim().toLowerCase() || authEmail;
      say(""); setMode(a.dataset.goto); }; });
    db.auth.onAuthStateChange(ev => {
      if (ev !== "PASSWORD_RECOVERY") return;
      recovering = true;
      $("#f-reset").code.hidden = true; $("#f-reset").code.required = false; $("#f-reset .reset-intro").hidden = true;
      $("#loading").hidden = true; show("login"); setMode("reset");
      say("Choose a new password.", "good-t");
    });
    $("#pf-save").onclick = saveProfile;
    $("#signout").onclick = async () => { await db.auth.signOut(); location.reload(); };
    // New players start with every sector ticked; they untick the ones they don't work in.
    $("#pf-list").innerHTML = SECTORS.map(n => `<label><input type="checkbox" value="${esc(n)}" checked> ${esc(n)}</label>`).join("");
    $("#pf-all").checked = true;
    $("#pf-division").innerHTML = `<option value="">Your business division…</option>` + DIVISIONS.map(n => `<option>${esc(n)}</option>`).join("");
    const boxes = () => [...document.querySelectorAll("#pf-list input")];
    $("#pf-all").onchange = () => { boxes().forEach(b => { b.checked = $("#pf-all").checked; }); };
    $("#pf-list").onchange = syncAll;
    $("#edit-sectors").onclick = editSectors;
    $("#pf-cancel").onclick = e => { e.preventDefault(); renderHome(); };

    const { data: { session } } = await db.auth.getSession();
    if (!session) { $("#loading").hidden = true; show("login"); return setMode("signin"); }
    if (recovering || FROM_RESET_LINK) {
      recovering = true;
      $("#f-reset").code.hidden = true; $("#f-reset").code.required = false; $("#f-reset .reset-intro").hidden = true;
      $("#loading").hidden = true; show("login"); setMode("reset");
      return say("Choose a new password.", "good-t");
    }
    user = session.user;
    const { data: prof } = await db.from("quiz_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (!prof) {
      const { data: appr } = await db.rpc("quiz_is_approver");
      $("#pf-review").hidden = !appr;
      $("#loading").hidden = true; $("#pf-name").value = (user.email.split("@")[0] || "").replace(/[._-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase()); return show("profile"); }
    profile = prof;
    if (DIVISIONS.length && !prof.division) { $("#loading").hidden = true; return editSectors(); }
    await enterGame();
  }

  fillIcons();
  if (ONLINE) bootOnline();
  else { refreshGames(); $("#loading").hidden = true; renderHome(); }
})();
