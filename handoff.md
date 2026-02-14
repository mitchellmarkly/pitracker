# PI Tracker Handoff

## Product goals
- Track EVE PI assignments by character and slot
- Import heatmap scans (JSON) and compare planetary yields
- Show market pricing (Jita vs C-N4OD) for sell-vs-manufacture decisions
- Keep workflows fast for nullsec PI management

## Current status
- Local-first React + Vite + TypeScript app
- Assignment import/export, heatmap filters, recommendations
- Character management and slot-aware assignment flow
- Explorer -> pick planet/resource -> prefill assignment
- Collapsible sections (including market settings)
- Janice integration path added in latest branch

## Known constraints
- Public ESI won’t reliably expose private structure sell orders
- C-N4OD market visibility is not equivalent to Jita NPC station visibility
- Need careful API call budgeting (no background polling)

## Next phase priorities
1. Hardening market data layer (fallbacks, retry, clearer stale/error states)
2. Better character planner (slot capacity, duplicate prevention UX)
3. Optional P2 decision engine (recipe-aware)
4. Improve import/export schema versioning + migration handling
5. Add tests for parsing and assignment rules

## Non-goals for now
- Full ESI OAuth character auth
- Background auto-sync jobs
