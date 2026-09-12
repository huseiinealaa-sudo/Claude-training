import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const U=`${BASE}/English-A2-to-B2.html`;
const course = await (await fetch(`${BASE}/content/course.json`)).json();
const units = course.units.filter(u=>u.status==='ready');

const VIEWS = [
  {n:'iPhone SE',  w:375,h:667},
  {n:'iPhone 13',  w:390,h:844},
  {n:'iPad Pro 11',w:834,h:1194},
];
const problems=[]; let pages=0;

for (const V of VIEWS) {
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:V.w,height:V.h},deviceScaleFactor:2,isMobile:V.w<800,hasTouch:true});
  await ctx.addInitScript(()=>{const t={};for(let i=1;i<=24;i++)t['unit-'+String(i).padStart(2,'0')]={score:.95,passed:true,at:Date.now()};try{localStorage.setItem('en-course-v2',JSON.stringify({v:2,done:{},srs:{},errors:[],streak:{count:0},writes:{},rate:1,tests:t}))}catch(e){}});
  const p=await ctx.newPage();
  p.on('pageerror',e=>problems.push(`[${V.n}] JS: ${e}`));
  p.on('console',m=>{ const t=m.text();
    if(m.type()==='error' && !/favicon|fonts|Failed to load resource|speech/i.test(t)) problems.push(`[${V.n}] console: ${t}`); });

  for (const u of units) {
    const nDays = u.kind==='phonetics' ? 10 : (u.kind==='bank' ? 0 : 7);
    const routes = nDays ? Array.from({length:nDays},(_,i)=>`#/unit/${u.id}/${i+1}`) : [`#/unit/${u.id}`];
    routes.unshift(`#/unit/${u.id}`);
    for (const r of routes) {
      await p.goto(U+r); await p.waitForTimeout(190); pages++;
      const m = await p.evaluate(()=>{
        const d=document.documentElement;
        const out={sw:d.scrollWidth, cw:d.clientWidth, empty:!document.querySelector('#app').innerText.trim().length, over:[]};
        // أيّ عنصرٍ يتجاوز عرض الشاشة
        document.querySelectorAll('#app *').forEach(e=>{
          const r=e.getBoundingClientRect();
          if(r.width>2 && (r.right>d.clientWidth+2 || r.left<-2)){
            const tag=e.className||e.tagName;
            if(!out.over.some(o=>o.c===tag)) out.over.push({c:String(tag).slice(0,40), r:Math.round(r.right), l:Math.round(r.left)});
          }
        });
        return out;
      });
      if(m.sw>m.cw+2) problems.push(`[${V.n}] ${r}: تمرير أفقي ${m.sw}/${m.cw}`);
      if(m.empty)     problems.push(`[${V.n}] ${r}: صفحة فارغة`);
      m.over.slice(0,2).forEach(o=>problems.push(`[${V.n}] ${r}: تجاوز عرض «${o.c}» (يمين ${o.r}, يسار ${o.l})`));
    }
  }
  await b.close();
}
console.log(`\n🔎 فُحصت ${pages} صفحة عبر ${VIEWS.length} مقاسات.`);
if(problems.length){ console.log(`\n❌ ${problems.length} مشكلة:`); [...new Set(problems)].slice(0,40).forEach(x=>console.log('  •',x)); process.exit(1); }
console.log('✅ لا تمرير أفقي، لا تجاوز، لا صفحات فارغة، لا أخطاء JS.');
