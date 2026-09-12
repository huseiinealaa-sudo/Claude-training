import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const U=`${BASE}/English-A2-to-B2.html`;
const ok=[],bad=[]; const ck=(c,m)=>(c?ok:bad).push(m);
const errs=[];

async function open(state){
  const b=await chromium.launch();
  const ctx=await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(st=>{ try{ localStorage.setItem('en-course-v2', JSON.stringify(st)); }catch(e){} }, state);
  const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push(String(e)));
  p.on('console',m=>{ if(m.type()==='error' && !/favicon|fonts|Failed to load|speech/i.test(m.text())) errs.push(m.text()); });
  return {b,p};
}
const base=(tests)=>({v:2,done:{},srs:{},errors:[],streak:{count:0},writes:{},rate:1,tests});
const txt=async(p,name)=>await p.locator('.unit',{hasText:name}).first().innerText();
const cls=async(p,name)=>await p.locator('.unit',{hasText:name}).first().getAttribute('class');

/* ── الحالة ١: مستخدمٌ جديد، لا اختبارات مجتازة ── */
{
  const {b,p}=await open(base({}));
  await p.goto(U); await p.waitForTimeout(2500);
  ck(!(await cls(p,'صوتيّات')).includes('locked'),'الصوتيّات مفتوحة دائماً');
  ck(!(await cls(p,'بنك المراجعة')).includes('locked'),'بنك المراجعة مفتوح دائماً');
  ck(!(await cls(p,'التعريف بالنفس')).includes('locked'),'الوحدة ١ مفتوحة للمبتدئ');
  ck((await cls(p,'الذكريات والسرد')).includes('locked'),'الوحدة ٢ مقفلة');
  ck((await cls(p,'الطلاقة')).includes('locked'),'الوحدة ٢٤ مقفلة');
  ck((await cls(p,'الإعلام والمصداقيّة')).includes('locked'),'الوحدة ١٣ (أوّل B2) مقفلة ← شرط B1→B2 محقّق');
  const t=await txt(p,'الذكريات والسرد');
  ck(/أنجِز وحدة/.test(t) && /التعريف بالنفس/.test(t),'رسالة القفل تسمّي الوحدة المطلوبة: '+t.split('\n').filter(x=>x.trim()).slice(1,2));
  ck((await p.locator('.unit.locked').count())===23,'عدد المقفلة = '+await p.locator('.unit.locked').count()+' (٢٣ = ٢٦ − الصوتيّات − البنك − الوحدة ١)');
  /* تخطّي القفل بكتابة العنوان */
  await p.goto(U+'#/unit/unit-20'); await p.waitForTimeout(1400);
  ck(await p.locator('.hero h1').isVisible(),'كتابة #/unit/unit-20 تُعيدك إلى الرئيسة');
  await p.goto(U+'#/unit/unit-20/3'); await p.waitForTimeout(1400);
  ck(await p.locator('.hero h1').isVisible(),'وكذلك الدخول إلى درسٍ بعينه داخل وحدةٍ مقفلة');
  await b.close();
}
/* ── الحالة ٢: اجتاز الوحدة ١ بـ٩٠٪ ── */
{
  const {b,p}=await open(base({'unit-01':{score:.9,passed:true,at:Date.now()}}));
  await p.goto(U); await p.waitForTimeout(2500);
  ck(!(await cls(p,'الذكريات والسرد')).includes('locked'),'اجتياز الوحدة ١ يفتح الوحدة ٢');
  ck((await cls(p,'الخبرات والإنجازات')).includes('locked'),'والوحدة ٣ ما تزال مقفلة');
  await p.goto(U+'#/unit/unit-02'); await p.waitForTimeout(1200);
  ck((await p.locator('.day').count())===7,'وتُفتح فعلاً عند الدخول ('+await p.locator('.day').count()+' أيّام)');
  await b.close();
}
/* ── الحالة ٣: رسب بـ٧٥٪ ── */
{
  const {b,p}=await open(base({'unit-01':{score:.75,passed:false,at:Date.now()}}));
  await p.goto(U); await p.waitForTimeout(2500);
  ck((await cls(p,'الذكريات والسرد')).includes('locked'),'الرسوب لا يفتح التالية');
  const t=await txt(p,'الذكريات والسرد');
  ck(/٧٥/.test(t)&&/٨٠/.test(t),'الرسالة تعرض نتيجتك والعتبة: '+t.replace(/\n/g,' · '));
  await b.close();
}
/* ── الحالة ٤: أتمّ كلّ الوحدات ── */
{
  const tests={}; for(let i=1;i<=24;i++) tests['unit-'+String(i).padStart(2,'0')]={score:.95,passed:true,at:Date.now()};
  const {b,p}=await open(base(tests));
  await p.goto(U); await p.waitForTimeout(2500);
  ck((await p.locator('.unit.locked').count())===0,'اجتياز الكلّ يفتح الكلّ');
  await b.close();
}
console.log('\n===== اختبار قفل التسلسل =====');
ok.forEach(m=>console.log('  ✔ '+m));
if(errs.length) bad.push('أخطاء JS: '+[...new Set(errs)].slice(0,2).join(' | '));
if(bad.length){ console.log('\n  ✘ إخفاقات:'); bad.forEach(m=>console.log('  ✘ '+m)); }
console.log('\nالمجموع: '+ok.length+' ناجح، '+bad.length+' فاشل');
process.exit(bad.length?1:0);
