'use strict';
const fixture=document.querySelector('#fixture'),results=document.querySelector('#results'),run=document.querySelector('#run');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(ok,message)=>{if(!ok)throw Error(message);};
let w,passes=0;
const debug=()=>w.PeepPresentation.debug;
async function until(fn,label,timeout=18000){const start=performance.now();while(!fn()){if(performance.now()-start>timeout)throw Error('Timeout: '+label);await wait(25);}}
async function load(width,height,slow=false,hash=''){
  fixture.style.width=width+'px';fixture.style.height=height+'px';
  const url=new URL('../peepshow/',location.href);
  if(slow){
    const html=await (await fetch(url)).text();
    const delay='<script>const NativeImage=window.Image;window.Image=class extends NativeImage{set src(value){if(value.startsWith("frames/"))setTimeout(()=>{super.src=value},600);else super.src=value}get src(){return super.src}};<\/script>';
    fixture.srcdoc=html.replace('<head>','<head><base href="'+url.href+'">'+delay);
  }else{fixture.removeAttribute('srcdoc');fixture.src=url.href+'?assembly='+Date.now()+hash;}
  await new Promise(r=>fixture.addEventListener('load',r,{once:true}));w=fixture.contentWindow;
  await until(()=>w.PeepPresentation,'startup');
}
async function check(name,fn){await fn();results.textContent+='\nPASS '+name;passes++;}
function key(key){w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));}
async function open(){w.document.querySelector('#exploreInside').click();await until(()=>debug().phase==='holding','full assembly');}
async function close(){w.document.querySelector('#assemblyClose').click();await until(()=>!debug().exploring,'close');await wait(80);}
run.onclick=async()=>{
  run.disabled=true;passes=0;results.textContent='Running';
  try{
    for(const [width,height] of [[320,568],[390,844],[844,390],[900,700],[1440,900],[1920,1080]]){
      await load(width,height);
      await check(width+'×'+height+' native reading and no automatic explosion',async()=>{
        assert(!debug().ready,'initial assembly downloaded without demand');
        const button=w.document.querySelector('#exploreInside');
        assert(w.getComputedStyle(button.parentElement).display!=='none','Explore hidden');
        const m=debug().landmarks;
        for(const y of [m.exTop-80,m.exTop+30,m.infoTop+120,m.exTop-40]){
          w.scrollTo(0,y);await wait(160);
          assert(!debug().gate&&!debug().scrollLocked&&!debug().exploring,'scroll opened assembly');
          assert(Math.abs(w.scrollY-y)<2,'scroll trapped');
        }
        const wheel=new w.WheelEvent('wheel',{deltaY:400,cancelable:true,bubbles:true});
        w.document.body.dispatchEvent(wheel);assert(!wheel.defaultPrevented,'reading wheel intercepted');
        assert(w.document.documentElement.scrollWidth<=width,'horizontal overflow');
      });
      await check(width+'×'+height+' open, focus trap, full reassembly and restoration',async()=>{
        w.document.querySelector('#exploreInside').scrollIntoView({block:'center'});await wait(200);const y=w.scrollY,buttonTop=w.document.querySelector('#exploreInside').getBoundingClientRect().top;
        await open();assert(debug().frame===50&&debug().scrollLocked,'not fully opened');
        assert(w.document.querySelector('#productStory').inert,'background not inert');
        key('Tab');assert(w.document.activeElement.id==='assemblyClose','focus escaped');
        const b=debug().bounds;assert(b.left>=-1&&b.right<=width+1&&b.top>=0&&b.bottom<=height,'assembly cropped');
        await close();assert(Math.abs(w.scrollY-y)<2,'scroll offset not restored: '+y+' → '+w.scrollY);
        assert(!debug().scrollLocked&&Math.abs(w.document.querySelector('#exploreInside').getBoundingClientRect().top-buttonTop)<2,'reading position not restored: '+JSON.stringify({expected:y,actual:w.scrollY,buttonTop,actualButtonTop:w.document.querySelector('#exploreInside').getBoundingClientRect().top}));
        assert(w.document.activeElement.id==='exploreInside','focus not restored');
        assert(!w.document.querySelector('#productStory').inert,'background stayed inert');
        assert(debug().events.some(e=>e.kind==='assembled'),'did not reassemble');
      });
      await check(width+'×'+height+' early close, repeated close and Escape',async()=>{
        w.document.querySelector('#exploreInside').click();await wait(500);key('Escape');key('Escape');
        await until(()=>!debug().exploring,'escape close');
        assert(!debug().scrollLocked,'early close trapped');
        await open();await close();
      });
    }
    for(const width of [390,1440]){
      await load(width,900,true);
      await check(width+' slow load remains scrollable and cancellable',async()=>{
        w.scrollTo(0,debug().landmarks.exTop);await wait(100);
        assert(!debug().ready&&!debug().gate,'slow loading blocked reading');
        w.document.querySelector('#exploreInside').click();await wait(100);
        assert(debug().phase==='loading','loading gate not shown');
        key('Escape');await until(()=>!debug().exploring,'cancel loading');
        assert(!debug().scrollLocked,'loading cancellation trapped');
        await until(()=>debug().ready,'delayed images');await open();await close();
      });
      await load(width,900,false,'#info');
      await check(width+' deep link never opens assembly',async()=>{await wait(250);assert(!debug().gate&&!debug().scrollLocked,'deep link trapped');});
    }
    results.textContent+='\nALL '+passes+' CHECKS PASSED. Synthetic events; physical devices not run.';
  }catch(e){results.textContent+='\nFAIL '+e.stack;}finally{run.disabled=false;}
};
