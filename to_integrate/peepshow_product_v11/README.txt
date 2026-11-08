Peepshow Product v11
===================
Complete site package based directly on Product v10.
Extract the entire ZIP and run start_server.bat, as before.
The browser title and local server identify Product v11.

Changes
-------
- Removed the top navigation header (including its brand and build label).
- Doubled the PeepOS section logo size, limited to the available column width
  on smaller screens. Peepshow and Peep Studio logo sizes are unchanged.
- Changed "A pebble-sized pocket adventure." to white.

Preserved
---------
All control images, logo artwork, explosion frames, geometry.json,
controls.js, presentation.js and emulator files are unchanged from v10.
Scrolling, opening snap, Inputs demo, explosion/reassembly, return-to-top,
LCD placement and emulator lifecycle have not been modified.

Launch
------
Double-click start_server.bat on Windows, or run:
  py -3 serve.py
For a specific first port to try:
  py -3 serve.py --port 8800
The server binds a free port before opening the browser. Use the address
printed in that window rather than an older open browser tab.

Emulator
--------
The existing Python/Pyodide runtime preloads after the product images.
Its initial CDN dependencies require internet access, as in v10.

Validation
----------
See TEST_RESULTS.txt for the checks performed on this visual revision.
