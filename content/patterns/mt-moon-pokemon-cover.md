---
title: Mt. Moon - Pokemon (cover)
tags: [starter, melody]
source_url: https://strudel.cc/#Ly8gQHRpdGxlIE10IE1vb24KLy8gQGJ5IEp1bmljaGkgTWFzdWRhCi8vIHRyYW5zY3JpYmVkIEBieSB0endhYW4KCi8vIDMyNyBjeWNsZXMKCnNldENwcygyMzYvNjApCgp2YXIgZiA9ICI8NCA0IC0gNCA1IDUgNiA2IC0gNiA3IDc%2BIgoKJDoiPDAqMTJAOTYgNEAxMiAxQDMyIDNAMTIgMio0QDMyWzIqMkA4IDJAN10qM0A5MCAtQDEyIDBAMiAwQDIzIDAqMkAxNj4iLnBpY2tSZXN0YXJ0KFsKICAiPDAgNCA4PiIsCiAgIjAgLi43LzQiLnN1YigiMCAuLjcvMzIiKSwKICAiPDQgMCA4PiIsCiAgIjExIi5zdWIoZiksCiAgZgpdKS5hZGQoIjwwITMwIDQgMSA1ITMyIDAhMzIgMTchMTIgLTEyITMyIDE3ITEyIDAhMzIgLTYhMzAgNiEzMCA1ITQyIC03ITIgMSEzIDEzITE5IDAhMTc%2BIikuYWRkKCJiMyIpLm5vdGUoKQogIC5wYW4oIjxbLjggLjUgLjJdKjJAM1suNSAuMl0%2BLzIiKQogIC5jcHMoIjwyMzZAMTA4IDIzNiAuLjE4MEAzMiAyMzZAMTg3PiIuZGl2KDYwKSkKCiQ6IjxbMEAzIDFAOCAyQDVdKjNAOTYgN0AxMiAzQDMyIDhAMTIgNEA4IDFAMTggNUA2WzRANCAxQDggNUAzXSozQDkwIDZAMzYgMCAtQDE2PiIucGlja1Jlc3RhcnQoWwogICJbNCAyXS82IiwKICAiPDAgMiA0IDggNCAyQDM%2BIiwKICAiPDAgLTFbMCAyXUA2IDAgXz4iLAogICJbNSAwXS80Ii5hZGQoIjAgLi4tNy8zMiIpLAogICI8NEA1IDJAMz4iLAogICJbNCA4XS82IiwKICAiPC04IC00IC04IC0xMCBfIC0%2BIiwKICAiMTAiLnN1YihmKSwKICBmLnN1YigxKQpdKS5hZGQoIjwwQDMyIDVAMzIgMEAxMjAgLTYhMzAgNiEzMCAzITggNCAzIDUhMjAgMEA1Mz4iKS5hZGQoImI0Iikubm90ZSgpLnYoIjQ6LjA0IikKICAuYWRzcigiMDouNTouNDouMiIpLndoZW4oIjwwITEwOCAxITMyIDAhMTg3PiIseD0%2BeC5scCgyMDAwKS5kZWMoLjIpLnN1cyguNikpCiAgLmNsaXAoLjgpCgphbGwoeD0%2BeC5zKCJwdWxzZSIpKQoKJDogbm90ZSgiPC1AOTQgMEA0IC1ANTIgMUA0IC1AMTczPiIucGlja1Jlc3RhcnQoWwogICJbPDAgMT4uLjw0IDU%2BQDUgLUAzXS8yIiwKICAiWzw1IDQ%2BLi48MSAwPkA1IC1AM10vMiIKXSkuYWRkKCJiMyIpKQo%3D
source_author: tzwaan / Swan, after Junichi Masuda
favorite: true
created_at: 2026-09-21T02:12:12.916Z
---

```strudel
// @title Mt Moon
// @by Junichi Masuda
// transcribed @by tzwaan

// 327 cycles

setCps(236/60)

var f = "<4 4 - 4 5 5 6 6 - 6 7 7>"

$:"<0*12@96 4@12 1@32 3@12 2*4@32[2*2@8 2@7]*3@90 -@12 0@2 0@23 0*2@16>".pickRestart([
  "<0 4 8>",
  "0 ..7/4".sub("0 ..7/32"),
  "<4 0 8>",
  "11".sub(f),
  f
]).add("<0!30 4 1 5!32 0!32 17!12 -12!32 17!12 0!32 -6!30 6!30 5!42 -7!2 1!3 13!19 0!17>").add("b3").note()
  .pan("<[.8 .5 .2]*2@3[.5 .2]>/2")
  .cps("<236@108 236 ..180@32 236@187>".div(60))

$:"<[0@3 1@8 2@5]*3@96 7@12 3@32 8@12 4@8 1@18 5@6[4@4 1@8 5@3]*3@90 6@36 0 -@16>".pickRestart([
  "[4 2]/6",
  "<0 2 4 8 4 2@3>",
  "<0 -1[0 2]@6 0 _>",
  "[5 0]/4".add("0 ..-7/32"),
  "<4@5 2@3>",
  "[4 8]/6",
  "<-8 -4 -8 -10 _ ->",
  "10".sub(f),
  f.sub(1)
]).add("<0@32 5@32 0@120 -6!30 6!30 3!8 4 3 5!20 0@53>").add("b4").note().v("4:.04")
  .adsr("0:.5:.4:.2").when("<0!108 1!32 0!187>",x=>x.lp(2000).dec(.2).sus(.6))
  .clip(.8)

all(x=>x.s("pulse"))

$: note("<-@94 0@4 -@52 1@4 -@173>".pickRestart([
  "[<0 1>..<4 5>@5 -@3]/2",
  "[<5 4>..<1 0>@5 -@3]/2"
]).add("b3"))
```
