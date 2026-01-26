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
import { getAideWithAgents } from "@/lib/db/queries/aides";

export default async function AideDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const { id } = await params;
  const aide = await getAideWithAgents(id);

  if (!aide || aide.userId !== session.user.id) {
    notFound();
  }

  // Parse purpose
  const purpose = aide.purpose || "No purpose set";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/aides"
            className="text-sm text-muted-foreground hover:underline"
          >
            Back to Aides
          </Link>
          <h1 className="mt-2 text-3xl font-bold">{aide.name}</h1>
          <p className="text-muted-foreground">Personal AI assistant</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={aide.status === "active" ? "default" : "secondary"}>
            {aide.status}
          </Badge>
          <Link href={`/aides/${aide.id}/chat`}>
            <Button>Chat with Aide</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Purpose */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Purpose</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{purpose}</p>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-2xl font-bold">{aide.agents.length}</div>
              <div className="text-sm text-muted-foreground">Agents</div>
            </div>
            <Separator />
            <div>
              <div className="text-sm font-medium">Created</div>
              <div className="text-sm text-muted-foreground">
                {new Date(aide.createdAt).toLocaleDateString()}
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
                Aide agents and their current status
              </CardDescription>
            </div>
            <Link href={`/aides/${aide.id}/agents`}>
              <Button variant="outline" size="sm">
                Manage Agents
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {aide.agents.length === 0 ? (
            <p className="text-muted-foreground">No agents yet.</p>
          ) : (
            <div className="space-y-4">
              {aide.agents.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/aides/${aide.id}/agents/${agent.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{agent.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {agent.parentAgentId ? "subordinate" : "lead"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {agent.role}
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
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Manage your aide</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">Edit Aide</Button>
            <Button variant="outline">Add Subordinate</Button>
            {aide.status === "active" ? (
              <Button variant="outline">Pause Aide</Button>
            ) : (
              <Button variant="outline">Resume Aide</Button>
            )}
            <Button variant="destructive">Delete Aide</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
