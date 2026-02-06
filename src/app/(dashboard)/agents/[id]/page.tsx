import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/lib/auth/config";
import { getAgentById } from "@/lib/db/queries/agents";
import { AgentActions } from "@/components/agent-actions";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const { id } = await params;
  const agent = await getAgentById(id);

  if (!agent || agent.userId !== session.user.id) {
    notFound();
  }

  // Parse mission from purpose field
  const mission = agent.purpose?.includes("Mission:")
    ? agent.purpose.split("Mission:")[1]?.trim()
    : agent.purpose || "No mission set";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/agents"
          className="text-sm text-muted-foreground hover:underline"
        >
          Back to Agents
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{agent.name}</h1>
          </div>
          <AgentActions
            agentType="team"
            agentId={agent.id}
            agentName={agent.name}
            isActive={agent.isActive}
            currentIntervalMs={agent.iterationIntervalMs}
            backUrl="/agents"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4">
        <Link href={`/agents/${agent.id}/chat`}>
          <Button>Chat</Button>
        </Link>
        <Link href={`/agents/${agent.id}/worker-iterations`}>
          <Button variant="outline">Worker Iterations</Button>
        </Link>
        <Link href={`/agents/${agent.id}/knowledge-graph`}>
          <Button variant="outline">Knowledge Graph</Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Mission */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Mission</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{mission}</p>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={agent.isActive ? "secondary" : "outline"}>
                {agent.isActive ? "Active" : "Paused"}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="text-sm">
                {new Date(agent.createdAt).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
