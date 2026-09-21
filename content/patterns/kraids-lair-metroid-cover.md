---
title: Kraid's Lair - Metroid (cover)
tags: [starter, melody]
source_url: https://strudel.cc/#Ly8gQHRpdGxlIEtyYWlkJ3MgTGFpcgovLyBAYnkgSGlyb2thenUgVGFuYWthCi8vIHRyYW5zY3JpYmVkIEBieSB0endhYW4KCnNldENwbSgyMjQvMykKCiQ6bm90ZSgiPGUyQDJbYzIgZDJdKjJbZTIgZiMyIGYyIGIxXSo0QDJbZTIgYjIgYzMgYjIgYzIgZzIgYTIgYjJdKjIgZTE%2BLzgiCi5hZGQub3V0KCI8WzAgMTIgX10hMjRbMCAxMiAyNF0hMTZbMCBfIDBdITggMEA4PiIpKS5zKCJ0cmkiKQouZ2FpbiguNykuY3J1c2goNSkucG9zdGdhaW4oMS40KQouX3Njb3BlKCkKCiQ6bm90ZShgPApbPDAgMyAxIC0zPl88LTMgLTIgLTEgLTNiPl0qMTZAMgpbPDIgMCAxIDM%2BXzwtMSAtMyAtMSAwPl0qOApbWzIgLTNdKjNbMyMgMF0qM1szIC0yXSozWzMgLTEjIDEgLTEjIDQgLTEjXV0qNEAyClsxIDIgMyA0IDYgNCA4IDYgMyAyIDEgNiAxMCA4IDYgMyAyIDEgMCAyIDMgNiA3IC1dKjIKWzEwIDkgOCA3IDggOV0qNAo%2BLzhgKS5zY2FsZSgiZTQ6bWlub3IiKS5zKCJzcXIiKS5qdXgoeCA9PiB4LmxhdGUoIi4xNyIpKQouZ2FpbiguNykuY3J1c2goNCkucG9zdGdhaW4oMS4yKQouX3Njb3BlKCkKCg%3D%3D
source_author: tzwaan / Swan, after Hirokazu Tanaka
favorite: true
created_at: 2026-09-21T02:12:11.916Z
---

```strudel
// @title Kraid's Lair
// @by Hirokazu Tanaka
// transcribed @by tzwaan

setCpm(224/3)

$:note("<e2@2[c2 d2]*2[e2 f#2 f2 b1]*4@2[e2 b2 c3 b2 c2 g2 a2 b2]*2 e1>/8"
.add.out("<[0 12 _]!24[0 12 24]!16[0 _ 0]!8 0@8>")).s("tri")
.gain(.7).crush(5).postgain(1.4)
._scope()

$:note(`<
[<0 3 1 -3>_<-3 -2 -1 -3b>]*16@2
[<2 0 1 3>_<-1 -3 -1 0>]*8
[[2 -3]*3[3# 0]*3[3 -2]*3[3 -1# 1 -1# 4 -1#]]*4@2
[1 2 3 4 6 4 8 6 3 2 1 6 10 8 6 3 2 1 0 2 3 6 7 -]*2
[10 9 8 7 8 9]*4
>/8`).scale("e4:minor").s("sqr").jux(x => x.late(".17"))
.gain(.7).crush(4).postgain(1.2)
._scope()
```
