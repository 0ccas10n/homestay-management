# LEARNING-RECORD-FORMAT.md

A **learning record** captures one tight, dated entry per lesson or significant insight. Like an architectural decision record in software, it captures the *why* and *what changed* — not a transcript.

## File Naming

```
learning-records/0001-<dash-case-name>.md
0002-<dash-case-name>.md
...
```

The number increments each time. The dash-case name should be short and descriptive (e.g. `0001-spacing-vs-grouping.md`).

## Template

```markdown
# [Short title]

**Date**: [YYYY-MM-DD]
**Lesson**: [Link to the lesson this record refers to, or "General" if not tied to a lesson]
**Resources**: [Links to resources in RESOURCES.md that grounded this record]

## What changed

The single most important insight from this session. One paragraph.

What did the learner believe before that they now believe differently? Be specific.

## What was non-obvious

Anything that surprised them, contradicted prior intuition, or that they're worried they might forget. This is the "expensive" knowledge — the things that cost time to acquire and would cost time to re-acquire if lost.

## What was hard

Concepts or skills that took more effort than expected. Capture *why* they were hard — this is useful for designing future lessons at the right level.

## What to do next

Concrete next steps:
- Specific concept to learn
- Specific exercise to do
- Specific question to bring to a community

## Open questions

Anything the learner is still unsure about. These are good candidates for the next lesson or for bringing to a community.
```

## Why This Format

- **One file per record**, not one big log — easier to scan, reference, and reorganize
- **"What changed" first** — the insight is the most important thing; everything else is context
- **"What was hard"** — directly informs the zone of proximal development for next time
- **"Open questions"** — fuels the next session without losing the thread

## When to Write

Write a learning record:
- After every lesson
- After any session where the learner makes a meaningful insight
- When the mission changes
- When a decision is made (e.g. "we'll focus on X for now")

Don't write a learning record for trivial sessions — keep these records dense.