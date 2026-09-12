import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const U=`${BASE}/English-A2-to-B2.html`;
const ok=[],bad=[]; const ck=(c,m)=>(c?ok:bad).push(m);
const errs=[];
const b=await chromium.launch();
const ctx=await b.newContext({ ...devices['iPhone 13'], permissions:['clipboard-read','clipboard-write'] });
await ctx.addInitScript(()=>{try{if(localStorage.getItem('__seeded'))return;localStorage.setItem('__seeded','1');localStorage.setItem('en-course-v2',JSON.stringify({v:2,
  done:{'unit-01/1':Date.now(),'unit-01/2':Date.now()},
  srs:{a:{box:2,due:Date.now()},b:{box:1,due:Date.now()}},
  errors:[],streak:{count:5,best:5},writes:{},rate:1,
  tests:{'unit-01':{score:.9,passed:true,at:Date.now()}}}))}catch(e){}});
const p=await ctx.newPage();
p.on('pageerror',e=>errs.push(String(e)));
p.on('console',m=>{if(m.type()==='error'&&!/favicon|fonts|Failed to load|speech|clipboard/i.test(m.text()))errs.push(m.text())});

/* ═══ مدقّق الكتابة ═══ */
await p.goto(U+'#/unit/unit-01/6'); await p.waitForTimeout(1300);
ck(await p.locator('.btn',{hasText:'افحص نصّي'}).isVisible(),'زرّ الفحص ظاهر في يوم الكتابة');

const BAD_TEXT = `According to me, there are many informations about this topic. My manager said me that we should discuss about it. I am agree with him. I work here since three years. If I would have known, I would of told you. He explained me the plan and it proves that all people are wrong. The prices are very expensive and I am boring.`;
await p.locator('.ta').first().fill(BAD_TEXT);
await p.locator('.btn',{hasText:'افحص نصّي'}).click(); await p.waitForTimeout(500);
const n = await p.locator('.wc-i').count();
ck(n>=9,'التقط '+n+' خطأً من نصٍّ مليءٍ بالأخطاء');
const all = await p.locator('.wchk').innerText();
for(const [needle,label] of [
  ['informations','informations'],['said me','said me'],['discuss about','discuss about'],
  ['am agree','I am agree'],['since three years','since + مدّة'],['would have','if + would have'],
  ['would of','would of'],['explained me','explain me'],['According to me','according to me'],
  ['expensive','prices are expensive'],['am boring','I am boring'],['proves','proves']])
  ck(all.includes(needle),'رصد: '+label);
ck(/الوحدة [٠-٩]+/.test(all),'كلّ ملاحظة تحيل إلى وحدتها');
ck((await p.locator('.wc-len').count())===1,'يعرض الطول مقابل المدى المطلوب');
ck(/المطلوب ٦٠–٨٠/.test(await p.locator('.wc-len').innerText()),'ويقرأ المدى المكتوب بالأرقام العربيّة: '+(await p.locator('.wc-len').innerText()));
/* نصٌّ قصير عمداً ← تنبيه */
await p.locator('.ta').first().fill('Too short on purpose.');
await p.locator('.btn',{hasText:'افحص نصّي'}).click(); await p.waitForTimeout(350);
ck((await p.locator('.wc-len.no').count())===1,'ينبّه حين يكون النصّ خارج المدى');
ck((await p.locator('.wc-len').innerText()).includes('تنقصك'),'ويقول كم تنقصك بالضبط');
await p.locator('.ta').first().fill(BAD_TEXT);
await p.locator('.btn',{hasText:'افحص نصّي'}).click(); await p.waitForTimeout(350);

/* نصٌّ نظيف */
await p.locator('.ta').first().fill('I have worked here for three years. My manager told me that we should discuss the matter, and I agree with him. The evidence suggests that most people misunderstand it. Prices are high, and I am bored by the debate. He explained the plan to me clearly, so if I had known earlier I would have said something.');
await p.locator('.btn',{hasText:'افحص نصّي'}).click(); await p.waitForTimeout(400);
ck((await p.locator('.wc-i').count())===0,'النصّ السليم يمرّ بلا ملاحظة');
ck(await p.locator('.wc-none').isVisible(),'ويُعرض تطمينٌ صريح بحدوده');
ck((await p.locator('.wc-none').innerText()).includes('لا يعني'),'ولا يدّعي أنّه تصحيحٌ كامل');

/* حقن HTML في نصّ المستخدم */
await p.locator('.ta').first().fill('<img src=x onerror=alert(1)> informations');
await p.locator('.btn',{hasText:'افحص نصّي'}).click(); await p.waitForTimeout(400);
ck((await p.locator('.wchk img').count())===0,'وسوم HTML في نصّ المستخدم مهرَّبة لا منفَّذة');

/* ═══ النسخة الاحتياطيّة ═══ */
await p.goto(U); await p.waitForTimeout(2200);
ck(await p.locator('.bk-cta').isVisible(),'زرّ النسخة ظاهر في الشاشة الرئيسة');
await p.locator('.bk-cta').click(); await p.waitForTimeout(800);
ck((await p.locator('.bk-s').count())===4,'ملخّص التقدّم بأربعة أرقام');
const blob = await p.locator('.bk-ta').first().inputValue();
let parsed=null; try{parsed=JSON.parse(blob)}catch(e){}
ck(!!parsed && parsed.app==='en-course','النسخة المصدَّرة JSON صالح');
ck(parsed && Object.keys(parsed.state.done).length===2,'تحمل الدروس المنجزة');
ck(parsed && parsed.state.tests['unit-01'].passed===true,'وتحمل نتائج الاختبارات (وبها يُفتح القفل)');
ck((await p.locator('a.btn[download]').count())===1,'رابط التنزيل موجود');

/* استعادة: نسخةٌ فاسدة */
await p.locator('.bk-ta').nth(1).fill('{"nope":1}');
await p.locator('.btn',{hasText:'استعد'}).click(); await p.waitForTimeout(400);
ck((await p.locator('.toast').innerText()).includes('ليست نسخة'),'يرفض نسخةً ليست من التطبيق');
await p.locator('.bk-ta').nth(1).fill('not json at all');
await p.locator('.btn',{hasText:'استعد'}).click(); await p.waitForTimeout(400);
ck((await p.locator('.toast').innerText()).includes('صالحة'),'يرفض نصّاً ليس JSON');

/* استعادة سليمة: تحتاج ضغطتين */
const good = JSON.stringify({app:'en-course',v:2,at:'2026-01-01T00:00:00Z',
  state:{v:2,done:{'unit-03/1':1,'unit-03/2':1,'unit-03/3':1},srs:{z:{box:3,due:1}},errors:[],
         streak:{count:9,best:9},writes:{},rate:1,tests:{'unit-01':{score:1,passed:true,at:1},'unit-02':{score:1,passed:true,at:1}}},
  writes:{'wr:unit-03/6':'my saved essay'}});
await p.locator('.bk-ta').nth(1).fill(good);
await p.locator('.btn',{hasText:'استعد'}).click(); await p.waitForTimeout(400);
ck((await p.locator('.btn.danger').count())===1,'الاستبدال يحتاج تأكيداً ثانياً');
ck((await p.locator('.toast').innerText()).includes('٣'),'ويعرض ما في النسخة قبل الاستبدال');
await p.locator('.btn.danger').click(); await p.waitForTimeout(1800);
const after = await p.evaluate(()=>JSON.parse(localStorage.getItem('en-course-v2')));
ck(Object.keys(after.done).length===3,'استُبدل التقدّم فعلاً');
ck(after.streak.count===9,'والسلسلة معه');
ck(await p.evaluate(()=>localStorage.getItem('wr:unit-03/6'))==='my saved essay','ونصوص الكتابة المحفوظة');
await p.goto(U); await p.waitForTimeout(2400);
ck(!(await p.locator('.unit',{hasText:'الخبرات والإنجازات'}).first().getAttribute('class')).includes('locked'),
   'والقفل يتبع النسخة المستعادة: الوحدة ٣ مفتوحة الآن');

await b.close();
if(errs.length) bad.push('أخطاء JS: '+[...new Set(errs)].slice(0,2).join(' | '));
console.log('\n===== المدقّق + النسخة الاحتياطيّة =====');
ok.forEach(m=>console.log('  ✔ '+m));
if(bad.length){console.log('\n  ✘ إخفاقات:');bad.forEach(m=>console.log('  ✘ '+m));}
console.log('\nالمجموع: '+ok.length+' ناجح، '+bad.length+' فاشل');
process.exit(bad.length?1:0);
