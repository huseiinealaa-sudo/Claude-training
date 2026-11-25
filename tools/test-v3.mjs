/* اختبار ميزات النسخة ٣: الأصوات · أوضاع الحوار · فحص النطق · مفرداتي · التخطّي · الهدف · الإعدادات
   محرّك النطق والتعرّف على الكلام مُحاكى: نعطي الصفحة قائمة أصواتٍ كالتي في آيباد،
   ونسجّل كلّ جملةٍ تُنطق وبأيّ صوتٍ وطبقة — فنتحقّق ممّا سيسمعه المستخدم فعلاً. */
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const U = `${BASE}/English-A2-to-B2.html`;
const ok = [], bad = []; const ck = (c, m) => (c ? ok : bad).push(m);
const errs = [];

const IPAD_VOICES = [
  { name: 'Samantha', lang: 'en-US', voiceURI: 'com.apple.voice.compact.en-US.Samantha' },
  { name: 'Bells', lang: 'en-US', voiceURI: 'com.apple.speech.synthesis.voice.Bells' },
  { name: 'Fred', lang: 'en-US', voiceURI: 'com.apple.speech.synthesis.voice.Fred' },
  { name: 'Aaron', lang: 'en-US', voiceURI: 'com.apple.ttsbundle.siri_Aaron_en-US_compact' },
  { name: 'Nicky', lang: 'en-US', voiceURI: 'com.apple.ttsbundle.siri_Nicky_en-US_compact' },
  { name: 'Daniel', lang: 'en-GB', voiceURI: 'com.apple.voice.compact.en-GB.Daniel' },
  { name: 'Majed', lang: 'ar-001', voiceURI: 'com.apple.voice.compact.ar-001.Maged' },
];

function stub(voices) {
  return ([V]) => {
    window.__spoken = [];
    const ss = {
      speaking: false, paused: false, pending: false, _cur: null, onvoiceschanged: null,
      getVoices() { return V; },
      speak(u) {
        this.speaking = true; this._cur = u;
        if (String(u.text).trim()) window.__spoken.push({ text: u.text, voice: u.voice && u.voice.name, pitch: u.pitch, rate: u.rate });
        const me = this;
        u._t = setTimeout(() => { if (me._cur === u) { me._cur = null; me.speaking = false; } u.onend && u.onend({}); }, 90);
      },
      cancel() { const u = this._cur; this._cur = null; this.speaking = false; if (u) { clearTimeout(u._t); u.onerror && u.onerror({ error: 'canceled' }); } },
      resume() {}, pause() {}
    };
    Object.defineProperty(window, 'speechSynthesis', { value: ss, configurable: true });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; this.lang = ''; this.voice = null; this.rate = 1; this.pitch = 1; this.volume = 1; };
    window.__heard = '';
    window.webkitSpeechRecognition = function () {
      const r = this;
      r.start = () => setTimeout(() => { r.onresult && r.onresult({ results: [[{ transcript: window.__heard }]] }); r.onend && r.onend(); }, 60);
      r.abort = () => { r.onerror && r.onerror({ error: 'aborted' }); r.onend && r.onend(); };
    };
    window.SpeechRecognition = window.webkitSpeechRecognition;   // كروميوم الحديث فيه النسخة غير المسبوقة أيضاً
  };
}

async function open(state, voices = IPAD_VOICES) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(stub(voices), [voices]);
  await ctx.addInitScript(st => { try { if (!sessionStorage.getItem('__s')) { sessionStorage.setItem('__s', '1'); localStorage.setItem('en-course-v2', JSON.stringify(st)); } } catch (e) {} }, state);
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|fonts|Failed to load/i.test(m.text())) errs.push(m.text()); });
  return { b, p };
}
const base = extra => Object.assign({ v: 2, done: {}, srs: {}, errors: [], streak: { count: 0 }, writes: {}, rate: 1, tests: {} }, extra || {});
const spoken = p => p.evaluate(() => window.__spoken.slice());
const state = p => p.evaluate(() => JSON.parse(localStorage.getItem('en-course-v2')));
const until = async (p, fn, ms = 12000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn)) return true; await p.waitForTimeout(100); } return false; };

/* ════ ١) الحوار كاملاً: صوتان مختلفان، سطراً سطراً ════ */
{
  const { b, p } = await open(base());
  await p.goto(U + '#/unit/unit-01/3'); await p.waitForTimeout(1200);
  const n = await p.locator('.line').count();
  ck(n === 14, 'أسطر الحوار = ' + n);
  ck(await p.locator('.line.g-f').count() > 0 && await p.locator('.line.g-m').count() > 0, 'كلّ سطرٍ موسوم بجنس متكلّمه (Maya امرأة · Omar رجل)');

  /* الزرّ الكبير لا يفيض نصّه خارج إطاره (الخلل الظاهر في لقطة الآيباد) */
  const fit = await p.locator('.play-all').evaluate(e => { const r = e.getBoundingClientRect(), s = e.querySelector('span').getBoundingClientRect(); return s.top >= r.top - 1 && s.bottom <= r.bottom + 1 && s.left >= r.left - 1 && s.right <= r.right + 1; });
  ck(fit, 'نصّ «استمع إلى الحوار كاملاً» داخل إطار الزرّ');

  await p.evaluate(() => { window.__spoken = []; });   // سؤال الاستماع في الدرس ينطق تلقائيّاً عند فتحه
  await p.locator('.play-all').click();
  await p.waitForTimeout(400);
  ck(await p.locator('.line.play').count() === 1, 'السطر الجاري مُبرَز أثناء التشغيل');
  ck((await p.locator('.play-all').innerText()).includes('أوقف'), 'الزرّ يتحوّل إلى «أوقف» أثناء التشغيل');
  await until(p, () => window.__spoken.length >= 14 && !document.querySelector('.line.play'));
  const sp = await spoken(p);
  ck(sp.length === 14, 'نُطق الحوار ١٤ جملةً منفصلة لا نصّاً واحداً (' + sp.length + ')');
  const lines = await p.evaluate(() => [...document.querySelectorAll('.line .sp')].map(x => x.textContent));
  const vMaya = new Set(sp.filter((_, i) => lines[i] === 'Maya').map(x => x.voice));
  const vOmar = new Set(sp.filter((_, i) => lines[i] === 'Omar').map(x => x.voice));
  ck(vMaya.size === 1 && vMaya.has('Samantha'), 'Maya بصوت امرأة ثابت: ' + [...vMaya]);
  ck(vOmar.size === 1 && vOmar.has('Aaron'), 'Omar بصوت رجل ثابت: ' + [...vOmar]);
  ck(!sp.some(x => /Bells|Majed/.test(x.voice || '')), 'لا يُستعمل صوتٌ هزليّ ولا صوتٌ غير إنجليزيّ');
  ck(sp.every(x => x.rate === 1), 'السرعة المختارة تُطبَّق على كلّ سطر');

  /* الإيقاف */
  await p.evaluate(() => { window.__spoken = []; });
  await p.locator('.play-all').click(); await p.waitForTimeout(600);
  await p.locator('.play-all').click(); await p.waitForTimeout(900);
  const c1 = (await spoken(p)).length; await p.waitForTimeout(900);
  ck(c1 > 0 && (await spoken(p)).length === c1 && !(await p.locator('.line.play').count()), 'الضغط ثانيةً يوقف التشغيل فعلاً');

  /* زرّ السطر بصوت متكلّمه */
  await p.evaluate(() => { window.__spoken = []; });
  await p.locator('.line.g-m .spk').first().click(); await p.waitForTimeout(250);
  ck((await spoken(p))[0]?.voice === 'Aaron', 'زرّ سطر Omar ينطقه بصوت Omar');

  /* السرعة ٠٫٧ */
  await p.locator('.rate button').first().click();
  await p.evaluate(() => { window.__spoken = []; });
  await p.locator('.line.g-f .spk').first().click(); await p.waitForTimeout(250);
  ck((await spoken(p))[0]?.rate === 0.7, 'زرّ السطر يتبع السرعة ٠٫٧×');

  /* ════ ٢) الترديد ════ */
  await p.evaluate(() => { window.__spoken = []; });
  await p.locator('.shadow-b').click();
  ck(await until(p, () => !!document.querySelector('.line.shad'), 4000), 'وضع الترديد: يصمت بعد السطر ويُظهر «ردّد»');
  const gap = await p.locator('.line.shad').first().evaluate(e => parseInt(getComputedStyle(e).getPropertyValue('--gap')));
  ck(gap >= 1500, 'مهلة الترديد على قدر الجملة (' + gap + 'ms)');
  const nAtShad = (await spoken(p)).length;
  await p.waitForTimeout(500);
  ck((await spoken(p)).length === nAtShad, 'لا يُنطق السطر التالي أثناء مهلة الترديد');
  await p.locator('.shadow-b').click(); await p.waitForTimeout(300);
  ck(!(await p.locator('.line.shad').count()), 'إيقاف الترديد ينظّف السطر');

  /* ════ ٣) تمثيل الأدوار ════ */
  await p.evaluate(() => { window.__spoken = []; });
  await p.locator('.role-b', { hasText: 'Omar' }).click();
  ck(await until(p, () => !!document.querySelector('.turn-box'), 5000), 'تمثيل دور Omar: يتوقّف عند سطرك ويطلب منك قوله');
  const sp2 = await spoken(p);
  ck(sp2.length === 1 && sp2[0].voice === 'Samantha', 'التطبيق نطق سطر Maya وحده قبل دورك');
  const blurEn = await p.locator('.line.turn .dlg-en').evaluate(e => getComputedStyle(e).filter);
  const blurAr = await p.locator('.line.turn .dlg-ar').evaluate(e => getComputedStyle(e).filter);
  ck(/blur/.test(blurEn) && !/blur/.test(blurAr), 'في دورك: الإنجليزيّة مخفيّة والمعنى العربيّ ظاهر');
  ck(await p.locator('.turn-box .mic.big').count() === 1, 'زرّ «انطقها وافحص» داخل دورك');
  await p.evaluate(() => { window.__heard = "that's right I'm Omar nice to meet you"; });
  await p.locator('.turn-box .mic.big').click(); await p.waitForTimeout(400);
  ck(await p.locator('.line.turn .pc-sc.good').count() === 1, 'فحص النطق داخل الدور يعمل دون أن يقطع الحوار');
  await p.locator('.turn-ok').click();
  ck(await until(p, () => window.__spoken.length >= 2, 3000), 'بعد «قلتُها» يتابع التطبيق دور Maya');
  ck(await p.locator('.line.rev').count() >= 1, 'وتنكشف جملتك لتقارن');
  await p.locator('.role-b', { hasText: 'Omar' }).click(); await p.waitForTimeout(300);
  ck(!(await p.locator('.turn-box').count()), 'الضغط ثانيةً على الدور يوقفه');

  /* ════ ٤) الاستماع الأعمى ════ */
  await p.locator('.seg.vis button', { hasText: 'مخفيّ' }).click(); await p.waitForTimeout(300);
  ck(await p.locator('.dlg.show2').count() === 1, 'وضع «مخفيّ» مفعَّل');
  const fl = await p.locator('.line .dlg-en').first().evaluate(e => getComputedStyle(e).filter);
  ck(/blur/.test(fl), 'النصّ الإنجليزيّ مضبَّب');
  await p.locator('.line .tx').first().click(); await p.waitForTimeout(350);
  ck(await p.locator('.line').first().evaluate(e => e.classList.contains('rev')), 'لمس السطر يكشفه');
  ck(!(await p.locator('.sheet').count()), 'اللمسة الأولى تكشف ولا تفتح ورقة الكلمة');
  ck((await state(p)).show === 2, 'حُفظ اختيار الظهور');
  await p.reload(); await p.waitForTimeout(1000);
  ck(await p.locator('.dlg.show2').count() === 1, 'ويبقى بعد إعادة التحميل');
  await p.locator('.seg.vis button', { hasText: 'بلا ترجمة' }).click(); await p.waitForTimeout(300);
  const fa = await p.locator('.line .dlg-ar').first().evaluate(e => getComputedStyle(e).filter);
  const fe = await p.locator('.line .dlg-en').first().evaluate(e => getComputedStyle(e).filter);
  ck(/blur/.test(fa) && !/blur/.test(fe), '«بلا ترجمة»: العربيّة مخفيّة والإنجليزيّة ظاهرة');

  /* ════ ٥) فحص النطق على سطر ════ */
  await p.evaluate(() => { window.__heard = 'hi you must be the designer'; });
  await p.locator('.line .mic').first().click(); await p.waitForTimeout(400);
  const miss = await p.locator('.line .pc-w .miss').allInnerTexts();
  ck(miss.length >= 2 && miss.some(x => /new/i.test(x)), 'يبرز الكلمات التي لم يلتقطها: ' + miss.join(' '));
  const pr = await p.evaluate(() => [
    pronScore("I'm just setting up my computer. It's taking forever.", "I am just setting up my computer it is taking forever").score,
    pronScore("Do you usually get in this early?", "do you usually get in this early").score,
    pronScore("We have 2 cats.", "we have two cats").score,
    pronScore("Hi! You must be the new designer.", "hello").score]);
  ck(pr[0] === 1 && pr[1] === 1 && pr[2] === 1, 'المطابقة تتسامح مع الاختصارات والترقيم والأرقام');
  ck(pr[3] < 0.3, 'وتكشف الجملة الخاطئة (' + pr[3].toFixed(2) + ')');

  /* أمثلة الدروس فيها 🎤 أيضاً */
  await p.goto(U + '#/unit/unit-01/1'); await p.waitForTimeout(900);
  ck(await p.locator('.ex .mic').count() > 0, 'جمل الأمثلة فيها زرّ فحص النطق');

  ck(errs.length === 0, 'لا أخطاء JS' + (errs.length ? ' :: ' + errs.slice(0, 2).join(' | ') : ''));
  await b.close();
}

/* ════ ٦) جهازٌ بلا صوت رجل: يتميّز المتكلّمان بالطبقة ════ */
{
  const { b, p } = await open(base(), [{ name: 'Samantha', lang: 'en-US', voiceURI: 'S' }]);
  await p.goto(U + '#/unit/unit-01/3'); await p.waitForTimeout(1000);
  await p.evaluate(() => { window.__spoken = []; });
  await p.locator('.line.g-m .spk').first().click(); await p.waitForTimeout(200);
  await p.locator('.line.g-f .spk').first().click(); await p.waitForTimeout(200);
  const s = await spoken(p);
  ck(s[0]?.pitch < 0.9 && s[1]?.pitch === 1, 'بلا صوت رجل: Omar بطبقةٍ أخفض (' + s[0]?.pitch + ') وMaya عاديّة');
  await p.goto(U + '#/settings'); await p.waitForTimeout(800);
  ck(await p.locator('.vwarn').count() === 1, 'الإعدادات تنبّه إلى غياب صوت الرجل وتشرح الحلّ');
  await b.close();
}

/* ════ ٧) الأدوار العامّة تأخذ جنساً مخالفاً لمحاورها ════ */
{
  const { b, p } = await open(base());
  await p.goto(U + '#/'); await p.waitForTimeout(600);
  const r = await p.evaluate(() => {
    const c1 = castVoices([{ sp: 'Tariq' }, { sp: 'Doctor' }]);
    const c2 = castVoices([{ sp: 'Layla' }, { sp: 'Agent' }]);
    const c3 = castVoices([{ sp: 'Chair' }, { sp: 'Resident' }, { sp: 'Resident 2' }]);
    const c4 = castVoices([{ sp: 'Karim' }, { sp: 'Sami' }, { sp: 'Rana' }]);
    return [c1.Doctor.g, c2.Agent.g, c3.Chair.g !== c3.Resident.g,
      c4.Karim.v && c4.Sami.v && (c4.Karim.v.name !== c4.Sami.v.name || c4.Karim.pitch !== c4.Sami.pitch)];
  });
  ck(r[0] === 'f' && r[1] === 'm', 'Doctor مع Tariq امرأة، وAgent مع Layla رجل');
  ck(r[2], 'ثلاثة أدوارٍ عامّة تتناوب الجنس');
  ck(r[3], 'رجلان في حوارٍ واحد (Karim وSami) لا يتطابق صوتاهما');
  await b.close();
}

/* ════ ٨) مفرداتي ════ */
{
  const { b, p } = await open(base());
  await p.goto(U + '#/unit/unit-01/4'); await p.waitForTimeout(1000);
  const tw = p.locator('.rd-en .tw').nth(5);
  const word = (await tw.innerText()).toLowerCase();
  await tw.click(); await p.waitForTimeout(300);
  ck(await p.locator('.sheet').isVisible(), 'لمس كلمة في القراءة يفتح ورقة الإضافة');
  ck((await p.locator('.sh-ctx').innerText()).length > word.length, 'وتعرض جملتها');
  await p.locator('.sh-inp').fill('معنى تجريبيّ');
  await p.locator('.sheet .btn.cta').click(); await p.waitForTimeout(400);
  const st = await state(p);
  ck(st.mine[word] && st.mine[word].ar === 'معنى تجريبيّ', 'حُفظت «' + word + '» بمعناها');
  ck(!!st.srs['mine/' + word], 'ودخلت التكرار المتباعد');
  /* الكلمات في الحوار أيضاً */
  await p.goto(U + '#/unit/unit-01/3'); await p.waitForTimeout(900);
  await p.locator('.line .dlg-en .tw', { hasText: 'designer' }).first().click(); await p.waitForTimeout(300);
  await p.locator('.sheet .btn.cta').click(); await p.waitForTimeout(300);
  ck(!!(await state(p)).mine.designer, 'وكلمة من الحوار (designer) بلا معنى مكتوب');
  /* المراجعة تعرضها */
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('en-course-v2')); s.srs = { 'mine/designer': { box: 0, due: 1, seen: 0, miss: 0 } }; localStorage.setItem('en-course-v2', JSON.stringify(s)); });
  await p.goto(U + '#/review'); await p.reload(); await p.waitForTimeout(1200);
  ck((await p.locator('.card3 .word').innerText()).trim() === 'designer', 'كلمتك تأتيك في المراجعة');
  await p.locator('.btn', { hasText: 'اعرض المعنى' }).click(); await p.waitForTimeout(500);
  ck((await p.locator('.face.b').innerText()).includes('designer'), 'وعلى ظهرها جملتها');
  await p.locator('.grade .g2').click(); await p.waitForTimeout(300);
  ck((await state(p)).log && Object.values((await state(p)).log)[0].rev === 1, 'المراجعة تُحتسب في سجلّ اليوم');
  /* الشاشة والحذف */
  await p.goto(U + '#/'); await p.waitForTimeout(800);
  ck((await p.locator('.mine-cta').innerText()).includes('٢'), 'زرّ «مفرداتي» يعرض العدد');
  await p.goto(U + '#/words'); await p.waitForTimeout(500);
  ck(await p.locator('.word-i').count() === 2, 'شاشة مفرداتي تعرض الكلمتين');
  await p.locator('.word-i .sh-x').first().click(); await p.waitForTimeout(300);
  const st2 = await state(p);
  ck(Object.keys(st2.mine).length === 1, 'الحذف يزيل الكلمة');
  ck(Object.keys(st2.srs).filter(k => k.startsWith('mine/')).length <= 1, 'ويزيلها من التكرار');
  /* حقن */
  await p.evaluate(() => wordSheet('<img src=x onerror=alert(1)>', '<b>x</b>'));
  ck(!(await p.locator('.sheet img').count()), 'الورقة تهرّب ما تعرضه');
  ck(errs.length === 0, 'لا أخطاء JS' + (errs.length ? ' :: ' + errs.slice(0, 2).join(' | ') : ''));
  await b.close();
}

/* ════ ٩) اختبار التخطّي ════ */
{
  const { b, p } = await open(base());
  await p.goto(U + '#/unit/unit-01'); await p.waitForTimeout(1000);
  ck(await p.locator('.note.skip').isVisible(), 'لوحة «اختبار التخطّي» ظاهرة في وحدةٍ لم تكتمل');
  await p.locator('.skip-btn').click(); await p.waitForTimeout(900);
  ck(/\/7$/.test(await p.evaluate(() => location.hash)), 'تنقلك إلى يوم الاختبار مباشرةً');
  await p.locator('.btn.ok').click(); await p.waitForTimeout(500);
  ck(!(await state(p))?.tests?.['unit-01'], 'زرّ الإنهاء قبل الإجابة لا يحتسب الاختبار (كان ثغرةً تمنح ١٠٠٪)');
  /* رسوب */
  await p.evaluate(() => { ctx.scores = [0.6]; });
  await p.locator('.btn.ok').click(); await p.waitForTimeout(500);
  let st = await state(p);
  ck(st.tests['unit-01'] && !st.tests['unit-01'].passed, 'الرسوب يُسجَّل ولا يفتح شيئاً');
  /* نجاح */
  await p.evaluate(() => { ctx.scores = [0.9]; });
  await p.locator('.btn.ok').click(); await p.waitForTimeout(1200);
  st = await state(p);
  ck(st.tests['unit-01'].passed && st.tests['unit-01'].skip === 1, 'النجاح بـ٩٠٪ يُسجَّل اجتيازاً بالتخطّي');
  await p.goto(U + '#/'); await p.waitForTimeout(1500);
  ck(!(await p.locator('.unit', { hasText: 'الذكريات والسرد' }).first().getAttribute('class')).includes('locked'), 'والوحدة ٢ صارت مفتوحة');
  await p.goto(U + '#/unit/unit-01'); await p.waitForTimeout(800);
  ck(!(await p.locator('.note.skip').count()), 'وتختفي لوحة التخطّي بعد الاجتياز');
  await b.close();
}

/* ════ ١٠) الهدف اليوميّ والأسبوع والإعدادات ════ */
{
  const k = new Date().toISOString().slice(0, 10);
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const { b, p } = await open(base({ goal: 30, log: { [k]: { sec: 600, les: 1, rev: 0 }, [y]: { sec: 2400, les: 2, rev: 5, hit: 1 } } }));
  await p.goto(U); await p.waitForTimeout(1500);
  const gt = await p.locator('.goal-t').innerText();
  ck(/١٠/.test(gt) && /٣٠/.test(gt), 'هدف اليوم يعرض ١٠ من ٣٠ دقيقة: ' + gt.replace(/\n/g, ' '));
  ck(await p.locator('.wk-col').count() === 7, 'رسم الأسبوع بسبعة أعمدة');
  const cap0 = await p.locator('.wk-cap').innerText();
  ck(/٥٠/.test(cap0) && /١ من ٧/.test(cap0), 'المجموع والأيّام المبلوغة: ' + cap0);
  await p.locator('.wk-col').nth(5).click(); await p.waitForTimeout(150);
  ck(/٤٠ دقيقة/.test(await p.locator('.wk-cap').innerText()), 'لمس عمود الأمس يعرض قيمته');
  /* الوقت يُحتسب مع التفاعل */
  await p.mouse.click(5, 300);
  await p.waitForTimeout(15600);
  const sec = (await state(p)).log[k].sec;
  ck(sec >= 615, 'الوقت النشط يُضاف إلى اليوم (' + sec + ' ث)');
  /* الإعدادات */
  await p.locator('.gear').click(); await p.waitForTimeout(600);
  ck(/settings/.test(await p.evaluate(() => location.hash)), 'زرّ ⚙️ يفتح الإعدادات');
  await p.locator('.goal-seg button', { hasText: '٢٠' }).click(); await p.waitForTimeout(300);
  ck((await state(p)).goal === 20, 'تغيير الهدف إلى ٢٠ دقيقة');
  const fNames = await p.locator('.vset').first().locator('.vn').allInnerTexts();
  ck(fNames.includes('Samantha') && fNames.includes('Nicky') && !fNames.includes('Bells'), 'قائمة أصوات المرأة: ' + fNames.join('، '));
  const mNames = await p.locator('.vset').nth(1).locator('.vn').allInnerTexts();
  ck(mNames.includes('Aaron') && mNames.includes('Daniel') && mNames.indexOf('Fred') > mNames.indexOf('Aaron'), 'قائمة أصوات الرجل، والقديم (Fred) آخرها: ' + mNames.join('، '));
  await p.locator('.vset').first().locator('.vpick', { hasText: 'Nicky' }).click(); await p.waitForTimeout(300);
  ck((await state(p)).voices.f.includes('Nicky'), 'اختيار Nicky لصوت المرأة يُحفظ');
  await p.evaluate(() => { window.__spoken = []; });
  await p.locator('.vset').nth(1).locator('.vopt').nth(1).locator('.spk').click(); await p.waitForTimeout(250);
  ck((await spoken(p))[0]?.voice === 'Aaron', 'زرّ التجربة ينطق بالصوت المعروض');
  await p.locator('.seg button', { hasText: 'رجل' }).click(); await p.waitForTimeout(300);
  await p.goto(U + '#/unit/unit-01/3'); await p.waitForTimeout(900);
  await p.evaluate(() => { window.__spoken = []; });
  await p.locator('.line.g-f .spk').first().click(); await p.waitForTimeout(250);
  ck((await spoken(p))[0]?.voice === 'Nicky', 'Maya صارت بصوت Nicky المختار');
  await p.goto(U + '#/unit/unit-01/1'); await p.waitForTimeout(900);
  await p.evaluate(() => { window.__spoken = []; });
  await p.locator('.ex .spk').first().click(); await p.waitForTimeout(250);
  ck((await spoken(p))[0]?.voice === 'Aaron', 'الأمثلة بصوت الرجل بعد اختياره للنطق الافتراضيّ');
  ck(errs.length === 0, 'لا أخطاء JS' + (errs.length ? ' :: ' + errs.slice(0, 2).join(' | ') : ''));
  await b.close();
}

/* ════ ١١) الترحيل: حالة النسخة ٢ تُفتح كما هي ════ */
{
  const old = { v: 2, done: { 'unit-01/1': { score: 1, at: 1 } }, srs: { a: { box: 3, due: Date.now() + 9e8 } }, errors: [{ q: 'x', a: 'y', unit: 'u', at: 1 }], streak: { count: 4, best: 9, last: '2026-01-01' }, rate: 1.3, tests: { 'unit-01': { score: .9, passed: true, at: 1 } } };
  const { b, p } = await open(old);
  await p.goto(U); await p.waitForTimeout(1500);
  await p.evaluate(() => save()); await p.waitForTimeout(400);
  const st = await state(p);
  ck(st.done['unit-01/1'] && st.srs.a.box === 3 && st.errors.length === 1 && st.streak.best === 9 && st.rate === 1.3 && st.tests['unit-01'].passed, 'تقدّم النسخة ٢ محفوظٌ كاملاً بعد الترقية');
  ck(st.goal === 30 && st.show === 0 && st.voices && st.mine && st.log, 'والحقول الجديدة أُضيفت بقيمها الافتراضيّة');
  ck(!(await p.locator('.unit', { hasText: 'الذكريات والسرد' }).first().getAttribute('class')).includes('locked'), 'والقفل يتبع الاختبارات القديمة');
  await b.close();
}

console.log('\n===== اختبار النسخة ٣ =====');
ok.forEach(m => console.log('  ✔ ' + m));
if (bad.length) { console.log('\n  ✘ إخفاقات:'); bad.forEach(m => console.log('  ✘ ' + m)); }
console.log('\nالمجموع: ' + ok.length + ' ناجح، ' + bad.length + ' فاشل');
process.exit(bad.length ? 1 : 0);
