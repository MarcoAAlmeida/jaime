---
title: Pentatonic bells
tags: ["melody", "generative"]
source_url: https://strudel.cc/learn/tonal/
created_at: 2026-09-01T00:00:15.000Z
---

```strudel
n("0 2 4 5 7 4 2 0").scale("C:major:pentatonic").s("triangle").fast(2).gain(0.6).delay(0.5).every(3, rev)
```
