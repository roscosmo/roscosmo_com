# PeepShow input demo regression

Serve the repository root (for example, `python -m http.server 8000`) and open
`/tests/peepshow-input-demo.html`. Click **Run regression tests** and keep the page
visible. No test dependencies are required.

The harness runs the actual product HTML, CSS and scripts in an iframe at
320×568, 390×844, 430×932, 844×390 and 1440×900. It checks three full demonstrations
per size, the 19-state/two-sweep sequence, all five demo buttons, loaded direction
images, neutral completion, active and multiple touches, momentum, interrupted
Up, pointer cancellation, held buttons, Stop, manual demo replacement, rearming,
leaving the section, direct input, Explore open/close and reduced motion. A final
fixture delays assembly-image loading to test a queued crossing without further
scrolling.

Touch and pointer events are synthetic; pointer capture is stubbed only in the
test. This verifies the application's event handling and scheduling, not physical
iOS/Android gesture recognition or browser chrome behavior. Game execution is not
part of this suite. The slow-loading fixture changes only its local Image loader.

The pre-fix reproduction triggered a normal demo, then touched the upper joystick
after its first Up state. Its trace was `centre → up → centre → up`, remaining Up
while held and returning to centre on release, without the two sweeps. The scroll
trigger had already consumed the demonstration. The fixed scheduler waits for
release and settled scrolling, and retries input-interrupted automatic demos.
Explicit Stop and manual demo replacement do not retry. Playback advances at most
once per animation frame, preserving step duration and order under delayed paints.

# Section heading and Projects layout regression

Serve the repository root and open `/tests/section-headings.html`, then click
**Run regression tests**. This dependency-free harness checks Projects, Tools
and Info at twenty viewport sizes from 320px to 1920px, including the layout
and heading breakpoints and a landscape phone. It compares actual SVG path
bounds: expected visible height, natural proportions, tight viewBoxes,
centering, edge clearance, no overflow, navigation and accessible page titles.

Tools and Info retain the shared 192px desktop heading and responsive cap in
`assets/css/section-heading.css`. Projects has a page-local 96px/14vw heading
so its title no longer overwhelms the project artwork. The shared file and the
Tools and Info pages are unchanged by this adjustment.

Projects also checks the enlarged 480px clickable tiles, the responsive 360px
PeepShow and 350px Dahab images, loaded artwork, original aspect ratios,
centering, captions, clear vertical separation and unchanged destinations.
The artwork remains taller than the Projects heading at every tested size.

# Animated PeepShow hero regression

Open `/tests/peepshow-logo.html` and click **Run regression tests**. The harness
uses the production page at ten widths from 320px to 1920px, including portrait
phones, a landscape phone and tablets. It checks transparency, splash contact with the visible upper shell, outer-drip
fit, repeated orientation/size changes, header/caption clearance, no horizontal overflow, the accessible hero heading, unchanged
software wordmarks, autoplay and pause/resume. It also checks eye tracking,
click/keyboard-target blinking, preserved focus, offscreen suspension, every
12 fps frame of the full drip/splash cycle, reduced motion and JavaScript-disabled
fallback. Reduced-motion startup/change tests use a controlled matchMedia fixture.
Pointer tests are synthetic and do not replace physical phone/browser testing.

The production engine and geometry in `peepshow/logo-animation.js` are copied
from `to_integrate/peepshow-logo-animation.html` without changing their default
fall time (0.42), fall distance (1) or release time (1.3). The separate production
adapter supplies a transparent canvas, stable accessible controls and lifecycle
handling. `peepshow/assets/logo-peepshow-rest.svg` is the supplied resting artwork
without its black background. Production does not reference `to_integrate`.
The staging file is intentionally left in place for the owner to clear.

The hero reserves its original logo slot and device pose, then fits and lowers
the visible animation to the upper shell. The landing baseline is 35 source
pixels below the device bounds (source y=64), accounting for its rounded top.
The test samples the actual device image alpha at all four splash centers.
The pause control sits outside the drip path and remains at least 44px wide.
