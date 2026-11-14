# D-0003: The challenge dataset lives in `data/raw/`, outside git

- **Date:** 2026-11-14
- **Status:** accepted
- **Deciders:** Ufuk (asked for the docs to be set up from the data; AI chose the location)
- **Source:** setup of the S-Pankki challenge, 2026-11-14

## Context
The transactions CSV is 346 MB and stored with Git LFS upstream. The CSVs were first dropped into `docs/` with shuffled names, where they could easily have been committed.

## Decision
- Raw challenge files go in `data/raw/` with their original names. `data/` is in `.gitignore`.
- The source is the official repo; the transactions file is verified by size and SHA-256 (values in [dataset.md](../references/dataset.md)).
- Derived files (cleaned tables, aggregates, a database) go in `data/` too, and must be reproducible from `data/raw/` by a script in the repo.

## Alternatives considered
- **Commit the data (or use Git LFS in our repo):** a 346 MB file in a hackathon repo slows every clone, and the data already has an official home.
- **Keep it in `docs/`:** docs are meant to be committed and read by agents.

## Consequences
- Each teammate downloads the data once (see [dataset.md](../references/dataset.md)); a fresh clone has no data.
- Any demo deployment needs its own copy or a prepared subset of the data.
