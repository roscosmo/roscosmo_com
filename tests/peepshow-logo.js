'use strict';
(() => {
  const output = document.querySelector('#results');
  const fixtures = document.querySelector('#fixtures');
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  let passes = 0;
  function report(message) { passes++; output.textContent += `\nPASS ${message}`; }
  async function until(predicate, message, timeout=12000) {
    const start=performance.now();
    while (!predicate()) { assert(performance.now()-start<timeout, message); await wait(25); }
  }
  async function load(width, height, mode='normal') {
    fixtures.replaceChildren();
    const frame=document.createElement('iframe');
    frame.width=width; frame.height=height;
    const loaded=new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));
    if (mode==='normal') frame.src='../peepshow/';
    else {
      const url=new URL('../peepshow/',location.href);
      let html=await (await fetch(url)).text();
      if (mode==='reduced') {
        // Controlled media-query fixture for both startup and change events.
        const shim=`<script>const nativeMatchMedia=window.matchMedia.bind(window);const logoMedia=new EventTarget();logoMedia.matches=true;window.matchMedia=query=>query==='(prefers-reduced-motion: reduce)'?logoMedia:nativeMatchMedia(query);window.testLogoMedia=logoMedia;<\/script>`;
        html=html.replace('<head>','<head><base href="'+url.href+'">'+shim);
      } else {
        frame.setAttribute('sandbox','allow-same-origin');
        html=html.replace('<head>','<head><base href="'+url.href+'">');
      }
      frame.srcdoc=html;
    }
    fixtures.append(frame);
    frame.scrollIntoView({block:'start'});
    await loaded;
    const w=frame.contentWindow;
    if (mode!=='no-script') await until(()=>w.PeepLogoAnimation&&w.PeepPresentation?.debug.ready,'Product page did not initialize');
    await wait(150);
    return {frame,w,doc:frame.contentDocument};
  }
  document.querySelector('#run').onclick=async event=>{
    event.currentTarget.disabled=true; passes=0; output.textContent='Running';
    try {
      for (const [width,height] of [[320,568],[375,812],[390,844],[430,932],[720,900],[768,1024],[844,390],[1024,768],[1440,900],[1920,1080]]) {
        const {w,doc}=await load(width,height);
        const api=w.PeepLogoAnimation,root=doc.querySelector('#peepshowLogo');
        const art=doc.querySelector('.hero-animation-art'),toggle=root.querySelector('.hero-animation-toggle');
        const logo=root.getBoundingClientRect(),header=doc.querySelector('.site-head').getBoundingClientRect();
        const caption=doc.querySelector('.hero-caption').getBoundingClientRect(),device=w.PeepPresentation.debug.bounds;
        assert(art.querySelector('svg')&&art.querySelectorAll('[data-letter]').length===7,'Missing animated SVG geometry');
        assert(!art.querySelector('svg>rect'),'Opaque SVG background');
        assert(logo.left>=0&&logo.right<=width&&doc.documentElement.scrollWidth<=width,'Horizontal overflow');
        const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
        assert([...doc.querySelectorAll('.site-head .brand-link,.site-head .site-nav')].every(el=>!overlaps(el.getBoundingClientRect(),logo))&&device.bottom<caption.top,'Hero overlap');
        assert(doc.querySelectorAll('.hero-logo h1').length===1&&doc.querySelector('.hero-logo h1').textContent==='Peepshow','Accessible heading changed');
        assert([...doc.querySelectorAll('.section-wordmark')].map(i=>i.getAttribute('src')).join('|')==='assets/logo-peepos.png|assets/logo-peepstudio.png','Other section logos changed');
        const landing=logo.top+logo.width*api.scene.floor/api.scene.width;
        assert(Math.abs(landing-device.top)<.5,'Hard landing edge does not meet device top');
        assert(w.getComputedStyle(root).transform==='none','Logo was moved from its original position');
        assert(logo.top===doc.querySelector('.hero-logo').getBoundingClientRect().top,'Logo top changed');
        const viewportWidth=doc.documentElement.clientWidth;
        const expectedWidth=height<=500&&width>=600?172.8:width<900?Math.min(viewportWidth*.78,288):Math.min(viewportWidth*.8,Math.min(166,Math.max(120,viewportWidth*.11))*2.4);
        assert(Math.abs(logo.width-expectedWidth)<1,`Original logo size changed: ${logo.width}, expected ${expectedWidth}, inner ${w.innerWidth}`);
        const clip=w.getComputedStyle(art).clipPath;
        assert(clip.startsWith('inset(')&&clip.includes('4.16667%'),'Artwork can paint below hard landing edge');
        assert([...root.querySelectorAll('button')].every(el=>el.getBoundingClientRect().width>=44),'Motion controls shrank below 44px');
        assert(toggle.getBoundingClientRect().right<=viewportWidth,'Pause control overflows');
        report(`${width}×${height}: original logo position/size; device top flush with hard splash edge; no overlap or overflow`);
        const before=api.debug.elapsed; await wait(180); assert(api.debug.elapsed>before,'Autoplay stopped');
        toggle.click(); const paused=api.debug.elapsed,markup=art.innerHTML;
        await wait(180); assert(api.debug.elapsed===paused&&art.innerHTML===markup&&!api.debug.scheduled,'Pause did not stop animation');
        toggle.click(); await wait(180); assert(api.debug.elapsed>paused,'Resume failed'); toggle.click();
        report(`${width}×${height}: autoplay, pause and resume work without layout shifts`);
      }
      let {w,doc}=await load(390,844);
      let api=w.PeepLogoAnimation,root=doc.querySelector('#peepshowLogo'),art=root.querySelector('.hero-animation-art');
      // Resize the same page repeatedly to catch geometry feedback/drift.
      const resizeFrame=doc.defaultView.frameElement;
      for(const [width,height] of [[844,390],[1440,900],[320,568],[390,844],[844,390],[390,844]]){
        resizeFrame.width=width;resizeFrame.height=height;await wait(200);
        await until(()=>{
          const box=root.getBoundingClientRect(),device=w.PeepPresentation.debug.bounds;
          return Math.abs(box.top+box.width*1035/1800-device.top)<.5;
        },'Resize detached the splash line');
      }
      report('Repeated portrait/landscape/desktop resizes keep hard splash/device edges flush without layout drift');
      // Start the blink test at a fresh elapsed time, not paused mid-auto-blink
      // after the variable-duration resize sequence.
      ({w,doc}=await load(390,844));api=w.PeepLogoAnimation;
      root=doc.querySelector('#peepshowLogo');art=root.querySelector('.hero-animation-art');
      const toggle=root.querySelector('.hero-animation-toggle'),eye=root.querySelector('.hero-animation-eye');
      toggle.click();
      eye.focus(); eye.click();
      await until(()=>Number(art.querySelector('#slime-eyelids rect').getAttribute('height'))<100,'Eye did not blink',2000);
      assert(doc.activeElement===eye,'SVG replacement lost keyboard focus');
      await until(()=>Number(art.querySelector('#slime-eyelids rect').getAttribute('height'))>270,'Blink did not reopen',2000);
      report('Eye button blinks and retains keyboard focus across redraws');
      toggle.click();
      const box=art.getBoundingClientRect();
      root.dispatchEvent(new w.PointerEvent('pointermove',{clientX:box.right,clientY:box.top,pointerType:'mouse',bubbles:true}));
      await wait(300);
      const pupil=art.querySelector('[data-eye] g g g').getAttribute('transform');
      root.dispatchEvent(new w.PointerEvent('pointermove',{clientX:box.left,clientY:box.bottom,pointerType:'mouse',bubbles:true}));
      await wait(300);assert(pupil!==art.querySelector('[data-eye] g g g').getAttribute('transform'),'Gaze not following pointer');
      root.dispatchEvent(new w.PointerEvent('pointerleave'));
      report('Eye follows the pointer and pointer exit returns automatic gaze');
      w.scrollTo(0,w.PeepPresentation.debug.landmarks.machineTop+400);await wait(250);
      const offscreen=api.debug.elapsed;await wait(200);
      assert(!api.debug.visible&&!api.debug.scheduled&&api.debug.elapsed===offscreen,'Offscreen animation kept running');
      w.scrollTo(0,0);await wait(250);assert(api.debug.visible&&api.debug.elapsed>offscreen,'Offscreen resume failed');
      report('Offscreen logo stops scheduling work and resumes on return');
      toggle.click();
      const scene=api.scene,sample=doc.createElement('div');
      sample.style.cssText='position:absolute;left:0;top:0;width:1800px;height:1080px;visibility:hidden';doc.body.append(sample);
      const seen=new Set();
      for(let t=0;t<scene.period;t+=1/scene.fps){
        sample.innerHTML=scene.svg(t,{background:false});
        const svg=sample.querySelector('svg'),canvas=svg.getBoundingClientRect();
        for(const el of svg.querySelectorAll('path,ellipse')){
          if(el.closest('defs'))continue;
          const b=el.getBoundingClientRect();
          assert([b.left,b.top,b.right,b.bottom].every(Number.isFinite),'Non-finite geometry');
          assert(b.left>=canvas.left-.1&&b.top>=canvas.top-.1&&b.right<=canvas.right+.1&&b.bottom<=canvas.bottom+.1,`Clipped animation at ${t.toFixed(3)}`);
        }
        for(const el of svg.querySelectorAll('[data-falling]'))seen.add(el.dataset.falling);
      }
      sample.remove();assert([...seen].sort().join(',')==='P,h,p,w','Not all four drips rendered');
      report('Complete original 12 fps cycle: four falling drops, splashes and regrowth fit the full SVG canvas');
      ({w,doc}=await load(390,844,'reduced'));api=w.PeepLogoAnimation;
      const reducedTime=api.debug.elapsed,reducedArt=doc.querySelector('.hero-animation-art').innerHTML;
      await wait(250);assert(api.debug.reduced&&!api.debug.playing&&!api.debug.scheduled&&api.debug.elapsed===reducedTime,'Reduced-motion autoplay');
      assert(doc.querySelector('.hero-animation-art').innerHTML===reducedArt,'Reduced-motion frame changed');
      doc.querySelector('.hero-animation-toggle').click();await wait(200);assert(api.debug.playing&&!api.debug.reduced&&api.debug.elapsed>reducedTime,'Explicit reduced-motion opt-in failed');
      w.testLogoMedia.dispatchEvent(new w.Event('change'));await wait(100);assert(api.debug.reduced&&!api.debug.playing&&!api.debug.scheduled,'Media change did not reset motion');
      w.testLogoMedia.matches=false;w.testLogoMedia.dispatchEvent(new w.Event('change'));await wait(200);assert(api.debug.playing&&!api.debug.reduced,'Motion setting change failed');
      report('Reduced motion starts static; explicit play works; changed preferences are respected');
      ({w,doc}=await load(390,844,'no-script'));
      const fallback=doc.querySelector('.hero-animation-art img');
      assert(fallback.complete&&fallback.naturalWidth===1800,'No-script fallback missing');
      assert([...doc.querySelectorAll('.hero-animation button')].every(button=>button.hidden),'No-script controls visible');
      report('JavaScript-disabled fallback displays the original transparent resting artwork');
      output.textContent+=`\nALL ${passes} CHECKS PASSED. Chromium synthetic fixtures; physical devices not tested.`;
    } catch(error) { output.textContent+='\nFAIL '+error.stack; }
    finally { document.querySelector('#run').disabled=false; output.scrollIntoView({block:'start'}); }
  };
})();
