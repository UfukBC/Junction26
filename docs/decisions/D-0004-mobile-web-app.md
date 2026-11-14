# D-0004: Deliver a mobile-first web app that can be embedded in S-mobiili

- **Date:** 2026-11-14
- **Status:** accepted
- **Deciders:** Ufuk (approved an AI proposal)
- **Source:** inbox entry I-20261114-mobile-web-app / task none

## Context
S-Pankki's customers use the S-mobiili app. Two of the five judging criteria (40%) are about mobile UX and S-mobiili integration.

## Decision
The product is a web app designed for phone screens first, served so it can run inside a WebView in S-mobiili. It is demoed on a phone (or phone-sized browser window).

## Alternatives considered
- **Native app (iOS/Android or React Native):** heavier to build in 48 h, and S-mobiili would have to adopt a separate app instead of embedding a view.
- **Desktop web dashboard:** contradicts "our customers are on mobile".

## Consequences
Layouts, charts and chat must work at ~375 px width. No reliance on hover or wide tables.
