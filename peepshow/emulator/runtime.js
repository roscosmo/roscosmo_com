let serial = 0, revision = 0, previewRevision, root, documentSource, state, runtime;
let running = false, suspended = false, initialized = false, uiQueue = Promise.resolve();
let warmupPromise = null;
const exampleArchives = new Map();
let lastTick = 0, audioContext, tickTimer;
let tickPending = false;
const pending = new Map(), audioBuffers = new Map(), playing = new Set(), held = new Set();
const measurements = [];
const $ = id => document.getElementById(id);
let worker;
function ensureWorker() {
  if (worker) return;
  worker = new Worker('./emulator/worker.js', {type: 'module'});
  worker.onmessage = ({data}) => {
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    data.error ? request.reject(Error(data.error)) : request.resolve(data.result);
  };
  worker.onerror = error => {
    for (const request of pending.values()) request.reject(Error(error.message));
    pending.clear(); running = false;
  };
}
function send(kind, fields = {}) {
  ensureWorker();
  const id = ++serial;
  return new Promise((resolve, reject) => {
    pending.set(id, {resolve, reject}); worker.postMessage({id, kind, ...fields});
  });
}
function log(value) { console.info('[PeepOS]', value); }
function draw(frame) {
  if (!frame) return;
  const bytes = Uint8Array.from(atob(frame.data_base64), c => c.charCodeAt(0));
  const context = $('lcdCanvas').getContext('2d');
  const image = context.createImageData(frame.width, frame.height);
  for (let y=0;y<frame.height;y++) for (let x=0;x<frame.width;x++) {
    const value = bytes[y*frame.row_stride_bytes+(x>>3)] & (128>>(x&7)) ? 0 : 255;
    const i = (y*frame.width+x)*4;
    image.data[i]=value?186:35; image.data[i+1]=value?197:44; image.data[i+2]=value?187:43; image.data[i+3]=255;
  }
  context.putImageData(image,0,0);
}
async function rpc(operation, params = {}) {
  const before = performance.now();
  const fields = {...params};
  if (!['project.load','project.create','service.hello'].includes(operation)) fields.project_revision=revision;
  if (operation.startsWith('project.preview_') && operation !== 'project.preview_reset') fields.preview_revision=previewRevision;
  const result = await send('rpc', {request:{protocol_version:1,id:String(serial+1),operation,params:fields}});
  const measured = {operation,...result.measurement,round_trip_ms:performance.now()-before};
  measurements.push(measured); if(measurements.length>1000) measurements.shift();
  // Performance details remain in measurements; don't redraw status for every frame.

  if (!result.response.ok) {
    if(result.response.error.code==='PREVIEW_SCENE_RESTART_REQUIRED') {
      running=false; // Do not retry a stale destination on every animation tick.
      report('Destination changed. Restart the preview.');
    }
    throw Object.assign(Error(JSON.stringify(result.response.error)),{code:result.response.error.code});
  }
  const value=result.response.result;
  revision=value.project_revision ?? revision; previewRevision=value.preview_revision ?? previewRevision;
  if(value.document) documentSource=value.document;
  if(value.framebuffer) {state=value; draw(value.framebuffer);}
  if(value.preview_snapshot) {state=value.preview_snapshot; draw(state.framebuffer);}
  if(value.preview_update==='restart_required') {running=false; state=null;}
  return value;
}
function base64(bytes) {
  let result=''; for(let i=0;i<bytes.length;i+=16384) result+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return btoa(result);
}
function download(encoded,name,type) {
  const data=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  const url=URL.createObjectURL(new Blob([data],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
async function stopAudio(scopes) {
  const wait=[];
  for(const item of playing) if(!scopes || scopes.includes(item.scope)) {wait.push(item.ended);item.node.stop();}
  // A stop acknowledgement is sent only after the browser nodes ended.
  await Promise.race([Promise.all(wait),new Promise((_,reject)=>setTimeout(()=>reject(Error('Audio stop timed out')),2000))]);
}
function play(cue) {
  const buffer=audioBuffers.get(cue.cue_id);
  if(!buffer || !audioContext || audioContext.state!=='running') throw Error('Audio not prepared/unlocked: '+cue.cue_id);
  const node=audioContext.createBufferSource(),gain=audioContext.createGain();
  node.buffer=buffer;gain.gain.value=cue.volume/255;node.connect(gain);gain.connect(audioContext.destination);
  const item={node,scope:cue.audio_scope || 'gameplay'};
  item.ended=new Promise(resolve=>{node.onended=()=>{node.disconnect();gain.disconnect();playing.delete(item);resolve();};});
  playing.add(item);node.start();
}
async function settle() {
  if(!state?.scope_input) return;
  const stop=state.scope_audio?.pending_stop;
  if(stop) {await stopAudio(stop.scopes); await rpc('project.preview_audio_stop_complete',{audio_token:stop.token,success:true});}
  // Suspension retains input ownership. Only Resume may supply its snapshot.
  if(suspended) return;
  const menu=state.scope_menu?.pending;
  if(menu) await rpc('project.preview_menu_finish',{menu_token:menu.token,focus_generation:state.scope_input.generation,held_sources:[...held]});
  if(state.scope_input.snapshot_required) await rpc('project.preview_input_snapshot',{focus_generation:state.scope_input.generation,held_sources:[...held]});
  if(state.scope_audio?.queued?.length) {
    const value=await rpc('project.preview_audio_take');
    for(const cue of value.audio_commands) play(cue);
  }
}
async function stopPreview() {
  running=false;
  if(state && !suspended) {await rpc('project.preview_suspend');suspended=true;await settle();}
  await stopAudio();held.clear();
}
async function openArchive(bytes) {
  await stopPreview();
  root=await send('import',{data:base64(bytes)});
  const value=await rpc('project.load',{path:root});state=null;previewRevision=undefined;suspended=false;audioBuffers.clear();
  // The authoring harness is intentionally not part of the product viewer.
  log({opened:root,valid:value.valid,issues:value.issues,build_issues:value.build_issues});
}
async function openExample(name) {
  if(!['dungeon','virtual_pet'].includes(name)) throw Error('Unknown example: '+name);
  const url='./emulator/'+name+'.zip';
  let bytes=exampleArchives.get(name);
  if(!bytes){
    const response=await fetch(url);
    if(!response.ok) throw Error('Could not load '+url+' (HTTP '+response.status+')');
    bytes=new Uint8Array(await response.arrayBuffer());
  }
  if(bytes.length<4 || bytes[0]!==0x50 || bytes[1]!==0x4b || bytes[2]!==0x03 || bytes[3]!==0x04)
    throw Error('Invalid ZIP data from '+url+'. Check the local server directory.');
  exampleArchives.set(name,bytes);
  await openArchive(bytes);
}
// Warm Python near the software section; game packages load on explicit Play.
// No AudioContext or playback begins until an explicit user gesture.
async function warmupRuntime() {
  if(warmupPromise) return warmupPromise;
  warmupPromise=(async()=>{
    report('Preparing browser emulator…');
    if(!initialized){runtime=await send('init');initialized=true;}
    // Game archives are fetched only when that game is selected and played.
    report('Emulator ready · choose a game');
    document.getElementById('siteLoadStatus').textContent='Emulator ready';
  })().catch(error=>{
    report('Emulator preparation failed: '+String(error),true);
    document.getElementById('siteLoadStatus').textContent='Emulator preparation failed';
    // Do not block explicit retry if the background initialization failed.
    warmupPromise=null;
    throw error;
  });
  return warmupPromise;
}
async function runPreview() {
  if(!documentSource) throw Error('Open a project first');
  if(state && suspended) {
    const fields=state.scope_input ? {focus_generation:state.scope_input.generation,held_sources:[]} : {};
    await rpc('project.preview_resume',fields);suspended=false;
  } else {
    // This public endpoint currently prepares a package for each uncached cue.
    // Measure it explicitly; never repeat it for each navigation input.
    for(const cue of documentSource.audio_cues || []) if(!audioBuffers.has(cue.cue_id)) {
      const data=await rpc('project.audio_audition',{cue_id:cue.cue_id,scope_host:{version:1}});
      const bytes=Uint8Array.from(atob(data.audio.wav_base64),c=>c.charCodeAt(0));
      audioBuffers.set(cue.cue_id,await audioContext.decodeAudioData(bytes.buffer));
    }
    await rpc('project.preview_reset',{scene_id:documentSource.project.entry_scene,scope_host:{version:1}});
    if(!state.scope_input) for(const cue of state.entry_events || []) play(cue);
  }
  await settle();running=true;lastTick=performance.now();scheduleTick();
}
async function input(source, generation=state?.scope_input?.generation) {
  if(!running) throw Error('Run preview first');
  await advanceClock();
  held.add(source);
  const result=await rpc('project.preview_input',{logical_source:source,...(generation===undefined?{}:{focus_generation:generation})});
  if(!state.scope_input) for(const cue of result.input?.audio_events || []) play(cue);
  await settle();held.delete(source);
  await rpc('project.preview_input',{logical_source:source,event_kind:'release',...(state.scope_input?{focus_generation:state.scope_input.generation}:{})});
  await settle();
}
function enqueue(action) {
  const next=uiQueue.then(action).finally(scheduleTick);
  uiQueue=next.catch(error=>{running=false;log(String(error));});return next;
}

// Clock handling from the supplied browser qualification runtime.
// Deadlines are relative to the last simulated instant, not RPC completion.
// Include render/worker time in the next advance; never queue catch-up ticks.
function scheduleTick() {
  clearTimeout(tickTimer);
  if (!running || document.hidden || tickPending) return;
  const delay = Math.max(1, (state?.next_update_ms ?? 100) - (performance.now()-lastTick));
  tickTimer=setTimeout(()=>{
    if (!running || document.hidden || tickPending) return;
    tickPending=true;
    enqueue(async()=>{
      if (!running) return;
      await advanceClock();
    }).finally(()=>{tickPending=false;scheduleTick();}).catch(()=>{});
  },delay);
}
async function advanceClock() {
  const now=performance.now(), elapsed=Math.floor(now-lastTick);
  if(elapsed<=0) return;
  lastTick+=elapsed;
  const result=await rpc('project.preview_advance',{elapsed_ms:elapsed});
  if(!result.scope_input) for(const event of result.timer_events || [])
    for(const cue of event.audio_events || []) play(cue);
  await settle();
}

// Integration with the approved v16 device presentation.
const realStatus = document.getElementById('realEmulatorStatus');
const playButton = document.getElementById('realStart');
const stopButton = document.getElementById('realStop');
const exampleSelect = document.getElementById('realExample');
function report(message, isError=false) {
  realStatus.textContent=message;
  realStatus.style.color=isError?'#ee9a8f':'#b6c8b8';
}
let startedName=null;
function refreshButtons(){playButton.disabled=false;stopButton.disabled=!running;}
async function startRealExample(name) {
  if (running && startedName===name) return;
  playButton.disabled=true;
  // Unlock audio synchronously from the user's click, before awaiting Pyodide.
  audioContext ||= new AudioContext();
  const audioReady=audioContext.resume();
  try {
    // Reuse background initialization, or initialize now if it has not completed.
    await warmupRuntime();
    await audioReady;
    report('Loading '+name+'…');
    if(startedName!==name || !documentSource){
      await openExample(name);
      startedName=name;
    }
    report('Starting '+name+' preview…');
    await runPreview();
    window.activatePeepOSDisplay();
    report('RUNNING · '+name);
  } catch(e) {report(String(e),true);console.error(e);}
  refreshButtons();
}
playButton.addEventListener('click',()=>startRealExample(exampleSelect.value));
stopButton.addEventListener('click',()=>{
  enqueue(async()=>{
    await stopPreview();
    window.deactivatePeepOSDisplay();
    report('Stopped');
  }).finally(refreshButtons).catch(()=>{});
});
// Original proof-of-concept uses press/release RPC transactions, not
// a persistent analog joystick. Dispatch just new edge events.
const keyMap={a:'BUTTON_A',b:'BUTTON_B'};
const directionMap={up:'JOY_UP',right:'JOY_RIGHT',down:'JOY_DOWN',left:'JOY_LEFT',
  upRight:'JOY_UP',upLeft:'JOY_UP',downRight:'JOY_DOWN',downLeft:'JOY_DOWN'};
let lastJoystick='centre', lastButtons=new Set();
window.addEventListener('peep-controls',event=>{
  if(!running || suspended || !window.PeepPresentation?.softwareVisible)return;
  const detail=event.detail;
  const newButtons=new Set(detail.buttons);
  const impulses=[];
  for(const k of newButtons) if(!lastButtons.has(k) && keyMap[k]) impulses.push(keyMap[k]);
  if(detail.joystick!==lastJoystick && directionMap[detail.joystick]) impulses.push(directionMap[detail.joystick]);
  lastJoystick=detail.joystick;
  lastButtons=newButtons;
  if(!impulses.length)return;
  const generation=state?.scope_input?.generation;
  for(const source of impulses)enqueue(()=>input(source,generation)).catch(()=>{});
});
window.addEventListener('blur',()=>{lastJoystick='centre';lastButtons.clear();});
window.addEventListener('peep-stage',()=>{lastJoystick='centre';lastButtons.clear();});
document.addEventListener('visibilitychange',()=>{if(document.hidden && running){
  enqueue(async()=>{await stopPreview();window.deactivatePeepOSDisplay();report('Paused while tab is hidden');})
  .finally(refreshButtons).catch(()=>{});
}});
window.PeepRuntime={start:startRealExample, stop:stopPreview, get running(){return running;},get state(){return state;}};
report('Emulator loads when you reach the software section');refreshButtons();
// Browsing the product should not download a Python/WASM runtime or two games.
// Warm it shortly before the software section; Play also awaits this same promise.
if ('IntersectionObserver' in window) {
  const observer=new IntersectionObserver(entries=>{
    if(!entries.some(entry=>entry.isIntersecting))return;
    observer.disconnect();
    void warmupRuntime().catch(error=>console.error('[PeepOS prewarm]',error));
  },{rootMargin:'100% 0px'});
  observer.observe(document.getElementById('info'));
}
