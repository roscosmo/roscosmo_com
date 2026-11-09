'use strict';
const fixture=document.querySelector('#fixture'),results=document.querySelector('#results'),runButton=document.querySelector('#run');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const directions=['up','upLeft','left','downLeft','down','downRight','right','upRight'];
const expected=['centre',...directions,...directions,'up','centre'];
let w,trace=[],painted=[],errors=[],passes=0;
const report=text=>{results.textContent+='\n'+text;};
const assert=(value,message)=>{if(!value)throw Error(message);};
async function until(fn,label,timeout=12000){const start=performance.now();while(!fn()){if(performance.now()-start>timeout)throw Error('Timeout: '+label);await wait(20);}}
const debug=()=>w.PeepPresentation.debug;
const demos=()=>debug().events.filter(e=>e.kind==='inputs-demo').length;
const completions=()=>debug().events.filter(e=>e.kind==='inputs-demo-complete').length;
function distinct(){return trace.map(x=>x.joystick).filter((value,index,all)=>!index||value!==all[index-1]);}
function record(){trace=[];painted=[];}
function pointer(el,type,id=7,x,y){
  // Synthetic PointerEvents do not establish a browser pointer-capture session.
  el.setPointerCapture=()=>{};
  const r=el.getBoundingClientRect();
  el.dispatchEvent(new w.PointerEvent(type,{pointerType:'touch',pointerId:id,button:0,bubbles:true,cancelable:true,clientX:x??r.x+r.width/2,clientY:y??r.y+r.height*.2}));
}
function touch(type,count){
  const target=w.document.querySelector('#machine-details .product-copy');
  const touches=Array.from({length:count},(_,i)=>new w.Touch({identifier:i+1,target,clientX:50+i*30,clientY:600}));
  target.dispatchEvent(new w.TouchEvent(type,{bubbles:true,cancelable:true,touches,targetTouches:touches,changedTouches:touches}));
}
async function load(width,height,slow=false){
  fixture.style.width=width+'px';fixture.style.height=height+'px';
  const url=new URL('../peepshow/',location.href);
  if(slow){
    let html=await (await fetch(url)).text();
    const delay=`<script>const NativeImage=window.Image;window.Image=class extends NativeImage{set src(value){if(value.startsWith('frames/'))setTimeout(()=>{super.src=value},180);else super.src=value}get src(){return super.src}};<\/script>`;
    fixture.srcdoc=html.replace('<head>','<head><base href="'+url.href+'">'+delay);
  }else{fixture.removeAttribute('srcdoc');fixture.src=url.href+'?regression='+Date.now();}
  await new Promise(resolve=>fixture.addEventListener('load',resolve,{once:true}));w=fixture.contentWindow;
  await until(()=>w.PeepPresentation,'presentation startup');
  trace=[];painted=[];errors=[];
  w.addEventListener('error',e=>errors.push(e.message));
  w.addEventListener('peep-controls',e=>trace.push({...e.detail,time:w.performance.now()}));
  const currentWindow=w;
  function sampleVisual(){
    if(w!==currentWindow)return;
    const patch=w.document.querySelector('#patch'),direction=w.document.querySelector('#joyHit').getAttribute('aria-valuetext');
    if(patch.complete&&patch.naturalWidth&&patch.style.display!=='none'&&patch.currentSrc.endsWith('/joy-'+direction.toLowerCase().replace(/ /g,'-')+'.webp'))painted.push(direction.replace(/ /g,''));
    w.requestAnimationFrame(sampleVisual);
  }
  w.requestAnimationFrame(sampleVisual);
  if(!slow)await until(()=>debug().ready,'image preload');
}
async function arm(){w.scrollTo(0,debug().landmarks.inputsDemoAt-debug().landmarks.h*.31);await wait(240);assert(debug().inputsDemoArmed,'demo did not rearm');record();}
function cross(){w.scrollTo(0,debug().landmarks.inputsDemoAt+20);}
async function completeAfter(action,checkSequence=true){const before=completions();await action();await until(()=>completions()>before,'two sweeps completed');await wait(50);if(checkSequence)assert(JSON.stringify(distinct())===JSON.stringify(expected),'wrong sequence '+JSON.stringify(distinct()));assert(!w.PeepControls.busy&&!w.PeepControls.active,'controls not neutral after demo');}
async function check(name,fn){await fn();assert(!errors.length,'uncaught errors: '+errors.join('; '));report('PASS '+name);passes++;}
async function run(){
  runButton.disabled=true;results.textContent='Running';passes=0;
  try{
    for(const [width,height] of [[320,568],[390,844],[430,932],[844,390],[1440,900]]){
      await load(width,height);
      for(let i=0;i<3;i++)await check(`${width}×${height}: complete scroll-triggered demo ${i+1}`,async()=>{
        await arm();await completeAfter(cross);
        for(const direction of directions)assert(painted.some(v=>v.toLowerCase()===direction.toLowerCase()),'missing loaded visual '+direction);
        for(const button of ['a','b','start','l','r'])assert(trace.some(e=>e.buttons.includes(button)),'missing demo button '+button);
      });
      assert(w.document.documentElement.scrollWidth<=width,'horizontal overflow');
    }
    await load(390,844);
    await check('Active swipe waits for release',async()=>{await arm();touch('touchstart',1);const n=demos();cross();await wait(500);assert(demos()===n,'demo started during touch');await completeAfter(()=>touch('touchend',0));});
    await check('Touch cancellation releases pending demo',async()=>{await arm();touch('touchstart',1);cross();await wait(240);await completeAfter(()=>touch('touchcancel',0));});
    await check('Multiple touches wait for the final release',async()=>{await arm();touch('touchstart',2);const n=demos();cross();await wait(220);touch('touchend',1);await wait(300);assert(demos()===n,'demo started with a remaining touch');await completeAfter(()=>touch('touchend',0));});
    await check('Momentum must settle before starting',async()=>{await arm();const n=demos(),at=debug().landmarks.inputsDemoAt;for(let i=0;i<8;i++){w.scrollTo(0,at+20+i*5);await wait(70);assert(demos()===n,'demo started during momentum');}await completeAfter(()=>{});});
    await check('Interrupted Up pose retries two full sweeps after release',async()=>{
      await arm();const n=demos();cross();await until(()=>demos()>n,'demo start');await wait(60);
      const hit=w.document.querySelector('#joyHit');pointer(hit,'pointerdown');await wait(300);
      assert(hit.getAttribute('aria-valuetext')==='up','manual Up lost');assert(demos()===n+1,'restarted while held');
      pointer(hit,'pointerup');record();await completeAfter(()=>{});
    });
    await check('Held A button does not consume the crossing',async()=>{await arm();const el=w.document.querySelector('[data-button="a"]');pointer(el,'pointerdown');record();const n=demos();cross();await wait(350);assert(demos()===n,'demo overrode held button');pointer(el,'pointerup');record();await completeAfter(()=>{});});
    await check('Pointer cancellation releases an interrupted demo',async()=>{await arm();const n=demos();cross();await until(()=>demos()>n,'demo start');const hit=w.document.querySelector('#joyHit');pointer(hit,'pointerdown');await wait(100);pointer(hit,'pointercancel');record();await completeAfter(()=>{});});
    await check('Explicit Stop does not retry an active or pending demo',async()=>{
      for(const interrupt of [false,true]){await arm();const n=demos();cross();await until(()=>demos()>n,'demo start');const hit=w.document.querySelector('#joyHit');if(interrupt)pointer(hit,'pointerdown');w.document.querySelector('#stop').click();if(interrupt)pointer(hit,'pointerup');await wait(1400);assert(demos()===n+1&&!w.PeepControls.busy,'Stop restarted demo');}
    });
    await check('A manual demo replacement does not replay automatically',async()=>{await arm();const n=demos();cross();await until(()=>demos()>n,'demo start');w.PeepControls.spin();await wait(2200);assert(demos()===n+1&&!w.PeepControls.busy,'manual replacement triggered extra demo');});
    await check('Boundary jitter does not replay a completed demo',async()=>{const n=demos();for(let i=0;i<4;i++){w.scrollBy(0,-35);await wait(30);w.scrollBy(0,35);await wait(30);}await wait(1300);assert(demos()===n,'jitter retriggered');});
    await check('Leaving the controls section clears a queued demo',async()=>{await arm();touch('touchstart',1);cross();await wait(100);const n=demos();w.scrollTo(0,debug().landmarks.inputsDemoEnd+10);touch('touchend',0);await wait(1400);assert(demos()===n,'stale demo played after exit');});
    await check('Joystick drag and all manual buttons remain interactive',async()=>{
      const hit=w.document.querySelector('#joyHit'),r=hit.getBoundingClientRect();pointer(hit,'pointerdown');
      for(const [x,y,value] of [[1,0,'right'],[1,1,'down right'],[0,1,'down'],[-1,1,'down left'],[-1,0,'left'],[-1,-1,'up left'],[0,-1,'up'],[1,-1,'up right']]){
        pointer(hit,'pointermove',7,r.x+r.width/2+x*r.width*.4,r.y+r.height/2+y*r.height*.4);assert(hit.getAttribute('aria-valuetext').toLowerCase()===value,'manual direction '+value);
      }
      pointer(hit,'pointerup');assert(hit.getAttribute('aria-valuetext')==='centre','joystick release');
      for(const button of ['a','b','start','l','r']){const el=w.document.querySelector(`[data-button="${button}"]`);pointer(el,'pointerdown');assert(w.document.querySelector('#buttonStatus').textContent.includes(button.toUpperCase()),'manual '+button);pointer(el,'pointerup');assert(w.document.querySelector('#buttonStatus').textContent==='NONE','button release');}
    });
    await check('Explore opens and closes without trapping scrolling',async()=>{
      w.document.querySelector('#exploreInside').scrollIntoView();await wait(250);const y=w.scrollY;
      w.document.querySelector('#exploreInside').click();await until(()=>debug().phase==='holding','fully open');assert(debug().scrollLocked&&debug().frame===50,'assembly open');
      w.document.querySelector('#assemblyClose').click();await until(()=>!debug().exploring,'assembly close');assert(!debug().scrollLocked&&Math.abs(w.scrollY-y)<2,'assembly return position');
    });
    await check('Explore early close remains usable',async()=>{w.document.querySelector('#exploreInside').click();await wait(450);w.document.querySelector('#assemblyClose').click();await until(()=>!debug().exploring,'early close');assert(!debug().scrollLocked,'early close scroll lock');});
    await check('Reduced-motion setting suppresses autoplay',async()=>{const motion=w.document.querySelector('#smoothMotion');motion.checked=false;motion.dispatchEvent(new w.Event('change'));await arm();const n=demos();cross();await wait(1300);assert(demos()===n,'autoplay with motion disabled');motion.checked=true;motion.dispatchEvent(new w.Event('change'));});
    await load(390,844,true);
    await check('Slow loading retains the crossing while stopped',async()=>{assert(!debug().ready,'delay fixture was already ready');await arm();cross();await wait(250);assert(debug().inputsDemoPending,'loading lost pending crossing');await completeAfter(()=>{});});
    report(`ALL ${passes} CHECKS PASSED. Synthetic browser coverage; physical iOS/Android not run.`);
  }catch(error){report('FAIL '+error.stack);}finally{runButton.disabled=false;}
}
runButton.addEventListener('click',run);
