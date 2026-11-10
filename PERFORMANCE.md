# Performance notes

The site remains a buildless GitHub Pages site with no additional dependencies.

## Hosting and caching

GitHub Pages serves the tested HTML/images with `Cache-Control: max-age=600`,
ETag and Last-Modified. A conditional request for the device image returned 304
with no body. JavaScript responses use gzip. These are hosting response headers,
not something an HTML cache meta tag can change. A network request row may mean
cached content or a validation request rather than a full image download.
Hard reload and DevTools' Disable cache change this behavior.

Keep asset URLs stable until content changes; version changed scripts so stale
cached scripts do not mix with new markup. Longer immutable caching would need
hosting/CDN configuration not currently exposed by Pages. A service worker is
not introduced: it would add invalidation and update complexity at this stage.

## November 2026 pass

- Seven PNG assets have lossless WebP counterparts: 2,923,527 to 1,956,918
  bytes in total. Every decoded RGBA byte was verified identical. Production
  references use the relevant counterparts; source PNGs and unused prototypes
  remain available. Unit artwork is not loaded by the main routes.
- Arabian font uses WOFF (24,720 bytes) instead of the 117,348-byte TTF.
  The TTF remains a fallback. Two missing font URLs and four missing decorative
  skill-icon requests were removed.
- PeepShow's 52 assembly frames total 8,789,930 bytes. Only the already-visible
  idle frame loads at the hero; the complete sequence begins when exploring.
  Existing loading/skip/close behavior remains in place for slow connections.
- Below-fold PeepOS/PeepStudio wordmarks use native lazy loading.
- Python/WASM warms when the software section is close, not after initial image
  preload. Game archives load only when selected for Play. Baseline compressed
  Pyodide runtime resources total approximately 5.43 MB; backend and both games
  add 1.57 MB. Those downloads are no longer an automatic cost of viewing the hero.
- Removed redundant control-image preload/decode work from the assembly loader;
  the controls retain their own eager images so the visible device stays usable.

Measurements are resource-byte counts, not a Lighthouse score or a promise about
seconds saved. Browser cold/warm/hard-reload transfer measurements on the public
host were not available in the audit environment. The synthetic viewport tests
are Chromium tests, not physical iOS/Android testing.

## Validation

- 900 responsive section/project layout assertions passed.
- Static PeepShow hero passed at ten viewport sizes.
- Demand-loading assertions passed at desktop and phone viewport sizes.
- Both game selections reached RUNNING in the browser.
- The first 27 input-regression checks passed, covering repeated demos at five
  sizes, touch interruptions, cancellation, held buttons and manual controls.
- A pre-existing strict Explore scroll-return assertion reports a 5px drift
  (2940 to 2945) in this Chromium environment. The untouched baseline commit
  ac0473c reproduces the exact same result. This is not counted as a full suite
  pass or silently loosened in the checked-in test.
