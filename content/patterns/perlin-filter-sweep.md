---
title: Perlin filter sweep
tags: ["fx", "texture"]
source_url: https://strudel.cc/learn/signals/
created_at: 2026-09-01T00:00:18.000Z
---

```strudel
note("c2").s("sawtooth").lpf(perlin.range(200, 3000).slow(6)).lpq(8).gain(0.5)
```
