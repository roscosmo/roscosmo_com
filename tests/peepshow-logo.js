'use strict';
(() => {
  const output=document.querySelector('#results'),fixtures=document.querySelector('#fixtures');
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const assert=(ok,message)=>{if(!ok)throw new Error(message);};
  document.querySelector('#run').onclick=async event=>{
    event.currentTarget.disabled=true;output.textContent='Running';let passes=0;
    try{
      for(const [width,height] of [[320,568],[375,812],[390,844],[430,932],[720,900],[768,1024],[844,390],[1024,768],[1440,900],[1920,1080]]){
        const frame=document.createElement('iframe');frame.width=width;frame.height=height;
        const loaded=new Promise(resolve=>frame.onload=resolve);frame.src='../peepshow/';fixtures.replaceChildren(frame);frame.scrollIntoView({block:'start'});await loaded;
        const w=frame.contentWindow,d=frame.contentDocument;const started=performance.now();
        while(!w.PeepPresentation?.debug.ready){assert(performance.now()-started<12000,'Product did not initialize');await wait(25);}
        await wait(200);
        const img=d.querySelector('.hero-wordmark'),slot=d.querySelector('.hero-logo'),caption=d.querySelector('.hero-caption');
        assert(img?.complete&&img.naturalWidth===1666&&img.getAttribute('src')==='assets/logo-peepshow.png','Original static artwork missing');
        assert(img.alt==='Peepshow'&&d.querySelector('.hero-logo h1').contains(img),'Accessible hero title changed');
        assert(!d.querySelector('#peepshowLogo,.hero-animation-toggle,script[src*="logo-animation"]')&&!w.PeepLogoAnimation,'Animated hero still active');
        const b=img.getBoundingClientRect(),device=w.PeepPresentation.debug.bounds,c=caption.getBoundingClientRect();
        assert(b.bottom+17<=device.top&&device.bottom<c.top,'Logo/device/caption overlap');
        assert(d.documentElement.scrollWidth<=width,'Horizontal overflow');
        const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
        assert([...d.querySelectorAll('.site-head .brand-link,.site-head .site-nav')].every(el=>!overlap(el.getBoundingClientRect(),b)),'Header overlap');
        const top=slot.offsetTop+slot.offsetHeight+18,bottom=caption.offsetTop-24;
        const scale=Math.min(d.documentElement.clientWidth*.76/893,(bottom-top)/1025);
        assert(Math.abs(device.top-((top+bottom)/2-512.5*scale))<1&&Math.abs(device.right-device.left-893*scale)<1,'Original device fitting changed');
        const markup=slot.innerHTML;await wait(200);assert(slot.innerHTML===markup&&img.getBoundingClientRect().top===b.top,'Static logo changed');
        output.textContent+=`\nPASS ${width}×${height}: original static logo and device layout, accessible, stationary, no overlap/overflow`;passes++;
      }
      output.textContent+=`\nALL ${passes} CHECKS PASSED. Chromium browser fixtures; physical devices not tested.`;
    }catch(error){output.textContent+='\nFAIL '+error.stack;}
    finally{event.currentTarget.disabled=false;output.scrollIntoView({block:'start'});}
  };
})();
