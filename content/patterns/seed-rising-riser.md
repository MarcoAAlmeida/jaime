---
title: Rising riser
tags: ["fx", "texture"]
source_url: https://strudel.cc/learn/signals/
created_at: 2026-08-30T12:00:17.000Z
---

```strudel
note("c2").s("sawtooth").lpf(perlin.range(100, 4000).slow(8)).gain(0.5)
```
