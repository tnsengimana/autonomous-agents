# Terminology Rename: Worker → Subordinate

## Overview

Rename "worker" terminology (when referring to team member agents) to "subordinate" throughout the codebase and UI. This avoids confusion with "background worker" (the process that runs agent work sessions).

### Key Distinction

| Term | Meaning | Action |
|------|---------|--------|
| "worker agent", "worker" (as agent type) | Team member agent under a team lead | **RENAME to "subordinate"** |
| "background worker", "worker runner", "worker process" | The process in `src/worker/` that executes agent work | **KEEP as-is** |

### Terminology Mapping

| Old | New |
|-----|-----|
| Worker Agent | Subordinate Agent |
| worker (badge) | subordinate (badge) |
| Add Worker Agent | Add Subordinate |
| Worker Agents (section) | Subordinates (section) |
| workerAgent, worker (variables) | subordinateAgent, subordinate |
| getWorkerTools | getSubordinateTools |
| worker-tools.ts | subordinate-tools.ts |

---

## Implementation Phases

### Phase 1: UI Pages

#### Files to modify:

**1. `src/app/page.tsx`**
- Line 59: "worker agents" → "subordinate agents"

**2. `src/app/(dashboard)/teams/[id]/page.tsx`**
- Line 127: Badge "worker" → "subordinate"
- Line 158: Button "Add Worker Agent" → "Add Subordinate"

**3. `src/app/(dashboard)/teams/[id]/agents/page.tsx`**
- Line 35: `workerAgents` → `subordinateAgents`
- Line 53: Button "Add Worker Agent" → "Add Subordinate"
- Line 93: Comment "Worker Agents" → "Subordinates"
- Line 96: Card title "Worker Agents" → "Subordinates"
- Line 98: Description "Workers spawn on-demand..." → "Subordinates spawn on-demand..."
- Line 102, 104, 107, 113: Variable references
- Line 123: Badge "worker" → "subordinate"

**4. `src/app/(dashboard)/teams/[id]/agents/new/page.tsx`**
- Line 17: `NewWorkerAgentPage` → `NewSubordinatePage`
- Line 74: Title "Add Worker Agent" → "Add Subordinate"
- Line 76: Description "Create a new worker agent..." → "Create a new subordinate agent..."
- Line 91: Description "Define the worker agent's..." → "Define the subordinate agent's..."

**5. `src/app/(dashboard)/teams/[id]/agents/[agentId]/page.tsx`**
- Line 48: `agentType` assignment: `'worker'` → `'subordinate'`

**6. `src/app/(dashboard)/teams/new/page.tsx`**
- Line 141: "worker agents" → "subordinate agents"

---

### Phase 2: Tools Files

#### Files to modify:

**1. Rename file: `src/lib/agents/tools/worker-tools.ts` → `src/lib/agents/tools/subordinate-tools.ts`**
- Line 2: Docstring "Worker Agent Tools" → "Subordinate Agent Tools"
- Line 4: Docstring "Tools available to worker agents..." → "Tools available to subordinate agents..."
- Line 157: Message text "Worker Agent" → "Subordinate Agent"
- Line 177: Function `registerWorkerTools()` → `registerSubordinateTools()`

**2. `src/lib/agents/tools/index.ts`**
- Line 114: Comment "workers" → "subordinates"
- Line 124: `...getWorkerTools()` → `...getSubordinateTools()`
- Line 130: Comment "Get tools available for workers" → "Get tools available for subordinates"
- Line 132: Function `getWorkerTools()` → `getSubordinateTools()`
- Line 181: Zod description "worker agent" → "subordinate agent"

**3. `src/lib/agents/tools/team-lead-tools.ts`**
- Line 30: Tool description "worker agent" → "subordinate agent"
- Line 35: Parameter description "worker agent" → "subordinate agent"
- Line 104: Tool description "worker agents" → "subordinate agents"

**4. `src/lib/agents/index.ts`**
- Line 83: Export `getWorkerTools` → `getSubordinateTools`
- Line 104: Comment "Worker tools" → "Subordinate tools"
- Line 105: Export `registerWorkerTools` → `registerSubordinateTools`
- Line 108: Import source `'./tools/worker-tools'` → `'./tools/subordinate-tools'`

---

### Phase 3: API Routes

**1. `src/app/api/teams/[id]/agents/route.ts`**
- Line 15: JSDoc "worker agent" → "subordinate agent"
- Line 42: Error message "worker agent" → "subordinate agent"
- Line 59: Comment "worker agent" → "subordinate agent"

---

### Phase 4: Core Agent Logic

**1. `src/lib/agents/agent.ts`**
- Line 384: Comment "worker: none" → "subordinate: none"

**2. `src/lib/agents/taskQueue.ts`**
- Keep "worker runner" references (refers to background process)
- No changes needed - already refers to process, not agent type

---

### Phase 5: Background Worker Process (Clarifications Only)

These files use "worker" to mean both the process and agent type. Clarify agent references:

**1. `src/worker/spawner.ts`**
- Line 4: Docstring clarify "worker agents" → "subordinate agents"
- Line 36: Function description "worker agent" → "subordinate agent"
- Line 94: Function description "worker agent" → "subordinate agent"
- Line 149: Comment "worker agents" → "subordinate agents"

**2. `src/worker/runner.ts`**
- Line 201: Function description "worker agent" → "subordinate agent"

---

### Phase 6: Tests

**1. `src/lib/agents/__tests__/agent.test.ts`**
- Line 33: `testWorkerId` → `testSubordinateId`
- Line 64-71: Variable/comments
- Line 88, 90, 121-122: References
- Line 325-439: Test names and comments about "worker" → "subordinate"

**2. `src/lib/agents/__tests__/taskQueue.test.ts`**
- Line 475, 477, 485: Comments about delegation to "worker" → "subordinate"

**3. `src/app/api/__tests__/api.test.ts`**
- Line 468: Test data role "Test Worker" → keep as agent name (not terminology)

**4. `src/worker/__tests__/runner.test.ts`**
- Update test names/comments about "worker agent" → "subordinate agent"

---

### Phase 7: Documentation

**1. `CLAUDE.md`**
- Update all references to "worker" (as agent type) → "subordinate"
- Keep "background worker" references
- Add clarification note about terminology

**2. `docs/plans/2026-01-25-autonomous-teams-design.md`**
- Update "worker agents" → "subordinate agents" throughout
- Keep "background worker" references

**3. `docs/plans/2026-01-25-agent-foreground-background-architecture.md`**
- Update "worker" (agent type) → "subordinate" throughout
- Keep "worker runner" references (process)

---

## Verification

1. **Build**: `npm run build` - ensure no compilation errors
2. **Lint**: `npm run lint` - ensure no new warnings
3. **Tests**: `npm test` - all 234 tests should pass
4. **UI Check**:
   - Homepage: "subordinate agents" in step 2
   - Team page: "subordinate" badges on agents
   - Agents page: "Subordinates" section, "Add Subordinate" button
   - New agent page: "Add Subordinate" title
5. **Search**: `grep -r "worker" --include="*.tsx" --include="*.ts" src/` should only show:
   - `src/worker/` directory (background process)
   - `notifyWorkerRunner` references (background process)
   - No "worker agent" or "worker" as agent type

---

## Summary

| Category | Files | Changes |
|----------|-------|---------|
| UI Pages | 6 | Titles, buttons, badges, descriptions |
| Tools | 4 | File rename, function names, descriptions |
| API | 1 | Comments, error messages |
| Agent Logic | 1 | Comments |
| Worker Process | 2 | Clarify agent references |
| Tests | 4 | Variable names, test names, comments |
| Documentation | 3 | Terminology updates |
| **Total** | **21 files** | |
