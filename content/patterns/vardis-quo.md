---
title: Vardis Quo
tags: [starter, melody, drums]
source_url: https://strudel.cc/#Ly8gIlZhcmRpcyBRdW8iIEBieSBNYXJpYUFyZWFkbmUKCgpzZXRjcG0oMjkpCgokOiBjYXQoCiBub3RlKCJ%2BIGY1IGU1IGY1IGQ1QDMgZjUgYzUgZjUgYjRANiIpLG4oImI0QDE2IiksCiAgICBub3RlKCJiNCBlNSBkNSBlNSBjNUAzIGU1IGI0IGU1IGE0QDYiKSxuKCJhNEAxNiIpLAogICAgbm90ZSgiYTQgZjUgZTUgZjUgZDVAMyBmNSBjNSBmNSBiNEA2IiksbigiYjRAMTYiKSwKICAgIG5vdGUoImI0IGU1IGQ1IGU1IGM1IGU1IGI0IGU1IGE0QDgiKSxuKCJhNEAxNiIpLAogICAgbm90ZSgiYTQgYTUgZzUgYTUgZjVAMyBhNSBlNSBhNSBkNUA2IiksbigiZDVAMTYiKSwKICAgIG5vdGUoImQ1IGc1IGY1IGc1IGU1QDMgZzUgZDUgZzUgYzVANiIpLG4oImM1QDE2IiksCiAgICBub3RlKCJjNSBmNSBlNSBmNSBkNUAzIGY1IGM1IGY1IGI0QDYiKSwgbigiYjRAMTYiKSwKICAgIG5vdGUoIn4gZTUgZDUgZTUgYzUgZTUgYjQgZTUgYjQgZTUgYTRANiIpLG4oImE0QDE2IikKKQouc2NhbGUoIkE0Om1pbm9yIikucygiZ21fZmx1dGUiKQogICAgLmxwcSg2KS5yb29tKDAuMzUpLmRlbGF5KDAuNCkuZGVsYXl0aW1lKDAuMzc1KQogIC5kZWxheWZlZWRiYWNrKDAuMykuZ2FpbigwLjY1KS5zbG93KDEpLmNvbG9yKCJwaW5rIikuX3BpYW5vcm9sbCgpCgoKCgokOiBjaG9yZCgiPERtIEcgQW0gW0YgQW1dPiIpCiAgICAgLmRpY3QoImlyZWFsIikKICAgICAudm9pY2luZygpCiAgICAgLnMoInN1cGVyc2F3IikKICAgICAubHBmKHNpbmUuc2xvdygzMikucmFuZ2UoODAwLCAyNDAwKSkKICAgICAucm9vbSgwLjYpCiAgICAgLmdhaW4oMC4zKS5jb2xvcigicGluayIpLl9waWFub3JvbGwoKS8vLnNsb3coMikKCgokOm5vdGUoIjxkMiBnMiBhMiBbZjIgZTJdPiIpCiAgICAgLnMoImdtX2VsZWN0cmljX2d1aXRhcl9qYXp6IikKICAgICAubHBmKDcwMDApCiAgICAgLmdhaW4oMS4xKQogICAgIC5yb29tKDAuMTUpLmRlbGF5KDAuNCkuY29sb3IoInBpbmsiKS5fcGlhbm9yb2xsKCkKCgoKJGRydW1zOgpzdGFjaygKICBzKCJiZCB%2BIGJkIH4iKS5zKCJkcjU1MF9iZCIpLmdhaW4oMC45KS5mYXN0KDIpLmxwZig1MDAwKS5vcmJpdCgwLjUpLAogIHMoIn4gbHQgfiBsdCIpLnMoImRyNTUwX2x0IikuZ2FpbigwLjc1KS5yb29tKDAuMikubHBmKDYwMDApLAogIHMoImhoKjgiKS5zKCJybTUwX2hoIikuZ2FpbigwLjUpLmZhc3QoMikubGF0ZSgwLjAxKS5scGYoKDMwMDApKQopLmNvbG9yKCJwaW5rIikuX3BpYW5vcm9sbCgpCg%3D%3D
source_author: MariaAreadne
favorite: true
created_at: 2026-09-21T02:12:08.916Z
---

```strudel
// "Vardis Quo" @by MariaAreadne


setcpm(29)

$: cat(
 note("~ f5 e5 f5 d5@3 f5 c5 f5 b4@6"),n("b4@16"),
    note("b4 e5 d5 e5 c5@3 e5 b4 e5 a4@6"),n("a4@16"),
    note("a4 f5 e5 f5 d5@3 f5 c5 f5 b4@6"),n("b4@16"),
    note("b4 e5 d5 e5 c5 e5 b4 e5 a4@8"),n("a4@16"),
    note("a4 a5 g5 a5 f5@3 a5 e5 a5 d5@6"),n("d5@16"),
    note("d5 g5 f5 g5 e5@3 g5 d5 g5 c5@6"),n("c5@16"),
    note("c5 f5 e5 f5 d5@3 f5 c5 f5 b4@6"), n("b4@16"),
    note("~ e5 d5 e5 c5 e5 b4 e5 b4 e5 a4@6"),n("a4@16")
)
.scale("A4:minor").s("gm_flute")
    .lpq(6).room(0.35).delay(0.4).delaytime(0.375)
  .delayfeedback(0.3).gain(0.65).slow(1).color("pink")._pianoroll()




$: chord("<Dm G Am [F Am]>")
     .dict("ireal")
     .voicing()
     .s("supersaw")
     .lpf(sine.slow(32).range(800, 2400))
     .room(0.6)
     .gain(0.3).color("pink")._pianoroll()//.slow(2)


$:note("<d2 g2 a2 [f2 e2]>")
     .s("gm_electric_guitar_jazz")
     .lpf(7000)
     .gain(1.1)
     .room(0.15).delay(0.4).color("pink")._pianoroll()



$drums:
stack(
  s("bd ~ bd ~").s("dr550_bd").gain(0.9).fast(2).lpf(5000).orbit(0.5),
  s("~ lt ~ lt").s("dr550_lt").gain(0.75).room(0.2).lpf(6000),
  s("hh*8").s("rm50_hh").gain(0.5).fast(2).late(0.01).lpf((3000))
).color("pink")._pianoroll()
```
