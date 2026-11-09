/* Production copy of the supplied PeepShow SVG animation. No dependencies. */
/* Peepshow terminal-slime deformation. Original geometry stays at rest exactly.
 * No dependencies. Browser: window.PeepshowSlime.create(components).
 * Node: const {create} = require('./deformation.js').
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PeepshowSlime = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = v => { const x = clamp(v, 0, 1); return x*x*(3-2*x); };
  const mix = (a,b,t) => a+(b-a)*t;
  const midpoint = (a,b) => [(a[0]+b[0])/2,(a[1]+b[1])/2];
  const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
  const copy = p => [p[0],p[1]];
  const format = n => { const v = Math.round(n*1000)/1000; return String(Object.is(v,-0) ? 0 : v); };
  const xy = p => format(p[0])+' '+format(p[1]);

  const DEFAULT_SPECS = {
    P: {anchorY:565, bottomY:711.573, centerX:243, pinchT:0.44, pinchRadius:0.26, maskX:null},
    p: {anchorY:500, bottomY:700.277, centerX:781, pinchT:0.51, pinchRadius:0.27, maskX:null},
    h: {anchorY:550, bottomY:688.773, centerX:1248, pinchT:0.42, pinchRadius:0.27, maskX:[1195,1208], relaxedMaskX:[1180,1194]},
    w: {anchorY:560, bottomY:669.860, centerX:1624, pinchT:0.42, pinchRadius:0.27, maskX:[1572,1586]}
  };

  function parseOuter(path) {
    // The source trace contains only absolute M/C/Z. Keep every later subpath
    // verbatim, so counters never change even when callers change a spec.
    const end = path.search(/[zZ]/);
    if (end < 0) throw new Error('A closed outer path is required.');
    const outer = path.slice(0,end+1);
    const suffix = path.slice(end+1);
    const tokens = outer.match(/[MCZ]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g);
    let i=0, start=null, current=null;
    const curves=[];
    while(i<tokens.length) {
      const op=tokens[i++];
      if(op==='M') {
        current=[Number(tokens[i++]),Number(tokens[i++])];
        start=copy(current);
      } else if(op==='C') {
        const b=[Number(tokens[i++]),Number(tokens[i++])];
        const c=[Number(tokens[i++]),Number(tokens[i++])];
        const d=[Number(tokens[i++]),Number(tokens[i++])];
        if(!current) throw new Error('C precedes M.');
        curves.push([copy(current),b,c,d]); current=d;
      } else if(op==='Z') {
        if(distance(current,start)>0.001) {
          curves.push([copy(current),[mix(current[0],start[0],1/3),mix(current[1],start[1],1/3)],[mix(current[0],start[0],2/3),mix(current[1],start[1],2/3)],copy(start)]);
        }
      } else { throw new Error('Unsupported path command '+op); }
    }
    return {start,curves,suffix};
  }

  function splitCurve(c) {
    const ab=midpoint(c[0],c[1]),bc=midpoint(c[1],c[2]),cd=midpoint(c[2],c[3]);
    const abc=midpoint(ab,bc),bcd=midpoint(bc,cd),m=midpoint(abc,bcd);
    return [[c[0],ab,abc,m],[m,bcd,cd,c[3]]];
  }
  function refine(c, out, maxLength, depth) {
    const length=distance(c[0],c[1])+distance(c[1],c[2])+distance(c[2],c[3]);
    if(length<=maxLength || depth>=10) {out.push(c);return;}
    const pair=splitCurve(c);
    refine(pair[0],out,maxLength,depth+1);refine(pair[1],out,maxLength,depth+1);
  }
  function at(c,t) {
    const s=1-t, a=s*s*s,b=3*s*s*t,d=t*t*t,k=3*s*t*t;
    return [a*c[0][0]+b*c[1][0]+k*c[2][0]+d*c[3][0],a*c[0][1]+b*c[1][1]+k*c[2][1]+d*c[3][1]];
  }
  function intersections(points,y) {
    const xs=[];
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i];
      if((a[1]<=y && b[1]>y)||(b[1]<=y && a[1]>y)) xs.push(mix(a[0],b[0],(y-a[1])/(b[1]-a[1])));
    }
    return xs.sort((a,b)=>a-b);
  }
  function intervalAt(points,y,spec) {
    const xs=intersections(points,y), intervals=[];
    for(let i=0;i+1<xs.length;i+=2) intervals.push([xs[i],xs[i+1]]);
    const eligible=intervals.filter(pair=>!spec.maskX || pair[1]>spec.maskX[1]);
    if(!eligible.length) return null;
    eligible.sort((a,b)=>Math.abs((a[0]+a[1])/2-spec.centerX)-Math.abs((b[0]+b[1])/2-spec.centerX));
    return eligible[0];
  }

  function splitAt(c,t) {
    const lerp=(a,b)=>[mix(a[0],b[0],t),mix(a[1],b[1],t)];
    const ab=lerp(c[0],c[1]),bc=lerp(c[1],c[2]),cd=lerp(c[2],c[3]);
    const abc=lerp(ab,bc),bcd=lerp(bc,cd),m=lerp(abc,bcd);
    return [[c[0],ab,abc,m],[m,bcd,cd,c[3]]];
  }
  function yRoots(c,y) {
    const a=-c[0][1]+3*c[1][1]-3*c[2][1]+c[3][1];
    const b=3*c[0][1]-6*c[1][1]+3*c[2][1],d=3*(c[1][1]-c[0][1]);
    const stops=[0,1],aa=3*a,bb=2*b,cc=d;
    if(Math.abs(aa)<1e-10) {
      if(Math.abs(bb)>1e-10) {const z=-cc/bb;if(z>0&&z<1)stops.push(z);}
    } else {
      const disc=bb*bb-4*aa*cc;
      if(disc>=0) for(const z of [(-bb+Math.sqrt(disc))/(2*aa),(-bb-Math.sqrt(disc))/(2*aa)]) if(z>0&&z<1)stops.push(z);
    }
    stops.sort((a,b)=>a-b);const roots=[];
    for(let k=1;k<stops.length;k++) {
      let lo=stops[k-1],hi=stops[k],flo=at(c,lo)[1]-y,fhi=at(c,hi)[1]-y;
      if(Math.abs(flo)<1e-8 && lo>1e-8 && lo<1-1e-8) roots.push(lo);
      if(flo*fhi<0) {
        for(let n=0;n<44;n++) {const mid=(lo+hi)/2,fm=at(c,mid)[1]-y;if(flo*fm<=0){hi=mid;fhi=fm;}else{lo=mid;flo=fm;}}
        const r=(lo+hi)/2;if(r>1e-8&&r<1-1e-8)roots.push(r);
      }
    }
    return roots.sort((a,b)=>a-b).filter((r,i,a)=>i===0||Math.abs(r-a[i-1])>1e-7);
  }
  function splitBulb(curves,sourceCutY,spec) {
    const pieces=[];
    for(const c of curves) {
      let remaining=c,last=0;
      for(const t of yRoots(c,sourceCutY)) {
        const pair=splitAt(remaining,(t-last)/(1-last));pieces.push(pair[0]);remaining=pair[1];last=t;
      }
      pieces.push(remaining);
    }
    const runs=[];let run=[];
    for(let i=0;i<pieces.length;i++) {
      const mid=at(pieces[i],0.5);
      const take=mid[1]>sourceCutY+1e-6 && (!spec.maskX||mid[0]>spec.maskX[1]);
      if(take)run.push(i);else if(run.length){runs.push(run);run=[];}
    }
    if(run.length)runs.push(run);
    if(!runs.length)throw new Error('Could not isolate terminal bulb.');
    runs.sort((a,b)=>{
      const center=idx=>idx.reduce((sum,i)=>sum+at(pieces[i],0.5)[0],0)/idx.length;
      return Math.abs(center(a)-spec.centerX)-Math.abs(center(b)-spec.centerX);
    });
    return {pieces,indices:runs[0],indexSet:new Set(runs[0])};
  }
  function serialize(curves,map,suffix) {
    if(!curves.length)return '';
    let d='M'+xy(map(curves[0][0]));
    for(const c of curves)d+='C'+xy(map(c[1]))+' '+xy(map(c[2]))+' '+xy(map(c[3]));
    return d+'Z'+(suffix||'');
  }

  function normalize(params,spec) {
    const p=params||{};
    const val=(key,fallback)=>Number.isFinite(Number(p[key]))?Number(p[key]):fallback;
    const extension=clamp(val('extension',0),0,170);
    const shorten=clamp(val('shorten',0),0,170);
    const span=spec.bottomY-spec.anchorY;
    return {extension,pinch:clamp(val('pinch',0),0,1),bulbScale:clamp(val('bulbScale',1),0.7,1.55),sway:clamp(val('sway',0),-28,28),shorten,tipRelax:clamp(val('tipRelax',0),0,1),netExtension:Math.max(extension-shorten,-0.5*span)};
  }
  function mapper(spec,p) {
    const span=spec.bottomY-spec.anchorY;
    return function map(point) {
      const x=point[0],y=point[1];
      const lowerMask=spec.relaxedMaskX&&p.tipRelax>0?spec.relaxedMaskX:spec.maskX;
      if(y<=spec.anchorY || (lowerMask && x<=lowerMask[0])) return [x,y];
      const u=clamp((y-spec.anchorY)/span,0,1);
      let gate=spec.maskX?smooth((x-spec.maskX[0])/(spec.maskX[1]-spec.maskX[0])):1;
      // Relax the h's entire right stem during recoil. A partial influence on
      // its left edge folds the contour into a sharp hook as it shortens.
      if(spec.relaxedMaskX&&p.tipRelax>0){
        const mask=spec.relaxedMaskX;
        gate=mix(gate,smooth((x-mask[0])/(mask[1]-mask[0])),p.tipRelax);
      }
      const travel=smooth(u);
      const v=(u-spec.pinchT)/spec.pinchRadius;
      // A compact C2 bell pinches the neck without disturbing its attachment.
      const neck=Math.abs(v)<1?Math.pow(1-v*v,3):0;
      const bulb=smooth((u-(spec.pinchT+0.08))/(1-(spec.pinchT+0.08)));
      const width=1-0.94*p.pinch*neck+(p.bulbScale-1)*bulb;
      return [x+gate*((x-spec.centerX)*(width-1)+p.sway*travel),y+gate*p.netExtension*travel];
    };
  }

  function create(components,options) {
    const records=Array.isArray(components)?components:components.components;
    if(!Array.isArray(records)) throw new Error('Pass the components array or logo JSON.');
    const opt=options||{}, maxSegmentLength=opt.maxSegmentLength||9;
    const specs=JSON.parse(JSON.stringify(DEFAULT_SPECS));
    if(opt.specs) Object.keys(opt.specs).forEach(id=>{specs[id]=Object.assign({},specs[id]||{},opt.specs[id]);});
    const cache={};
    records.forEach(component=>{
      const id=component.id,path=component.path;
      if(!specs[id]) {cache[id]={id,path};return;}
      const parsed=parseOuter(path),curves=[];
      parsed.curves.forEach(c=>refine(c,curves,maxSegmentLength,0));
      const samples=[copy(curves[0][0])];
      curves.forEach(c=>{samples.push(at(c,0.25),at(c,0.5),at(c,0.75),copy(c[3]));});
      const spec=specs[id];
      const sourceCutY=mix(spec.anchorY,spec.bottomY,spec.pinchT);
      const neckInterval=intervalAt(samples,sourceCutY,spec);
      const terminal=samples.filter(p=>p[1]>=spec.anchorY && (!spec.maskX || p[0]>=spec.maskX[1]));
      const lowest=terminal.reduce((a,b)=>b[1]>a[1]?b:a,terminal[0]);
      const split=splitBulb(curves,sourceCutY,spec);
      // The h's bulb briefly extends left of its original deformation mask.
      // Cut its complete contour during recoil instead of retaining a sliver.
      // Keep the original split for the approved detached-drop silhouette.
      const recoilSplit=spec.relaxedMaskX?splitBulb(curves,sourceCutY,{...spec,maskX:spec.relaxedMaskX}):null;
      cache[id]={id,path,parsed,curves,samples,spec,sourceCutY,neckInterval,lowest,split,recoilSplit};
    });
    function record(id) {
      const r=cache[typeof id==='string'?id:id.id];
      if(!r) throw new Error('Unknown component '+id);
      return r;
    }
    function deformPath(id,params) {
      const r=record(id);
      if(!r.spec) return r.path;
      const p=normalize(params,r.spec);
      if(p.netExtension===0 && p.pinch===0 && p.bulbScale===1 && p.sway===0) return r.path;
      const map=mapper(r.spec,p);
      let path='M'+xy(map(r.split.pieces[0][0]));
      for(const c of r.split.pieces) path+='C'+xy(map(c[1]))+' '+xy(map(c[2]))+' '+xy(map(c[3]));
      return path+'Z'+r.parsed.suffix;
    }
    function frame(id,params) {
      const r=record(id);
      if(!r.spec) return {path:r.path,tip:null,cutY:null,cutX:null,neckWidth:null,dropWidth:null,dropHeight:null,dropBounds:null,effectiveParameters:null};
      const p=normalize(params,r.spec),map=mapper(r.spec,p);
      const cut=map([r.spec.centerX,r.sourceCutY]);
      const tip=map(r.lowest);
      const bulb=r.samples.filter(q=>q[1]>=r.sourceCutY && (!r.spec.maskX || q[0]>=r.spec.maskX[1])).map(map);
      bulb.push(cut);
      const minX=Math.min(...bulb.map(q=>q[0])),maxX=Math.max(...bulb.map(q=>q[0]));
      const neck=r.neckInterval?r.neckInterval.map(x=>map([x,r.sourceCutY])[0]):[cut[0],cut[0]];
      const split=p.tipRelax>0&&r.recoilSplit?r.recoilSplit:r.split;
      const bulbCurves=split.indices.map(i=>split.pieces[i]);
      const bodyCurves=[];
      for(let i=0;i<split.pieces.length;i++) {
        if(i===split.indices[0]) {
          const a=split.pieces[split.indices[0]][0],b=split.pieces[split.indices[split.indices.length-1]][3];
          bodyCurves.push([a,[mix(a[0],b[0],1/3),mix(a[1],b[1],1/3)],[mix(a[0],b[0],2/3),mix(a[1],b[1],2/3)],b]);
        }
        if(!split.indexSet.has(i))bodyCurves.push(split.pieces[i]);
      }
      return {path:deformPath(id,p),bodyPath:serialize(bodyCurves,map,r.parsed.suffix),bulbPath:serialize(bulbCurves,map,''),tip,cx:cut[0],cutY:cut[1],cutX:cut[0],bottomY:tip[1],bulbCenterY:(cut[1]+tip[1])/2,tipWidth:maxX-minX,bulbCenter:[(minX+maxX)/2,(cut[1]+tip[1])/2],neckWidth:Math.abs(neck[1]-neck[0]),dropWidth:maxX-minX,dropHeight:tip[1]-cut[1],dropBounds:[minX,cut[1],maxX-minX,tip[1]-cut[1]],sourceCutY:r.sourceCutY,effectiveParameters:p};
    }
    return {deformPath,frame,geometry:frame,restPath:id=>record(id).path,specs,ids:Object.keys(cache),diagnostics:id=>{
      const r=record(id);return {id:r.id,curves:r.curves?r.curves.length:0,samples:r.samples?r.samples.length:0,sourceCutY:r.sourceCutY||null,neckInterval:r.neckInterval||null,lowest:r.lowest||null};
    }};
  }
  return {create,DEFAULT_SPECS};
});

(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PeepshowCartoon=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
  const mix=(a,b,x)=>a+(b-a)*x;
  const f=n=>String(Math.round(n*1000)/1000);
  function create(data,deformation,settings={}){
    const input=settings&&typeof settings==='object'?settings:{};
    const number=(key,fallback,min,max)=>{
      const value=input[key]==null?fallback:Number(input[key]);
      return clamp(Number.isFinite(value)?value:fallback,min,max);
    };
    settings=Object.freeze({
      fallTime:number('fallTime',.42,.2,2.4),
      fallDistance:number('fallDistance',1,.4,3),
      releaseTime:number('releaseTime',1.3,.6,3)
    });
    const slime=deformation.create(data.components);
    const E=data.eye;
    const [ecx,ecy]=E.center;
    const rx=(E.bounds[2]-E.pupilBounds[2])/2-14;
    const ry=(E.bounds[3]-E.pupilBounds[3])/2-14;
    const baseFloor=1035, fps=12, releaseTime=settings.releaseTime;
    const startGap=releaseTime+.3;
    const originalTrajectory=settings.fallTime===.42&&settings.fallDistance===1;
    const schedule=[
      {id:'P',start:0,extension:140,sway:-5,drift:-18},
      {id:'p',start:1.6,extension:133,sway:4,drift:13},
      {id:'h',start:3.2,extension:137,sway:-4,drift:-12},
      {id:'w',start:4.8,extension:140,sway:6,drift:18}
    ];
    for(let i=0;i<schedule.length;i++){
      const s=schedule[i];
      // Keep the original literal start times at the default setting.
      if(releaseTime!==1.3)s.start=i*startGap;
      s.release=slime.frame(s.id,{extension:s.extension,pinch:.99,bulbScale:1.24,sway:s.sway});
      s.baseDistance=baseFloor-s.release.bottomY;
      s.baseFallTime=(Math.sqrt(85*85+2*1850*s.baseDistance)-85)/1850;
      s.fallTime=s.baseFallTime*(settings.fallTime/.42);
    }
    const maximumReleasedBottom=Math.max(...schedule.map(s=>s.release.bottomY));
    const floor=settings.fallDistance===1?baseFloor:maximumReleasedBottom+(baseFloor-maximumReleasedBottom)*settings.fallDistance;
    const height=Math.max(1080,floor+45);
    for(const s of schedule){
      s.fallDistance=floor-s.release.bottomY;
      const initial=85*s.baseFallTime,accelerated=.5*1850*s.baseFallTime*s.baseFallTime;
      s.linearFraction=initial/(initial+accelerated);
      // The default takes the original arithmetic path so existing frames match.
      s.velocity=originalTrajectory?85:s.fallDistance*s.linearFraction/s.fallTime;
      s.gravity=originalTrajectory?1850:2*s.fallDistance*(1-s.linearFraction)/(s.fallTime*s.fallTime);
      s.impactTime=s.start+releaseTime+s.fallTime;
    }
    const lastStart=schedule[schedule.length-1].start;
    const maximumFallTime=Math.max(...schedule.map(s=>s.fallTime));
    const period=Math.max(lastStart+releaseTime+2,lastStart+releaseTime+maximumFallTime+1.1)+.9;
    const gazeHomeTime=period-1.8,bigBlinkTime=period-1.05;
    function fallOffset(s,elapsed){
      const a=clamp(elapsed,0,s.fallTime);
      if(a===s.fallTime)return s.fallDistance;
      if(originalTrajectory)return s.velocity*a+.5*s.gravity*a*a;
      const p=a/s.fallTime;
      return s.fallDistance*(s.linearFraction*p+(1-s.linearFraction)*p*p);
    }
    function gazeLimit(x,y){const n=Math.hypot(x/rx,y/ry);return n>1?[x/n,y/n]:[x,y];}
    function pointing(x,y){const a=(x-ecx)/400,b=(y-ecy)/400,n=Math.max(1,Math.hypot(a,b));return gazeLimit(a/n*rx,b/n*ry);}
    function phase(s,t){
      const u=t-s.start;
      const rest={extension:0,shorten:0,pinch:0,bulbScale:1,sway:0};
      if(u<0||u>=releaseTime+2)return {u,mode:'rest',parameters:rest,grow:1};
      if(u<.3){
        const a=ease(u/.3);
        return {u,mode:'attached',parameters:{...rest,shorten:14*a,bulbScale:1+.24*a,sway:-s.sway*.35*a},grow:1};
      }
      if(u<releaseTime){
        const a=clamp((u-.3)/(releaseTime-.3));
        const stretch=Math.pow(a,1.55);
        return {u,mode:'attached',parameters:{extension:s.extension*stretch,shorten:14*(1-ease(a*4)),pinch:.99*ease(releaseTime===1.3?(u-.82)/.48:(a-.52)/.48),bulbScale:1.24,sway:s.sway*ease(a)},grow:1};
      }
      const v=u-releaseTime;
      const tipRelax=s.id==='h'?ease(v/.12):0;
      if(v<.25){
        const a=ease(v/.25);
        return {u,mode:'split',parameters:{extension:s.extension*(1-a),shorten:70*a,pinch:mix(.99,.74,a),bulbScale:mix(1.24,.85,a),sway:s.sway*(1-a),tipRelax},grow:0};
      }
      const a=clamp((v-.25)/1.75);
      const recoil=10*Math.sin(clamp((v-.25)/.42)*Math.PI)*Math.exp(-4*a);
      return {u,mode:'regrow',parameters:{extension:0,shorten:Math.max(0,70*(1-ease(a))+recoil),pinch:.74*(1-ease(a)),bulbScale:mix(.85,1,ease(a)),sway:0,tipRelax},grow:ease(a)};
    }
    function dropState(s,t){
      const a=t-s.start-releaseTime;
      if(a<0||a>s.fallTime+1.1)return null;
      if(a<s.fallTime){
        const p=a/s.fallTime;
        const rounding=Math.sin(Math.PI*p);
        const sx=1+.12*rounding,sy=1-.24*rounding;
        const dy=fallOffset(s,a);
        const dx=s.drift*p*p;
        return {kind:'fall',a,dx,dy,sx,sy,cx:s.release.bulbCenter[0]+dx,cy:s.release.bulbCenter[1]+dy};
      }
      return {kind:'splat',age:a-s.fallTime,cx:s.release.bulbCenter[0]+s.drift,cy:floor};
    }
    function rawGaze(t,states){
      if(!states)states=schedule.map(s=>({schedule:s,phase:phase(s,t),geometry:slime.frame(s.id,phase(s,t).parameters),drop:dropState(s,t)}));
      let target=[-12,37];
      const falling=states.find(s=>s.drop&&s.drop.kind==='fall');
      if(falling)target=pointing(falling.drop.cx,falling.drop.cy);
      else {
        const current=states.filter(s=>s.phase.u>=0&&s.phase.u<releaseTime).pop();
        if(current)target=pointing(current.geometry.cutX,current.geometry.bottomY);
      }
      if(t<.3){const a=ease(t/.3);target=[mix(-12,target[0],a),mix(37,target[1],a)];}
      if(t>gazeHomeTime){const a=ease((t-gazeHomeTime)/.55);target=[mix(target[0],-12,a),mix(target[1],37,a)];}
      return gazeLimit(...target);
    }
    const gazeChanges=schedule.flatMap(s=>[s.start,s.start+releaseTime,s.start+releaseTime+s.fallTime]).filter(t=>t>0).sort((a,b)=>a-b);
    function autoGaze(t,states){
      const target=rawGaze(t,states);
      const change=gazeChanges.filter(c=>c<=t&&t<c+.18).pop();
      if(change===undefined)return target;
      const before=rawGaze(change-.0001),a=ease((t-change)/.18);
      return gazeLimit(mix(before[0],target[0],a),mix(before[1],target[1],a));
    }
    function openness(elapsed,close,hold,open){
      if(elapsed<0||elapsed>=close+hold+open)return 1;
      if(elapsed<close)return 1-ease(elapsed/close);
      if(elapsed<close+hold)return 0;
      return ease((elapsed-close-hold)/open);
    }
    function frames(t,options={}){
      t=((t%period)+period)%period;
      const states=schedule.map(s=>{
        const ph=options.reduced?{u:-1,mode:'rest',parameters:{},grow:1}:phase(s,t);
        return {schedule:s,phase:ph,geometry:slime.frame(s.id,ph.parameters),drop:options.reduced?null:dropState(s,t)};
      });
      const gaze=options.gaze?gazeLimit(...options.gaze):(options.reduced?[-12,37]:autoGaze(t,states));
      let open=options.reduced?1:Math.min(openness(t-2.0,.08,.08,.2),openness(t-bigBlinkTime,.14,.22,.32));
      if(options.pokeElapsed!==undefined)open=openness(options.pokeElapsed,.12,.42,.34);
      if(options.openness!==undefined)open=clamp(options.openness);
      return {t,states,gaze,open};
    }
    function splat(s,d){
      const a=d.age,life=1.1;
      if(a<0||a>=life)return '';
      const spread=1-Math.pow(1-clamp(a/.18),3);
      const drain=1-ease((a-.47)/.63);
      const r=s.release.dropWidth/2;
      const w=mix(r*.85,r*2.6,spread)*drain;
      const h=mix(26,10,spread)*drain;
      const x=d.cx,y=floor;
      let out=`<path fill="#fff" d="M${f(x-w)} ${f(y)} C${f(x-w*1.12)} ${f(y-h*.6)} ${f(x-w*.64)} ${f(y-h*.85)} ${f(x-w*.4)} ${f(y-h*.65)} C${f(x-w*.1)} ${f(y-h*1.65)} ${f(x+w*.25)} ${f(y-h*1.2)} ${f(x+w*.4)} ${f(y-h*.65)} C${f(x+w*.88)} ${f(y-h)} ${f(x+w*1.12)} ${f(y-h*.2)} ${f(x+w)} ${f(y)} C${f(x+w*.55)} ${f(y+h*.5)} ${f(x-w*.7)} ${f(y+h*.5)} ${f(x-w)} ${f(y)}Z"/>`;
      for(let i=0;i<3;i++){
        const b=a-i*.025;
        if(b<0||b>.42)continue;
        const direction=i===1?1:-1;
        const vx=direction*(170+i*45),vy=-(245+i*35);
        const bx=x+vx*b,by=y+vy*b+700*b*b;
        const size=(10-i*1.5)*(1-ease((b-.24)/.18));
        out+=`<ellipse fill="#fff" cx="${f(bx)}" cy="${f(by)}" rx="${f(size*.85)}" ry="${f(size*1.22)}" transform="rotate(${direction*25} ${f(bx)} ${f(by)})"/>`;
      }
      return out;
    }
    function svg(t,options={}){
      const F=frames(t,options),byId=Object.fromEntries(F.states.map(s=>[s.schedule.id,s]));
      const [ex,ey,ew,eh]=E.bounds;
      const eyeHeight=(eh+4)*F.open;
      let markup=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1800 ${f(height)}" width="1800" height="${f(height)}" role="img" aria-labelledby="slime-title"><title id="slime-title">Peepshow cartoon slime animation</title><defs><clipPath id="slime-eye-outer" clipPathUnits="userSpaceOnUse"><path d="${E.outerPath}"/></clipPath><clipPath id="slime-eyelids" clipPathUnits="userSpaceOnUse"><rect x="${f(ex-2)}" y="${f(ecy-eyeHeight/2)}" width="${f(ew+4)}" height="${f(eyeHeight)}"/></clipPath></defs>`;
      if(options.background!==false)markup+=`<rect width="1800" height="${f(height)}" fill="#000"/>`;
      markup+='<g fill="#fff" fill-rule="evenodd">';
      for(const c of data.components){
        if(c.id==='drop'){if(options.reduced)markup+=`<path d="${c.path}"/>`;continue;}
        const state=byId[c.id];
        if(!state||state.phase.mode==='rest'||state.phase.mode==='attached'){
          markup+=`<path data-letter="${c.id}" d="${state?state.geometry.path:c.path}"/>`;
        }else{
          const g=state.geometry,grow=state.phase.grow;
          markup+=`<path data-letter="${c.id}" d="${g.bodyPath}"/>`;
          const rad=Math.max(.7,g.neckWidth/2);
          markup+=`<ellipse cx="${f(g.cutX)}" cy="${f(g.cutY)}" rx="${f(rad)}" ry="${f(Math.min(5,rad*.35))}"/>`;
          if(grow>0)markup+=`<path d="${g.bulbPath}" transform="translate(${f(g.cutX)} ${f(g.cutY)}) scale(${f(Math.sqrt(grow))} ${f(grow)}) translate(${f(-g.cutX)} ${f(-g.cutY)})"/>`;
        }
      }
      markup+='</g>';
      for(const state of F.states){
        const s=state.schedule,d=state.drop;
        if(!d)continue;
        if(d.kind==='fall'){
          const [cx,cy]=s.release.bulbCenter;
          markup+=`<path data-falling="${s.id}" fill="#fff" d="${s.release.bulbPath}" transform="translate(${f(d.dx)} ${f(d.dy)}) translate(${f(cx)} ${f(cy)}) scale(${f(d.sx)} ${f(d.sy)}) translate(${f(-cx)} ${f(-cy)})"/>`;
        }else markup+=splat(s,d);
      }
      const dx=ecx+F.gaze[0]-E.pupilCenter[0],dy=ecy+F.gaze[1]-E.pupilCenter[1];
      markup+=`<g data-eye="true"><g clip-path="url(#slime-eye-outer)"><g clip-path="url(#slime-eyelids)"><path fill="#fff" d="${E.outerPath}"/><g transform="translate(${f(dx)} ${f(dy)})"><path fill="#000" d="${E.pupilPath}"/><path fill="#fff" d="${E.highlightPath}"/></g></g></g><path fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="${f(Math.max(0,1-F.open/.16))}" d="M${f(ex+24)} ${f(ecy+4)} Q${f(ecx)} ${f(ecy+23)} ${f(ex+ew-24)} ${f(ecy+4)}"/><ellipse fill="#fff" fill-opacity="0" pointer-events="all" cx="${f(ecx)}" cy="${f(ecy)}" rx="${f(ew/2)}" ry="${f(eh/2)}"/></g></svg>`;
      return markup;
    }
    return {svg,frame:frames,settings,period,fps,width:1800,height,floor,schedule,slime,gazeLimit,pointing,openness,fallOffset};
  }
  return {create};
});

// Production hero adapter. Artwork and default choreography above come from
// to_integrate/peepshow-logo-animation.html; the tuning demo stays in staging.
(() => {
  'use strict';
  const root = document.getElementById('peepshowLogo');
  if (!root) return;
  const art = root.querySelector('.hero-animation-art');
  const toggle = root.querySelector('.hero-animation-toggle');
  const eye = root.querySelector('.hero-animation-eye');
  const data={"canvas":{"width":1800,"height":837},"components":[{"id":"P","path":"M386 45.87C406.81 45.32 427.93 47.56 447.57 54.7C463.94 60.64 479.28 69.97 491.57 82.12C518.43 108.68 530.72 148.73 529.22 186.64C527.74 224.2 512.72 259.68 490.85 290.59C471.72 317.66 447.34 341.23 422.29 363.56C409.42 375.03 396.38 386.18 382.53 395.9C368.59 405.7 353.84 414.05 340.44 424.87C333.77 430.25 327.44 436.25 322.7 443.33C317.47 451.15 314.19 460.29 313.68 469.57C313.09 480.22 316.14 491.05 317.94 501.68C319.69 511.99 320.27 522.12 317.84 532.3C315.79 540.9 311.59 549.54 304.46 554.51C297.21 559.57 286.94 560.82 280.55 566.3C273.69 572.19 271.33 582.95 271.34 592.71C271.36 602.78 273.9 611.79 276.24 621.37C281.18 641.59 285.23 664.36 276.58 683.83C269.1 700.67 252.12 715.03 235.4 710.84C227.38 708.83 219.43 702.54 214.13 695.12C208.33 686.99 205.72 677.49 204.85 668.13C202.97 648.05 209.08 628.65 213.8 608.23C216.29 597.51 218.39 586.51 213.96 576.76C212.16 572.79 209.28 569.03 205.48 567.26C201.09 565.21 195.48 565.81 190.44 564.92C181.59 563.35 174.51 557.16 169.87 549.67C164.93 541.69 162.75 532.23 161.52 522.76C158.64 500.64 160.94 478.46 162.73 456.2C164.54 433.68 165.82 411.07 166.57 388.72C166.95 377.47 167.18 366.29 166.07 354.53C165.13 344.57 163.23 334.2 156.67 329.02C149.92 323.68 138.23 323.85 128.83 320.41C120.82 317.49 114.47 311.95 109.37 305.49C97.18 290.04 92.13 269.33 92.95 249.49C93.75 230.23 100.08 211.79 109.54 195.05C125.94 166.01 151.77 142.11 179.27 122.51C208.19 101.89 238.96 86.02 271.31 72.93C307.82 58.16 346.34 46.93 386 45.87ZM333.58 227.42C321.83 228.63 311.79 234.54 302.88 242.47C298.78 246.13 294.91 250.22 292.45 254.9C289.49 260.55 288.56 267.06 287.79 273.53C286.07 287.98 285.14 302.25 286.24 317.41C286.49 320.99 286.86 324.63 288.26 327.91C289.34 330.46 291.04 332.79 293.02 334.11C297.56 337.13 303.58 334.79 309.14 331.86C329.18 321.3 343.31 303.09 353.21 283.35C359.09 271.61 363.48 259.33 360.45 246.3C359.14 240.62 356.41 234.79 352.05 231.38C347.11 227.51 340.08 226.74 333.58 227.42Z","bounds":[92.869,45.79,436.475,665.783],"center":[311.106,378.681]},{"id":"e1","path":"M506.48 312.34C524.06 311.4 540.49 324.52 548.71 340.6C558.2 359.17 556.77 381.69 550.07 401.6C538.95 434.6 513.36 460.43 481.96 476.54C477.87 478.64 473.68 480.58 470.9 483.87C467.91 487.4 466.54 492.48 468.51 496.02C470.53 499.66 476.06 501.67 481.18 501.38C486.1 501.1 490.63 498.71 494.57 496.1C498.2 493.69 501.34 491.1 505.35 489.07C510.09 486.68 516.05 485.07 521.03 485.81C529.78 487.11 535.47 495.65 538.13 504.4C543.8 523.15 535.52 542.86 524.32 559.25C514.75 573.24 503.05 584.81 488.71 593.42C471.3 603.87 450 609.96 430.59 606.01C413.6 602.57 398.05 591.44 387.21 577.48C375.73 562.7 369.52 544.73 366.43 526.22C362.9 505.04 363.45 483.14 368.59 462.49C373.07 444.47 381.03 427.42 390.43 411.67C392.61 408.02 394.87 404.44 397.8 401.28C400.61 398.25 404.04 395.62 407.37 392.96C414.13 387.56 420.49 382.03 426.83 376.31C439.35 365.03 451.82 352.97 463.02 340.45C468.66 334.16 473.97 327.74 480.79 322.59C488.25 316.94 497.51 312.81 506.48 312.34ZM482.71 390.35C478.38 390.45 473.98 393.97 470.6 397.4C467.28 400.77 464.95 404.05 462.75 408.22C460.25 412.98 457.94 418.9 458.97 423.77C459.43 425.92 460.55 427.87 462.2 429.08C463.97 430.37 466.34 430.81 468.69 430.42C472.97 429.72 477.16 426.31 480.68 423.03C484.17 419.78 487 416.67 489.35 412.67C492.08 408.04 494.15 402.22 492.57 397.55C491.18 393.46 486.97 390.25 482.71 390.35Z","bounds":[364.178,312.29,191.285,294.933],"center":[459.821,459.756]},{"id":"e2","path":"M635.92 250.59C646.42 249.53 657.71 251.46 667.01 256.57C674.89 260.91 681.34 267.53 686.56 274.89C698.44 291.58 704.05 312.01 705.11 332.65C707.17 372.83 691.98 413.77 659.69 438.83C652.3 444.57 644.01 449.47 637.15 455.18C635.36 456.67 633.67 458.22 632.76 460.12C631.72 462.29 631.68 464.92 632.72 467.18C634.64 471.39 640.32 474.29 645.52 474.52C650.85 474.76 655.68 472.2 660.02 469.37C663.89 466.84 667.36 464.09 671.33 461.73C675.69 459.13 680.65 457 685.56 457.03C690.47 457.07 695.33 459.26 699.24 462.42C706.64 468.38 710.65 477.8 712.54 487.25C714.81 498.61 714.02 510.04 711.71 521.26C707.88 539.91 699.87 558.01 686.2 571.61C671.74 585.99 650.96 595.35 631.46 589.56C622.56 586.92 613.92 581.12 609.47 572.77C607.16 568.42 605.98 563.39 603.6 559.53C602.42 557.61 600.94 555.98 599.04 555.02C596.89 553.94 594.19 553.72 591.54 553.23C582.21 551.5 573.43 546.44 567.04 539.53C560.68 532.65 556.7 523.94 553.56 514.99C546.14 493.8 543.51 471.25 546 448.64C546.59 443.27 547.47 437.89 549.38 432.97C551.1 428.57 553.63 424.53 555.8 420.36C560.36 411.57 563.28 402.19 565.45 392.37C567.93 381.1 569.44 369.23 566.6 357.95C565.29 352.74 563.06 347.66 562.09 342.57C561.13 337.55 561.4 332.52 562.2 327.56C565.09 309.68 574.89 292.57 587.84 278.33C600.9 263.96 617.15 252.5 635.92 250.59ZM634.35 350.8C624.79 351.72 618.87 361.86 615.63 371.7C613.66 377.67 612.68 383.53 614.36 389.3C615.06 391.68 616.21 394.05 617.98 395.47C620.13 397.2 623.19 397.54 626.05 396.76C630.49 395.55 634.45 391.67 637.62 387.95C640.95 384.04 643.4 380.31 645.17 375.73C647.25 370.34 648.37 363.78 646.33 358.24C645.48 355.93 644.07 353.79 642.11 352.48C639.9 350.99 636.99 350.54 634.35 350.8Z","bounds":[545.086,250.31,168.811,340.99],"center":[629.492,420.805]},{"id":"p","path":"M789.33 177.61C815.14 175.44 841.25 184.29 862.59 199.5C881.17 212.75 896.13 230.81 906.57 250.9C918.82 274.5 924.83 300.89 925.89 327.65C927.01 355.72 922.68 384.21 912.34 409.95C903.78 431.25 891.11 450.67 873.53 466.68C869.18 470.64 864.52 474.4 859.57 477.33C854.39 480.41 848.89 482.57 843.43 484.97C838.1 487.31 832.81 489.86 828.6 493.84C824.43 497.79 821.32 503.14 818.93 508.61C807.41 534.93 812.38 563.81 817.6 591.75C820.28 606.05 823.01 620.1 823.26 634.4C823.49 647.77 821.54 661.36 815.55 673.92C810.4 684.7 802.27 694.73 791.9 698.51C780.48 702.67 766.34 699.24 756.97 690.75C747.96 682.57 743.38 669.7 741.73 657.36C739.78 642.81 741.92 629 744.69 614.62C747.44 600.32 750.81 585.45 748.41 571.54C746.34 559.57 739.99 548.3 733.74 537.58C730.68 532.33 727.64 527.21 726.23 521.54C724.53 514.71 725.19 507.06 725.28 499.58C725.45 484.85 723.39 470.72 721.67 456.41C718.11 426.82 715.99 396.45 715.71 366.49C715.64 358.86 715.69 351.27 715.9 343.65C716.09 336.53 716.43 329.4 715.59 322.43C714.78 315.67 712.88 309.08 711 302.52C709.17 296.17 707.36 289.85 706.3 283.36C702.07 257.72 709.42 229.45 726.34 209.43C741.87 191.04 765.47 179.61 789.33 177.61ZM807.56 308.36C800.86 308.94 794.54 315.23 791.3 322C787.52 329.9 787.95 338.46 788.05 347.35C788.14 356.08 787.93 365.15 791.45 372.84C793.01 376.27 795.32 379.42 798.37 381.17C801.6 383.01 805.66 383.28 809.28 382.16C815.94 380.09 821.09 373.28 824.38 366.46C827.99 359.01 829.38 351.54 829.83 343.56C830.29 335.34 829.75 326.57 825.32 319.38C821.36 312.95 814.27 307.78 807.56 308.36Z","bounds":[705.128,177.28,220.937,522.997],"center":[815.596,438.778]},{"id":"s","path":"M1003.06 212.48C1026.26 209.83 1051.74 217.97 1067.51 234.97C1083.58 252.3 1089.56 278.81 1084.95 302.55C1082.82 313.55 1078.41 323.95 1069.62 330.89C1065 334.54 1059.17 337.23 1053.48 337.11C1047.89 337 1042.44 334.18 1037.09 332.36C1034.26 331.41 1031.46 330.73 1028.49 331.47C1025.76 332.14 1022.89 334.01 1021.2 336.2C1017.6 340.88 1019.43 347.08 1022.46 352.26C1027.58 361.03 1036.11 366.9 1043.85 373.6C1060.24 387.81 1073.08 405.76 1079.62 425.71C1087.53 449.85 1086.23 476.9 1078.99 501.53C1072.91 522.2 1062.66 541.16 1047.57 556.79C1032.19 572.73 1011.79 585.21 990.28 586.99C967.56 588.86 943.61 578.78 928.32 561.57C912.9 544.22 906.3 519.62 906.13 496.21C906.03 483.54 907.82 471.22 913.03 459.61C917.26 450.17 923.76 441.2 933.23 436.74C939.23 433.91 946.42 432.89 952.41 434.5C957.42 435.85 961.57 439.05 966.82 441.48C972.47 444.09 979.37 445.83 983.81 443.2C988.07 440.66 990.05 434.08 989.38 428.54C988.15 418.34 977.95 411.71 969.77 404.46C961.78 397.37 955.71 389.69 949.28 381.5C945.85 377.14 942.32 372.62 940.15 367.72C937.75 362.31 937.03 356.42 936.74 350.44C936.09 337.04 937.6 323.18 936.09 309.58C934.65 296.71 930.5 284.09 932.45 272.08C934.1 261.86 940.17 252.09 947.46 243.62C962.07 226.65 981.59 214.94 1003.06 212.48Z","bounds":[906.124,211.99,180.337,375.217],"center":[996.292,399.599]},{"id":"h","path":"M1154.08 101.31C1163.73 99.85 1174.01 101.32 1182.95 105.56C1190.35 109.07 1196.83 114.47 1201.77 120.83C1213.23 135.55 1216.49 155.39 1214.98 174.36C1213.46 193.37 1207.15 211.51 1200.99 228.5C1197.98 236.81 1195.01 244.84 1192.55 254.34C1190.1 263.77 1188.15 274.66 1194.08 279.46C1195.63 280.71 1197.72 281.55 1199.48 280.6C1200.94 279.82 1202.18 277.82 1203.41 276C1205.89 272.35 1208.34 269.43 1211.24 266.84C1217.53 261.21 1225.96 257.08 1234.48 255.57C1251.85 252.5 1269.58 260.29 1279.95 275.33C1285.26 283.04 1288.64 292.65 1287.32 301.02C1286.1 308.82 1280.78 315.54 1275.73 322.35C1265.93 335.57 1257.1 349.11 1250.59 363.84C1234.88 399.36 1232.61 441.83 1242.99 479.53C1247.49 495.88 1254.36 511.33 1263.45 525.64C1267.81 532.5 1272.67 539.1 1278.35 545.22C1281.09 548.17 1284.01 551.01 1286.95 553.69C1288.35 554.97 1289.75 556.21 1290.5 557.59C1291.22 558.91 1291.34 560.36 1291.22 561.9C1290.91 565.97 1288.95 570.71 1288.05 575.53C1287 581.15 1287.39 586.87 1287.75 592.54C1288.44 603.63 1289.01 614.49 1288.58 625.4C1287.87 643.6 1284.4 661.91 1272.31 675.59C1266.56 682.1 1258.87 687.56 1250.6 688.59C1242.21 689.63 1233.24 686.13 1226.39 680.81C1212.42 669.96 1207.32 651.56 1207.44 633.56C1207.58 612.84 1214.64 592.67 1213.95 572.65C1213.3 554.07 1205.97 535.63 1201.72 517.31C1199.51 507.78 1198.14 498.29 1197.45 488.51C1196.7 477.81 1196.78 466.77 1196.05 455.45C1195.43 445.9 1194.24 436.15 1186.88 431.2C1184.83 429.82 1182.3 428.82 1180.04 429.42C1178.4 429.85 1176.9 431.14 1175.65 432.58C1172.92 435.74 1171.39 439.67 1170.23 443.62C1164.27 463.87 1168.06 484.63 1170.03 505.55C1171.04 516.25 1171.58 526.99 1170.25 537.47C1169.13 546.29 1166.67 554.93 1162.2 562.61C1158.06 569.72 1152.2 576.02 1144.73 579.26C1136.27 582.94 1125.75 582.71 1117.25 579.12C1109.9 576.01 1104.06 570.39 1099.54 563.61C1094.67 556.31 1091.33 547.66 1089.97 539.1C1086.88 519.67 1094.02 500.72 1097.38 481.19C1099.23 470.5 1099.94 459.63 1099.12 448.72C1098.41 439.31 1096.56 429.87 1093.33 421.3C1091.77 417.15 1089.88 413.19 1088.87 408.88C1087.66 403.75 1087.71 398.1 1087.91 392.54C1088.29 381.96 1089.25 371.69 1089.81 361.39C1090.38 350.76 1090.53 340.1 1092.34 329.67C1093.93 320.47 1096.8 311.45 1098.1 302.31C1100.99 282.05 1096.15 261.22 1094.12 240.33C1092.08 219.3 1092.9 198.22 1096.11 177.58C1098.86 159.94 1103.35 142.62 1113.55 128.23C1123.11 114.73 1137.69 103.79 1154.08 101.31Z","bounds":[1087.798,100.762,203.463,588.011],"center":[1189.53,394.767]},{"id":"w","path":"M1492.22 242.43C1509.73 239.37 1528.36 246.49 1540.41 259.21C1552.15 271.61 1557.64 289.32 1557.84 306.61C1558.06 326.59 1551.21 346 1556.55 366.95C1557.73 371.59 1559.5 376.3 1562.62 377.4C1565.4 378.38 1569.24 376.5 1571.47 373.38C1573.82 370.09 1574.37 365.43 1575.54 361.27C1576.76 356.92 1578.67 353.12 1579.98 349.14C1582.64 341.08 1582.87 332.25 1587.5 324.4C1591.79 317.13 1599.85 310.71 1606.53 311.66C1613.34 312.64 1618.73 321.25 1621.11 329.63C1623.91 339.45 1622.58 348.95 1623.48 358.32C1623.95 363.21 1625.03 368.06 1625.89 373.58C1626.63 378.3 1627.21 383.51 1630 385.69C1632.64 387.74 1637.23 387.1 1640.02 384.64C1642.82 382.18 1643.8 377.88 1644.65 373.65C1646.78 363.04 1648.09 352.87 1647.83 342.64C1647.59 333.01 1645.95 323.33 1647.15 313.67C1649.23 296.86 1659.91 280.09 1674.99 274.37C1690.61 268.45 1710.96 274.37 1723.32 286.42C1735.57 298.35 1739.98 316.3 1740.61 333.73C1741.3 352.95 1737.39 371.56 1731.61 389.43C1721.44 420.83 1705.5 449.98 1693.03 480.52C1679.68 513.19 1670.31 547.45 1665.46 582.89C1662.86 601.91 1661.56 621.27 1655.68 639.46C1653.19 647.18 1649.88 654.68 1644.07 660.39C1638.13 666.25 1629.56 670.23 1621.42 669.83C1613.25 669.43 1605.51 664.62 1600.32 658.14C1595.17 651.71 1592.54 643.62 1590.88 635.47C1588.88 625.66 1588.29 615.76 1588.05 605.56C1587.81 595.2 1587.92 584.52 1586.73 574.6C1586.18 569.99 1585.34 565.54 1583.44 560.9C1581.87 557.06 1579.57 553.1 1576.47 552.11C1573.29 551.08 1569.26 553.21 1566.58 556.22C1563.96 559.18 1562.62 562.99 1561.37 566.77C1555.9 583.22 1551.87 599.12 1543.61 614.31C1539.88 621.16 1535.3 627.86 1528.83 632.24C1521.44 637.23 1511.6 639.19 1503.25 637.22C1487.75 633.56 1477.37 616.38 1474.34 600.63C1473.38 595.7 1473.15 590.9 1473.09 585.72C1473.03 580.49 1473.14 574.87 1473.17 569.44C1473.21 564.17 1473.17 559.07 1475.13 554.63C1476.61 551.26 1479.23 548.27 1481.74 545.26C1492.15 532.77 1500.71 519.85 1507.35 505.77C1523 472.56 1527.94 432.87 1520.48 396.5C1517.03 379.7 1510.93 363.61 1502.7 348.58C1495.34 335.14 1486.27 322.55 1474.71 311.83C1468.95 306.49 1462.58 301.62 1458 295.57C1455.5 292.27 1453.54 288.63 1453.2 284.68C1452.84 280.44 1454.36 275.85 1456.25 271.59C1459.56 264.13 1464.01 257.67 1469.98 252.67C1476.21 247.46 1484.1 243.85 1492.22 242.43Z","bounds":[1453.146,241.721,287.541,428.139],"center":[1596.917,455.79]},{"id":"drop","path":"M1584.5 668.19C1598.59 685.77 1612.68 704.66 1617.94 727.52C1620.94 740.54 1621.07 754.85 1614.49 766.15C1608.69 776.13 1597.64 783.75 1586.47 784.06C1574.96 784.38 1563.32 776.94 1557.02 766.76C1550.02 755.44 1549.62 740.74 1552.53 727.57C1557.49 705.14 1572.06 687.17 1584.5 668.19Z","bounds":[1550.823,668.193,69.097,115.88],"center":[1585.371,726.133]}],"eye":{"outerPath":"M1366.39 297.25C1401.07 293.38 1437.58 307.03 1463.29 331.23C1487.82 354.32 1502.53 387 1505.38 420.61C1508.39 456.15 1498.15 492.74 1475.88 520.69C1455.35 546.45 1424.6 564.88 1392.31 568.43C1357.65 572.23 1321.21 558.88 1295.53 534.73C1271.22 511.88 1256.55 479.36 1253.56 446.07C1250.35 410.29 1260.63 373.63 1283.01 345.42C1303.51 319.59 1334.16 300.85 1366.39 297.25Z","pupilPath":"M1364.27 401.41C1381.57 400.6 1399.06 408.02 1411.99 420.47C1424.63 432.64 1432.92 449.62 1433.77 466.71C1435.52 501.95 1405.68 537.66 1370.98 539.58C1353.7 540.54 1335.2 533.11 1322.39 520.6C1309.98 508.49 1302.9 491.6 1302.02 474.44C1301.08 456.05 1307.25 437.33 1319.47 423.55C1330.85 410.73 1347.47 402.19 1364.27 401.41Z","highlightPath":"M1351.81 423.01C1360.39 421.38 1370.53 429.09 1372.11 437.78C1373.69 446.41 1366.82 456.02 1358.42 457.86C1349.56 459.79 1338.99 453.07 1337.65 443.96C1336.39 435.36 1343.34 424.63 1351.81 423.01Z","bounds":[1252.982,296.6,252.911,272.468],"center":[1379.438,432.834],"pupilBounds":[1301.927,401.349,131.919,138.314],"pupilCenter":[1367.886,470.506],"highlightBounds":[1337.503,422.794,34.835,35.397],"highlightCenter":[1354.92,440.493]}};
  const scene = PeepshowCartoon.create(data, PeepshowSlime, {
    fallTime: .42, fallDistance: 1, releaseTime: 1.3
  });
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let playing = !media.matches, optedIn = false, visible = true;
  let elapsed = 0, lastClock = null, lastPaint = -Infinity, raf = 0;
  let pokeStart = null, pointer = null, drawnGaze = null, forceRender = true;
  const reduced = () => media.matches && !optedIn;
  const active = () => visible && !document.hidden;

  function label() {
    toggle.setAttribute('aria-label', playing ? 'Pause logo animation' : 'Play logo animation');
    toggle.title = playing ? 'Pause logo animation' : 'Play logo animation';
    toggle.dataset.playing = String(playing);
  }
  function draw(t, options = {}) {
    // All markup is generated from the bundled numeric geometry, never user input.
    art.innerHTML = scene.svg(t, { background: false, reduced: reduced(), ...options });
  }
  function requestFrame() {
    if (!raf && active() && (playing || pokeStart !== null || forceRender)) {
      raf = requestAnimationFrame(frame);
    }
  }
  function resetClock() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastClock = null;
    requestFrame();
  }
  function frame(now) {
    raf = 0;
    if (!active()) { lastClock = null; return; }
    const dt = lastClock === null ? 0 : Math.min(.05, Math.max(0, (now-lastClock)/1000));
    lastClock = now;
    if (playing) elapsed += dt;
    let pokeElapsed;
    if (pokeStart !== null) {
      pokeElapsed = (now-pokeStart)/1000;
      if (pokeElapsed >= .88) { pokeStart = null; pokeElapsed = undefined; forceRender = true; }
    }
    if (now-lastPaint >= 1000/scene.fps || forceRender) {
      const qt = Math.floor(elapsed*scene.fps)/scene.fps;
      const options = { pokeElapsed };
      if (pointer && playing && !reduced()) {
        if (!drawnGaze) drawnGaze = scene.frame(qt).gaze;
        drawnGaze = drawnGaze.map((value, i) => value+(pointer[i]-value)*.6);
        options.gaze = drawnGaze;
      }
      draw(qt, options);
      lastPaint = now;
      forceRender = false;
    }
    requestFrame();
  }
  function clearPointer() { pointer = null; drawnGaze = null; }
  function setPlaying(value) {
    playing = value;
    if (playing) optedIn = true;
    clearPointer();
    label();
    resetClock();
  }
  function blink() {
    pokeStart = performance.now();
    forceRender = true;
    requestFrame();
  }
  root.addEventListener('pointermove', event => {
    if (!playing || reduced() || event.pointerType === 'touch') return;
    const box = art.getBoundingClientRect();
    pointer = scene.pointing((event.clientX-box.left)/box.width*scene.width,
      (event.clientY-box.top)/box.height*scene.height);
    requestFrame();
  }, { passive: true });
  root.addEventListener('pointerleave', clearPointer);
  root.addEventListener('pointercancel', clearPointer);
  // A persistent HTML button keeps pointer and keyboard focus across SVG frames.
  eye.addEventListener('click', blink);
  toggle.addEventListener('click', () => setPlaying(!playing));
  media.addEventListener('change', () => {
    optedIn = false;
    playing = !media.matches;
    clearPointer();
    pokeStart = null;
    forceRender = true;
    label();
    draw(elapsed);
    resetClock();
  });
  document.addEventListener('visibilitychange', resetClock);
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    clearPointer();
    resetClock();
  }).observe(root);
  draw(0);
  label();
  eye.hidden = false;
  toggle.hidden = false;
  requestFrame();
  window.PeepLogoAnimation = Object.freeze({
    scene,
    get debug() { return { elapsed, playing, reduced: reduced(), visible, scheduled: !!raf }; }
  });
})();
