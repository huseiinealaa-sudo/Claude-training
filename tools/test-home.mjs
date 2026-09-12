import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const U=`${BASE}/English-A2-to-B2.html`;
const bad=[];
const STATES={
 'مبتدئ (٢٣ مقفلة)': {},
 'رسب بـ٧٥٪ (رسالة طويلة)': {'unit-01':{score:.75,passed:false,at:Date.now()}},
 'منتصف الطريق': Object.fromEntries([...Array(12)].map((_,i)=>['unit-'+String(i+1).padStart(2,'0'),{score:.9,passed:true,at:Date.now()}])),
};
for(const [w,h] of [[375,667],[390,844],[834,1194]]){
  for(const [name,tests] of Object.entries(STATES)){
    const b=await chromium.launch();
    const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:w<800,hasTouch:true});
    await ctx.addInitScript(t=>{try{localStorage.setItem('en-course-v2',JSON.stringify({v:2,done:{},srs:{},errors:[],streak:{count:0},writes:{},rate:1,tests:t}))}catch(e){}},tests);
    const p=await ctx.newPage();
    p.on('pageerror',e=>bad.push(`[${w}] ${name}: JS ${e}`));
    await p.goto(U); await p.waitForTimeout(2600);
    const m=await p.evaluate(()=>{const d=document.documentElement;const o=[];
      document.querySelectorAll('#app .unit, #app .unit *').forEach(e=>{const r=e.getBoundingClientRect();
        if(r.width>2&&(r.right>d.clientWidth+2||r.left<-2)) o.push(String(e.className).slice(0,30));});
      return {sw:d.scrollWidth,cw:d.clientWidth,o:[...new Set(o)]};});
    if(m.sw>m.cw+2) bad.push(`[${w}px] ${name}: تمرير أفقي ${m.sw}/${m.cw}`);
    m.o.forEach(c=>bad.push(`[${w}px] ${name}: تجاوز «${c}»`));
    await b.close();
  }
}
console.log(bad.length?'❌\n  '+[...new Set(bad)].join('\n  '):'✅ الشاشة الرئيسة تتّسع في كلّ الحالات والمقاسات (٩ تركيبات)');
process.exit(bad.length?1:0);
