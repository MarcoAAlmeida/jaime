-- Curated starter set (~20). IDs are readable slugs (seed rows);
-- user-created patterns later get nanoids.
--
-- As of add-content-authoring (Phase 5) the curated catalog is defined
-- by content/patterns/*.md and reconciled into this table on every
-- deploy — these rows are kept here only so a fresh database has a
-- catalog before the first sync runs. Do not add patterns here; add a
-- manifest file instead.

INSERT INTO patterns (id, title, code, source_url, source_author, created_at) VALUES
('seed-four-on-the-floor', 'Four on the floor', 's("bd*4, [~ hh]*4, ~ cp")', 'https://strudel.cc/workshop/first-sounds/', NULL, '2026-08-30T12:00:00.000Z'),
('seed-kick-and-clap', 'Kick and clap', 's("bd ~ ~ bd ~ ~ bd ~, ~ cp")', 'https://strudel.cc/workshop/first-sounds/', NULL, '2026-08-30T12:00:01.000Z'),
('seed-offbeat-hats', 'Off-beat hats', 's("bd sd, hh(5,8)")', 'https://strudel.cc/learn/mini-notation/', NULL, '2026-08-30T12:00:02.000Z'),
('seed-euclid-toms', 'Euclidean toms', 's("bd(3,8), ~ sd, arpy(5,8,2)")', 'https://strudel.cc/learn/factories/', NULL, '2026-08-30T12:00:03.000Z'),
('seed-garage-shuffle', 'Garage shuffle', 's("bd ~ ~ bd ~ ~ bd ~, hh*8").swingBy(1/3, 8)', 'https://strudel.cc/learn/tempo/', NULL, '2026-08-30T12:00:04.000Z'),
('seed-slow-techno', 'Slow techno', 's("bd*4, [~ hh]*4, ~ ~ oh ~").lpf(4000)', 'https://strudel.cc/examples/', NULL, '2026-08-30T12:00:05.000Z'),
('seed-amen-slice', 'Amen slice', 's("amen").chop(8).speed("1 2 1 -1").room(0.2)', 'https://github.com/terryds/awesome-strudel', NULL, '2026-08-30T12:00:06.000Z'),
('seed-glitch-stutter', 'Glitch stutter', 's("arpy*8").chop(2).speed("1 -1").sometimesBy(0.4, ply(2))', 'https://strudel.cc/learn/samples/', NULL, '2026-08-30T12:00:07.000Z'),
('seed-bass-arpeggio', 'Bass arpeggio', 'note("c2 eb2 g2 c3").s("sawtooth").lpf(600).lpq(8)', 'https://strudel.cc/workshop/first-notes/', NULL, '2026-08-30T12:00:08.000Z'),
('seed-acid-line', 'Acid line', 'note("c1*8").add(note("<0 3 5 7>")).s("sawtooth").lpf(sine.range(200, 2000).slow(4)).lpq(15).distort(0.3)', 'https://strudel.cc/learn/synths/', NULL, '2026-08-30T12:00:09.000Z'),
('seed-sine-pad', 'Sine pad', 'note("<c3 g3 a3 f3>".add("0,7,12")).s("sine").attack(1).release(3).gain(0.4).room(0.7)', 'https://strudel.cc/learn/synths/', NULL, '2026-08-30T12:00:10.000Z'),
('seed-ambient-drone', 'Ambient drone', 'note("c2,g2,c3").s("sawtooth").lpf(300).attack(4).release(8).gain(0.3).room(0.9)', 'https://strudel.cc/examples/', NULL, '2026-08-30T12:00:11.000Z'),
('seed-triangle-melody', 'Triangle melody', 'note("c4 e4 g4 b4 a4 g4").s("triangle").slow(2).delay(0.4)', 'https://strudel.cc/workshop/first-notes/', NULL, '2026-08-30T12:00:12.000Z'),
('seed-polymeter-bells', 'Polymeter bells', 'note("c5 e5 g5 b5 d6".fast("<1 2>")).s("triangle").every(4, rev)', 'https://strudel.cc/learn/polymeter/', NULL, '2026-08-30T12:00:13.000Z'),
('seed-random-walk', 'Random-walk melody', 'n(irand(8).segment(8)).scale("C:major:pentatonic").s("triangle").delay(0.3)', 'https://strudel.cc/learn/random-modifiers/', NULL, '2026-08-30T12:00:14.000Z'),
('seed-chord-stabs', 'Chord stabs', 'n("0 2 4").scale("C:minor").s("sawtooth").decay(0.1).sustain(0).lpf(1200).gain(0.7)', 'https://strudel.cc/learn/scales/', NULL, '2026-08-30T12:00:15.000Z'),
('seed-dub-chords', 'Dub chords', 'note("<Cm7 Fm7>").voicing().s("sawtooth").lpf(800).room(0.5).delay(0.5).gain(0.5)', 'https://strudel.cc/learn/chords/', NULL, '2026-08-30T12:00:16.000Z'),
('seed-rising-riser', 'Rising riser', 'note("c2").s("sawtooth").lpf(perlin.range(100, 4000).slow(8)).gain(0.5)', 'https://strudel.cc/learn/signals/', NULL, '2026-08-30T12:00:17.000Z'),
('seed-minimal-pulse', 'Minimal pulse', 'note("c3").s("square").struct("x(3,8)").decay(0.1).sustain(0).delay(0.5)', 'https://strudel.cc/learn/mini-notation/', NULL, '2026-08-30T12:00:18.000Z'),
('seed-broken-chord-piano', 'Broken-chord piano', 'n("0 2 4 2".off(0.25, add(7))).scale("C:major").s("triangle").release(0.3).room(0.4)', 'https://strudel.cc/learn/time-modifiers/', NULL, '2026-08-30T12:00:19.000Z');

INSERT INTO pattern_tags (pattern_id, tag) VALUES
('seed-four-on-the-floor', 'drums'), ('seed-four-on-the-floor', 'house'), ('seed-four-on-the-floor', 'beginner'),
('seed-kick-and-clap', 'drums'), ('seed-kick-and-clap', 'minimal'), ('seed-kick-and-clap', 'beginner'),
('seed-offbeat-hats', 'drums'), ('seed-offbeat-hats', 'euclidean'),
('seed-euclid-toms', 'drums'), ('seed-euclid-toms', 'euclidean'),
('seed-garage-shuffle', 'drums'), ('seed-garage-shuffle', 'garage'), ('seed-garage-shuffle', 'swing'),
('seed-slow-techno', 'drums'), ('seed-slow-techno', 'techno'),
('seed-amen-slice', 'breaks'), ('seed-amen-slice', 'samples'), ('seed-amen-slice', 'intermediate'),
('seed-glitch-stutter', 'glitch'), ('seed-glitch-stutter', 'samples'), ('seed-glitch-stutter', 'intermediate'),
('seed-bass-arpeggio', 'bass'), ('seed-bass-arpeggio', 'synth'), ('seed-bass-arpeggio', 'beginner'),
('seed-acid-line', 'bass'), ('seed-acid-line', 'acid'), ('seed-acid-line', '303'),
('seed-sine-pad', 'pad'), ('seed-sine-pad', 'chords'), ('seed-sine-pad', 'ambient'),
('seed-ambient-drone', 'ambient'), ('seed-ambient-drone', 'drone'), ('seed-ambient-drone', 'pad'),
('seed-triangle-melody', 'melody'), ('seed-triangle-melody', 'synth'), ('seed-triangle-melody', 'beginner'),
('seed-polymeter-bells', 'melody'), ('seed-polymeter-bells', 'polymeter'), ('seed-polymeter-bells', 'generative'),
('seed-random-walk', 'melody'), ('seed-random-walk', 'generative'),
('seed-chord-stabs', 'chords'), ('seed-chord-stabs', 'synth'),
('seed-dub-chords', 'chords'), ('seed-dub-chords', 'dub'),
('seed-rising-riser', 'fx'), ('seed-rising-riser', 'texture'),
('seed-minimal-pulse', 'minimal'), ('seed-minimal-pulse', 'synth'), ('seed-minimal-pulse', 'euclidean'),
('seed-broken-chord-piano', 'melody'), ('seed-broken-chord-piano', 'chords'), ('seed-broken-chord-piano', 'beginner');
