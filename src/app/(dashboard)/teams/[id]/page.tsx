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
import { Separator } from "@/components/ui/separator";

// Placeholder data - will be replaced with database queries
const mockTeams: Record<string, {
  id: string;
  name: string;
  description: string;
  mission: string;
  status: string;
  createdAt: string;
  agents: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
  }>;
}> = {
  "1": {
    id: "1",
    name: "Research Team",
    description: "Market research and competitive analysis",
    mission:
      "Monitor industry trends, track competitor activities, and provide weekly market insights to inform strategic decisions.",
    status: "active",
    createdAt: "2024-01-15",
    agents: [
      { id: "a1", name: "Research Lead", type: "lead", status: "running" },
      { id: "a2", name: "Web Researcher", type: "worker", status: "idle" },
      { id: "a3", name: "Data Analyst", type: "worker", status: "idle" },
    ],
  },
  "2": {
    id: "2",
    name: "Content Team",
    description: "Blog posts and social media content",
    mission:
      "Create engaging content aligned with our brand voice and publish across all channels.",
    status: "active",
    createdAt: "2024-01-20",
    agents: [
      { id: "a4", name: "Content Lead", type: "lead", status: "running" },
      { id: "a5", name: "Writer", type: "worker", status: "idle" },
    ],
  },
};

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const team = mockTeams[id];

  if (!team) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/teams"
            className="text-sm text-muted-foreground hover:underline"
          >
            Back to Teams
          </Link>
          <h1 className="mt-2 text-3xl font-bold">{team.name}</h1>
          <p className="text-muted-foreground">{team.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={team.status === "active" ? "default" : "secondary"}>
            {team.status}
          </Badge>
          <Link href={`/teams/${team.id}/chat`}>
            <Button>Chat with Team</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Mission */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Mission</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{team.mission}</p>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-2xl font-bold">{team.agents.length}</div>
              <div className="text-sm text-muted-foreground">Agents</div>
            </div>
            <Separator />
            <div>
              <div className="text-sm font-medium">Created</div>
              <div className="text-sm text-muted-foreground">
                {team.createdAt}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agents */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Agents</CardTitle>
              <CardDescription>
                Team members and their current status
              </CardDescription>
            </div>
            <Link href={`/teams/${team.id}/agents`}>
              <Button variant="outline" size="sm">
                Manage Agents
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {team.agents.map((agent) => (
              <Link
                key={agent.id}
                href={`/teams/${team.id}/agents/${agent.id}`}
                className="block"
              >
                <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{agent.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {agent.type}
                      </Badge>
                    </div>
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
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Manage your team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">Edit Team</Button>
            <Button variant="outline">Add Worker Agent</Button>
            {team.status === "active" ? (
              <Button variant="outline">Pause Team</Button>
            ) : (
              <Button variant="outline">Resume Team</Button>
            )}
            <Button variant="destructive">Delete Team</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
