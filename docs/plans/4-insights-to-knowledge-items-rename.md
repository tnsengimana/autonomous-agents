# Terminology Rename: Insights → Knowledge Items

## Overview

Rename "insights" terminology to "knowledge items" throughout the codebase. This avoids confusion when users ask team leads for "insights" - the LLM might confuse user requests with the internal knowledge storage feature.

### Terminology Mapping

| Old | New |
|-----|-----|
| insights (table) | knowledge_items |
| Insight (type) | KnowledgeItem |
| InsightType | KnowledgeItemType |
| insights.ts | knowledge-items.ts |
| insight-tools.ts | knowledge-item-tools.ts |
| addInsight | addKnowledgeItem |
| listInsights | listKnowledgeItems |
| removeInsight | removeKnowledgeItem |
| extractInsightsFromThread | extractKnowledgeFromThread |
| loadInsights | loadKnowledge |

---

## Implementation Phases

### Phase 1: Database Migration

**Create migration to rename table:**
```sql
ALTER TABLE "insights" RENAME TO "knowledge_items";
ALTER INDEX "insights_agent_id_idx" RENAME TO "knowledge_items_agent_id_idx";
```

**File: `src/lib/db/schema.ts`**
- Line 219-230: Rename `insights` table to `knowledgeItems`
- Line 298: Rename relation `insights: many(insights)` → `knowledgeItems: many(knowledgeItems)`
- Line 376-385: Update insights relations to knowledgeItems relations
- Keep `MemoryType` 'insight' value (separate feature - user context memories)
- Keep `InboxItemType` 'insight' value (inbox notifications)

---

### Phase 2: Database Queries

**Rename file: `src/lib/db/queries/insights.ts` → `src/lib/db/queries/knowledge-items.ts`**

All functions to rename:
- `createInsight` → `createKnowledgeItem`
- `getInsightById` → `getKnowledgeItemById`
- `getInsightsByAgentId` → `getKnowledgeItemsByAgentId`
- `getRecentInsights` → `getRecentKnowledgeItems`
- `deleteInsight` → `deleteKnowledgeItem`
- `searchInsights` → `searchKnowledgeItems`
- `getInsightsByType` → `getKnowledgeItemsByType`
- `updateInsight` → `updateKnowledgeItem`
- `getInsightsBySourceThread` → `getKnowledgeItemsBySourceThread`
- `getInsightsCount` → `getKnowledgeItemsCount`

**File: `src/lib/db/queries/index.ts`**
- Update re-export from './knowledge-items'

---

### Phase 3: Type Definitions

**File: `src/lib/types.ts`**
- Line 13: Update import from schema (`insights` → `knowledgeItems`)
- Line 29: `Insight` → `KnowledgeItem`
- Line 48: `InsightType` → `KnowledgeItemType`

**IMPORTANT: MemoryType vs KnowledgeItemType are separate features**

These are distinct type enums for different features:

| Type Enum | Feature | Context | Values |
|-----------|---------|---------|--------|
| `MemoryType` | User context memories | Foreground (conversations) | `'preference' \| 'insight' \| 'fact'` |
| `KnowledgeItemType` | Agent professional knowledge | Background (work threads) | `'fact' \| 'technique' \| 'pattern' \| 'lesson'` |

- `MemoryType` is used in `memories` table - stores what the agent learns about the user from conversations
- `KnowledgeItemType` is used in `knowledge_items` table - stores professional expertise extracted from work sessions
- Both have `'fact'` but they mean different things:
  - Memory fact: "User prefers Python over JavaScript"
  - Knowledge fact: "The API rate limit is 100 requests/minute"
- Do NOT use `MemoryType` for knowledge items or vice versa

---

### Phase 4: Agent Core Logic

**Rename file: `src/lib/agents/insights.ts` → `src/lib/agents/knowledge-items.ts`**

Functions/constants to rename:
- `InsightTypeSchema` → `KnowledgeItemTypeSchema`
- `ExtractedInsightSchema` → `ExtractedKnowledgeItemSchema`
- `InsightExtractionResultSchema` → `KnowledgeExtractionResultSchema`
- `ExtractedInsight` → `ExtractedKnowledgeItem`
- `INSIGHT_EXTRACTION_SYSTEM_PROMPT` → `KNOWLEDGE_EXTRACTION_SYSTEM_PROMPT`
- `extractInsightsFromMessages` → `extractKnowledgeFromMessages`
- `extractInsightsFromThread` → `extractKnowledgeFromThread`
- `formatInsightsForContext` → `formatKnowledgeForContext`
- `buildInsightsContextBlock` → `buildKnowledgeContextBlock`
- `loadInsightsContext` → `loadKnowledgeContext`
- `loadInsights` → `loadKnowledge`

**File: `src/lib/agents/agent.ts`**
- Update imports from './knowledge-items'
- Line 76: `private insights` → `private knowledgeItems`
- Update all references throughout

**File: `src/lib/agents/thread.ts`**
- Update comment about "extracting insights" → "extracting knowledge"

**File: `src/lib/agents/index.ts`**
- Update exports from './knowledge-items'

---

### Phase 5: Tools

**Rename file: `src/lib/agents/tools/insight-tools.ts` → `src/lib/agents/tools/knowledge-item-tools.ts`**

Schemas to rename:
- `AddInsightParamsSchema` → `AddKnowledgeItemParamsSchema`
- `ListInsightsParamsSchema` → `ListKnowledgeItemsParamsSchema`
- `RemoveInsightParamsSchema` → `RemoveKnowledgeItemParamsSchema`

Tools to rename:
- `addInsightTool` → `addKnowledgeItemTool` (tool name: 'addKnowledgeItem')
- `listInsightsTool` → `listKnowledgeItemsTool` (tool name: 'listKnowledgeItems')
- `removeInsightTool` → `removeKnowledgeItemTool` (tool name: 'removeKnowledgeItem')

Registration:
- `registerInsightTools` → `registerKnowledgeItemTools`

**File: `src/lib/agents/tools/index.ts`**
- `getInsightTools` → `getKnowledgeItemTools`
- Update tool name references in filter list
- Update imports

---

### Phase 6: UI Pages

**File: `src/app/(dashboard)/teams/[id]/agents/[agentId]/page.tsx`**
- Keep 'insight' badge variant (this is for inbox item type display, not the knowledge feature)

**File: `src/app/(dashboard)/dashboard/page.tsx`**
- Keep 'insight' InboxItemBadge (inbox notification type)

**File: `src/app/(dashboard)/inbox/page.tsx`**
- Keep 'insight' badge (inbox notification type)

**Note:** The inbox item type 'insight' is different from the knowledge items feature. It means "the agent is sharing an insight with the user" - this is user-facing and should stay as 'insight'.

---

### Phase 7: Tests

**File: `src/lib/db/__tests__/schema.test.ts`**
- Lines 171-260: Update entire insights test suite
- Rename test descriptions and variable names
- Update table/function references

**File: `src/lib/agents/__tests__/agent.test.ts`**
- Update references to insights → knowledge items

---

### Phase 8: Documentation

**File: `CLAUDE.md`**
- Update all references to "insights" (knowledge feature) → "knowledge items"
- Keep references to agents "delivering insights to users" (user-facing communication)

**File: `docs/plans/2026-01-25-autonomous-teams-design.md`**
- Update knowledge feature references

**File: `docs/plans/2026-01-25-agent-foreground-background-architecture.md`**
- Update knowledge extraction references

---

### Phase 9: Worker

**File: `src/worker/runner.ts`**
- Update comment about extracting insights → extracting knowledge

---

## Important Distinctions

| Term | Meaning | Action |
|------|---------|--------|
| `insights` table / `Insight` type | Agent's professional knowledge storage | **RENAME to knowledge_items / KnowledgeItem** |
| `InsightType` enum | Types for knowledge items | **RENAME to KnowledgeItemType** |
| `MemoryType` enum | Types for user context memories | **KEEP as-is** (different feature - foreground) |
| 'insight' in `MemoryType` enum | Type of user context memory | **KEEP as-is** (different feature) |
| 'insight' in `InboxItemType` enum | Inbox notification when agent shares finding | **KEEP as-is** (user-facing term) |
| "insights" in user-facing text | Agent sharing findings with user | **KEEP as-is** (natural language) |

### Type Separation Rationale

```
┌─────────────────────────────────────────────────────────────────┐
│                         FOREGROUND                              │
│  User ↔ Agent conversations                                     │
│                                                                 │
│  MemoryType = 'preference' | 'insight' | 'fact'                │
│  Stored in: memories table                                      │
│  Purpose: Remember user context (preferences, past requests)    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         BACKGROUND                              │
│  Agent work sessions (threads)                                  │
│                                                                 │
│  KnowledgeItemType = 'fact' | 'technique' | 'pattern' | 'lesson'│
│  Stored in: knowledge_items table                               │
│  Purpose: Professional expertise learned from work              │
└─────────────────────────────────────────────────────────────────┘
```

These are **completely separate features** with different:
- Database tables (`memories` vs `knowledge_items`)
- Type enums (`MemoryType` vs `KnowledgeItemType`)
- Extraction sources (conversations vs threads)
- Usage context (foreground prompts vs background prompts)

---

## Migration Strategy

1. Generate Drizzle migration: `npx drizzle-kit generate`
2. The migration will rename the table and index
3. Apply migration: `npx drizzle-kit migrate`

---

## Verification

1. **Migration**: `npx drizzle-kit generate` creates correct rename migration
2. **Build**: `npm run build` - no compilation errors
3. **Lint**: `npm run lint` - no warnings
4. **Tests**: `npm test` - all tests pass
5. **Search**: `grep -r "insights" --include="*.ts" src/lib/db/` should only show:
   - MemoryType 'insight' value
   - No `insights` table references
6. **Search**: `grep -r "Insight" --include="*.ts" src/` should only show:
   - InboxItemType references (if any)
   - No `Insight` type (should be `KnowledgeItem`)

---

## Summary

| Category | Files | Changes |
|----------|-------|---------|
| Database Schema | 1 | Table rename, relations |
| Database Queries | 2 | File rename, 10 functions |
| Types | 1 | Type renames |
| Agent Logic | 4 | File rename, functions, imports |
| Tools | 2 | File rename, 3 tools, schemas |
| Tests | 2 | Variable names, descriptions |
| Documentation | 3 | Terminology updates |
| Worker | 1 | Comments |
| Migration | 1 | New migration file |
| **Total** | **~17 files** | + 1 migration |
