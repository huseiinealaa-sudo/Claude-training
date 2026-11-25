/* اختبار النسخة ٤: المظاهر · النقل بين الأجهزة (AirDrop) · الدمج
   الدمج هو الأخطر هنا: خطأٌ فيه يمحو تقدّماً حقيقيّاً. فنحاكي جهازين
   درسا كلٌّ على حدة، وندمج في الاتّجاهين ومرّتين، ونتحقّق ألّا يضيع شيء. */
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const U = `${BASE}/English-A2-to-B2.html`;
const ok = [], bad = []; const ck = (c, m) => (c ? ok : bad).push(m);
const errs = [];
const DAY = 864e5;
const day = n => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);

async function open(state, opts = {}) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPad Pro 11'], colorScheme: opts.scheme || 'light', acceptDownloads: true });
  await ctx.addInitScript(st => { try { if (st && !sessionStorage.getItem('__s')) { sessionStorage.setItem('__s', '1'); localStorage.setItem('en-course-v2', JSON.stringify(st)); } } catch (e) {} }, state || null);
  if (opts.share) await ctx.addInitScript(() => {
    window.__shared = [];
    navigator.canShare = d => !!(d && d.files && d.files.length);
    navigator.share = async d => { for (const f of d.files) window.__shared.push({ name: f.name, type: f.type, text: await f.text() }); };
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|fonts|Failed to load/i.test(m.text())) errs.push(m.text()); });
  return { b, ctx, p };
}
const base = extra => Object.assign({ v: 2, done: {}, srs: {}, errors: [], streak: { count: 0 }, writes: {}, rate: 1, tests: {} }, extra || {});
const state = p => p.evaluate(() => JSON.parse(localStorage.getItem('en-course-v2')));
const theme = p => p.evaluate(() => document.documentElement.getAttribute('data-theme'));
const bg = p => p.evaluate(() => getComputedStyle(document.body).backgroundColor);

/* ════ ١) المظاهر ════ */
{
  const { b, ctx, p } = await open(base(), { scheme: 'light' });
  /* المقتطف في <head> يضع المظهر قبل تحميل app.js — لا وميض */
  await p.route('**/assets/app.js', async r => { await new Promise(z => setTimeout(z, 300)); r.continue(); });
  await p.goto(U, { waitUntil: 'domcontentloaded' });
  ck(await theme(p) === 'light', 'تلقائي + جهاز فاتح ← «ورقيّ» قبل تحميل app.js (لا وميض)');
  await p.waitForTimeout(1200);
  ck(await bg(p) === 'rgb(247, 244, 238)', 'خلفية الورقيّ: ' + await bg(p));
  ck(await p.evaluate(() => document.querySelector('meta[name=theme-color]').content) === '#f7f4ee', 'لون شريط المتصفّح يتبع المظهر');
  /* الجهاز يتحوّل إلى الوضع الداكن — يتبعه التطبيق فوراً */
  await p.emulateMedia({ colorScheme: 'dark' }); await p.waitForTimeout(300);
  ck(await theme(p) === 'calm', 'تحوّل الجهاز إلى الداكن ← «ليليّ هادئ» فوراً');
  await p.emulateMedia({ colorScheme: 'light' }); await p.waitForTimeout(300);
  ck(await theme(p) === 'light', 'وعاد إلى الورقيّ مع عودة الجهاز');

  /* الإعدادات */
  await p.goto(U + '#/settings'); await p.waitForTimeout(700);
  ck(await p.locator('.th-opt').count() === 4, 'أربعة خيارات للمظهر في الإعدادات');
  ck(await p.locator('.th-opt.on[data-theme=auto]').count() === 1, 'الافتراضيّ «تلقائي»');
  await p.locator('.th-opt[data-theme=calm]').click(); await p.waitForTimeout(300);
  ck(await theme(p) === 'calm' && (await state(p)).theme === 'calm', 'اختيار «ليليّ هادئ» يُطبَّق ويُحفظ');
  await p.emulateMedia({ colorScheme: 'light' }); await p.waitForTimeout(200);
  ck(await theme(p) === 'calm', 'الاختيار اليدويّ لا يتبدّل مع مظهر الجهاز');
  await p.locator('.th-opt[data-theme=classic]').click(); await p.waitForTimeout(300);
  ck(await theme(p) === null && await bg(p) === 'rgb(30, 40, 72)', '«الكلاسيكيّ» يعيد البنفسجيّ الأوّل كما كان');
  await p.locator('.th-opt[data-theme=light]').click(); await p.waitForTimeout(200);
  await p.reload({ waitUntil: 'domcontentloaded' });
  ck(await theme(p) === 'light', 'الاختيار يبقى بعد إعادة الفتح');
  await p.waitForTimeout(800);

  /* الوضوح: تباين النصوص في المظهر الفاتح (WCAG ≥ ٤٫٥ للنصّ العاديّ) */
  const cr = await p.evaluate(() => {
    const rgb = c => { const m = c.match(/\d+(\.\d+)?/g).map(Number); return m.slice(0, 3); };
    const L = c => { const v = rgb(c).map(x => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
    const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const cs = getComputedStyle(document.documentElement);
    const v = n => { const d = document.createElement('i'); d.style.color = cs.getPropertyValue(n); document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
    const W = 'rgb(255, 255, 255)', P = 'rgb(247, 244, 238)';
    return Object.fromEntries(['--text', '--muted', '--dim', '--accent', '--emerald', '--rose', '--amber', '--violet'].map(n => [n, +Math.min(ratio(v(n), W), ratio(v(n), P)).toFixed(2)]));
  });
  const low = Object.entries(cr).filter(([, r]) => r < 4.5);
  ck(!low.length, 'كلّ ألوان النصّ في الورقيّ تباينها ≥ ٤٫٥: ' + Object.entries(cr).map(([k, r]) => k.slice(2) + ' ' + r).join(' · '));

  /* شريط الحالة: نصّ iOS فيه أبيض دائماً — المنطقة الآمنة العليا داكنة في الورقيّ */
  const barBg = await p.evaluate(() => getComputedStyle(document.querySelector('.bar')).backgroundImage);
  ck(/35, 42, 59/.test(barBg), 'رأس الصفحة في الورقيّ يبدأ بشريطٍ داكن بقدر منطقة الساعة والبطّاريّة');

  /* لا تمرير أفقيّ ولا أخطاء في الشاشات الرئيسة بالمظهرين */
  for (const th of ['light', 'calm']) {
    await p.evaluate(t => { const s = JSON.parse(localStorage.getItem('en-course-v2')); s.theme = t; localStorage.setItem('en-course-v2', JSON.stringify(s)); }, th);
    for (const r of ['#/', '#/unit/unit-01', '#/unit/unit-01/3', '#/settings', '#/backup']) {
      await p.goto(U + r); await p.reload(); await p.waitForTimeout(700);
      const m = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (m > 2) bad.push(`تمرير أفقيّ في ${th} ${r}`);
    }
  }
  ck(true, 'الشاشات الرئيسة بالمظهرين بلا تمرير أفقيّ');
  ck(errs.length === 0, 'لا أخطاء JS' + (errs.length ? ' :: ' + errs.slice(0, 2).join(' | ') : ''));
  await b.close();
}

/* ════ ٢) الدمج: قواعده واحدةً واحدة ════ */
{
  const { b, p } = await open(base());
  await p.goto(U); await p.waitForTimeout(900);
  const R = await p.evaluate(([d0, d1, d2, d5, d6]) => {
    const now = Date.now();
    const iPad = {
      done: { 'unit-01/1': { score: 1, at: 1 }, 'unit-01/2': { score: .7, at: 2 } },
      tests: { 'unit-01': { score: .6, passed: false, at: 1 } },
      srs: { a: { box: 3, due: now + 9e8, seen: 5, miss: 0 }, b: { box: 1, due: now, seen: 1, miss: 0 } },
      mine: { coffee: { w: 'coffee', ar: '', ctx: 'x', at: 1 } },
      errors: [{ q: 'q1', a: 'a1', at: 10 }],
      streak: { last: d1, count: 3, best: 3 },      // درس على الآيباد أمس وما قبله
      log: { [d1]: { sec: 1200, les: 1, rev: 3 } }, voices: { f: 'IPAD-VOICE', m: '', main: 'f' }, theme: 'light', goal: 30
    };
    const iPhone = {
      done: { 'unit-01/2': { score: .9, at: 5 }, 'unit-01/3': { score: 1, at: 6 } },
      tests: { 'unit-01': { score: .85, passed: true, at: 7 } },
      srs: { a: { box: 1, due: now, seen: 2, miss: 1 }, b: { box: 2, due: now + 3e8, seen: 3, miss: 0 }, c: { box: 0, due: now, seen: 0, miss: 0 } },
      mine: { coffee: { w: 'coffee', ar: 'قهوة', ctx: 'y', at: 2 }, train: { w: 'train', ar: 'قطار', ctx: 'z', at: 3 } },
      errors: [{ q: 'q1', a: 'a1', at: 10 }, { q: 'q2', a: 'a2', at: 20 }],
      streak: { last: d0, count: 1, best: 1 },      // ثمّ أكمل على الآيفون اليوم
      log: { [d1]: { sec: 300, les: 0, rev: 9 }, [d0]: { sec: 900, les: 1, rev: 2 } }, voices: { f: 'IPHONE-VOICE', m: '', main: 'm' }, theme: 'calm', goal: 10
    };
    const clone = o => JSON.parse(JSON.stringify(o));
    const fill = o => Object.assign({ done: {}, tests: {}, srs: {}, mine: {}, errors: [], streak: {}, log: {} }, o);
    const A = fill(clone(iPad));
    const r1 = mergeState(A, clone(iPhone));
    const snap1 = JSON.stringify(A);
    const r2 = mergeState(A, clone(iPhone));                 // الملفّ نفسه مرّةً ثانية
    const B = fill(clone(iPhone));
    mergeState(B, clone(iPad));                               // الاتّجاه المعاكس
    const canon = x => Array.isArray(x) ? '[' + x.map(canon).join(',') + ']' : x && typeof x === 'object' ? '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}' : JSON.stringify(x);
    const strip = o => canon({ done: o.done, tests: o.tests, srs: o.srs, mine: o.mine, errors: o.errors, streak: o.streak, log: o.log });
    /* سلسلتان منفصلتان بفجوة: لا تُوصلان */
    const G = fill({ streak: { last: d6, count: 2, best: 2 } });
    mergeState(G, { streak: { last: d0, count: 1, best: 1 } });
    /* سلسلتان متداخلتان */
    const O = fill({ streak: { last: d1, count: 4, best: 4 } });
    mergeState(O, { streak: { last: d0, count: 3, best: 3 } });
    return { A, r1, r2, same: JSON.stringify(A) === snap1, sym: strip(A) === strip(B), G: G.streak, O: O.streak };
  }, [day(0), day(1), day(2), day(5), day(6)]);
  const A = R.A;
  ck(Object.keys(A.done).length === 3, 'الدروس: اتّحاد الجهازين (١ و٢ و٣)');
  ck(A.done['unit-01/2'].score === .9, 'الدرس الموجود في الجهازين يأخذ الدرجة الأعلى');
  ck(A.tests['unit-01'].passed === true, 'الاختبار المجتاز على الآيفون يغلب الراسب على الآيباد');
  ck(A.srs.a.seen === 5 && A.srs.a.box === 3, 'بطاقة رُوجعت أكثر على الآيباد تبقى كما هي');
  ck(A.srs.b.seen === 3 && A.srs.b.box === 2, 'بطاقة رُوجعت أكثر على الآيفون تُؤخذ منه');
  ck(!!A.srs.c, 'بطاقةٌ جديدة من الآيفون تُضاف');
  ck(A.mine.coffee.ar === 'قهوة' && A.mine.train, 'مفرداتي: اتّحاد، والكلمة ذات المعنى تغلب الفارغة');
  ck(A.errors.length === 2 && A.errors[0].q === 'q2', 'المفكّرة: اتّحادٌ بلا تكرار، الأحدث أوّلاً');
  ck(A.streak.count === 4 && A.streak.last === day(0), 'السلسلة: ٣ أيّام على الآيباد + اليوم على الآيفون = ٤ (' + A.streak.count + ')');
  ck(R.G.count === 1 && R.G.best === 2, 'سلسلتان بينهما فجوة لا تُوصلان، ويبقى أفضل رقم');
  ck(R.O.count === 5, 'سلسلتان متداخلتان (٤ أيّام حتى أمس + ٣ حتى اليوم) = ٥ أيّام متّصلة، لا ٧ (' + R.O.count + ')');
  ck(A.log[day(1)].sec === 1200 && A.log[day(1)].rev === 9 && A.log[day(0)].sec === 900, 'سجلّ الأيّام: الأكبر في كلّ يوم');
  ck(A.voices.f === 'IPAD-VOICE' && A.theme === 'light' && A.goal === 30, 'إعدادات الجهاز (الأصوات، المظهر، الهدف) لا تُنقل');
  ck(R.r1.les === 1 && R.r1.tst === 1 && R.r1.words === 1, 'ملخّص الدمج يعدّ الجديد فقط');
  ck(R.same && !R.r2.les && !R.r2.srs && !R.r2.words && !R.r2.err, 'دمج الملفّ نفسه مرّتين لا يغيّر شيئاً');
  ck(R.sym, 'النتيجة واحدة في الاتّجاهين (آيباد←آيفون = آيفون←آيباد)');
  await b.close();
}

/* ════ ٣) الرحلة كاملةً: إرسالٌ من جهاز ودمجٌ في آخر ════ */
{
  const k = 'wr:unit-01/6';
  /* الجهاز الأوّل (الآيباد) — يرسل */
  const ipadState = base({ done: { 'unit-01/1': { score: 1, at: 1 }, 'unit-01/2': { score: 1, at: 2 } }, srs: { 'unit-01/v/routine': { box: 2, due: Date.now() + 1e9, seen: 4, miss: 0 } }, streak: { last: day(0), count: 2, best: 2 }, mine: { routine: { w: 'routine', ar: 'روتين', ctx: '', at: 1 } } });
  const A = await open(ipadState, { share: true });
  await A.p.goto(U); await A.p.waitForTimeout(600);
  await A.p.evaluate(k => localStorage.setItem(k, 'My morning routine starts at six.'), k);
  await A.p.goto(U + '#/backup'); await A.p.waitForTimeout(700);
  ck(await A.p.locator('.xfer').isVisible(), 'قسم «انقل تقدّمك إلى جهازك الآخر» ظاهر');
  await A.p.locator('.xfer-send').click(); await A.p.waitForTimeout(500);
  const sh = await A.p.evaluate(() => window.__shared);
  ck(sh.length === 1 && /^english-progress-\d{4}-\d\d-\d\d\.json$/.test(sh[0].name) && sh[0].type === 'application/json', '«أرسل تقدّمي» يفتح المشاركة بملفّ: ' + (sh[0] && sh[0].name));
  const file = sh[0].text;
  ck(JSON.parse(file).writes[k], 'الملفّ يحمل مسوّدات الكتابة أيضاً');
  await A.b.close();

  /* بلا مشاركة ملفّات (متصفّحٌ قديم) ← يُنزَّل ملفّاً */
  const C = await open(ipadState);
  await C.p.goto(U + '#/backup'); await C.p.waitForTimeout(700);
  await C.p.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });
  const [dl] = await Promise.all([C.p.waitForEvent('download', { timeout: 5000 }).catch(() => null), C.p.locator('.xfer-send').click()]);
  ck(dl && /\.json$/.test(dl.suggestedFilename()), 'بلا مشاركة ملفّات: يُنزَّل الملفّ بدلاً منها');
  await C.b.close();

  /* الجهاز الثاني (الآيفون) — عنده تقدّمٌ خاصّ، يدمج */
  const iphoneState = base({ done: { 'unit-01/3': { score: 1, at: 9 } }, srs: { 'unit-01/v/routine': { box: 1, due: Date.now(), seen: 1, miss: 0 } }, streak: { last: day(0), count: 1, best: 1 }, theme: 'calm' });
  const B = await open(iphoneState);
  await B.p.goto(U + '#/backup'); await B.p.waitForTimeout(700);
  fs.writeFileSync('/tmp/__progress.json', file);
  await B.p.locator('.xfer-file').setInputFiles('/tmp/__progress.json');
  await B.p.waitForTimeout(700);
  const toastT = await B.p.locator('.toast').last().innerText().catch(() => '');
  ck(/دُمج تقدّمك/.test(toastT) && /٢ درساً/.test(toastT), 'الدمج يخبرك بما أُضيف: ' + toastT);
  let st = await state(B.p);
  ck(Object.keys(st.done).length === 3, 'الآيفون صار يعرف دروس الجهازين (٣)');
  ck(st.srs['unit-01/v/routine'].seen === 4, 'وبطاقة المراجعة أخذت تاريخ الآيباد الأطول');
  ck(st.mine.routine && st.theme === 'calm', 'ومفرداتي انتقلت، والمظهر بقي «ليليّ هادئ» الخاصّ بالآيفون');
  ck(await B.p.evaluate(k => localStorage.getItem(k), k) === 'My morning routine starts at six.', 'ومسوّدة الكتابة انتقلت');
  ck(/٣/.test(await B.p.locator('.bk-s').first().innerText()), 'ملخّص الشاشة يتحدّث بعد الدمج');
  /* مرّةً ثانية بالملفّ نفسه */
  await B.p.locator('.xfer-file').setInputFiles('/tmp/__progress.json'); await B.p.waitForTimeout(700);
  ck(/لا جديد/.test(await B.p.locator('.toast').last().innerText().catch(() => '')), 'الملفّ نفسه مرّةً ثانية: «لا جديد»');
  const st2 = await state(B.p);
  ck(JSON.stringify([st2.done, st2.srs, st2.mine, st2.tests]) === JSON.stringify([st.done, st.srs, st.mine, st.tests]), 'ولا يتغيّر شيء');
  /* دمج بالنصّ الملصوق */
  await B.p.locator('.bk-ta').nth(1).fill(file.replace('"unit-01/2"', '"unit-02/1"'));
  await B.p.locator('.bk-merge').click(); await B.p.waitForTimeout(600);
  st = await state(B.p);
  ck(!!st.done['unit-02/1'] && Object.keys(st.done).length === 4, 'زرّ «ادمج هذا النصّ» يدمج المنسوخ عبر الحافظة');
  /* ملفّات غير صالحة */
  fs.writeFileSync('/tmp/__bad.json', '{"hello":1}');
  await B.p.locator('.xfer-file').setInputFiles('/tmp/__bad.json'); await B.p.waitForTimeout(500);
  ck(/ليست نسخةً/.test(await B.p.locator('.toast').last().innerText().catch(() => '')), 'ملفٌّ ليس من التطبيق يُرفض');
  ck(Object.keys((await state(B.p)).done).length === 4, 'ولا يمسّ التقدّم');
  ck(errs.length === 0, 'لا أخطاء JS' + (errs.length ? ' :: ' + errs.slice(0, 2).join(' | ') : ''));
  await B.b.close();
}

console.log('\n===== اختبار النسخة ٤ =====');
ok.forEach(m => console.log('  ✔ ' + m));
if (bad.length) { console.log('\n  ✘ إخفاقات:'); bad.forEach(m => console.log('  ✘ ' + m)); }
console.log('\nالمجموع: ' + ok.length + ' ناجح، ' + bad.length + ' فاشل');
process.exit(bad.length ? 1 : 0);
