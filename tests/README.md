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

# Section heading regression

Serve the repository root and open `/tests/section-headings.html`, then click
**Run regression tests**. This dependency-free harness checks Projects, Tools
and Info at eighteen viewport sizes from 320px to 1920px, including either side
of the mobile layout breakpoints, the heading's full-size breakpoint, and a
landscape phone. It compares the actual
SVG path bounds, not just the image boxes: equal visible letter heights and top
positions, natural proportions, tight viewBoxes, centering, no overflow, clear
header/navigation separation, active navigation and accessible page titles.

The three page titles share `assets/css/section-heading.css`. Keep their
viewBoxes fitted to the visible path bounds when replacing the artwork, and
let the shared height determine each word's natural width.

The headings target 192px visible letter height, three times their original
64px desktop height. On narrower screens all three use the same height cap,
`(100vw - 44px) / 5.44`, based on Projects' widest aspect ratio, leaving at
least 22px on either side. This reaches the full 192px at 1089px layout width
(1104px browser width with a 15px stable scrollbar gutter).
The harness also checks that expected size and edge clearance at every width.
