import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare } from "lucide-react";
import type { AgentOwnerContext, Agent, AgentTask } from "./types";
import { buildAgentPath, buildOwnerPath, formatRelativeDate, getOwnerLabel } from "./utils";

interface AgentTasksViewProps {
  owner: AgentOwnerContext;
  agent: Agent;
  pendingTasks: AgentTask[];
  completedTasks: AgentTask[];
}

function TaskList({
  tasks,
  emptyLabel,
  showResult,
  description,
  collapsible,
}: {
  tasks: AgentTask[];
  emptyLabel: string;
  showResult?: boolean;
  description?: string;
  collapsible?: boolean;
}) {
  if (tasks.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
      <ScrollArea className="h-[260px]">
        <div className="space-y-3 pr-4">
          {tasks.map((task) => {
            const preview =
              showResult && task.result
                ? task.result.length > 240
                  ? `${task.result.slice(0, 240)}...`
                  : task.result
                : null;

            if (collapsible && task.result) {
              return (
                <details
                  key={task.id}
                  className="rounded-lg border bg-card p-3 shadow-sm transition-all hover:bg-accent/50"
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-2">
                        <div className="text-sm font-medium">{task.task}</div>
                        {preview ? (
                          <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                            {preview}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {task.source}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="whitespace-nowrap text-[10px]"
                        >
                          {formatRelativeDate(task.createdAt)}
                        </Badge>
                      </div>
                    </div>
                  </summary>
                  <div className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap">
                    {task.result}
                  </div>
                </details>
              );
            }

            return (
              <div
                key={task.id}
                className="rounded-lg border bg-card p-3 shadow-sm transition-all hover:bg-accent/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-2">
                    <div className="text-sm font-medium">{task.task}</div>
                    {preview ? (
                      <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {preview}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {task.source}
                    </Badge>
                    <Badge variant="outline" className="whitespace-nowrap text-[10px]">
                      {formatRelativeDate(task.createdAt)}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </>
  );
}

export function AgentTasksView({
  owner,
  agent,
  pendingTasks,
  completedTasks,
}: AgentTasksViewProps) {
  const agentType = agent.parentAgentId === null ? "lead" : "subordinate";

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={buildAgentPath(owner, agent.id)}
            className="text-sm text-muted-foreground hover:underline"
          >
            Back to agent
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-3xl font-bold">{agent.name}</h1>
            <Badge variant="outline">{agentType}</Badge>
            <Badge
              variant={agent.status === "running" ? "default" : "secondary"}
            >
              {agent.status}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={buildOwnerPath(owner)}>
            <Button variant="outline" size="sm">
              Back to {getOwnerLabel(owner.type)}
            </Button>
          </Link>
          <Link href={buildAgentPath(owner, agent.id, "chat")}>
            <Button size="sm" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Pending Tasks</CardTitle>
            <CardDescription>Queued tasks in FIFO order.</CardDescription>
          </CardHeader>
          <CardContent>
            <TaskList
              tasks={pendingTasks}
              emptyLabel="No pending tasks."
              description="Tasks remain pending until the full turn is persisted."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completed Tasks</CardTitle>
            <CardDescription>Completed tasks with saved outputs.</CardDescription>
          </CardHeader>
          <CardContent>
            <TaskList
              tasks={completedTasks}
              emptyLabel="No completed tasks yet."
              showResult
              collapsible
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
