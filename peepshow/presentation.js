/* Product v9: complete opening snap; v8 assembly, runtime and demos preserved. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const viewer=$('viewer'),render=$('render'),base=$('baseDevice'),canvas=$('sequence');
  const ctx=canvas.getContext('2d'),idle=$('idleLCD'),lcd=$('lcdLayer');
  const front={left:555,top:29,right:1448,bottom:1054};
  const exploded={left:81,top:24,right:1827,bottom:1074};
  const anchor={x:1001.5,y:541.5};
  const names=['0001A','0001B','0050A','0050B',...Array.from({length:48},(_,i)=>String(i+2).padStart(4,'0'))];
  const images=new Map(),events=[];
  const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
  const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
  const lerp=(a,b,t)=>a+(b-a)*t;
  const mix=(a,b,t)=>({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),s:lerp(a.s,b.s,t)});
  const range=(y,a,b)=>ease((y-a)/Math.max(1,b-a));
  const bounds=(p,b=front)=>({left:p.x+(b.left-anchor.x)*p.s,top:p.y+(b.top-anchor.y)*p.s,right:p.x+(b.right-anchor.x)*p.s,bottom:p.y+(b.bottom-anchor.y)*p.s});
  let m=null,dirty=true,pose=null,ready=false,lastFrameName='',frame=1,phase='idle',phaseStart=0;
  let armed=true,visited=false,exitRequest=0,entryBypass=false,phaseFrom=null,exitFromY=0,exitToY=0;
  let lastTime=performance.now(),lastY=scrollY,lastSoftware=false,lastInteractive=null;
  let smoothY=scrollY,targetY=scrollY,lastWritten=scrollY,scrolling=false,navigation=false,tau=115;
  let touchY=null,loadingSince=0;
  // Only the hero and first machine pose snap. Reading and assembly retain v8 motion.
  let heroSnap=null,heroWheelUntil=0,heroSettleAt=0,heroNativeDirection=1,mouseHeld=false;
  let inputsDemoArmed=true,returnTopVisible=false;
  const returnTop=$('returnTop');
  const motion=$('smoothMotion');
  // The requested full-motion prototype is the default. This switch also makes
  // reduced motion available without silently skipping the product demonstration.
  $('motionPreference').textContent='Turn off for native scrolling and a still assembly view.';
  const moving=()=>['loading','arriving','opening','holding','closing','exiting'].includes(phase);
  function note(text){if($('explodeNote').textContent!==text)$('explodeNote').textContent=text;}
  function log(kind){events.push({kind,time:Math.round(performance.now()),frame,scroll:Math.round(scrollY)});if(events.length>120)events.shift();}
  function rectPose(b,rect){
    const x=(rect.left+rect.right)/2,y=(rect.top+rect.bottom)/2;
    const dx=Math.max(anchor.x-b.left,b.right-anchor.x),dy=Math.max(anchor.y-b.top,b.bottom-anchor.y);
    return {x,y,s:Math.max(.01,Math.min((rect.right-rect.left)/(2*dx),(rect.bottom-rect.top)/(2*dy)))};
  }
  function layout(){
    dirty=false;
    const w=document.documentElement.clientWidth,h=innerHeight,mobile=w<900&&h>500;
    const top=id=>$(id).getBoundingClientRect().top+scrollY;
    const heroHeight=$('productHero').offsetHeight;
    const a=document.querySelector('.hero-logo'),b=document.querySelector('.hero-caption');
    const hero=rectPose(front,{left:w*.12,right:w*.88,top:a.offsetTop+a.offsetHeight+18,bottom:b.offsetTop-24});
    // Same column geometry as the normal-flow text, independent of image margins.
    const contentW=Math.min(w*.90,1900),left=(w-contentW)/2,colW=contentW*.46;
    const side=mobile?rectPose(front,{left:w*.14,right:w*.86,top:18,bottom:Math.min(h*.40,370)}):
      rectPose(front,{left:left+colW*.06,right:left+colW*.94,top:h*.17,bottom:h*.83});
    const heading=document.querySelector('.assembly-heading');
    const ex=rectPose(exploded,{left:Math.max(18,w*.045),right:w-Math.max(18,w*.045),top:heading.offsetTop+heading.offsetHeight+16,bottom:h-(mobile?150:126)});
    // Set the single mobile reading reservation, not one spacer per section.
    const reading=mobile?Math.ceil(bounds(side).bottom+25):0;
    for(const id of ['machineContent','info']){
      const el=$(id),value=reading+'px';
      if(el.style.getPropertyValue('--mobile-reading-space')!==value)el.style.setProperty('--mobile-reading-space',value);
    }
    m={w,h,mobile,hero,side,ex,heroHeight,machineTop:top('machineContent'),exTop:top('explosion'),infoTop:top('info'),footer:top('productFooter'),reading,
      firstStart:0,firstEnd:top('machineContent')};
    m.panStart=m.exTop-h*.48;
    // Run while the controls heading passes the reading line, not at every
    // section update. The mobile reading line is below the reserved device area.
    const inputsHeading=$('machine-details').querySelector('h2');
    const readingLine=mobile?reading+(h-reading)*.30:h*.50;
    m.inputsDemoAt=inputsHeading.getBoundingClientRect().bottom+scrollY-readingLine;
    m.inputsDemoEnd=Math.min(top('pocketSize'),m.panStart);
    if(heroSnap){
      const now=performance.now();
      heroSnap.duration=Math.max(180,heroSnap.duration-(now-heroSnap.started));
      heroSnap.started=now;heroSnap.fromY=scrollY;heroSnap.fromPose={...pose};
    }
    if(moving()&&phase!=='exiting'){smoothY=targetY=m.exTop;writeScroll(m.exTop);}
    if(phase==='exiting')exitToY=exitRequest<0?Math.max(0,m.panStart-h*.15):m.infoTop;
  }
  function normalPose(y){
    if(y<=0)return m.hero;
    if(y<m.firstEnd)return mix(m.hero,m.side,range(y,0,m.firstEnd));
    if(y<m.panStart)return m.side;
    if(y<m.exTop)return mix(m.side,m.ex,range(y,m.panStart,m.exTop));
    if(y<m.infoTop)return mix(m.ex,m.side,range(y,m.exTop,m.infoTop));
    return m.side;
  }
  function apply(p){
    pose=p;
    render.style.transform=`matrix(${p.s},0,0,${p.s},${p.x-anchor.x*p.s},${p.y-anchor.y*p.s})`;
  }
  function writeScroll(y){
    lastWritten=y;window.scrollTo({left:0,top:y,behavior:'instant'});
  }
  const maximum=()=>Math.max(0,document.documentElement.scrollHeight-innerHeight);
  function cancelEase(){scrolling=false;smoothY=targetY=scrollY;}
  function beginHeroSnap(destination){
    if(heroSnap||moving())return;
    const toY=destination?m.machineTop:0;
    if(Math.abs(scrollY-toY)<1)return;
    const now=performance.now();
    heroSnap={destination,fromY:scrollY,fromPose:{...(pose||normalPose(scrollY))},started:now,duration:780};
    scrolling=false;navigation=false;entryBypass=false;heroSettleAt=0;
    smoothY=targetY=scrollY;
    window.PeepControls?.reset();
    log(destination?'hero-snap-to-machine':'hero-snap-to-top');
  }
  function openingIntent(dy){
    if(!motion.checked||moving())return false;
    if(heroSnap)return true;
    if(scrollY<m.machineTop-2){
      if(dy>0)beginHeroSnap(1);
      else if(scrollY>1)beginHeroSnap(0);
      return true;
    }
    if(dy<0&&scrollY<=m.machineTop+2){beginHeroSnap(0);return true;}
    return false;
  }
  function advanceHeroSnap(now){
    const snap=heroSnap,raw=clamp((now-snap.started)/snap.duration),t=ease(raw);
    const toY=snap.destination?m.machineTop:0;
    const target=snap.destination?m.side:m.hero;
    const y=lerp(snap.fromY,toY,t);
    smoothY=targetY=y;writeScroll(y);apply(mix(snap.fromPose,target,t));
    viewer.style.visibility='visible';
    if(raw===1){
      smoothY=targetY=toY;writeScroll(toY);apply(target);
      heroSnap=null;scrolling=false;lastY=scrollY;
      // Consume the tail of the triggering wheel gesture, not a new scroll.
      heroWheelUntil=now+120;
      log(snap.destination?'hero-side-settled':'hero-top-settled');
    }
  }
  function requestScroll(dy){
    if(!dy)return;
    if(openingIntent(dy))return;
    if(moving()){
      if(phase==='exiting')return;
      exitRequest=dy>0?1:-1;
      if(phase==='holding'&&performance.now()-phaseStart>=1000)beginClose(performance.now());
      return;
    }
    if(!scrolling){smoothY=scrollY;targetY=scrollY;}
    if(Math.sign(dy)!==Math.sign(targetY-smoothY))targetY=smoothY;
    targetY=clamp(targetY+dy,0,maximum());
    // Reading above the first section stops at its side pose. The next upward
    // gesture snaps to the opening; no half-centred pose is left behind.
    if(dy<0&&smoothY>m.machineTop+2&&targetY<m.machineTop)targetY=m.machineTop;
    scrolling=true;
  }
  function beginEntry(now){
    if(moving())return;
    armed=false;visited=false;exitRequest=0;frame=1;phaseFrom={...(pose||m.ex)};
    smoothY=targetY=m.exTop;writeScroll(m.exTop);scrolling=false;
    phase=ready?'arriving':'loading';phaseStart=loadingSince=now;
    window.PeepControls?.reset();log(phase);
  }
  function beginClose(now){phase='closing';phaseStart=now;frame=50;log('closing');}
  function beginExit(now){
    phase='exiting';phaseStart=now;phaseFrom={...pose};frame=1;
    exitFromY=m.exTop;exitToY=exitRequest<0?Math.max(0,m.panStart-m.h*.15):m.infoTop;
    log('exit-pan');
  }
  function skip(){
    if(!moving())return;
    if(!exitRequest)exitRequest=1;
    // Deliberate Skip is the only control that may omit animation frames.
    beginExit(performance.now());
  }
  function scene(now){
    if(phase==='loading'){
      note('Loading assembly images…');
      if(ready){phase='arriving';phaseStart=now;phaseFrom={...pose};log('arriving');}
      else if(now-loadingSince>10000){note('Assembly images are still loading. The return-to-top shortcut remains available.');}
    }
    if(phase==='arriving'){
      const t=ease((now-phaseStart)/300);
      smoothY=targetY=m.exTop;writeScroll(m.exTop);apply(mix(phaseFrom,m.ex,t));note('Opening the assembly…');
      if(t===1){phase='opening';phaseStart=now;log('opening');}
      return;
    }
    if(phase==='opening'){
      frame=1+Math.min(49,Math.floor((now-phaseStart)*24/1000));
      note(exitRequest?'Opening, then returning to the front…':'Opening the assembly…');
      if(frame===50){phase='holding';phaseStart=now;log('fully-open');}
    }
    if(phase==='holding'){
      note(exitRequest?'Returning to the front…':'');
      if(exitRequest&&now-phaseStart>=1000)beginClose(now);
    }
    if(phase==='closing'){
      frame=50-Math.min(49,Math.floor((now-phaseStart)*24/1000));note('Reassembling…');
      if(frame===1){log('assembled');beginExit(now);}
    }
    if(phase==='exiting'){
      const raw=clamp((now-phaseStart)/1000),t=ease(raw);
      const target=exitRequest<0?normalPose(exitToY):m.side;
      apply(mix(phaseFrom,target,t));
      const y=lerp(exitFromY,exitToY,ease((raw-.35)/.65));smoothY=targetY=y;writeScroll(y);
      if(t===1){phase='done';visited=true;scrolling=false;lastY=scrollY;log('pan-complete');}
      return;
    }
    if(moving()){
      smoothY=targetY=m.exTop;writeScroll(m.exTop);
      apply(m.ex);
    }
  }
  function draw(name){
    if(name===lastFrameName)return;
    const img=images.get(name);if(!img)return;
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);lastFrameName=name;
  }
  const frameName=n=>n===1?'0001A':n===50?'0050A':String(n).padStart(4,'0');
  function layers(now){
    const showingAssembly=ready&&['opening','holding','closing'].includes(phase);
    const software=!moving()&&scrollY>=m.infoTop-m.h*.18;
    const interactive=!heroSnap&&!moving()&&(scrollY<m.panStart||software);
    canvas.style.display=showingAssembly?'block':'none';
    base.style.visibility=showingAssembly?'hidden':'visible';
    viewer.querySelectorAll('#patch,.button-patch').forEach(el=>el.style.visibility=showingAssembly?'hidden':'visible');
    if(showingAssembly)draw(phase==='holding'?'0050'+(Math.floor((now-phaseStart)/500)%2?'B':'A'):frameName(frame));
    if(interactive!==lastInteractive){
      if(!interactive)window.PeepControls?.reset();
      viewer.dataset.interactive=String(interactive);
      viewer.querySelectorAll('.button-hit,.joy-hit').forEach(el=>el.tabIndex=interactive?0:-1);
      lastInteractive=interactive;
    }
    lcd.style.visibility=software?'visible':'hidden';
    if(lastSoftware!==software){lastSoftware=software;window.dispatchEvent(new CustomEvent('peep-stage',{detail:{softwareVisible:software}}));}
    const showIdle=!showingAssembly&&!window.PeepControls?.active&&!(software&&lcd.classList.contains('enabled'))&&Math.floor(now/500)%2===1;
    idle.style.display=showIdle?'block':'none';
    let glow=moving()?1:Math.min(range(scrollY,m.panStart,m.exTop),1-range(scrollY,m.exTop,m.infoTop));
    if(phase==='exiting')glow=1-ease((now-phaseStart)/1000);
    viewer.style.setProperty('--glow',glow.toFixed(3));
    if(!moving())note(ready?'':'Loading assembly images…');
  }
  function maybeInputsDemo(){
    // Rearm only after a substantial upward return, avoiding boundary flicker.
    if(scrollY<m.inputsDemoAt-m.h*.30)inputsDemoArmed=true;
    if(!inputsDemoArmed||scrollY<=lastY||scrollY<m.inputsDemoAt||scrollY>=m.inputsDemoEnd)return;
    if(heroSnap||moving()||entryBypass||navigation||!motion.checked||document.hidden||!ready)return;
    inputsDemoArmed=false;
    // Manual inputs and an existing demo always take precedence.
    if(!window.PeepControls?.busy&&viewer.dataset.interactive==='true'){
      window.PeepControls?.demo();log('inputs-demo');
    }
  }
  function updateReturnTop(){
    const visible=scrollY>m.h*.35||moving();
    if(visible===returnTopVisible)return;
    returnTopVisible=visible;
    returnTop.classList.toggle('is-visible',visible);
    returnTop.tabIndex=visible?0:-1;
  }
  function tick(now){
    const dt=clamp(now-lastTime,1,40);lastTime=now;
    if(dirty||!m)layout();
    if(!heroSnap&&!moving()&&!scrolling&&!navigation&&motion.checked&&!mouseHeld&&heroSettleAt&&now>=heroSettleAt){
      heroSettleAt=0;
      if(scrollY>1&&scrollY<m.machineTop-2)beginHeroSnap(heroNativeDirection>0?1:0);
    }
    const heroWasActive=!!heroSnap;
    if(heroWasActive)advanceHeroSnap(now);
    if(!heroWasActive&&!moving()){
      if(scrolling){
        smoothY=motion.checked?smoothY+(targetY-smoothY)*(1-Math.exp(-dt/tau)):targetY;
        if(Math.abs(targetY-smoothY)<.25){smoothY=targetY;scrolling=false;}
        // Clamp the scroll to the assembly entrance before a large wheel delta can skip it.
        if(armed&&!entryBypass&&motion.checked&&smoothY>=m.exTop&&lastY<m.exTop){beginEntry(now);}
        else writeScroll(smoothY);
      }else if(armed&&!entryBypass&&motion.checked&&scrollY>=m.exTop&&lastY<m.exTop){beginEntry(now);}
    }
    if(!heroWasActive&&moving())scene(now);
    else if(!heroWasActive){
      let desired=normalPose(scrollY);
      // Release above the footer, without removing the object or covering text.
      if(scrollY>=m.infoTop){const edge=bounds(desired).bottom;desired={...desired,y:desired.y+Math.min(0,m.footer-scrollY-edge-28)};}
      const p=pose&&motion.checked?mix(pose,desired,1-Math.exp(-dt/55)):desired;
      apply(p);viewer.style.visibility=bounds(p).bottom<=0?'hidden':'visible';
      if(scrollY<m.panStart-m.h*.2){armed=true;visited=false;phase='idle';}
    }
    layers(now);maybeInputsDemo();updateReturnTop();
    for(const id of ['machineContent','info']){
      const start=id==='machineContent'?m.machineTop:m.infoTop;
      $(id).style.setProperty('--reading-clip-top',m.mobile?Math.max(0,scrollY+m.reading-start)+'px':'0px');
    }
    if(entryBypass&&!scrolling){entryBypass=false;navigation=false;}
    lastY=scrollY;requestAnimationFrame(tick);
  }
  function nested(el,dy){
    for(let n=el instanceof Element?el:null;n&&n!==document.body;n=n.parentElement){
      if(n.matches('input,textarea,select,[contenteditable="true"]'))return true;
      const css=getComputedStyle(n);
      if(/auto|scroll/.test(css.overflowY)&&n.scrollHeight>n.clientHeight+2&&(dy<0?n.scrollTop>0:n.scrollTop+n.clientHeight<n.scrollHeight-1))return true;
    }
    return false;
  }
  addEventListener('wheel',e=>{
    if(!e.cancelable||e.ctrlKey||e.metaKey||e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)||nested(e.target,e.deltaY))return;
    if(!motion.checked&&!moving())return;
    const dy=e.deltaY*(e.deltaMode===1?22:e.deltaMode===2?innerHeight*.8:1);
    e.preventDefault();
    if(heroSnap){heroWheelUntil=performance.now()+120;return;}
    if(performance.now()<heroWheelUntil){heroWheelUntil=performance.now()+120;return;}
    tau=e.deltaMode===0&&Math.abs(e.deltaY)<35?75:115;
    requestScroll(dy);
  },{passive:false});
  // Native touch momentum is retained outside the assembly. A swipe while it is
  // opening records the next action, not hundreds of queued scroll pixels.
  addEventListener('touchstart',e=>{
    const control=e.target.closest('button,a,input,textarea,select,summary,.button-hit,.joy-hit');
    touchY=e.touches.length===1&&!control?e.touches[0].clientY:null;
    if(!heroSnap)cancelEase();
  },{passive:true});
  addEventListener('touchmove',e=>{
    if(e.touches.length!==1||touchY===null)return;
    const dy=touchY-e.touches[0].clientY;
    const opening=motion.checked&&(scrollY<m.machineTop-2||(dy<0&&scrollY<=m.machineTop+2));
    if(!heroSnap&&!moving()&&!opening)return;
    if(e.cancelable)e.preventDefault();
    if(Math.abs(dy)>12){requestScroll(dy);touchY=e.touches[0].clientY;}
  },{passive:false});
  addEventListener('touchend',()=>{touchY=null;},{passive:true});
  addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch'){mouseHeld=true;if(!heroSnap&&!moving())cancelEase();}
  },{passive:true});
  addEventListener('pointerup',()=>{mouseHeld=false;},{passive:true});
  addEventListener('pointercancel',()=>{mouseHeld=false;},{passive:true});
  addEventListener('blur',()=>{mouseHeld=false;},{passive:true});
  addEventListener('keydown',e=>{
    if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('button,input,textarea,select,[contenteditable],.button-hit,.joy-hit'))return;
    const map={ArrowDown:80,ArrowUp:-80,PageDown:innerHeight*.75,PageUp:-innerHeight*.75,' ':innerHeight*.75};
    if(e.key==='Escape'&&moving()){e.preventDefault();skip();return;}
    if(map[e.key]){e.preventDefault();requestScroll(map[e.key]*(e.key===' '&&e.shiftKey?-1:1));}
    else if(e.key==='Home'||e.key==='End'){
      e.preventDefault();heroSnap=null;heroSettleAt=0;heroWheelUntil=0;if(moving()){phase='done';frame=1;visited=true;armed=false;}
      entryBypass=true;smoothY=scrollY;targetY=e.key==='Home'?0:maximum();scrolling=true;
    }
  });
  addEventListener('scroll',()=>{
    if(heroSnap||moving())return;
    // Native scrollbar/touch releases inside the opening settle to a full pose.
    const external=Math.abs(scrollY-lastWritten)>1;
    if(external&&!navigation){
      heroNativeDirection=scrollY>=lastWritten?1:-1;
      heroSettleAt=performance.now()+140;
    }
    // Ignore events caused by our own writes. A real scrollbar jump takes priority.
    if(scrolling&&Math.abs(scrollY-lastWritten)>32){cancelEase();}
  },{passive:true});
  function goTo(el,bypass=true){
    heroSnap=null;heroSettleAt=0;heroWheelUntil=0;
    if(moving()){phase='done';frame=1;armed=false;visited=true;}
    entryBypass=bypass;navigation=true;cancelEase();targetY=clamp(el.getBoundingClientRect().top+scrollY,0,maximum());scrolling=true;tau=140;
  }
  document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
    const el=$(a.getAttribute('href').slice(1));if(!el)return;
    e.preventDefault();
    if(el===$('machine')&&scrollY<m.machineTop-2&&motion.checked&&!moving())beginHeroSnap(1);
    else goTo(el);
    history.replaceState(null,'',a.getAttribute('href'));
  }));
  returnTop.addEventListener('click',()=>{
    // goTo's existing navigation bypass cancels the presentation, not the runtime.
    // No opening/reassembly sequence is replayed while returning to the hero.
    window.PeepControls?.reset();
    goTo($('productHero'),true);
    history.replaceState(null,'','#productHero');
    log('return-to-top');
  });
  motion.addEventListener('change',()=>{
    if(heroSnap){const end=heroSnap.destination?m.machineTop:0;heroSnap=null;writeScroll(end);}
    heroSettleAt=0;cancelEase();if(!motion.checked&&moving())skip();
  });
  const resize=()=>{dirty=true;};
  addEventListener('resize',resize,{passive:true});window.visualViewport?.addEventListener('resize',resize,{passive:true});
  new ResizeObserver(resize).observe($('productStory'));
  async function load(url){
    let failure;
    for(let attempt=0;attempt<3;attempt++){
      const img=new Image();
      try{
        await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Image load: '+url));img.src=url;});
        if(!img.naturalWidth)throw new Error('Empty image: '+url);
        // decode() can reject a valid loaded image when the decoder is under
        // memory pressure. A loaded natural size is still drawable by canvas.
        try{await img.decode();}catch(error){if(!img.complete||!img.naturalWidth)throw error;}
        return img;
      }catch(error){failure=error;await new Promise(r=>setTimeout(r,150*(attempt+1)));}
    }
    throw new Error(url+': '+failure.message);
  }
  async function preload(){
    const urls=['front-neutral','front-l','front-r','front-lr','button-a','button-b','button-start','joy-up','joy-right','joy-down','joy-left','joy-up-left','joy-up-right','joy-down-left','joy-down-right'];
    const jobs=[...names.map(n=>async()=>images.set(n,await load('frames/'+n+'.webp'))),...urls.map(n=>()=>load('assets/'+n+'.webp'))];
    let cursor=0;const errors=[];
    const run=async()=>{while(cursor<jobs.length){const task=jobs[cursor++];try{await task();}catch(error){errors.push(error.message);}}};
    await Promise.all(Array.from({length:4},run));ready=names.every(n=>images.has(n));
    if(errors.length)console.warn('[Peepshow] Image load failure',errors.join('; '));

    window.peepRendersReady=true;window.dispatchEvent(new Event('peep-renders-ready'));
  }
  let launching=false;
  async function launch(name){
    if(launching)return;
    if(!window.PeepRuntime){$('siteLoadStatus').textContent='Browser runtime is still starting.';return;}
    if(window.PeepRuntime.running&&$('realExample').value!==name&&!confirm('Replace the current game with '+name.replace('_',' ')+'?'))return;
    $('realExample').value=name;launching=true;
    const buttons=[...document.querySelectorAll('[data-load-game],#loadDungeon,#loadPet')];buttons.forEach(b=>b.disabled=true);
    try{await window.PeepRuntime.start(name);$('siteLoadStatus').textContent=$('realEmulatorStatus').textContent;}
    catch(err){$('siteLoadStatus').textContent=String(err);}
    finally{launching=false;buttons.forEach(b=>b.disabled=false);}
  }
  $('loadDungeon').addEventListener('click',()=>launch('dungeon'));$('loadPet').addEventListener('click',()=>launch('virtual_pet'));
  document.querySelectorAll('[data-load-game]').forEach(b=>b.addEventListener('click',()=>launch(b.dataset.loadGame)));
  window.refreshFrontVisual=()=>{};
  window.PeepPresentation={
    get softwareVisible(){return lastSoftware;},
    get debug(){return {heroSnap:heroSnap?{destination:heroSnap.destination}:null,phase,frame,ready,missingImages:names.filter(n=>!images.has(n)),gate:moving(),armed,visited,inputsDemoArmed,exitRequest,scrollY,targetY,scrolling,pose,bounds:pose?bounds(pose,frame>1?exploded:front):null,softwareVisible:lastSoftware,landmarks:m,events:[...events]};}
  };
  layout();apply(normalPose(scrollY));requestAnimationFrame(tick);void preload();
})();
