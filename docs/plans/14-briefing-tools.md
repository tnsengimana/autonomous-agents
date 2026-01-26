# Briefing Tools and Queries

## Goal
Expose briefing discovery to foreground leads via tools that can list briefing metadata and fetch full briefing content by id, while preserving ownership constraints and tool availability rules.

## Plan
1. Add briefing query helpers for owner-scoped listing and owner-scoped fetch by id (with optional search).
2. Implement and register lead tools `listBriefings` and `getBriefing`, returning metadata-only lists and full content for a specific briefing.
3. Extend exports and add tests covering list/get behavior (including search and content omission for list).

## Notes
- `listBriefings` should omit `content` to keep responses concise.
- Tools must enforce team/aide ownership via agent context.
