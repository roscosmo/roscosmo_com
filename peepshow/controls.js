(() => {

'use strict';
const stage=document.getElementById('stage');
const box=document.getElementById('deviceBox');
const render=document.getElementById('render');
const hit=document.getElementById('joyHit');
const patch=document.getElementById('patch');
const status=document.getElementById('status');
const controls=[...document.querySelectorAll('[data-direction]')];
const states={up:'assets/joy-up.webp',upRight:'assets/joy-up-right.webp',right:'assets/joy-right.webp',downRight:'assets/joy-down-right.webp',down:'assets/joy-down.webp',downLeft:'assets/joy-down-left.webp',left:'assets/joy-left.webp',upLeft:'assets/joy-up-left.webp'};
let state='centre',pointerId=null,playing=false,demoTimer=null;
let dragOrigin=null,dragging=false;
const demoHeld=new Set();
Object.values(states).forEach(url=>{const img=new Image();img.src=url;});

function setState(next){
 if(next!=='centre'&&!states[next])return;
 state=next;patch.style.display=next==='centre'?'none':'block';
 if(next!=='centre')patch.src=states[next];
 status.textContent=next.replace(/([A-Z])/g,'-$1').toUpperCase();
 controls.forEach(b=>b.classList.toggle('selected',b.dataset.direction===next));
 const vals={centre:0,up:1,upRight:2,right:3,downRight:4,down:5,downLeft:6,left:7,upLeft:8};hit.setAttribute('aria-valuenow',vals[next]);hit.setAttribute('aria-valuetext',next.replace(/([A-Z])/g,' $1'));
 if(window.PeepBridge)window.PeepBridge.input('joystick',next);
 if(window.refreshFrontVisual)window.refreshFrontVisual();
}
function stopDemo(){
 const wasPlaying=playing;
 playing=false;
 if(demoTimer!==null){clearTimeout(demoTimer);demoTimer=null;}
 if(demoHeld.size){demoHeld.clear();updateButtons();}
 if(wasPlaying)setState('centre');
}
function runDemo(sequence, speedFn=()=>1){
 stopDemo();
 playing=true;
 let index=0;
 const advance=()=>{
   if(!playing)return;
   if(index>=sequence.length){stopDemo();return;}
   const step=sequence[index++];
   setState(step.joy || 'centre');
   demoHeld.clear();
   (step.buttons || []).forEach(k=>demoHeld.add(k));
   updateButtons();
   demoTimer=setTimeout(advance,Math.max(25,Math.round(step.ms/speedFn())));
 };
 advance();
}
function cardinalFromPointer(e){
 const rect=hit.getBoundingClientRect(),x=e.clientX-(rect.left+rect.width/2),y=e.clientY-(rect.top+rect.height/2);
 if(Math.hypot(x,y)<Math.min(rect.width,rect.height)*.075)return 'centre';
 return Math.abs(x)>Math.abs(y)?(x<0?'left':'right'):(y<0?'up':'down');
}
function dragDirectionFromPointer(e){
 const rect=hit.getBoundingClientRect(),x=e.clientX-(rect.left+rect.width/2),y=e.clientY-(rect.top+rect.height/2);
 if(Math.hypot(x,y)<Math.min(rect.width,rect.height)*.075)return 'centre';
 const angle=(Math.atan2(y,x)*180/Math.PI+360)%360;
 const sector=Math.round(angle/45)%8;
 return ['right','downRight','down','downLeft','left','upLeft','up','upRight'][sector];
}
hit.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;if(pointerId!==null)return;stopDemo();pointerId=e.pointerId;dragOrigin={x:e.clientX,y:e.clientY};dragging=false;hit.setPointerCapture(e.pointerId);setState(cardinalFromPointer(e));e.preventDefault();});
hit.addEventListener('pointermove',e=>{if(pointerId!==e.pointerId)return;if(!dragging&&dragOrigin&&Math.hypot(e.clientX-dragOrigin.x,e.clientY-dragOrigin.y)>=5)dragging=true;if(dragging)setState(dragDirectionFromPointer(e));});
function release(e){if(pointerId!==e.pointerId)return;pointerId=null;setState('centre');}
hit.addEventListener('pointerup',release);hit.addEventListener('pointercancel',release);hit.addEventListener('lostpointercapture',e=>{if(pointerId===e.pointerId){pointerId=null;setState('centre');}});
hit.addEventListener('keydown',e=>{const map={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};if(map[e.key]){stopDemo();setState(map[e.key]);e.preventDefault();}else if(e.key==='Escape'||e.key===' '){setState('centre');e.preventDefault();}});
hit.addEventListener('keyup',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))setState('centre');});
controls.forEach(b=>{b.addEventListener('pointerdown',()=>{stopDemo();setState(b.dataset.direction);});b.addEventListener('pointerup',()=>{if(b.dataset.direction!=='centre')setState('centre');});b.addEventListener('pointercancel',()=>setState('centre'));b.addEventListener('click',()=>{stopDemo();if(b.dataset.direction==='centre')setState('centre');});});
document.getElementById('guide').addEventListener('change',e=>hit.classList.toggle('guide',e.target.checked));
const spinSpeed=document.getElementById('spinSpeed');
const inputsSpeed=document.getElementById('inputsSpeed');
const spinSpeedValue=document.getElementById('spinSpeedValue');
const inputsSpeedValue=document.getElementById('inputsSpeedValue');
spinSpeed.addEventListener('input',()=>spinSpeedValue.textContent=spinSpeed.value+' ms');
inputsSpeed.addEventListener('input',()=>inputsSpeedValue.textContent=Number(inputsSpeed.value).toFixed(1)+'×');
const defaultInputsText=`75 | centre | -
75 | up | A
75 | upLeft | A
75 | left | A
75 | downLeft | -
75 | down | B
75 | downRight | B
75 | right | B
75 | upRight | -
75 | up | Start
75 | upLeft | Start
75 | left | Start
75 | downLeft | -
75 | down | L
75 | downRight | L
75 | right | -
75 | upRight | R
75 | up | R
75 | centre | -`;
const sequenceText=document.getElementById('sequenceText');
const editorStatus=document.getElementById('editorStatus');
sequenceText.value=defaultInputsText;
const allowedJoys=new Set(['centre',...Object.keys(states)]);
const allowedButtons=new Set(['a','b','start','l','r']);
let inputsSequence=[];
function parseSequence(input){
 const sequence=[];
 for(const [index,raw] of input.split(/\r?\n/).entries()){
   const line=raw.trim();
   if(!line||line.startsWith('#'))continue;
   const parts=line.split('|').map(part=>part.trim());
   if(parts.length!==3)throw new Error(`Line ${index+1}: expected duration | joystick | buttons`);
   const ms=Number(parts[0]);
   if(!Number.isFinite(ms)||ms<40||ms>5000)throw new Error(`Line ${index+1}: duration must be 40–5000 ms`);
   const joy=parts[1];
   if(!allowedJoys.has(joy))throw new Error(`Line ${index+1}: unknown joystick position ${joy}`);
   const buttons=parts[2]==='-'?[]:parts[2].split('+').map(v=>v.trim().toLowerCase());
   if(buttons.some(b=>!allowedButtons.has(b)))throw new Error(`Line ${index+1}: unknown button`);
   sequence.push({ms,joy,buttons:[...new Set(buttons)]});
 }
 if(!sequence.length)throw new Error('Sequence must have at least one step');
 if(sequence.length>120)throw new Error('Sequence is limited to 120 steps');
 return sequence;
}
function applySequence(){
 try{
   inputsSequence=parseSequence(sequenceText.value);
   editorStatus.textContent=`Applied ${inputsSequence.length} steps`;
   editorStatus.classList.remove('error');
   return true;
 }catch(error){
   editorStatus.textContent=error.message;
   editorStatus.classList.add('error');
   return false;
 }
}
function spinDemo(){
 const directions=['up','upRight','right','downRight','down','downLeft','left','upLeft'];
 const duration=Number(spinSpeed.value);
 runDemo([{joy:'centre',ms:duration},...directions.map(joy=>({joy,ms:duration})),...directions.map(joy=>({joy,ms:duration})),{joy:'centre',ms:duration}]);
}
function inputsDemo(){
 if(!applySequence())return;
 runDemo(inputsSequence,()=>Number(inputsSpeed.value));
}
document.getElementById('applySequence').addEventListener('click',applySequence);
document.getElementById('restoreSequence').addEventListener('click',()=>{sequenceText.value=defaultInputsText;applySequence();});
applySequence();
document.getElementById('demo').addEventListener('click',spinDemo);
document.getElementById('inputsDemo').addEventListener('click',inputsDemo);
document.getElementById('stop').addEventListener('click',()=>{stopDemo();setState('centre');});
window.addEventListener('blur',()=>{stopDemo();pointerId=null;setState('centre');});
setState('centre');

const buttonHits=[...document.querySelectorAll('.button-hit')];
const buttonStatus=document.getElementById('buttonStatus');
const buttonPatches={a:document.getElementById('buttonPatchA'),b:document.getElementById('buttonPatchB'),start:document.getElementById('buttonPatchStart')};
const baseDevice=document.getElementById('baseDevice');
const deviceVariants={neutral:'assets/front-neutral.webp',l:'assets/front-l.webp',r:'assets/front-r.webp',lr:'assets/front-lr.webp'};
Object.values(deviceVariants).forEach(src=>{const image=new Image();image.src=src;});
const pressed=new Set();
const activePointers=new Map();
const keyboardHeld=new Set();
const testHeld=new Map();
function updateButtons(){
  const visualPressed=new Set([...pressed,...demoHeld]);
  for(const k of Object.keys(buttonPatches))
    buttonPatches[k].style.display=visualPressed.has(k)?'block':'none';
  // One fully composed image, no overlay seams or canvas pixel readback.
  const variant=visualPressed.has('l')?(visualPressed.has('r')?'lr':'l'):(visualPressed.has('r')?'r':'neutral');
  const source=deviceVariants[variant];
  if(baseDevice.getAttribute('src')!==source)baseDevice.setAttribute('src',source);
  if(window.PeepBridge)window.PeepBridge.buttons([...visualPressed]);
  buttonStatus.textContent=visualPressed.size?[...visualPressed].sort().map(s=>s.toUpperCase()).join(' + '):'NONE';
  document.querySelectorAll('[data-test-button]').forEach(b=>b.classList.toggle('selected',visualPressed.has(b.dataset.testButton)));
}
function pressButton(k){stopDemo();pressed.add(k);updateButtons();}
function releaseButton(k){
  // Multiple pointers or keyboard may hold the same button at once.
  if([...activePointers.values()].includes(k)||keyboardHeld.has(k)||[...testHeld.values()].includes(k))return;
  pressed.delete(k);updateButtons();
}
buttonHits.forEach(el=>{
 const k=el.dataset.button;
 el.addEventListener('pointerdown',e=>{
   if(e.pointerType==='mouse'&&e.button!==0)return;
   stopDemo();activePointers.set(e.pointerId,k);el.setPointerCapture(e.pointerId);pressButton(k);e.preventDefault();
 });
 const end=e=>{if(activePointers.get(e.pointerId)!==k)return;activePointers.delete(e.pointerId);releaseButton(k);};
 el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('lostpointercapture',end);
 el.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){keyboardHeld.add(k);pressButton(k);e.preventDefault();}});
 el.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){keyboardHeld.delete(k);releaseButton(k);e.preventDefault();}});
});
// Independent test controls also support holding more than one at a time.
document.querySelectorAll('[data-test-button]').forEach(el=>{
 const k=el.dataset.testButton;
 el.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;testHeld.set(e.pointerId,k);el.setPointerCapture(e.pointerId);pressButton(k);e.preventDefault();});
 const end=e=>{if(testHeld.get(e.pointerId)!==k)return;testHeld.delete(e.pointerId);releaseButton(k);};
 el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('lostpointercapture',end);
 el.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){keyboardHeld.add(k);pressButton(k);e.preventDefault();}});
 el.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){keyboardHeld.delete(k);releaseButton(k);e.preventDefault();}});
});
document.getElementById('guide').addEventListener('change',e=>buttonHits.forEach(el=>el.classList.toggle('guide',e.target.checked)));
window.addEventListener('blur',()=>{activePointers.clear();testHeld.clear();keyboardHeld.clear();pressed.clear();updateButtons();});
document.getElementById('stop').addEventListener('click',()=>{activePointers.clear();testHeld.clear();keyboardHeld.clear();pressed.clear();updateButtons();});
updateButtons();

// Display geometry from PSD: x=746, y=137, width=494, height=427.
// IMPORTANT: rendered LCD crop is native-resolution and identical to the
// source device WebP. Never downsample this crop to emulator resolution.
// The 168x144 canvas below is reserved for synthetic pixel-grid testing.
const lcdLayer=document.getElementById('lcdLayer');
const lcdCanvas=document.getElementById('lcdCanvas');
const lcdGuide=document.getElementById('lcdGuide');
const lcdEnable=document.getElementById('lcdEnable');
const lcdCtx=lcdCanvas.getContext('2d',{alpha:false});
lcdCtx.imageSmoothingEnabled=false;
let lcdPattern=false;
function drawLCDPattern(){
 lcdCtx.imageSmoothingEnabled=false;
 lcdCtx.fillStyle='#bdc7d4';lcdCtx.fillRect(0,0,168,144);
 for(let y=0;y<144;y+=8)for(let x=0;x<168;x+=8){
  if((Math.floor(x/8)+Math.floor(y/8))%2===0){
   lcdCtx.fillStyle='#203044';lcdCtx.fillRect(x,y,8,8);
  }
 }
 lcdCtx.fillStyle='#e6ebef';lcdCtx.fillRect(6,6,156,132);
 lcdCtx.fillStyle='#203044';
 lcdCtx.fillRect(6,6,6,6);lcdCtx.fillRect(156,6,6,6);
 lcdCtx.fillRect(6,132,6,6);lcdCtx.fillRect(156,132,6,6);
 lcdCtx.font='10px monospace';lcdCtx.fillText('168 x 144',54,75);
}
drawLCDPattern();
function setLCDVisible(visible){
 lcdEnable.checked=visible;
 lcdLayer.classList.toggle('enabled',visible);
}
function setLCDPattern(enabled){
 lcdPattern=enabled;
 lcdLayer.classList.toggle('pattern',enabled);
 document.getElementById('lcdPattern').setAttribute('aria-pressed',String(enabled));
}
lcdEnable.addEventListener('change',e=>setLCDVisible(e.target.checked));
document.getElementById('lcdGuideToggle').addEventListener('change',e=>{
 lcdGuide.classList.toggle('show',e.target.checked);
 if(e.target.checked)setLCDVisible(true);
});
document.getElementById('lcdHandoff').addEventListener('click',()=>{
 setLCDPattern(false);
 setLCDVisible(!lcdLayer.classList.contains('enabled'));
});
document.getElementById('lcdPattern').addEventListener('click',()=>{
 setLCDPattern(!lcdPattern);
 setLCDVisible(true);
});
// Integration seam. This test engine is synthetic, not PeepOS.
// The real emulator should call PeepBridge.frame(...) with a 168x144
// Uint8Array of 0/1 pixels and receive PeepBridge input callbacks.
const bridgeStatus=document.getElementById('bridgeStatus');
const bridgeEvent=document.getElementById('bridgeEvent');
let bridgeEnabled=false;
let bridgeMode='off';
let testJoystick='centre';
let testButtons=[];
let lastInputKey='';
const bridgeFramebuffer=new Uint8Array(168*144);
function drawBridgeFrame(){
  if(bridgeMode!=='diagnostic')return;
  bridgeFramebuffer.fill(0);
  const names=['up','upRight','right','downRight','down','downLeft','left','upLeft'];
  const i=names.indexOf(testJoystick);
  const vectors=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
  const vx=i<0?0:vectors[i][0],vy=i<0?0:vectors[i][1];
  const cx=84+vx*18, cy=73+vy*18;
  for(let y=-5;y<=5;y++)for(let x=-5;x<=5;x++)if(x*x+y*y<=25)bridgeFramebuffer[(cy+y)*168+cx+x]=1;
  // Separate control indicators, driven by actual pressed state.
  const buttons=['a','b','start','l','r'];
  buttons.forEach((b,j)=>{let bx=20+j*29;
    for(let y=100;y<117;y++)for(let x=bx;x<bx+17;x++)
      if(testButtons.includes(b)||y===100||y===116||x===bx||x===bx+16)bridgeFramebuffer[y*168+x]=1;
  });
  window.PeepBridge.frame(bridgeFramebuffer);
}
window.PeepBridge={
  // 0 means pale LCD background; 1 means dark pixel.
  frame(pixels){
    if(!bridgeEnabled||!(pixels instanceof Uint8Array)||pixels.length!==168*144)return;
    const output=lcdCtx.createImageData(168,144);
    for(let n=0;n<pixels.length;n++){
      const dark=pixels[n]!==0; const k=n*4;
      output.data[k]=dark?35:186;output.data[k+1]=dark?44:197;
      output.data[k+2]=dark?43:187;output.data[k+3]=255;
    }
    lcdCtx.putImageData(output,0,0);
  },
  input(kind,value){
    testJoystick=value;
    window.dispatchEvent(new CustomEvent('peep-controls',{detail:{joystick:value,buttons:[...testButtons]}}));
    if(bridgeMode!=='diagnostic')return;
    bridgeEvent.textContent='Joystick: '+value+' | Held: '+(testButtons.join('+')||'none');
    drawBridgeFrame();
  },
  buttons(value){
    testButtons=value;
    window.dispatchEvent(new CustomEvent('peep-controls',{detail:{joystick:testJoystick,buttons:[...value]}}));
    if(bridgeMode!=='diagnostic')return;
    bridgeEvent.textContent='Joystick: '+testJoystick+' | Held: '+(testButtons.join('+')||'none');
    drawBridgeFrame();
  }
};
function bridgeRun(enabled){
 bridgeEnabled=enabled;bridgeMode=enabled?'diagnostic':'off';
 bridgeStatus.textContent=enabled?'DIAGNOSTIC':'NOT CONNECTED';
 lcdLayer.classList.toggle('runtime',enabled);
 if(enabled){setLCDPattern(false);setLCDVisible(true);drawBridgeFrame();}
 else{lcdLayer.classList.remove('runtime');setLCDVisible(false);bridgeEvent.textContent='Inputs idle';}
}
document.getElementById('bridgeTest').addEventListener('click',()=>{if(window.PeepRuntime?.running)return;bridgeRun(true);});
document.getElementById('bridgeOff').addEventListener('click',()=>{if(window.PeepRuntime?.running)return;bridgeRun(false);});

window.activatePeepOSDisplay=()=>{
 bridgeEnabled=true;bridgeMode='real';bridgeStatus.textContent='PEEPOS LIVE';
 lcdLayer.classList.add('runtime');setLCDPattern(false);setLCDVisible(true);
};
window.deactivatePeepOSDisplay=()=>{
 bridgeEnabled=false;bridgeMode='off';bridgeStatus.textContent='NOT CONNECTED';
 lcdLayer.classList.remove('runtime');setLCDVisible(false);
};
// Later: connect the real emulator framebuffer to lcdCanvas and activate
// lcdLayer.pattern. Unlike the exact-image handoff, this will genuinely
// replace the screenshot, so LCD palette and surface treatment need tuning.


window.PeepControls = {
 spin:spinDemo, demo:inputsDemo,
 // Read-only scheduling guard. Input handlers and demo timing are unchanged.
 get busy(){return playing||pointerId!==null||activePointers.size>0||keyboardHeld.size>0||testHeld.size>0||pressed.size>0;},
 get active(){return state !== 'centre' || pressed.size > 0 || demoHeld.size > 0;},
 reset(){stopDemo();pointerId=null;activePointers.clear();testHeld.clear();keyboardHeld.clear();pressed.clear();setState('centre');updateButtons();}
};
})();
