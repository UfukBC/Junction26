# D-0005: Frontend: React + TypeScript + Vite, plain CSS, an S-mobiili-style shell

- **Date:** 2026-11-14
- **Status:** accepted; its data-source and backend points are superseded by D-0007
- **Deciders:** Ufuk (approved an AI proposal)
- **Source:** inbox entry I-20261114-frontend-stack / task none

## Context
The first deliverable was a look-alike of the S-mobiili home screen, so our features can be shown inside a familiar app (judging: mobile UX clarity, S-mobiili fit). A stack had to be picked to build it.

## Decision
- `src/frontend/` is a React 18 + TypeScript + Vite app. Styling is plain CSS with colour tokens on `:root` (brand green `#017842`, tint `#EBF7ED`, bright green `#00AC49`, sampled from an S-mobiili screenshot). Icons from `lucide-react`; S-Bank's own product marks are replaced by simple stand-in glyphs (`components/icons.tsx`), not the real logos.
- Layout is phone-first at 430 px; on screens ≥ 600 px the app is shown in a phone-sized frame for demos.
- Screen data comes from typed objects (`src/data/mock.ts`), so it can later be filled from the dataset or a backend.

## Alternatives considered
- **Plain HTML/JS:** quicker for one screen, but chat and data views will need components and state.
- **Tailwind / a UI kit:** faster for generic UIs, but matching S-mobiili's look is easier with a few hand-written styles.

## Consequences
Node 18+ is needed for the frontend. The backend stack is still open.
