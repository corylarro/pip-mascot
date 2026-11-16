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
  let best={e:1e18,dx:0,dy:0};const R=12;
  for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){let e=0;for(const p of pts){const q=p+dy*S+dx;e+=Math.abs(A[p]-(B[q]===undefined?128:B[q]))}if(e<best.e)best={e,dx,dy}}
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
  sleeping:{blink:1,tilt:4,zzz:1},love:{happy:1},wave:{happy:.7},confused:{confused:1,tilt:7,q:1},giggle:{happy:1}};
class PaintRig{
  constructor(canvas,{bubble,onState,fit,sleepAfter}={}){
    this.fit=fit||0;this.sleepAfter=sleepAfter===undefined?20000:sleepAfter;this.cfg={name:'',greeting:'Hi there!'};this._ls=[];this.focusLook=0;
    this.cv=canvas;this.ctx=canvas.getContext('2d');this.bubble=bubble;this.onState=onState||(()=>{});
    this.base=null;this.patches={};this.face=null;
    this.s={happy:new Spring(0,520,44),worried:new Spring(0,520,44),surprised:new Spring(0,560,46),confused:new Spring(0,520,44),talk:new Spring(0,700,32),blinkHold:new Spring(0,200,22),
      lookX:new Spring(0,120,16),lookY:new Spring(0,120,16),tilt:new Spring(0,90,12),lean:new Spring(0,90,12),zzz:new Spring(0),q:new Spring(0)};
    for(const [k,v0] of Object.entries(FBASE))this.s['f_'+k]=new Spring(v0,170,20);
    this.squash=new Spring(1,320,13);this.state='idle';this.look=[0,0];this.timer=null;this.cover=false;
    this.jumpY=0;this.jumpV=0;this.shake=0;this.t=0;this.nextBlink=1.2;this.blinkStart=-1;this.parts=[];this.pokes=[];this.lastAct=performance.now();this.lastPointer=0;this.nextGlance=0;
    const on=(t,ev,fn,o)=>{t.addEventListener(ev,fn,o);this._ls.push([t,ev,fn,o])};
    this._resize();on(window,'resize',()=>this._resize());
    if(typeof ResizeObserver!=='undefined'){this._ro=new ResizeObserver(()=>this._resize());this._ro.observe(canvas)}
    on(window,'pointermove',e=>{this._act();this.lastPointer=performance.now();if(!this.focusEl&&!(this.focusLook>performance.now()))this.lookAt(e.clientX,e.clientY)},{passive:true});
    ['pointerdown','keydown'].forEach(ev=>on(window,ev,()=>this._act(),{passive:true}));
    on(canvas,'pointerdown',()=>this.poke());
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
  react(n,ms=2300){this._enter(n);clearTimeout(this.timer);this.timer=setTimeout(()=>this._enter('idle'),ms)}
  _enter(n){if(!STATES[n])return;if(n!==this.state)this.squash.v-=1.8;this.state=n;this.onState(n);
    if(n==='success'){this.hop(360);setTimeout(()=>this.hop(250),560);this.burst('confetti')}
    if(n==='error'){this.shake=10;this.squash.v-=3}
    if(n==='surprised'){this.hop(220);this.squash.v+=2}
    if(n==='love')this.burst('hearts');if(n==='wave')this.hop(140)}
  lookAt(x,y){const r=this.cv.getBoundingClientRect();if(!r.width)return;this.look=[clamp((x-(r.left+r.width/2))/(r.width*.7),-1,1),clamp((y-(r.top+r.height*.45))/(r.height*.8),-1,1)]}
  hop(v){if(this.jumpY>-1&&this.jumpV>=0&&!this._hopT){if(RM<1){this.jumpV=-v*Math.sqrt(RM);return}this.squash.v-=v*.0075;this._hopT=setTimeout(()=>{this._hopT=null;this.jumpV=-v},75)}}
  poke(){if(!this.base)return;const now=performance.now();this.pokes=this.pokes.filter(p=>now-p<4000);this.pokes.push(now);this.squash.v-=4;
    if(this.pokes.length>=5){this.pokes=[];this.react('confused',2400);this.say("Okay, okay! I'm awake!");return}
    const n=this.pokes.length;if(n===3){this.react('love',1800);this.say('Aww, thanks!');return}
    this.react(n===1?'surprised':'giggle',n===1?900:1400);this.say(n===1?'Boop!':pick(['Hee hee, that tickles!','Hey there!','Again? Okay!']))}
  say(text,{speed=40,hold=2400}={}){const tok=this.sayTok=(this.sayTok||0)+1,b=this.bubble;b.textContent='';b.classList.add('show');let i=0;
    const tick=()=>{if(tok!==this.sayTok)return;if(i>=text.length){this.s.talk.t=0;this.mouth=null;setTimeout(()=>{if(tok===this.sayTok)b.classList.remove('show')},hold);return}
      const ch=text[i++];b.textContent=text.slice(0,i);this.s.talk.t=/[aeiouy]/i.test(ch)?1:/\s/.test(ch)?0:/[.,!?]/.test(ch)?0:.45;
      this.mouth=/[ouw]/i.test(ch)?'o':/[eiy]/i.test(ch)?'e':/[a]/i.test(ch)?'a':/[bmp]/i.test(ch)?null:(/[a-z]/i.test(ch)&&this.mouth?this.mouth:null);setTimeout(tick,/[.,!?]/.test(ch)?speed*4:speed)};tick()}
  burst(kind){if(RM<1)return;const cols=['#FF6B7A','#6E9BFF','#7DDC8A','#FFC23D','#B58CFF'];
    for(let i=0;i<(kind==='hearts'?7:34);i++)this.parts.push(kind==='hearts'?{h:1,x:(Math.random()-.5)*80,y:-150,vx:(Math.random()-.5)*30,vy:-50-Math.random()*50,life:1.8,g:-15,c:'#FF4D6D',a:0,va:0}:
      {x:0,y:-120,vx:(Math.random()-.5)*480,vy:-260-Math.random()*320,life:1.7,g:900,c:cols[i%5],a:Math.random()*6,va:(Math.random()-.5)*14})}
  _tick(){const now=performance.now();
    if(this.state==='idle'&&!this.focusEl&&now-this.lastPointer>3500&&now>this.nextGlance){this.look=[(Math.random()-.5)*1.4,(Math.random()-.5)*.8];this.nextGlance=now+1800+Math.random()*2500}
    if(this.base&&this.sleepAfter&&this.state==='idle'&&!this.cover&&!this.focusEl&&now-this.lastAct>this.sleepAfter)this._enter('sleeping')}
  _frame(now){
    const dt=Math.min((now-this._last)/1000,.05);this._last=now;this.t+=dt;const t=this.t,S=STATES[this.state]||{};
    const P0=this.patches||{};for(const k of ['happy','worried','surprised','confused'])this.s[k].t=S[k]||0;
    if(this.state==='confused'&&!P0.confused)this.s.worried.t=.5;
    this.s.blinkHold.t=(S.blink||(this.cover?1:0));this.s.tilt.t=S.tilt||0;this.s.zzz.t=S.zzz||0;this.s.q.t=S.q||0;
    const lk=S.look||this.look;this.s.lookX.t=lk[0];this.s.lookY.t=lk[1];
    const FS=FSTATES[this.state]||{};for(const k in FBASE)this.s['f_'+k].t=(FS[k]!==undefined?FS[k]:FBASE[k]);
    if(this.cover&&this.state!=='sleeping'){this.s.f_open.t=.03;this.s.f_curve.t=.6}
    const v={};for(const k in this.s)v[k]=this.s[k].step(dt);const sq=this.squash.step(dt);
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
    const B=this.base.bbox,ground=this.fit?H*.97:H*.9,scale=this.fit?Math.min(W*this.fit/B.w,H*this.fit/B.h):Math.min(W*.66/B.w,H*.68/B.h),footX=B.x+B.w/2,footY=B.y+B.h;
    // shadow
    const lift=Math.min(-this.jumpY/260,1);const sg=ctx.createRadialGradient(W/2,ground,0,W/2,ground,B.w*scale*.5);sg.addColorStop(0,'rgba(25,25,60,.28)');sg.addColorStop(1,'rgba(25,25,60,0)');
    ctx.save();ctx.translate(W/2,ground);ctx.scale(1-lift*.4,.16);ctx.translate(-W/2,-ground);ctx.fillStyle=sg;ctx.beginPath();ctx.arc(W/2,ground,B.w*scale*.5,0,Math.PI*2);ctx.fill();ctx.restore();
    // body
    ctx.save();ctx.translate(W/2+shx,ground+this.jumpY+wb);ctx.rotate((v.tilt+giggle+v.lean+wr)*Math.PI/180);ctx.scale(sx*scale,sy*scale);ctx.translate(-footX,-footY);
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
  const A=alpha(base.canvas,0,0),B=alpha(full.canvas,full.off.dx,full.off.dy),bb=base.bbox,xl=(bb.x+bb.w*.15)*f,xr=(bb.x+bb.w*.85)*f,y0=(bb.y+bb.h*.15)*f,y1=(bb.y+bb.h*.85)*f;
  let L=0,R=0;for(let y=Math.floor(y0);y<y1;y++)for(let x=0;x<S;x++){const i=(y*S+x)*4+3;if(B[i]>128&&A[i]<60){if(x<xl)L++;else if(x>xr)R++}}
  if(L+R<12)return null;return L>R*1.5?'L':R>L*1.5?'R':null}
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
  const A=alpha(base.canvas,0,0),B=alpha(full.canvas,full.off.dx,full.off.dy),y0=Math.max(0,(base.bbox.y-base.bbox.h*.2)*f),y1=(face.y+face.h*1.3)*f,xl=face.x*f,xr=(face.x+face.w)*f;
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
async function mountMascot(rig,data){
  const k=keyOut(await loadImg(data.image));rig.cfg={name:data.name||'',greeting:data.greeting||`Hi${data.name?", I'm "+data.name:''}!`};
  if(data.mode==='simple'){rig.setBase(k);rig.setSimple(simpleInfo(data.face,k.canvas));return rig}
  const [c,r]=data.grid||[3,2],frames=splitSheet(k,c,r);rig.simple=null;rig.setBase(frames[0]);const face=refineFace(frames,data.face,SHEET_NAMES);rig.setFace(face);data.face=face;
  attachFrames(rig,frames,face);return rig}
const SHEET_NAMES=['neutral','blink','happy','talk','worried','surprised','confused','waveA','waveB','pointL','pointR','talkE'];
const FULL_FRAMES=['waveA','waveB','pointL','pointR'];
// Attach every frame of a split sheet to a rig (expressions as face patches, poses as full frames), with sanity checks.
function attachFrames(rig,frames,face){
  frames.forEach((fr,i)=>{const n=SHEET_NAMES[i];if(!n||n==='neutral')return;if(FULL_FRAMES.includes(n))rig.addFull(n,fr);else rig.addExpr(n,fr)});
  if(rig.full.waveA&&rig.full.waveB){const a=raisedSide(frames[0],rig.full.waveA,face.box),b=raisedSide(frames[0],rig.full.waveB,face.box);if(!a||!b||a!==b)delete rig.full.waveB}
  const pl=frames[9],pr=frames[10];
  if(pl||pr){const sl=rig.full.pointL&&reachSide(frames[0],rig.full.pointL),sr=rig.full.pointR&&reachSide(frames[0],rig.full.pointR);delete rig.full.pointL;delete rig.full.pointR;
    const byside={};if(sl)byside[sl]=pl;if(sr&&!byside[sr])byside[sr]=pr;
    if(byside.L&&!byside.R)byside.R=mirrorFrame(byside.L);if(byside.R&&!byside.L)byside.L=mirrorFrame(byside.R);
    if(byside.L)rig.addFull('pointL',byside.L);if(byside.R)rig.addFull('pointR',byside.R)}}
return {attachFrames,refineFace,mountMascot,PaintRig,keyOut,splitSheet,alignFrames,raisedSide,faceFrom,simpleInfo,loadImg,canvasOf,b64ToDataUrl,canvasB64,SHEET_NAMES,Spring};
}
