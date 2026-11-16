/*! pip-mascot.js · default "Pip" mascot
 * Usage:
 *   <script src="/pip-mascot.js"></script>
 *   <pip-mascot autopilot greet></pip-mascot>
 * Methods: setState(s), react(s, ms), say(text), point(element, text), home(), watch(input)
 */
(function(){
"use strict";
var engine=(function PipEngine(){
"use strict";
const RM=(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches)?0.3:1;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const pick=a=>a[Math.floor(Math.random()*a.length)];

function hexToHsl(hex){let r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0,l=(mx+mn)/2;
  if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h*=60}
  return [h,s*100,l*100]}
function hsl(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,9-k(n),1));
  return '#'+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('')}
function palette(hex){let [h,s,l]=hexToHsl(hex);l=clamp(l,46,86);s=clamp(s,22,95);
  return {base:hsl(h,s,l),light:hsl(h,s*.85,Math.min(l+15,95)),shade:hsl(h,Math.min(s+6,100),l-15),deep:hsl(h,Math.min(s+8,100),l-24),
    outline:hsl(h,clamp(s*.55,22,48),15)}}

const OPT={shape:['bean','round','tall','cube','pear','custom'],topper:['none','sprout','antenna','cat','bunny','horns','tuft'],
  eyes:['round','tall','small','dot','anime','cyclops'],pattern:['none','belly','spots','stripes'],accessory:['none','glasses','bowtie','crown','headphones'],
  style:['glossy','flat','soft','bold'],hands:['mitten','nub','none'],feet:['feet','none']};
const DEFAULT={name:'Pip',shape:'bean',color:'#FFC23D',accent:'#6BCB77',eyeColor:'#5A3A1E',topper:'sprout',eyes:'round',pattern:'none',accessory:'none',style:'glossy',hands:'mitten',feet:'feet',tooth:false,hat:'',item:'',body:null,greeting:"Hi, I'm Pip!"};
const HEX=/^#[0-9a-f]{6}$/i;
const TAGS=new Set(['g','path','circle','ellipse','rect','line','polyline','polygon']);
const ATTRS=new Set(['d','cx','cy','r','rx','ry','x','y','width','height','x1','y1','x2','y2','points','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','opacity','fill-opacity','stroke-opacity','transform']);
const COLOR=/^(#[0-9a-f]{3}|#[0-9a-f]{6}|none|outline|body|accent|shade|light|white|black)$/i;
const PATHD=/^[MmLlHhVvCcSsQqTtAaZz\d\s.,eE+-]+$/,NUM=/^[-+\d.,\s]+$/,TRF=/^\s*((translate|rotate|scale)\(\s*[-+\d.,\s]+\)\s*)+$/;
function cleanSvg(str){
  if(typeof str!=='string'||!str.trim()||str.length>16000||typeof DOMParser==='undefined')return '';
  str=str.replace(/<\/?svg[^>]*>/gi,'');
  const doc=new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">'+str+'</svg>','image/svg+xml');
  if(doc.getElementsByTagName('parsererror').length)return '';
  let n=0;
  const walk=el=>Array.from(el.children).map(c=>{const tag=c.tagName.toLowerCase();if(!TAGS.has(tag)||++n>70)return '';let a='';
    for(const at of Array.from(c.attributes)){const k=at.name.toLowerCase(),v=at.value.trim();if(!ATTRS.has(k))continue;let ok;
      if(k==='d')ok=PATHD.test(v)&&v.length<4000;else if(k==='fill'||k==='stroke')ok=COLOR.test(v);else if(k==='transform')ok=TRF.test(v);
      else if(k==='stroke-linecap'||k==='stroke-linejoin')ok=/^(round|butt|square|miter|bevel)$/.test(v);else ok=NUM.test(v)&&v.length<600;
      if(ok)a+=' '+k+'="'+v+'"'}
    return '<'+tag+a+'>'+(tag==='g'?walk(c):'')+'</'+tag+'>'}).join('');
  return walk(doc.documentElement)}
function sanitize(c){c=c||{};const d=DEFAULT,o={};
  for(const k in OPT)o[k]=OPT[k].includes(c[k])?c[k]:d[k];
  o.color=HEX.test(c.color)?c.color:d.color;o.accent=HEX.test(c.accent)?c.accent:d.accent;o.eyeColor=HEX.test(c.eyeColor)?c.eyeColor:d.eyeColor;
  o.name=String(typeof c.name==='string'&&c.name.trim()?c.name.trim():d.name).slice(0,16);
  o.greeting=String(typeof c.greeting==='string'&&c.greeting.trim()?c.greeting.trim():`Hi, I'm ${o.name}!`).slice(0,90);
  o.tooth=!!c.tooth;o.hat=cleanSvg(c.hat);o.item=cleanSvg(c.item);o.body=cleanBody(c.body);
  if(o.shape==='custom'&&!o.body)o.shape='bean';return o}
const num=(v,a,b,d)=>{v=Number(v);return isFinite(v)?clamp(v,a,b):d};
function cleanBody(b){if(!b||typeof b!=='object'||typeof b.d!=='string')return null;const d=b.d.trim();
  if(!PATHD.test(d)||d.length>6000||!/^[Mm]/.test(d))return null;
  return {d,eyeY:num(b.eyeY,60,170,120),spacing:num(b.spacing,0,40,24),eyeSize:num(b.eyeSize,.6,1.4,1),mouthY:num(b.mouthY,90,195,155),
    back:cleanSvg(b.back),marks:cleanSvg(b.marks)}}
let MS=null;const bboxCache={};
function measure(d){if(bboxCache[d])return bboxCache[d];try{if(!MS){MS=document.createElementNS('http://www.w3.org/2000/svg','svg');
  MS.setAttribute('style','position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;visibility:hidden');MS.innerHTML='<path/>';document.documentElement.appendChild(MS)}
  const p=MS.firstChild;p.setAttribute('d',d);const b=p.getBBox();if(!b.width||!b.height)return null;return bboxCache[d]={x:b.x,y:b.y,width:b.width,height:b.height}}catch(e){return null}}
function customGeom(b){const bb=measure(b.d);if(!bb)return null;const shift=206-(bb.y+bb.height),top=bb.y+shift,sideL=bb.x,sideR=bb.x+bb.width;
  const eyeY=clamp(b.eyeY+shift,top+22,170),mouthY=clamp(b.mouthY+shift,eyeY+16,194);
  return {d:b.d,shift,top,eyeY,dx:clamp(b.spacing,8,Math.max(10,(sideR-sideL)/2-16)),mouthY,sideL,sideR,handY:clamp(eyeY+46,eyeY+28,188),ex:clamp(bb.width*.24,18,44)}}

const SHAPES={
  bean:{d:'M120 58 C172 58 202 100 202 146 C202 186 166 206 120 206 C74 206 38 186 38 146 C38 100 68 58 120 58 Z',top:58,eyeY:124,dx:25,mouthY:158,sideL:42,sideR:198,handY:170,ex:34},
  round:{d:'M120 66 C160 66 190 98 190 137 C190 177 160 206 120 206 C80 206 50 177 50 137 C50 98 80 66 120 66 Z',top:66,eyeY:128,dx:24,mouthY:160,sideL:52,sideR:188,handY:168,ex:30},
  tall:{d:'M64 104 C64 66 88 44 120 44 C152 44 176 66 176 104 L176 176 C176 198 154 206 120 206 C86 206 64 198 64 176 Z',top:44,eyeY:102,dx:23,mouthY:136,sideL:64,sideR:176,handY:166,ex:28},
  cube:{d:'M80 66 L160 66 C182 66 196 80 196 102 L196 176 C196 196 184 206 162 206 L78 206 C56 206 44 196 44 176 L44 102 C44 80 58 66 80 66 Z',top:66,eyeY:122,dx:28,mouthY:156,sideL:44,sideR:196,handY:170,ex:42},
  pear:{d:'M120 64 C152 64 166 90 170 116 C175 146 204 162 200 188 C197 204 162 208 120 208 C78 208 43 204 40 188 C36 162 65 146 70 116 C74 90 88 64 120 64 Z',top:64,eyeY:110,dx:21,mouthY:142,sideL:44,sideR:196,handY:180,ex:24}
};
const EYES={round:{rx:16,ry:19,ir:10.5,adj:0},tall:{rx:12.5,ry:21,ir:9,adj:-3},small:{rx:9.5,ry:11,ir:7,adj:1},cyclops:{rx:24,ry:26,ir:14,adj:0},
  dot:{rx:7.5,ry:9.5,ir:0,adj:4,dark:true},anime:{rx:15,ry:22,ir:12.5,adj:-1,sparkle:true}};
const heartD=(cx,cy,r)=>`M${cx} ${cy+r*.95} C${cx-r*1.5} ${cy+r*.05} ${cx-r*1.15} ${cy-r*1.2} ${cx} ${cy-r*.42} C${cx+r*1.15} ${cy-r*1.2} ${cx+r*1.5} ${cy+r*.05} ${cx} ${cy+r*.95} Z`;

function render(cfg,uid){
  const P=palette(cfg.color),E0=EYES[cfg.eyes],acc=cfg.accent,ol=P.outline,u=uid;
  const G=(cfg.shape==='custom'&&cfg.body&&customGeom(cfg.body))||SHAPES[cfg.shape==='custom'?'bean':cfg.shape],t=G.top,sh=G.shift||0;
  const es=cfg.shape==='custom'&&cfg.body?cfg.body.eyeSize:1,E={...E0,rx:E0.rx*es,ry:E0.ry*es,ir:E0.ir*es};
  const eyes=cfg.eyes==='cyclops'?[{cx:120,cy:G.eyeY+2,rx:E.rx,ry:E.ry,ir:E.ir}]:[-1,1].map(s=>({cx:120+s*(G.dx+E.adj*es),cy:G.eyeY,rx:E.rx,ry:E.ry,ir:E.ir}));
  const ST={glossy:{fill:`url(#${u}grad)`,w:4.5,inner:.35,hl:true,oc:ol},flat:{fill:P.base,w:5,inner:0,hl:false,oc:ol},
    soft:{fill:`url(#${u}grad)`,w:3,inner:.22,hl:true,oc:P.deep},bold:{fill:P.base,w:7,inner:.5,hl:true,oc:ol}}[cfg.style]||{fill:`url(#${u}grad)`,w:4.5,inner:.35,hl:true,oc:ol};
  const hw=Math.max(3,ST.w*.85);
  let top='';
  if(cfg.topper==='sprout')top=`<path d="M120 ${t+6} C119 ${t-6} 121 ${t-14} 124 ${t-22}" stroke="${ol}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M123 ${t-20} C130 ${t-33} 147 ${t-35} 154 ${t-28} C147 ${t-17} 132 ${t-13} 123 ${t-20} Z" fill="${acc}" stroke="${ol}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M121 ${t-12} C114 ${t-20} 102 ${t-20} 98 ${t-15} C103 ${t-7} 114 ${t-6} 121 ${t-12} Z" fill="${acc}" stroke="${ol}" stroke-width="3.5" stroke-linejoin="round"/>`;
  if(cfg.topper==='antenna')top=`<path d="M120 ${t+8} C118 ${t-4} 124 ${t-14} 121 ${t-24}" stroke="${ol}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="121" cy="${t-31}" r="8.5" fill="${acc}" stroke="${ol}" stroke-width="3.5"/><circle cx="118" cy="${t-34}" r="2.6" fill="#fff"/>`;
  if(cfg.topper==='cat')top=[-1,1].map(s=>{const x=120+s*G.ex;return `<path d="M${x-s*18} ${t+28} L${x-s*6} ${t-20} L${x+s*22} ${t+12} Z" fill="${P.base}" stroke="${ol}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M${x-s*9} ${t+19} L${x-s*5} ${t-6} L${x+s*11} ${t+12} Z" fill="#FF9EB1"/>`}).join('');
  if(cfg.topper==='bunny')top=[-1,1].map(s=>{const x=120+s*(G.ex-10);return `<g transform="rotate(${s*12} ${x} ${t+10})">
    <ellipse cx="${x}" cy="${t-24}" rx="12" ry="32" fill="${P.base}" stroke="${ol}" stroke-width="4"/><ellipse cx="${x}" cy="${t-20}" rx="5.5" ry="22" fill="#FF9EB1"/></g>`}).join('');
  if(cfg.topper==='horns')top=[-1,1].map(s=>{const x=120+s*G.ex;return `<path d="M${x-s*8} ${t+16} C${x-s*16} ${t-4} ${x-s*8} ${t-22} ${x-s*14} ${t-34} C${x+s*6} ${t-22} ${x+s*12} ${t-4} ${x+s*12} ${t+12} Z" fill="${acc}" stroke="${ol}" stroke-width="3.5" stroke-linejoin="round"/>`}).join('');
  if(cfg.topper==='tuft')top=`<path d="M104 ${t+10} C96 ${t-8} 108 ${t-22} 116 ${t-30} C116 ${t-18} 124 ${t-14} 128 ${t-26} C136 ${t-16} 142 ${t-4} 136 ${t+10} Z" fill="${P.shade}" stroke="${ol}" stroke-width="3.5" stroke-linejoin="round"/>`;
  let pat='';
  if(cfg.pattern==='belly'){const by=(G.mouthY+206)/2+8;pat=`<ellipse cx="120" cy="${by}" rx="${(G.sideR-G.sideL)*.32}" ry="${206-by+4}" fill="${P.light}"/>`}
  if(cfg.pattern==='spots')pat=[[G.sideL+20,G.eyeY-14,11],[G.sideR-16,G.handY+6,13],[150,t+20,7],[G.sideL+14,G.handY+14,8],[G.sideR-10,G.eyeY+6,6],[96,200,7]]
    .map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${P.shade}" opacity=".75"/>`).join('');
  if(cfg.pattern==='stripes')pat=[-1,1].map(s=>[0,1,2].map(i=>{const x=s<0?G.sideL-6:G.sideR+6,y=G.eyeY+6+i*20;
    return `<path d="M${x} ${y} L${x-s*(26-i*3)} ${y+5} L${x} ${y+11} Z" fill="${P.deep}" opacity=".75"/>`}).join('')).join('')
    +`<path d="M106 ${t+4} L114 ${t+18} L120 ${t+4} L126 ${t+18} L134 ${t+4}" stroke="${P.deep}" stroke-width="5" fill="none" opacity=".6" stroke-linejoin="round"/>`;
  const eyeMk=eyes.map((e,i)=>{const H=2*e.ry+8;return `<g id="${u}eye${i}">
    <clipPath id="${u}ec${i}"><ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}"/></clipPath>
    <ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}" fill="${E.dark?'#16121E':'#fff'}"/>
    <g clip-path="url(#${u}ec${i})">
      <g id="${u}pup${i}">${E.dark?`<circle cx="${e.cx+e.rx*.32}" cy="${e.cy-e.ry*.38}" r="${Math.max(2,e.rx*.36)}" fill="#fff"/>`:
        `<circle cx="${e.cx}" cy="${e.cy+1}" r="${e.ir}" fill="${cfg.eyeColor}"/><circle cx="${e.cx}" cy="${e.cy+1}" r="${e.ir*.56}" fill="#16121E"/>
        <circle cx="${e.cx+e.ir*.38}" cy="${e.cy-e.ir*.38}" r="${Math.max(2.2,e.ir*.3)}" fill="#fff"/><circle cx="${e.cx-e.ir*.35}" cy="${e.cy+e.ir*.42}" r="${Math.max(1.2,e.ir*.13)}" fill="#fff" opacity=".85"/>
        ${E.sparkle?`<ellipse cx="${e.cx}" cy="${e.cy+e.ir*.75}" rx="${e.ir*.7}" ry="${e.ir*.28}" fill="#fff" opacity=".35"/><circle cx="${e.cx-e.ir*.45}" cy="${e.cy-e.ir*.55}" r="${e.ir*.16}" fill="#fff"/>`:''}`}</g>
      <g id="${u}lidT${i}"><rect x="${e.cx-e.rx-3}" y="${e.cy-e.ry-2-H}" width="${2*e.rx+6}" height="${H}" fill="${P.base}"/>
        <path d="M${e.cx-e.rx-3} ${e.cy-e.ry-2} L${e.cx+e.rx+3} ${e.cy-e.ry-2}" stroke="${ol}" stroke-width="3.5"/></g>
      <g id="${u}lidB${i}"><rect x="${e.cx-e.rx-3}" y="${e.cy+e.ry+2}" width="${2*e.rx+6}" height="${H}" fill="${P.base}"/>
        <path d="M${e.cx-e.rx-3} ${e.cy+e.ry+2} L${e.cx+e.rx+3} ${e.cy+e.ry+2}" stroke="${ol}" stroke-width="3"/></g>
    </g>
    ${E.dark?'':`<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}" fill="none" stroke="${ol}" stroke-width="3.5"/>`}</g>
    <path id="${u}hap${i}" d="M${e.cx-e.rx+1} ${e.cy+4} Q${e.cx} ${e.cy-e.ry} ${e.cx+e.rx-1} ${e.cy+4}" stroke="${ol}" stroke-width="5" fill="none" stroke-linecap="round" opacity="0"/>
    <path id="${u}heart${i}" d="${heartD(e.cx,e.cy,Math.max(e.rx,e.ry)*.72)}" fill="#FF4D6D" stroke="${ol}" stroke-width="3" stroke-linejoin="round" opacity="0"/>`}).join('');
  const brows=eyes.map((e,i)=>`<path id="${u}brow${i}" stroke="${ol}" stroke-width="${eyes.length===1?5.5:5}" fill="none" stroke-linecap="round"/>`).join('');
  const cheeks=(eyes.length===2?eyes.map((e,i)=>[e.cx+(i?1:-1)*(e.rx-2),e.cy+e.ry+9]):[[80,G.eyeY+30],[160,G.eyeY+30]])
    .map(([x,y])=>`<ellipse class="cheek" cx="${x}" cy="${y}" rx="10" ry="6" fill="#FF8F9E" opacity=".5"/>`).join('');
  let glasses='',front='',behind='';
  if(cfg.accessory==='glasses'){const r=eyes.map(e=>Math.max(e.rx,e.ry)+5);
    glasses=eyes.map((e,i)=>`<circle cx="${e.cx}" cy="${e.cy}" r="${r[i]}" fill="#fff" fill-opacity=".14" stroke="${ol}" stroke-width="3.5"/>`).join('')+
    (eyes.length===2?`<path d="M${eyes[0].cx+r[0]} ${G.eyeY-3} Q120 ${G.eyeY-9} ${eyes[1].cx-r[1]} ${G.eyeY-3}" stroke="${ol}" stroke-width="3.5" fill="none"/>`:
      `<path d="M${120+r[0]*.7} ${eyes[0].cy+r[0]*.7} Q150 ${G.mouthY+10} 146 ${G.mouthY+30}" stroke="${ol}" stroke-width="2" fill="none"/>`)}
  if(cfg.accessory==='bowtie'){const y=G.mouthY+30;front=`<path d="M120 ${y} L100 ${y-11} L100 ${y+11} Z M120 ${y} L140 ${y-11} L140 ${y+11} Z" fill="${acc}" stroke="${ol}" stroke-width="3.5" stroke-linejoin="round"/><circle cx="120" cy="${y}" r="5.5" fill="${acc}" stroke="${ol}" stroke-width="3.5"/>`}
  if(cfg.accessory==='crown'){const y=t+6;front=`<path d="M98 ${y+6} L94 ${y-18} L108 ${y-6} L120 ${y-24} L132 ${y-6} L146 ${y-18} L142 ${y+6} Z" fill="#FFD34D" stroke="${ol}" stroke-width="3.5" stroke-linejoin="round"/>
    <circle cx="120" cy="${y-4}" r="3.6" fill="#FF4D6D"/><circle cx="105" cy="${y}" r="2.6" fill="#4DA3FF"/><circle cx="135" cy="${y}" r="2.6" fill="#4DA3FF"/>`}
  if(cfg.accessory==='headphones'){const L=G.sideL+2,R=G.sideR-2,y=G.eyeY+2;
    behind=`<path d="M${L} ${y} C${L} ${t-30} ${R} ${t-30} ${R} ${y}" stroke="${ol}" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M${L} ${y} C${L} ${t-30} ${R} ${t-30} ${R} ${y}" stroke="${acc}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    front=[L,R].map(x=>`<rect x="${x-11}" y="${y-18}" width="22" height="36" rx="10" fill="${acc}" stroke="${ol}" stroke-width="3.5"/><rect x="${x-5}" y="${y-11}" width="10" height="22" rx="5" fill="${ol}" opacity=".25"/>`).join('')}
  const paint=sv=>sv.replace(/(fill|stroke)="(outline|body|accent|shade|light)"/g,(m,k,tk)=>k+'="'+({outline:ol,body:P.base,accent:acc,shade:P.shade,light:P.light}[tk])+'"');
  const hat=cfg.hat?`<g id="${u}hat" transform="translate(${120-45} ${t+14-66*.9}) scale(.9)">${paint(cfg.hat)}</g>`:'';
  const item=cfg.item?`<g transform="rotate(-20) translate(-12 -40) scale(.9)">${paint(cfg.item)}</g>`:'';
  const markup=`<defs>
    <radialGradient id="${u}grad" cx=".36" cy=".26" r=".9"><stop offset="0" stop-color="${P.light}"/><stop offset=".55" stop-color="${P.base}"/><stop offset="1" stop-color="${P.shade}"/></radialGradient>
    <clipPath id="${u}bclip"><path d="${G.d}" transform="translate(0 ${sh})"/></clipPath><clipPath id="${u}mclip"><path id="${u}mclipPath"/></clipPath></defs>
  <ellipse id="${u}shadow" cx="120" cy="214" rx="66" ry="7.5" fill="rgba(25,25,60,.18)"/>
  <g id="${u}zzz" font-family="Fredoka, ui-rounded, sans-serif" font-weight="600" fill="${ol}"><text>z</text><text>z</text><text>z</text></g>
  <text id="${u}q" x="${G.sideR-4}" y="${t+4}" font-family="Fredoka, ui-rounded, sans-serif" font-size="34" font-weight="700" fill="${ol}" opacity="0">?</text>
  <g id="${u}dots" fill="${ol}"><circle cx="168" cy="${t-18}" r="5"/><circle cx="184" cy="${t-18}" r="5"/><circle cx="200" cy="${t-18}" r="5"/></g>
  <g id="${u}body">
    <g id="${u}topper">${top}</g>${behind}
    ${cfg.body&&cfg.shape==='custom'&&cfg.body.back?`<g transform="translate(0 ${sh})">${paint(cfg.body.back)}</g>`:''}
    ${cfg.feet==='none'?'':`<ellipse cx="94" cy="205" rx="17" ry="8" fill="${P.shade}" stroke="${ST.oc}" stroke-width="${hw}"/>
    <ellipse cx="146" cy="205" rx="17" ry="8" fill="${P.shade}" stroke="${ST.oc}" stroke-width="${hw}"/>`}
    <path d="${G.d}" fill="${ST.fill}" transform="translate(0 ${sh})"/>
    <g clip-path="url(#${u}bclip)">${pat}${cfg.body&&cfg.shape==='custom'&&cfg.body.marks?`<g transform="translate(0 ${sh})">${paint(cfg.body.marks)}</g>`:''}${ST.inner?`<path d="${G.d}" fill="none" stroke="${P.deep}" stroke-opacity="${ST.inner}" stroke-width="14" transform="translate(4 ${6+sh})"/>`:''}</g>
    <path d="${G.d}" fill="none" stroke="${ST.oc}" stroke-width="${ST.w}" stroke-linejoin="round" transform="translate(0 ${sh})"/>
    ${ST.hl?`<ellipse cx="${120-G.ex-4}" cy="${t+26}" rx="15" ry="7" fill="#fff" opacity=".5" transform="rotate(-28 ${120-G.ex-4} ${t+26})"/>`:''}
    ${hat}
    <g id="${u}face">
      ${cheeks}${eyeMk}${brows}${glasses}
      <path id="${u}mouth" fill="#5B2236"/>
      <g clip-path="url(#${u}mclip)"><ellipse id="${u}tongue" cx="120" cy="${G.mouthY+16}" rx="12" ry="8" fill="#FF7A93"/>${cfg.tooth?`<rect id="${u}tooth" x="114" y="0" width="12" height="9" rx="2" fill="#fff"/>`:''}</g>
      <path id="${u}mouthLine" fill="none" stroke="${ol}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
      <path id="${u}sweat" d="M0 -13 C0 -13 -8 -1 -8 4 C-8 9 -4 12 0 12 C4 12 8 9 8 4 C8 -1 0 -13 0 -13 Z" fill="#8FD3FF" stroke="${ol}" stroke-width="2.5" opacity="0"/>
    </g>${front}
  </g>
  ${[0,1].map(i=>{const nb=cfg.hands==='nub',hide=cfg.hands==='none';return `<g id="${u}hand${i}">${i?item:''}${hide?'':`<ellipse rx="${nb?10:16}" ry="${nb?9:14}" fill="${P.base}" stroke="${ST.oc}" stroke-width="${hw}"/>${ST.hl?`<ellipse cx="${nb?-2.5:-4}" cy="${nb?-2.5:-4}" rx="${nb?3:5}" ry="${nb?2:3}" fill="#fff" opacity=".45"/>`:''}`}</g>`}).join('')}
  <g id="${u}fx"></g>`;
  return {markup,geom:{...G,eyes}};
}

class Spring{constructor(x,k=170,d=20){this.x=x;this.v=0;this.t=x;this.k=k;this.d=d}
  step(dt){const a=this.k*(this.t-this.x)-this.d*this.v;this.v+=a*dt;this.x+=this.v*dt;return this.x}}
const BASE={open:.98,squint:0,happy:0,love:0,pupil:1,browTilt:0,browY:0,skew:0,curve:.55,mouthOpen:0,mouthW:1,blush:.5,sweat:0,tilt:0,droop:0,dots:0,zzz:0,q:0};
const STATES={
  idle:{hands:'rest'},
  thinking:{curve:.05,mouthW:.55,browY:-4,tilt:-4,dots:1,look:[.55,-.85],hands:'chin'},
  success:{happy:1,curve:1,mouthOpen:.7,blush:1,browY:-5,hands:'up'},
  error:{browTilt:14,browY:2,curve:-.75,mouthOpen:.14,mouthW:.8,squint:.2,sweat:1,blush:.15,hands:'cheeks'},
  talking:{curve:.6,blush:.65,browY:-2,hands:'talk'},
  sleeping:{open:.04,curve:.15,mouthOpen:.2,mouthW:.45,blush:.65,tilt:5,droop:1,zzz:1,look:[-.1,.4],hands:'sleep'},
  wave:{curve:.85,mouthOpen:.3,blush:.75,browY:-4,hands:'wave'},
  love:{love:1,curve:.95,mouthOpen:.25,blush:1,browY:-4,tilt:-3,hands:'hug'},
  surprised:{open:1.3,pupil:.62,browY:-9,curve:0,mouthW:.32,mouthOpen:.95,blush:.3,hands:'cheeks'},
  confused:{skew:1,curve:-.12,mouthW:.6,tilt:8,q:1,look:[-.4,-.5],hands:'chin'},
  giggle:{happy:1,curve:1,mouthOpen:.45,blush:1,hands:'cheeks'}
};
function handTargets(mode,g,cover,peek,t,pd){
  const e=g.eyes,L=[g.sideL-2,g.handY],R=[g.sideR+2,g.handY];
  if(cover){let c=e.length===2?[[e[0].cx,e[0].cy],[e[1].cx,e[1].cy]]:[[e[0].cx-13,e[0].cy],[e[0].cx+13,e[0].cy]];
    if(peek)c[0]=[c[0][0]-14,c[0][1]+32];return c}
  if(pd){const side=pd[0]<0?0:1,reach=(side?g.sideR-120:120-g.sideL)+24,res=[L,R];
    res[side]=[120+pd[0]*reach+Math.sin(t*8)*2*RM,g.handY-26+pd[1]*reach*.8];return res}
  switch(mode){
    case 'up':return [[g.sideL-12,g.top+46],[g.sideR+12,g.top+46]];
    case 'cheeks':return [[74,g.mouthY-6],[166,g.mouthY-6]];
    case 'chin':return [L,[140,g.mouthY+20]];
    case 'talk':return [L,[g.sideR+10,g.handY-32+Math.sin(t*6)*7*RM]];
    case 'wave':return [L,[g.sideR+14+Math.sin(t*14)*9*RM,g.top+44+Math.cos(t*14)*3*RM]];
    case 'hug':return [[106,g.mouthY+28],[134,g.mouthY+28]];
    case 'sleep':return [[L[0],L[1]+5],[R[0],R[1]+5]];
    default:return [L,R]}}
let UID=0;
const meas=typeof document!=='undefined'?document.createElement('canvas').getContext('2d'):null;
const POKES=['Boop!','Hee hee, that tickles!','Hey there!','Again? Okay!','You found my button.'];

class Mascot{
  constructor(svg,cfg,opts={}){
    this.svg=svg;this.bubble=opts.bubble||null;this.onState=opts.onState||(()=>{});this.uid='pm'+(++UID)+'_';
    this.sleepAfter=opts.sleepAfter===0?0:(opts.sleepAfter||15000);
    this.s={};for(const k in BASE)this.s[k]=new Spring(BASE[k]);
    this.s.lookX=new Spring(0,140,18);this.s.lookY=new Spring(0,140,18);
    this.hands=[0,1].map(()=>[new Spring(0,220,18),new Spring(0,220,18)]);
    this.squash=new Spring(1,320,13);this.talk=new Spring(0,700,32);
    this.lean=0;this.leanS=new Spring(0,90,12);this.pointDir=null;
    this.look=[0,0];this.state='idle';this.coverOn=false;this.peekOn=false;this.timer=null;this.focusEl=null;
    this.jumpY=0;this.jumpV=0;this.shake=0;this.parts=[];this.t=0;this.nextBlink=1.5;this.blinkStart=-1;this.sayToken=0;
    this.lastAct=performance.now();this.lastPointer=0;this.nextGlance=0;this.pokes=[];
    this.build(cfg,true);
    const on=(el,ev,fn,o)=>{el.addEventListener(ev,fn,o);(this._ls=this._ls||[]).push([el,ev,fn,o])};
    const act=()=>{this.lastAct=performance.now();if(this.state==='sleeping')this._enter('idle','wake')};
    ['pointerdown','keydown','focusin'].forEach(ev=>on(window,ev,act,{passive:true}));
    if(opts.follow!==false)on(window,'pointermove',e=>{act();this.lastPointer=performance.now();if(!this.focusEl&&!(this.focusLook>performance.now()))this.lookAt(e.clientX,e.clientY)},{passive:true});
    if(opts.poke!==false)on(svg,'pointerdown',e=>this.poke(e));
    this._iv=setInterval(()=>this._idleTick(),250);
    this._last=performance.now();this._raf=requestAnimationFrame(this._frame.bind(this));
  }
  destroy(){cancelAnimationFrame(this._raf);clearInterval(this._iv);clearTimeout(this.timer);(this._ls||[]).forEach(([el,ev,fn,o])=>el.removeEventListener(ev,fn,o))}
  build(cfg,first){
    this.cfg=sanitize(cfg);const u=this.uid,{markup,geom}=render(this.cfg,u);this.svg.innerHTML=markup;this.g=geom;
    const q=id=>this.svg.querySelector('#'+u+id);
    this.E={body:q('body'),face:q('face'),mouth:q('mouth'),mclip:q('mclipPath'),mline:q('mouthLine'),tongue:q('tongue'),tooth:q('tooth'),
      sweat:q('sweat'),topper:q('topper'),shadow:q('shadow'),dots:q('dots'),zzz:q('zzz'),q:q('q'),fx:q('fx'),
      cheeks:[...this.svg.querySelectorAll('.cheek')],hands:[q('hand0'),q('hand1')],
      eyes:geom.eyes.map((e,i)=>({...e,g:q('eye'+i),pup:q('pup'+i),lidT:q('lidT'+i),lidB:q('lidB'+i),hap:q('hap'+i),heart:q('heart'+i),brow:q('brow'+i)}))};
    this.svg.setAttribute('aria-label',`${this.cfg.name}, an animated mascot`);
    if(first){const h=handTargets('rest',geom,false,false,0);this.hands.forEach((p,i)=>{p[0].x=p[0].t=h[i][0];p[1].x=p[1].t=h[i][1]})}
    else{this.squash.v-=3.5;this.hop(220)}
  }
  setState(n){clearTimeout(this.timer);this._enter(n)}
  react(n,ms=2300){this._enter(n);clearTimeout(this.timer);this.timer=setTimeout(()=>this._enter('idle'),ms)}
  _enter(n,why){if(!STATES[n])return;const prev=this.state;this.state=n;this.onState(n,why);
    if(n==='success'){this.hop(360);setTimeout(()=>this.hop(250),560);this.burst('confetti')}
    if(n==='error'){this.shake=9;this.squash.v-=3.2}
    if(n==='surprised'){this.hop(200);this.squash.v+=2}
    if(n==='love')this.burst('hearts');
    if(n==='wave')this.hop(120);
    if(prev==='sleeping'&&n!=='sleeping')this.hop(170)}
  lookAt(x,y){const r=this.svg.getBoundingClientRect();if(!r.width)return;const cx=r.left+r.width/2,cy=r.top+r.height*.52;
    this.look=[clamp((x-cx)/(r.width*.85),-1,1),clamp((y-cy)/(r.height*.85),-1,1)]}
  cover(on,peek=false){this.coverOn=on;this.peekOn=peek}
  point(x,y){const r=this.svg.getBoundingClientRect();if(!r.width)return;const dx=x-(r.left+r.width/2),dy=y-(r.top+r.height*.62),L=Math.hypot(dx,dy)||1;
    this.pointDir=[dx/L,dy/L];this.lookAt(x,y);this.focusLook=performance.now()+2500}
  unpoint(){this.pointDir=null}
  lookAtCaret(inp){const r=inp.getBoundingClientRect(),cs=getComputedStyle(inp);if(meas)meas.font=cs.font;
    const txt=inp.type==='password'?'•'.repeat(inp.value.length):inp.value,w=meas?meas.measureText(txt).width:txt.length*8;
    this.lookAt(r.left+parseFloat(cs.paddingLeft||0)+Math.min(w,r.width-24),r.top+r.height/2)}
  bump(){this.squash.v-=1.4}
  hop(v){if(this.jumpY>-1&&this.jumpV>=0)this.jumpV=-v*Math.sqrt(RM)}
  poke(){const now=performance.now();this.pokes=this.pokes.filter(p=>now-p<4000);this.pokes.push(now);this.squash.v-=4;
    if(this.state==='sleeping')return;
    if(this.pokes.length>=5){this.pokes=[];this.react('confused',2400);this.say("Okay, okay! I'm awake!",{hold:1600});return}
    const n=this.pokes.length;if(n===3){this.react('love',1800);this.say('Aww, thanks!',{hold:1200});return}
    this.react(n===1?'surprised':'giggle',n===1?900:1400);this.say(n===1?'Boop!':POKES[1+Math.floor(Math.random()*(POKES.length-1))],{hold:1200})}
  watch(inp){
    const caret=()=>this.lookAtCaret(inp);
    const secret=inp.type==='password';
    inp.addEventListener('focus',()=>{this.focusEl=inp;if(secret)this.cover(true,inp.type==='text');caret()});
    inp.addEventListener('input',()=>{caret();this.bump()});
    inp.addEventListener('blur',()=>{this.focusEl=null;if(secret)setTimeout(()=>{if(document.activeElement!==inp&&!(document.activeElement&&document.activeElement.dataset&&'pipKeep' in document.activeElement.dataset))this.cover(false)},0)});
    return this}
  say(text,{speed=40,hold=2600}={}){if(!this.bubble)return;
    const tok=++this.sayToken,b=this.bubble;b.textContent='';b.classList.add('show');let i=0;
    const tick=()=>{if(tok!==this.sayToken)return;
      if(i>=text.length){this.talk.t=0;setTimeout(()=>{if(tok===this.sayToken)b.classList.remove('show')},hold);return}
      const ch=text[i++];b.textContent=text.slice(0,i);
      this.talk.t=/[aeiouy]/i.test(ch)?.95:/\s/.test(ch)?.05:/[.,!?]/.test(ch)?0:.4;
      setTimeout(tick,/[.,!?]/.test(ch)?speed*4:speed)};tick()}
  burst(kind){if(RM<1)return;const NS='http://www.w3.org/2000/svg';
    if(kind==='hearts'){for(let i=0;i<6;i++){const p=document.createElementNS(NS,'path');p.setAttribute('d',heartD(0,0,6));p.setAttribute('fill','#FF4D6D');
      this.E.fx.appendChild(p);this.parts.push({r:p,x:90+Math.random()*60,y:this.g.top+10,vx:(Math.random()-.5)*40,vy:-60-Math.random()*50,a:0,va:0,life:1.6+i*.1,g:-20})}return}
    const cols=['#FF6B7A','#6E9BFF','#7DDC8A','#FFC23D','#B58CFF',this.cfg.color];
    for(let i=0;i<30;i++){const r=document.createElementNS(NS,'rect');
      r.setAttribute('width',7);r.setAttribute('height',4+Math.random()*5);r.setAttribute('rx',1.5);r.setAttribute('fill',cols[i%cols.length]);
      this.E.fx.appendChild(r);
      this.parts.push({r,x:120,y:this.g.eyeY,vx:(Math.random()-.5)*440,vy:-260-Math.random()*320,a:Math.random()*360,va:(Math.random()-.5)*900,life:1.7,g:900})}}
  _idleTick(){const now=performance.now();
    if(this.state==='idle'&&!this.focusEl&&!this.coverOn&&now-this.lastPointer>3500&&now>this.nextGlance){
      this.look=[(Math.random()-.5)*1.6,(Math.random()-.5)];this.nextGlance=now+1800+Math.random()*2500;
      if(Math.random()<.12)this.hop(110)}
    if(this.sleepAfter&&this.state==='idle'&&!this.focusEl&&!this.coverOn&&now-this.lastAct>this.sleepAfter)this._enter('sleeping','auto')}
  _frame(now){
    const dt=Math.min((now-this._last)/1000,.05);this._last=now;this.t+=dt;const t=this.t,g=this.g,E=this.E;
    const S=STATES[this.state],tg=Object.assign({},BASE,S),sleeping=this.state==='sleeping',cover=this.coverOn&&!sleeping;
    if(cover)Object.assign(tg,{curve:this.peekOn?.75:.35,blush:.95,browY:-3});
    const lk=S.look||this.look;this.s.lookX.t=lk[0];this.s.lookY.t=lk[1];
    for(const k in BASE)this.s[k].t=tg[k];
    const v={};for(const k in this.s)v[k]=this.s[k].step(dt);
    const sq=this.squash.step(dt),talk=clamp(this.talk.step(dt),0,1);this.leanS.t=this.lean;const lean=this.leanS.step(dt);
    const ht=handTargets(S.hands,g,cover,this.peekOn,t,this.pointDir);
    const hp=this.hands.map((p,i)=>{p[0].t=ht[i][0];p[1].t=ht[i][1];return [p[0].step(dt),p[1].step(dt)]});
    if(t>this.nextBlink){this.blinkStart=t;this.nextBlink=t+2+Math.random()*3.5+(Math.random()<.2?-1.7:0)}
    let blink=0;if(this.blinkStart>=0){const p=(t-this.blinkStart)/.15;blink=p<1?(p<.5?p*2:(1-p)*2):0}
    if(this.jumpY<0||this.jumpV<0){this.jumpV+=1500*dt;this.jumpY+=this.jumpV*dt;
      if(this.jumpY>=0){this.jumpY=0;if(this.jumpV>120)this.squash.v-=this.jumpV*.011;this.jumpV=0}}
    this.shake*=Math.pow(.02,dt);const sx0=this.shake*Math.sin(t*55)*RM;
    const giggle=this.state==='giggle'?Math.sin(t*22)*3*RM:0;
    const breathe=(sleeping?Math.sin(t*1.2)*.035:Math.sin(t*2.3)*.017)*RM;
    const air=this.jumpY<0?Math.min(Math.abs(this.jumpV)/2600,.12):0;
    const sy=sq+breathe+air,sxs=1+(1-sy)*.9,fl=this.cfg.feet==='none'?Math.sin(t*2.1)*5*RM-6:0,jy=this.jumpY+fl;
    E.body.setAttribute('transform',`translate(${120+sx0} ${206+jy}) rotate(${v.tilt+giggle+lean}) scale(${sxs} ${sy}) translate(-120 -206)`);
    const lift=Math.min(Math.max(-jy,0)/260,1);
    E.shadow.setAttribute('transform',`translate(120 214) scale(${(1-lift*.45)*sxs} 1) translate(-120 -214)`);E.shadow.setAttribute('opacity',1-lift*.6);
    E.face.setAttribute('transform',`translate(${v.lookX*6} ${v.lookY*4})`);
    const close=clamp(1-v.open*(1-blink),0,1),lo=clamp(v.love,0,1),eo=clamp(Math.min(1-v.happy,1-lo),0,1),pulse=1+Math.sin(t*9)*.09*lo;
    for(const e of E.eyes){
      e.lidT.setAttribute('transform',`translate(0 ${close*(2*e.ry+5)})`);
      e.lidB.setAttribute('transform',`translate(0 ${-clamp(v.squint,0,1)*e.ry*.9})`);
      e.pup.setAttribute('transform',`translate(${v.lookX*e.rx*.42} ${v.lookY*e.ry*.36}) translate(${e.cx} ${e.cy}) scale(${v.pupil}) translate(${-e.cx} ${-e.cy})`);
      e.g.setAttribute('opacity',eo);e.hap.setAttribute('opacity',clamp(v.happy,0,1)*(1-lo));
      e.heart.setAttribute('opacity',lo);e.heart.setAttribute('transform',`translate(${e.cx} ${e.cy}) scale(${pulse}) translate(${-e.cx} ${-e.cy})`)}
    const by=v.browY+(1-Math.min(v.open,1))*3,one=E.eyes.length===1;
    E.eyes.forEach((e,i)=>{const s=i?1:-1,y=e.cy-e.ry-10+by+(one?0:s*v.skew*5)-(one?v.skew*4:0),w=e.rx+5;
      if(one){e.brow.setAttribute('d',`M${e.cx-w} ${y+v.browTilt*.3+v.skew*6} Q${e.cx} ${y-5-v.browTilt} ${e.cx+w} ${y+v.browTilt*.3-v.skew*4}`);return}
      const inner=e.cx-s*w*.85,outer=e.cx+s*w;
      e.brow.setAttribute('d',`M${outer} ${y+v.browTilt*.25} Q${e.cx} ${y-7-v.browTilt*.2} ${inner} ${y-v.browTilt*.7}`)});
    const mo=Math.max(v.mouthOpen,talk*.75),cx=120,cy=g.mouthY,w=17*v.mouthW+6,c=v.curve*12,o=mo*22,sk=v.skew*4;
    const md=`M${cx-w} ${cy-c*.3+sk} Q${cx} ${cy+c} ${cx+w} ${cy-c*.3-sk} Q${cx} ${cy+c+o+2} ${cx-w} ${cy-c*.3+sk} Z`;
    E.mouth.setAttribute('d',md);E.mclip.setAttribute('d',md);E.mline.setAttribute('d',md);
    if(E.tongue)E.tongue.setAttribute('cy',cy+c*.6+o*.75);
    if(E.tooth){E.tooth.setAttribute('y',cy+c*.35-1);E.tooth.setAttribute('opacity',clamp(o/4,0,1))}
    const bl=clamp(v.blush,0,1)*.75;E.cheeks.forEach(k=>k.setAttribute('opacity',bl));
    const sw=clamp(v.sweat,0,1);E.sweat.setAttribute('opacity',sw);
    E.sweat.setAttribute('transform',`translate(${g.sideR-20} ${g.eyeY-30+(1-sw)*-8+((t*8)%6)*sw})`);
    E.topper.setAttribute('transform',`rotate(${Math.sin(t*1.7)*3.5*RM+v.tilt*.6+v.droop*(this.cfg.topper==='sprout'?30:10)} 120 ${g.top+8})`);
    const qa=clamp(v.q,0,1);E.q.setAttribute('opacity',qa);E.q.setAttribute('transform',`translate(0 ${Math.sin(t*3)*3*RM+jy}) rotate(${12+Math.sin(t*2)*6} ${g.sideR+6} ${g.top-6})`);
    const hb=jy*.92-breathe*60;
    E.hands.forEach((h,i)=>h.setAttribute('transform',`translate(${hp[i][0]+sx0} ${hp[i][1]+hb}) rotate(${i?20:-20})`));
    const d=clamp(v.dots,0,1);E.dots.setAttribute('opacity',d);
    [...E.dots.children].forEach((c2,i)=>c2.setAttribute('transform',`translate(0 ${Math.sin(t*7-i*.9)*4*RM})`));
    const z=clamp(v.zzz,0,1);
    [...E.zzz.children].forEach((tx,i)=>{const p=(t*.45+i/3)%1;tx.setAttribute('x',156+p*34);tx.setAttribute('y',g.top+10-p*46);
      tx.setAttribute('font-size',12+p*12);tx.setAttribute('opacity',z*Math.sin(p*Math.PI))});
    this.parts=this.parts.filter(p=>{p.life-=dt;p.vy+=p.g*dt;p.vx*=Math.pow(.4,dt);p.x+=p.vx*dt;p.y+=p.vy*dt;p.a+=p.va*dt;
      p.r.setAttribute('transform',`translate(${p.x+(p.g<0?Math.sin(t*4+p.life*3)*6:0)} ${p.y}) rotate(${p.a})`);p.r.setAttribute('opacity',clamp(p.life*1.5,0,1));
      if(p.life<=0){p.r.remove();return false}return true});
    this._raf=requestAnimationFrame(this._frame.bind(this));
  }
}
return {Mascot,sanitize,cleanSvg,palette,hsl,hexToHsl,OPT,STATES:Object.keys(STATES).filter(s=>s!=='giggle'),RM};
})();
(function definePipElement(engine,defaultConfig){
  if(typeof customElements==='undefined'||customElements.get('pip-mascot'))return;
  const RM=engine.RM,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wait=ms=>new Promise(r=>setTimeout(r,ms)),pick=a=>a[Math.floor(Math.random()*a.length)];
  const RATIO=254/240;
  class PipMascot extends HTMLElement{
    static get observedAttributes(){return ['state']}
    connectedCallback(){
      if(this._m)return;const root=this.shadowRoot||this.attachShadow({mode:'open'});
      this._float=this.hasAttribute('float')||this.hasAttribute('autopilot');
      root.innerHTML=`<style>:host{display:inline-block;position:relative;width:var(--pip-size,${this._float?'118px':'180px'});vertical-align:bottom;-webkit-tap-highlight-color:transparent}
        svg{width:100%;height:auto;display:block;overflow:visible;cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none}
        .bubble{position:absolute;left:50%;bottom:94%;transform:translate(-50%,4px);max-width:210px;width:max-content;background:var(--pip-bubble-bg,#fff);color:var(--pip-bubble-ink,#1B1A26);
          border:2px solid #2A2140;border-radius:14px;padding:6px 10px;font:500 14px/1.35 system-ui,-apple-system,sans-serif;opacity:0;transition:opacity .18s,transform .18s;pointer-events:none;box-shadow:0 4px 14px -6px rgba(20,20,50,.35)}
        .bubble.show{opacity:1;transform:translate(-50%,0)}
        .bubble.r{left:auto;right:4px;transform:translate(0,4px)}.bubble.l{left:4px;transform:translate(0,4px)}.bubble.r.show,.bubble.l.show{transform:none}
        .bubble.below{bottom:auto;top:92%}
        @media (prefers-reduced-motion: reduce){.bubble{transition:none}}</style>
        <div class="bubble" part="bubble" aria-live="polite"></div><svg viewBox="0 -22 240 254" role="img"></svg>`;
      let cfg=defaultConfig;try{const a=this.getAttribute('config');if(a)cfg=JSON.parse(a)}catch(e){}
      const sa=this.getAttribute('sleep-after');
      const m=this._m=new engine.Mascot(root.querySelector('svg'),cfg,{bubble:root.querySelector('.bubble'),sleepAfter:sa===null?20000:Number(sa)*1000,
        onState:(s,why)=>this.dispatchEvent(new CustomEvent('statechange',{detail:{state:s,reason:why||null}}))});
      const say=m.say.bind(m);m.say=(t,o)=>{this._placeBubble();return say(t,o)};
      const st=this.getAttribute('state');if(st)m.setState(st);
      const greet=()=>{if(this.hasAttribute('greet')&&this._m){m.react('wave',2000);m.say(m.cfg.greeting,{hold:2600})}};
      if(this._float){
        Object.assign(this.style,{position:'fixed',left:'0',top:'0',margin:'0',zIndex:'2147483000',visibility:'hidden'});
        this._pos=[0,0];this._docked=true;
        this._onResize=()=>{if(this._docked&&!this._walking){const d=this._dock();this._setPos(d[0],d[1])}};addEventListener('resize',this._onResize);
        requestAnimationFrame(()=>{const d=this._dock();this._setPos(d[0],innerHeight+20);this.style.visibility='';
          this.walkTo(d[0],d[1],{ms:700,hops:false}).then(()=>{this._docked=true;setTimeout(greet,150)})});
      }else setTimeout(greet,500);
      if(this.hasAttribute('autopilot'))this._ap=autopilot(this);
    }
    disconnectedCallback(){if(this._ap){this._ap();this._ap=null}if(this._m){this._m.destroy();this._m=null}
      if(this._onResize)removeEventListener('resize',this._onResize);clearTimeout(this._homeT);this._walkTok=(this._walkTok||0)+1}
    attributeChangedCallback(n,o,v){if(this._m&&n==='state'&&v)this._m.setState(v)}
    _size(){const w=this.getBoundingClientRect().width||118;return [w,w*RATIO]}
    _dock(){const [w,h]=this._size();return [innerWidth-w-10,innerHeight-h-6]}
    _setPos(x,y){this._pos=[x,y];this.style.transform=`translate(${x}px,${y}px)`;this._placeBubble()}
    _placeBubble(){const b=this.shadowRoot&&this.shadowRoot.querySelector('.bubble');if(!b)return;const r=this.getBoundingClientRect(),c=r.left+r.width/2;
      b.classList.toggle('below',r.top<90);b.classList.toggle('r',c>innerWidth*.6);b.classList.toggle('l',c<innerWidth*.4)}
    walkTo(x,y,{ms,hops=true}={}){
      if(!this._float||!this._m)return Promise.resolve();const m=this._m,[x0,y0]=this._pos,dist=Math.hypot(x-x0,y-y0);
      const tok=this._walkTok=(this._walkTok||0)+1;this._docked=false;
      if(dist<3){this._setPos(x,y);return Promise.resolve()}
      ms=ms||clamp(dist/.6,380,1500);if(RM<1)ms=Math.min(ms,300);this._walking=true;m.lean=Math.sign(x-x0)*9;
      return new Promise(res=>{const t0=performance.now();let lastHop=-1e9;
        const step=now=>{if(tok!==this._walkTok||!this._m){this._walking=false;return res()}
          const p=clamp((now-t0)/ms,0,1),e=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;this._setPos(x0+(x-x0)*e,y0+(y-y0)*e);
          if(hops&&now-lastHop>300&&p<.85){m.hop(150);lastHop=now}
          if(p<1)requestAnimationFrame(step);else{m.lean=0;this._walking=false;res()}};
        requestAnimationFrame(step)})}
    async goTo(el,{mode='point',text,state,stay}={}){
      if(!this._float||!el||!this._m)return;clearTimeout(this._homeT);this._goAt=Date.now();this._m.unpoint();
      let r=el.getBoundingClientRect();
      if(r.bottom<60||r.top>innerHeight-60){el.scrollIntoView({block:'center',behavior:RM<1?'auto':'smooth'});await wait(480);r=el.getBoundingClientRect();this._goAt=Date.now()}
      const [w,h]=this._size();let x,y;
      if(mode==='sit'){x=r.left+r.width/2-w/2;y=r.top-h*.93+4}
      else{y=r.top+r.height/2-h*.6;if(r.right+w+6<innerWidth)x=r.right+4;else if(r.left-w-6>0)x=r.left-w-4;
        else{x=clamp(r.left+r.width-w*.8,4,innerWidth-w-4);y=r.top-h*.98;if(y<4)y=r.bottom+2}}
      x=clamp(x,4,innerWidth-w-4);y=clamp(y,4,innerHeight-h-4);
      await this.walkTo(x,y);if(!this._m)return;
      if(mode==='point'){const c=el.getBoundingClientRect();this._m.point(c.left+c.width/2,c.top+c.height/2)}
      if(state)this._m.react(state,2600);if(text)this._m.say(text,{hold:2600});
      if(!stay)this._homeT=setTimeout(()=>this.home(),Math.max(3400,(text||'').length*45+2600))}
    home(){clearTimeout(this._homeT);if(!this._float||!this._m)return Promise.resolve();this._m.unpoint();const d=this._dock();
      return this.walkTo(d[0],d[1]).then(()=>{if(this._m&&!this._walking)this._docked=true})}
    setState(s){this._m&&this._m.setState(s)} react(s,ms){this._m&&this._m.react(s,ms)} say(t,o){this._m&&this._m.say(t,o)}
    cover(on,peek){this._m&&this._m.cover(on,peek)} lookAt(x,y){this._m&&this._m.lookAt(x,y)} watch(input){this._m&&this._m.watch(input);return this}
    point(el,text){return this.goTo(el,{text})}
    get state(){return this._m?this._m.state:null}
  }

  /* Autopilot: watches the page and reacts with zero setup. */
  function autopilot(host){
    const offs=[],on=(t,ev,fn,o)=>{t.addEventListener(ev,fn,o);offs.push(()=>t.removeEventListener(ev,fn,o))};
    const M=()=>host._m,mine=e=>!!(e.composedPath&&e.composedPath().includes(host));
    const log=(signal,action)=>host.dispatchEvent(new CustomEvent('pip:autopilot',{detail:{signal,action,time:Date.now()}}));
    const short=u=>{try{return new URL(u,location.href).pathname}catch(e){return String(u).slice(0,40)}};
    const label=el=>{try{return ((el.labels&&el.labels[0]&&el.labels[0].textContent)||el.getAttribute('aria-label')||el.name||el.placeholder||el.type||'field').trim().slice(0,40)}catch(e){return 'field'}};
    let lastAlert=0,lastSubmit=null,lastClick=null;
    const recentTarget=()=>{const n=Date.now();if(lastSubmit&&n-lastSubmit.t<8000)return lastSubmit.btn;if(lastClick&&n-lastClick.t<4000)return lastClick.btn;return null};

    /* network: fetch + XHR */
    let pending=0,batchErr=null,batchWrite=false,thinkT=null,thinking=false,lastReq=null;
    const begin=(method,url)=>{pending++;lastReq={method,url};if(method!=='GET')batchWrite=true;
      if(pending===1){clearTimeout(thinkT);thinkT=setTimeout(()=>{const m=M();if(pending>0&&m&&(m.state==='idle'||m.state==='sleeping')){m.setState('thinking');thinking=true;log(`Waiting on ${method} ${short(url)}`,'thinking')}},350)}};
    const end=(method,url,err)=>{pending=Math.max(0,pending-1);if(err!=null&&!batchErr)batchErr={method,url,err};
      if(pending)return;clearTimeout(thinkT);const e=batchErr,w=batchWrite,wasT=thinking,lr=lastReq;batchErr=null;batchWrite=false;thinking=false;
      setTimeout(()=>{const m=M();if(!m)return;
        if(e){log(`${e.method} ${short(e.url)} failed (${e.err==='network'?'no connection':e.err})`,'error');
          if(Date.now()-lastAlert<1500){if(m.state==='thinking')m.setState('idle');return}
          const msg=e.err==='network'?'I couldn’t reach the server.':`${e.method==='GET'?'That didn’t load':'That didn’t save'} (error ${e.err}).`;
          m.react('error',2600);const tgt=recentTarget();lastSubmit=null;if(tgt)host.goTo(tgt,{text:msg});else m.say(msg,{hold:2400})}
        else if(w){log(`${lr.method} ${short(lr.url)} succeeded`,'success');const wasForm=lastSubmit&&Date.now()-lastSubmit.t<8000,tgt=recentTarget();lastSubmit=null;
          const msg=wasForm?pick(['Done! You’re in.','All set!','Nailed it!']):pick(['Saved!','Got it, saved.','Done!']);
          if(tgt){m.setState('idle');host.goTo(tgt,{mode:'sit',state:'success',text:msg})}else{m.react('success',1800);m.say(msg,{hold:1400})}}
        else if(wasT){log(`${lr.method} ${short(lr.url)} loaded`,'idle');m.setState('idle')}},260)};
    const of=window.fetch;
    if(of&&!of.__pip){const wf=function(input,init){let url='',method='GET';
        try{url=typeof input==='string'?input:(input&&input.url)||String(input);method=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase()}catch(e){}
        begin(method,url);
        return of.apply(this,arguments).then(r=>{end(method,url,r.ok?null:r.status);return r},er=>{end(method,url,'network');throw er})};
      wf.__pip=true;window.fetch=wf;offs.push(()=>{if(window.fetch===wf)window.fetch=of})}
    const XP=window.XMLHttpRequest&&XMLHttpRequest.prototype;
    if(XP&&!XP.__pipOpen){const oo=XP.open,os=XP.send;XP.__pipOpen=true;
      XP.open=function(mt,u){this.__pipReq=[String(mt).toUpperCase(),String(u)];return oo.apply(this,arguments)};
      XP.send=function(){const [mt,u]=this.__pipReq||['GET',''];begin(mt,u);
        this.addEventListener('loadend',()=>end(mt,u,this.status===0?'network':(this.status>=400?this.status:null)),{once:true});return os.apply(this,arguments)};
      offs.push(()=>{XP.open=oo;XP.send=os;delete XP.__pipOpen})}

    /* forms */
    let invalids=[],invT=null;
    on(document,'invalid',e=>{invalids.push(e.target);clearTimeout(invT);invT=setTimeout(()=>{const el=invalids[0];invalids=[];const m=M();if(!el||!m)return;
      log(`Form check failed: ${label(el)}`,'point');m.react('error',2400);host.goTo(el,{text:el.validationMessage||'This one needs a look.'})},40)},true);
    on(document,'submit',e=>{const f=e.target;lastSubmit={t:Date.now(),btn:e.submitter||(f.querySelector&&f.querySelector('[type=submit],button:not([type])'))||f}},true);

    /* error messages that appear on screen */
    const seen=new WeakMap();let scanT=null;
    const alerts=()=>Array.from(document.querySelectorAll('[role="alert"],[aria-live="assertive"]')).filter(el=>!host.contains(el));
    alerts().forEach(el=>seen.set(el,(el.textContent||'').trim()));
    const scan=()=>{for(const el of alerts()){const t=(el.textContent||'').trim();if(seen.get(el)===t)continue;seen.set(el,t);
      if(t&&el.getClientRects().length&&M()){lastAlert=Date.now();log(`Error message appeared: “${t.slice(0,60)}”`,'point');M().react('error',2600);host.goTo(el,{text:t.slice(0,110)});break}}};
    if(typeof MutationObserver!=='undefined'&&document.body){const mo=new MutationObserver(()=>{clearTimeout(scanT);scanT=setTimeout(scan,60)});
      mo.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','class','style']});offs.push(()=>mo.disconnect())}

    /* text fields: eyes follow typing, password = cover eyes */
    const isField=el=>el&&(el.tagName==='INPUT'||el.tagName==='TEXTAREA')&&!/^(checkbox|radio|button|submit|reset|range|color|file|hidden)$/i.test(el.type||'');
    const secret=el=>el&&(el.__pipSecret||(el.type==='password'&&(el.__pipSecret=true)));
    const sync=()=>{const m=M(),a=document.activeElement;if(!m)return;if(a&&isField(a)&&secret(a))m.cover(true,a.type!=='password');else m.cover(false)};
    on(document,'focusin',e=>{const el=e.target,m=M();if(!m||mine(e)||!isField(el))return;m.focusEl=el;sync();m.lookAtCaret(el)},true);
    on(document,'input',e=>{const el=e.target,m=M();if(!m||!isField(el)||m.focusEl!==el)return;m.lookAtCaret(el);m.bump();sync()},true);
    on(document,'focusout',e=>{const m=M();if(!m||m.focusEl!==e.target)return;m.focusEl=null;setTimeout(sync,0)},true);

    /* clicks: rage-click detection + remember what was pressed */
    let clicks=[];
    on(document,'click',e=>{if(mine(e))return;const n=Date.now(),btn=e.target&&e.target.closest&&e.target.closest('button,[role=button],a,input[type=submit]');
      if(btn)lastClick={t:n,btn};setTimeout(sync,0);
      clicks=clicks.filter(c=>n-c.t<1100&&Math.hypot(c.x-e.clientX,c.y-e.clientY)<70);clicks.push({t:n,x:e.clientX,y:e.clientY});
      if(clicks.length>=4&&M()){clicks=[];log('Rage clicks detected','confused');M().react('confused',2800);
        host.goTo(btn||e.target,{text:pick(['Whoa, easy! Is that one stuck?','Something not working? I saw that.','Deep breaths. Want me to report it?'])})}},true);

    /* tab switch, connection, crashes, copy */
    let hiddenAt=0;
    on(document,'visibilitychange',()=>{if(document.hidden){hiddenAt=Date.now();return}const m=M();
      if(hiddenAt&&m&&Date.now()-hiddenAt>2500){const s=Math.round((Date.now()-hiddenAt)/1000);log(`You came back after ${s}s away`,'wave');
        m.react('wave',2200);m.say(s>60?'There you are! I missed you.':pick(['Welcome back!','Oh hi, you’re back!']),{hold:1800})}hiddenAt=0});
    on(window,'offline',()=>{const m=M();if(!m)return;log('Internet connection lost','error');m.react('error',3200);m.say('We’re offline. I’ll wait right here.',{hold:2800})});
    on(window,'online',()=>{const m=M();if(!m)return;log('Back online','success');m.react('success',1800);m.say('We’re back online!',{hold:1600})});
    const crash=msg=>{const m=M();if(!m)return;log('Script error: '+String(msg||'').slice(0,60),'error');m.react('error',2400);m.say('Oops, something broke behind the scenes.',{hold:2000})};
    on(window,'error',e=>{if(e&&e.target&&e.target!==window)return;crash(e&&e.message)});
    on(window,'unhandledrejection',e=>crash(e&&e.reason&&(e.reason.message||e.reason)));
    on(document,'copy',e=>{const m=M();if(!m||mine(e))return;log('Text copied','love');m.react('love',1400);m.say('Copied!',{hold:900})});
    on(window,'scroll',()=>{if(!host._docked&&!host._walking&&Date.now()-(host._goAt||0)>1200)host.home()},{passive:true});
    log('Autopilot is on and watching this page','wave');
    return ()=>{offs.forEach(f=>f());clearTimeout(thinkT);clearTimeout(invT);clearTimeout(scanT)};
  }
  customElements.define('pip-mascot',PipMascot);
})(engine, {"name":"Pip","shape":"bean","color":"#FFC23D","accent":"#6BCB77","eyeColor":"#5A3A1E","topper":"sprout","eyes":"round","pattern":"none","accessory":"none","tooth":false,"hat":"","item":"","greeting":"Hi, I'm Pip!"});
})();
