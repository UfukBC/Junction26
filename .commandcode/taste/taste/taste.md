# Taste
- Wants documentation written before the work is committed/pushed, not offered afterwards as a follow-up. Confidence: 0.5
- Treats "main screen fits on one page / no scrolling on a phone-height frame" as a standing rule, not a one-off tweak: expects it re-checked (and restored) after merges or incoming design changes. Confidence: 0.8
- Pushes back on wasted/empty space in a layout: when a new component (e.g. a chart) replaces an old one, expects the existing screen layout and density to be kept rather than letting the newcomer inflate the area. Confidence: 0.6
- Corrects over-compaction: when space frees up, prefers restoring generous spacing/gaps (matching the previous version's feel) over shrinking everything to fit, especially at the top of a screen. Confidence: 0.6
- Expects a section heading/label to be visually attached to what it describes (e.g. centered directly above its chart) rather than floating off to one side. Confidence: 0.4
- Wants paired navigation controls (e.g. prev/next arrows) grouped tightly with their label in the center, not pinned to opposite screen edges. Confidence: 0.45
- When a newer/better version of a component exists elsewhere (a committed branch), prefers bringing that flow into the current screen and constraining it to the existing slot, rather than reverting to the older implementation or keeping two variants. Confidence: 0.5
- Expects compact versions of data views to stay legible — don't silently hide labels/values to make something fit; clarity for the end user takes priority over a tidier, emptier component. Confidence: 0.45
