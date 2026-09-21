---
title: New Order - Blue Monday (cover / remix)
tags: [starter, electro, drums]
source_url: https://strudel.cc/#LyoKICBAdGl0bGUgTmV3IE9yZGVyIC0gQmx1ZSBNb25kYXkgKGNvdmVyIC8gcmVtaXgpCiAgQGJ5IExld2lzCiovCgpzZXRjcG0oMTMwLzQpCgpjb25zdCBraWNrMSA9IHNvdW5kKCI8W2JkIGJkIFtiZCo0XSBbYmQqNF1dIFtiZCo0XT4iKS5iYW5rKCJsaW5uIikuZGVjYXkoMC4xNSkKY29uc3Qga2ljazIgPSBzb3VuZCgiW2JkKjRdIikuYmFuaygibGlubiIpLmRlY2F5KC4xNSkKCmNvbnN0IGhhdHMxID0gc291bmQoIltvaCBvaCoyXSo0IikuYmFuaygiZG14IikuZGVjYXkoLjEpLmdhaW4oLjEyKQpjb25zdCBoYXRzMiA9IHNvdW5kKCJbLSBvaF0qNCIpLmJhbmsoImRteCIpLmRlY2F5KC4yKS5zdXN0YWluKDAuMSkuZ2FpbiguMTIpCgpjb25zdCBzbmFyZSA9IHN0YWNrKAogIHNvdW5kKCJbLSBzZF0qMiIpLmJhbmsoImxpbm4iKS5nYWluKC41KSwKICBzb3VuZCgiWy0gY3BdKjIiKS5iYW5rKCJsaW5uIikuZ2FpbiguMSkKKQoKY29uc3QgZHJ1bXMxID0gc3RhY2soa2ljazEsaGF0czEsc25hcmUpCmNvbnN0IGRydW1zMiA9IHN0YWNrKGtpY2syLGhhdHMyLHNuYXJlKQoKY29uc3QgZHJ1bXMzID0gc3RhY2soCiAgc291bmQoImJkIGJkIGJkIGJkIC0iKS5iYW5rKCJsaW5uIikuZGVjYXkoMC4xNSksCiAgc291bmQoIm9oIG9oIG9oIG9oIC0iKS5iYW5rKCJkbXgiKS5kZWNheSgwLjIpLnN1c3RhaW4oMC4xKS5nYWluKDAuMikKKQoKY29uc3QgYmFzczEgPSBzdGFjaygKICBub3RlKCI8PFtmMSBmMioyXSoyIFtnMSBnMioyXSoyPiBbYzEgYzIqMl0qMiBbZDEgZDIqMl0qMiBbZDEgZDIqMl0qMj4qMiIpLAopLnNvdW5kKCI8c2luZSwgZ21fc3ludGhfYmFzc18xPiIpLmRlY2F5KC4yKS5zdXN0YWluKC4xKQoKY29uc3QgYmFzczIgPSBzdGFjaygKICBub3RlKCI8PFtmMSBmMl0qMiBbZzEgZzJdKjI%2BIFtjMSBjMl0qMiBbZDEgZDJdKjIgW2QxIGQyXSoyPioyIiksCikuc291bmQoIjxzaW5lLCBnbV9zeW50aF9iYXNzXzE%2BIikuZGVjYXkoLjIpLnN1c3RhaW4oLjQpCgpjb25zdCBzeW50aCA9IHN0YWNrKAogIG4oIjxbWzIgfl0gWzIgfl0gMiAzXSBbWzMgfl0gWzMgfl0gMyAzXT5ANCBbLTEgfl0gLTEgLTEgWzAgfl0gMCAwIFswIH5dIDAgMCBbMCB%2BXSAwIDAiKSwKKS5zb3VuZCgiPGdtX2xlYWRfMl9zYXd0b290aD4iKS5zbG93KDIpLnNjYWxlKCJkNDptaW5vciIpLmF0dGFjayguMDUpLmhwZigiPDEwMDAgMjAwMD4qMTIiKS5nYWluKCIuNCIpCgpzdGFjaygKICBhcnJhbmdlKFsxNixraWNrMV0sWzE2LGRydW1zMV0sWzIsZHJ1bXMzXSxbMTYsZHJ1bXMyXSxbMSxzaWxlbmNlXSkucm9vbSgwLjEpLAogIGFycmFuZ2UoWzgsc2lsZW5jZV0sWzI0LHN5bnRoXSxbMTksc2lsZW5jZV0pLnJvb20oMC4wNSksCiAgYXJyYW5nZShbMTYsc2lsZW5jZV0sWzE2LGJhc3MxXSxbMixzaWxlbmNlXSxbMTYsYmFzczJdLFsxLHNpbGVuY2VdKQogICkuX3BpYW5vcm9sbCgp
source_author: Lewis
favorite: true
created_at: 2026-09-21T01:11:45.102Z
---

```strudel
/*
  @title New Order - Blue Monday (cover / remix)
  @by Lewis
*/

setcpm(130/4)

const kick1 = sound("<[bd bd [bd*4] [bd*4]] [bd*4]>").bank("linn").decay(0.15)
const kick2 = sound("[bd*4]").bank("linn").decay(.15)

const hats1 = sound("[oh oh*2]*4").bank("dmx").decay(.1).gain(.12)
const hats2 = sound("[- oh]*4").bank("dmx").decay(.2).sustain(0.1).gain(.12)

const snare = stack(
  sound("[- sd]*2").bank("linn").gain(.5),
  sound("[- cp]*2").bank("linn").gain(.1)
)

const drums1 = stack(kick1,hats1,snare)
const drums2 = stack(kick2,hats2,snare)

const drums3 = stack(
  sound("bd bd bd bd -").bank("linn").decay(0.15),
  sound("oh oh oh oh -").bank("dmx").decay(0.2).sustain(0.1).gain(0.2)
)

const bass1 = stack(
  note("<<[f1 f2*2]*2 [g1 g2*2]*2> [c1 c2*2]*2 [d1 d2*2]*2 [d1 d2*2]*2>*2"),
).sound("<sine, gm_synth_bass_1>").decay(.2).sustain(.1)

const bass2 = stack(
  note("<<[f1 f2]*2 [g1 g2]*2> [c1 c2]*2 [d1 d2]*2 [d1 d2]*2>*2"),
).sound("<sine, gm_synth_bass_1>").decay(.2).sustain(.4)

const synth = stack(
  n("<[[2 ~] [2 ~] 2 3] [[3 ~] [3 ~] 3 3]>@4 [-1 ~] -1 -1 [0 ~] 0 0 [0 ~] 0 0 [0 ~] 0 0"),
).sound("<gm_lead_2_sawtooth>").slow(2).scale("d4:minor").attack(.05).hpf("<1000 2000>*12").gain(".4")

stack(
  arrange([16,kick1],[16,drums1],[2,drums3],[16,drums2],[1,silence]).room(0.1),
  arrange([8,silence],[24,synth],[19,silence]).room(0.05),
  arrange([16,silence],[16,bass1],[2,silence],[16,bass2],[1,silence])
  )._pianoroll()
```
