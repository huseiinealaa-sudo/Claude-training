/* ============================================================
   تحدّي الإنجليزية — منهج A2 → B2
   المحرّك: التوجيه · المحتوى · الاختبارات · التكرار المتباعد
   ============================================================ */
"use strict";

const $ = s => document.querySelector(s);
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const AR = "٠١٢٣٤٥٦٧٨٩";
const n2 = n => String(n).replace(/\d/g, d => AR[+d]);
const DAY = 864e5;
const today = () => new Date().toISOString().slice(0, 10);

/* ============================================================
   ١) الحالة والتخزين
   ============================================================ */
const KEY = "en-course-v2";
const OLD = "en-a2-b2-progress-v1";

let S = {
  srs: {},      // { itemId: {box, due, seen, miss} }
  done: {},     // { "unit-01/3": {score, at} }
  tests: {},    // { "unit-01": {score, passed, at} }
  errors: [],   // [{id, q, a, unit, at}]
  streak: { last: "", count: 0, best: 0 },
  daily: { date: "", items: 0 },
  rate: 1
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const p = JSON.parse(raw); if (p && typeof p === "object") Object.assign(S, p); }
    else migrate();
  } catch (e) { /* تخزين محجوب أو تالف — نكمل بحالة نظيفة */ }
  if (!S.srs) S.srs = {};
  if (!S.errors) S.errors = [];
}
/* ننقل تقدّم النسخة الأولى بدل أن يضيع */
function migrate() {
  try {
    const old = JSON.parse(localStorage.getItem(OLD) || "null");
    if (!old || !old.known) return;
    let n = 0;
    Object.keys(old.known).forEach(id => {
      S.srs[id] = { box: 2, due: Date.now() + 3 * DAY, seen: 1, miss: 0 };
      n++;
    });
    if (n) {
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}   /* نثبّته فوراً لئلّا يضيع */
      setTimeout(() => toast("نُقل تقدّمك السابق: " + n2(n) + " عنصراً إلى نظام التكرار."), 1200);
    }
  } catch (e) {}
}
let saveT = null;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }, 150);
}

/* السلسلة اليوميّة */
function touchStreak() {
  const t = today();
  if (S.streak.last === t) return;
  const y = new Date(Date.now() - DAY).toISOString().slice(0, 10);
  S.streak.count = (S.streak.last === y) ? S.streak.count + 1 : 1;
  S.streak.last = t;
  S.streak.best = Math.max(S.streak.best || 0, S.streak.count);
  save();
}

/* ============================================================
   ٢) التكرار المتباعد
   ============================================================ */
const IVL = [0, 1, 3, 7, 16, 35, 75];          // بالأيّام
const dueNow = () => Object.keys(S.srs).filter(k => S.srs[k].due <= Date.now());

function grade(id, g) {                         // 0=أعِدها · 1=صعبة · 2=سهلة
  const c = S.srs[id] || { box: 0, seen: 0, miss: 0 };
  c.seen++;
  if (g === 0) { c.box = 0; c.miss++; c.due = Date.now() + 6e5; }
  else if (g === 1) { c.box = Math.max(1, c.box); c.due = Date.now() + Math.max(1, IVL[c.box] / 2) * DAY; }
  else { c.box = Math.min(c.box + 1, IVL.length - 1); c.due = Date.now() + IVL[c.box] * DAY; }
  S.srs[id] = c; save();
}
function seed(id) { if (!S.srs[id]) { S.srs[id] = { box: 0, due: Date.now(), seen: 0, miss: 0 }; save(); } }

/* ============================================================
   ٣) الصوت — مع معالجة قيود سفاري
   ============================================================ */
const speechOK = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
let voice = null, ready = false, keep = null;

function pickVoice() {
  if (!speechOK) return;
  const v = speechSynthesis.getVoices();
  if (!v.length) return;
  voice = v.find(x => /^en-US/i.test(x.lang) && /natural|neural|premium|enhanced|siri/i.test(x.name))
       || v.find(x => /^en-US/i.test(x.lang))
       || v.find(x => /^en/i.test(x.lang)) || null;
}
if (speechOK) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

function unlock() {
  if (ready || !speechOK) return;
  try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); ready = true; pickVoice(); } catch (e) {}
}
["touchend", "pointerdown", "keydown"].forEach(e => document.addEventListener(e, unlock, { once: true, passive: true }));

const plain = h => String(h).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function say(text, btn, rate) {
  if (!speechOK) { toast("متصفّحك لا يدعم النطق الصوتيّ.", 1); return; }
  try {
    unlock();
    speechSynthesis.cancel();
    document.querySelectorAll(".spk.on").forEach(b => b.classList.remove("on"));
    const u = new SpeechSynthesisUtterance(plain(text));
    u.lang = (voice && voice.lang) || "en-US";
    if (voice) u.voice = voice;
    u.rate = rate || S.rate || 1; u.pitch = 1;
    if (btn) {
      btn.classList.add("on");
      const off = () => btn.classList.remove("on");
      u.onend = off; u.onerror = off;
      setTimeout(off, Math.max(6000, plain(text).length * 110));
    }
    speechSynthesis.speak(u);
    clearInterval(keep);
    keep = setInterval(() => {
      if (speechSynthesis.speaking) { try { speechSynthesis.resume(); } catch (e) {} }
      else clearInterval(keep);
    }, 8000);
  } catch (e) { toast("تعذّر تشغيل الصوت.", 1); }
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    try { speechSynthesis.cancel(); } catch (e) {}
    clearInterval(keep);
    document.querySelectorAll(".spk.on").forEach(b => b.classList.remove("on"));
  }
});

const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.47 4.47 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z"/></svg>';
function spkBtn(text, cls, label, rate) {
  const b = el("button", "spk " + (cls || ""), ICON + (label ? " " + label : ""));
  b.type = "button"; b.setAttribute("aria-label", "استمع");
  b.addEventListener("click", ev => { ev.stopPropagation(); say(text, b, rate); });
  return b;
}

/* ============================================================
   ٤) تحميل المحتوى
   ============================================================ */
const cache = {};
async function get(name) {
  if (cache[name]) return cache[name];
  const r = await fetch("content/" + name + ".json", { cache: "no-cache" });
  if (!r.ok) throw new Error("تعذّر تحميل " + name);
  cache[name] = await r.json();
  return cache[name];
}
let COURSE = null;

/* ============================================================
   ٥) أدوات المقارنة
   ============================================================ */
/* نصّ المستخدم يدخل innerHTML، فلا بدّ من تهريبه */
const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const norm = s => String(s).toLowerCase()
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[.,!?;:"]/g, "").replace(/\s+/g, " ").trim();
const match = (given, accepted) => (Array.isArray(accepted) ? accepted : [accepted]).some(a => norm(a) === norm(given));

/* معرّف ثابت لكلّ عنصر قابل للمراجعة */
const itemId = (unit, d, b, i, it) => it && it.id ? it.id : unit + "/" + d + "/" + b + "/" + i;

/* ============================================================
   ٦) التوجيه
   ============================================================ */
const app = $("#app"), bar = $("#bar");
let ctx = {};

function go(h) { location.hash = h; }
function route() {
  const p = (location.hash || "#/").slice(2).split("/").filter(Boolean);
  window.scrollTo(0, 0);
  try { speechSynthesis.cancel(); } catch (e) {}
  if (!p.length) return viewHome();
  if (p[0] === "unit" && p[1]) return guard(p[1], () =>
    p[2] != null ? viewLesson(p[1], +p[2]) : viewUnit(p[1]));
  if (p[0] === "backup") return viewBackup();
  if (p[0] === "review") return viewReview();
  if (p[0] === "errors") return viewErrors();
  viewHome();
}
window.addEventListener("hashchange", route);

/* القفل يجب أن يُطبَّق هنا أيضاً، لا على البطاقة وحدها:
   من يكتب ‎#/unit/unit-20‎ في شريط العنوان يتخطّى بطاقةً مقفلة. */
async function guard(uid, show) {
  if (!COURSE) { try { COURSE = await get("course"); } catch (e) { return show(); } }
  const u = COURSE.units.find(x => x.id === uid);
  const lock = u && unitLock(u);
  if (!lock) return show();
  go("#/");
  setTimeout(() => toast(lock, 1), 260);
}

function topbar(title, sub, backTo) {
  bar.innerHTML = "";
  const w = el("div", "bar-in");
  if (backTo != null) {
    const b = el("button", "back", "→");
    b.type = "button"; b.setAttribute("aria-label", "رجوع");
    b.addEventListener("click", () => go(backTo));
    w.appendChild(b);
  }
  w.appendChild(el("div", "bar-t", "<b>" + title + "</b><span>" + (sub || "") + "</span>"));
  if (S.streak.count > 0) w.appendChild(el("span", "flame", "🔥 " + n2(S.streak.count)));
  bar.appendChild(w);
}

/* ============================================================
   ٧) الشاشة الرئيسة
   ============================================================ */
/* ------------------------------------------------------------------
   قفل التسلسل: الوحدة لا تُفتح إلّا باجتياز اختبار الوحدة التي قبلها.
   تُستثنى المثبّتة (الصوتيّات وبنك المراجعة) لأنّها مرجعٌ لا تسلسل.
   تُعيد null إن كانت مفتوحة، أو رسالةً تشرح المطلوب بالضبط.
------------------------------------------------------------------ */
function unitLock(u) {
  if (!COURSE || u.pinned || u.n <= 1) return null;
  const prev = COURSE.units.find(x => x.n === u.n - 1);
  if (!prev || prev.status !== "ready") return null;
  const t = S.tests[prev.id];
  if (t && t.passed) return null;
  const nm = n2(prev.n) + ". " + prev.title;
  return t
    ? "اجتز اختبار «" + nm + "» — نتيجتك " + n2(Math.round(t.score * 100)) + "٪ وتحتاج ٨٠٪."
    : "أنجِز وحدة «" + nm + "» واجتز اختبارها أوّلاً.";
}

function unitPct(u, data) {
  if (!data) return null;
  const tot = data.days.length;
  let d = 0;
  for (let i = 1; i <= tot; i++) if (S.done[u.id + "/" + i]) d++;
  return Math.round(d / tot * 100);
}

async function viewHome() {
  topbar("تحدّي الإنجليزية", "منهج متكامل من A2 إلى B2");
  app.innerHTML = "";
  const w = el("div", "wrap");

  if (!COURSE) { try { COURSE = await get("course"); } catch (e) { w.appendChild(el("div", "empty", '<div class="ico">📡</div><h3>تعذّر تحميل المنهج</h3><p>تأكّد من اتّصالك ثمّ أعد المحاولة.</p>')); app.appendChild(w); return; } }

  const due = dueNow().length;
  const totalDone = Object.keys(S.done).length;
  const known = Object.values(S.srs).filter(c => c.box >= 3).length;

  w.appendChild(el("div", "hero", "<h1>" + COURSE.title + "</h1><p>" + COURSE.subtitle + "</p>"));

  const st = el("div", "stats");
  st.appendChild(el("div", "stat", "<b>" + n2(totalDone) + "</b><span>درساً أنجزته</span>"));
  st.appendChild(el("div", "stat", "<b>" + n2(known) + "</b><span>عنصراً رسخ</span>"));
  st.appendChild(el("div", "stat", "<b>" + n2(S.streak.best || S.streak.count) + "</b><span>أطول سلسلة</span>"));
  w.appendChild(st);

  /* جلسة اليوم */
  const s = el("div", "session");
  s.appendChild(el("h2", "", "☀️ جلسة اليوم"));
  s.appendChild(el("p", "", "ثلاثون دقيقة: مراجعة ما استحقّ، ثمّ درس اليوم، ثمّ أخطاؤك."));
  s.appendChild(el("div", "due" + (due ? "" : " zero"), due ? "🔁 " + n2(due) + " عنصراً مستحقّاً للمراجعة" : "✓ لا مراجعات مستحقّة الآن"));
  const rb = el("button", "btn cta full", "ابدأ المراجعة (" + n2(due) + ")");
  rb.type = "button"; rb.disabled = !due;
  rb.addEventListener("click", () => go("#/review"));
  s.appendChild(rb);
  if (S.errors.length) {
    const eb = el("button", "btn full ghost", "📕 مفكّرة الأخطاء (" + n2(S.errors.length) + ")");
    eb.type = "button"; eb.style.marginTop = "10px";
    eb.addEventListener("click", () => go("#/errors"));
    s.appendChild(eb);
  }
  w.appendChild(s);

  /* الوحدات */
  for (const lv of COURSE.levels) {
    const hd = el("div", "lvl-head");
    hd.appendChild(el("span", "n", lv.n));
    hd.appendChild(el("div", "", "<b>" + lv.title + " · " + lv.cefr + "</b><span>" + lv.desc + "</span>"));
    w.appendChild(hd);

    const list = el("div", "units");
    COURSE.units.filter(u => u.level === lv.id).forEach(u => {
      const soon = u.status !== "ready";
      const lock = soon ? null : unitLock(u);
      /* الرسالة المفصّلة تظهر على الوحدة التالية مباشرةً فقط — فهي الخطوة
         الوحيدة الممكنة. وتكرارها على البقيّة يُطيل الصفحة بلا فائدة. */
      const next = lock && (() => { const pv = COURSE.units.find(x => x.n === u.n - 1); return pv && !unitLock(pv); })();
      const b = el("button", "unit" + (soon ? " soon" : "") + (lock ? " locked" : "") + (next ? " next" : "") + (u.pinned ? " pin" : ""));
      b.type = "button";
      b.appendChild(el("span", "ico", lock ? "🔒" : u.icon));
      b.appendChild(el("span", "m", "<b>" + (u.n > 0 ? n2(u.n) + ". " : "") + u.title + "</b><span>" + (next ? lock : u.grammar) + "</span>"));
      const pct = cache[u.id] ? unitPct(u, cache[u.id]) : null;
      b.appendChild(el("span", "pct", soon ? "قريباً" : lock ? "🔒" : (pct === 100 ? "✓" : pct != null ? n2(pct) + "٪" : "ابدأ")));
      if (pct === 100 && !lock) b.classList.add("done");
      if (soon) b.addEventListener("click", () => toast("هذه الوحدة قيد الإعداد — سأضيفها قريباً.", 1));
      else if (lock) b.addEventListener("click", () => toast(lock, 1));
      else b.addEventListener("click", () => go("#/unit/" + u.id));
      list.appendChild(b);
    });
    w.appendChild(list);
  }

  const bk = el("button", "btn full ghost bk-cta", "💾 نسخة تقدّمك — تصدير واستعادة");
  bk.type = "button";
  bk.addEventListener("click", () => go("#/backup"));
  w.appendChild(bk);

  w.appendChild(el("footer", "", "تقدّمك محفوظٌ على هذا الجهاز وحده. خُذ نسخةً كلّما أنجزت وحدة."));
  app.appendChild(w);

  /* نحمّل الوحدات الجاهزة بهدوء لعرض نسب التقدّم */
  COURSE.units.filter(u => u.status === "ready" && !cache[u.id]).forEach(async u => {
    try { await get(u.id); if (!location.hash || location.hash === "#/") viewHome(); } catch (e) {}
  });
}

/* ============================================================
   ٨) شاشة الوحدة
   ============================================================ */
const KIND = {
  grammar:   ["قاعدة",  "rgba(129,140,248,.15)", "rgba(129,140,248,.4)", "#a5b4fc"],
  vocab:     ["مفردات", "rgba(52,211,153,.15)",  "rgba(52,211,153,.4)",  "#34d399"],
  listening: ["استماع", "rgba(34,211,238,.15)",  "rgba(34,211,238,.4)",  "#22d3ee"],
  reading:   ["قراءة",  "rgba(251,191,36,.15)",  "rgba(251,191,36,.4)",  "#fbbf24"],
  function:  ["لغة وظيفيّة", "rgba(167,139,250,.15)", "rgba(167,139,250,.4)", "#a78bfa"],
  writing:   ["كتابة",  "rgba(244,114,182,.15)", "rgba(244,114,182,.4)", "#f472b6"],
  test:      ["اختبار", "rgba(251,113,133,.15)", "rgba(251,113,133,.4)", "#fb7185"],
  phon:      ["صوتيّات","rgba(34,211,238,.15)",  "rgba(34,211,238,.4)",  "#22d3ee"]
};

async function viewUnit(id) {
  let U; try { U = await get(id); } catch (e) { app.innerHTML = '<div class="wrap"><div class="empty"><div class="ico">📡</div><h3>تعذّر تحميل الوحدة</h3></div></div>'; return; }
  topbar(U.title, U.subtitle, "#/");
  app.innerHTML = "";
  const w = el("div", "wrap");

  const p = el("div", "panel");
  p.appendChild(el("div", "h", U.icon + " " + U.title));
  if (U.intro) p.appendChild(el("div", "sub", U.intro));
  if (U.goals) {
    const ul = el("ul", "goals");
    U.goals.forEach(g => ul.appendChild(el("li", "", g)));
    p.appendChild(ul);
  }
  w.appendChild(p);

  const days = el("div", "days");
  U.days.forEach((d, i) => {
    const key = id + "/" + d.n;
    const rec = S.done[key];
    /* اختبار الوحدة يحتاج إنجاز ما قبله */
    const locked = d.type === "test" && U.days.slice(0, i).some(x => !S.done[id + "/" + x.n]);
    const b = el("button", "day" + (rec ? " done" : "") + (locked ? " locked" : ""));
    b.type = "button";
    b.appendChild(el("span", "n", rec ? "✓" : n2(d.n)));
    b.appendChild(el("span", "m", "<b>" + d.title + "</b><span>" + (d.subtitle || "") + "</span>"));
    const k = KIND[d.type] || KIND.grammar;
    const kb = el("span", "kind", k[0]);
    kb.style.cssText = "--kb:" + k[1] + ";--kr:" + k[2] + ";--kc:" + k[3];
    b.appendChild(kb);
    if (locked) b.addEventListener("click", () => toast("أنجِز أيّام الوحدة أوّلاً ثمّ اجتز الاختبار.", 1));
    else b.addEventListener("click", () => go("#/unit/" + id + "/" + d.n));
    days.appendChild(b);
  });
  w.appendChild(days);
  app.appendChild(w);
}

/* ============================================================
   ٩) شاشة الدرس — عارض الكتل
   ============================================================ */
async function viewLesson(id, dn) {
  let U; try { U = await get(id); } catch (e) { go("#/"); return; }
  const D = U.days.find(x => x.n === dn);
  if (!D) { go("#/unit/" + id); return; }

  topbar(D.title, U.title + " · اليوم " + n2(dn), "#/unit/" + id);
  app.innerHTML = "";
  const w = el("div", "wrap");
  ctx = { unit: id, day: dn, U, D, scores: [] };

  D.blocks.forEach((b, bi) => w.appendChild(renderBlock(b, bi)));

  /* زرّ الإنهاء */
  const fin = el("div", "panel");
  const already = S.done[id + "/" + dn];
  const btn = el("button", "btn ok full", already ? "✓ أنجزتَ هذا الدرس — أعِد الدخول متى شئت" : "✓ أنهيتُ هذا الدرس");
  btn.type = "button";
  btn.addEventListener("click", () => {
    const sc = ctx.scores.length ? ctx.scores.reduce((a, b) => a + b, 0) / ctx.scores.length : 1;
    if (D.type === "test") {
      const pass = sc >= (D.pass || 0.8);
      S.tests[id] = { score: sc, passed: pass, at: Date.now() };
      if (!pass) { toast("نتيجتك " + n2(Math.round(sc * 100)) + "٪ — تحتاج " + n2(Math.round((D.pass || .8) * 100)) + "٪. راجع وأعِد المحاولة.", 1); save(); return; }
    }
    S.done[id + "/" + dn] = { score: sc, at: Date.now() };
    touchStreak(); save();
    toast("أحسنت! سُجّل إنجاز الدرس ✓");
    setTimeout(() => go("#/unit/" + id), 700);
  });
  fin.appendChild(btn);
  w.appendChild(fin);
  app.appendChild(w);
}

function renderBlock(b, bi) {
  switch (b.type) {
    case "note":     return rNote(b);
    case "examples": return rExamples(b);
    case "pron":
    case "ear":      return rPron(b);
    case "vocab":    return rVocab(b, bi);
    case "dialogue": return rDialogue(b);
    case "reading":  return rReading(b);
    case "writing":  return rWriting(b);
    case "watch":    return rWatch(b);
    case "quiz":     return rQuiz(b);
    default:         return el("div");
  }
}

function rNote(b) {
  const d = el("div", "note");
  if (b.title) d.appendChild(el("h3", "", b.title));
  d.appendChild(el("div", "", b.html));
  return d;
}

function rExamples(b) {
  const w = el("div");
  if (b.title) w.appendChild(el("div", "blk-h", b.title));
  b.rows.forEach(r => {
    const x = el("div", "ex");
    x.appendChild(spkBtn(r.en));
    const t = el("div", "tx");
    t.appendChild(el("p", "ex-en", r.en));
    t.appendChild(el("p", "ex-ar", r.ar));
    x.appendChild(t);
    w.appendChild(x);
  });
  return w;
}

function rPron(b) {
  const w = el("div");
  if (b.title) w.appendChild(el("div", "blk-h", b.title));
  if (b.hint) w.appendChild(el("div", "blk-hint", b.hint));
  b.rows.forEach(r => {
    const x = el("div", "pr");
    const L = el("div", "side"); L.appendChild(spkBtn(r.w)); L.appendChild(el("span", "w", r.w));
    x.appendChild(L);
    x.appendChild(el("span", "arw", "←"));
    const R = el("div", "side"); R.appendChild(spkBtn(r.s)); R.appendChild(el("span", "w spoken", r.s));
    x.appendChild(R);
    if (r.ar) x.appendChild(el("div", "pr-ar", r.ar));
    w.appendChild(x);
  });
  return w;
}

function rVocab(b, bi) {
  const w = el("div");
  if (b.title) w.appendChild(el("div", "blk-h", "📘 " + b.title));
  b.items.forEach((it, i) => {
    const id = itemId(ctx.unit, ctx.day, bi, i, it);
    seed(id);
    const x = el("div", "ex");
    x.appendChild(spkBtn(it.w));
    const t = el("div", "tx");
    t.appendChild(el("p", "ex-en", "<b>" + it.w + "</b> <span style='color:var(--dim);font-size:.85em;font-style:italic'>" + (it.pos || "") + "</span>"));
    t.appendChild(el("p", "ex-ar", "<b style='color:var(--emerald)'>" + it.ar + "</b>"));
    (it.ex || []).forEach(e => {
      const q = el("div", "", "");
      q.style.cssText = "margin-top:8px;padding-top:8px;border-top:1px dashed var(--stroke)";
      q.appendChild(el("p", "ex-en", e.en));
      q.appendChild(el("p", "ex-ar", e.ar));
      t.appendChild(q);
    });
    x.appendChild(t);
    w.appendChild(x);
  });
  return w;
}

function rDialogue(b) {
  const w = el("div");
  w.appendChild(el("div", "blk-h", "🎧 " + b.title + (b.titleAr ? " — " + b.titleAr : "")));

  const ctl = el("div", "dlg-ctl");
  const rate = el("div", "rate");
  [[0.7, "٠٫٧×"], [1, "١٫٠×"], [1.3, "١٫٣×"]].forEach(([v, lb]) => {
    const b2 = el("button", S.rate === v ? "on" : "", lb);
    b2.type = "button";
    b2.addEventListener("click", () => {
      S.rate = v; save();
      rate.querySelectorAll("button").forEach(x => x.classList.remove("on"));
      b2.classList.add("on");
    });
    rate.appendChild(b2);
  });
  ctl.appendChild(rate);

  const all = b.lines.map(l => l.en).join(" ");
  const play = el("button", "spk big", ICON + " استمع إلى الحوار كاملاً");
  play.type = "button";
  play.addEventListener("click", () => {
    if (play.classList.contains("on")) { try { speechSynthesis.cancel(); } catch (e) {} play.classList.remove("on"); return; }
    say(all, play);
  });
  ctl.appendChild(play);
  w.appendChild(ctl);

  b.lines.forEach(l => {
    const x = el("div", "line");
    x.appendChild(spkBtn(l.en));
    x.appendChild(el("span", "sp", l.sp));
    const t = el("div", "tx");
    t.appendChild(el("p", "dlg-en", l.en));
    t.appendChild(el("p", "dlg-ar", l.ar));
    x.appendChild(t);
    w.appendChild(x);
  });
  return w;
}

function rReading(b) {
  const w = el("div");
  w.appendChild(el("div", "blk-h", "📖 " + b.title + (b.titleAr ? " — " + b.titleAr : "")));
  const wc = plain(b.en).split(/\s+/).length;
  const bar2 = el("div", "dlg-ctl");
  bar2.appendChild(el("span", "kind", n2(wc) + " كلمة"));
  const p = el("button", "spk big", ICON + " استمع إلى النصّ");
  p.type = "button";
  p.addEventListener("click", () => {
    if (p.classList.contains("on")) { try { speechSynthesis.cancel(); } catch (e) {} p.classList.remove("on"); return; }
    say(b.en, p);
  });
  bar2.appendChild(p);
  w.appendChild(bar2);

  w.appendChild(el("div", "rd-en", b.en));
  if (b.keys) {
    const k = el("div", "keys");
    b.keys.forEach(p2 => k.appendChild(el("span", "key", '<span class="e">' + p2[0] + '</span><span class="s">—</span><span>' + p2[1] + "</span>")));
    w.appendChild(k);
  }
  if (b.ar) {
    const tg = el("button", "btn full ghost", "▾ اعرض الترجمة العربية");
    tg.type = "button";
    const ar = el("div", "rd-ar", b.ar); ar.hidden = true;
    tg.addEventListener("click", () => {
      ar.hidden = !ar.hidden;
      tg.textContent = ar.hidden ? "▾ اعرض الترجمة العربية" : "▴ أخفِ الترجمة العربية";
    });
    w.appendChild(tg); w.appendChild(el("div", "spacer")); w.appendChild(ar);
  }
  return w;
}

/* ============================================================
   ١١ب) النسخة الاحتياطيّة — تقدّمك محفوظ على هذا الجهاز وحده
   ============================================================ */
function backupBlob() {
  let writes = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf("wr:") === 0) writes[k] = localStorage.getItem(k);
    }
  } catch (e) {}
  return JSON.stringify({ app: "en-course", v: 2, at: new Date().toISOString(), state: S, writes: writes });
}

function viewBackup() {
  topbar("نسخة تقدّمك", "تصدير واستعادة", "#/");
  app.innerHTML = "";
  const w = el("div", "wrap");

  const done = Object.keys(S.done).length;
  const srs  = Object.keys(S.srs).length;
  const tst  = Object.values(S.tests || {}).filter(t => t.passed).length;

  const sum = el("div", "note");
  sum.appendChild(el("h3", "", "ما في تقدّمك الآن"));
  const g = el("div", "bk-grid");
  [["درساً أنجزته", done], ["عنصراً في التكرار", srs], ["اختباراً مجتازاً", tst],
   ["يوماً في السلسلة", S.streak.count || 0]].forEach(([t, n]) =>
    g.appendChild(el("div", "bk-s", "<b>" + n2(n) + "</b><span>" + t + "</span>")));
  sum.appendChild(g);
  sum.appendChild(el("div", "n-ar", "كلّ هذا محفوظٌ في متصفّح هذا الجهاز وحده. حذف التطبيق أو تغيير الجهاز يمحوه — ولا سبيل إلى استرجاعه إلّا من نسخةٍ أخذتها أنت."));
  w.appendChild(sum);

  /* ---- تصدير ---- */
  const ex = el("div", "note");
  ex.appendChild(el("h3", "", "١. خُذ نسخة"));
  ex.appendChild(el("div", "", "انسخ النصّ واحفظه حيث شئت — في الملاحظات، أو أرسله إلى بريدك. سطرٌ واحدٌ طويل، لا تقتطع منه شيئاً."));
  const data = backupBlob();
  const box = el("textarea", "ta bk-ta"); box.readOnly = true; box.value = data;
  ex.appendChild(box);
  const row = el("div", "bk-row");

  const cp = el("button", "btn", "📋 انسخ إلى الحافظة"); cp.type = "button";
  cp.addEventListener("click", async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(data); ok = true; }
    catch (e) { try { box.select(); box.setSelectionRange(0, 999999); ok = document.execCommand("copy"); } catch (e2) {} }
    toast(ok ? "نُسخت — الصقها في مكانٍ آمن الآن." : "تعذّر النسخ تلقائيّاً؛ حدّد النصّ وانسخه يدويّاً.", ok ? 0 : 1);
  });
  row.appendChild(cp);

  const dl = el("a", "btn ghost", "⬇︎ نزّلها ملفّاً");
  try {
    dl.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    dl.download = "تقدّمي-" + new Date().toISOString().slice(0, 10) + ".json";
  } catch (e) { dl.hidden = true; }
  row.appendChild(dl);
  ex.appendChild(row);
  w.appendChild(ex);

  /* ---- استعادة ---- */
  const im = el("div", "note");
  im.appendChild(el("h3", "", "٢. استعد نسخة"));
  im.appendChild(el("div", "", "الصق نسخةً أخذتها سابقاً. <b>ستحلّ محلّ تقدّمك الحاليّ بالكامل</b> — خُذ نسخةً من الحالي أوّلاً إن كان فيه ما يُخسَر."));
  const inp = el("textarea", "ta bk-ta"); inp.placeholder = "الصق النصّ هنا…";
  im.appendChild(inp);
  const rb = el("button", "btn full", "↩︎ استعد هذه النسخة"); rb.type = "button";
  let armed = false;
  rb.addEventListener("click", () => {
    let d;
    try { d = JSON.parse(inp.value.trim()); } catch (e) { return toast("النصّ ليس نسخةً صالحة — تأكّد أنّك نسخته كاملاً.", 1); }
    if (!d || d.app !== "en-course" || !d.state || typeof d.state !== "object" || !d.state.srs)
      return toast("هذه ليست نسخةً من هذا التطبيق.", 1);
    if (!armed) {
      armed = true;
      rb.textContent = "⚠︎ اضغط ثانيةً لتأكيد الاستبدال";
      rb.classList.add("danger");
      const n = Object.keys(d.state.done || {}).length;
      toast("النسخة سليمة (" + n2(n) + " درساً، بتاريخ " + (d.at || "").slice(0, 10) + "). اضغط ثانيةً للاستبدال.", 1);
      setTimeout(() => { if (armed) { armed = false; rb.textContent = "↩︎ استعد هذه النسخة"; rb.classList.remove("danger"); } }, 8000);
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(d.state));
      if (d.writes) Object.keys(d.writes).forEach(k => { if (k.indexOf("wr:") === 0) localStorage.setItem(k, d.writes[k]); });
    } catch (e) { return toast("تعذّرت الكتابة إلى التخزين.", 1); }
    toast("استُعيد تقدّمك — سيُعاد تحميل التطبيق.", 0);
    setTimeout(() => location.replace(location.pathname), 900);
  });
  im.appendChild(rb);
  w.appendChild(im);

  w.appendChild(el("footer", "", "خُذ نسخةً كلّما أنجزت وحدة. دقيقةٌ الآن تحمي أشهراً."));
  app.appendChild(w);
}

/* ============================================================
   ١٢) مدقّق الكتابة
   قواعدُ عالية الدقّة لأخطاء الناطقين بالعربيّة التي يعالجها المنهج.
   لا يدّعي تصحيحاً كاملاً — يلتقط ما درسته أنت بالتحديد.
   ============================================================ */
const WRULES = [
  { re: /\b(informations|evidences|researches|advices|feedbacks|knowledges|equipments|softwares|staffs|progresses)\b/gi,
    ar: "اسمٌ غير معدود لا يُجمع", fix: "information · evidence · research · advice · feedback", u: 22 },
  { re: /\b(a|an)\s+(advice|information|evidence|research|feedback|knowledge|equipment)\b/gi,
    ar: "اسمٌ غير معدود لا يسبقه a/an", fix: "some advice · a piece of advice", u: 22 },
  { re: /\b(said|says|say|saying)\s+(me|him|her|us|them)\b/gi,
    ar: "say لا تأخذ مفعولاً شخصيّاً مباشراً", fix: "told me · said to me", u: 17 },
  { re: /\bif\s+\w+(\s+\w+)?\s+would\s+have\b/gi,
    ar: "لا توضع would في شقّ if", fix: "If I had known …", u: 16 },
  { re: /\b(would|could|should|must|might)\s+of\b/gi,
    ar: "would of ليست إنجليزيّة — هي سماعُ would've", fix: "would have · could have", u: 16 },
  { re: /\bdiscuss(ed|es|ing)?\s+about\b/gi,
    ar: "discuss فعلٌ متعدٍّ بلا حرف جرّ", fix: "discuss the issue", u: 17 },
  { re: /\bexplain(ed|s|ing)?\s+(me|him|her|us|them)\b/gi,
    ar: "explain تحتاج to قبل الشخص", fix: "explain it to me", u: 20 },
  { re: /\b(am|is|are|was|were)\s+agree\b/gi,
    ar: "agree فعلٌ تامّ لا صفة", fix: "I agree · I don't agree", u: 19 },
  { re: /\bsince\s+(a|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)\s+(years?|months?|weeks?|days?|hours?|decades?)\b/gi,
    ar: "المدّة تأخذ for لا since", fix: "for two years", u: 3 },
  { re: /\bmust\s?n'?t\s+have\b/gi,
    ar: "نقيض must have هو can't have", fix: "can't have · couldn't have", u: 18 },
  { re: /\bwish\s+(I|we|you|he|she|they|it)\s+would\s+(have\s+)?\b/gi,
    ar: "wish + would لا تُستعمل عن النفس، و«would have» خطأ", fix: "I wish I knew · I wish I had gone", u: 23 },
  { re: /\b(I'?d|I\s+would)\s+rather\s+(you|he|she|they|we)\s+(don'?t|doesn'?t|do\s+not|does\s+not)\b/gi,
    ar: "I'd rather بفاعلٍ مختلف تأخذ الماضي البسيط", fix: "I'd rather you didn't", u: 23 },
  { re: /\baccording\s+to\s+(me|my\s+(opinion|view|point))\b/gi,
    ar: "according to للآخرين لا للنفس", fix: "In my view · From my point of view", u: 17 },
  { re: /\bin\s+nowadays\b/gi,
    ar: "nowadays ظرفٌ بلا حرف جرّ", fix: "Nowadays · These days", u: 22 },
  { re: /\brevert\s+back\b|\bdo\s+the\s+needful\b/gi,
    ar: "تعبيرٌ يكشف أنّك غير ناطقٍ أصليّ", fix: "get back to me · take care of it", u: 19 },
  { re: /\barrive(d|s)?\s+to\b/gi,
    ar: "arrive at لمكان، وarrive in لمدينة", fix: "arrived at the airport", u: 7 },
  { re: /\b(depend\s+of|(is|are|am|was|were)\s+depend)\b/gi,
    ar: "depend فعلٌ تامّ ويتبعه on", fix: "It depends on …", u: 22 },
  { re: /\bafford\s+to\s+(a|an|the)\b/gi,
    ar: "afford يتعدّى مباشرةً إلى الاسم", fix: "afford a new car", u: 16 },
  { re: /\bprices?\s+(is|are|was|were)\s+(very\s+|too\s+|so\s+|really\s+)?expensive\b/gi,
    ar: "السعر مرتفع، والسلعة غالية", fix: "prices are high · it is expensive", u: 16 },
  { re: /\bmore\s+(better|worse|easier|bigger|faster|higher|larger|smaller|older|younger)\b|\bmost\s+(best|worst|easiest|biggest)\b/gi,
    ar: "مقارنةٌ مضاعفة", fix: "better · the best", u: 5 },
  { re: /\bpeoples\b/gi, ar: "people جمعٌ أصلاً", fix: "people", u: 1 },
  { re: /\bI\s+(am|'m|was)\s+boring\b/gi,
    ar: "boring صفةُ الشيء المُمِلّ، وbored شعورك", fix: "I'm bored", u: 21 },
  { re: /\b(the\s+)?(film|book|novel|article|text|report)\s+(talks|talk|talked)\s+about\b/gi,
    ar: "العمل «يتناول» ولا «يتحدّث»", fix: "is about · deals with", u: 21 },
  { re: /\bit'?s\s+time\s+(we|I|you|they|he|she)\s+(go|leave|start|stop|do|make|write|take)\b/gi,
    ar: "it's time يتبعها الماضي البسيط", fix: "It's time we went", u: 23 },
  { re: /\b(proves|prove|proved)\s+that\b/gi,
    ar: "prove مبالغة في الكتابة التحليليّة", fix: "suggests · indicates · shows", u: 22 },
  { re: /\b(all|every|everyone|everybody|always|never)\s+(people|the\s+people|companies|countries)\b/gi,
    ar: "مطلقاتٌ تُفقد النصّ مصداقيّته", fix: "most · in most cases · typically", u: 22 }
];

/* يلتقط الأخطاء ويعيد لكلٍّ منها سياقَه لتراه في موضعه */
function checkWriting(text) {
  const hits = [];
  const seen = new Set();
  WRULES.forEach(r => {
    r.re.lastIndex = 0;
    let m;
    while ((m = r.re.exec(text)) !== null) {
      if (m[0] === "") { r.re.lastIndex++; continue; }
      const key = r.ar + "|" + m[0].toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const a = Math.max(0, m.index - 34), z = Math.min(text.length, m.index + m[0].length + 34);
      hits.push({
        bad: m[0], ar: r.ar, fix: r.fix, u: r.u,
        ctx: (a ? "…" : "") + text.slice(a, m.index) + "⦙" + m[0] + "⦙" +
             text.slice(m.index + m[0].length, z) + (z < text.length ? "…" : "")
      });
    }
  });
  return hits;
}

/* المدى المطلوب مكتوبٌ داخل نصّ المهمّة نفسه. وحدات المستوى الأوّل
   تكتبه بالأرقام العربيّة («٦٠–٨٠ كلمة») والثاني بالإنجليزيّة
   («120–140 words») — فنوحّد الأرقام أوّلاً ثمّ نقرأ الصيغتين. */
function wordTarget(prompt) {
  const t = String(prompt || "")
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776));
  const m = /(\d{2,3})\s*[–—‑-]\s*(\d{2,3})\s*(words|كلمة|كلمات)/i.exec(t);
  if (m) return [+m[1], +m[2]];
  const one = /\b(\d{2,3})\s*(words|كلمة|كلمات)/i.exec(t);
  if (one) { const n = +one[1]; return [Math.round(n * .9), Math.round(n * 1.1)]; }
  return null;
}

function rWriting(b) {
  const w = el("div");
  w.appendChild(el("div", "blk-h", "✍️ " + (b.title || "المهمّة")));
  w.appendChild(el("div", "wr-prompt", b.prompt));

  if (b.phrases) {
    const p = el("div", "note");
    p.appendChild(el("h3", "", "عبارات تساعدك"));
    const k = el("div", "keys");
    b.phrases.forEach(x => k.appendChild(el("span", "key", '<span class="e">' + x + "</span>")));
    p.appendChild(k);
    w.appendChild(p);
  }

  const KW = "wr:" + ctx.unit + "/" + ctx.day;
  const ta = el("textarea", "ta");
  ta.placeholder = "اكتب هنا بالإنجليزية…";
  try { ta.value = localStorage.getItem(KW) || ""; } catch (e) {}
  const cnt = el("div", "wc", "");
  const upd = () => {
    const n = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
    cnt.textContent = n + " words";
    try { localStorage.setItem(KW, ta.value); } catch (e) {}
  };
  ta.addEventListener("input", upd); upd();
  w.appendChild(ta); w.appendChild(cnt);

  /* ---- مدقّق الكتابة ---- */
  const ck = el("button", "btn full", "🔍 افحص نصّي");
  ck.type = "button";
  const out = el("div", "wchk"); out.hidden = true;
  ck.addEventListener("click", () => {
    const txt = ta.value.trim();
    out.hidden = false; out.innerHTML = "";
    if (!txt) { out.appendChild(el("div", "wc-none", "اكتب نصّك أوّلاً ثمّ افحصه.")); return; }

    const words = txt.split(/\s+/).length;
    const tgt = wordTarget(b.prompt);
    if (tgt) {
      const okLen = words >= tgt[0] && words <= tgt[1];
      out.appendChild(el("div", "wc-len " + (okLen ? "ok" : "no"),
        (okLen ? "✓ " : "△ ") + "الطول: " + n2(words) + " كلمة — المطلوب " +
        n2(tgt[0]) + "–" + n2(tgt[1]) +
        (okLen ? "" : words < tgt[0] ? " (تنقصك " + n2(tgt[0] - words) + ")" : " (زائد " + n2(words - tgt[1]) + ")")));
    }

    const hits = checkWriting(txt);
    if (!hits.length) {
      out.appendChild(el("div", "wc-none", "✓ لا خطأ من قائمة أخطاء المنهج في نصّك.<br><span>هذا لا يعني أنّه بلا خطأ — المدقّق يعرف ما درسته أنت فقط، ولا يحكم على الأسلوب ولا على المعنى.</span>"));
    } else {
      out.appendChild(el("div", "wc-h", "وجدتُ " + n2(hits.length) + (hits.length === 1 ? " ملاحظة" : hits.length === 2 ? " ملاحظتين" : " ملاحظات") + ":"));
      hits.forEach(h => {
        const it = el("div", "wc-i");
        it.appendChild(el("div", "wc-ctx", esc(h.ctx).replace(/\u2999(.+?)\u2999/, '<mark>$1</mark>')));
        it.appendChild(el("div", "wc-why", h.ar));
        it.appendChild(el("div", "wc-fix", "الصواب: <span>" + esc(h.fix) + "</span><em>الوحدة " + n2(h.u) + "</em>"));
        out.appendChild(it);
      });
    }
    out.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
  w.appendChild(ck); w.appendChild(out);

  if (b.checklist) {
    const p = el("div", "note");
    p.appendChild(el("h3", "", "قائمة التحقّق — راجع نفسك بصدق"));
    const ul = el("ul", "chk");
    b.checklist.forEach((c, i) => {
      const li = el("li", "", '<span class="bx">✓</span><span>' + c + "</span>");
      li.addEventListener("click", () => li.classList.toggle("on"));
      ul.appendChild(li);
    });
    p.appendChild(ul);
    w.appendChild(p);
  }

  if (b.model) {
    const tg = el("button", "btn full ghost", "▾ اعرض نموذج الإجابة (بعد أن تكتب!)");
    tg.type = "button";
    const box = el("div"); box.hidden = true;
    const m = el("div", "model", b.model);
    const s = spkBtn(b.model, "big", "استمع إلى النموذج");
    box.appendChild(m);
    box.appendChild(el("div", "spacer"));
    box.appendChild(s);
    if (b.modelAr) { box.appendChild(el("div", "spacer")); box.appendChild(el("div", "rd-ar", b.modelAr)); }
    tg.addEventListener("click", () => {
      box.hidden = !box.hidden;
      tg.textContent = box.hidden ? "▾ اعرض نموذج الإجابة (بعد أن تكتب!)" : "▴ أخفِ النموذج";
    });
    w.appendChild(tg); w.appendChild(el("div", "spacer")); w.appendChild(box);
  }
  return w;
}

function rWatch(b) {
  const w = el("div");
  w.appendChild(el("div", "blk-h", b.title));
  b.items.forEach(it => {
    const x = el("div", "watch");
    x.appendChild(el("b", "", it.t));
    x.appendChild(el("p", "", it.d));
    x.appendChild(el("div", "task", "📝 " + it.task));
    w.appendChild(x);
  });
  return w;
}

/* ============================================================
   ١٠) محرّك الاختبارات
   ============================================================ */
function rQuiz(b) {
  const w = el("div", "panel");
  w.appendChild(el("div", "h", (b.isTest ? "📝 " : "✏️ ") + (b.title || "تمارين")));
  const qs = b.qs;
  let i = 0, right = 0;

  const barW = el("div", "qbar", "<i></i>");
  const meta = el("div", "qmeta");
  const body = el("div");
  w.appendChild(barW); w.appendChild(meta); w.appendChild(body);

  function done() {
    const sc = right / qs.length;
    ctx.scores.push(sc);
    body.innerHTML = "";
    const r = el("div", "result");
    const pass = sc >= 0.8;
    r.appendChild(el("div", "ico", pass ? "🎉" : sc >= 0.5 ? "👍" : "📚"));
    r.appendChild(el("div", "score", n2(Math.round(sc * 100)) + "٪"));
    r.appendChild(el("p", "", "أصبتَ " + n2(right) + " من " + n2(qs.length) +
      (pass ? " — ممتاز!" : sc >= 0.5 ? " — جيّد، راجع أخطاءك." : " — أعِد الدرس ثمّ حاول ثانيةً.")));
    const again = el("button", "btn full", "🔁 أعِد التمارين");
    again.type = "button";
    again.addEventListener("click", () => { i = 0; right = 0; ctx.scores.pop(); show(); });
    r.appendChild(again);
    body.appendChild(r);
    barW.querySelector("i").style.width = "100%";
    meta.innerHTML = "<span>انتهت</span><span>" + n2(right) + " / " + n2(qs.length) + "</span>";
  }

  function next() { i++; i < qs.length ? show() : done(); }

  function show() {
    const q = qs[i];
    body.innerHTML = "";
    barW.querySelector("i").style.width = (i / qs.length * 100) + "%";
    meta.innerHTML = "<span>السؤال " + n2(i + 1) + " من " + n2(qs.length) + "</span><span>✓ " + n2(right) + "</span>";

    const qid = (ctx.unit || "q") + "/" + (ctx.day || 0) + "/q" + i;
    const fb = el("div");
    const nextBtn = el("button", "btn cta full", "التالي ←");
    nextBtn.type = "button"; nextBtn.hidden = true;
    nextBtn.addEventListener("click", next);

    function judge(ok, shownAnswer) {
      if (ok) { right++; grade(qid, 2); }
      else {
        grade(qid, 0);
        S.errors.unshift({ q: plain(q.q || q.say || ""), a: shownAnswer, unit: (ctx.U && ctx.U.title) || "", at: Date.now() });
        S.errors = S.errors.slice(0, 60);
        save();
      }
      const f = el("div", "fb " + (ok ? "good" : "bad"));
      f.appendChild(el("b", "", ok ? "✓ إجابة صحيحة" : "✗ إجابة خاطئة"));
      if (!ok && shownAnswer) f.appendChild(el("div", "", "الصواب: <span class='ans'>" + shownAnswer + "</span>"));
      if (q.why) f.appendChild(el("div", "", q.why));
      fb.appendChild(f);
      nextBtn.hidden = false;
      nextBtn.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    /* نصّ السؤال + زرّ الاستماع للإملاء */
    if (q.t === "dict" || q.t === "hear") {
      body.appendChild(el("div", "q", q.t === "dict" ? "اكتب ما تسمعه بالصورة المكتوبة الصحيحة:" : (q.q || "ماذا سمعت؟")));
      const pb = el("button", "spk big", ICON + " اضغط للاستماع");
      pb.type = "button";
      pb.addEventListener("click", () => say(q.say, pb));
      const holder = el("div", "dlg-ctl"); holder.appendChild(pb);
      const slow = el("button", "spk big", ICON + " ببطء");
      slow.type = "button";
      slow.addEventListener("click", () => say(q.say, slow, 0.65));
      holder.appendChild(slow);
      body.appendChild(holder);
      setTimeout(() => say(q.say, pb), 350);
    } else if (q.q) {
      body.appendChild(el("div", "q", q.q));
    }

    /* الأنواع */
    if (q.t === "mcq" || q.t === "hear") {
      const o = el("div", "opts");
      q.opts.forEach((txt, k) => {
        const isAr = /[؀-ۿ]/.test(txt);
        const b2 = el("button", "opt" + (isAr ? " ar-opt" : ""));
        b2.type = "button";
        b2.appendChild(el("span", "ltr", String.fromCharCode(65 + k)));
        b2.appendChild(el("span", "tx", txt));
        b2.addEventListener("click", () => {
          o.querySelectorAll(".opt").forEach(x => x.disabled = true);
          const ok = k === q.a;
          b2.classList.add(ok ? "good" : "bad");
          if (!ok) o.children[q.a].classList.add("good");
          judge(ok, q.opts[q.a]);
        });
        o.appendChild(b2);
      });
      body.appendChild(o);

    } else if (q.t === "order") {
      const pool = el("div", "words pool");
      const line = el("div", "words");
      const chosen = [];
      const shuffled = q.ws.slice().sort(() => Math.random() - .5);
      shuffled.forEach(word => {
        const b2 = el("button", "wd", word);
        b2.type = "button";
        b2.addEventListener("click", () => {
          if (b2.dataset.used) return;
          b2.dataset.used = "1"; b2.style.opacity = ".28";
          chosen.push(word);
          const c = el("button", "wd", word);
          c.type = "button";
          c.addEventListener("click", () => {
            const idx = chosen.indexOf(word);
            if (idx > -1) chosen.splice(idx, 1);
            c.remove(); b2.dataset.used = ""; b2.style.opacity = "1";
          });
          line.appendChild(c);
        });
        pool.appendChild(b2);
      });
      body.appendChild(line); body.appendChild(pool);
      const ck = el("button", "btn full", "تحقّق");
      ck.type = "button";
      ck.addEventListener("click", () => {
        ck.disabled = true;
        pool.querySelectorAll(".wd").forEach(x => x.disabled = true);
        line.querySelectorAll(".wd").forEach(x => x.disabled = true);
        judge(match(chosen.join(" "), q.a), q.a);
      });
      body.appendChild(ck);

    } else { /* gap · dict · correct */
      const inp = el("input", "inp");
      inp.type = "text"; inp.placeholder = "اكتب إجابتك بالإنجليزية…";
      inp.setAttribute("autocapitalize", "off"); inp.setAttribute("autocorrect", "off"); inp.setAttribute("spellcheck", "false");
      body.appendChild(inp);
      const ck = el("button", "btn full", "تحقّق");
      ck.type = "button";
      const run = () => {
        if (ck.disabled) return;
        ck.disabled = true; inp.disabled = true;
        const ok = match(inp.value, q.a);
        inp.classList.add(ok ? "good" : "bad");
        judge(ok, Array.isArray(q.a) ? q.a[0] : q.a);
      };
      ck.addEventListener("click", run);
      inp.addEventListener("keydown", e => { if (e.key === "Enter") run(); });
      body.appendChild(ck);
      setTimeout(() => { if (q.t !== "dict") inp.focus(); }, 120);
    }

    body.appendChild(fb);
    body.appendChild(nextBtn);
  }
  show();
  return w;
}

/* ============================================================
   ١١) المراجعة المتباعدة
   ============================================================ */
async function viewReview() {
  topbar("المراجعة المتباعدة", "ما استحقّ اليوم", "#/");
  app.innerHTML = "";
  const w = el("div", "wrap");
  app.appendChild(w);

  /* لا نحمّل المنهج كلّه: نستنتج من معرّفات المستحقّ أيّ وحداتٍ نحتاج فقط */
  if (!COURSE) COURSE = await get("course");
  const due = dueNow();
  const ready = new Set(COURSE.units.filter(x => x.status === "ready").map(x => x.id));
  const need = new Set();
  due.forEach(id => {
    const u = id.indexOf("/") > -1 ? id.slice(0, id.indexOf("/")) : "bank";
    if (ready.has(u)) need.add(u);
  });

  const index = {};
  for (const uid of need) {
    let U; try { U = await get(uid); } catch (e) { continue; }
    U.days.forEach(d => (d.blocks || []).forEach((b, bi) => {
      if (b.type !== "vocab") return;
      b.items.forEach((it, i) => { index[itemId(uid, d.n, bi, i, it)] = it; });
    }));
  }

  const queue = due.filter(id => index[id]);
  if (!queue.length) {
    w.appendChild(el("div", "empty", '<div class="ico">✅</div><h3>لا مراجعات مستحقّة</h3><p>أحسنت — عُد غداً، أو تابع درساً جديداً من الصفحة الرئيسة.</p>'));
    return;
  }

  let k = 0, done = 0;
  const meta = el("div", "qmeta");
  const barW = el("div", "qbar", "<i></i>");
  const host = el("div");
  w.appendChild(barW); w.appendChild(meta); w.appendChild(host);

  function show() {
    if (k >= queue.length) {
      host.innerHTML = "";
      const r = el("div", "result");
      r.appendChild(el("div", "ico", "🎉"));
      r.appendChild(el("h2", "", "انتهت مراجعة اليوم"));
      r.appendChild(el("p", "", "راجعتَ " + n2(done) + " عنصراً. سيعيدها التطبيق عليك في مواعيدها."));
      const b = el("button", "btn cta full", "العودة إلى الرئيسة");
      b.type = "button"; b.addEventListener("click", () => go("#/"));
      r.appendChild(b);
      host.appendChild(r);
      barW.querySelector("i").style.width = "100%";
      touchStreak();
      return;
    }
    const id = queue[k], it = index[id];
    barW.querySelector("i").style.width = (k / queue.length * 100) + "%";
    meta.innerHTML = "<span>" + n2(k + 1) + " من " + n2(queue.length) + "</span><span>صندوق " + n2((S.srs[id] || {}).box || 0) + "</span>";

    host.innerHTML = "";
    const card = el("div", "card3");
    const inn = el("div", "card3-in");

    const f = el("div", "face");
    f.appendChild(el("div", "word", it.w));
    if (it.pos) f.appendChild(el("div", "pos", it.pos));
    const sr = el("div", "dlg-ctl"); sr.style.justifyContent = "center";
    sr.appendChild(spkBtn(it.w, "big", "استمع"));
    f.appendChild(sr);
    const flipBtn = el("button", "btn full", "↺ اعرض المعنى");
    flipBtn.type = "button";
    f.appendChild(flipBtn);

    const bk = el("div", "face b");
    bk.appendChild(el("div", "tr", it.ar));
    (it.ex || []).forEach(e => {
      const x = el("div", "ex");
      x.appendChild(spkBtn(e.en));
      const t = el("div", "tx");
      t.appendChild(el("p", "ex-en", e.en));
      t.appendChild(el("p", "ex-ar", e.ar));
      x.appendChild(t);
      bk.appendChild(x);
    });

    inn.appendChild(f); inn.appendChild(bk);
    card.appendChild(inn);

    function doFlip() {
      if (card.classList.contains("flip")) return;
      card.classList.add("flip");
      gr.hidden = false;
      /* نوسّع الحاوية لتسع الوجه الخلفيّ بلا تمرير داخليّ */
      const h = bk.scrollHeight + 48;
      card.style.minHeight = h + "px";
      inn.style.minHeight = h + "px";
    }
    flipBtn.addEventListener("click", ev => { ev.stopPropagation(); doFlip(); });
    card.addEventListener("click", ev => { if (!ev.target.closest(".spk")) doFlip(); });
    host.appendChild(card);

    const gr = el("div", "grade"); gr.hidden = true;
    [[0, "أعِدها", "بعد دقائق", "g0"], [1, "صعبة", "قريباً", "g1"], [2, "سهلة", "تباعُد أطول", "g2"]].forEach(([g, lb, sub, cls]) => {
      const b = el("button", cls, lb + "<small>" + sub + "</small>");
      b.type = "button";
      b.addEventListener("click", () => { grade(id, g); done++; k++; show(); });
      gr.appendChild(b);
    });
    host.appendChild(gr);
  }
  show();
}

/* ============================================================
   ١٢) مفكّرة الأخطاء
   ============================================================ */
function viewErrors() {
  topbar("مفكّرة الأخطاء", "ما أخطأتَ فيه — راجعه", "#/");
  app.innerHTML = "";
  const w = el("div", "wrap");
  if (!S.errors.length) {
    w.appendChild(el("div", "empty", '<div class="ico">🎯</div><h3>لا أخطاء مسجّلة</h3><p>ممتاز! كلّ ما أجبتَ عنه كان صحيحاً.</p>'));
    app.appendChild(w); return;
  }
  const p = el("div", "panel");
  p.appendChild(el("div", "sub", "هذه آخر " + n2(S.errors.length) + " خطأً. اقرأها قبل النوم — دقيقتان تكفيان."));
  const clr = el("button", "btn full ghost", "🗑️ امسح المفكّرة");
  clr.type = "button";
  clr.addEventListener("click", () => {
    if (!confirm("سيُمسح سجلّ الأخطاء بالكامل. متابعة؟")) return;
    S.errors = []; save(); viewErrors();
  });
  p.appendChild(clr);
  w.appendChild(p);

  S.errors.forEach(e => {
    const x = el("div", "err-item");
    x.appendChild(el("div", "qq", e.q));
    if (e.a) x.appendChild(el("div", "aa", "✓ " + e.a));
    x.appendChild(el("div", "uu", e.unit + " · " + new Date(e.at).toLocaleDateString("ar")));
    w.appendChild(x);
  });
  app.appendChild(w);
}

/* ============================================================
   ١٣) تنبيه عائم
   ============================================================ */
let tT = null;
function toast(msg, warn) {
  const old = document.querySelector(".toast"); if (old) old.remove();
  const t = el("div", "toast" + (warn ? " warn" : ""), "");
  t.setAttribute("role", "status"); t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(tT); tT = setTimeout(() => t.remove(), 3800);
}

/* ============================================================
   ١٤) الإقلاع
   ============================================================ */
load();
route();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
