# NETRA — Changelog

## v1.1.0 — draft

Frontend milestone on `frontend_i`. Everything below is the demo-facing web
application; it runs on mock data and is independent of the backend, which is
tracked separately. Not yet merged or pushed.

### New features

- **Challenge this case (Adversarial AI).** From the case's own records the
  network argues the other side — links resting on a single source, a subject
  apparently in two places at once, a transaction with an innocent reading,
  assertions nothing corroborates, and a suspect the maths ranks above the
  presumed primary — then scores case robustness out of 100.
- **Network Evolution scrubber.** The timeline is now an activity histogram
  with automatic **surge detection**: days where new links spike above the run
  rate are flagged in amber, so an officer sees *when* the network lit up, not
  just that it grew.
- **Relationship Validation.** A human-in-the-loop queue: confirm, dispute, or
  flag every machine-drawn link, and annotate it. Rulings persist per link.
- **Priority Override.** An officer can raise or lower a subject; the override
  wins over the raw connection count in the Key Players ranking.
- **Supervisor task assignment.** Assign a line of work to a named officer
  against a case, checked off when done.
- **Home briefing.** Landing page with where to start today (prioritisation),
  what changed since last login (automated brief), behavioural alerts, and
  upcoming hearings.
- **System Capabilities map.** The architecture as a page — Discover / Analyse /
  Act, Ask NETRA, Human Control / Adversarial AI, Governance — each leaf linking
  to the real screen.
- **Evidence board string key**; **mugshots and editable investigator notes** on
  the entity profile; **quick search palette** that no longer breaks flow by
  redirecting to the Database.

### Redesign & UX

- Rebuilt the shell around a **left sidebar** (icon rail that opens on hover)
  and an **analytics dashboard**; matched to the supplied reference layout.
- **Flat 2D network graph** replacing the 3D one, with tokens rather than
  glossy bubbles and a cursor visible against the canvas.
- **Oversight** grouping in the sidebar for the human-in-the-loop tools;
  renamed Merge Review → **Identity Resolution**, social scan → **Public OSINT**.
- Two-column **notifications** (alerts / hearings) with a visible bell.
- **Responsive** down to tablet and large-phone widths.
- Guided **first-run tour**; **synthetic-footage** label on CCTV.

### Fixes

- Full (synthetic) phone numbers so investigators can actually see them;
  redaction still masks them for the print dossier.
- Evidence board: strings no longer hide behind cards; connect mode no longer
  blocks typing; unstyled controls and blank photo wells fixed.
- Removed presentational week-on-week deltas and the redundant pattern-type
  pill; the graph render loop no longer stalls in a background tab.

### Known limitations

- Runs on **mock data**; the field-level schema does not yet match the backend
  API contract (see the alignment notes — adapter layer pending).
- **Public OSINT** is a labelled feature, not implemented.
- CCTV, Court Dates, Access Log, Officers and Social profiles have no backend
  endpoint and are demonstration-only.
