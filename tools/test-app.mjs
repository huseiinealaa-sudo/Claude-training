import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const U=`${BASE}/English-A2-to-B2.html`;
const ok=[],bad=[]; const ck=(c,m)=>(c?ok:bad).push(m);
const b=await chromium.launch();
const ctx=await b.newContext({ ...devices['iPhone 13'] });
/* نزرع تقدّم النسخة الأولى لاختبار النقل */
await ctx.addInitScript(()=>{ try{ localStorage.setItem('en-a2-b2-progress-v1', JSON.stringify({known:{'B1-0':true,'B1-1':true,'TB1-0':true},level:'B1'})); }catch(e){} });
const p=await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
p.on('console',m=>{ if(m.type()==='error' && !/favicon|fonts|Failed to load resource/.test(m.text())) errs.push('console: '+m.text()); });

await p.goto(U); await p.waitForTimeout(1800);
ck(errs.length===0,'لا أخطاء JS عند الإقلاع'+(errs.length?' :: '+errs[0]:''));
ck(await p.locator('.hero h1').isVisible(),'الشاشة الرئيسة ظهرت');
ck(await p.locator('.session').isVisible(),'بطاقة «جلسة اليوم» ظاهرة');
ck(await p.locator('.unit').count()>=26,'عدد الوحدات المعروضة = '+await p.locator('.unit').count());
const soonN = await p.locator('.unit.soon').count();
const readyN = await p.locator('.unit:not(.soon)').count();
ck(soonN+readyN===26,'مجموع الوحدات ٢٦ ('+readyN+' جاهزة · '+soonN+' قريباً)');
ck(readyN>=3,'الوحدات الجاهزة = '+readyN);

/* نقل التقدّم السابق */
const mig = await p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem('en-course-v2')||'{}'); return Object.keys(s.srs||{}).length; });
ck(mig===3,'نُقل تقدّم النسخة الأولى: '+mig+' عناصر');

/* الوحدة الصوتيّة */
await p.locator('.unit', { hasText:'صوتيّات' }).first().click();
await p.waitForTimeout(900);
ck(await p.locator('.day').count()===10,'الوحدة الصوتيّة فيها '+await p.locator('.day').count()+' دروس');
ck((await p.locator('.panel .h').first().innerText()).includes('صوتيّات'),'عنوان الوحدة صحيح');

/* درس صوتيّات ١ */
await p.locator('.day').first().click(); await p.waitForTimeout(900);
ck(await p.locator('.note').count()>=2,'كتل الشرح ظاهرة ('+await p.locator('.note').count()+')');
ck(await p.locator('.pr').count()===10,'صفوف النطق = '+await p.locator('.pr').count());
ck(await p.locator('.spk').count()>=20,'أزرار الاستماع موجودة ('+await p.locator('.spk').count()+')');
ck(await p.locator('.qbar').count()===1,'محرّك الاختبار ظاهر');

/* اختبار MCQ */
const q1=await p.locator('.q').first().innerText();
ck(q1.length>5,'السؤال الأوّل معروض');
await p.locator('.opt').nth(1).click(); await p.waitForTimeout(500);
ck(await p.locator('.fb.good').count()===1,'إجابة صحيحة تُظهر تغذية راجعة خضراء');
ck(await p.locator('.btn.cta', {hasText:'التالي'}).isVisible(),'زرّ «التالي» ظهر');
await p.locator('.btn.cta', {hasText:'التالي'}).click(); await p.waitForTimeout(600);

/* سؤال استماع (hear) */
ck(await p.locator('.spk.big').count()>=2,'أزرار الاستماع/البطء في سؤال الاستماع');
await p.locator('.opt').first().click(); await p.waitForTimeout(500);
ck(await p.locator('.fb').count()===1,'تغذية راجعة لسؤال الاستماع');
await p.locator('.btn.cta', {hasText:'التالي'}).click(); await p.waitForTimeout(600);

/* سؤال إملاء (dict) */
ck(await p.locator('.inp').count()===1,'حقل الإملاء ظاهر');
await p.locator('.inp').fill('Can you get it?');
await p.locator('.btn', {hasText:'تحقّق'}).click(); await p.waitForTimeout(500);
ck(await p.locator('.fb.good').count()===1,'الإملاء يقبل الإجابة الصحيحة رغم اختلاف علامات الترقيم');

/* نُكمل بقيّة الأسئلة */
for(let i=0;i<6;i++){
  const nx=p.locator('.btn.cta', {hasText:'التالي'});
  if(await nx.count() && await nx.isVisible()){ await nx.click(); await p.waitForTimeout(450); }
  if(await p.locator('.opt').count()){ await p.locator('.opt').first().click(); await p.waitForTimeout(400); }
  else if(await p.locator('.inp').count()){ await p.locator('.inp').fill('x'); await p.locator('.btn',{hasText:'تحقّق'}).click(); await p.waitForTimeout(400); }
}
const nx2=p.locator('.btn.cta', {hasText:'التالي'});
if(await nx2.count() && await nx2.isVisible()){ await nx2.click(); await p.waitForTimeout(600); }
ck(await p.locator('.result .score').count()===1,'شاشة النتيجة ظهرت بعد آخر سؤال');

/* إنهاء الدرس */
await p.locator('.btn.ok').click(); await p.waitForTimeout(1100);
ck(await p.locator('.day').first().evaluate(e=>e.classList.contains('done')),'الدرس سُجّل كمنجَز');
const st=await p.evaluate(()=>JSON.parse(localStorage.getItem('en-course-v2')));
ck(!!st.done['phonetics/1'],'حُفظ الإنجاز في التخزين');
ck(st.streak.count===1,'بدأت السلسلة اليوميّة');
ck(st.errors.length>0,'الأخطاء سُجّلت في المفكّرة ('+st.errors.length+')');

/* الوحدة الأولى */
await p.goto(U+'#/unit/unit-01'); await p.waitForTimeout(900);
ck(await p.locator('.day').count()===7,'الوحدة الأولى فيها '+await p.locator('.day').count()+' أيّام');
ck(await p.locator('.day.locked').count()===1,'اختبار الوحدة مقفل حتى إنجاز الأيّام');
ck(await p.locator('.goals li').count()===4,'أهداف الوحدة معروضة');

/* يوم الاستماع */
await p.goto(U+'#/unit/unit-01/3'); await p.waitForTimeout(900);
ck(await p.locator('.line').count()===14,'أسطر الحوار = '+await p.locator('.line').count());
ck(await p.locator('.rate button').count()===3,'ثلاث سرعات للاستماع');
await p.locator('.rate button').first().click(); await p.waitForTimeout(200);
ck(await p.evaluate(()=>JSON.parse(localStorage.getItem('en-course-v2')).rate)===0.7,'حُفظ اختيار السرعة ٠٫٧×');

/* يوم القراءة */
await p.goto(U+'#/unit/unit-01/4'); await p.waitForTimeout(900);
ck(await p.locator('.rd-en').count()===1,'نصّ القراءة ظاهر');
ck(await p.locator('.rd-ar').first().isHidden(),'الترجمة مخفيّة قبل الضغط');
await p.locator('.btn.ghost').first().click(); await p.waitForTimeout(400);
ck(await p.locator('.rd-ar').first().isVisible(),'الترجمة تظهر بالضغط');

/* يوم الكتابة */
await p.goto(U+'#/unit/unit-01/6'); await p.waitForTimeout(900);
ck(await p.locator('.ta').count()===1,'محرّر الكتابة ظاهر');
await p.locator('.ta').fill('Hi everyone, I am Omar from Baghdad and I work as a designer.');
await p.waitForTimeout(400);
ck((await p.locator('.wc').innerText()).includes('13'),'عدّاد الكلمات يعمل: '+await p.locator('.wc').innerText());
ck(await p.locator('.chk li').count()===7,'قائمة التحقّق فيها ٧ بنود');
await p.locator('.chk li').first().click(); await p.waitForTimeout(200);
ck(await p.locator('.chk li').first().evaluate(e=>e.classList.contains('on')),'بنود التحقّق قابلة للتعليم');
await p.reload(); await p.waitForTimeout(900);
ck((await p.locator('.ta').inputValue()).includes('Omar'),'نصّ الكتابة محفوظ بعد إعادة التحميل');

/* المفردات والمراجعة */
await p.goto(U+'#/unit/unit-01/2'); await p.waitForTimeout(900);
const vcount = await p.locator('.ex').count();
ck(vcount>=25,'بطاقات المفردات = '+vcount);
const srsN = await p.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('en-course-v2')).srs).length);
ck(srsN>=25,'المفردات دخلت نظام التكرار: '+srsN+' عنصراً');

await p.goto(U+'#/review'); await p.waitForTimeout(2200);
ck(await p.locator('.card3').count()===1,'بطاقة المراجعة ظهرت');
ck(await p.locator('.grade').first().isHidden(),'أزرار التقييم مخفيّة قبل قلب البطاقة');
await p.locator('.btn', {hasText:'اعرض المعنى'}).click(); await p.waitForTimeout(700);
ck(await p.locator('.grade').first().isVisible(),'أزرار التقييم تظهر بعد القلب');
const before = await p.evaluate(()=>JSON.parse(localStorage.getItem('en-course-v2')).srs);
await p.locator('.grade .g2').click(); await p.waitForTimeout(600);
const after = await p.evaluate(()=>JSON.parse(localStorage.getItem('en-course-v2')).srs);
const moved = Object.keys(after).some(k=>after[k].box>(before[k]||{box:-1}).box);
ck(moved,'التقييم «سهلة» يرفع الصندوق ويؤجّل الموعد');

/* مفكّرة الأخطاء */
await p.goto(U+'#/errors'); await p.waitForTimeout(700);
ck(await p.locator('.err-item').count()>0,'مفكّرة الأخطاء تعرض الأخطاء');

/* التجاوب */
await p.goto(U); await p.waitForTimeout(1200);
const sw=await p.evaluate(()=>({d:document.documentElement.scrollWidth,c:document.documentElement.clientWidth}));
ck(sw.d<=sw.c+2,'لا تمرير أفقي على الجوال ('+sw.d+'/'+sw.c+')');
await p.screenshot({path:'v2-home.png', fullPage:false});
await p.goto(U+'#/unit/phonetics/1'); await p.waitForTimeout(1000);
await p.screenshot({path:'v2-lesson.png', fullPage:false});

ck(errs.length===0,'لا أخطاء JS طوال الاختبار'+(errs.length?' :: '+errs.slice(0,2).join(' | '):''));
await b.close();
console.log('\n===== اختبار النسخة ٢ =====');
ok.forEach(m=>console.log('  ✔ '+m));
if(bad.length){console.log('\n  ✘ إخفاقات:');bad.forEach(m=>console.log('  ✘ '+m));}
console.log('\nالمجموع: '+ok.length+' ناجح، '+bad.length+' فاشل');
process.exit(bad.length?1:0);
