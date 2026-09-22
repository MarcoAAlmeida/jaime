# jah-eval Specification

## Purpose

Measures how good `@jah`'s answers are, so that every later change to
`@jah` can be judged against a number instead of an opinion. It is a
developer workflow, not a product feature: a committed set of cases is sent
to `@jah`'s model, the replies are scored without any model — code is judged
by actually evaluating it — and the result is a report that can be compared
with a committed baseline.

## Requirements

### Requirement: The Case Set Is Committed And Has Three Kinds

The workflow SHALL keep its cases in the repository, in a documented,
human-readable format, so that they are reviewed and versioned like code.
Every case SHALL be one of three kinds: a **docs** case (a question about
Strudel), a **fix** case (broken Strudel code together with the error a user
would see), or a **compose** case (a request to write a piece). Every case
SHALL have an identifier that is unique across the whole set and the message
a user would send to `@jah`.

#### Scenario: A docs case asks a question and names what a good answer mentions
- **WHEN** a docs case is defined
- **THEN** it carries the question and the Strudel function names a correct
  answer is expected to mention, and may say whether the answer must contain
  code

#### Scenario: A fix case carries the broken code and its error
- **WHEN** a fix case is defined
- **THEN** it carries the broken code, the error message a user would see
  when evaluating it, and any fragments of the code that a correct fix must
  keep

#### Scenario: A compose case states checkable constraints
- **WHEN** a compose case is defined
- **THEN** it carries the request and constraints that can be checked
  mechanically, such as names the piece must use, names it must not use, and
  a minimum amount of musical events

### Requirement: A Malformed Case Set Is Refused Before Anything Runs

The workflow SHALL check the whole case set before a run and refuse to
proceed, naming every problem, when a case is missing a required field, has an
unknown kind, or shares its identifier with another case. Nothing SHALL be
sent to any model while the set is malformed.

#### Scenario: Two cases share an identifier
- **WHEN** two cases in the set have the same identifier
- **THEN** the run stops before contacting any model and reports the
  duplicate

#### Scenario: A case is missing what its kind requires
- **WHEN** a fix case has no broken code, or a docs case has no expected
  function names
- **THEN** the run stops before contacting any model and reports which case
  and which field

### Requirement: Every Fix Case's Broken Code Really Fails

The workflow SHALL provide a validation mode that evaluates each fix case's
broken code and reports every case whose code does not fail. A fix case whose
code evaluates cleanly SHALL be reported as invalid, because a fix for code
that is not broken measures nothing.

#### Scenario: A genuinely broken case is accepted
- **WHEN** validation evaluates a fix case whose code raises an error or asks
  for a sound the app does not load
- **THEN** the case is reported as valid

#### Scenario: A case that is not actually broken is reported
- **WHEN** validation evaluates a fix case whose code evaluates cleanly
- **THEN** the case is reported as invalid, naming it, and validation as a
  whole reports failure

### Requirement: A Run Puts Each Case To `@jah`'s Model As A User Would

A run SHALL send each case's message to the same model, with the same system
prompt, that `@jah` uses to reply in the Composition Room, and SHALL take
several samples of each case because a model's answers vary. A case that
carries code or an error SHALL have them included in the message text, because
today's `@jah` receives nothing else. A run SHALL NOT be recorded in the
production usage audit and SHALL NOT count toward any user's or the global
daily reply caps. A run SHALL state clearly, and make no model calls, when the
developer's Workers AI access is unavailable.

#### Scenario: Several samples per case
- **WHEN** a run is started with a sample count
- **THEN** each case is sent that many times and every reply is scored
  separately

#### Scenario: A run is invisible to production accounting
- **WHEN** a run completes
- **THEN** no usage record has been written for it and no daily cap has been
  consumed

#### Scenario: No model access
- **WHEN** a run is started and the developer's Workers AI access is missing
- **THEN** it reports that plainly and exits without a report

### Requirement: A Failed Model Call Does Not Abort The Run

When a model call fails, the run SHALL record that sample as errored, with the
reason, and SHALL continue with the remaining cases. Errored samples SHALL be
counted and shown in the report, never treated as passes and never silently
dropped.

#### Scenario: One call fails
- **WHEN** the model call for one sample of one case fails
- **THEN** that sample is recorded as errored with the reason, the rest of
  the run completes, and the report shows the error count

### Requirement: Replies Are Scored Without A Model

Scoring SHALL be a deterministic function of the case, the reply and the
outcome of evaluating the reply's code: the same inputs always give the same
score. Scoring SHALL NOT call any model, and SHALL be exercisable in
automated tests with recorded replies and no network access. In addition to
the per-kind checks, every reply SHALL be scored for the formatting measures
the earlier prompt-comparison tool reports: whether it contains a code fence,
whether a fence is labelled as Strudel with balanced brackets and quotes,
whether the chat would still make a card from it, whether it uses a sound the
app does not load by default without loading it, and whether it invents a
sample pack that does not exist.

#### Scenario: The same reply scores the same twice
- **WHEN** the same reply to the same case is scored twice with the same
  evaluation outcome
- **THEN** the two scores are identical

#### Scenario: Scoring runs in tests without a model
- **WHEN** the scoring is exercised in the automated script tests
- **THEN** it works on recorded replies and needs neither a model nor a
  network connection

### Requirement: Code Is Judged By Evaluating It

The workflow SHALL judge a reply's code by evaluating it with the same
headless Strudel evaluator that the pattern library's fast check uses. The
code judged SHALL be the reply's first fenced block labelled as Strudel or,
when there is none, its first block the chat would treat as code. The verdict
SHALL be one of: **pass** (it evaluates, produces musical events, and asks
only for sounds the app loads), **fail** (it raises an error, or asks for a
sound the app does not load — the error or the sound names SHALL be
reported), **inconclusive** (it evaluates but produces no events in the
cycles examined), or **no code** (the reply has none). An inconclusive
verdict SHALL NOT be counted as a pass, and SHALL be reported separately so
it can be examined.

#### Scenario: Code that plays passes
- **WHEN** a reply's code evaluates and produces events using only loaded
  sounds
- **THEN** its verdict is pass

#### Scenario: Code that raises an error fails with the error
- **WHEN** a reply's code raises an evaluation error
- **THEN** its verdict is fail and the error message is recorded

#### Scenario: Code that asks for an unloaded sound fails with its name
- **WHEN** a reply's code uses a sound the app does not load and does not
  load the pack that provides it
- **THEN** its verdict is fail and the sound is named

#### Scenario: Code that produces no events is inconclusive
- **WHEN** a reply's code evaluates without error but produces no events
- **THEN** its verdict is inconclusive, it is not counted as a pass, and it
  is listed in the report

#### Scenario: The code judged is the Strudel block
- **WHEN** a reply contains a block labelled as another language followed by
  a block labelled as Strudel
- **THEN** the Strudel-labelled block is the one judged

### Requirement: Each Kind Is Checked For What It Promises

A case passes only when every check for its kind holds. A **docs** case
passes when every expected function name appears in the reply as a whole word
(in its prose or its code), no forbidden name appears, and — when the case
requires code — the reply's code passes evaluation. A **fix** case passes
when the reply contains code that passes evaluation, differs from the broken
code, and still contains every fragment the case says must be kept. A
**compose** case passes when the reply's code passes evaluation, contains
every required name and no forbidden name, and produces at least the case's
minimum number of events. A reply with no code where code is required SHALL
fail.

#### Scenario: A fix that changes nothing fails
- **WHEN** a reply to a fix case returns the broken code unchanged
- **THEN** the case fails, even though the reply contains code

#### Scenario: A fix that discards the rest of the piece fails
- **WHEN** a reply to a fix case returns code that evaluates but omits a
  fragment the case says must be kept
- **THEN** the case fails and names the missing fragment

#### Scenario: A docs answer that never names the function fails
- **WHEN** a reply to a docs case does not mention an expected function
- **THEN** the case fails and names the missing function

#### Scenario: A composition that meets its constraints passes
- **WHEN** a reply to a compose case contains code that passes evaluation,
  uses every required name, and produces at least the minimum events
- **THEN** the case passes

### Requirement: The Function-Existence Check Is Reported Unavailable Until The Docs Index Exists

The workflow SHALL include, in every report, a check that every function a
reply's code calls actually exists in Strudel. While no documentation index
exists to check against, that check SHALL be reported as **unavailable**,
with the reason, in the report and its summary. It SHALL NOT be counted as a
pass or a fail, and it SHALL NOT be silently omitted. When a documentation
index becomes available the check SHALL start reporting real results without
any change to the case set.

#### Scenario: No documentation index yet
- **WHEN** a run is scored and no documentation index exists
- **THEN** the report lists the function-existence check as unavailable and
  gives the reason, and no case is affected by it

### Requirement: A Run Produces A Report

A run SHALL print a summary and save a complete report. Because each case is
sampled several times, results are counted per sample, and each case has a
pass rate (its passing samples out of all its samples). The summary SHALL
show, for each kind and overall, how many samples passed, failed and were
inconclusive, how many errored, the resulting pass rate, and which checks
were unavailable, and SHALL list every case with a failing sample together
with its reason. Errored samples count against the pass rate. The saved report SHALL
contain every reply and every verdict, and the details of the run: when it
ran, the model, a fingerprint of the system prompt used, a fingerprint of the
case set, the number of samples, and the code revision. By default the saved
report SHALL be written outside the repository, so that a run leaves the
working tree unchanged.

#### Scenario: The summary names each failure
- **WHEN** a run finishes with failing samples
- **THEN** the summary lists each affected case with the check that failed

#### Scenario: A run leaves the working tree clean
- **WHEN** a run finishes and no output location was chosen
- **THEN** the full report exists outside the repository and no tracked file
  has changed

### Requirement: A Baseline Is Committed And Runs Can Be Compared With It

The workflow SHALL let the developer deliberately save a run as the committed
**baseline**, holding the summary and every case's verdicts (not the reply
texts) together with the run's details. It SHALL NOT overwrite the baseline
except when asked. A compare mode SHALL print how a run differs from the
baseline: the change in pass rate for each kind and overall, the cases whose
pass rate rose or fell (shown as before and after), and — stated plainly — what differs between the two runs (the
model, the system prompt, the case set). A comparison SHALL NOT be refused
because the runs differ, since differing from the baseline is what a later
change is for; but a case present in only one of the two SHALL be listed as
such and SHALL NOT be counted as a change.

#### Scenario: The baseline is never overwritten by accident
- **WHEN** a run completes without a request to save the baseline
- **THEN** the committed baseline is unchanged

#### Scenario: A later run shows what moved
- **WHEN** a run is compared with the baseline and one case's pass rate has
  risen from 0 of 3 samples to 3 of 3
- **THEN** the comparison lists that case with its before and after, and
  shows the change in its kind's pass rate

#### Scenario: The comparison says what differs
- **WHEN** a run's system prompt fingerprint differs from the baseline's
- **THEN** the comparison states that the prompts differ instead of hiding it

#### Scenario: A new case is not a change
- **WHEN** the case set has a case the baseline does not
- **THEN** the comparison lists it as not in the baseline and does not count
  it as a rise or a fall

### Requirement: The Harness Spends Money Only When Asked

Running the harness against the model SHALL happen only when the developer
starts it. It SHALL NOT be part of the project's automated test run, nor of
any continuous-integration job. The scoring, the case-set checks, and the
report and comparison logic SHALL be covered by the automated tests, and
those tests SHALL make no model calls.

#### Scenario: The automated tests never call a model
- **WHEN** the project's automated tests run
- **THEN** no request is made to a model and the scoring, case-set checks,
  report and comparison are exercised on recorded data
