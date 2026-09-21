---
title: Lavender Town - Pokemon (cover)
tags: [starter, melody]
source_url: https://strudel.cc/#Ly8gQHRpdGxlIExhdmVuZGVyIFRvd24KLy8gQGJ5IEp1bmljaGkgTWFzdWRhCi8vIHRyYW5zY3JpYmVkIEBieSB0endhYW4KCnNldENwbSgxMjUvNCkKCiQ6IG5vdGUoImM2IGc2IGI2IGYjNiIpLnMoInB1bHNlIikuZGVjKC4xKS5kZWxheSguMykuZGVsYXlzeW5jKDEvOCkudmliKCIxOi41IikuZ2FpbiguOCkKCiQ6IG5vdGUoIjwtWzcgNyA0IDRbNyA2XVs0IDExXTEgMSA3IDcgNiA2WzExIDddWzYgMTFdPDEyIDE%2BITJdKjJAND4vNCIuYWRkKCJjNCIpKQogIC5zKCJwdWxzZSIpLnZpYigiMi41Oi4yIikuYWRzcigiMDouNzouNDouMSIpLmNsaXAoLjkzKQoKJDogbm90ZSgiPFs0IDIgMFs0IDAgLTEgNF1dITRbWzExIDcgNiAxMV0hM1s0IDcgNiAxMV1dPi80Ii5hZGQoIjxjNCE0W2M2IGM1IGM3IGM0XT4vNCIpKQoucygicHVsc2UiKS5mbSgxNSkudHJlbXN5bmMoIjI0IikudHJlbWRlcHRoKC40KS5sZm8oe3M6LjcsIGRlcDouNX0pCi53aGVuKCI8MCE0WzEhMyAwXT4vNCIsIHggPT4geC52aWIoIjg6LjIiKS50cmVtZGVwdGgoLjcpLmdhaW4oc2F3LnJhbmdlKC4zLCAuOCkuc2xvdyg0KSkpCi5maWx0ZXJXaGVuKHQ9PnQ%2BPTQpCgokOiBzKCJ3aGl0ZSoyIikuZGVjKC4xNSkuYnBmKDE1ZTIpLmdhaW4oLjcpLmJwcSgyKQo%3D
source_author: tzwaan / Swan, after Junichi Masuda
favorite: true
created_at: 2026-09-21T02:12:14.916Z
---

```strudel
// @title Lavender Town
// @by Junichi Masuda
// transcribed @by tzwaan

setCpm(125/4)

$: note("c6 g6 b6 f#6").s("pulse").dec(.1).delay(.3).delaysync(1/8).vib("1:.5").gain(.8)

$: note("<-[7 7 4 4[7 6][4 11]1 1 7 7 6 6[11 7][6 11]<12 1>!2]*2@4>/4".add("c4"))
  .s("pulse").vib("2.5:.2").adsr("0:.7:.4:.1").clip(.93)

$: note("<[4 2 0[4 0 -1 4]]!4[[11 7 6 11]!3[4 7 6 11]]>/4".add("<c4!4[c6 c5 c7 c4]>/4"))
.s("pulse").fm(15).tremsync("24").tremdepth(.4).lfo({s:.7, dep:.5})
.when("<0!4[1!3 0]>/4", x => x.vib("8:.2").tremdepth(.7).gain(saw.range(.3, .8).slow(4)))
.filterWhen(t=>t>=4)

$: s("white*2").dec(.15).bpf(15e2).gain(.7).bpq(2)
```
