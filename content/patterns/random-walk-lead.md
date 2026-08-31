---
title: Random-walk lead
tags: ["melody", "generative", "random"]
source_url: https://strudel.cc/learn/random-modifiers/
created_at: 2026-09-01T00:00:17.000Z
---

```strudel
n(irand(7).segment(8)).scale("A:minor").s("square").decay(0.1).sustain(0).lpf(1500)
```
