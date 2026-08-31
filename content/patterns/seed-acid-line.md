---
title: Acid line
tags: ["bass", "acid", "303"]
source_url: https://strudel.cc/learn/synths/
created_at: 2026-08-30T12:00:09.000Z
---

```strudel
note("c1*8").add(note("<0 3 5 7>")).s("sawtooth").lpf(sine.range(200, 2000).slow(4)).lpq(15).distort(0.3)
```
