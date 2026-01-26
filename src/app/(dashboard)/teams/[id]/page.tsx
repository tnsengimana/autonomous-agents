import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
import { auth } from "@/lib/auth/config";
import { getTeamWithAgents } from "@/lib/db/queries/teams";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const { id } = await params;
  const team = await getTeamWithAgents(id);

  if (!team || team.userId !== session.user.id) {
    notFound();
  }

  // Parse mission from purpose field
  const description = team.purpose?.split("\n")[0] || "";
  const mission = team.purpose?.includes("Mission:")
    ? team.purpose.split("Mission:")[1]?.trim()
    : team.purpose || "No mission set";

  // Find the team lead (agent with no parent)
  const teamLead = team.agents.find((a) => a.parentAgentId === null);

  // Get subordinate agents
  const subordinateAgents = team.agents.filter((a) => a.parentAgentId !== null);

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
          <p className="text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {teamLead && (
            <Link href={`/teams/${team.id}/agents/${teamLead.id}/chat`}>
              <Button>Chat with Team</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Mission */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Mission</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{mission}</p>
          </CardContent>
        </Card>

        {/* Quick Stats + Action Buttons */}
        <div className="space-y-4">
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
                  {new Date(team.createdAt).toLocaleDateString()}
                </div>
              </div>
              <Separator />
              <div>
                <div className="text-sm font-medium">Status</div>
                <Badge
                  variant={team.status === "active" ? "default" : "secondary"}
                  className="mt-1"
                >
                  {team.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              Edit Team
            </Button>
            {team.status === "active" ? (
              <Button variant="outline" size="sm">
                Pause Team
              </Button>
            ) : (
              <Button variant="outline" size="sm">
                Resume Team
              </Button>
            )}
            <Button variant="destructive" size="sm">
              Delete Team
            </Button>
          </div>
        </div>
      </div>

      {/* Lead Agent */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Agents</CardTitle>
              <CardDescription>
                Team members and their current status
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!teamLead ? (
            <p className="text-muted-foreground">No lead agent yet.</p>
          ) : (
            <Link
              href={`/teams/${team.id}/agents/${teamLead.id}`}
              className="block"
            >
              <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{teamLead.name}</span>
                    <Badge variant="outline" className="text-xs">
                      lead
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {teamLead.role}
                  </div>
                </div>
                <Badge
                  variant={
                    teamLead.status === "running" ? "default" : "secondary"
                  }
                >
                  {teamLead.status}
                </Badge>
              </div>
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Subordinates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Subordinates</CardTitle>
              <CardDescription>
                Subordinates spawn on-demand to handle specific tasks
              </CardDescription>
            </div>
            <Link href={`/teams/${team.id}/agents/new`}>
              <Button variant="outline" size="sm">
                Add Subordinate
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {subordinateAgents.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>No subordinate agents yet.</p>
              <Link href={`/teams/${team.id}/agents/new`}>
                <Button variant="link" className="mt-2">
                  Add your first subordinate agent
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {subordinateAgents.map((agent) => (
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
                          subordinate
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {agent.role}
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
