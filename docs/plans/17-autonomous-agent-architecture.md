# Implementation Plan: Autonomous Agent Architecture

**Goal**: Transform agents from reactive task-executors to proactive, autonomous workers that run 24/7, determine their own work, and maintain two distinct personas (Foreground Chat vs. Background Worker).

## User Review Required
> [!IMPORTANT]
> **Database Migration**: This plan requires modifying the `agents` and `agent_tasks` tables.
> **Behavior Change**: Agents will now "wake up" periodically even without assigned tasks to "think" and self-assign work.

## Proposed Changes

### 1. Database Schema Updates
We need to store the background identity and effective task prioritization.

#### [MODIFY] `src/lib/db/schema.ts`
- **`agents` table**:
    - Add `backgroundSystemPrompt` (text, nullable): Specific instructions for the background worker persona (e.g., "You are a rigorous researcher...").
- **`agentTasks` table**:
    - Add `priority` (integer, default 0): To allow agents to rank their own tasks.

### 2. Agent Core Refactor (`src/lib/agents/agent.ts`)
The core logic needs to split personality and introduce the "Think Loop".

#### [MODIFY] `Agent` class
- **Dual Prompts**:
    - Update `buildBackgroundSystemPrompt()` to use the new `backgroundSystemPrompt` field if available, falling back to `systemPrompt`.
    - Inject `Memories` (User Preferences) into the Background Prompt (currently only in Foreground). *Rationale: A worker needs to know user preferences to do good work.*
- **The "Think" Methodology**:
    - New method `assessSituation()`:
        - **Input**: Current Knowledge, Recent Memories, Pending Task Count, Time of Day.
        - **Prompt**: "View your state. Decided next action: `PROCESS_NEXT_TASK`, `SELF_ASSIGN_TASK`, `SLEEP`, or `CONSOLIDATE_MEMORY`."
- **Work Session Loop**:
    - Update `runWorkSession()`:
        - Instead of `while(claimNextTask)`, use `while(action != SLEEP)`.
        - If `action == PROCESS_NEXT_TASK`: `claimNextTask()` and execute.
        - If `action == SELF_ASSIGN_TASK`: Create a new `AgentTask` for self.

### 3. Background Worker Refactor (`src/worker/runner.ts`)
The runner needs to support "Heartbeats" (proactive runs) rather than just Event/Timer triggers.

#### [MODIFY] `startRunner()`
- Implement a "Heartbeat" mechanism:
    - Even if `getQueueStatus` is empty, agents should have a chance to run `assessSituation()` periodically (e.g., every hour, or configurable `heartbeatInterval`).
    - This allows them to wake up and say "I haven't done X in a while, I should self-assign that."

### 4. Prompt Engineering
Refine the system prompts to support this dual mode.

#### [NEW] `src/lib/agents/prompts/think.ts`
- Create structured prompts for the "Situation Assessment" loop.

## Verification Plan

### Automated Tests
- **Database**: Verify migration allows null `backgroundSystemPrompt`.
- **Logic**: Unit test `assessSituation()` with mocked LLM responses to ensure it correctly parses actions (`SLEEP` vs `PROCESS`).

### Manual Verification
1.  **Dual Persona**:
    -   Set a "Silly" foreground prompt and a "Serious" background prompt.
    -   Chat with agent (expect Silly).
    -   Queue a task (expect Serious output).
2.  **Autonomy**:
    -   Clear all tasks.
    -   Wait for "Heartbeat".
    -   Verify logs show agent "Thinking" and deciding to `SLEEP`.
    -   (Advanced) Inject a "Thought" that urges action (via mock or prompt injection) and verify agent `SELF_ASSIGNS` a task.
