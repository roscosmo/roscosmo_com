(() => {
  const pages = ['projects', 'tools', 'info'];
  const sizes = [[320,568], [375,812], [390,844], [430,932], [600,900],
    [601,900], [720,900], [721,900], [768,1024], [844,390], [1024,768], [1440,900]];
  const load = (page, width, height) => new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.className = 'fixture';
    frame.width = width;
    frame.height = height;
    const timeout = setTimeout(() => { frame.remove(); reject(new Error(`Timed out loading ${page}`)); }, 15000);
    frame.onload = () => { clearTimeout(timeout); resolve(frame); };
    frame.src = `../${page}.html`;
    document.body.append(frame);
  });
  const near = (a, b, tolerance = .2) => Math.abs(a - b) <= tolerance;
  const bounds = svg => {
    const rects = [...svg.querySelectorAll('path')].map(path => path.getBoundingClientRect());
    const left = Math.min(...rects.map(r => r.left));
    const top = Math.min(...rects.map(r => r.top));
    const right = Math.max(...rects.map(r => r.right));
    const bottom = Math.max(...rects.map(r => r.bottom));
    return { left, top, right, bottom, width:right-left, height:bottom-top };
  };
  document.querySelector('#run').onclick = async event => {
    const button = event.currentTarget;
    const output = document.querySelector('#results');
    const results = [], measurements = [];
    button.disabled = true;
    const check = (ok, label) => results.push(`${ok ? 'PASS' : 'FAIL'} ${label}`);
    try {
      for (const [width, height] of sizes) {
        output.textContent = `Checking ${width}×${height}…`;
        const frames = [];
        try {
          for (const page of pages) frames.push(await load(page, width, height));
          await new Promise(requestAnimationFrame);
          const artwork = [];
          frames.forEach((frame, index) => {
            const doc = frame.contentDocument, win = frame.contentWindow;
            const label = `${width}×${height} ${pages[index]}`;
            const svg = doc.querySelector('.section-heading svg');
            const box = bounds(svg), raw = svg.getBBox(), view = svg.viewBox.baseVal;
            artwork.push(box);
            check(raw.x >= view.x-.01 && raw.y >= view.y-.01 &&
              raw.x+raw.width <= view.x+view.width+.01 && raw.y+raw.height <= view.y+view.height+.01,
              `${label}: viewBox contains the artwork`);
            check(near(box.height, parseFloat(win.getComputedStyle(svg).height)), `${label}: CSS size matches visible art`);
            check(near(box.width/box.height, raw.width/raw.height, .003), `${label}: natural proportions preserved`);
            check(box.left >= 0 && box.right <= doc.documentElement.clientWidth &&
              doc.documentElement.scrollWidth <= win.innerWidth, `${label}: no horizontal clipping or overflow`);
            const body = doc.body.getBoundingClientRect();
            check(near((box.left+box.right)/2, (body.left+body.right)/2), `${label}: artwork centered`);
            const header = doc.querySelector('.site-head').getBoundingClientRect();
            const brand = doc.querySelector('.brand-link').getBoundingClientRect();
            const nav = doc.querySelector('.site-nav').getBoundingClientRect();
            check(header.bottom <= box.top && brand.right <= nav.left && nav.right <= win.innerWidth,
              `${label}: header and navigation do not overlap`);
            const links = [...doc.querySelectorAll('.site-nav a')];
            check(links.map(a=>a.textContent).join('|') === 'PROJECTS|TOOLS|INFO' &&
              links.map(a=>a.getAttribute('href')).join('|') === 'projects.html|tools.html|info.html' &&
              links[index].getAttribute('aria-current') === 'page', `${label}: navigation unchanged`);
            const h1 = doc.querySelector('main h1');
            check(doc.querySelectorAll('main h1').length === 1 &&
              ((h1.querySelector('.sr-only')?.textContent || h1.textContent).trim().toLowerCase() === pages[index] ||
               h1.querySelector(`svg[aria-label="${pages[index].toUpperCase()}"]`)), `${label}: accessible page heading`);
          });
          check(artwork.every(a=>near(a.height,artwork[0].height)), `${width}×${height}: equal visible letter heights`);
          check(artwork.every(a=>near(a.top,artwork[0].top)), `${width}×${height}: aligned visible title tops`);
          measurements.push(`${width}×${height}: ${artwork.map((a,i)=>`${pages[i]} ${a.height.toFixed(2)}px`).join(', ')}`);
        } finally { frames.forEach(frame=>frame.remove()); }
      }
      const passed = results.filter(r=>r.startsWith('PASS')).length;
      output.textContent = `${passed}/${results.length} checks passed.\n\n${measurements.join('\n')}\n\n${results.join('\n')}`;
      document.body.dataset.result = passed === results.length ? 'pass' : 'fail';
    } catch (error) {
      output.textContent = `ERROR: ${error.message}\n${results.join('\n')}`;
      document.body.dataset.result = 'error';
    } finally { button.disabled = false; }
  };
})();
