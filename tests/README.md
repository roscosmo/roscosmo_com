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

# Static PeepShow hero regression

Open `/tests/peepshow-logo.html` and click **Run regression tests**. The harness
checks the restored original static PNG and hero/device composition at ten
phone, tablet, landscape and desktop sizes. It verifies the original device
fitting calculation, header/logo/device/caption clearance, accessible heading,
no horizontal overflow, no animated logo controls or script, and a stationary
logo. Device interaction coverage remains in `peepshow-input-demo.html`.

The unused animation source and resting SVG remain available for reference, but
the product page does not load them. The staging artwork remains untouched.

# Header logo scaling regression

Open `/tests/header-logo.html`. It automatically checks all five shared-header
pages at six viewport sizes (320–1440px): proportional SVG stroke, 1–2px
rendered outline, home-link destination and header viewport clearance. The fixed
5.59 screen-pixel outline formerly crowded the small logo's central details.
The replacement scales from the main mark's 5.59px edge at a 500px design width;
landing and index artwork, letter animation and eye interactions are unchanged.

# Consistent header motion

Open `/tests/header-motion.html`. Four isolated fixtures exercise the actual
shared script at desktop/mobile widths with both motion preferences. The test
samples rendered path and pupil bounding rectangles over time, rather than only
checking transform strings. The header now intentionally matches site.html's
always-animated logo; other reduced-motion rules remain unchanged.

# Performance and demand loading

Open `/tests/performance.html` and run the checks. At 390×844 and 1440×900,
this checks that the initial hero requests only its idle frame, not the complete
assembly sequence or emulator worker/game archives. Scrolling into the product
must load all assembly frames. The resource byte count is informational: cached
resources can report zero, and it is not an internet-speed benchmark.

Assembly assets now start on the first scroll (including restored/deep-link
positions), with an explicit loading gate for early Explore clicks. The input
regression starts exploring before waiting for assembly readiness. The static
hero regression only waits for its own artwork and presentation, since opening
the page intentionally no longer loads the entire animation.

The lossless WebP logos retain the original dimensions and decoded pixels.
Original PNG sources are kept. PeepShow's Python runtime warms near the software
section; each game archive is fetched only on Play and reused during that visit.
Check both Dungeon and Virtual pet, stopping between them, after runtime changes.

# Button-driven assembly on every screen

Open `/tests/peepshow-assembly.html` and run the checks. Six sizes from
320×568 to 1920×1080 verify that crossing the assembly section never opens or
locks it, reading wheel events remain native, and Explore is visible. The
suite checks complete opening/reassembly, artwork bounds, inert background,
Tab/Escape, early and repeated close, focus and scroll restoration, repeat
opening, delayed images and direct software-section links. The existing hero
snap remains; the rest of desktop reading uses native wheel/trackpad scrolling.
Only an explicit Explore action locks the page while the dialog is open.

Tests use synthetic events in real iframe layouts, not physical-device gestures.

# Ink-burst Explore invitation

The assembly suite checks the bespoke orange/ivory burst illustration, its
responsive WebP sources and successful loading, whole-button click target,
live text, decorative-image accessibility and dialog semantics across six sizes.
The illustration shows no hardware, preserving the animation reveal. Its open
negative space and line-art treatment match the page's palette rather than a
filled comic badge. Hover and focus move only the illustration slightly;
reduced-motion visitors get a static treatment. Use
`/tests/peepshow-explore-preview.html` for desktop/mobile visual review.
