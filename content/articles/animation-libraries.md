---
title: The 10 most popular animation libraries (and why jaime uses none of them)
description: A researched popularity ranking, screenshots of each — and a concrete case where the popular answer wasn't the right one.
coverImage: /articles/animation-libraries/gsap.png
publishedAt: "2026-09-15"
tags:
  - animation
  - research
---

# The 10 most popular animation libraries

Building anything with motion on the web eventually runs into the same
question: is there a library for this, and if so, which one? Below is
a researched ranking of the ten most popular web-animation libraries
right now, roughly by real-world adoption and mindshare — then a
concrete story about why "most popular" and "right tool for this job"
turned out to be different questions for something jaime actually
needed.

## The ranking

### 1. Animate.css

![Animate.css](/articles/animation-libraries/animate-css.png)

The oldest name on this list and still the simplest: a stylesheet of
ready-made CSS animation classes (`animate__bounce`,
`animate__fadeIn`, …). No JavaScript API to learn — you add a class,
you get an animation. Its ubiquity comes from exactly that: it's the
library people reach for when they want *an* animation, not *an
animation system*.

### 2. Anime.js

![Anime.js](/articles/animation-libraries/anime-js.png)

A small, dependency-free JavaScript engine that animates CSS
properties, SVG attributes, DOM transforms, and plain JS objects
through one unified API, with timelines for sequencing multiple
animations together. Popular as the "I need real control but not a
framework" middle ground between CSS classes and a heavyweight engine.

### 3. Motion (formerly Framer Motion)

![Motion](/articles/animation-libraries/motion.png)

Framer's animation library, rebranded to Motion as it expanded past
React into a framework-agnostic core with a dedicated React layer on
top. It's the closest thing to a default choice for animating a modern
React app — declarative, gesture-aware, and tightly integrated with
component lifecycle (`AnimatePresence` for exit animations being the
feature everyone ends up relying on).

### 4. Lottie

![Lottie](/articles/animation-libraries/lottie.png)

A different category from the rest: Lottie doesn't animate your DOM,
it *renders* an animation a designer built in Adobe After Effects,
exported as JSON (via the Bodymovin plugin), natively on web, iOS,
Android, and React Native. Its popularity comes from the workflow it
unlocks — a designer ships pixel-perfect motion without an engineer
reimplementing it by hand — not from a JS animation API at all.

### 5. React Spring

![React Spring](/articles/animation-libraries/react-spring.png)

A physics-based alternative to duration-and-easing animation: instead
of "animate this over 300ms with an ease-out curve," you describe a
spring's tension and friction and let the physics decide the timing.
Popular specifically among people who find hand-tuned easing curves
never quite feel natural, and who are willing to think in spring
parameters instead.

### 6. AOS (Animate On Scroll)

![AOS](/articles/animation-libraries/aos.png)

A small, focused library that does exactly one thing: reveal elements
with a CSS animation as they scroll into view. Its entire popularity
is the one use case in its name — nobody reaches for AOS to build a
complex interactive animation, and that narrowness is the appeal.

### 7. Aceternity UI

![Aceternity UI](/articles/animation-libraries/aceternity-ui.png)

Not a library in the traditional sense — a collection of copy-paste
React + Tailwind + Motion components (spotlight effects, text reveals,
3D card tilts) in the shadcn/ui style: you don't `npm install` it, you
copy the component source into your own project and own it from there.
Its rise tracks the broader "own your components" trend replacing
"import a black-box library."

### 8. GSAP

![GSAP](/articles/animation-libraries/gsap.png)

The veteran. GreenSock's animation platform predates most of this
list, handles anything you can express as a timeline (DOM, SVG, canvas,
WebGL, arbitrary JS objects), and is framework-agnostic by design. Long
gated behind paid "Club GreenSock" plugins for its more advanced
features, it went fully free after being acquired by Webflow — a
factor in its continued relevance against newer, friendlier APIs.

### 9. Three.js

![Three.js](/articles/animation-libraries/threejs.png)

Strictly a WebGL 3D library, not an "animation library" in the DOM
sense — but it earns its place here because a huge share of the most
visually ambitious animated sites on the web are 3D scenes animated
with Three.js underneath, not 2D DOM transitions. If the brief is
"make it feel alive" rather than "transition this button," this is
often where the real work happens.

### 10. Remotion

![Remotion](/articles/animation-libraries/remotion.png)

The odd one out: Remotion uses React to define animations, then
renders them frame-by-frame to an actual video file (MP4) rather than
playing them live in a browser. It's popular for programmatic video —
data-driven video generation, personalized video at scale — a
different job entirely from anything else on this list.

## Most popular isn't the same question as right for this job

Somewhere in that research came a smaller, concrete question: jaime
wanted a character-scramble reveal effect — the "letters flicker
through random characters before settling into the real text" look.
GSAP has a purpose-built plugin for exactly this,
`ScrambleTextPlugin`. It's also, historically, a paid Club GreenSock
plugin (now bundled free since GSAP's relicense) — but even free, using
it means pulling in GSAP's core and the plugin's runtime for one
effect, on a project that otherwise has zero GSAP dependency anywhere.

The actual effect is small: pick a duration, pick a set of scramble
characters, interpolate from random noise to the real string over a
handful of animation frames, done. It doesn't need timeline
sequencing, gesture recognition, spring physics, or any of the other
machinery a general-purpose animation library brings along — those are
the things you're paying bundle size for whether or not the one effect
you need touches them. The right call for jaime wasn't "which of the
ten most popular libraries handles this" — it was recognizing that the
job was small enough to hand-roll in well under the footprint of
adding any dependency at all. "Most popular" answers "what does the
ecosystem reach for most often." It doesn't answer "what does *this*
specific, narrow job actually require" — and for a one-off effect,
those two questions can point in opposite directions.
