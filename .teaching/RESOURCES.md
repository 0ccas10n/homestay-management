# Resources: React Patterns

**Last curated**: 2026-09-01

## Primary (use these as lesson foundations)

### React docs — Reusing Logic with Custom Hooks
- **Type**: Official docs
- **Author / Source**: React team
- **URL**: https://react.dev/learn/reusing-logic-with-custom-hooks
- **Why it's good**: Authoritative source. Explains the *why* of custom hooks: hide external-system details so components express intent, not implementation.
- **What it's good for**: Custom hook fundamentals — naming conventions, what counts as a hook, why they exist

### React docs — useMemo
- **Type**: Official docs
- **Author / Source**: React team
- **URL**: https://react.dev/reference/react/useMemo
- **Why it's good**: Defines exactly when useMemo helps (skip expensive recomputation, stabilize reference) vs when it doesn't.
- **What it's good for**: Justifying `useMemo` in our lookup-map pattern

### MDN — fetch API + AbortController
- **Type**: Web platform docs
- **Author / Source**: Mozilla
- **URL**: https://developer.mozilla.org/en-US/docs/Web/API/AbortController
- **Why it's good**: Explains how to cancel in-flight requests — directly relevant for understanding race conditions in data hooks.
- **What it's good for**: Why our hooks should (or shouldn't) cancel pending fetches on unmount

## Secondary (use for deep dives and exercises)

### Reddit — r/react: react query vs regular data fetching custom hook
- **Type**: Community discussion
- **URL**: https://www.reddit.com/r/react/comments/1ibzp54/react_query_vs_regular_data_fetching_custom_hook
- **Why it's good**: Real practitioners discuss the trade-off between hand-rolled data hooks (what this codebase does) and TanStack Query.
- **What it's good for**: Validating why this codebase *doesn't* use React Query, and what it would gain by adopting it

### DEV — Reusing Logic in React with Custom Hooks (kada)
- **Type**: Tutorial
- **URL**: https://dev.to/kada/reusing-logic-in-react-with-custom-hooks-a-practical-guide-4li1
- **Why it's good**: Step-by-step build of a fetch hook with realistic example.
- **What it's good for**: Comparing a tutorial's "ideal" hook with the codebase's actual `useBookings` — seeing trade-offs

## Community (for wisdom, not facts)

### r/react
- **Platform**: Subreddit
- **URL**: https://www.reddit.com/r/react/
- **Activity level**: High
- **Best for**: "Is this hook pattern idiomatic?" and "Should I refactor X?" judgment questions

### Reactiflux Discord
- **Platform**: Discord
- **URL**: https://www.reactiflux.com/
- **Activity level**: High
- **Best for**: Real-time feedback on hook designs, error handling patterns

## Anti-recommendations

- **Generic "React Hooks in 30 minutes" tutorials on YouTube** — they teach syntax, not patterns. The codebase already assumes syntax knowledge.
- **Old class-component lifecycle guides** — irrelevant; codebase is 100% hooks.
- **"React Hooks cheat sheet" Pinterest images** — too shallow, no justification for trade-offs.
