---
title: Radiohead - Everything in its right place
tags: [starter, melody, drums]
source_url: https://strudel.cc/#c2V0Y3BtKDEyMCkKCi8vIE1FTE9EWSArIFZJU1VBTElaRVIKbGV0IG1lbG9keSA9IAogIG5vdGUoIjxbYyBhYl0gW2cgY10gW2ZiLCBnLCBjLCBjXSBbZmIsIGcsIGMsIGMsIGNdIFtmYiwgZywgYywgYyxjXSBbZiwgZywgYywgZGIsIGRiXSBbZiwgZywgYywgZGIsIGRiXSBbZWIsIGcsIGNdIFtlYiwgZywgY10%2BIikKICAuc291bmQoInBpYW5vIikKCi8vIERSVU1TCmxldCBkcnVtcyA9IAogIHNvdW5kKCJiZCB%2BIikKICAuYmFuaygiUm9sYW5kVFI5MDkiKQoKLy8gRk0gU1lOVEggTEFZRVIgKyBWSVNVQUxJWkVSCmxldCBmbUxheWVyID0gCiAgbm90ZSgiPFtjIGFiXSBbZyBjXT4iKQogIC5mbSgiPDAgMSAyIDg%2BIikKICAuZ2FpbigwLjYpCgovLyBTVEFDSyBUSEVNCnN0YWNrKAogIG1lbG9keSwKICBkcnVtcywKICBmbUxheWVyCikuX3B1bmNoY2FyZCgpCg%3D%3D
source_author: codester
favorite: true
created_at: 2026-09-21T02:12:06.916Z
---

```strudel
setcpm(120)

// MELODY + VISUALIZER
let melody = 
  note("<[c ab] [g c] [fb, g, c, c] [fb, g, c, c, c] [fb, g, c, c,c] [f, g, c, db, db] [f, g, c, db, db] [eb, g, c] [eb, g, c]>")
  .sound("piano")

// DRUMS
let drums = 
  sound("bd ~")
  .bank("RolandTR909")

// FM SYNTH LAYER + VISUALIZER
let fmLayer = 
  note("<[c ab] [g c]>")
  .fm("<0 1 2 8>")
  .gain(0.6)

// STACK THEM
stack(
  melody,
  drums,
  fmLayer
)._punchcard()
```
