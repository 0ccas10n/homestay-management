# Teaching Workspace Skill

Use this skill whenever the user wants to learn a new topic or skill within this workspace. It sets up a structured teaching environment for long-term, multi-session learning.

## Setup

When first invoked for a new topic, create the teaching workspace structure in the project root:

```
.teaching/
├── MISSION.md              # Why the user wants to learn this
├── RESOURCES.md             # High-quality learning resources
├── NOTES.md                # Working notes, preferences, context
├── reference/              # Reference sheets, cheat sheets, glossaries
├── learning-records/       # Records of key insights and non-obvious lessons
└── lessons/                # Individual lesson HTML files
```

Use the format templates in the skill directory (`MISSION-FORMAT.md`, `RESOURCES-FORMAT.md`, `LEARNING-RECORD-FORMAT.md`, `NOTES-FORMAT.md`) as guides when creating these files.

**Important**: The `.teaching/` directory is the canonical teaching workspace. Never create it elsewhere.

## Mission

Every learning journey starts with a `MISSION.md`. Before creating it, ask the user:

- What do they want to be able to *do* as a result of this learning?
- What is their current level of knowledge/skill in the topic?
- Why does this matter to them?

Write the mission in first person, from the learner's perspective. Keep it concrete and outcome-focused. Link to the mission from every lesson.

## First Session Protocol

1. **Establish the mission** — write `MISSION.md` together with the user
2. **Assess starting point** — ask what they already know; read any existing `learning-records`
3. **Set the first lesson** — identify the most foundational concept in their zone of proximal development
4. **Populate `RESOURCES.md`** — find 3–5 high-quality resources (articles, videos, courses) to ground future lessons in factual knowledge

## Lesson Authoring

Each lesson is a single self-contained HTML file saved to `.teaching/lessons/`, named with an incrementing number:

```
lessons/0001-<dash-case-name>.html
```

Lesson guidelines:
- **Short**: completable in under 10 minutes
- **Tight scope**: one concept or skill per lesson
- **Beautiful**: clean typography (think Tufte), print-ready
- **Interactive**: include at least one quiz, exercise, or feedback loop
- **Linked**: reference the mission, related lessons, and reference documents via anchors
- **Sourced**: cite the resource used to create the lesson

## Reference Documents

Build reference documents in `.teaching/reference/` alongside lessons:
- Syntax cheat sheets
- Glossaries
- Flowcharts and algorithms
- Quick-reference cards

Reference documents should be the compressed essence of a lesson — designed for scanning, not reading.

## Learning Records

After each lesson, write a `learning-record` in `.teaching/learning-records/` capturing:
- What was non-obvious
- What the user struggled with
- What insight changed from before to after
- What to explore next

## Wisdom and Community

When the user asks a question that goes beyond knowledge and skill into judgment, defer to a community rather than answering definitively. Find high-reputation forums, subreddits, classes, or local groups relevant to their mission and add them to `RESOURCES.md`.

## Notes

Use `NOTES.md` to record:
- User preferences for how they learn best
- Topics they find boring or frustrating (avoid)
- Pace they prefer
- Any context that will help future sessions

## Format Templates

| File | Purpose | Template |
|------|---------|----------|
| `MISSION.md` | Learner motivation and goals | See `MISSION-FORMAT.md` |
| `RESOURCES.md` | Curated learning resources | See `RESOURCES-FORMAT.md` |
| `learning-records/*.md` | Post-lesson insights | See `LEARNING-RECORD-FORMAT.md` |
| `NOTES.md` | Session preferences and context | See `NOTES-FORMAT.md` |
| `lessons/*.html` | Individual lessons | Inline in SKILL.md above |

## Zone of Proximal Development

Before each session, read:
1. `learning-records/` — what have they learned? What tripped them up?
2. `NOTES.md` — any updated preferences?
3. `RESOURCES.md` — what resources are available?

Design the next lesson to be **just challenging enough** — not repeating what they know, not jumping too far ahead.

## Session Flow

1. Open `NOTES.md` — recall context and preferences
2. Review last `learning-record` — identify what to build on
3. Choose next topic in the ZPD
4. Deliver lesson (HTML, interactive, cited)
5. After lesson: write a `learning-record`
6. Update `NOTES.md` with what was learned and how it went
7. Ask: "What would you like to explore next?"
