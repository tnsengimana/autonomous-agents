import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Placeholder data
const mockTeams: Record<string, {
  id: string;
  name: string;
  agents: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    description: string;
  }>;
}> = {
  "1": {
    id: "1",
    name: "Research Team",
    agents: [
      {
        id: "a1",
        name: "Research Lead",
        type: "lead",
        status: "running",
        description: "Coordinates research activities and synthesizes findings",
      },
      {
        id: "a2",
        name: "Web Researcher",
        type: "worker",
        status: "idle",
        description: "Searches the web for relevant information and sources",
      },
      {
        id: "a3",
        name: "Data Analyst",
        type: "worker",
        status: "idle",
        description: "Analyzes data and generates insights",
      },
    ],
  },
  "2": {
    id: "2",
    name: "Content Team",
    agents: [
      {
        id: "a4",
        name: "Content Lead",
        type: "lead",
        status: "running",
        description: "Plans content strategy and coordinates writers",
      },
      {
        id: "a5",
        name: "Writer",
        type: "worker",
        status: "idle",
        description: "Creates blog posts and social media content",
      },
    ],
  },
};

export default async function TeamAgentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const team = mockTeams[id];

  if (!team) {
    notFound();
  }

  const leadAgent = team.agents.find((a) => a.type === "lead");
  const workerAgents = team.agents.filter((a) => a.type === "worker");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/teams/${team.id}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            Back to {team.name}
          </Link>
          <h1 className="mt-2 text-3xl font-bold">Agents</h1>
          <p className="text-muted-foreground">
            Manage agents in {team.name}
          </p>
        </div>
        <Button>Add Worker Agent</Button>
      </div>

      {/* Team Lead */}
      {leadAgent && (
        <Card>
          <CardHeader>
            <CardTitle>Team Lead</CardTitle>
            <CardDescription>
              The team lead runs continuously and coordinates worker agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/teams/${team.id}/agents/${leadAgent.id}`}>
              <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{leadAgent.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {leadAgent.type}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {leadAgent.description}
                  </p>
                </div>
                <Badge
                  variant={
                    leadAgent.status === "running" ? "default" : "secondary"
                  }
                >
                  {leadAgent.status}
                </Badge>
              </div>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Worker Agents */}
      <Card>
        <CardHeader>
          <CardTitle>Worker Agents</CardTitle>
          <CardDescription>
            Workers spawn on-demand to handle specific tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workerAgents.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>No worker agents yet.</p>
              <Button variant="link" className="mt-2">
                Add your first worker agent
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {workerAgents.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/teams/${team.id}/agents/${agent.id}`}
                >
                  <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{agent.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {agent.type}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {agent.description}
                      </p>
                    </div>
                    <Badge
                      variant={
                        agent.status === "running" ? "default" : "secondary"
                      }
                    >
                      {agent.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
