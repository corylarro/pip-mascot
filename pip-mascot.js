/*! pip-mascot.js · Pip mascot runtime
 * Usage:
 *   <script src="https://pip-mascot.vercel.app/pip-mascot.js"></script>
 *   <pip-mascot autopilot greet></pip-mascot>                 (vector mascot)
 *   <pip-mascot mascot="YOUR_ID" autopilot greet></pip-mascot> (painted mascot made at pip-mascot.vercel.app/paint)
 * Methods: setState(s), react(s, ms), say(text), point(element, text), home(), watch(input)
 */
(function(){
"use strict";
var origin=(document.currentScript&&document.currentScript.src)?new URL(document.currentScript.src).origin:'https://pip-mascot.vercel.app';
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
    outline:hsl(h,clamp(s*.55,22,48),15),back:hsl(h,s,l-8)}}

const OPT={shape:['bean','round','tall','cube','pear','custom'],topper:['none','sprout','antenna','cat','bunny','horns','tuft'],
  eyes:['round','tall','small','dot','anime','cyclops'],pattern:['none','belly','spots','stripes'],accessory:['none','glasses','bowtie','crown','headphones'],
  style:['3d','plush','glossy','flat','soft','bold'],hands:['mitten','nub','none'],feet:['feet','none']};
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
    back:cleanSvg(b.back),marks:cleanSvg(b.marks),
    parts:Array.isArray(b.parts)?b.parts.slice(0,10).map(p=>p&&typeof p==='object'?{svg:cleanSvg(p.svg),pivot:[num(p.pivot&&p.pivot[0],0,240,120),num(p.pivot&&p.pivot[1],-20,240,120)],
      motion:MOTIONS.includes(p.motion)?p.motion:'sway'}:null).filter(p=>p&&p.svg):[]}}
const MOTIONS=['flap','wag','sway','twitch','bob','none'];
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
    soft:{fill:`url(#${u}grad)`,w:3,inner:.22,hl:true,oc:P.deep},
    '3d':{fill:P.base,w:2.2,inner:0,hl:false,oc:P.deep,fx:`url(#${u}lit)`},plush:{fill:P.base,w:0,inner:0,hl:false,oc:P.shade,fx:`url(#${u}fur)`},bold:{fill:P.base,w:7,inner:.5,hl:true,oc:ol}}[cfg.style]||{fill:`url(#${u}grad)`,w:4.5,inner:.35,hl:true,oc:ol};
  const hw=Math.max(3,ST.w*.85);const ih=hexToHsl(cfg.eyeColor),irisL=hsl(ih[0],Math.min(ih[1]+10,90),Math.min(ih[2]+24,70)),irisD=hsl(ih[0],ih[1],Math.max(ih[2]-10,6));
  let top='';const parts=[];
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
  if(cfg.topper==='sprout'||cfg.topper==='antenna'){parts.push({svg:top,pivot:[120,t+8],motion:'bob',shift:0});top=''}
  if(cfg.topper==='cat'||cfg.topper==='bunny'){top='';
    [-1,1].forEach(s2=>{if(cfg.topper==='cat'){const x=120+s2*G.ex;parts.push({motion:'twitch',pivot:[x,t+16],svg:`<path d="M${x-s2*18} ${t+28} L${x-s2*6} ${t-20} L${x+s2*22} ${t+12} Z" fill="${P.base}" stroke="${ol}" stroke-width="4" stroke-linejoin="round"/><path d="M${x-s2*9} ${t+19} L${x-s2*5} ${t-6} L${x+s2*11} ${t+12} Z" fill="#FF9EB1"/>`})}
      else{const x=120+s2*(G.ex-10);parts.push({motion:'twitch',pivot:[x,t+12],svg:`<g transform="rotate(${s2*12} ${x} ${t+10})"><ellipse cx="${x}" cy="${t-24}" rx="12" ry="32" fill="${P.base}" stroke="${ol}" stroke-width="4"/><ellipse cx="${x}" cy="${t-20}" rx="5.5" ry="22" fill="#FF9EB1"/></g>`})}})}
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
        `<circle cx="${e.cx}" cy="${e.cy+1}" r="${e.ir}" fill="url(#${u}iris)"/><circle cx="${e.cx}" cy="${e.cy+1}" r="${e.ir*.94}" fill="none" stroke="${irisD}" stroke-width="${Math.max(1,e.ir*.13)}" opacity=".8"/><circle cx="${e.cx}" cy="${e.cy+1}" r="${e.ir*.52}" fill="#16121E"/>
        <circle cx="${e.cx+e.ir*.38}" cy="${e.cy-e.ir*.38}" r="${Math.max(2.2,e.ir*.3)}" fill="#fff"/><circle cx="${e.cx-e.ir*.35}" cy="${e.cy+e.ir*.42}" r="${Math.max(1.2,e.ir*.13)}" fill="#fff" opacity=".85"/>
        ${E.sparkle?`<ellipse cx="${e.cx}" cy="${e.cy+e.ir*.75}" rx="${e.ir*.7}" ry="${e.ir*.28}" fill="#fff" opacity=".35"/><circle cx="${e.cx-e.ir*.45}" cy="${e.cy-e.ir*.55}" r="${e.ir*.16}" fill="#fff"/>`:''}`}</g>
      <g id="${u}lidT${i}"><rect x="${e.cx-e.rx-3}" y="${e.cy-e.ry-2-H}" width="${2*e.rx+6}" height="${H}" fill="${P.base}"/>
        <rect x="${e.cx-e.rx-3}" y="${e.cy-e.ry-2}" width="${2*e.rx+6}" height="${Math.max(5,e.ry*.45)}" fill="url(#${u}lidsh)"/>
        <path d="M${e.cx-e.rx-3} ${e.cy-e.ry-2} L${e.cx+e.rx+3} ${e.cy-e.ry-2}" stroke="${ol}" stroke-width="3.5"/></g>
      <g id="${u}lidB${i}"><rect x="${e.cx-e.rx-3}" y="${e.cy+e.ry+2}" width="${2*e.rx+6}" height="${H}" fill="${P.base}"/>
        <path d="M${e.cx-e.rx-3} ${e.cy+e.ry+2} L${e.cx+e.rx+3} ${e.cy+e.ry+2}" stroke="${ol}" stroke-width="3"/></g>
    </g>
    ${E.dark?'':`<ellipse cx="${e.cx-e.rx*.2}" cy="${e.cy-e.ry*.42}" rx="${e.rx*.62}" ry="${e.ry*.3}" fill="#fff" opacity=".22"/><ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}" fill="none" stroke="${ol}" stroke-width="${cfg.style==='3d'||cfg.style==='plush'?2.6:3.5}"/>`}</g>
    <path id="${u}hap${i}" d="M${e.cx-e.rx+1} ${e.cy+4} Q${e.cx} ${e.cy-e.ry} ${e.cx+e.rx-1} ${e.cy+4}" stroke="${ol}" stroke-width="5" fill="none" stroke-linecap="round" opacity="0"/>
    <path id="${u}heart${i}" d="${heartD(e.cx,e.cy,Math.max(e.rx,e.ry)*.72)}" fill="#FF4D6D" stroke="${ol}" stroke-width="3" stroke-linejoin="round" opacity="0"/>`}).join('');
  const brows=eyes.map((e,i)=>`<path id="${u}brow${i}" stroke="${ol}" stroke-width="${eyes.length===1?5.5:5}" fill="none" stroke-linecap="round"/>`).join('');
  const cheeks=(eyes.length===2?eyes.map((e,i)=>[e.cx+(i?1:-1)*(e.rx-2),e.cy+e.ry+9]):[[80,G.eyeY+30],[160,G.eyeY+30]])
    .map(([x,y])=>`<ellipse class="cheek" cx="${x}" cy="${y}" rx="13" ry="8" fill="url(#${u}cheek)" opacity=".5"/>`).join('');
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
  if(cfg.shape==='custom'&&cfg.body&&cfg.body.parts)cfg.body.parts.forEach(p=>parts.push({svg:p.svg,pivot:[p.pivot[0],p.pivot[1]+sh],motion:p.motion,shift:sh,ai:true}));
  const pol=cfg.style==='plush'?P.deep:ol;
  const paint=sv=>sv.replace(/(fill|stroke)="(outline|body|accent|shade|light)"/g,(m,k,tk)=>k+'="'+({outline:ol,body:P.base,accent:acc,shade:P.shade,light:P.light}[tk])+'"');
  const paintB=sv=>sv.replace(/(fill|stroke)="(outline|body|accent|shade|light)"/g,(m,k,tk)=>k+'="'+({outline:pol,body:P.back,accent:acc,shade:P.shade,light:P.light}[tk])+'"');
  const partMk=parts.map((p,i)=>`<g id="${u}part${i}"><g transform="translate(0 ${p.ai?sh:0})">${p.ai?paintB(p.svg):p.svg}</g></g>`).join('');
  const hat=cfg.hat?`<g id="${u}hat" transform="translate(${120-45} ${t+14-66*.9}) scale(.9)">${paint(cfg.hat)}</g>`:'';
  const item=cfg.item?`<g transform="rotate(-20) translate(-12 -40) scale(.9)">${paint(cfg.item)}</g>`:'';
  const markup=`<defs>
    <radialGradient id="${u}grad" cx=".36" cy=".26" r=".9"><stop offset="0" stop-color="${P.light}"/><stop offset=".55" stop-color="${P.base}"/><stop offset="1" stop-color="${P.shade}"/></radialGradient>
    <radialGradient id="${u}iris" cx=".5" cy=".38" r=".62"><stop offset="0" stop-color="${irisL}"/><stop offset=".72" stop-color="${cfg.eyeColor}"/><stop offset="1" stop-color="${irisD}"/></radialGradient>
    <radialGradient id="${u}cheek"><stop offset="0" stop-color="#FF7F95" stop-opacity=".95"/><stop offset="1" stop-color="#FF7F95" stop-opacity="0"/></radialGradient>
    <filter id="${u}lit" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="11" result="h"/>
      <feDiffuseLighting in="h" surfaceScale="4.5" diffuseConstant="1.08" lighting-color="#ffffff" result="d"><feDistantLight azimuth="235" elevation="52"/></feDiffuseLighting>
      <feComposite in="d" in2="SourceAlpha" operator="in" result="di"/>
      <feBlend in="SourceGraphic" in2="di" mode="multiply" result="sh"/>
      <feSpecularLighting in="h" surfaceScale="4.5" specularConstant=".8" specularExponent="22" lighting-color="#ffffff" result="sp"><fePointLight x="70" y="30" z="160"/></feSpecularLighting>
      <feComposite in="sp" in2="SourceAlpha" operator="in" result="spi"/>
      <feComposite in="sh" in2="spi" operator="arithmetic" k1="0" k2="1" k3=".7" k4="0"/></filter>
    <filter id="${u}fur" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="2" seed="4" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G" result="fz"/>
      <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="h"/>
      <feDiffuseLighting in="h" surfaceScale="4" diffuseConstant="1.12" lighting-color="#ffffff" result="d"><feDistantLight azimuth="235" elevation="55"/></feDiffuseLighting>
      <feComposite in="d" in2="fz" operator="in" result="di"/>
      <feBlend in="fz" in2="di" mode="multiply" result="sh"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0" result="spk"/>
      <feComposite in="spk" in2="fz" operator="in" result="spki"/>
      <feMerge><feMergeNode in="sh"/><feMergeNode in="spki"/></feMerge></filter>
    <linearGradient id="${u}lidsh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A1A30" stop-opacity=".35"/><stop offset="1" stop-color="#2A1A30" stop-opacity="0"/></linearGradient>
    <filter id="${u}blur" x="-30%" y="-200%" width="160%" height="500%"><feGaussianBlur stdDeviation="3.2"/></filter>
    <clipPath id="${u}bclip"><path d="${G.d}" transform="translate(0 ${sh})"/></clipPath><clipPath id="${u}mclip"><path id="${u}mclipPath"/></clipPath></defs>
  <g id="${u}shadow"><ellipse cx="120" cy="213" rx="70" ry="9" fill="rgba(25,25,60,.22)" filter="url(#${u}blur)"/><ellipse cx="120" cy="209" rx="44" ry="4" fill="rgba(25,25,60,.18)"/></g>
  <g id="${u}zzz" font-family="Fredoka, ui-rounded, sans-serif" font-weight="600" fill="${ol}"><text>z</text><text>z</text><text>z</text></g>
  <text id="${u}q" x="${G.sideR-4}" y="${t+4}" font-family="Fredoka, ui-rounded, sans-serif" font-size="34" font-weight="700" fill="${ol}" opacity="0">?</text>
  <g id="${u}dots" fill="${ol}"><circle cx="168" cy="${t-18}" r="5"/><circle cx="184" cy="${t-18}" r="5"/><circle cx="200" cy="${t-18}" r="5"/></g>
  <g id="${u}body"><g${ST.fx?` filter="${ST.fx}"`:''}>
    <g id="${u}topper">${top}</g>${behind}
    ${cfg.body&&cfg.shape==='custom'&&cfg.body.back?`<g transform="translate(0 ${sh})">${paintB(cfg.body.back)}</g>`:''}${partMk}
    ${cfg.feet==='none'?'':`<ellipse cx="94" cy="205" rx="17" ry="8" fill="${P.shade}" stroke="${ST.oc}" stroke-width="${hw}"/>
    <ellipse cx="146" cy="205" rx="17" ry="8" fill="${P.shade}" stroke="${ST.oc}" stroke-width="${hw}"/>`}
    <path d="${G.d}" fill="${ST.fill}" transform="translate(0 ${sh})"/>
    <g clip-path="url(#${u}bclip)">${pat}${cfg.body&&cfg.shape==='custom'&&cfg.body.marks?`<g transform="translate(0 ${sh})">${paint(cfg.body.marks)}</g>`:''}${ST.inner?`<path d="${G.d}" fill="none" stroke="${P.deep}" stroke-opacity="${ST.inner}" stroke-width="16" transform="translate(-5 ${sh-7})"/>`:''}${ST.hl?`<path d="${G.d}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="7" transform="translate(4 ${sh+5})"/>`:''}</g></g>
    ${ST.w?`<path d="${G.d}" fill="none" stroke="${ST.oc}" stroke-width="${ST.w}" stroke-linejoin="round" transform="translate(0 ${sh})"/>`:''}
    ${ST.hl?`<ellipse cx="${120-G.ex-4}" cy="${t+26}" rx="15" ry="7" fill="#fff" opacity=".55" transform="rotate(-28 ${120-G.ex-4} ${t+26})"/><circle cx="${120-G.ex+14}" cy="${t+16}" r="3" fill="#fff" opacity=".6"/>`:''}
    ${hat}
    <g id="${u}face">
      ${cheeks}${eyeMk}${brows}${glasses}
      <path id="${u}mouth" fill="#5B2236"/>
      <g clip-path="url(#${u}mclip)"><ellipse id="${u}tongue" cx="120" cy="${G.mouthY+16}" rx="12" ry="8" fill="#FF7A93"/>${cfg.tooth?`<rect id="${u}tooth" x="114" y="0" width="12" height="9" rx="2" fill="#fff"/>`:''}</g>
      <path id="${u}mouthLine" fill="none" stroke="${ol}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
      <path id="${u}sweat" d="M0 -13 C0 -13 -8 -1 -8 4 C-8 9 -4 12 0 12 C4 12 8 9 8 4 C8 -1 0 -13 0 -13 Z" fill="#8FD3FF" stroke="${ol}" stroke-width="2.5" opacity="0"/>
    </g>${front}
  </g>
  ${[0,1].map(i=>{const nb=cfg.hands==='nub',hide=cfg.hands==='none';return `<g id="${u}hand${i}">${i?item:''}${hide?'':`<g${ST.fx?` filter="${ST.fx}"`:''}><ellipse rx="${nb?10:16}" ry="${nb?9:14}" fill="${P.base}" stroke="${ST.oc}" stroke-width="${hw}"/>${ST.hl?`<ellipse cx="${nb?-2.5:-4}" cy="${nb?-2.5:-4}" rx="${nb?3:5}" ry="${nb?2:3}" fill="#fff" opacity=".45"/>`:''}</g>`}</g>`}).join('')}
  <g id="${u}fx"></g>`;
  return {markup,geom:{...G,eyes,parts:parts.map(p=>({pivot:p.pivot,motion:p.motion}))}};
}

class Spring{constructor(x,k=170,d=20){this.x=x;this.v=0;this.t=x;this.k=k;this.d=d}
  step(dt){const a=this.k*(this.t-this.x)-this.d*this.v;this.v+=a*dt;this.x+=this.v*dt;return this.x}}
const ENERGY={idle:1,thinking:.6,success:1.7,error:.45,talking:1.1,sleeping:.15,wave:1.4,love:1.3,surprised:1.2,confused:.7,giggle:1.6,dance:2,sad:.4,peek:1};
const DROOP={error:.8,sleeping:1,confused:.3,sad:.9};
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
  giggle:{happy:1,curve:1,mouthOpen:.45,blush:1,hands:'cheeks'},
  dance:{happy:1,curve:1,mouthOpen:.55,blush:1,browY:-5,hands:'up'},
  sad:{browTilt:12,browY:1,curve:-.55,mouthW:.7,open:.86,blush:.2,droop:.9,look:[0,.25],hands:'rest'},
  peek:{curve:.4,browY:-4,look:[0,-.75],hands:'rest'}
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
    this.squash=new Spring(1,320,13);this.talk=new Spring(0,700,32);this.sink=new Spring(0,150,17);this.slump=new Spring(0,120,14);this.groove=new Spring(0,90,12);
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
  destroy(){clearTimeout(this._hopT);cancelAnimationFrame(this._raf);clearInterval(this._iv);clearTimeout(this.timer);(this._ls||[]).forEach(([el,ev,fn,o])=>el.removeEventListener(ev,fn,o))}
  build(cfg,first){
    this.cfg=sanitize(cfg);const u=this.uid,{markup,geom}=render(this.cfg,u);this.svg.innerHTML=markup;this.g=geom;
    const q=id=>this.svg.querySelector('#'+u+id);
    this.E={body:q('body'),face:q('face'),mouth:q('mouth'),mclip:q('mclipPath'),mline:q('mouthLine'),tongue:q('tongue'),tooth:q('tooth'),
      sweat:q('sweat'),topper:q('topper'),shadow:q('shadow'),dots:q('dots'),zzz:q('zzz'),q:q('q'),fx:q('fx'),
      cheeks:[...this.svg.querySelectorAll('.cheek')],hands:[q('hand0'),q('hand1')],
      eyes:geom.eyes.map((e,i)=>({...e,g:q('eye'+i),pup:q('pup'+i),lidT:q('lidT'+i),lidB:q('lidB'+i),hap:q('hap'+i),heart:q('heart'+i),brow:q('brow'+i)}))};
    this.limbs=(geom.parts||[]).map((p,i)=>({el:q('part'+i),pivot:p.pivot,motion:p.motion,side:Math.abs(p.pivot[0]-120)<10?1:Math.sign(p.pivot[0]-120),
      sp:new Spring(0,120,9),phase:i*1.37,next:1+Math.random()*3}));
    this.svg.setAttribute('aria-label',`${this.cfg.name}, an animated mascot`);
    if(first){const h=handTargets('rest',geom,false,false,0);this.hands.forEach((p,i)=>{p[0].x=p[0].t=h[i][0];p[1].x=p[1].t=h[i][1]})}
    else{this.squash.v-=3.5;this.hop(220)}
  }
  setState(n){clearTimeout(this.timer);this._enter(n)}
  react(n,ms=2300){this.lastAct=performance.now();this._enter(n);clearTimeout(this.timer);this.timer=setTimeout(()=>this._enter('idle'),ms)}
  _enter(n,why){if(!STATES[n])return;const prev=this.state;this.state=n;this.onState(n,why);
    if(n==='success'){this.hop(360);setTimeout(()=>this.hop(250),560);this.burst('confetti')}
    if(n==='error'){this.shake=9;this.squash.v-=3.2}
    if(n==='surprised'){this.hop(200);this.squash.v+=2}
    if(n==='love')this.burst('hearts');
    if(n==='wave')this.hop(120);
    if(n==='dance')this.hop(220);
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
  hop(v){if(this.jumpY>-1&&this.jumpV>=0&&!this._hopT){if(RM<1){this.jumpV=-v*Math.sqrt(RM);return}
    this.squash.v-=v*.0075;this._hopT=setTimeout(()=>{this._hopT=null;this.jumpV=-v},75)}}
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
  say(text,{speed=40,hold=2600}={}){this.lastAct=performance.now();if(!this.bubble)return;
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
    if(!this._sacT||now>this._sacT){this.sacc=[(Math.random()-.5)*.14,(Math.random()-.5)*.1];this._sacT=now+600+Math.random()*900}
    if(this.state==='idle'&&!this.focusEl&&!this.coverOn&&now-this.lastPointer>3500&&now>this.nextGlance){
      this.look=[(Math.random()-.5)*1.6,(Math.random()-.5)];this.nextGlance=now+1800+Math.random()*2500;
      if(Math.random()<.12)this.hop(110)}
    if(this.sleepAfter&&this.state==='idle'&&!this.focusEl&&!this.coverOn&&!(this.bubble&&this.bubble.classList.contains('show'))&&now-this.lastAct>this.sleepAfter)this._enter('sleeping','auto')}
  _frame(now){
    const dt=Math.min((now-this._last)/1000,.05);this._last=now;this.t+=dt;const t=this.t,g=this.g,E=this.E;
    const S=STATES[this.state],tg=Object.assign({},BASE,S),sleeping=this.state==='sleeping',cover=this.coverOn&&!sleeping;
    if(cover)Object.assign(tg,{curve:this.peekOn?.75:.35,blush:.95,browY:-3});
    const lk=S.look||this.look,sc=this.sacc&&!sleeping?this.sacc:[0,0];this.s.lookX.t=clamp(lk[0]+sc[0],-1,1);this.s.lookY.t=clamp(lk[1]+sc[1],-1,1);
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
    this.sink.t=this.state==='peek'?1:0;this.slump.t=this.state==='sad'?1:0;this.groove.t=this.state==='dance'?1:0;
    const sink=this.sink.step(dt),slump=this.slump.step(dt),grv=this.groove.step(dt),beat=t*8.4,dbx=Math.sin(t*4.2)*9*grv*RM,drot=Math.sin(beat)*7*grv*RM,dby=-Math.abs(Math.sin(beat))*9*grv*RM,sinkY=sink*(206-g.top)*.62+slump*3;
    E.body.setAttribute('transform',`translate(${120+sx0+dbx} ${206+jy+dby+sinkY}) rotate(${v.tilt+giggle+lean+drot}) scale(${sxs*(1+.035*slump)} ${sy*(1-.06*slump)}) translate(-120 -206)`);
    const lift=Math.min(Math.max(-jy,0)/260,1);
    E.shadow.setAttribute('transform',`translate(120 214) scale(${(1-lift*.45)*sxs} 1) translate(-120 -214)`);E.shadow.setAttribute('opacity',(1-lift*.6)*(1-clamp(sink,0,1)*.9));
    E.face.setAttribute('transform',`translate(${v.lookX*6} ${v.lookY*4+clamp(this.jumpV*.006,-4,4)})`);
    const en=ENERGY[this.state]||1,dr=DROOP[this.state]||0,perk=this.state==='surprised'?1:0;
    for(const p of this.limbs||[]){if(!p.el)continue;let a=0;
      if(p.motion==='wag')a=Math.sin(t*(3+5*en)+p.phase)*(4+9*en);
      else if(p.motion==='flap')a=p.side*Math.sin(t*(2+7*en)+p.phase)*(4+12*en);
      else if(p.motion==='sway')a=Math.sin(t*(1.2+.8*en)+p.phase)*(3+4*en);
      else if(p.motion==='twitch'&&t>p.next){p.sp.v+=-p.side*(60+40*en);p.next=t+1.5+Math.random()*4/en}
      if(p.motion!=='none'){a=a*RM+p.side*dr*16-p.side*perk*8;p.sp.t=a;p.sp.v+=clamp(this.jumpV*.05,-40,40)*(p.motion==='bob'||p.motion==='sway'?1:.5)}
      else p.sp.t=0;
      p.el.setAttribute('transform',`rotate(${p.sp.step(dt)} ${p.pivot[0]} ${p.pivot[1]})`)}
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
    E.hands.forEach((h,i)=>h.setAttribute('transform',`translate(${hp[i][0]+sx0+dbx} ${hp[i][1]+hb+dby+sinkY}) rotate(${i?20:-20})`));
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
/*! Pip painted-mascot engine: turns a painted character (or expression sheet) into a living rig. */
function PipPaintedEngine(){
"use strict";
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),pick=a=>a[Math.floor(Math.random()*a.length)];
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches?0.3:1;

/* ---------- image utilities ---------- */
const loadImg=src=>new Promise((res,rej)=>{const i=new Image();if(!/^data:|^blob:/.test(src))i.crossOrigin='anonymous';i.onload=()=>res(i);i.onerror=()=>rej(new Error('Image failed to load'));i.src=src});
function canvasOf(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
// Remove the flat background by flood-filling from the edges, with a soft edge.
function keyOut(img){
  const W=img.naturalWidth||img.width,H=img.naturalHeight||img.height,c=canvasOf(W,H),x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0);
  const id=x.getImageData(0,0,W,H),d=id.data;
  const samp=(sx,sy)=>{let r=0,g=0,b=0,n=0;for(let y=sy;y<sy+10;y++)for(let xx=sx;xx<sx+10;xx++){const i=(y*W+xx)*4;r+=d[i];g+=d[i+1];b+=d[i+2];n++}return [r/n,g/n,b/n]};
  const cs=[samp(2,2),samp(W-12,2),samp(2,H-12),samp(W-12,H-12)];
  const key=[0,1,2].map(k=>cs.map(c=>c[k]).sort((a,b)=>a-b).slice(1,3).reduce((a,b)=>a+b)/2);
  const dist=i=>Math.hypot(d[i]-key[0],d[i+1]-key[1],d[i+2]-key[2]);
  const T1=58,T2=120,bg=new Uint8Array(W*H),q=new Int32Array(W*H);let qh=0,qt=0;
  const push=p=>{if(!bg[p]&&dist(p*4)<T1){bg[p]=1;q[qt++]=p}};
  for(let i=0;i<W;i++){push(i);push((H-1)*W+i)}for(let j=0;j<H;j++){push(j*W);push(j*W+W-1)}
  while(qh<qt){const p=q[qh++],px=p%W,py=(p/W)|0;if(px>0)push(p-1);if(px<W-1)push(p+1);if(py>0)push(p-W);if(py<H-1)push(p+W)}
  let minX=W,minY=H,maxX=0,maxY=0;
  for(let p=0;p<W*H;p++){const i=p*4;
    if(bg[p]){d[i+3]=0;continue}
    const px=p%W,py=(p/W)|0;
    const nearBg=(px>0&&bg[p-1])||(px<W-1&&bg[p+1])||(py>0&&bg[p-W])||(py<H-1&&bg[p+W]);
    if(nearBg){const a=clamp((dist(i)-T1)/(T2-T1),0,1);d[i+3]=Math.round(255*Math.max(a,.15));
      // pull the background tint out of the soft edge
      for(let k=0;k<3;k++)d[i+k]=clamp(Math.round((d[i+k]-key[k]*(1-a))/Math.max(a,.35)),0,255)}
    if(px<minX)minX=px;if(px>maxX)maxX=px;if(py<minY)minY=py;if(py>maxY)maxY=py}
  // remove key-colour spill (pink/green fringe) in a band around the edge
  const band=new Uint8Array(W*H);let fr=[];for(let p=0;p<W*H;p++)if(bg[p])fr.push(p);
  for(let layer=1;layer<=4;layer++){const nx=[];for(const p of fr){const px=p%W;for(const q of [px>0?p-1:-1,px<W-1?p+1:-1,p-W,p+W]){if(q<0||q>=W*H||bg[q]||band[q])continue;band[q]=layer;nx.push(q)}}fr=nx}
  const magenta=key[0]>key[1]&&key[2]>key[1];
  for(let p=0;p<W*H;p++){if(!band[p])continue;const i=p*4,r=d[i],g=d[i+1],b=d[i+2],k=1-(band[p]-1)*.18;
    if(magenta){const m=Math.min(r,b);if(m>g){d[i]=r-(m-g)*k;d[i+2]=b-(m-g)*k}}
    else{const m=Math.max(r,b);if(g>m)d[i+1]=g-(g-m)*k}}
  x.putImageData(id,0,0);
  return {canvas:c,bbox:{x:minX,y:minY,w:Math.max(1,maxX-minX),h:Math.max(1,maxY-minY)},key}}
function b64ToDataUrl(b64,mime){return `data:${mime||'image/webp'};base64,${b64}`}
function canvasB64(c,type){return c.toDataURL(type||'image/png').split(',')[1]}

/* Find the small shift that lines a repainted frame up with the original, using the body (not the face). */
function alignFrames(base,frame,face){const S=256,f=S/base.canvas.width,gray=c=>{const t=canvasOf(S,S),x=t.getContext('2d',{willReadFrequently:true});x.fillStyle='#808080';x.fillRect(0,0,S,S);x.drawImage(c,0,0,S,S);
    const d=x.getImageData(0,0,S,S).data,g=new Float32Array(S*S);for(let i=0;i<S*S;i++)g[i]=d[i*4]*.3+d[i*4+1]*.59+d[i*4+2]*.11;return g};
  const A=gray(base.canvas),B=gray(frame.canvas),bb=base.bbox,ex={x:(face.x-face.w*.4)*f,y:(face.y-face.h*.5)*f,x2:(face.x+face.w*1.4)*f,y2:(face.y+face.h*1.5)*f};
  const pts=[];for(let y=Math.max(4,bb.y*f);y<Math.min(S-4,(bb.y+bb.h)*f);y+=2)for(let x=Math.max(4,bb.x*f);x<Math.min(S-4,(bb.x+bb.w)*f);x+=2){if(x>ex.x&&x<ex.x2&&y>ex.y&&y<ex.y2)continue;pts.push(y*S+x)}
  // coarse-to-fine: sparse points on a 3px grid of offsets, then every point around the best one
  const P=Int32Array.from(pts),N=S*S,sparse=P.filter((_,i)=>i%5===0);
  const err=(set,dx,dy,cap)=>{let e=0;const o=dy*S+dx;for(let i=0;i<set.length;i++){const p=set[i],q=p+o;e+=Math.abs(A[p]-(q>=0&&q<N?B[q]:128));if(e>cap)return e}return e};
  let best={e:1e18,dx:0,dy:0};const R=12;
  for(let dy=-R;dy<=R;dy+=3)for(let dx=-R;dx<=R;dx+=3){const e=err(sparse,dx,dy,best.e);if(e<best.e)best={e,dx,dy}}
  const c0=best;best={e:1e18,dx:0,dy:0};
  for(let dy=c0.dy-2;dy<=c0.dy+2;dy++)for(let dx=c0.dx-2;dx<=c0.dx+2;dx++){const e=err(P,dx,dy,best.e);if(e<best.e)best={e,dx,dy}}
  return {dx:best.dx/f,dy:best.dy/f}}

/* ---------- live-drawn face for "simple face" mode ---------- */
const mix=(a,b,k)=>a.map((x,i)=>Math.round(x+(b[i]-x)*k)),rgb=a=>`rgb(${a[0]},${a[1]},${a[2]})`,rgba=(a,o)=>`rgba(${a[0]},${a[1]},${a[2]},${o})`;
function hexRgb(h){h=(h||'#4a2e1c').replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h,16);return isNaN(n)?[74,46,28]:[n>>16&255,n>>8&255,n&255]}
function sampleSkin(canvas,box){const x=canvas.getContext('2d',{willReadFrequently:true});const cx=box.x+box.w/2,cy=box.y+box.h*.45,r=Math.max(4,box.w*.08);
  const d=x.getImageData(Math.round(cx-r),Math.round(cy-r),Math.round(2*r),Math.round(2*r)).data;let s=[0,0,0],n=0;for(let i=0;i<d.length;i+=4)if(d[i+3]>200){s[0]+=d[i];s[1]+=d[i+1];s[2]+=d[i+2];n++}
  return n?s.map(v=>Math.round(v/n)):[230,190,160]}
function drawSimpleFace(ctx,F,v,blink,t){
  const k=n=>v['f_'+n],skin=F.skin,dark=mix(skin,[30,18,22],.62),lash=mix(skin,[20,12,16],.82),brow=F.brow||mix(skin,[40,24,18],.72),iris=hexRgb(F.eyeColor);
  const open=clamp(k('open')*(1-blink)*(1-.5*k('squint')),0,1.3),happy=clamp(k('happy'),0,1),love=clamp(k('love'),0,1);
  const lx=clamp(v.lookX,-1,1),ly=clamp(v.lookY,-1,1);
  // cheeks
  const bl=clamp(k('blush'),0,1)*.55;
  F.eyes.forEach((e,i)=>{const cx=e.x+e.w/2+(i?1:-1)*e.w*.25,cy=e.y+e.h*1.25,r=e.w*.55;const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,`rgba(255,110,130,${bl})`);g.addColorStop(1,'rgba(255,110,130,0)');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(cx,cy,r,r*.62,0,0,Math.PI*2);ctx.fill()});
  F.eyes.forEach((e,i)=>{const cx=e.x+e.w/2,cy=e.y+e.h/2,rx=e.w/2*.92,ry=e.h/2*.95,s=i?1:-1,lw=Math.max(1.5,rx*.13);
    // brows
    const by=cy-ry*1.42+k('browY')*ry,bt=k('browTilt'),bw=rx*1.05;ctx.strokeStyle=rgb(brow);ctx.lineCap='round';ctx.lineWidth=Math.max(2,rx*.26);
    ctx.beginPath();ctx.moveTo(cx-s*bw,by+bt*ry*.012);ctx.quadraticCurveTo(cx,by-ry*.32-bt*ry*.006,cx+s*bw*.85,by-bt*ry*.03);ctx.stroke();
    if(happy>.5||open<.08){ctx.strokeStyle=rgb(lash);ctx.lineWidth=lw*1.5;ctx.beginPath();
      if(happy>.5)ctx.ellipse(cx,cy+ry*.35,rx*.85,ry*.6,0,Math.PI*1.12,Math.PI*1.88);else ctx.ellipse(cx,cy,rx*.9,ry*.35,0,Math.PI*.12,Math.PI*.88);ctx.stroke();return}
    ctx.save();ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.clip();
    const sg=ctx.createRadialGradient(cx-rx*.2,cy-ry*.3,rx*.1,cx,cy,rx*1.1);sg.addColorStop(0,'#ffffff');sg.addColorStop(.75,'#f3eef3');sg.addColorStop(1,'#cfc4d0');ctx.fillStyle=sg;ctx.fillRect(cx-rx,cy-ry,2*rx,2*ry);
    const ix=cx+lx*rx*.32,iy=cy+ly*ry*.26,ir=Math.min(rx,ry)*.66;
    if(love>.5){ctx.fillStyle='#ff4d6d';const hr=ir*.95;ctx.beginPath();ctx.moveTo(ix,iy+hr*.9);ctx.bezierCurveTo(ix-hr*1.5,iy,ix-hr*1.1,iy-hr*1.15,ix,iy-hr*.4);ctx.bezierCurveTo(ix+hr*1.1,iy-hr*1.15,ix+hr*1.5,iy,ix,iy+hr*.9);ctx.fill()}
    else{const ig=ctx.createRadialGradient(ix,iy-ir*.2,ir*.1,ix,iy,ir);ig.addColorStop(0,rgb(mix(iris,[255,255,255],.35)));ig.addColorStop(.7,rgb(iris));ig.addColorStop(1,rgb(mix(iris,[0,0,0],.5)));
      ctx.fillStyle=ig;ctx.beginPath();ctx.arc(ix,iy,ir,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#120c10';ctx.beginPath();ctx.arc(ix,iy,ir*.52*k('pupil'),0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.95)';ctx.beginPath();ctx.arc(ix+ir*.35,iy-ir*.38,ir*.26,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.7)';ctx.beginPath();ctx.arc(ix-ir*.32,iy+ir*.36,ir*.12,0,Math.PI*2);ctx.fill()}
    // eyelids in the character's own skin colour, with a soft shadow
    const top=cy-ry+2*ry*clamp(1-open,0,1)*.98;ctx.fillStyle=rgb(skin);ctx.fillRect(cx-rx-2,cy-ry-2,2*rx+4,top-(cy-ry)+2);
    const sh=ctx.createLinearGradient(0,top,0,top+ry*.4);sh.addColorStop(0,'rgba(40,20,30,.32)');sh.addColorStop(1,'rgba(40,20,30,0)');ctx.fillStyle=sh;ctx.fillRect(cx-rx,top,2*rx,ry*.4);
    const bot=cy+ry-2*ry*clamp(k('squint'),0,1)*.45;ctx.fillStyle=rgb(skin);ctx.fillRect(cx-rx-2,bot,2*rx+4,ry*2);
    ctx.restore();
    ctx.strokeStyle=rgb(lash);ctx.lineWidth=lw;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.stroke();
    if(open>.08){ctx.lineWidth=lw*1.6;ctx.beginPath();ctx.moveTo(cx-rx*.98,top+ (top>cy-ry+1?0:ry*.15));ctx.quadraticCurveTo(cx,top-ry*.08,cx+rx*.98,top+(top>cy-ry+1?0:ry*.15));if(top>cy-ry+1)ctx.stroke();
      ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,Math.PI*1.08,Math.PI*1.92);ctx.stroke()}});
  // mouth
  const m=F.mouth,mx=m.x+m.w/2,my=m.y+m.h/2,mo=Math.max(k('mouthOpen'),v.talk*.8),w=m.w/2*(.55+.45*k('mouthW')),c=k('curve')*m.h*.55,o=mo*m.h*1.25;
  const path=()=>{ctx.beginPath();ctx.moveTo(mx-w,my-c*.3);ctx.quadraticCurveTo(mx,my+c,mx+w,my-c*.3);ctx.quadraticCurveTo(mx,my+c+o+1,mx-w,my-c*.3);ctx.closePath()};
  path();ctx.fillStyle='#4a1622';ctx.fill();
  if(o>2){ctx.save();path();ctx.clip();ctx.fillStyle='#ff7a93';ctx.beginPath();ctx.ellipse(mx,my+c*.55+o*.8,w*.55,o*.45,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.92)';ctx.fillRect(mx-w*.5,my+c*.3-1,w,Math.min(o*.22,m.h*.18));ctx.restore()}
  ctx.strokeStyle=rgb(dark);ctx.lineWidth=Math.max(2,m.w*.045);ctx.lineJoin='round';ctx.lineCap='round';path();ctx.stroke()}

/* ---------- the painted rig ---------- */
class Spring{constructor(x,k=170,d=20){this.x=x;this.v=0;this.t=x;this.k=k;this.d=d}step(dt){const a=this.k*(this.t-this.x)-this.d*this.v;this.v+=a*dt;this.x+=this.v*dt;return this.x}}
const EXPRS=['happy','worried','surprised','talk','blink'];
// parameters for the live-drawn ("simple") face
const FBASE={open:.98,squint:0,happy:0,love:0,pupil:1,browTilt:0,browY:0,curve:.5,mouthOpen:0,mouthW:1,blush:.45};
const FSTATES={idle:{},thinking:{curve:.08,mouthW:.6,browY:-.25},success:{happy:1,curve:1,mouthOpen:.7,blush:1,browY:-.2},
  error:{browTilt:14,curve:-.75,mouthOpen:.15,mouthW:.8,squint:.2,blush:.1,browY:.1},surprised:{open:1.25,pupil:.62,browY:-.45,curve:0,mouthW:.35,mouthOpen:.95},
  sleeping:{open:.03,curve:.2,mouthOpen:.15,mouthW:.5},love:{love:1,curve:.95,mouthOpen:.25,blush:1},wave:{curve:.85,mouthOpen:.35,blush:.7},
  confused:{browTilt:-8,curve:-.15,mouthW:.6},giggle:{happy:1,curve:1,mouthOpen:.45,blush:1}};
const STATES={idle:{},thinking:{look:[.5,-.85],tilt:-3},success:{happy:1},error:{worried:1},surprised:{surprised:1},talking:{},
  sleeping:{blink:1,tilt:4,zzz:1},love:{happy:1},wave:{happy:.7},confused:{confused:1,tilt:7,q:1},giggle:{happy:1},
  dance:{happy:1},sad:{worried:1,tilt:-2,look:[0,.75]},peek:{look:[0,-.7]}};
class PaintRig{
  constructor(canvas,{bubble,onState,fit,sleepAfter,pad,padTop}={}){
    this.fit=fit||0;this.pad=pad||0;this.padTop=padTop||0;this.sleepAfter=sleepAfter===undefined?20000:sleepAfter;this.cfg={name:'',greeting:'Hi there!'};this._ls=[];this.focusLook=0;
    this.cv=canvas;this.ctx=canvas.getContext('2d');this.bubble=bubble;this.onState=onState||(()=>{});
    this.base=null;this.patches={};this.face=null;
    this.s={happy:new Spring(0,520,44),worried:new Spring(0,520,44),surprised:new Spring(0,560,46),confused:new Spring(0,520,44),talk:new Spring(0,700,32),blinkHold:new Spring(0,200,22),
      lookX:new Spring(0,120,16),lookY:new Spring(0,120,16),tilt:new Spring(0,90,12),lean:new Spring(0,90,12),zzz:new Spring(0),q:new Spring(0)};
    for(const [k,v0] of Object.entries(FBASE))this.s['f_'+k]=new Spring(v0,170,20);
    this.squash=new Spring(1,320,13);this.sink=new Spring(0,150,17);this.slump=new Spring(0,120,14);this.groove=new Spring(0,90,12);this.state='idle';this.look=[0,0];this.timer=null;this.cover=false;
    this.jumpY=0;this.jumpV=0;this.shake=0;this.t=0;this.nextBlink=1.2;this.blinkStart=-1;this.parts=[];this.pokes=[];this.lastAct=performance.now();this.lastPointer=0;this.nextGlance=0;
    const on=(t,ev,fn,o)=>{t.addEventListener(ev,fn,o);this._ls.push([t,ev,fn,o])};
    this._resize();on(window,'resize',()=>this._resize());
    if(typeof ResizeObserver!=='undefined'){this._ro=new ResizeObserver(()=>this._resize());this._ro.observe(canvas)}
    on(window,'pointermove',e=>{this._act();this.lastPointer=performance.now();if(!this.focusEl&&!(this.focusLook>performance.now()))this.lookAt(e.clientX,e.clientY)},{passive:true});
    ['pointerdown','keydown'].forEach(ev=>on(window,ev,()=>this._act(),{passive:true}));
    on(arguments[1]&&arguments[1].hit||canvas,'pointerdown',()=>this.poke());
    this._iv=setInterval(()=>this._tick(),250);
    this._last=performance.now();this._raf=requestAnimationFrame(this._frame.bind(this));
  }
  _resize(){const r=this.cv.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2.5);this.cv.width=Math.round(r.width*dpr);this.cv.height=Math.round(r.height*dpr);this.dpr=dpr;this.W=r.width;this.H=r.height}
  destroy(){this._dead=true;cancelAnimationFrame(this._raf);clearInterval(this._iv);clearTimeout(this.timer);clearTimeout(this._hopT);if(this._ro)this._ro.disconnect();this._ls.forEach(([t,ev,fn,o])=>t.removeEventListener(ev,fn,o))}
  get lean(){return this.s.lean.t}set lean(v){this.s.lean.t=v}
  bump(){this.squash.v-=1.4}
  point(x,y){const r=this.cv.getBoundingClientRect(),side=x<r.left+r.width/2?'L':'R';this.lookAt(x,y);this.focusLook=performance.now()+2600;
    if(this.full&&this.full['point'+side]){this.pointSide=side;this.pointUntil=performance.now()+3400;this.squash.v-=1.6;this.s.lean.t=0}
    else{this.s.lean.t=(side==='L'?-1:1)*6;clearTimeout(this._pt);this._pt=setTimeout(()=>{this.s.lean.t=0},1400)}}
  unpoint(){this.s.lean.t=0;this.pointSide=null}
  lookAtCaret(inp){const r=inp.getBoundingClientRect(),cs=getComputedStyle(inp);const m=PaintRig._m||(PaintRig._m=document.createElement('canvas').getContext('2d'));m.font=cs.font;
    const txt=inp.type==='password'?'•'.repeat(inp.value.length):inp.value;this.lookAt(r.left+parseFloat(cs.paddingLeft||0)+Math.min(m.measureText(txt).width,r.width-24),r.top+r.height/2)}
  _act(){this.lastAct=performance.now();if(this.state==='sleeping')this.setState('idle'),this.hop(160)}
  setBase(k){this.base=k;this.patches={};this.full={};this.hop(220)}
  addFull(name,k){if(!this.base)return;const off=this.face?alignFrames(this.base,k,this.face.box):{dx:0,dy:0};this.full[name]={canvas:k.canvas,off}}
  // face: {box, eyes:[box], mouth:box} in 1024px image coordinates
  setFace(f){this.face=f.box?f:{box:f};const F=this.face,B=F.box;
    if(F.eyes&&F.eyes.length){const xs=F.eyes.map(e=>e.x),ys=F.eyes.map(e=>e.y),x2=F.eyes.map(e=>e.x+e.w),y2=F.eyes.map(e=>e.y+e.h);
      const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...x2)-x,h=Math.max(...y2)-y,eh=Math.max(h,B.h*.12);
      F.eyeR={x:x-Math.max(w*.18,eh*.6),y:y-eh*1.05,w:w+2*Math.max(w*.18,eh*.6),h:eh*2.3}}
    if(F.mouth&&F.mouth.w>0){const m=F.mouth;F.mouthR={x:m.x-m.w*.45,y:m.y-m.h*.55,w:m.w*1.9,h:m.h*2.1}}
    if(!F.eyeR||!F.mouthR){F.eyeR=null;F.mouthR=null}
    this.pos={};if(this.base){this.patches.neutral=this._patches(this.base.canvas,'neutral',{dx:0,dy:0})}}
  setSimple(info){this.simple=info;this.face=null;this.patches={}}
  regionsFor(name){const F=this.face;if(!F.eyeR)return [F.box];if(name==='blink')return [F.eyeR];if(name==='talk'||name==='talkE')return [F.mouthR];if(name==='neutral')return [F.eyeR,F.mouthR];return [F.eyeR,F.mouthR]}
  addExpr(name,k){if(!this.base||!this.face)return;const off=alignFrames(this.base,k,this.face.box);this.patches[name]=this._patches(k.canvas,name,off);
    if(name==='surprised'&&this.face.mouthR)this.patches.oMouth=this._patches(k.canvas,'talk',off);
    if(name==='happy'&&this.state==='idle')this.react('success',1400)}
  _patches(src,name,off){return this.regionsFor(name).map(R=>this._patch(src,R,off,name!=='neutral'))}
  // Cut a feathered patch, shifted into register with the base, colour-matched to it.
  _patch(src,R,off,match){const pad=.18,px=R.x-R.w*pad,py=R.y-R.h*pad,pw=Math.ceil(R.w*(1+2*pad)),ph=Math.ceil(R.h*(1+2*pad));
    const c=canvasOf(pw,ph),x=c.getContext('2d',{willReadFrequently:true});x.drawImage(src,-(px+off.dx),-(py+off.dy));
    if(match){const bc=canvasOf(pw,ph),bx=bc.getContext('2d',{willReadFrequently:true});bx.drawImage(this.base.canvas,-px,-py);
      const a=x.getImageData(0,0,pw,ph),bb=bx.getImageData(0,0,pw,ph);const sa=[0,0,0],sb=[0,0,0];let n=0;
      for(let yy=0;yy<ph;yy+=2)for(let xx=0;xx<pw;xx+=2){const nx=(xx/pw-.5)*2,ny=(yy/ph-.5)*2,r=nx*nx+ny*ny;if(r<.6||r>1)continue;const i=(yy*pw+xx)*4;
        if(a.data[i+3]<200||bb.data[i+3]<200)continue;for(let k=0;k<3;k++){sa[k]+=a.data[i+k];sb[k]+=bb.data[i+k]}n++}
      if(n>20){const g=[0,1,2].map(k=>clamp(sb[k]/Math.max(1,sa[k]),.82,1.2));for(let i=0;i<a.data.length;i+=4)for(let k=0;k<3;k++)a.data[i+k]=clamp(a.data[i+k]*g[k],0,255);x.putImageData(a,0,0)}}
    x.globalCompositeOperation='destination-in';x.save();x.translate(pw/2,ph/2);x.scale(1,ph/pw);
    const gr=x.createRadialGradient(0,0,0,0,0,pw/2);gr.addColorStop(0,'#000');gr.addColorStop(.62,'#000');gr.addColorStop(1,'rgba(0,0,0,0)');
    x.fillStyle=gr;x.fillRect(-pw/2,-pw/2,pw,pw);x.restore();return {c,x:px,y:py}}
  setState(n){clearTimeout(this.timer);this._enter(n)}
  react(n,ms=2300){this.lastAct=performance.now();this._enter(n);clearTimeout(this.timer);this.timer=setTimeout(()=>this._enter('idle'),ms)}
  _enter(n){if(!STATES[n])return;if(n!==this.state)this.squash.v-=1.8;this.state=n;this.onState(n);
    if(n==='success'){this.hop(360);setTimeout(()=>this.hop(250),560);this.burst('confetti')}
    if(n==='error'){this.shake=10;this.squash.v-=3}
    if(n==='surprised'){this.hop(220);this.squash.v+=2}
    if(n==='love')this.burst('hearts');if(n==='wave')this.hop(140);if(n==='dance')this.hop(220);if(n==='sad')this.squash.v+=1.5}
  lookAt(x,y){const r=this.cv.getBoundingClientRect();if(!r.width)return;this.look=[clamp((x-(r.left+r.width/2))/(r.width*.7),-1,1),clamp((y-(r.top+r.height*.45))/(r.height*.8),-1,1)]}
  hop(v){if(this.jumpY>-1&&this.jumpV>=0&&!this._hopT){if(RM<1){this.jumpV=-v*Math.sqrt(RM);return}this.squash.v-=v*.0075;this._hopT=setTimeout(()=>{this._hopT=null;this.jumpV=-v},75)}}
  poke(){if(!this.base)return;const now=performance.now();this.pokes=this.pokes.filter(p=>now-p<4000);this.pokes.push(now);this.squash.v-=4;
    if(this.pokes.length>=5){this.pokes=[];this.react('confused',2400);this.say("Okay, okay! I'm awake!");return}
    const n=this.pokes.length;if(n===3){this.react('love',1800);this.say('Aww, thanks!');return}
    this.react(n===1?'surprised':'giggle',n===1?900:1400);this.say(n===1?'Boop!':pick(['Hee hee, that tickles!','Hey there!','Again? Okay!']))}
  say(text,{speed=40,hold=2400}={}){this.lastAct=performance.now();const tok=this.sayTok=(this.sayTok||0)+1,b=this.bubble;b.textContent='';b.classList.add('show');let i=0;
    const tick=()=>{if(tok!==this.sayTok)return;if(i>=text.length){this.s.talk.t=0;this.mouth=null;setTimeout(()=>{if(tok===this.sayTok)b.classList.remove('show')},hold);return}
      const ch=text[i++];b.textContent=text.slice(0,i);this.s.talk.t=/[aeiouy]/i.test(ch)?1:/\s/.test(ch)?0:/[.,!?]/.test(ch)?0:.45;
      this.mouth=/[ouw]/i.test(ch)?'o':/[eiy]/i.test(ch)?'e':/[a]/i.test(ch)?'a':/[bmp]/i.test(ch)?null:(/[a-z]/i.test(ch)&&this.mouth?this.mouth:null);setTimeout(tick,/[.,!?]/.test(ch)?speed*4:speed)};tick()}
  burst(kind){if(RM<1)return;const cols=['#FF6B7A','#6E9BFF','#7DDC8A','#FFC23D','#B58CFF'];
    for(let i=0;i<(kind==='hearts'?7:34);i++)this.parts.push(kind==='hearts'?{h:1,x:(Math.random()-.5)*80,y:-150,vx:(Math.random()-.5)*30,vy:-50-Math.random()*50,life:1.8,g:-15,c:'#FF4D6D',a:0,va:0}:
      {x:0,y:-120,vx:(Math.random()-.5)*480,vy:-260-Math.random()*320,life:1.7,g:900,c:cols[i%5],a:Math.random()*6,va:(Math.random()-.5)*14})}
  _tick(){const now=performance.now();
    if(this.state==='idle'&&!this.focusEl&&now-this.lastPointer>3500&&now>this.nextGlance){this.look=[(Math.random()-.5)*1.4,(Math.random()-.5)*.8];this.nextGlance=now+1800+Math.random()*2500}
    if(this.base&&this.sleepAfter&&this.state==='idle'&&!this.cover&&!this.focusEl&&!(this.bubble&&this.bubble.classList.contains('show'))&&now-this.lastAct>this.sleepAfter)this._enter('sleeping')}
  _frame(now){
    const dt=Math.min((now-this._last)/1000,.05);this._last=now;this.t+=dt;const t=this.t,S=STATES[this.state]||{};
    const P0=this.patches||{};for(const k of ['happy','worried','surprised','confused'])this.s[k].t=S[k]||0;
    if(this.state==='confused'&&!P0.confused)this.s.worried.t=.5;
    this.s.blinkHold.t=(S.blink||(this.cover?1:0));this.s.tilt.t=S.tilt||0;this.s.zzz.t=S.zzz||0;this.s.q.t=S.q||0;
    const lk=S.look||this.look;this.s.lookX.t=lk[0];this.s.lookY.t=lk[1];
    const FS=FSTATES[this.state]||FSTATES[{sad:'error',dance:'success',peek:'idle'}[this.state]]||{};for(const k in FBASE)this.s['f_'+k].t=(FS[k]!==undefined?FS[k]:FBASE[k]);
    if(this.cover&&this.state!=='sleeping'){this.s.f_open.t=.03;this.s.f_curve.t=.6}
    const v={};for(const k in this.s)v[k]=this.s[k].step(dt);const sq=this.squash.step(dt);
    this.sink.t=this.state==='peek'?1:0;this.slump.t=this.state==='sad'?1:0;this.groove.t=this.state==='dance'?1:0;
    const sink=this.sink.step(dt),slump=this.slump.step(dt),grv=this.groove.step(dt),beat=t*8.4,dbx=Math.sin(t*4.2)*9*grv*RM,drot=Math.sin(beat)*7*grv*RM,dby=-Math.abs(Math.sin(beat))*9*grv*RM;
    if(t>this.nextBlink){this.blinkStart=t;this.nextBlink=t+2.2+Math.random()*3.5}
    let blink=0;if(this.blinkStart>=0){const p=(t-this.blinkStart)/.16;blink=p<1?(p<.5?p*2:(1-p)*2):0}
    if(this.jumpY<0||this.jumpV<0){this.jumpV+=1500*dt;this.jumpY+=this.jumpV*dt;if(this.jumpY>=0){this.jumpY=0;if(this.jumpV>120)this.squash.v-=this.jumpV*.011;this.jumpV=0}}
    this.shake*=Math.pow(.02,dt);const shx=this.shake*Math.sin(t*55)*RM;
    const sleeping=this.state==='sleeping',breathe=(sleeping?Math.sin(t*1.2)*.03:Math.sin(t*2.3)*.015)*RM,air=this.jumpY<0?Math.min(Math.abs(this.jumpV)/2600,.1):0;
    const sy=sq+breathe+air,sx=1+(1-sy)*.9;const giggle=this.state==='giggle'?Math.sin(t*22)*2.5*RM:0;
    const wv=this.state==='wave'&&this.full&&this.full.waveA,wph=t*6.2,
      wr=wv&&!this.full.waveB?Math.sin(wph)*2.4*RM:0,wb=wv?-Math.abs(Math.sin(wph))*(this.full.waveB?3:6)*RM:0;
    const ctx=this.ctx,W=this.W,H=this.H;ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,W,H);
    if(this._dead)return;
    if(!this.base){this._raf=requestAnimationFrame(this._frame.bind(this));return}
    const B=this.base.bbox,ground=this.fit?H*.97:H*.9,scale=this.fit?Math.min(W/(1+2*this.pad)*this.fit/B.w,H/(1+this.padTop)*this.fit/B.h):Math.min(W*.66/B.w,H*.68/B.h),footX=B.x+B.w/2,footY=B.y+B.h;
    // shadow
    const lift=Math.min(-this.jumpY/260,1);const sg=ctx.createRadialGradient(W/2,ground,0,W/2,ground,B.w*scale*.5);sg.addColorStop(0,'rgba(25,25,60,.28)');sg.addColorStop(1,'rgba(25,25,60,0)');
    ctx.save();ctx.globalAlpha=1-clamp(sink,0,1)*.9;ctx.translate(W/2,ground);ctx.scale(1-lift*.4,.16);ctx.translate(-W/2,-ground);ctx.fillStyle=sg;ctx.beginPath();ctx.arc(W/2,ground,B.w*scale*.5,0,Math.PI*2);ctx.fill();ctx.restore();
    // body
    const sinkPx=sink*B.h*scale*.5;ctx.save();if(sink>.01){ctx.beginPath();ctx.rect(0,0,W,ground+1);ctx.clip()}
    ctx.translate(W/2+shx+dbx,ground+this.jumpY+wb+dby+sinkPx+slump*3);ctx.rotate((v.tilt+giggle+v.lean+wr+drot)*Math.PI/180);ctx.scale(sx*(1+.035*slump)*scale,sy*(1-.06*slump)*scale);ctx.translate(-footX,-footY);
    const FF=this.full||{},pointing=this.pointSide&&performance.now()<this.pointUntil&&FF['point'+this.pointSide],waving=!pointing&&this.state==='wave'&&FF.waveA;
    if(pointing){const fr=FF['point'+this.pointSide];ctx.drawImage(fr.canvas,-fr.off.dx,-fr.off.dy)}
    else if(waving){const fr=(FF.waveB&&Math.floor(t*3.4)%2)?FF.waveB:FF.waveA;ctx.drawImage(fr.canvas,-fr.off.dx,-fr.off.dy)}
    else ctx.drawImage(this.base.canvas,0,0);
    if(this.simple)drawSimpleFace(ctx,this.simple,v,blink,t);
    if(this.face&&!waving&&!pointing){const P=this.patches,FB=this.face.box,ox=v.lookX*FB.w*.035,oy=v.lookY*FB.h*.03;
      const draw=(ps,a)=>{if(ps&&a>.01){ctx.globalAlpha=Math.min(1,a);for(const p of ps)ctx.drawImage(p.c,p.x+ox,p.y+oy)}};
      draw(P.neutral,1);draw(P.happy,v.happy);draw(P.worried,v.worried);draw(P.surprised,v.surprised);draw(P.confused,v.confused);
      // lip-sync: snap between closed, "ah" and "oh" mouths (fall back to a fade if a shape is missing)
      if(this.mouth==='o'&&P.oMouth)draw(P.oMouth,1);else if(this.mouth==='e'&&P.talkE)draw(P.talkE,1);else if(this.mouth&&P.talk)draw(P.talk,1);else if(!P.talk)draw(P.talk,v.talk);
      draw(P.blink,Math.max(blink,v.blinkHold));ctx.globalAlpha=1}
    ctx.restore();
    // extras
    const headY=ground-B.h*scale;
    if(v.zzz>.05){ctx.fillStyle='rgba(60,50,90,.75)';for(let i=0;i<3;i++){const p=(t*.45+i/3)%1;ctx.globalAlpha=v.zzz*Math.sin(p*Math.PI);ctx.font=`600 ${12+p*12}px Fredoka, sans-serif`;ctx.fillText('z',W/2+B.w*scale*.3+p*30,headY+20-p*40)}ctx.globalAlpha=1}
    if(v.q>.05){ctx.globalAlpha=v.q;ctx.fillStyle='rgba(40,30,60,.85)';ctx.font='700 30px Fredoka, sans-serif';ctx.fillText('?',W/2+B.w*scale*.36,headY+24+Math.sin(t*3)*3);ctx.globalAlpha=1}
    if(grv>.05){ctx.fillStyle='rgba(40,30,60,.8)';for(let i=0;i<2;i++){const p=(t*.5+i/2)%1;ctx.globalAlpha=grv*Math.sin(p*Math.PI);ctx.font=`700 ${16+p*8}px Fredoka, sans-serif`;ctx.fillText(i?'\u266B':'\u266A',W/2+(i?1:-1)*B.w*scale*.42+Math.sin(t*3+i)*6,headY+10-p*44)}ctx.globalAlpha=1}
    if(slump>.05){const cx=W/2,cy=headY-14+Math.sin(t*1.6)*2;ctx.globalAlpha=slump*.85;ctx.fillStyle='#9AA3B5';ctx.beginPath();ctx.arc(cx-12,cy,10,0,Math.PI*2);ctx.arc(cx+2,cy-6,13,0,Math.PI*2);ctx.arc(cx+16,cy,10,0,Math.PI*2);ctx.rect(cx-12,cy,28,10);ctx.fill();
      ctx.fillStyle='#6E9BFF';for(let i=0;i<3;i++){const p=(t*1.4+i/3)%1;ctx.globalAlpha=slump*(1-p);ctx.beginPath();ctx.ellipse(cx-8+i*10,cy+14+p*22,1.8,3.2,0,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1}
    if(this.state==='thinking'){ctx.fillStyle='rgba(40,30,60,.8)';for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(W/2+B.w*scale*.3+i*14,headY+8+Math.sin(t*7-i*.9)*4,4.5,0,Math.PI*2);ctx.fill()}}
    this.parts=this.parts.filter(p=>{p.life-=dt;p.vy+=p.g*dt;p.vx*=Math.pow(.4,dt);p.x+=p.vx*dt;p.y+=p.vy*dt;p.a+=p.va*dt;
      ctx.save();ctx.globalAlpha=clamp(p.life*1.5,0,1);ctx.translate(W/2+p.x+(p.h?Math.sin(t*4+p.life*3)*6:0),ground+p.y);ctx.rotate(p.a);ctx.fillStyle=p.c;
      if(p.h){ctx.beginPath();ctx.moveTo(0,5);ctx.bezierCurveTo(-9,-1,-6,-8,0,-3);ctx.bezierCurveTo(6,-8,9,-1,0,5);ctx.fill()}else ctx.fillRect(-3.5,-2.5,7,5);ctx.restore();return p.life>0});
    this._raf=requestAnimationFrame(this._frame.bind(this));
  }
}

// Split a keyed sheet into separate, equally-sized frames, each standing on the same spot.
function splitSheet(k,cols=3,rows=2){const N=cols*rows,W=k.canvas.width,H=k.canvas.height,D=4,w=Math.ceil(W/D),h=Math.ceil(H/D);
  const a=k.canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data,m=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=((y*D)*W+x*D)*4+3;m[y*w+x]=a[i]>60?1:0}
  const lab=new Int32Array(w*h),comps=[];let id=0;const q=new Int32Array(w*h);
  for(let p=0;p<w*h;p++){if(!m[p]||lab[p])continue;id++;let qh=0,qt=0;q[qt++]=p;lab[p]=id;let x0=w,y0=h,x1=0,y1=0,n=0;
    while(qh<qt){const c=q[qh++],cx=c%w,cy=(c/w)|0;n++;if(cx<x0)x0=cx;if(cx>x1)x1=cx;if(cy<y0)y0=cy;if(cy>y1)y1=cy;
      for(const nb of [cx>0?c-1:-1,cx<w-1?c+1:-1,cy>0?c-w:-1,cy<h-1?c+w:-1])if(nb>=0&&m[nb]&&!lab[nb]){lab[nb]=id;q[qt++]=nb}}
    comps.push({id,n,x:x0*D,y:y0*D,w:(x1-x0+1)*D,h:(y1-y0+1)*D})}
  comps.sort((a,b)=>b.n-a.n);let big=comps.filter(c=>c.n>comps[0].n*.25);
  // where the feet are: the average x of the bottom third of each big piece (arms don't move this)
  for(const c of big){const x0=c.x/D,y0=c.y/D,ww=c.w/D,hh=c.h/D,yy0=Math.floor(y0+hh*.66);let sx=0,n=0;
    for(let y=yy0;y<y0+hh;y++)for(let x=x0;x<x0+ww;x++)if(lab[y*w+x]===c.id){sx+=x;n++}c.foot=n?(sx/n)*D+D/2:c.x+c.w/2}
  // merge small detached bits (a hat tip, a held item) into the nearest big piece
  if(big.length>N)big=big.slice(0,N);
  let boxes;
  if(big.length===N){boxes=big.map(c=>({x:c.x,y:c.y,w:c.w,h:c.h,foot:c.foot}));
    for(const c of comps){if(big.includes(c)||c.n<comps[0].n*.004)continue;const cx=c.x+c.w/2,cy=c.y+c.h/2;
      const t=boxes.find(b=>cx>b.x-b.w*.15&&cx<b.x+b.w*1.15&&cy>b.y-b.h*.25&&cy<b.y+b.h*1.1);if(t){const x2=Math.max(t.x+t.w,c.x+c.w),y2=Math.max(t.y+t.h,c.y+c.h);t.x=Math.min(t.x,c.x);t.y=Math.min(t.y,c.y);t.w=x2-t.x;t.h=y2-t.y}}
    boxes.sort((a,b)=>(a.y+a.h/2)-(b.y+b.h/2));let out=[];for(let r=0;r<rows;r++)out=out.concat(boxes.slice(r*cols,(r+1)*cols).sort((a,b)=>a.x-b.x));boxes=out}
  else{boxes=[];for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const cx0=c*W/cols,cy0=r*H/rows;boxes.push(tightBox(a,W,cx0,cy0,W/cols,H/rows))}}
  boxes.forEach(b=>{if(b.foot===undefined)b.foot=b.x+b.w/2});
  const mg=10,L=Math.ceil(Math.max(...boxes.map(b=>Math.max(2*Math.max(b.foot-b.x,b.x+b.w-b.foot),b.h)))+2*mg);
  return boxes.map(b=>{const c=canvasOf(L,L),x=c.getContext('2d');const dx=L/2-b.foot,dy=L-mg-(b.y+b.h);
    x.save();x.beginPath();x.rect(b.x+dx-2,L-mg-b.h-2,b.w+4,b.h+4);x.clip();x.drawImage(k.canvas,dx,dy);x.restore();
    return {canvas:c,bbox:{x:b.x+dx,y:L-mg-b.h,w:b.w,h:b.h}}})}
function tightBox(a,W,x0,y0,cw,ch){let minX=1e9,minY=1e9,maxX=0,maxY=0;for(let y=Math.floor(y0);y<y0+ch;y+=2)for(let x=Math.floor(x0);x<x0+cw;x+=2){if(a[(y*W+x)*4+3]>60){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y}}
  return minX>maxX?{x:x0,y:y0,w:cw,h:ch}:{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1}}

const px1=(b,L)=>b&&b.w>0?{x:b.x*L,y:b.y*L,w:b.w*L,h:b.h*L}:null;
function reachSide(base,full){const S=200,f=S/base.canvas.width,alpha=(c,dx,dy)=>{const t=canvasOf(S,S),x=t.getContext('2d',{willReadFrequently:true});x.drawImage(c,-dx*f,-dy*f,S,S);return x.getImageData(0,0,S,S).data};
  const A=alpha(base.canvas,0,0),B=alpha(full.canvas,0,0),bb=base.bbox,xl=(bb.x+bb.w*.15)*f,xr=(bb.x+bb.w*.85)*f,y0=(bb.y+bb.h*.15)*f,y1=(bb.y+bb.h*.85)*f;
  let L=0,R=0;for(let y=Math.floor(y0);y<y1;y++)for(let x=0;x<S;x++){const i=(y*S+x)*4+3;if(B[i]>128&&A[i]<60){if(x<xl)L++;else if(x>xr)R++}}
  if(L+R<12)return null;return L>R*1.5?'L':R>L*1.5?'R':null}
// The image model sometimes paints a pose a little bigger or smaller than the standing pose.
// Find the size that best matches the standing silhouette (scaling about the feet) and resize to it.
function matchScale(base,fr){const L=base.canvas.width,S=128,k=S/L,bb=base.bbox,ax=(bb.x+bb.w/2)*k,ay=(bb.y+bb.h)*k;
  const mask=(c,sc)=>{const t=canvasOf(S,S),x=t.getContext('2d',{willReadFrequently:true});x.translate(ax,ay);x.scale(sc,sc);x.translate(-ax,-ay);x.drawImage(c,0,0,S,S);
    const d=x.getImageData(0,0,S,S).data,m=new Uint8Array(S*S);for(let i=0;i<S*S;i++)m[i]=d[i*4+3]>128?1:0;return m};
  const A=mask(base.canvas,1);let best={e:1e9,s:1};
  for(let sc=.8;sc<=1.201;sc+=.02){const B=mask(fr.canvas,sc);let e=0;for(let i=0;i<S*S;i++)e+=A[i]^B[i];if(e<best.e)best={e,s:sc}}
  if(Math.abs(best.s-1)<.03)return fr;
  const c=canvasOf(L,L),x=c.getContext('2d'),AX=ax/k,AY=ay/k;x.translate(AX,AY);x.scale(best.s,best.s);x.translate(-AX,-AY);x.drawImage(fr.canvas,0,0);
  const b=fr.bbox;return {canvas:c,bbox:{x:AX+(b.x-AX)*best.s,y:AY+(b.y-AY)*best.s,w:b.w*best.s,h:b.h*best.s},scaled:best.s}}
function mirrorFrame(fr){const c=canvasOf(fr.canvas.width,fr.canvas.height),x=c.getContext('2d');x.translate(c.width,0);x.scale(-1,1);x.drawImage(fr.canvas,0,0);
  return {canvas:c,bbox:{x:c.width-fr.bbox.x-fr.bbox.w,y:fr.bbox.y,w:fr.bbox.w,h:fr.bbox.h}}}
function faceFrom(face,L,bb){let box=face&&face.face&&face.face.w>0?px1(face.face,L):{x:bb.x+bb.w*.2,y:bb.y+bb.h*.14,w:bb.w*.6,h:bb.h*.38};
  box.w=Math.max(box.w,bb.w*.18);box.h=Math.max(box.h,bb.h*.12);
  return {box,eyes:face&&Array.isArray(face.eyes)?face.eyes.map(e=>px1(e,L)).filter(Boolean):[],mouth:face?px1(face.mouth,L):null,eyeColor:face&&face.eyeColor}}
function simpleInfo(f,canvas){const F={...f};
  if(!F.eyes||F.eyes.length<2){const b=F.box;F.eyes=[{x:b.x+b.w*.14,y:b.y+b.h*.2,w:b.w*.26,h:b.w*.28},{x:b.x+b.w*.6,y:b.y+b.h*.2,w:b.w*.26,h:b.w*.28}]}
  if(F.eyes.length>2)F.eyes=F.eyes.slice(0,2);
  if(!F.mouth){const b=F.box;F.mouth={x:b.x+b.w*.36,y:b.y+b.h*.68,w:b.w*.28,h:b.h*.14}}
  // keep eyes a sensible size and round-ish
  const ew=(F.eyes[0].w+F.eyes[1].w)/2;F.eyes=F.eyes.map(e=>{const cx=e.x+e.w/2,cy=e.y+e.h/2,w=Math.max(ew,F.box.w*.16),h=Math.max(e.h,w*1.05);return {x:cx-w/2,y:cy-h/2,w,h}});
  F.mouth={...F.mouth,w:Math.max(F.mouth.w,ew*1.1),h:Math.max(F.mouth.h,ew*.42)};
  const between={x:Math.min(F.eyes[0].x,F.eyes[1].x),y:F.eyes[0].y+F.eyes[0].h*.9,w:Math.abs(F.eyes[1].x-F.eyes[0].x)+F.eyes[1].w,h:Math.max(4,F.mouth.y-(F.eyes[0].y+F.eyes[0].h))};
  F.skin=sampleSkin(canvas,{x:between.x,y:F.eyes[0].y+F.eyes[0].h*1.15,w:between.w,h:F.eyes[0].h*.6});
  return F}

// Which side gained new opaque pixels (a raised arm) next to the head, compared with the neutral frame?
function raisedSide(base,full,face){const S=200,f=S/base.canvas.width,alpha=(c,dx,dy)=>{const t=canvasOf(S,S),x=t.getContext('2d',{willReadFrequently:true});x.drawImage(c,-dx*f,-dy*f,S,S);return x.getImageData(0,0,S,S).data};
  const A=alpha(base.canvas,0,0),B=alpha(full.canvas,0,0),y0=Math.max(0,(base.bbox.y-base.bbox.h*.2)*f),y1=(face.y+face.h*1.3)*f,xl=face.x*f,xr=(face.x+face.w)*f;
  let L=0,R=0;for(let y=Math.floor(y0);y<Math.min(S,y1);y++)for(let x=0;x<S;x++){const i=(y*S+x)*4+3;if(B[i]>128&&A[i]<60){if(x<xl)L++;else if(x>xr)R++}}
  if(L+R<12)return null;return L>R*1.6?'L':R>L*1.6?'R':null}
// Measure where the eyes and mouth really are by comparing frames: neutral vs blink finds the eyes,
// neutral vs talking/surprised finds the mouth. Falls back to the rough face if the measurement looks wrong.
function refineFace(frames,face,names){
  try{const base=frames[0],L=base.canvas.width,S=256,f=S/L,BB=base.bbox,idx=n=>names.indexOf(n);
    const grab=(fr,off)=>{const t=canvasOf(S,S),x=t.getContext('2d',{willReadFrequently:true});x.fillStyle='#808080';x.fillRect(0,0,S,S);
      x.drawImage(fr.canvas,-(off?off.dx:0)*f,-(off?off.dy:0)*f,S,S);const d=x.getImageData(0,0,S,S).data,g=new Float32Array(S*S);
      for(let i=0;i<S*S;i++)g[i]=d[i*4]*.3+d[i*4+1]*.59+d[i*4+2]*.11;
      const b=new Float32Array(S*S);for(let y=1;y<S-1;y++)for(let xx=1;xx<S-1;xx++){let a=0;for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++)a+=g[(y+j)*S+xx+k];b[y*S+xx]=a/9}return b};
    const G0=grab(base),x0=BB.x*f,y0=BB.y*f,x1=(BB.x+BB.w)*f,y1=(BB.y+BB.h)*f;
    const diff=name=>{const i=idx(name);if(i<1||!frames[i])return null;const off=alignFrames(base,frames[i],face.box),G=grab(frames[i],off),D=new Float32Array(S*S);
      for(let y=Math.floor(y0);y<y1;y++)for(let x=Math.floor(x0);x<x1;x++){const p=y*S+x;D[p]=Math.abs(G0[p]-G[p])}return D};
    const blobs=(D,yMin,yMax)=>{let sum=0,sq=0,n=0;for(let y=Math.floor(y0);y<y1;y++)for(let x=Math.floor(x0);x<x1;x++){const v=D[y*S+x];sum+=v;sq+=v*v;n++}
      const mean=sum/n,sd=Math.sqrt(Math.max(0,sq/n-mean*mean)),thr=Math.max(20,mean+2.6*sd);
      const lab=new Int32Array(S*S),out=[];let id=0;const q=[];
      for(let y=Math.max(0,Math.floor(yMin));y<Math.min(S,yMax);y++)for(let x=Math.floor(x0);x<x1;x++){const p=y*S+x;if(D[p]<thr||lab[p])continue;
        id++;lab[p]=id;q.length=0;q.push(p);let a=0,bx0=S,by0=S,bx1=0,by1=0;
        while(q.length){const c=q.pop(),cx=c%S,cy=(c/S)|0;a++;if(cx<bx0)bx0=cx;if(cx>bx1)bx1=cx;if(cy<by0)by0=cy;if(cy>by1)by1=cy;
          for(const nb of [c-1,c+1,c-S,c+S]){const nx=nb%S,ny=(nb/S)|0;if(nb<0||nb>=S*S||lab[nb]||D[nb]<thr||ny<yMin||ny>=yMax||nx<x0||nx>=x1)continue;lab[nb]=id;q.push(nb)}}
        out.push({a,x:bx0,y:by0,w:bx1-bx0+1,h:by1-by0+1})}
      out.sort((a,b)=>b.a-a.a);return out.filter(o=>o.a>=Math.max(6,out.length?out[0].a*.18:0))};
    const union=bs=>bs.length?bs.reduce((u,b)=>{const X=Math.min(u.x,b.x),Y=Math.min(u.y,b.y);return {x:X,y:Y,w:Math.max(u.x+u.w,b.x+b.w)-X,h:Math.max(u.y+u.h,b.y+b.h)-Y}}):null;
    const Db=diff('blink');if(!Db)return face;
    const eb=blobs(Db,y0,y0+(y1-y0)*.75).slice(0,2);const eyes=union(eb);if(!eyes)return face;
    const Dm=[diff('talk'),diff('surprised')].filter(Boolean);if(!Dm.length)return face;
    const mb=[];Dm.forEach(D=>mb.push(...blobs(D,eyes.y+eyes.h*.9,y1).slice(0,1)));let mouth=union(mb);
    const bw=(x1-x0);
    if(!mouth||eyes.w<bw*.06||eyes.w>bw*.85||mouth.w<bw*.03||mouth.w>bw*.7||mouth.y<eyes.y+eyes.h*.5)return face;
    const px=b=>({x:b.x/f,y:b.y/f,w:b.w/f,h:b.h/f});const E=px(eyes),M=px(mouth);
    const bx=Math.min(E.x,M.x),by=Math.min(E.y,M.y),bx2=Math.max(E.x+E.w,M.x+M.w),by2=Math.max(E.y+E.h,M.y+M.h);
    return {box:{x:bx-(bx2-bx)*.12,y:by-(by2-by)*.15,w:(bx2-bx)*1.24,h:(by2-by)*1.3},eyes:[E],mouth:M,refined:true,eyeColor:face.eyeColor}}
  catch(e){return face}}

// Load a saved mascot ({mode, image, face, grid, name, greeting}) into a rig.
// Some environments (like the iOS simulator) can't decode WebP; the mobile core sets PIP_IMAGE_FORMAT='png' there
function blankFrame(fr){const b=fr.bbox,c=fr.canvas.getContext('2d',{willReadFrequently:true}),y=Math.round(b.y+b.h*.5),d=c.getImageData(Math.round(b.x),y,Math.max(1,Math.round(b.w)),1).data;for(let i=3;i<d.length;i+=4)if(d[i]>10)return false;return true}
function imgURL(u){const f=typeof window!=='undefined'&&window.PIP_IMAGE_FORMAT;return f&&/\/api\/mascot\?/.test(u)?u+'&fmt='+f:u}
async function mountMascot(rig,data){
  if(data.atlas&&data.atlasMeta&&data.atlasFace&&data.mode!=='simple'){
    try{const img=await loadImg(imgURL(data.atlas)),frames=framesFromAtlas(img,data.atlasMeta);
      if(typeof window!=='undefined'&&!window.PIP_IMAGE_FORMAT&&blankFrame(frames[0])){window.PIP_IMAGE_FORMAT='png';return mountMascot(rig,data)}
      rig.cfg={name:data.name||'',greeting:data.greeting||`Hi${data.name?", I'm "+data.name:''}!`};
      rig.simple=null;rig.setBase(frames[0]);rig.setFace(data.atlasFace);data.face=data.atlasFace;attachFrames(rig,frames,data.atlasFace);return rig}
    catch(e){/* fall back to preparing the original painting */}}
  const k=keyOut(await loadImg(imgURL(data.image)));rig.cfg={name:data.name||'',greeting:data.greeting||`Hi${data.name?", I'm "+data.name:''}!`};
  if(data.mode==='simple'){rig.setBase(k);rig.setSimple(simpleInfo(data.face,k.canvas));return rig}
  const [c,r]=data.grid||[3,2],frames=splitSheet(k,c,r);rig.simple=null;rig.setBase(frames[0]);const face=refineFace(frames,data.face,SHEET_NAMES);rig.setFace(face);data.face=face;
  attachFrames(rig,frames,face);return rig}
// Prepared poses: the cut-out frames packed into one image, so pages skip the cut-out work.
const ATLAS_MAX=640;
function scaleRects(o,k){if(Array.isArray(o))return o.map(v=>scaleRects(v,k));if(o&&typeof o==='object'){const r={};for(const key in o){const v=o[key];r[key]=(typeof v==='number'&&/^(x|y|w|h)$/.test(key))?v*k:scaleRects(v,k)}return r}return o}
function buildAtlas(frames,face,max){const L=frames[0].canvas.width,size=Math.min(L,max||ATLAS_MAX),k=size/L,cols=4,rows=Math.ceil(frames.length/cols);
  const c=canvasOf(size*cols,size*rows),x=c.getContext('2d');x.imageSmoothingQuality='high';
  frames.forEach((fr,i)=>x.drawImage(fr.canvas,(i%cols)*size,Math.floor(i/cols)*size,size,size));
  return {canvas:c,meta:{v:1,size,cols,n:frames.length,boxes:frames.map(f=>scaleRects(f.bbox,k))},face:scaleRects(face,k)}}
function framesFromAtlas(img,meta){const {size,cols,n,boxes}=meta;
  return boxes.slice(0,n).map((bb,i)=>{const c=canvasOf(size,size);c.getContext('2d').drawImage(img,(i%cols)*size,Math.floor(i/cols)*size,size,size,0,0,size,size);return {canvas:c,bbox:bb}})}
// Encode an atlas for upload: WebP keeps transparency small; browsers without WebP encoding get a smaller PNG.
async function encodeAtlas(frames,face){let a=buildAtlas(frames,face);
  const blobOf=(c,t,q)=>new Promise(r=>c.toBlob(r,t,q));let blob=await blobOf(a.canvas,'image/webp',.9);
  if(!blob||blob.type!=='image/webp'){a=buildAtlas(frames,face,400);blob=await blobOf(a.canvas,'image/png')}
  const b64=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(String(fr.result).split(',')[1]);fr.readAsDataURL(blob)});
  return {atlas:b64,atlasMime:blob.type,atlasMeta:a.meta,atlasFace:a.face}}
const SHEET_NAMES=['neutral','blink','happy','talk','worried','surprised','confused','waveA','waveB','pointL','pointR','talkE'];
const FULL_FRAMES=['waveA','waveB','pointL','pointR'];
// Attach every frame of a split sheet to a rig (expressions as face patches, poses as full frames), with sanity checks.
function attachFrames(rig,frames,face){
  frames=frames.map((fr,i)=>i&&FULL_FRAMES.includes(SHEET_NAMES[i])?matchScale(frames[0],fr):fr);
  frames.forEach((fr,i)=>{const n=SHEET_NAMES[i];if(!n||n==='neutral')return;if(FULL_FRAMES.includes(n))rig.addFull(n,fr);else rig.addExpr(n,fr)});
  if(rig.full.waveA&&rig.full.waveB){const a=raisedSide(frames[0],rig.full.waveA,face.box),b=raisedSide(frames[0],rig.full.waveB,face.box);if(!a||!b||a!==b)delete rig.full.waveB}
  const pl=frames[9],pr=frames[10];
  if(pl||pr){const sl=rig.full.pointL&&reachSide(frames[0],rig.full.pointL),sr=rig.full.pointR&&reachSide(frames[0],rig.full.pointR);delete rig.full.pointL;delete rig.full.pointR;
    const byside={};if(sl)byside[sl]=pl;if(sr&&!byside[sr])byside[sr]=pr;
    if(byside.L&&!byside.R)byside.R=mirrorFrame(byside.L);if(byside.R&&!byside.L)byside.L=mirrorFrame(byside.R);
    if(byside.L)rig.addFull('pointL',byside.L);if(byside.R)rig.addFull('pointR',byside.R)}}
return {reachSide,matchScale,encodeAtlas,buildAtlas,framesFromAtlas,attachFrames,refineFace,mountMascot,PaintRig,keyOut,splitSheet,alignFrames,raisedSide,faceFrom,simpleInfo,loadImg,canvasOf,b64ToDataUrl,canvasB64,SHEET_NAMES,Spring};
}

var paintedEngine=PipPaintedEngine();
(function definePipElement(engine,defaultConfig,painted,origin){
  if(typeof customElements==='undefined'||customElements.get('pip-mascot'))return;
  origin=origin||'https://pip-mascot.vercel.app';
  // Wrap a painted rig so it speaks the same language as the vector mascot.
  const adapt=rig=>({rig,get state(){return rig.state},get cfg(){return rig.cfg},get focusEl(){return rig.focusEl},set focusEl(v){rig.focusEl=v},
    get lean(){return rig.lean},set lean(v){rig.lean=v},setState:s=>rig.setState(s),react:(s,ms)=>rig.react(s,ms),say:(t,o)=>rig.say(t,o),
    cover:on=>{rig.cover=!!on},lookAt:(x,y)=>rig.lookAt(x,y),lookAtCaret:i=>rig.lookAtCaret(i),bump:()=>rig.bump(),hop:v=>rig.hop(v),
    point:(x,y)=>rig.point(x,y),unpoint:()=>rig.unpoint(),destroy:()=>rig.destroy(),
    watch(inp){const secret=inp.type==='password';inp.addEventListener('focus',()=>{rig.focusEl=inp;if(secret)rig.cover=true;rig.lookAtCaret(inp)});
      inp.addEventListener('input',()=>{rig.lookAtCaret(inp);rig.bump()});inp.addEventListener('blur',()=>{rig.focusEl=null;if(secret)rig.cover=false})}});
  const RM=engine.RM,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wait=ms=>new Promise(r=>setTimeout(r,ms)),pick=a=>a[Math.floor(Math.random()*a.length)];
  const RATIO=254/240;
  // Seasonal touches that drift around the mascot without changing how it looks. Picked by date; seasonal="off" turns them off.
  const SEASONS=['snow','leaves','confetti','hearts','bats'];
  const seasonFor=d=>{const m=d.getMonth()+1,day=d.getDate(),h=d.getHours();
    if(m===10&&day>=24)return 'bats';if(m===11)return 'leaves';if((m===12&&day===31&&h>=18)||(m===1&&day===1))return 'confetti';
    if(m===12)return 'snow';if(m===2&&day>=10&&day<=14)return 'hearts';return null};
  function runSeason(cv,kind,host){const x=cv.getContext('2d');let W=0,H=0,dpr=1,last=performance.now(),raf=0,stop=false;const ps=[];
    const N={snow:16,leaves:9,confetti:14,hearts:7,bats:4}[kind]||10,COL={leaves:['#E8833A','#D9502F','#F2B134','#B5562B'],confetti:['#FF6B7A','#6E9BFF','#7DDC8A','#FFC23D','#B58CFF'],hearts:['#FF6B8A','#FF8FA8','#E84A6F']};
    const size=()=>{const r=cv.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);const w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(w!==cv.width||h!==cv.height){cv.width=w;cv.height=h}W=r.width;H=r.height};
    const spawn=fresh=>{const p={x:Math.random()*W,y:fresh?Math.random()*H:-12,r:Math.random()*6,vr:(Math.random()-.5)*2,ph:Math.random()*6.28,s:.7+Math.random()*.6,c:null,vx:0,vy:0};
      if(kind==='snow'){p.vy=12+Math.random()*14;p.s=1.4+Math.random()*2.2}
      else if(kind==='leaves'){p.vy=16+Math.random()*12;p.c=pick(COL.leaves)}
      else if(kind==='confetti'){p.vy=40+Math.random()*30;p.c=pick(COL.confetti)}
      else if(kind==='hearts'){p.y=fresh?Math.random()*H:H+12;p.vy=-(12+Math.random()*10);p.c=pick(COL.hearts)}
      else{p.y=H*(.08+Math.random()*.5);p.x=fresh?Math.random()*W:-14;p.vx=14+Math.random()*10}
      return p};
    size();for(let i=0;i<N;i++)ps.push(spawn(true));
    const frame=now=>{if(stop)return;if(!cv.isConnected){stop=true;return}const dt=Math.min((now-last)/1000,.05);last=now;
      x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);
      if(host.hasAttribute('data-hidden')){raf=requestAnimationFrame(frame);return}
      for(let i=0;i<ps.length;i++){const p=ps[i];p.ph+=dt;p.y+=p.vy*dt;p.r+=p.vr*dt;
        if(kind==='bats')p.x+=p.vx*dt;else p.x+=Math.sin(p.ph*1.3)*(kind==='leaves'?18:8)*dt;
        if(kind==='hearts'?p.y<-14:kind==='bats'?p.x>W+14:p.y>H+12){ps[i]=spawn(false);continue}
        const a=clamp(Math.min(p.y+12,H-p.y)/(H*.18),0,1)*.85;if(a<=0)continue;x.globalAlpha=a;x.save();x.translate(p.x,p.y);
        if(kind==='snow'){x.beginPath();x.arc(0,0,p.s,0,6.283);x.fillStyle='#fff';x.fill();x.lineWidth=.8;x.strokeStyle='rgba(110,130,170,.65)';x.stroke()}
        else if(kind==='leaves'){x.rotate(p.r+Math.sin(p.ph*2)*.6);x.scale(p.s,p.s);x.fillStyle=p.c;x.beginPath();x.moveTo(0,-7);x.quadraticCurveTo(6,-2,0,7);x.quadraticCurveTo(-6,-2,0,-7);x.fill();
          x.strokeStyle='rgba(90,40,20,.5)';x.lineWidth=.8;x.beginPath();x.moveTo(0,-6);x.lineTo(0,9);x.stroke()}
        else if(kind==='confetti'){x.rotate(p.r*3);x.fillStyle=p.c;x.fillRect(-3,-2,6,4)}
        else if(kind==='hearts'){x.scale(p.s,p.s);x.fillStyle=p.c;x.beginPath();x.moveTo(0,4);x.bezierCurveTo(-7,-1,-5,-7,0,-3);x.bezierCurveTo(5,-7,7,-1,0,4);x.fill()}
        else{const f=Math.sin(p.ph*14)*.8;x.scale(p.s,p.s);x.fillStyle='#3B2A4D';x.beginPath();x.ellipse(0,0,2.6,3.2,0,0,6.283);x.fill();
          for(const sd of [-1,1]){x.beginPath();x.moveTo(0,-1);x.quadraticCurveTo(sd*6,-6*f-2,sd*11,-2*f);x.quadraticCurveTo(sd*7,1,0,2);x.fill()}}
        x.restore()}
      x.globalAlpha=1;raf=requestAnimationFrame(frame)};
    raf=requestAnimationFrame(frame);const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(size):null;if(ro)ro.observe(cv);
    return ()=>{stop=true;cancelAnimationFrame(raf);if(ro)ro.disconnect();x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,cv.width,cv.height)}}
  class PipMascot extends HTMLElement{
    static get observedAttributes(){return ['state','position','offset','size','mobile-size','seasonal']}
    connectedCallback(){
      if(this._m)return;const root=this.shadowRoot||this.attachShadow({mode:'open'});
      this._anchor=this.hasAttribute('dock')?(this.getAttribute('dock')?document.querySelector(this.getAttribute('dock')):this.parentElement):null;
      this._float=!!this._anchor||this.hasAttribute('float')||this.hasAttribute('autopilot');
      const mid=this.getAttribute('mascot'),isPainted=!!(mid&&painted);this.toggleAttribute('painted',isPainted);this._ratio=isPainted?1.12:254/240;
      root.innerHTML=`<style>:host{display:inline-block;position:relative;width:var(--pip-size,${this._float?'118px':'180px'});vertical-align:bottom;-webkit-tap-highlight-color:transparent}
        svg{width:100%;height:auto;display:block;overflow:visible;cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none}
        .bubble{position:absolute;left:50%;bottom:94%;transform:translate(-50%,4px);max-width:210px;width:max-content;background:var(--pip-bubble-bg,#fff);color:var(--pip-bubble-ink,#1B1A26);
          border:2px solid #2A2140;border-radius:14px;padding:6px 10px;font:500 14px/1.35 system-ui,-apple-system,sans-serif;opacity:0;transition:opacity .18s,transform .18s;pointer-events:none;box-shadow:0 4px 14px -6px rgba(20,20,50,.35)}
        .bubble.show{opacity:1;transform:translate(-50%,0)}
        .bubble.r{left:auto;right:4px;transform:translate(0,4px)}.bubble.l{left:4px;transform:translate(0,4px)}.bubble.r.show,.bubble.l.show{transform:none}
        .bubble.below{bottom:auto;top:92%}
        @media (prefers-reduced-motion: reduce){.bubble{transition:none}}
        canvas[role=img]{position:relative;width:180%;margin-left:-40%;margin-top:-50.4%;aspect-ratio:1.8/1.624;display:block;pointer-events:none}svg[role=img]{position:relative}
        .season{position:absolute;left:-30%;top:-55%;width:160%;height:155%;pointer-events:none}:host([painted]){cursor:pointer;touch-action:manipulation}
        .hide,.peek{display:none;place-items:center;padding:0;cursor:pointer;border:2px solid #2A2140;background:#fff;color:#2A2140;border-radius:50%;font:inherit}
        .hide{position:absolute;top:0;right:-2px;width:28px;height:28px;z-index:2;opacity:0;transition:opacity .15s}
        .hide svg{width:10px;height:10px;cursor:pointer}.peek svg{width:24px;height:24px;cursor:pointer}
        :host([data-hideable]) .hide{display:grid}
        :host([data-hideable]:hover) .hide,.hide:focus-visible,.hide.on{opacity:1}
        .bubble.show~.hide{opacity:0!important;pointer-events:none}
        :host([data-left]) .hide{right:auto;left:-2px}:host([data-left]) .peek{right:auto;left:4px}
        .peek{position:absolute;right:4px;bottom:4px;width:46px;height:46px;box-shadow:0 3px 0 #2A2140;pointer-events:auto}
        :host([data-hidden]){pointer-events:none}
        :host([data-hidden]) .peek{display:grid}
        :host([data-hidden]) canvas,:host([data-hidden]) svg[role=img],:host([data-hidden]) .bubble,:host([data-hidden]) .hide{visibility:hidden}
        </style><canvas class="season" part="season" aria-hidden="true"></canvas><div class="bubble" part="bubble" aria-live="polite"></div>${isPainted?'<canvas role="img" aria-label="Animated mascot"></canvas>':'<svg viewBox="0 -22 240 254" role="img"></svg>'}<button class="hide" part="hide" type="button" aria-label="Hide the mascot" title="Hide"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button><button class="peek" part="peek" type="button" aria-label="Show the mascot" title="Show"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#FFD35A" stroke="#2A2140" stroke-width="2"/><circle cx="9" cy="10.5" r="1.5" fill="#2A2140"/><circle cx="15" cy="10.5" r="1.5" fill="#2A2140"/><path d="M8.3 14.6c1.3 1.7 6.1 1.7 7.4 0" stroke="#2A2140" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg></button>`;
      this._season();
      let cfg=defaultConfig;try{const a=this.getAttribute('config');if(a)cfg=JSON.parse(a)}catch(e){}
      const sa=this.getAttribute('sleep-after');
      const onState=(s,why)=>this.dispatchEvent(new CustomEvent('statechange',{detail:{state:s,reason:why||null}}));
      const sleepAfter=sa===null?20000:Number(sa)*1000;let m;
      if(isPainted){const rig=new painted.PaintRig(root.querySelector('canvas[role=img]'),{bubble:root.querySelector('.bubble'),fit:.94,pad:.4,padTop:.45,hit:this,sleepAfter,onState});m=this._m=adapt(rig);
        this._ready=fetch(`${this.getAttribute('api')||origin}/api/mascot?id=${encodeURIComponent(mid)}`).then(r=>{if(!r.ok)throw new Error('Mascot not found');return r.json()})
          .then(d=>painted.mountMascot(rig,d)).then(()=>this.dispatchEvent(new CustomEvent('ready'))).catch(e=>{console.warn('pip-mascot:',e);this.dispatchEvent(new CustomEvent('error',{detail:String(e)}))})}
      else{m=this._m=new engine.Mascot(root.querySelector('svg'),cfg,{bubble:root.querySelector('.bubble'),sleepAfter,onState});this._ready=Promise.resolve()}
      const say=m.say.bind(m);m.say=(t,o)=>{this._placeBubble();return say(t,o)};
      const st=this.getAttribute('state');if(st)m.setState(st);
      // Visitors can hide a floating mascot; the choice is remembered on this site. Opt out with the no-hide attribute.
      if(this._float&&!this._anchor&&!this.hasAttribute('no-hide')){
        this.setAttribute('data-hideable','');const KEY='pip-hidden:'+location.host,hb=root.querySelector('.hide'),pb=root.querySelector('.peek');let xT=0;
        const store=v=>{try{v?localStorage.setItem(KEY,'1'):localStorage.removeItem(KEY)}catch(e){}};
        this.hideMascot=()=>{if(this._hiddenByUser)return;const go=()=>{this._hiddenByUser=true;this.setAttribute('data-hidden','');store(1);
            this.dispatchEvent(new CustomEvent('pip:hide'));try{pb.focus({preventScroll:true})}catch(e){}};
          (this._docked||!this._m?Promise.resolve():this.home()).then(go,go)};
        this.showMascot=()=>{if(!this._hiddenByUser)return;this._hiddenByUser=false;this.removeAttribute('data-hidden');store(0);
          this.dispatchEvent(new CustomEvent('pip:show'));try{m.react('wave',1600);m.say("I'm back!",{hold:1200})}catch(e){}};
        hb.addEventListener('pointerdown',e=>e.stopPropagation());hb.addEventListener('click',e=>{e.stopPropagation();this.hideMascot()});
        pb.addEventListener('pointerdown',e=>e.stopPropagation());pb.addEventListener('click',e=>{e.stopPropagation();this.showMascot()});
        this.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;hb.classList.add('on');clearTimeout(xT);xT=setTimeout(()=>hb.classList.remove('on'),3500)});
        try{if(localStorage.getItem(KEY)==='1'){this._hiddenByUser=true;this.setAttribute('data-hidden','')}}catch(e){}}
      const greet=()=>this._ready.then(()=>{if(this.hasAttribute('greet')&&this._m){m.react('wave',2400);m.say(this.getAttribute('greeting')||m.cfg.greeting,{hold:2600})}});
      if(this._float){
        // With a home spot on the page, ride along with the page (absolute) so scrolling never lags; otherwise float over the screen (fixed).
        this._abs=!!this._anchor;
        Object.assign(this.style,{position:this._abs?'absolute':'fixed',left:'0',top:'0',margin:'0',zIndex:'2147483000',visibility:'hidden'});
        this._pos=[0,0];this._docked=true;
        if(!this._anchor){this._applySize();this.toggleAttribute('data-left',this._place().h==='left')}
        this._onResize=()=>{if(!this._anchor){this._applySize();this._avoidCheck(true)}if(this._docked&&!this._walking){const d=this._dock();this._setPos(d[0],d[1])}};addEventListener('resize',this._onResize);
        // re-check the corner now and then: chat widgets often load a few seconds late
        if(!this._anchor)this._avT=setInterval(()=>{if(!document.hidden&&!this._hiddenByUser)this._avoidCheck()},2500);
        if(this._anchor){if(typeof ResizeObserver!=='undefined'){this._aro=new ResizeObserver(this._onResize);this._aro.observe(this._anchor)}
          requestAnimationFrame(()=>{const d=this._dock();this._setPos(d[0],d[1]);this.style.visibility='';setTimeout(greet,500)})}
        else requestAnimationFrame(()=>{this._avoidCheck(true);const d=this._dock();
          if(this._hiddenByUser){this._setPos(d[0],d[1]);this.style.visibility='';this._docked=true;return}
          this._setPos(d[0],this._place().v==='top'?-this._size()[1]-20:innerHeight+20);this.style.visibility='';
          this.walkTo(d[0],d[1],{ms:700,hops:false}).then(()=>{this._docked=true;setTimeout(greet,150)})});
      }else setTimeout(greet,500);
      if(this.hasAttribute('autopilot'))this._ap=autopilot(this);
    }
    disconnectedCallback(){if(this._seasonStop){this._seasonStop();this._seasonStop=null}if(this._ap){this._ap();this._ap=null}if(this._m){this._m.destroy();this._m=null}
      clearInterval(this._avT);if(this._onResize){removeEventListener('resize',this._onResize);removeEventListener('scroll',this._onResize)}if(this._aro)this._aro.disconnect();clearTimeout(this._homeT);this._walkTok=(this._walkTok||0)+1}
    _season(){if(this._seasonStop){this._seasonStop();this._seasonStop=null}const cv=this.shadowRoot&&this.shadowRoot.querySelector('.season');if(!cv)return;
      const a=(this.getAttribute('seasonal')||'auto').trim().toLowerCase();if(['off','false','none','no'].includes(a)||RM<1)return;
      const kind=a==='auto'||a==='on'||a==='true'?seasonFor(new Date()):a;if(SEASONS.includes(kind))this._seasonStop=runSeason(cv,kind,this)}
    attributeChangedCallback(n,o,v){if(n==='seasonal'){if(this._m)this._season();return}if(this._m&&n==='state'&&v)return this._m.setState(v);
      if(!this._m||o===v)return;if(n==='size'||n==='mobile-size')this._applySize();if(n==='position')this.toggleAttribute('data-left',this._place().h==='left');
      if(this._float&&!this._anchor){this._avoidCheck(true);if(this._docked&&!this._walking){if(n==='position'||n==='offset')this.home();else{const d=this._dock();this._setPos(d[0],d[1])}}}}
    // Where a floating mascot lives: position="bottom-right" (default) | bottom-left | top-right | top-left, offset="x y" in px
    _place(){const p=(this.getAttribute('position')||'bottom-right').toLowerCase(),o=(this.getAttribute('offset')||'').trim().split(/[\s,]+/).filter(Boolean).map(Number);
      const ox=Number.isFinite(o[0])?o[0]:10,oy=Number.isFinite(o[1])?o[1]:(Number.isFinite(o[0])?o[0]:6);
      return {v:/top/.test(p)?'top':'bottom',h:/left/.test(p)?'left':'right',ox,oy}}
    // size="small | medium | large" or a number of px; mobile-size applies on screens under 600px wide
    _applySize(){const map={small:92,medium:118,large:150},pick=v=>v==null||v===''?null:(map[v]||(Number.isFinite(+v)?+v:null));
      const px=(innerWidth<600&&pick(this.getAttribute('mobile-size')))||pick(this.getAttribute('size'));
      if(px)this.style.setProperty('--pip-size',px+'px')}
    // Step aside for chat bubbles, cookie banners and other things pinned in the same corner
    _avoidCheck(force){if(!this._float||this._anchor||this.getAttribute('avoid')==='false')return;const p=this._place(),[w,h]=this._size();
      const x0=p.h==='left'?p.ox:innerWidth-w-p.ox,xs=[x0+w*.2,x0+w*.5,x0+w*.8],bottom=p.v==='bottom';
      const ys=bottom?[innerHeight-p.oy-6,innerHeight-p.oy-h*.35,innerHeight-p.oy-h*.7]:[p.oy+6,p.oy+h*.35,p.oy+h*.7];
      const pinned=el=>{for(let e=el,i=0;e&&e!==document.body&&e!==document.documentElement&&i<8;e=e.parentElement,i++){const ps=getComputedStyle(e).position;if(ps==='fixed'||ps==='sticky')return e}return null};
      let lift=0;
      for(const x of xs)for(const y of ys){if(x<0||y<0||x>innerWidth||y>innerHeight)continue;
        for(const el of document.elementsFromPoint(x,y)){if(el===this||this.contains(el))continue;const f=pinned(el);if(!f)continue;const r=f.getBoundingClientRect();
          if(r.height>innerHeight*.6||r.width<8||r.height<8)continue;
          const need=bottom?innerHeight-r.top+8-p.oy:r.bottom+8-p.oy;if(need>lift)lift=need;break}}
      lift=Math.min(Math.max(0,lift),innerHeight*.5);const changed=Math.abs(lift-(this._lift||0))>2;this._lift=lift;
      if(changed&&!force&&this._docked&&!this._walking&&this._m){const d=this._dock();this.walkTo(d[0],d[1],{ms:420}).then(()=>{if(!this._walking)this._docked=true})}}
    _size(){const w=this.getBoundingClientRect().width||118;return [w,w*(this._ratio||RATIO)]}
    _dock(){const [w,h]=this._size();if(this._anchor){const r=this._anchor.getBoundingClientRect();return [r.left+r.width/2-w/2,r.bottom-h]}
      const p=this._place(),L=this._lift||0;return [p.h==='left'?p.ox:innerWidth-w-p.ox,p.v==='top'?p.oy+L:innerHeight-h-p.oy-L]}
    // Positions are given in screen coordinates; when riding along with the page they're stored relative to the positioned parent.
    _origin(){if(!this._abs)return [0,0];const p=this.offsetParent;
      if(!p||(p===document.body&&getComputedStyle(p).position==='static'))return [-scrollX,-scrollY];
      const r=p.getBoundingClientRect();return [r.left+p.clientLeft,r.top+p.clientTop]}
    get _pos(){const o=this._origin(),r=this._rel||[0,0];return [r[0]+o[0],r[1]+o[1]]}
    set _pos(v){const o=this._origin();this._rel=[v[0]-o[0],v[1]-o[1]]}
    _setPos(x,y){this._pos=[x,y];this.style.transform=`translate(${this._rel[0]}px,${this._rel[1]}px)`;this._placeBubble()}
    _placeBubble(){const b=this.shadowRoot&&this.shadowRoot.querySelector('.bubble');if(!b)return;const r=this.getBoundingClientRect(),c=r.left+r.width/2;
      b.classList.toggle('below',r.top<90);b.classList.toggle('r',c>innerWidth*.6);b.classList.toggle('l',c<innerWidth*.4)}
    walkTo(x,y,{ms,hops=true}={}){
      if(!this._float||!this._m||this._hiddenByUser)return Promise.resolve();const m=this._m,[x0,y0]=this._pos,dist=Math.hypot(x-x0,y-y0);
      const tok=this._walkTok=(this._walkTok||0)+1;this._docked=false;
      if(dist<3){this._setPos(x,y);return Promise.resolve()}
      ms=ms||clamp(dist/.6,380,1500);if(RM<1)ms=Math.min(ms,300);this._walking=true;m.lean=Math.sign(x-x0)*9;
      return new Promise(res=>{const t0=performance.now();let lastHop=-1e9;
        const step=now=>{if(tok!==this._walkTok||!this._m){this._walking=false;return res()}
          const p=clamp((now-t0)/ms,0,1),e=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;this._setPos(x0+(x-x0)*e,y0+(y-y0)*e);
          if(hops&&now-lastHop>300&&p<.85){m.hop(150);lastHop=now}
          if(p<1)requestAnimationFrame(step);else{m.lean=0;this._walking=false;res()}};
        requestAnimationFrame(step)})}
    async goTo(el,{mode='point',text,state,stay}={}){if(this._hiddenByUser)return;
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
    // Phones: hop onto the focused field so the keyboard doesn't hide the mascot
    // Switch between floating over the screen (fixed) and riding along with the page (absolute), keeping the same spot
    _setAbs(abs){if(!!this._abs===abs)return;const p=this._pos;this._abs=abs;this.style.position=abs?'absolute':'fixed';this._setPos(p[0],p[1])}
    _perch(el){if(this._hiddenByUser||!this._float||!this._m||!el||!el.isConnected)return Promise.resolve();
      // While perched, ride along with the page so the keyboard sliding things around can't knock the mascot off the field
      if(!this._anchor)this._setAbs(true);
      const vv=window.visualViewport,r=el.getBoundingClientRect(),[w,h]=this._size(),top=vv?vv.offsetTop:0;
      let x=clamp(r.right-w-6,4,innerWidth-w-4),y=r.top-h*.93+4;
      if(y<top+2)y=r.bottom+2;
      this._perched=el;clearTimeout(this._homeT);
      if(Math.hypot(x-this._pos[0],y-this._pos[1])<3)return Promise.resolve();
      return this.walkTo(x,y,{ms:Math.min(520,Math.max(260,Math.hypot(x-this._pos[0],y-this._pos[1])))})}
    home(){clearTimeout(this._homeT);this._perched=null;if(!this._float||!this._m)return Promise.resolve();this._m.unpoint();
      if(!this._anchor&&this._abs){const p=this._pos;if(p[1]>innerHeight||p[1]<-this._size()[1])this._setAbs(false)}
      const k=this._kbSpot&&this._kbSpot();
      if(k){if(this._abs)this._setAbs(false);return this.walkTo(k[0],k[1],{ms:360})}
      const d=this._dock();
      return this.walkTo(d[0],d[1]).then(()=>{if(this._m&&!this._walking){if(!this._anchor)this._setAbs(false);const e=this._dock();this._setPos(e[0],e[1]);this._docked=true}})}
    setState(s){this._m&&this._m.setState(s)} react(s,ms){this._m&&this._m.react(s,ms)} say(t,o){this._m&&this._m.say(t,o)}
    cover(on,peek){this._m&&this._m.cover(on,peek)} lookAt(x,y){this._m&&this._m.lookAt(x,y)} watch(input){this._m&&this._m.watch(input);return this}
    point(el,text){return this.goTo(el,{text})}
    // Walk people through a screen: [{target:'#plan', text:'Pick a plan'}, …]. Pip points at each, then heads home.
    async tour(steps,{done}={}){const id=this._tour=(this._tour||0)+1;this._touring=true;
      try{for(const s of steps||[]){if(id!==this._tour||!this._m||this._hiddenByUser)return;const el=typeof s.target==='string'?document.querySelector(s.target):s.target;if(!el)continue;
          await this.goTo(el,{mode:s.mode||'point',text:s.text,state:s.state,stay:true});if(id!==this._tour)return;
          await wait(s.ms||Math.max(2400,(s.text||'').length*55+1400))}
        if(id!==this._tour||!this._m)return;if(done){this._m.react('success',1800);this._m.say(done,{hold:1800});await wait(1600)}}
      finally{if(id===this._tour)this._touring=false}
      if(id===this._tour)return this.home()}
    stopTour(){this._tour=(this._tour||0)+1;this._touring=false;return this.home()}
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
    // Phones: when the on-screen keyboard is up, sit on top of it (one steady spot) and watch whichever field is being typed in
    const coarse=matchMedia('(pointer: coarse)').matches,VV=window.visualViewport;let kbT=0,onKb=false;
    if(coarse&&VV&&!host._anchor){
      const kbUp=()=>innerHeight-VV.height>120;
      const spot=()=>{const [w,h]=host._size(),left=host._place().h==='left';return [left?VV.offsetLeft+10:VV.offsetLeft+Math.min(VV.width,innerWidth)-w-10,VV.offsetTop+VV.height-h+6]};
      // Pointing at a problem (a missed field, an error) always wins; the keyboard spot waits until it's done
      const busy=()=>Date.now()-(host._goAt||0)<3800;
      host._kbSpot=()=>onKb&&kbUp()?spot():null;
      const follow=()=>{if(!onKb||host._walking||busy()||host._hiddenByUser)return;const p=spot();host._setPos(p[0],p[1])};
      const sitOnKb=()=>{if(!isField(document.activeElement)||!kbUp()||!host._m)return;
        if(onKb)return follow();onKb=true;if(busy())return;clearTimeout(host._homeT);if(host._abs)host._setAbs(false);
        const p=spot();host.walkTo(p[0],p[1],{ms:360}).then(follow)};
      const leave=()=>{if(!onKb)return;onKb=false;if(!busy())host.home()};
      on(document,'focusin',e=>{if(mine(e)||!isField(e.target))return;clearTimeout(kbT);kbT=setTimeout(sitOnKb,350)},true);
      on(document,'focusout',()=>{clearTimeout(kbT);kbT=setTimeout(()=>{if(!isField(document.activeElement))leave()},300)},true);
      const vvChange=()=>{if(onKb){if(!kbUp())leave();else follow()}else if(kbUp()&&isField(document.activeElement))sitOnKb()};
      on(VV,'resize',vvChange);on(VV,'scroll',vvChange)}

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
})(engine, {"name":"Pip","shape":"bean","color":"#FFC23D","accent":"#6BCB77","eyeColor":"#5A3A1E","topper":"sprout","eyes":"round","pattern":"none","accessory":"none","tooth":false,"hat":"","item":"","greeting":"Hi, I'm Pip!"}, paintedEngine, origin);
})();
