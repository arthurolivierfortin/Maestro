# Maestro Agent Workflow Protocol

| | |
|---|---|
| Author | Arthur-Olivier Fortin |
| Version | 0.1 (draft for review) |
| Date | 2026-10-06 |
| Status | Proposed. It becomes normative for Maestro when merged. Adoption by dev-kit needs its own ADR (`C:/Projects/dev-kit/docs/decisions/`). |
| Provenance | Written from the author's own repositories (Maestro, dev-kit, cockpit, Money-Core, agent-core) and from the public sources listed in §9. Every claim about our systems carries a file path. |

## Contents

0. [Reading guide and vocabulary](#0-reading-guide-and-vocabulary)
1. [Why a protocol](#1-why-a-protocol)
2. [The model: four dimensions, four levels](#2-the-model-four-dimensions-four-levels)
3. [Classifying a workflow](#3-classifying-a-workflow)
4. [Climbing a level](#4-climbing-a-level)
5. [Prove feasibility, then optimise](#5-prove-feasibility-then-optimise)
6. [Worked examples](#6-worked-examples)
7. [Templates](#7-templates)
8. [Appendix: self-assessment](#8-appendix-self-assessment)
9. [References](#9-references)

---

## 0. Reading guide and vocabulary

This protocol is the working mentality of Maestro. Maestro is the engine that takes the contract of a
workflow and builds, tests and optimises what is inside it (`docs/REPRISE-2026-09-29-moteur.md`,
§1). The protocol says what "good enough to run" means before the engine optimises anything, and
what the engine may trade away while it optimises.

It has three readers: the person who owns a workflow and decides whether it may run; the agent that
builds or runs it; and the engine that searches for a cheaper version of it.

### 0.1 Terms

| Term | Definition used in this document |
|---|---|
| **Agent** | A model-driven loop that reads inputs, may call tools, and produces an output. In Maestro an agent is a composite block (`CLAUDE.md`, "Everything is a Block"). |
| **Workflow** | A fixed arrangement of steps, some driven by a model and some by code, with declared inputs and outputs. An agent is a workflow whose control flow is partly chosen by the model. |
| **Write** | Any effect that outlives the run: a file, a commit, a pull request, a database row, a message sent, an order placed. Reading is not a write. |
| **Real system** | A system whose state other people, other agents or later runs depend on. A scratch directory deleted at the end of the run is not a real system. |
| **Contract** | The typed declaration of a workflow: inputs, outputs, tools, provider and evaluators (agent-core `docs/decisions/ADR-AGENT-0021-le-contrat-comme-declaration-avant-le-moteur.md`), extended in Maestro with a budget and target levels (`docs/REPRISE-2026-09-29-moteur.md`, §4.1). |
| **Gate** | A check that runs before an effect and can refuse it. A check that cannot refuse is a report, not a gate. |
| **Case set** | A versioned, fixed list of inputs, each with its acceptance checks. |
| **Harness** | Code that runs a workflow against a case set, N times per case, and records the outcome and the cost of each run. |
| **Reference configuration** | The configuration (model, prompt, steps, tools, settings) that first met the acceptance checks. See §5. |
| **Floor** | The minimum score a candidate configuration must reach on the case set to replace the reference. See §5. |
| **Shadow run** | Running a candidate on the same inputs as the configuration in service, recording both, and acting only on the output of the one in service. |
| **Environment fingerprint** | The versions that can change an agent's behaviour without any code change: agent definition, model identifier, CLI, plugins, settings hash, scoring grid and estimation recipe (`C:/Projects/dev-kit/scripts/tool_versions.py`, `ENVIRONMENT_KEYS`). |
| **Evidence** | A file path (with a line number when useful), a command with its output, or a measurement with its sample size and window. A claim without evidence is a hypothesis and is labelled as one. |

### 0.2 Conventions

- Levels are written `D2`, `I1`, `M3`, `S2`: the dimension letter, then the level number.
- A workflow's profile is written `D2 I2 M1 S2`.
- MUST, MUST NOT and SHOULD have their usual normative meaning.
- Numbers about our systems are measured unless marked *hypothesis*.

---

## 1. Why a protocol

An agent that only talks can be wrong cheaply: a person reads the answer and decides. An agent that
writes into a real system is different. Its mistake is executed, often by other agents that trust
it, and it can stay invisible for days. Four properties keep such an agent safe to run:

1. **Predictable.** For the same input, the output has the same shape, and every part of it that can
   be checked is checked. Otherwise nothing downstream can rely on it.
2. **Contained.** The agent can only touch what it was given. When it goes wrong, the damage stops
   at a known boundary.
3. **Measured.** We know how often it is right, what it costs, and which version of everything was
   in service when it ran. Otherwise we cannot tell an improvement from a regression.
4. **Controlled.** Every write passes a gate that can refuse it, and the right to write is declared,
   reviewed and taken back.

These are not abstractions. Each property failed at least once in our own systems during the two
weeks before this document, and each failure was found only because something was measured after
the fact.

### 1.1 What went wrong, in our own logs

**A shared meter read as if it were private.** The subscription quota gauge is one number for the
whole account: every session and the web client move it. For a while, the pilot tried to read the
cost of one session from the movements of that gauge. On 2026-10-05 the approach was dropped. The
quota of a task is now its API-equivalent cost (tokens times model price) divided by a
dollars-per-point factor calibrated each week, and the per-session view was removed as "biased by
construction" (`C:/Projects/cockpit/DECISIONS.md`, entry "2026-10-05 09:05";
`C:/Projects/dev-kit/docs/decisions/ADR-DEVKIT-0028-telemetrie-quota-contexte.md`, Decision). The
same work found a 17-hour gap in the quota samples, during which the 7-day gauge went from 7 % to
24 % (`ADR-DEVKIT-0028`, Context). *Lesson*: a measurement that cannot be attributed to a run does
not measure the run.

**Retries counted as defects.** On 2026-10-05 the pilot changed a specification while the reviewer
was running. The builder's relaunch emitted a retry event that the loop counted as a builder
defect: the event had no cause field, and the retry cap counted every retry
(`C:/Projects/dev-kit/docs/decisions/ADR-DEVKIT-0031-cause-reprise-grille-q3-1.md`, Context). The
fix added a closed `cause` field (`defaut`, `spec_pilote`, `spec_arthur`) and made the cap count
defects only. *Lesson*: a missing or free-form field becomes a wrong number downstream.

**A test job red 110 times out of 110.** Marcel's continuous integration failed on every run of the
week (`ci.yml`, end-to-end job; Marcel issue #732), and builders spent 13.6 hours waiting for it
(`C:/Projects/cockpit/docs/bilan/2026-10-05/revue-rapport.md`, §2.2, friction 2). The two tests were
put in quarantine (`C:/Projects/cockpit/DECISIONS.md`, decisions on the 2026-10-05 review).
*Lesson*: a gate that never passes carries no information and costs time; agents learn to wait for
it or to route around it.

**Output tokens under-counted by a factor of about 25.** The telemetry hook recorded about 1.4 k
output tokens per researcher pass, against about 35 k in the transcripts (dev-kit issue #295, open;
`C:/Projects/cockpit/docs/bilan/2026-10-05/researcher-rapport.md`, line 76). Every cost analysis
built on that column was wrong until the costs were recomputed from transcripts. *Lesson*: an
instrument must itself be tested against a known total.

**A model that changed under a fixed name.** The `sonnet` alias moved from `claude-sonnet-5` to
`claude-sonnet-5-5` between 2026-09-29 and 2026-09-30, without any decision. During a week meant to
change one variable at a time, the estimator ran on three models
(`C:/Projects/dev-kit/docs/decisions/ADR-DEVKIT-0030-modeles-epingles.md`, Context). *Lesson*: an
unpinned dependency is an unrecorded experiment.

**A proof that could not fail.** Money-Core's seven-day paper-trading run, meant to prove the
engine, could not take a single decision: the meta-model needs 178 candles and the warm-up loaded
85 (`C:/Projects/Perso/Money-Core/STATUS.md`, lines 29 and 99). The run proved only that the process
stayed alive. *Lesson*: before a long measurement, check that the measured event can happen on the
first tick.

**Decisions with no way to check them.** Of 27 dev-kit ADRs and about 35 pilot decisions, 10 could
be measured at the first weekly review, and 9 ADRs had no possible measure because they were
written after the fact (`revue-rapport.md`, §1 and §1.3). *Lesson*: a decision that does not state
its indicator, threshold and window can be neither validated nor reversed on evidence.

### 1.2 What the protocol does about it

The protocol turns the four properties into four dimensions, each with four levels that an observer
can check (§2). It gives every workflow a class according to what its output touches and what an
error costs, and the class sets the minimum level on each dimension (§3). It describes how to climb
a level and the traps we met while climbing (§4). It then adds the rule that drives Maestro's
optimisation: prove that the job can be done with a strong model, freeze that result as the
reference, and only then optimise, one variable at a time, never below the reference's floor (§5).

### 1.3 What the protocol is not

- It is not a prompt style guide.
- It does not replace the dev-kit conventions (`C:/Projects/dev-kit/conventions/`). It gives them a
  common measure.
- It grants no permission. It says which permissions must exist and how they are proven. Granting
  them stays a human decision (§2.4, §3.4).

---

## 2. The model: four dimensions, four levels

### 2.1 Structure

| Dimension | Question it answers | Property (§1) |
|---|---|---|
| **D · Determinism** | How much of the output is fixed or checked by something other than the model? | Predictable |
| **I · Isolation** | What can the agent touch, and what stops it from touching anything else? | Contained |
| **M · Measurability** | Do we know how often it is right, at what cost, and under which versions? | Measured |
| **S · Security** | What must happen before a write takes effect, and who holds the right to write? | Controlled |

Each dimension has levels 0 to 3. Three rules apply to all of them.

1. **Cumulative.** A workflow is at level *n* only if it meets the criteria of every level up to
   *n*. Instruments that belong to a higher level do not count while a lower criterion is missing.
   (Example in §6.1: the dev-kit reviewer has continuous telemetry, which belongs to M3, but no fixed
   case set, so it sits at M0.)
2. **Proven by observation.** Every criterion names the observation that proves it: a file, a
   command and its output, or a measurement. If the observation cannot be produced, the level is not
   met. "Unknown" is a valid answer and is better than a guess.
3. **Per workflow, per version.** A level belongs to one workflow in one configuration. Changing the
   model, the prompt, the tool list or the permission set can change the level, and the assessment
   is redone (§2.6).

### 2.2 Determinism

Determinism here does not mean that the model returns the same tokens every time. It means that the
part of the output a downstream step acts on is either fixed by a schema, constrained to a closed
set, or recomputed by a script. The more of the output that is checked by code, the less the
model's variance matters.

| Level | Name | Criterion | Proof |
|---|---|---|---|
| **D0** | Free text | The output is prose or loosely formatted text. Any parsing is ad hoc. | None needed. This is the default. |
| **D1** | Typed output | The output is validated against a versioned schema before anything consumes it. An invalid output is a failure, not a low score. | The schema file path; the validator call in the consuming code; one recorded rejection of an invalid output (a test or a log line). |
| **D2** | Constrained fields | Every field that downstream code acts on is closed: an enumeration, a bounded number, a pattern, or a reference that is checked to exist (a file and line, an issue number, a commit). Free text survives only in fields that nothing acts on, and they are named as such. | The schema with its enumerations and patterns; the list of acting fields with their constraint; a test that rejects an out-of-set value. |
| **D3** | Script-verified | Every part of the output that a script can compute or check is computed or checked by a script. The model fills only what no script can, and its claims about facts (a test passed, a file exists, a number) are re-derived by code before use. | A field-by-field table: field, source (model or script), verifier. The verifier scripts and their tests. A recorded case where a script overruled the model. |

Notes on Determinism.

- D1 is not "the model was asked to return JSON". It is "a validator ran and could refuse". Forcing
  JSON-only answers can also hurt: Maestro agents looped when told their entire answer must be one
  JSON object, and the fix was a mandatory reasoning line before the action
  (`docs/concepts/tool-calling-strategy.md`, "The THINK/ACTION Format"). The schema constrains the
  action, not the thinking.
- D2 is where most silent errors die. A free-text reason field that a script later parses is a D0
  field disguised as D1 (see the retry cause in §1.1).
- D3 does not mean "no model". It means the model is used only where judgement is the job.

#### Technique: protocolized judgment

Some outputs require a judgement that no script can give: the quality of a change, the soundness of
an architecture, how well a result fits the need, the craft of an interface. D3 is out of reach for
those, because the judgement is the job. **Protocolized judgment** is the technique that reduces the
model's variance on such outputs without removing the judgement: the model follows the same precise
recipe every time, so that two runs on the same input differ only where the judgement itself is
uncertain.

The recipe has eight parts. All eight are required to claim the technique.

| # | Part | What it fixes | Proof |
|---|---|---|---|
| 1 | **Fixed inputs, collected in a fixed order** | The judge reads the same artefacts, in the same order, and is told what it must not read. | Input list and reading order in the judge's definition; the "do not read" list. |
| 2 | **Defined axes with closed questions** | Each axis is broken into yes/no questions that the judge ticks one by one, instead of one global impression. | The grid file with its axes and questions. |
| 3 | **An anchored scale** | Each level of each axis has a written description and one example, so that "3" means the same thing on every run. | The grid file: one description and one example per level. |
| 4 | **Observations, then reasoning, then score, in that order** | The judge records what it saw before it argues, and argues before it scores. The score cannot come first and be justified afterwards. | Output schema with the three fields in that order; the judge's instructions. |
| 5 | **Mandatory, cited evidence** | Every score cites `file:line`, a command and its output, or a measured count. Tools provide the evidence; they do not provide the score. | Schema pattern on the evidence field; a recorded rejection of a score without evidence. |
| 6 | **Typed output** | The verdict is validated against a schema; scores are bounded integers, axes are an enumeration (D1 and D2 for the verdict's shape). | Schema file and validator. |
| 7 | **Double pass on a sample, with measured agreement** | On a fixed share of items, the judgement runs twice (two runs of the same judge, or two judges) and the agreement is measured per axis. Under a declared threshold, the grid is revised, not the score. | The agreement measure, its threshold, and the log of grid revisions it triggered. |
| 8 | **A versioned grid, linked to the environment fingerprint** | Every score records the grid version, and the grid version is part of the fingerprint, so that scores from different grids are never compared as if they were one series. | Grid version in each record; grid version in the fingerprint keys. |

**Where it sits in the levels.** Protocolized judgment lets a judgement output reach **D2**: the acting
fields (axis, score, evidence) are closed, bounded and checked, and the free reasoning is confined to
a field that nothing acts on. It does **not** reach D3, and a card must not claim D3 for it: the score
is still produced by a model. Two consequences follow. First, every part of the judgement that a tool
can compute is moved out of it (part 5 is the boundary: tools give evidence and, where they can, the
score itself, as in D3). Second, consistency is not validity. A judge can agree with itself perfectly
and still not predict what matters; part 7 measures the first, and only an outcome measure (§2.5)
measures the second.

**Example: the dev-kit quality evaluator.** The `evaluator` agent scores each closed task on five
axes, 1 to 4, each with its evidence (`C:/Projects/dev-kit/adapters/claude/agents/evaluator.md`,
description). Against the eight parts, at grid q3.1:

| # | Part | In the evaluator | Status |
|---|---|---|---|
| 1 | Fixed inputs, fixed order | Closed input list, files read at the PR head one git command at a time, and an explicit "do not read" list that hides the builder's model: "a score rests on the diff and the artefacts, never on the author" (`evaluator.md`, sections "Entrée" and "Ce que tu ne lis pas", lines 25 to 52). | Met |
| 2 | Axes and closed questions | Five axes in a fixed order (`telemetry/grille-qualite.md`, "Dimensions", lines 15 to 23); for each axis the criteria of levels 1, 2 and 3 are checked in that order and the score is the first criterion met, 4 if none (`evaluator.md`, "Méthode", step 2). | Met |
| 3 | Anchored scale | Each level has a written criterion, mostly a count (for example `conformite`, `grille-qualite.md`, lines 73 to 76). No worked example per level. | Partly met |
| 4 | Observations, reasoning, score | The output carries a score and its evidence (`evaluator.md`, "Sortie"), but no separate observation and reasoning fields in that order. | Not met |
| 5 | Evidence | Every score cites `file:line`, a command prefixed by `$`, or "non évaluable : …"; a score without evidence is forbidden (`schemas/evaluation-verdict.schema.json`, `preuve` pattern; `evaluator.md`, "Interdits"). Three axes are computed by `quality_rules.py` and copied unchanged (`evaluator.md`, lines 100 to 127): for those, the tool gives the score, which is better than the technique requires. | Met |
| 6 | Typed output | `schemas/evaluation-verdict.schema.json`: axis enumeration, status enumeration, grid version pattern `^q[0-9]+(\.[0-9]+)?$`, pinned model pattern. | Met |
| 7 | Double pass and agreement | No double pass or agreement measure found. | Not met |
| 8 | Versioned grid in the fingerprint | `grille_qualite` is a fingerprint key (`scripts/tool_versions.py`, `ENVIRONMENT_KEYS`); the measurement window declares `q3.1` (`telemetry/fenetres.json`); q3.1 was introduced as a numbered rectification so that scores before and after stay separable (`ADR-DEVKIT-0031`). | Met |

So the evaluator follows the recipe on six parts out of eight, and the two missing parts are the
ones that would make its variance visible. The bilan also shows the limit named above: no q3 score
separated the PRs that later had a defect from the others (`revue-rapport.md`, §1.1, ADR-0008 row).
The proposed q4 goes further in the direction of this technique: tools produce the numbers, and the
model only answers seven closed yes/no questions with `file:line` evidence, weighted 5 % of the
composite (`C:/Projects/cockpit/docs/bilan/2026-10-05/grille-rapport.md`, Recommendation). Adding
parts 4 and 7 to q4 is the next step.

**Public sources.** The technique combines practices that are documented in public work. All were read
on 2026-10-06.

- G-Eval uses "large language models with chain-of-thoughts (CoT) and a form-filling paradigm, to
  assess the quality of NLG outputs", and reports "a Spearman correlation of 0.514 with human on
  summarization task" (Liu et al., *G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment*,
  arXiv:2303.16634, https://arxiv.org/abs/2303.16634). It supports parts 2 and 4: fixed evaluation
  steps, filled in as a form.
- Prometheus evaluates "based on customized score rubric provided by the user", works best "when the
  appropriate reference materials (reference answer, score rubric) are accompanied", and reports a
  Pearson correlation of 0.897 with human evaluators on 45 customized rubrics (Kim et al.,
  *Prometheus: Inducing Fine-grained Evaluation Capability in Language Models*, arXiv:2310.08491,
  https://arxiv.org/abs/2310.08491). It supports part 3: a scale whose levels are described.
- CheckEval "improves rating reliability via decomposed binary questions", reports that it improves
  "the average agreement across evaluator models by 0.45 and reduces the score variance", and notes
  that its scores are "more interpretable because it decomposes evaluation criteria into traceable
  binary decisions" (Lee et al., *CheckEval: A reliable LLM-as-a-Judge framework for evaluating text
  generation using checklists*, arXiv:2403.18771, https://arxiv.org/abs/2403.18771). It supports parts
  2 and 7.
- Anthropic, *Demystifying evals for AI agents* (2026-01-09): model-based graders are
  "Non-deterministic" and "More expensive than code"; "LLM-based rubrics should be frequently
  calibrated against expert human judgment"; and "it can also help to create clear, structured rubrics
  to grade each dimension of a task, and then grade each dimension with an isolated LLM-as-judge
  rather than using one to grade all dimensions"
  (https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents). It supports parts 2, 7 and
  the rule that tools come first.
- Anthropic, *Define success criteria and build evaluations*: its model-graded examples note that it
  is "Generally best practice to use a different model to evaluate than the model used to generate
  the evaluated output" (https://platform.claude.com/docs/en/test-and-evaluate/develop-tests). It
  supports part 1: the judge is not the producer.

### 2.3 Isolation

Isolation answers one question: if the agent does the worst thing its tools allow, what is hit?

| Level | Name | Criterion | Proof |
|---|---|---|---|
| **I0** | Shared identity | The agent runs as the person or the process that launched it: same working copy, same credentials, same environment. Its actions are indistinguishable from the owner's. | None needed. This is the default. |
| **I1** | Own identity | The agent has its own working area (a branch, a worktree, a data directory) and its own attributable identity (a session identifier on every write, scoped credentials). Its writes can be found and undone without touching anyone else's. | The working area path or branch rule; the attribution field on writes (for example commit trailers); a query that lists all writes of one session. |
| **I2** | Declared doors | The agent runs in a container whose only doors are the tools declared in its definition. Anything not declared is refused by construction, not by instruction. | The tool list in the agent definition; the runtime that enforces it; a recorded refusal of an undeclared tool or path. |
| **I3** | Constraining tools | Each declared tool enforces its own constraint on its arguments: allowed paths, allowed commands, allowed modes. Authorising a tool no longer means authorising everything the tool can do. | For each tool: the code that checks its arguments, and a test showing a refusal. A list of tools that remain unconstrained, which must be empty for I3. |

Notes on Isolation.

- The step from I2 to I3 is the one most often skipped. A record kept in agent-core puts it in one
  sentence: "Authorizing a tool ≠ constraining it. Coarse tool-level permissions, on a `bash` tool,
  are approximately zero permissions"
  (`C:/Projects/Perso/agent-core/docs/decisions/ADR-AGENT-0004-isolation-execution-policy.md`,
  Context). Maestro's own shell executor starts `cmd.exe` or `/bin/bash` on the host
  (`apps/backend/src/Maestro.Infrastructure/BlockExecutors/ShellBlockExecutor.cs`, line 102). A block
  that declares the shell tool is therefore at most I2, whatever else it declares.
- Instructions in a prompt are not isolation. "Do not edit files outside X" is a request; a hook that
  refuses the edit is a door.

### 2.4 Security

Security covers the moment a write takes effect and the rights behind it. Isolation limits what can
be reached; Security decides what is allowed to happen inside that reach.

| Level | Name | Criterion | Proof |
|---|---|---|---|
| **S0** | Unguarded | The agent's writes take effect directly. | None needed. This is the default. |
| **S1** | Human before write | A person reviews every write before it takes effect, and the agent cannot make it take effect without that review. | The approval step in the flow; a recorded approval and a recorded refusal; evidence that the agent lacks the right to bypass it. |
| **S2** | Gate in the tool | The write goes through a tool that checks its preconditions and refuses when they fail (a review verdict, green checks, an unchanged head, a valid message). The gate does not depend on the agent's cooperation. | The gate's code; its tests; recorded refusals; evidence that no other path to the same write exists for the agent. |
| **S3** | Declared, reviewed, audited, ephemeral rights | Every right to write is declared in a versioned file, changed only by a reviewed change, logged at each use, and limited in time (it expires or is released at the end of the run). | The declaration file and its history; the use log; the expiry mechanism; a review record of the last change of rights. |

Notes on Security.

- S1 is a level, not the ceiling. A human review that scales badly stops being a review. In our
  pilot, a decision queue was synchronised 190 times for 4 answers in a week
  (`revue-rapport.md`, §1.1, ADR-0020 row): an approval channel that people do not use is not a gate.
  S2 and S3 move the routine checks into tools, so that human attention goes where §3 requires it.
- For class 4 (§3) the human approval is **required in addition to S3**. Reaching S3 never removes it.

### 2.5 Measurability

Measurability is the dimension that makes the other three verifiable over time.

| Level | Name | Criterion | Proof |
|---|---|---|---|
| **M0** | Anecdotal | Quality is judged from impressions or a few runs. | None needed. This is the default. |
| **M1** | Fixed case set | A versioned case set exists, with expected outcomes or acceptance checks per case, including cases where the right answer is a refusal. It covers every acting output field at least once. | The case set file and its version history; the list of checks per case; one case that the current configuration fails or once failed (a set that nothing can fail proves nothing). |
| **M2** | Harness | A harness runs the case set N times per configuration and records, per run: outcome per check, tokens in and out, cost at a dated price table, duration, tool calls, and the model identifier. It produces a report that compares configurations. | The harness command; one report with N, rates and costs; the price table with its date and source. |
| **M3** | Continuous, reviewed, version-linked | Every run in service is measured, not only test runs. Each record carries the environment fingerprint: agent definition version, pinned model identifier, CLI version, plugins, settings hash, and the version of every scoring instrument. Quality and estimation error are recorded **per agent**. Measurement windows are declared, and a scheduled review compares them and validates or invalidates the decisions that claimed an effect. | The telemetry schema; records showing the fingerprint fields filled; the window declarations; the last review report with its verdicts. |

Notes on Measurability.

- Instruments drift too. A scoring grid, a price table or a token counter is a dependency with a
  version. Our token counter was wrong by a factor of about 25 (§1.1). M3 therefore includes a
  periodic check of the instrument against a known total.
- `NULL` is not `0`. A missing measurement must stay missing; a default zero looks like a measured
  zero and cannot be told apart later
  (`C:/Projects/dev-kit/docs/decisions/ADR-DEVKIT-0005-null-n-est-pas-zero.md`).
- Sample size bounds what M3 can see. With 30 to 50 tasks a week, a difference below 0.15 on our
  quality notes is noise (`C:/Projects/cockpit/DECISIONS.md`, decision "Pas de gel de Claude Code,
  attribution par la télémétrie", 2026-10-05). A review states its sample and does not report
  differences under its noise floor as effects.

### 2.6 The profile and its lifecycle

A workflow's profile is the four levels together, for example `D2 I2 M2 S2`. The profile is
recorded on the classification card (§7.1) with the evidence for each level. It is reassessed when:

- the model, prompt, tool list, permission set or step layout changes;
- the environment fingerprint changes in a way the owner flags as relevant (a CLI major version, a
  provider deprecation);
- the weekly review (§5.7) finds that a level's evidence no longer holds (a schema bypassed, a gate
  that stopped refusing, a broken counter).

A drop in any dimension below the class minimum (§3) stops the workflow from running in service until
the level is restored or the class is lowered by a reviewed decision.


---

## 3. Classifying a workflow

The levels a workflow needs depend on two things: **what its output touches**, and **what an error
costs**. A summary that a person reads before acting does not need the same guarantees as a process
that places an order. The protocol sorts workflows into four classes and sets a minimum level per
dimension for each.

### 3.1 The two axes

**Reach: what the output touches.**

| Reach | Description | Examples from our systems |
|---|---|---|
| R1 · A reader | The output is read by a person and has no effect until that person acts. | A research report in `cockpit/docs/bilan/`; a note dropped in the KB inbox. |
| R2 · Internal records | The output is written into records that other agents or later decisions read: telemetry, estimates, review verdicts, consolidated knowledge. | The estimator's estimate; the reviewer's verdict; the evaluator's quality notes. |
| R3 · Shared code or state | The output changes code, branches, configuration or data that other people, projects or users depend on, through a reversible path. | A builder's pull request; a database migration applied to a development environment. |
| R4 · Irreversible or external | The output moves money, touches production data or credentials, sends a message to someone outside, or creates an obligation. | An order on a real exchange; a production schema change; an e-mail to a customer. |

**Impact: what one error costs.** Four questions, scored independently; the impact is the highest
answer.

| Question | Low | Medium | High | Critical |
|---|---|---|---|---|
| Reversibility: how is an error undone? | Delete or ignore it | Revert with a normal change | Revert needs coordination or data repair | Cannot be undone |
| Detection: who notices, and when? | Immediately, by the next step | Within the run, by a gate | Days later, by a person or a review | Possibly never |
| Spread: how far does it travel? | This run only | This project | Several projects or agents | People or systems outside our control |
| Cost: what is lost? | Minutes of agent time | Hours of agent time | Days of work, wrong decisions | Money, data, trust, legal exposure |

### 3.2 The classification grid

The class is read from the grid. When in doubt between two cells, take the higher class.

| Reach ↓ / Impact → | Low | Medium | High | Critical |
|---|---|---|---|---|
| **R1 · A reader** | Class 1 | Class 1 | Class 2 | Class 3 |
| **R2 · Internal records** | Class 2 | Class 2 | Class 3 | Class 4 |
| **R3 · Shared code or state** | Class 3 | Class 3 | Class 3 | Class 4 |
| **R4 · Irreversible or external** | Class 4 | Class 4 | Class 4 | Class 4 |

Why some cells move up:

- **R1 with high impact is class 2.** A report that drives a decision people will not re-check
  (a recommendation to change a model, for instance) behaves like an internal record.
- **R2 with high impact is class 3.** Internal records that several projects consume can mislead for
  weeks. The token counter of §1.1 was an R2 output with high detection and spread scores.
- **R2 with critical impact is class 4.** A record that a money-moving process reads, such as a
  risk-gate verdict, carries the cost of what it gates.
- **R4 is always class 4.** No impact score makes an irreversible external effect cheap.

### 3.3 Gate inheritance

A workflow whose output **gates** another action inherits the class of that action for Security
and Measurability. The dev-kit reviewer writes only a verdict (R2), but the pilot merges a pull
request when that verdict is `approved` and the checks are green
(`C:/Projects/dev-kit/docs/decisions/ADR-DEVKIT-0009-politique-merge-pilote.md`). A wrong approval
therefore ships a defect, which is a class 3 consequence. The reviewer keeps its class 2 card, with
the class 3 minimum on S and M, and its card says so.

### 3.4 Minimum levels per class

| Class | Determinism | Isolation | Measurability | Security | Human role |
|---|---|---|---|---|---|
| **1 · Advisory** | D1 | I1 | M1 | S0 | Reads and decides; nothing else required. |
| **2 · Internal records** | D2 | I1 | M2 | S2 | Reviews the weekly measurement and owns the decisions taken on it. |
| **3 · Shared code or state** | D2 | I2 | M2 | S2 | Owns the rights (S3 recommended); a person or a gated pilot accepts each change. |
| **4 · Irreversible or external** | D3 | I3 | M3 | S3 | **Approves every irreversible act, in addition to S3.** No agent can grant itself or another agent this approval. |

Rules attached to the table:

1. **Minimums, not targets.** Climbing above the minimum is encouraged where it is cheap, especially
   D3, which also lowers cost (§5.4).
2. **Below minimum, the workflow does not run in service.** It may run in shadow (§5.3) or on a
   sandbox while it climbs.
3. **Class 4 keeps a human in the loop by design.** The protocol never treats "the agent is good
   enough" as a reason to remove that approval. In Money-Core, the passage to real money is a
   milestone that only the owner can close, and the real-money mode is locked in code
   (`C:/Projects/Perso/Money-Core/src/money_core/cli.py`, lines 305 to 336; §6.4).
4. **Classes are per output, not per agent.** An agent with two outputs of different reach has two
   cards. The builder's commits to its own branch are class 3; its pull request body, read by the
   reviewer, is class 2.
5. **Reserved acts.** Some acts are reserved to the owner whatever the levels: production and the
   main branch of a product, secrets, permissions and settings, spending and quota, real money,
   product decisions. Our pilot's own measurement uses this list to separate legitimate questions
   from avoidable ones (`C:/Projects/cockpit/docs/bilan/2026-10-05/pilote-rapport.md`, §1,
   "Question évitable").

### 3.5 How to classify, step by step

1. List every output of the workflow, including side effects (files written, comments posted,
   telemetry lines).
2. For each output, pick its reach (§3.1).
3. Score the four impact questions; keep the highest.
4. Read the class from the grid (§3.2). Apply gate inheritance (§3.3).
5. Write the classification card (§7.1). The workflow's class is the highest class among its outputs,
   unless the outputs run in separable steps with separate cards.
6. Have the card reviewed by the workflow owner. A class is lowered only by a reviewed decision with
   its reasons.

---

## 4. Climbing a level

This section gives, for each passage between levels, the method that worked for us and the traps we
actually met. Every trap cites where it was recorded. The order within a dimension matters: the
cumulative rule (§2.1) means a missing low level makes the high-level work invisible.

### 4.1 Determinism

#### D0 → D1: give the output a schema

**Method.**
1. Write the schema before the prompt. Name each field and its type; mark required fields.
2. Validate at the boundary, in code that the agent does not control. Treat an invalid output as a
   failure that triggers a retry or a stop, never as a degraded result.
3. Keep a reasoning channel outside the schema when the agent must think (a separate field or a
   preceding line), so that the schema constrains the action and not the reasoning.

**What we met.**
- *JSON-only answers caused loops.* Maestro agents told to answer with one JSON object repeated the
  same tool call; a mandatory reasoning line before the action stopped the loops
  (`docs/concepts/tool-calling-strategy.md`, "The Discovery" and "Why THINK Prevents Loops").
- *Small models break the shape.* SmolLM2-360M "frequently produces JSON with missing closing
  brackets, extra commas, or incorrect types. Post-processing validation is essential"
  (`content/system/docs/models/smollm2-360m.md`, Known Issues 1). Validation is what makes a small
  model usable at all.
- *Schema copies mistaken for outputs.* Of the `*review*.json` files on disk, 89 were readable
  verdicts and 254 were copies of the schema (`revue-rapport.md`, §2.2, last paragraph). Store
  outputs where they cannot be confused with their template.

#### D1 → D2: close the acting fields

**Method.**
1. List the fields that any code acts on. For each, replace free text by an enumeration, a bounded
   number, a pattern or a checked reference.
2. When a field cannot be closed, say so in the schema description and make sure no code parses it.
3. Make the absence of a value explicit (`null`), and decide what absence means at read time.
4. When the output is a judgement that no script can give, apply protocolized judgment (§2.2):
   it is the route to D2 for judgement outputs.

**What we met.**
- *A missing cause read as a defect.* The retry event had only a counter; a retry caused by a
  specification change was indistinguishable from a defect (§1.1). The closed `cause` field, with
  absence read as `defaut`, fixed it without rewriting old records
  (`ADR-DEVKIT-0031`, Decision and Options).
- *Facts hidden in prose.* The estimation case and base were present only inside a free-text
  `motif`, unreadable in 85 of 211 estimation files; ADR-DEVKIT-0028 added optional `cas` and
  `duree_base_s` fields and a flat `composantes` object (`ADR-DEVKIT-0028`, Context and Decision).
- *Checks that look only at the top level.* The `hasRequiredFields` criterion of the model notes
  "only checks top-level fields, not nested arrays or objects", so a model can pass while missing
  nested data (`content/system/docs/models/smollm2-1.7b.md`, Known Issues 2).
- *Markers that are not structure.* Checklist items marked "(reporté)" without being struck through
  were still counted, inflating the spec and test counts of a split batch from 7 and 6 to 12 and 9;
  the rule became "a deferred item is struck through and points to its issue"
  (`C:/Projects/cockpit/DECISIONS.md`, entry "2026-10-05 14:45").

#### D2 → D3: move every computable part to code

**Method.**
1. Make a field-by-field table: who produces it (model or script), who verifies it.
2. For every field a script can compute, let the script compute it and let the model only read it.
3. For every factual claim the model makes (a test passed, a file exists), re-run the check in code.
4. Keep the model where judgement is the job, and say which fields those are.

**What we met.**
- *Scripts can fail silently too.* `apply-v4s --projet marcel` (lower case) fell back without warning
  to the global base, 4,556 s instead of 9,377 s
  (`C:/Projects/cockpit/docs/bilan/2026-10-05/verification-avant-gel.md`, reserve R4, issue #322). A
  D3 script MUST refuse or warn on an unknown key, never substitute a default.
- *A word matched as a marker.* The quality grid counted the word "TODO", which is also the name of
  one of our projects, as a code marker; q3.1 restricts the signal to comment markers
  (`ADR-DEVKIT-0031`, Decision).
- *A query tied to an old instrument version.* A validation query filtered on grid `q3` and returned
  0 rows during a freeze run under `q3.1` (`verification-avant-gel.md`, reserve R3, issue #321).
  Scripts that read versioned data take the version as a parameter.
- *Where it pays.* The quality grid proposal for q4 moves the numbers to tools (complexity, length,
  duplication, lint, typing, tests per item, diff size) and reduces the model to seven yes/no
  questions with `file:line` evidence, weighted 5 % of the composite
  (`C:/Projects/cockpit/docs/bilan/2026-10-05/grille-rapport.md`, Recommendation). That is a D3
  design: the model answers only what tools cannot.

### 4.2 Isolation

#### I0 → I1: give the agent its own place and name

**Method.**
1. One working area per run: a branch and a worktree for code, a data directory for data.
2. One identifier per run on every write (commit trailers `Session`, `Model`, `Authorship` in dev-kit:
   `C:/Projects/dev-kit/conventions/commits.md`, "Trailers").
3. Credentials scoped to the run's purpose; read-only by default.

**What we met.**
- *A shared data directory.* Money-Core's first paper run wrote into the same `data` directory as the
  backtests and truncated the backtest parquet files at every refresh (`Money-Core/STATUS.md`, line
  29, issue #43). The relaunch used its own `MONEY_DATA_DIR`.
- *Tests that read real files.* Five slow dashboard tests read the real quota and window files; the
  residue was accepted only because it was read-only and recorded as debt (#307)
  (`C:/Projects/cockpit/DECISIONS.md`, entries "2026-10-05 10:55" and "11:15").
- *Credentials crossing modes.* Money-Core scopes credentials by mode: paper reads only the testnet
  pair, and "a paper run will NEVER pick up MAIN creds"
  (`Money-Core/src/money_core/cli.py`, `_select_broker` docstring, lines 316 to 336).

#### I1 → I2: make the tool list the only door

**Method.**
1. Declare the tool list in the agent definition. Give each agent the smallest list that does its job.
2. Remove write tools from agents whose job is to judge.
3. Enforce the boundary in the runtime (hooks, worktree guard, permission layer), not in the prompt.

**What we met.**
- *Removing a tool removes a temptation, and creates a workaround.* The dev-kit reviewer has no
  `Write` or `Edit`, by design: "A reviewer who corrects stops being a reviewer"
  (`C:/Projects/dev-kit/adapters/claude/agents/judge.md`, lines 13 to 14). But agents without `Write`
  wrote their probe files through shell heredocs, which the worktree guard then refused: 298 refusals,
  21 % of the guard's total (`revue-rapport.md`, §2.3). When a tool is removed, give the legitimate
  need another door (a scratch directory tool, for instance) or the agent will find a bad one.
- *The guard is the largest source of errors.* The worktree isolation guard produced 1,387 refusals,
  35 % of all tool errors, about 3.6 hours (`revue-rapport.md`, §2.2, friction 3). One rule, "one
  simple command per call", cut the refusal rate from 48 to 18-33 per thousand shell calls
  (`revue-rapport.md`, §2.3). Isolation has a running cost; measure it.

#### I2 → I3: put the constraint inside the tool

**Method.**
1. For each declared tool, write the argument check: allowed paths, allowed sub-commands, allowed
   modes, refusal by default.
2. Test the refusals, including encodings that try to escape (`..`, alternate streams, wildcards).
3. List the tools that remain unconstrained. For I3, the list is empty.

**What we met.**
- *Our best I3 example is small.* The cockpit's weekly guard lets the scheduled sessions write only
  files prefixed `retro-` or `veille-` directly under `state/`, run only two scripts with an allowlist
  of options, and refuses everything else, including `..` and NTFS streams, with exit code 2
  (`C:/Projects/cockpit/scripts/weekly_guard.py`, module docstring). The KB guard refuses writes to the
  consolidated KB unless the dream process sets `CLAUDE_CORE_DREAM=1`
  (`C:/Projects/dev-kit/adapters/claude/agents/kb-integrator.md`, lines 12 to 14).
- *A container that is not on the path.* In Maestro, a Docker runtime exists
  (`apps/backend/src/Maestro.Infrastructure/Containers/DockerContainerRuntime.cs`), but the shell
  block runs on the host (`ShellBlockExecutor.cs`, line 102), and the container runtime is consumed by
  a controller and a project service, not by block execution
  (`apps/backend/src/Maestro.Infrastructure/Services/ProjectContainerService.cs`). The agent-core
  analysis reached the same conclusion: the word "container" names a permission scope, not an OS
  container (`ADR-AGENT-0004`, Context). A component that exists but is not on the execution path
  provides no isolation.
- *Do not rename to get past a check.* The auto-mode classifier refused `estimate_recipe.py apply` as
  a shared-resource change although the script writes nothing. The pilot refused to rename the
  sub-command to get past it; the owner added an explicit allow rule instead
  (`C:/Projects/cockpit/DECISIONS.md`, entry "2026-10-05 15:42"). A false refusal is fixed by a
  declared exception, never by disguise.

### 4.3 Measurability

#### M0 → M1: write the case set

**Method.**
1. Collect real inputs, weighted like real traffic. Add the hard cases you already know.
2. For each case, write checks on the outcome, not on the wording.
3. Include cases whose correct answer is a refusal or a stop.
4. Version the set. A case is never edited to make a configuration pass; a wrong case is retired with
   a note.

**What we met.**
- *A set that cannot fail.* The empty Money-Core proof (§1.1): the run could not produce the event it
  was supposed to measure. Add a start check: "at least one decision is possible on the first tick"
  (`Money-Core/STATUS.md`, line 98, warm-up check).
- *Surface success.* Maestro's dogfooding recorded "100% success rate on superficial tasks while the
  agent may be fundamentally inadequate for real use", because no case checked the depth of the work
  (`docs/guides/ai-agents/dogfooding-methodology.md`, §8.1). Cases must test what the workflow is for.
- *The tester who built it.* A dogfooding agent that just built the feature "cannot dogfood them
  faithfully" (`dogfooding-methodology.md`, "Context Isolation"). The person or agent who writes the
  cases should not be the one who wrote the configuration under test.

#### M1 → M2: build the harness

**Method.**
1. One command runs a configuration over the case set N times and writes one record per run.
2. Each record: outcome per check, tokens in and out, cost at a dated price table, duration, tool
   calls, model identifier.
3. A model is judged by rate, not by one run: N ≥ 3 per case for a first look, more when the decision
   depends on a small difference.
4. The report compares configurations side by side, with N and spread.

**What we met.**
- *Binary fitness hides variance.* The first optimiser in Maestro used a pass/fail per checkpoint and
  measured "neither a score per feature, nor a rate over N runs, nor the variance"
  (`docs/REPRISE-2026-09-29-moteur.md`, §3, "Partiel ou vide").
- *Simulated numbers.* The research service returns a hard-coded fitness:
  `return Task.FromResult(0.88); // Simulated fitness score`
  (`apps/backend/src/Maestro.Infrastructure/Research/ResearchTeamService.cs`, line 369). A harness that
  can return a number it did not measure is worse than none, because the number gets used.
- *A harness we can copy.* The guided-chef measurement in Marcel replays eight profiles three times
  under a 2.00 USD cap with thresholds on unresolved ingredients, budget, allergies, cost p90 and
  duration p90 (`docs/REPRISE-2026-09-29-moteur.md`, §5). It is a contract and a harness written by
  hand; it is the first candidate to move into Maestro.

#### M2 → M3: measure in service, link to versions, review

**Method.**
1. Emit a record for every run in service, not only test runs.
2. Put the environment fingerprint on every record: agent definition version, pinned model
   identifier, CLI version, plugins, settings hash, grid and recipe versions. dev-kit's keys are
   `cli_version`, `modele_session`, `plugins`, `settings_hash`, `recette_version`, `grille_qualite`
   (`tool_versions.py`, `ENVIRONMENT_KEYS`), plus socle and KB versions per task
   (`ADR-DEVKIT-0016-versions-par-tache.md`).
3. Record quality and estimation error **per agent**, with the agent's model, so that one agent's
   regression is not averaged away by another's progress.
4. Declare measurement windows, with the instrument versions they assume
   (`C:/Projects/dev-kit/telemetry/fenetres.json`), and compare only runs that match the window.
5. Review on a schedule. Every decision that claims an effect states its indicator, threshold and
   window, and the review gives it a verdict: validated, invalidated, not conclusive, or not
   measurable.

**What we met.**
- *Aliases drift.* Pin full model identifiers; an alias changed target twice in two weeks
  (`ADR-DEVKIT-0030`, Context). The ADR adds a test that refuses an agent definition whose model is
  not a full identifier.
- *Counters lie.* The output token counter under-counted by about 25 times (#295). Test the
  instrument against a known total from time to time.
- *Shared meters cannot be split.* Attribute a shared quota by cost and calibrate the conversion
  globally; never read a shared gauge per session (`ADR-DEVKIT-0028`, Decision).
- *Raw data disappears.* 67 % of sub-agent transcripts (864 of 1,293) had already been deleted when
  the context of past tasks was needed (`ADR-DEVKIT-0028`, Context). What is not extracted at run time
  may not be recoverable later.
- *An unmeasurable decision cannot be reviewed.* One decision in three stated a measurable effect;
  the review recommends that every decision line with an announced effect carry indicator, threshold
  and review date (`revue-rapport.md`, §1.3 and §5, rank 7).
- *Measure the instrument before the window.* The freeze of 2026-10-06 started with a written
  instrument check and four reserves (`verification-avant-gel.md`). One of them, the `socle_sha` of
  the window, still reads `null` in `telemetry/fenetres.json` at the time of writing; the
  verification report says the pilot sets it at the start of the window (reserve R1).

### 4.4 Security

#### S0 → S1: put a person before the write

**Method.**
1. The agent prepares the write (a pull request, a migration file, a command) and stops.
2. A person applies it, or approves it through a mechanism the agent cannot trigger itself.
3. Record each approval and each refusal.

**What we met.**
- *A review channel nobody uses is not a review.* The decision queue: 4 answers out of 32 cards, 190
  synchronisations (`revue-rapport.md`, §1.1, ADR-0020). The owner decides in conversation. Put the
  approval where the person already is.
- *False urgency bypasses review.* The pilot once presented an urgent direct fix to the main branch of
  a product that had no users yet; the owner's answer was to wait for the normal release
  (`C:/Projects/cockpit/DECISIONS.md`, 2026-10-03, "Failles de Marcel"). Urgency is a claim that
  needs evidence like any other.

#### S1 → S2: move the routine check into the tool

**Method.**
1. Write the preconditions of the write as code: verdict present and positive, checks green, head
   unchanged since the verdict, target branch an ancestor of the head, message valid.
2. Make the write possible only through that code for the agent.
3. Never bypass the gate; fix what it refuses.

**What we met.**
- *The merge gate.* Loop agents never merge. The pilot may squash-merge only after an `approved`
  verdict, with green gates, an unchanged head and the publication branch as ancestor
  (`ADR-DEVKIT-0009`, Decision). The builder's definition forbids `gh pr merge`, pushes to the
  publication branch and `--force` (`C:/Projects/dev-kit/adapters/claude/agents/builder.md`, lines 23
  to 24).
- *The message gate.* The `commit-msg` hook refuses a commit whose type, subject or trailers are
  invalid, and the rule is to rewrite the message, "never by `--no-verify`"
  (`C:/Projects/dev-kit/conventions/commits.md`, "Contrôle mécanique").
- *Reviewer complacency.* The reviewer's definition names the failure it fights: "without a hard
  constraint, a reviewer tends to approve, especially when the tests pass", and requires fresh command
  output for every claim (`judge.md`, lines 9 to 11 and 35 to 36). A verdict without command output
  for each gate is invalid and is redispatched (`judge.md`, lines 18 to 20).
- *Exceptions are written.* When the retry cap was reached for reasons that were not the builder's,
  the third pass was granted in writing, limited in scope, and the pilot did not fix the code itself
  (`C:/Projects/cockpit/DECISIONS.md`, entry "2026-10-05 10:55").

#### S2 → S3: declare, review, audit, expire

**Method.**
1. Declare every right in a versioned file: who may write what, where, and for how long.
2. Change that file only through a reviewed change.
3. Log each use of a right with the run identifier.
4. Give rights an expiry: a lock with a time-to-live, a token that ends with the session.

**What we met.**
- *Rights in one place.* The cockpit's registry is "the only source for path, branch, model, effort"
  (`C:/Projects/cockpit/CLAUDE.md`, "Règles"). Sessions are capped at three in parallel
  (`C:/Projects/cockpit/registry.yaml`, line 3; enforced in `scripts/run.py`, lines 183 to 185), and
  each project lock expires after 30 minutes (`scripts/locks.py`, docstring).
- *Settings are the owner's.* The pilot's attempt to change its own settings was refused as
  self-modification, "rightly: these acts are the owner's" (`C:/Projects/cockpit/DECISIONS.md`, entry
  "2026-10-05 15:42"). An agent that can widen its own rights is at S0, whatever else is in place.
- *Exceptions do not become rules.* Model prices were added by a builder, against the rule that loop
  agents never edit that file, under a written, dated, one-off derogation with the source cited
  (`C:/Projects/cockpit/DECISIONS.md`, entry "2026-10-05 10:55"; `telemetry/README.md`, row
  `prix-modeles.json`).


---

## 5. Prove feasibility, then optimise

This section is the core of Maestro's optimisation. It fixes the order of work: **first show that
the job can be done at all, then make it cheaper without making it worse.** Optimising before the
first step has no meaning, because there is nothing to compare against.

**What Maestro optimises: the environment, never the model.** Maestro does not train models. It
builds environments for models, and it is the environment that is trained and optimised: the blocks
and their layout, the prompts, the tools and the constraints they carry, the context supplied, the
routing between models, the choice of a smaller or local model, and the replacement of model steps
by deterministic code. The model itself is a fixed black box: its weights are never changed by
Maestro. The fitness therefore scores an environment around a model, and the model identifier is one
variable of that environment, like the prompt or the tool list. When Maestro's documents speak of
"training" (`docs/guides/ai-agents/mentality.md`, `maestro training start`), this protocol reads it
as training the environment.

### 5.1 Why this order

Three reasons, from our own work and from public guidance.

1. **Without a reference, an optimisation cannot be judged.** When we changed the estimator's model,
   the comparison came out "not conclusive" partly because the alias had moved and partly because
   nothing fixed what "as good as before" meant (`revue-rapport.md`, §1.2). A frozen reference with a
   floor answers that question before the change is made.
2. **Starting small hides the cause of failure.** If a small model fails, we cannot tell whether the
   task is impossible, the prompt is wrong, or the model is too weak. A strong model that succeeds
   removes the first two doubts.
3. **Public guidance from two model providers says the same.**
   - OpenAI, *A practical guide to building agents*, section "Selecting your models" (p. 8): "An
     approach that works well is to build your agent prototype with the most capable model for every
     task to establish a performance baseline. From there, try swapping in smaller models to see if
     they still achieve acceptable results." The guide sums this up in three principles: "Set up evals
     to establish a performance baseline", "Focus on meeting your accuracy target with the best models
     available", and "Optimize for cost and latency by replacing larger models with smaller ones where
     possible." (read 2026-10-06)
   - Anthropic, *Choosing the right model*, "Option 2: Start capability-first": "implement with the
     strongest starting point for your task, then optimize to more efficient models down the line",
     with the steps "Evaluate if performance meets your requirements" and "Consider increasing
     efficiency by lowering effort or downgrading models over time with greater workflow
     optimization". The same page, under "Decide whether to upgrade or change models", says "having a
     good evaluation set is the most important step in the process". It also notes that tuning effort
     "is often a better lever than switching models". (read 2026-10-06)
   - The same page offers an "efficiency-first" option for prototyping and high-volume simple tasks.
     This protocol chooses capability-first for any workflow of class 2 and above, because for those
     the cost of an undetected quality loss exceeds the cost of the strong model during the proof.

### 5.2 Step A: prove feasibility with a strong model

**Goal.** Show that the contract can be met, regardless of cost.

**Method.**
1. Write the contract first: inputs, outputs, tools, acceptance checks, budget for the proof itself
   (§7.2). The checks are written before any run.
2. Build the case set (M1). Use real inputs. Include refusal cases.
3. Run with the most capable model available to you for the task, at a generous reasoning effort,
   with a plain prompt and the full tool list allowed by the contract.
4. Run each case N times (N ≥ 3). Record everything the harness records (M2).
5. Iterate on the prompt, the step layout and the tools until the acceptance checks pass at the rate
   the contract requires. Do not optimise cost yet.
6. If the strong model cannot meet the contract within the proof budget, stop. The finding is that
   the contract is not feasible as written. Report the best approach and what was missing
   (`docs/REPRISE-2026-09-29-moteur.md`, §4.2, last paragraph). Change the contract by a reviewed
   decision, or drop the workflow.

**Output.** The **reference configuration**, and the evidence that it meets the contract.

### 5.3 Step B: freeze the reference

**Goal.** Make "as good as the reference" a number that any later candidate can be compared to.

**Method.**
1. **Pin the reference.** Record its full configuration: model identifier (never an alias, see
   `ADR-DEVKIT-0030`), effort, prompt hash, step layout, tool list, and the environment fingerprint.
2. **Accept the outputs.** The owner or an independent reviewer accepts the reference outputs case by
   case. Accepted outputs become **expected outputs** for the checks that compare content. Outputs
   that were wrong but passed reveal a missing check: add it and rerun.
3. **Set the floor.** The floor is the minimum score that a candidate must reach. Default rule:
   - per check that guards safety or a hard rule (schema validity, a refusal case, a stop-loss, a
     forbidden tool call): **100 %, no tolerance**;
   - per quality feature: the reference's rate minus the measured run-to-run spread of the reference
     itself, never lower than the contract's declared minimum;
   - the floor is written on the baseline card (§7.5) with N and the spread used.
4. **Freeze the case set version and the scorer version** used to set the floor. A later change of
   either is a new baseline, not a comparison.
5. **Keep the evidence replayable.** Store the reference traces so that a regression can be replayed
   when a model or tool changes (`docs/REPRISE-2026-09-29-moteur.md`, §4.4, "La preuve").

Without step B, a cheaper candidate that is a little worse looks like a success. With it, the
question "is it still good enough?" has a precise answer.

**A note on Maestro's fitness formula.** Maestro's `FitnessScore` divides quality terms by a cost term
raised to λ (`apps/backend/src/Maestro.Domain/ValueObjects/FitnessScore.cs`, summary). The record is
named after a model, but under this protocol the unit it scores is the environment around a fixed
model, with the model identifier as one of the environment's variables. A ratio can
rank a cheaper, worse candidate above a dearer, better one. Under this protocol the floor is a hard
constraint applied **before** any ratio: a candidate under the floor is eliminated, not ranked. This
is consistent with the engine design, where hard constraints eliminate before scoring
(`docs/REPRISE-2026-09-29-moteur.md`, §4.3, step 4), and with the contract rule that a block is valid
only if each active feature reaches its own minimum (`docs/system/architecture/contracts.md`, line
126).

### 5.4 Step C: optimise one variable at a time, under measurement, in shadow

**Goal.** Reduce cost and latency while staying above the floor.

**Rules.**
1. **One variable per candidate.** A candidate differs from the current best in exactly one
   variable. Two changes at once make the result unattributable. Our weekly cycle applies the same
   rule to the whole tool chain (`C:/Projects/cockpit/DECISIONS.md`, 2026-10-05, "Bilan = cycle
   d'amélioration continue": "Une variable à la fois").
2. **Same cases, same scorer, same N.** The candidate runs on the frozen case set with the frozen
   scorer.
3. **Shadow before service.** For a workflow in service, the candidate runs in shadow on live inputs
   for a declared window and its outputs are compared with the reference's, before it replaces
   anything. Our estimator already works this way: the v3.1 recipe and an affine form are computed
   at each estimate and recorded, without being shown as commitments
   (`C:/Projects/dev-kit/docs/decisions/ADR-DEVKIT-0029-recette-v4s.md`, Decision, point 3).
4. **Accept only above the floor.** A candidate that passes the floor and lowers cost becomes the new
   current best. The reference and its floor do not move.

**The levers, in the order we try them.** All of them change the environment; none changes the
model. Cheap and reversible first.

| # | Lever | What changes in the environment | Notes |
|---|---|---|---|
| 1 | Reasoning effort | A setting of the model call | The provider calls it "often a better lever than switching models" (Anthropic page, §5.1). Cheapest to try; nothing else changes. |
| 2 | Context supplied | What the model is given: documents, history, examples, window strategy | Remove what the checks show is unused; add the one example that fixes a failing case. Few-shot examples are, in our notes, "the single most powerful lever for improving output quality" for small models (`content/system/docs/models/smollm2-1.7b.md`, Prompt Engineering 2). |
| 3 | Prompt | Instruction text and response format | Shorten one block at a time; replace abstract instructions by measurable ones ("Shorten the description to 5 words" reached 39 % success against 0 % for "make compact", `smollm2-1.7b.md`, Prompt Engineering 1). |
| 4 | Tools and their constraints | Which tools are exposed, and the checks they carry | Expose fewer tools; move constraints into the tools (I3, §4.2); add an independent validator on the output. Fewer doors also means fewer wasted calls. |
| 5 | Replace model steps with code | Block layout | Every field a script can compute moves to a script (D3, §4.1). This lowers cost and raises Determinism at the same time. It is the lever with the best long-run return. |
| 6 | Smaller hosted model | Model selection | Next model down in the same family first, then the smallest. Pinned identifiers only. The model is swapped, never modified. |
| 7 | Routing between models | Which model handles which step or which input | A cheaper model for the mechanical steps and a stronger one for the decisions that need judgement; the provider describes executor-advisor and orchestrator-worker patterns and requires that "A multi-model configuration must beat the single model's whole curve" (Anthropic, *Optimizing for cost and intelligence*, read 2026-10-06). |
| 8 | Local model | Model selection and provider | For example SmolLM2-1.7B, measured in our notes at fitness 0.85 to 0.95 on JSON generation, and not recommended for code or long text (`smollm2-1.7b.md`, front matter and Limitations). The 360M variant rarely exceeds 0.70 on structured output (`smollm2-360m.md`, Known Issues 2) and is a comparison baseline, not a production choice. Check that the model's licence permits the intended use (SmolLM2-1.7B-Instruct is published under Apache 2.0, model card read 2026-10-06). |

**What each candidate records.** Configuration diff against the current best (one line), N, pass rate
per check and per feature, cost per run at the dated price table, latency p50 and p90, and the
verdict: above floor and cheaper (accept), above floor and not cheaper (discard), below floor
(discard and note the failing checks).

### 5.5 Out of scope: changing the model

Maestro never changes a model's weights. Fine-tuning, adapters (for example LoRA) and distillation
are outside this protocol and are not optimisation levers. Maestro's repository documents LoRA for
an image-generation side project (`docs/concepts/lora-fine-tuning.md`); that document stays a
concept note and does not define a lever of this protocol.

Two consequences follow.

1. **Outputs are evidence, not training data.** Reference outputs, accepted outputs and shadow
   outputs are kept to score environments and to replay regressions. They are not used to train any
   model. This also keeps us clear of provider terms: Anthropic's Commercial Terms, section D.4, say
   the customer may not "access the Services to build a competing product or service, including to
   train competing AI models" (read 2026-10-06).
2. **A model change is a selection, not a modification.** Moving to a smaller, local or routed model
   (levers 6 to 8) swaps one fixed black box for another inside the same environment, under the same
   floor and the same one-variable rule.

### 5.6 Step D: stop at the floor

**Rule.** Optimisation stops for a workflow when the next candidate falls below the floor and no
remaining lever is cheaper to try than the expected saving. The current best stays in service.
Nothing ships below the floor, whatever it saves.

**Judgement roles.** A workflow whose job is to judge (a reviewer, an evaluator, an estimator's
closing analysis, a risk check) moves to a smaller model **only after a shadow trial** in which both
models judge the same items and their disagreements are examined one by one. The reason is that a
weaker judge fails quietly: it approves more, and an approval looks like success. Our record shows
why the trial must be designed in advance. The estimator's move to a stronger model was "not
conclusive" against the intermediate model because the comparison had no fixed set and the alias had
moved (`revue-rapport.md`, §1.2), and the planned move of the researcher to a smaller model was
postponed (`C:/Projects/cockpit/DECISIONS.md`, 2026-10-05, "#298 ... Sonnet repoussé").

**Re-baseline.** The reference is re-established, not adjusted, when the contract changes, when the
case set gains cases that the reference fails, or when the reference model is retired by its
provider. A re-baseline goes back to Step A.

### 5.7 Step E: the cycle in Maestro and in our week

The cycle above is Maestro's mentality made precise. The mentality guide asks every agent to
execute the workflow, evaluate the results, improve the blocks, and iterate until quality objectives
are met, and its Rule 4 is "Measure Before and After" (`docs/guides/ai-agents/mentality.md`, §1 and
§2).

| Mentality step (`mentality.md`) | In this protocol |
|---|---|
| Measure (before) | Freeze the reference and its floor (Step B). |
| Execute | Run the candidate on the frozen case set, N times, in shadow when in service (Step C). |
| Evaluate | Compare to the floor first, then to the current best on cost (Steps C and D). The fitness ranks only candidates above the floor (§5.3). |
| Improve | Change exactly one variable, chosen from the lever table (§5.4). |
| Iterate | Until the floor stops you (Step D), or the contract changes (re-baseline). |

The same cycle runs at the scale of our tool chain, on a weekly rhythm decided on 2026-10-05
(`C:/Projects/cockpit/DECISIONS.md`, "Bilan = cycle d'amélioration continue" and "Semaine du 5
octobre"):

- **Monday to Friday, the shared tooling is frozen.** Agents work on products, and the telemetry
  measures the frozen configuration. The window and its instrument versions are declared in
  `C:/Projects/dev-kit/telemetry/fenetres.json`, and tasks outside the declared instrument are
  classified apart (`ADR-DEVKIT-0028`, "Fenêtre de mesure").
- **At the weekend, a team of research agents reviews the week**: telemetry, quality, estimation,
  decisions, logs, and public sources. They validate or invalidate the previous week's changes against
  the thresholds those changes declared, and they prepare the next changes, one variable each.
- **The changes are applied before Monday**, and the next weekend revalidates them.

A Maestro block follows the same rhythm when it is in service: candidates run in shadow during the
week; the weekend review accepts, rejects or extends the trial.

### 5.8 Summary of Section 5

1. Contract and checks first.
2. Strong model, generous effort, until the contract is met. If it cannot be met, stop and report.
3. Pin the reference, accept its outputs, set the floor. Safety checks have no tolerance.
4. One variable at a time, same cases, same scorer, in shadow.
5. Levers act on the environment only, in order: effort, context, prompt, tools and their
   constraints, code instead of model steps, smaller model, routing, local model.
6. The model is a fixed black box: no fine-tuning, no adapters, no outputs used as training data.
7. Stop at the floor. Judges move down only after a shadow trial.
8. Weekly: freeze, measure, review, change one thing.


---

## 6. Worked examples

Each example applies §3 and §2 to a workflow we run, with the evidence found in the repositories on
2026-10-06. Where the evidence was not found, the level says so. The examples are deliberately
critical: the point is to find the next level to climb, not to grade ourselves well.

### 6.1 The dev-kit reviewer (class 2, gating a class 3 act)

**What it does.** The `judge` agent reviews a pull request against its checklist and the project's
gates, in two stages (conformity, then quality), and publishes a review. It never fixes and never
merges (`C:/Projects/dev-kit/adapters/claude/agents/judge.md`).

**Classification.** Output: a structured verdict and a published review (R2). Taken alone, its
impact is medium: a wrong verdict is a record that later steps can still catch. Class 2. But the
pilot merges on `approved` (`ADR-DEVKIT-0009`), so by gate inheritance (§3.3) the reviewer takes the
class 3 minimum on Security and Measurability, and a wrong approval may surface only days later.
Required: `D2 I1 M2 S2` (the class 3 minimums on S and M are the same levels as class 2, but the
review of its measurements must look at false approvals specifically).

**Assessment.**

| Dim. | Level | Evidence |
|---|---|---|
| D | **D2** | Verdict validated against `C:/Projects/dev-kit/schemas/review-verdict.schema.json`: `verdict` is one of `approved`, `request_changes`, `rejected`, `needs_input`; anomaly severity is closed; proofs must match `file:line` or `absent: ...`. A verdict without command output for each gate is invalid and redispatched (`judge.md`, lines 18 to 20). Not D3: the pattern checks the shape of `file:line`, and no script found re-checks that the cited line exists. |
| I | **I2** | Tool list `Read, Grep, Glob, Bash, TaskStop`, no `Write` or `Edit` (`judge.md`, front matter and lines 13 to 14); clean checkout of the PR; deliberate context deprivation (`judge.md`, "Privation de contexte délibérée"). Not I3: `Bash` is unconstrained beyond the worktree guard. |
| M | **M0** (by the cumulative rule) | Continuous telemetry exists: spans per agent with model (`telemetry/agents.jsonl`), pinned model (`ADR-DEVKIT-0030`). But no fixed case set of pull requests with known outcomes was found (`scripts/tests/test_loop_sheets.py` checks the definition files, not verdict quality). The weekly review could not compare reviewer models: "n = 2" verdicts on the alternative model (`revue-rapport.md`, §1.1, ADR-0012 row). |
| S | **S2** | The reviewer only publishes a review. The merge it gates is done by the pilot under the preconditions of `ADR-DEVKIT-0009`. |

**Gap and next step.** The reviewer is below its class minimum on M. The cheapest climb is an M1 case
set built from history: the 140 merged PRs of the first measured week include 14 with a defect found
after merge (`revue-rapport.md`, §1.1, ADR-0008 row). Freeze those PR heads with their known outcome,
add a few seeded defects, and replay. That set is also what §5.6 requires before the reviewer may
move to a smaller model.

### 6.2 The estimator and the v4s recipe (class 2)

**What it does.** At planning time, the `estimator` produces a duration and token estimate with an
interval; at closing time it compares with the actual and proposes an adjustment
(`C:/Projects/dev-kit/adapters/claude/agents/estimator.md`). Since v4s, the duration is computed by a
script from a per-project, per-step base and weights (`ADR-DEVKIT-0029`, Decision).

**Classification.** Output: estimate records and recipe proposals (R2). Impact: medium (estimates
steer scheduling; errors are caught at closing). Class 2. Required: `D2 I1 M2 S2`.

**Assessment.**

| Dim. | Level | Evidence |
|---|---|---|
| D | **D3** | Schema `C:/Projects/dev-kit/schemas/estimate.schema.json` closes the acting fields (class, nature, points, recipe pattern `^v[0-9]+[a-z]*$`, pinned builder model pattern). The duration is computed by `estimate_recipe.py apply-v4s` from `telemetry/estimation-v4s.json`, which also returns the file's SHA-256 (`ADR-DEVKIT-0029`, "Mise en œuvre"). The model classifies and explains; the script computes. Caveat: the silent fallback on a lower-case project name (#322) is a D3 defect to fix. |
| I | **I2** | Tools `Read, Bash` only (`estimator.md`, front matter). Not I3: `Bash` unconstrained. |
| M | **M3** | Case set: retro-test on 214 closed tasks of 7 projects (`ADR-DEVKIT-0029`, Context). Harness: the recipe script and the bilan scripts (`cockpit/docs/bilan/2026-10-05/estimation-scripts/`). In service: every estimate is recorded with recipe version and fingerprint; the freeze window declares `v4s` (`telemetry/fenetres.json`); review scheduled on 2026-10-10 (`ADR-DEVKIT-0029`, header). Shadow forms (v3.1 and affine) are recorded at every estimate. |
| S | **S2** | Recipe parameters are changed by a reviewed PR, not by the estimator: the grids are "revised by hand by a dedicated issue, never by a loop agent" (`telemetry/README.md`, rows `grille-points.md` and `grille-qualite.md`). The estimator only proposes, in a journal. |

**What it shows.** This is the closest we have to §5 in practice. The previous recipe was invalidated
by its own declared threshold: median absolute error 40 % against a 25 % threshold
(`revue-rapport.md`, §1.1, ADR-0006 row). The replacement was chosen on a fixed set with a temporal
validation: v4s at 20.9 % median error and 82 % of actuals inside the interval, against 28.2 % and
60 % for the affine form (`ADR-DEVKIT-0029`, Options). Competing forms keep running in shadow. The
change of the estimator's model, by contrast, was made without a fixed comparison set and ended "not
conclusive" (`revue-rapport.md`, §1.2): the same agent shows both the right and the wrong way.

### 6.3 The builder that opens a pull request (class 3)

**What it does.** The `builder` implements a plan test-first, one checklist item per commit, runs the
project's gates and opens the pull request. It is the only loop agent that may change code. It never
merges (`C:/Projects/dev-kit/adapters/claude/agents/builder.md`).

**Classification.** Outputs: commits on a work branch and a pull request (R3); a build verdict (R2).
Impact: high (a defect can ship to a product). Class 3. Required: `D2 I2 M2 S2`.

**Assessment.**

| Dim. | Level | Evidence |
|---|---|---|
| D | **D2** | Build verdict validated against `schemas/build-verdict.schema.json` (status closed to `pr_created`, `failed`, `blocked`, `needs_input`; item identifiers by pattern; gate results closed to `ok`, `ko`, `non_lance`). Commit messages checked by the `commit-msg` hook (`conventions/commits.md`, "Contrôle mécanique"). The code itself is checked by the project's gates and then by the reviewer. |
| I | **I2** | Own branch per issue, `<type>/<issue>-<slug>` from the work branch (`builder.md`, Method step 1); work files in a per-session temporary directory (`builder.md`, lines 40 to 54); tool list declared; worktree guard in the runtime (`revue-rapport.md`, §2.2, friction 3). Not I3: `Bash`, `Write` and `Edit` are constrained only by the worktree boundary. |
| M | **M3** for cost and time, **M2** for quality | Every task carries spans per agent with tokens, model and the environment fingerprint (`tool_versions.py`; `ADR-DEVKIT-0016`). Quality is scored at closing by the `evaluator` on grid q3.1 (`telemetry/grille-qualite.md`). But the grid's notes do not separate PRs that later had a defect from those that did not (`revue-rapport.md`, §1.1, ADR-0008 row; `grille-rapport.md`, §1), so quality measurement exists without yet being valid. |
| S | **S2** | No merge, no push to the publication branch, no `--force` (`builder.md`, lines 23 to 24); merge by the pilot after the reviewer's approval and green gates (`ADR-DEVKIT-0009`). |

**Traps met.** Waiting for a red CI that could not pass (§1.1). Full test suites run in series: 44.8
hours for dev-kit in one week (`revue-rapport.md`, §2.2, friction 1); the parallel runner was tested
but deliberately postponed so as not to change two variables during the freeze (`revue-rapport.md`,
§3, R1).

**Next step.** Make the quality instrument predictive (q4 in shadow, `grille-rapport.md`), then use
it as the floor for any builder model change.

### 6.4 Money-Core (class 4: no code touches real money)

**What it does.** Money-Core is a single-process algorithmic trading application, paper-only, "live-ready
by design" (`C:/Projects/Perso/Money-Core/CLAUDE.md`, "Project identity"). A model-driven decider is
specified but not yet built: the model reads through tools and returns a JSON plan; a deterministic
`PlanExecutor` passes each order through the risk gates; only admitted orders reach the paper broker
(`Money-Core/docs/specs/2026-09-27-decideur-du-matin-design.md`, lines 63 to 68 and 168).

**Classification.** Today: paper orders on a testnet (R3, medium). Target: real orders (R4). The
protocol classifies by the target, because the code is being written for it: class 4. Required:
`D3 I3 M3 S3`, plus human approval of every irreversible act.

**Assessment.**

| Dim. | Level | Evidence |
|---|---|---|
| D | **D3 by design, not yet built** | The design keeps every order decision in code: plan validated by a schema, `PlanExecutor` the only component that calls `broker.submit` for the decider, and only after `evaluate_pipeline` (design, line 168). Hard rules in code: `Decimal` for money, stop-loss mandatory on every buy (`CLAUDE.md`, "Hard rules"). `src/money_core/decider/` does not exist yet on `origin/dev` at `ed99e0d`; only `risk/decider_gates.py` does. |
| I | **I3 for the real-money boundary** | `_select_broker` raises `LiveModeLockedError` for `mode=live` "whatever `require_paper_broker` is" (`src/money_core/cli.py`, lines 305 to 336); credentials are scoped by mode; tests in `tests/unit/test_decider/test_live_lock.py` check the lock without loading the machine's `.env`. The model has no write tool in the design (design, line 168). |
| M | **M1** | Paper runs with a declared proof and a daily reading in `STATUS.md` (commits "consigner la lecture du jour" #50 to #52); the first run was an empty proof (§1.1). No harness for the decider yet, since the decider does not exist. |
| S | **S3 for the boundary, human mandatory** | The passage to real money is milestone M8, closed only by the owner, after M1 to M7 and a paper Sharpe of at least 1.2 over 14 days or the owner's threshold; the lock is lifted only by code the owner reviews (milestone ladder recorded on 2026-09-29; `cli.py`, line 289 comment "Live (MAIN) is opt-in and gated"). The design states the live mode stays unreachable until the owner adopts it (design, line 5). |

**What it shows.** Class 4 is not reached by making the agent better. It is reached by making the
irreversible act unreachable to the agent: the model proposes, code checks, a person unlocks. The
protocol's rule 3 of §3.4 is already the project's rule. The open risk is Measurability: M3 for a
decider means every plan, every gate outcome and every refusal logged with the fingerprint, which the
design requires ("each step, including a refusal, writes a line in the journal", design, line 68) and
which does not exist yet.

### 6.5 The cockpit pilot and its child sessions (class 3, with reserved acts)

**What it does.** The pilot does not develop. It launches and follows one child session per project,
merges approved pull requests, keeps the decision log, and runs the weekly review
(`C:/Projects/cockpit/CLAUDE.md`).

**Classification.** Outputs: merges into project trunks (R3, high impact), launches of sessions that
spend shared quota (R2, medium), the decision log (R2). Reserved acts stay with the owner (§3.4, rule
5). Class 3. Required: `D2 I2 M2 S2`.

**Assessment.**

| Dim. | Level | Evidence |
|---|---|---|
| D | **D1** | Session launches go through `scripts/run.py` with typed arguments; merges follow the precondition list of `ADR-DEVKIT-0009`. But the decision log is free text (`C:/Projects/cockpit/DECISIONS.md`), and 273 merge preparation commands were composed by hand for 107 merges (`revue-rapport.md`, §2.2, friction 5). The proposed `merge_pr.py` would move this to D3 (`revue-rapport.md`, §3, R5, untested). |
| I | **I2** | One session per project, a lock per project with a 30-minute expiry (`scripts/locks.py`), at most three sessions (`registry.yaml`, line 3; `scripts/run.py`, lines 183 to 185); the pilot does not read child transcripts (`CLAUDE.md`, "Règles"). Scheduled weekly sessions run under an I3 guard (`scripts/weekly_guard.py`); the interactive pilot does not. |
| M | **M2** | The pilot's own measurement: 218 owner messages hand-labelled, corrections per 100 messages 15 then 31 by week, a rule-based classifier `pilote_mesure.py` (`pilote-rapport.md`, §1 and §2). Quota attributed by cost (`ADR-DEVKIT-0028`). Not M3 yet: the measure is retrospective and not yet tied to a declared window. |
| S | **S2** | Merges only after `approved` and the gate list (`ADR-DEVKIT-0009`); settings changes refused as self-modification and left to the owner (`DECISIONS.md`, "2026-10-05 15:42"). Toward S3: rights are declared in `registry.yaml` and locks expire, but the merge right itself is not declared per project in a reviewed file with a use log. |

**Gap and next step.** D is below the class minimum. Two moves: a merge script that refuses at the
first failed precondition (D3 for the most frequent write), and a typed decision record with
indicator, threshold and window (`revue-rapport.md`, §5, rank 7).

### 6.6 A Maestro block optimised by Section 5 (worked design)

This example shows the procedure on a block whose environment Maestro already trains, a commit-message generator
(the "foundry-default (gen-commit)" sessions in `content/system/docs/models/smollm2-1.7b.md`,
Overview). **The numbers below are not measurements.** They are placeholders that the run fills in;
the procedure is the point.

**Contract (§7.2).** Input: a staged diff and the issue number. Output: `{type, scope, subject, body,
refs}`. Acceptance checks: the message passes `commit_msg.py` (type in the closed list, subject rules,
trailers); the type matches the diff (a test-only diff is `test`); the subject names the main change
(checked against a hand-written expected subject with a similarity threshold plus a yes/no reviewer
question); no content outside the diff is claimed. Class 2 (the message is checked by a hook and read
by a reviewer before merge). Required: `D2 I1 M2 S2`.

**Step A, feasibility.** 60 cases from real diffs of our repositories, weighted by type, 10 of them
hard (mixed changes, renames, generated files), 5 refusal cases (empty diff, binary only). Strong
hosted model, default effort, plain prompt. N = 3. Iterate until the checks pass at the contract rate.

**Step B, freeze.** Pin the model identifier and prompt hash. The owner accepts the outputs; their
subjects become expected subjects. Floor: 100 % on the hook check and the refusal cases; the
reference rate minus its own spread on the type and subject checks.

**Step C, levers, one at a time, each in shadow for a week on live commits.**

| Order | Candidate | Expectation (*hypothesis*) | Decision rule |
|---|---|---|---|
| 1 | Same model, lower effort | Lower cost, same quality | Keep if above floor. |
| 2 | Next smaller hosted model | Lower cost | Keep if above floor. |
| 3 | Type and refs computed by script from the diff and branch name; the model writes only subject and body | Lower cost, D3 on two fields | Keep if above floor; this raises the card to D3 for those fields. |
| 4 | Local SmolLM2-1.7B with two few-shot examples, temperature 0.3 (`smollm2-1.7b.md`, "Example Maestro Configuration") | Near-zero marginal cost | Keep if above floor. The model notes say it handles short structured outputs and degrades past about 500 tokens: long bodies may fail. |
| 5 | Routing: the local model writes the subject; when the hook check or the type check fails, the same input goes to the hosted model of step 2 | Most cost at the local rate, quality held by the fallback | Keep if above floor **and** cheaper than step 3 at the measured fallback rate. The models are not modified: only the routing rule changes. |

**Step D, stop.** If step 4 falls under the floor on subjects and step 5 does not recover it at a
lower cost, the block stays at step 3: a smaller hosted model writing two fields, with code writing
the rest. At no step is a model trained or adapted: every candidate is a different environment around
an unchanged model (§5.5).

**What the card records at the end.** Reference, floor, every candidate with its one-line diff, N,
rates, cost per run, latency, verdict, and the date of the weekly review that accepted it.


---

## 7. Templates

Copy a template into the workflow's repository, next to its definition, and fill it in. A field left
empty is written `unknown`, never deleted. Every "evidence" cell holds a path, a command with its
output, or a measurement with N and window.

### 7.1 Classification card

```markdown
# Classification card: <workflow name>

- Owner: <person>
- Definition: <path to agent or block definition>, version <sha or tag>
- Date: <YYYY-MM-DD>   Reviewed by: <person>   Next review: <date or trigger>

## Outputs

| # | Output (including side effects) | Reach (R1-R4) | Reversibility | Detection | Spread | Cost | Impact | Class |
|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | |

Gate inheritance: does any output gate another act? <no | yes: which act, which class>

Workflow class: <1-4>   Reserved acts involved: <none | list>

## Profile

| Dimension | Required (§3.4) | Current | Evidence | Gap |
|---|---|---|---|---|
| Determinism | | | | |
| Isolation | | | | |
| Measurability | | | | |
| Security | | | | |

Runs in service: <yes | no: shadow only | no: sandbox only>
Reason if below minimum: <...>   Plan to climb: <issue links>
```

### 7.2 Input and output contract

```markdown
# Contract: <workflow name>, version <n>

## Inputs
| Name | Type / schema | Provenance (given, asked, derived) | Constraints |
|---|---|---|---|

## Outputs
| Field | Type / schema | Acting? (does code act on it) | Constraint (enum, range, pattern, checked reference) | Produced by (model, script) | Verified by |
|---|---|---|---|---|---|

Schema file: <path>   Validator: <path:function>   Invalid output policy: <fail | retry n then fail>

## Tools
| Tool | Purpose | Argument constraint inside the tool | Unconstrained? |
|---|---|---|---|
Undeclared tools are refused by: <runtime mechanism>

## Provider
Model identifier (pinned): <id>   Effort: <level>   Temperature: <value>
Credentials: <environment variable name only, never the value>

## Acceptance checks
| Id | Check | Type (deterministic, model-judged) | Applies to | Required rate over N |
|---|---|---|---|---|
Deterministic checks run before any model-judged check.
Model-judged checks follow protocolized judgment (§2.2): grid path <...>, grid version <...>,
double-pass share <...>, agreement threshold <...>.

## Budget
Max cost per run: <amount>   Max latency p90: <seconds>   Max cost of the proof (§5.2): <amount>

## Target levels
D<n> I<n> M<n> S<n>  (class <n>)
```

### 7.3 Validation plan

```markdown
# Validation plan: <workflow name>, contract version <n>

## Case set
Path: <path>   Version: <sha>   Cases: <count>   Of which hard: <n>   Refusal cases: <n>
Source of inputs and weighting: <...>
Written by: <person or agent, not the author of the configuration under test>

## Harness
Command: <...>   N per case: <n>   Price table: <path>, dated <YYYY-MM-DD>
Recorded per run: outcome per check, tokens in/out, cost, duration, tool calls, model id, fingerprint

## Start check
What proves the measured event can occur on the first run: <...>

## Instrument check
Last check of the counters against a known total: <date, result>

## In service
Telemetry record: <schema path>   Fingerprint fields: <list>
Measurement window: <path to window declaration>   Noise floor at expected N: <value>

## Decision rule
Accept if: <...>   Reject if: <...>   Not conclusive if: <...>
Review date: <YYYY-MM-DD>   Reviewer: <person or review team>
```

### 7.4 Security review

```markdown
# Security review: <workflow name>, version <sha>

Class: <n>   Reviewer: <person>   Date: <YYYY-MM-DD>

## Writes
| Write | Target | Path to take effect | Gate (code path) | Can the agent bypass it? | Evidence of a refusal |
|---|---|---|---|---|---|

## Rights
| Right | Declared in (file) | Last reviewed change | Use logged in | Expiry |
|---|---|---|---|---|

## Isolation
Working area: <...>   Identity on writes: <...>
Tools and their argument checks: <table or link to contract §Tools>
Components that exist but are NOT on the execution path: <list>

## Reserved acts
Acts reserved to the owner that this workflow could reach: <list>
How each is made unreachable or approval-gated: <...>

## Secrets
Where credentials come from: <variable names>   Can the agent read their values? <no | yes: why>
Can the agent change its own settings or permissions? <must be no>

## Findings
| # | Finding | Severity | Owner | Due |
|---|---|---|---|---|
Verdict: <meets class minimum | below minimum: runs in shadow only>
```

### 7.5 Feasibility baseline card

```markdown
# Feasibility baseline card: <workflow name>

Contract version: <n>   Case set version: <sha>   Scorer version: <sha>
Date frozen: <YYYY-MM-DD>   Accepted by: <person>

## Reference configuration
Model (pinned id): <...>   Effort: <...>   Prompt hash: <...>
Step layout: <...>   Tools: <...>
Environment fingerprint: cli <...>, plugins <...>, settings hash <...>, grid <...>, recipe <...>

## Reference results (N = <n> per case)
| Check / feature | Rate | Spread across runs | Notes |
|---|---|---|---|
Cost per run p50 / p90: <...>   Latency p50 / p90: <...>
Traces stored at: <path>

## Floor
| Check / feature | Floor | Rule used (safety = 100 %, quality = reference minus spread, contract minimum) |
|---|---|---|

## Model selection
Models allowed as candidates (pinned ids): <...>
Licence of any local model, and whether it permits the intended use: <licence, link, date read>
Confirmation that no candidate modifies model weights (§5.5): <yes>

## Optimisation log
| Date | Candidate (one-variable diff) | N | Rates vs floor | Cost p50 | Latency p90 | Shadow window | Verdict |
|---|---|---|---|---|---|---|---|

Re-baseline triggers met: <none | which>
```

---

## 8. Appendix: self-assessment

This appendix places four of our systems on the matrix as of 2026-10-06. A system's level is the
level of its weakest workflow of the highest class it runs, because that is where an error costs the
most. Each cell gives the evidence, or `unknown` when none was found in the time available. The
assessment is the author's first pass and is expected to be challenged.

> **Note.** A parallel analysis of these four systems is in progress. Its results will be filed in
> this appendix when they are available, and any disagreement with the cells below will be resolved
> by evidence, cell by cell.

### 8.1 Summary

| System | Highest class run | D | I | M | S | Below minimum on |
|---|---|---|---|---|---|---|
| dev-kit (development loop) | 3 (builder) | D2 | I2 | M2 | S2 | none for the builder; the reviewer is below on M (§6.1) |
| cockpit (pilot) | 3 (merges) | D1 | I2 | M2 | S2 | D |
| Maestro (engine, current repository) | 3 when a block runs shell on a project | D1 | I1 | M1 | S1 | I, M, S |
| Money-Core | 4 (target) | D3 by design, unbuilt | I3 at the live boundary | M1 | S3 at the boundary, human required | M; D until the decider exists |

### 8.2 dev-kit

| Dim. | Level | Evidence | Unknown or missing |
|---|---|---|---|
| D | D2 | Every loop agent returns JSON validated against a schema in `schemas/` (`ADR-DEVKIT-0004`); closed enumerations and patterns in `review-verdict`, `build-verdict`, `estimate`, `evaluation-verdict` schemas; commit messages checked by `scripts/commit_msg.py`. D3 for the estimator's duration (`apply-v4s`). | Whether the consuming code validates every verdict file against its schema at read time, rather than trusting its shape: unknown. |
| I | I2 | Tool lists per agent in `adapters/claude/agents/*.md` front matter; worktree guard; KB guard (`scripts/kb_guard.py`, hook in `adapters/claude/hooks/hooks.json`). | `Bash` is granted to most agents without argument checks: no agent is I3. |
| M | M2 overall; M3 for cost, time and estimation | Fingerprint on tasks and spans (`scripts/tool_versions.py`); windows (`telemetry/fenetres.json`); weekly review (`cockpit/docs/bilan/2026-10-05/`). | Output tokens of sub-agents under-counted (#295, open); quality grid not yet predictive (ADR-0008 invalidated as a predictor); no fixed case set for the reviewer (§6.1). |
| S | S2 | No agent merges; pilot merge gate (`ADR-DEVKIT-0009`); hook refusals not bypassed (`conventions/commits.md`). | Per-project merge rights are not declared in a reviewed file with a use log: S3 not met. |

### 8.3 cockpit

| Dim. | Level | Evidence | Unknown or missing |
|---|---|---|---|
| D | D1 | Typed launch through `scripts/run.py`; scheduled sessions under `scripts/weekly_guard.py`. | Decision log is free text (`DECISIONS.md`); merges prepared by hand (`revue-rapport.md`, friction 5). |
| I | I2 | Locks with expiry (`scripts/locks.py`); session budget (`registry.yaml`, line 3; `scripts/run.py`, lines 183 to 185); I3 guard for scheduled weekly sessions. | The interactive pilot runs with the owner's machine-wide identity for some acts (settings refusals show the boundary, `DECISIONS.md`, "2026-10-05 15:42"); exact scope: unknown. |
| M | M2 | `pilote_mesure.py` (`pm-1`) and its hand-labelled reference (`cockpit/docs/briefings/scripts/`, per `pilote-rapport.md`); weekly review reports. | Not run continuously yet; no window declared for the pilot's own measures. |
| S | S2 | Merge preconditions (`ADR-DEVKIT-0009`); reserved acts listed (`pilote-rapport.md`, §1). | Use log of merge rights: unknown. |

### 8.4 Maestro

Assessed on the current repository, before the engine milestones E0 to E5
(`docs/REPRISE-2026-09-29-moteur.md`, §8).

| Dim. | Level | Evidence | Unknown or missing |
|---|---|---|---|
| D | D1 | Blocks validated by schema (`docs/schemas/block.schema.json`); contracts with weighted features and eight check types (`docs/system/architecture/contracts.md`); response parser and THINK/ACTION format (`docs/concepts/tool-calling-strategy.md`). | Which agent outputs are closed fields rather than free text: not assessed block by block. |
| I | I1 | Git worktree sandbox (`apps/backend/src/Maestro.Infrastructure/Sandbox/GitWorktreeSandboxManager.cs`); tool mapping for capture and dry run (`tool-calling-strategy.md`, "Tool Mapping"); permissions with parent-child inclusion (`apps/backend/src/Maestro.Domain/ValueObjects/BlockPermission.cs`, `FileAccessChecker.cs`). | Shell block on the host (`ShellBlockExecutor.cs`, line 102); container runtime not on the execution path (§4.2). Whether the permission checks are on every tool dispatch path: unknown, so I2 is not claimed. |
| M | M1 | Contracts with test suites and `minimumFitness` (`content/system/contracts/`, `ContractTestRunner.cs`); model notes with measured fitness ranges (`content/system/docs/models/`). | Optimiser fitness is binary and the research service returns a simulated 0.88 (`ResearchTeamService.cs`, line 369): no M2 harness in service. Engine milestones E1 and E2 are the planned M2. |
| S | S1 | The assistant must "confirm before acting" (`CLAUDE.md`, "maestro-code V1 Architecture"); approval-required permissions exist (`BlockPermission.cs`). | Hard cost limits exist (`apps/backend/src/Maestro.Domain/Entities/CostLimits.cs`) but whether every write path is gated by code rather than by the model's confirmation: unknown. |

### 8.5 Money-Core

| Dim. | Level | Evidence | Unknown or missing |
|---|---|---|---|
| D | D3 by design | Decider design (`docs/specs/2026-09-27-decideur-du-matin-design.md`); `Decimal` for money and stop-loss gate (`CLAUDE.md`, "Hard rules"; `src/money_core/risk/`). | `PlanExecutor` not built (`src/money_core/decider/` absent at `ed99e0d`). |
| I | I3 at the live boundary | `LiveModeLockedError` (`src/money_core/cli.py`, lines 305 to 336); mode-scoped credentials; isolated data directories and tests (`CLAUDE.md`, "Hard rules"; `tests/conftest.py`). | Decider tools not built, so their argument checks cannot be assessed. |
| M | M1 | Declared paper-run proofs and daily readings in `STATUS.md`; start check added after the empty proof (line 98). | No harness for the decider; no fingerprint on paper-run records: unknown. |
| S | S3 at the boundary, human required | Milestone "M8 · Passage en réel : décision d'Arthur seulement", never crossed automatically; the lock is lifted only by a code change reviewed by the owner, with its test (GitHub milestone M8 of `arthurolivierfortin/Money-Core`, description, read 2026-10-06). | None for the boundary. |

---

## 9. References

### 9.1 Public sources

All read on 2026-10-06. Only statements that were verified on the page are cited in the text.

1. OpenAI, *A practical guide to building agents*, section "Selecting your models", p. 8.
   https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf
2. Anthropic, *Choosing the right model*, sections "Establish key criteria", "Option 2: Start
   capability-first" and "Decide whether to upgrade or change models".
   https://platform.claude.com/docs/en/about-claude/models/choosing-a-model
3. Anthropic, *Define success criteria and build evaluations*: "Building a successful LLM-based
   application starts with clearly defining your success criteria and then designing evaluations to
   measure performance against them."
   https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
4. Anthropic, *Optimizing for cost and intelligence*: price every candidate "in cost per completed
   task on your own traffic"; "A multi-model configuration must beat the single model's whole curve."
   https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence
5. Anthropic, *Building effective agents* (2024-12-19): "we recommend finding the simplest solution
   possible, and only increasing complexity when needed."
   https://www.anthropic.com/engineering/building-effective-agents
6. Anthropic, *Commercial Terms of Service*, section D.4, Use Restrictions.
   https://www.anthropic.com/legal/commercial-terms
7. Hugging Face, *SmolLM2-1.7B-Instruct* model card, licence Apache 2.0.
   https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct
8. Y. Liu et al., *G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment*, arXiv:2303.16634.
   https://arxiv.org/abs/2303.16634
9. S. Kim et al., *Prometheus: Inducing Fine-grained Evaluation Capability in Language Models*,
   arXiv:2310.08491. https://arxiv.org/abs/2310.08491
10. Y. Lee et al., *CheckEval: A reliable LLM-as-a-Judge framework for evaluating text generation
    using checklists*, arXiv:2403.18771. https://arxiv.org/abs/2403.18771
11. Anthropic, *Demystifying evals for AI agents* (2026-01-09).
    https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents

### 9.2 Internal sources

Maestro (this repository): `CLAUDE.md`; `docs/REPRISE-2026-09-29-moteur.md`;
`docs/guides/ai-agents/mentality.md`; `docs/guides/ai-agents/dogfooding-methodology.md`;
`docs/concepts/lora-fine-tuning.md`; `docs/concepts/tool-calling-strategy.md`;
`docs/system/architecture/contracts.md`; `content/system/docs/models/smollm2-1.7b.md`,
`smollm2-360m.md`; `apps/backend/src/Maestro.Domain/ValueObjects/FitnessScore.cs`;
`apps/backend/src/Maestro.Infrastructure/BlockExecutors/ShellBlockExecutor.cs`;
`apps/backend/src/Maestro.Infrastructure/Research/ResearchTeamService.cs`.

dev-kit (`C:/Projects/dev-kit`): `adapters/claude/agents/` (judge, builder, estimator, evaluator,
kb-integrator); `schemas/`; `conventions/commits.md`; `scripts/tool_versions.py`; `telemetry/README.md`;
`telemetry/fenetres.json`; ADR-DEVKIT-0004, 0005, 0009, 0016, 0028, 0029, 0030, 0031 in
`docs/decisions/`; issue #295.

cockpit (`C:/Projects/cockpit`): `CLAUDE.md`; `DECISIONS.md`; `registry.yaml`; `scripts/run.py`,
`locks.py`, `weekly_guard.py`; `docs/bilan/2026-10-05/` (revue, researcher, grille, pilote,
telemetrie reports; `verification-avant-gel.md`).

Money-Core (`C:/Projects/Perso/Money-Core`): `CLAUDE.md`; `STATUS.md`; `src/money_core/cli.py`;
`tests/unit/test_decider/test_live_lock.py`; `docs/specs/2026-09-27-decideur-du-matin-design.md`;
milestone M8.

agent-core (`C:/Projects/Perso/agent-core`): `docs/decisions/ADR-AGENT-0004-isolation-execution-policy.md`,
`ADR-AGENT-0021-le-contrat-comme-declaration-avant-le-moteur.md`.
