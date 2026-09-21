---
title: Stranger Things (Netflix Series)
tags: [starter, melody, synth]
source_url: https://strudel.cc/?jq8RmPcjADF9
source_author: eefano
favorite: true
created_at: 2026-09-21T02:11:59.916Z
---

```strudel
setcps(0.7);

p1: n("0 2 4 6 7 6 4 2")
  .scale("<c3:major>/2")
  .s("supersaw")
  .distort(0.7)
  .superimpose((x) => x.detune("<0.5>"))
  .lpenv(perlin.slow(3).range(1, 4))
  .lpf(perlin.slow(2).range(100, 2000))
  .gain(0.3);
p2: "<a1 e2>/8".clip(0.8).struct("x*8").s("supersaw").note();
// @version 1.2
```
