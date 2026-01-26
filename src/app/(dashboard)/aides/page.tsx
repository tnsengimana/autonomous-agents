import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth/config";
import { getAidesByUserId } from "@/lib/db/queries/aides";
import { getAgentsByAideId } from "@/lib/db/queries/agents";

export default async function AidesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const aides = await getAidesByUserId(session.user.id);

  // Fetch agent counts for each aide
  const aidesWithAgentCount = await Promise.all(
    aides.map(async (aide) => {
      const agents = await getAgentsByAideId(aide.id);
      return {
        ...aide,
        agentCount: agents.length,
      };
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Aides</h1>
          <p className="text-muted-foreground">
            Manage your personal AI assistants
          </p>
        </div>
        <Link href="/aides/new">
          <Button>Create Aide</Button>
        </Link>
      </div>

      {aidesWithAgentCount.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <h3 className="text-lg font-semibold">No aides yet</h3>
            <p className="mt-2 text-center text-muted-foreground">
              Create your first personal AI aide to get started.
            </p>
            <Link href="/aides/new" className="mt-4">
              <Button>Create Your First Aide</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {aidesWithAgentCount.map((aide) => (
            <Link key={aide.id} href={`/aides/${aide.id}`}>
              <Card className="h-full transition-colors hover:bg-accent/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{aide.name}</CardTitle>
                    <Badge
                      variant={
                        aide.status === "active" ? "default" : "secondary"
                      }
                    >
                      {aide.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {aide.purpose?.split("\n")[0] || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Purpose:</span>
                      <p className="text-muted-foreground line-clamp-2">
                        {aide.purpose || "No purpose set"}
                      </p>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>
                        {aide.agentCount} agent{aide.agentCount !== 1 && "s"}
                      </span>
                      <span>
                        Created{" "}
                        {new Date(aide.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
