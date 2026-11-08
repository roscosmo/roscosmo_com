// Shared header eye and letter animation, preserved from Info.
(() => {
  'use strict';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Locked to the final tuning screenshot: quiver 160%, edge 160%,
  // outline 66%, eye 100%, max logo width 500px.
  const QUIVER = 1.60;
  const DESIGN_WIDTH = 500;
  const EYE_REACH = 1.00;
  const EDGE_DEFINITION = 1.60;
  const svg = document.getElementById('roscosmo');
  const pupil = document.getElementById('pupil');
  const blinkTop = document.getElementById('blinkTop');
  const blinkBottom = document.getElementById('blinkBottom');
  const edge = document.getElementById('edgeGradient');
  const ink = document.getElementById('inkGradient');
  const glints = Array.from(svg.querySelectorAll('.glint'));
  const parts = Array.from(svg.querySelectorAll('.letter'));
  const eyeCenter = {x: 671, y: 392};
  const pupilBase = {x: -27, y: 17};
  const eyeLimit = {x: 23, y: 19};
  const bounds = parts.map((element, i) => {
    const bb = element.getBBox();
    return {element, x: bb.x + bb.width / 2, y: bb.y + bb.height / 2, i, seed: i * .83 + .44};
  });
  let pointerPresent = false, lastPointer = -1e6, mouseX = 0, mouseY = 0;
  let lookX = 0, lookY = 0, wanderX = 0, wanderY = 0, nextWander = 0;
  let nextBlink = 6, blinkStart = -1, firstT = null, lastT = 0;
  let lastPoke = -Infinity;

  // Poked eye: close promptly, stay closed for a beat, reopen slowly,
  // then make a small startled after-blink. Ordinary idle blinking is unchanged.
  const POKE_DURATION = 1.30;
  function smoothstep(u) {
    const x = Math.max(0, Math.min(1, u));
    return x * x * (3 - 2 * x);
  }
  function pokeClosure(age) {
    if (age < 0 || age >= POKE_DURATION) return 0;
    if (age < .07) return smoothstep(age / .07);             // fast reaction
    if (age < .59) return 1;                                 // closed for 520 ms
    if (age < .82) return 1 - smoothstep((age - .59) / .23);  // slower reopening
    if (age < .99) return 0;                                 // tiny surprised pause
    if (age < 1.055) return .40 * smoothstep((age - .99) / .065);
    if (age < 1.13) return .40;
    return .40 * (1 - smoothstep((age - 1.13) / .17));
  }
  function pokeEye() {
    lastPoke = performance.now() * .001;
    blinkStart = -1; // The deliberate reaction takes priority over idle blinking.
    nextBlink = lastT + 4 + Math.random() * 6;
  }

  // Existing SVG face details still use the chosen monochrome highlights.
  document.documentElement.style.setProperty('--edge', String(Math.min(1, .16 + EDGE_DEFINITION * .68)));
  document.documentElement.style.setProperty('--shine', String(Math.min(1, .18 + EDGE_DEFINITION * .62)));
  document.documentElement.classList.add('js-active');

  function clampEye(x, y) {
    const n = x * x / (eyeLimit.x * eyeLimit.x) + y * y / (eyeLimit.y * eyeLimit.y);
    if (n <= 1) return {x, y};
    const k = 1 / Math.sqrt(n);
    return {x: x * k, y: y * k};
  }

  // One coordinate conversion for desktop pointer events and mobile touches.
  // Use SVG-local coordinates so tracking follows the displayed logo at any size.
  function trackAt(clientX, clientY) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const p = svg.createSVGPoint();
    p.x = clientX; p.y = clientY;
    const local = p.matrixTransform(matrix.inverse());
    const dx = local.x - eyeCenter.x, dy = local.y - eyeCenter.y;
    const len = Math.hypot(dx, dy);
    const reach = Math.min(len / 160, 1);
    mouseX = len ? dx / len * eyeLimit.x * reach : 0;
    mouseY = len ? dy / len * eyeLimit.y * reach : 0;
    lastPointer = performance.now() * .001;
    pointerPresent = true;
  }

  // Mouse and pen movement: retain the existing desktop behaviour.
  window.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' || touchActive) return;
    trackAt(e.clientX, e.clientY);
  }, {passive: true});
  window.addEventListener('pointerleave', () => {
    if (!touchActive) pointerPresent = false;
  }, {passive: true});
  window.addEventListener('blur', () => {
    touchActive = false;
    activeTouchId = null;
    pointerPresent = false;
  });

  // A pan-y gesture may cancel Pointer Events when the browser takes over
  // scrolling. Passive Touch Events continue reporting finger movement,
  // without calling preventDefault() or blocking page scrolling.
  let touchActive = false;
  let activeTouchId = null;
  let touchOriginX = 0, touchOriginY = 0;
  let suppressDragClick = false;

  function trackedTouch(touchList) {
    for (let i = 0; i < touchList.length; i++) {
      if (touchList[i].identifier === activeTouchId) return touchList[i];
    }
    return null;
  }

  window.addEventListener('touchstart', e => {
    if (touchActive || e.changedTouches.length === 0) return;
    const touch = e.changedTouches[0];
    activeTouchId = touch.identifier;
    touchActive = true;
    suppressDragClick = false;
    touchOriginX = touch.clientX;
    touchOriginY = touch.clientY;
    trackAt(touch.clientX, touch.clientY);
  }, {passive: true});

  window.addEventListener('touchmove', e => {
    if (!touchActive) return;
    const touch = trackedTouch(e.touches);
    if (!touch) return;
    trackAt(touch.clientX, touch.clientY);
    if (Math.hypot(touch.clientX - touchOriginX,
                   touch.clientY - touchOriginY) > 10) {
      suppressDragClick = true;
    }
  }, {passive: true});

  function finishTouch(e) {
    if (!touchActive || !trackedTouch(e.changedTouches)) return;
    touchActive = false;
    activeTouchId = null;
    pointerPresent = false; // Resume natural wandering on release.
  }
  window.addEventListener('touchend', finishTouch, {passive: true});
  window.addEventListener('touchcancel', finishTouch, {passive: true});

  // The company mark returns to the index; the eye remains a poke target.
  svg.addEventListener('click', e => {
    if (suppressDragClick) {
      e.preventDefault();
      suppressDragClick = false;
      return;
    }
    if (e.target instanceof Element && e.target.closest('#eyeArtwork')) { e.preventDefault(); pokeEye(); }
  });

  function tick(ms) {
    if (firstT === null) firstT = ms;
    const t = (ms - firstT) * .001;
    const dt = Math.min(.05, Math.max(0, t - lastT));
    lastT = t;
    const tracking = pointerPresent && ms * .001 - lastPointer < 3;

    if (t >= nextWander) {
      const theta = Math.random() * Math.PI * 2;
      const radius = 4 + Math.random() * 6;
      wanderX = Math.cos(theta) * radius;
      wanderY = Math.sin(theta) * radius * .78;
      nextWander = t + 1.6 + Math.random() * 2.8;
    }
    const destX = tracking ? mouseX : wanderX;
    const destY = tracking ? mouseY : wanderY;
    const alpha = 1 - Math.exp(-dt * (tracking ? 10 : 2.6));
    lookX += (destX - lookX) * alpha;
    lookY += (destY - lookY) * alpha;
    const clamped = clampEye(lookX * EYE_REACH, lookY * EYE_REACH);
    lookX = clamped.x / Math.max(EYE_REACH, .001);
    lookY = clamped.y / Math.max(EYE_REACH, .001);
    pupil.setAttribute('transform', `translate(${(pupilBase.x + clamped.x).toFixed(2)} ${(pupilBase.y + clamped.y).toFixed(2)})`);

    // Masking eyelids never resize or translate the eyeball.
    const pokeAge = ms * .001 - lastPoke;
    const poking = pokeAge >= 0 && pokeAge < POKE_DURATION;
    let closure = 0;
    if (poking) {
      closure = pokeClosure(pokeAge);
    } else {
      if (t >= nextBlink && blinkStart < 0) blinkStart = t;
      if (blinkStart >= 0) {
        const u = (t - blinkStart) / .24;
        if (u >= 1) {blinkStart = -1; nextBlink = t + 4 + Math.random() * 6;}
        else closure = Math.sin(Math.PI * Math.max(0, u));
      }
    }
    const cover = 97 * closure;
    blinkTop.setAttribute('height', cover.toFixed(2));
    blinkBottom.setAttribute('y', (490 - cover).toFixed(2));
    blinkBottom.setAttribute('height', cover.toFixed(2));

    for (const {element, x, y, i, seed} of bounds) {
      const p1 = Math.sin(t * (.55 + i * .023) + seed);
      const p2 = Math.sin(t * (.81 + i * .035) + seed * 2.43);
      const p3 = Math.sin(t * (.37 + i * .017) + seed * .7);
      const renderedWidth = Math.max(150, svg.getBoundingClientRect().width);
      const amount = QUIVER * DESIGN_WIDTH / renderedWidth * (i >= 11 ? 1.15 : 1);
      const dx = amount * (2.3 * p1 + .55 * p3);
      const dy = amount * (2.0 * p2 + .45 * p1);
      const sx = 1 + amount * (.0032 * p1 + .0012 * p3);
      const sy = 1 + amount * (.0038 * p2 - .0010 * p1);
      const angle = amount * (.28 * p2 + .10 * p3);
      element.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle.toFixed(2)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(${-x.toFixed(2)} ${-y.toFixed(2)})`);
    }
    edge.setAttribute('gradientTransform', `translate(${(42 * Math.sin(t * .18)).toFixed(2)} 0)`);
    ink.setAttribute('gradientTransform', `translate(${(18 * Math.sin(t * .14)).toFixed(2)} 0)`);
    for (let i = 0; i < glints.length; i++) {
      const pulse = .72 + .28 * (.5 + .5 * Math.sin(t * (.9 + .03 * i) + i * 1.48));
      glints[i].style.opacity = (pulse * (.20 + EDGE_DEFINITION * .55)).toFixed(3);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
