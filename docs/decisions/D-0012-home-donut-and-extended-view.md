# D-0012: Home spending card and extended view as one donut-ring design with an AI overview

- **Date:** 2026-11-14
- **Status:** accepted
- **Deciders:** Ufuk (stated in chat)
- **Source:** inbox entry I-20261114-home-extended-view / task T-014

## Context
D-0009 kept Chamb's filled pie on Home. After seeing the app, Ufuk asked for the earlier Home layout, no bank-messages card, an extended view opened from the chart, and then asked to redo the look and animations; the donut ring with a smooth sweep was chosen. Chamb's `MonthPie` was replaced.

## Decision
- Home: "Your spending" title, month arrows, one bordered card with a donut ring (total spent in the middle) and Income / Fixed / Everyday / Left rows, then the time-habit warning (when there is one), the goal card, quick actions and accounts. The bank-messages card is removed.
- Tapping the ring, a row or "Analyse spending" opens the **extended view** (back arrow, same month arrows): a larger ring, a **Month | Everyday** switch (Everyday shows the categories as the ring), an **AI overview** card, and the full list with shares.
- Selecting a segment or row thickens that segment, dims the rest and shows advice for it; selecting it again returns to the month overview.
- Animations: the ring sweeps in segment by segment when it first appears or when switching between Month and Everyday; values glide between months (CSS transitions on `stroke-dasharray`); the AI card fades in on every change; all of it is off with `prefers-reduced-motion`.
- **One page, no scrolling, no empty gap:** Home and the extended view fit one screen from 740 px height up (Home without a warning also at 667 px), checked at 667/740/800/844/932 px, and the leftover space is used instead of left empty. The month arrows sit in the top bar beside the log-out and chat icons; the extended view uses a two-column grid of tiles instead of a long list; the time-habit warning is a one-line banner that opens a bottom sheet. Sizes scale with the phone's height (CSS `--extra`): the ring, paddings and rows grow on taller phones, and on tall phones (about 840 px and up, 940 px with a warning banner) the Home card stacks the ring above the rows instead of beside them.
- Colours stay in the app's greens (Fixed dark, Everyday bright, Left light; eight green steps for categories).
- The overview text uses Chamb's segment-advice call (`XAI_API_KEY` in `src/frontend/.env`, dev server only); without a key built-in text is shown and labelled "built-in tips · AI not connected". Only the signed-in customer's own numbers are used (D-0011).

## Alternatives considered
- **Chamb's filled pie with value labels:** replaced because of its jumpy morph animation and cramped layout.
- **Pie plus swipeable AI cards:** not chosen.

## Consequences
- T-014 insights and the T-016 warning have a place in the extended view's AI card as well as on Home.
- The AI call only works through the Vite dev server; a static deployment shows the built-in text.
