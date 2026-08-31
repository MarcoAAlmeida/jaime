---
title: Sine tremolo pad
tags: ["fx", "texture", "pad"]
source_url: https://strudel.cc/learn/signals/
created_at: 2026-09-01T00:00:19.000Z
---

```strudel
note("c3,e3,g3").s("sawtooth").gain(sine.range(0.2, 0.7).slow(2)).room(0.6)
```
