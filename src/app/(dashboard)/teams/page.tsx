import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Placeholder data - will be replaced with database queries
const mockTeams = [
  {
    id: "1",
    name: "Research Team",
    description: "Market research and competitive analysis",
    mission: "Monitor industry trends and provide weekly market insights",
    status: "active",
    agentCount: 3,
    createdAt: "2024-01-15",
  },
  {
    id: "2",
    name: "Content Team",
    description: "Blog posts and social media content",
    mission: "Create engaging content aligned with our brand voice",
    status: "active",
    agentCount: 2,
    createdAt: "2024-01-20",
  },
  {
    id: "3",
    name: "Customer Support",
    description: "Handle customer inquiries and feedback",
    mission: "Provide timely and helpful responses to customer questions",
    status: "paused",
    agentCount: 4,
    createdAt: "2024-01-10",
  },
];

export default function TeamsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teams</h1>
          <p className="text-muted-foreground">
            Manage your autonomous AI teams
          </p>
        </div>
        <Link href="/teams/new">
          <Button>Create Team</Button>
        </Link>
      </div>

      {mockTeams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <h3 className="text-lg font-semibold">No teams yet</h3>
            <p className="mt-2 text-center text-muted-foreground">
              Create your first autonomous team to get started.
            </p>
            <Link href="/teams/new" className="mt-4">
              <Button>Create Your First Team</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mockTeams.map((team) => (
            <Link key={team.id} href={`/teams/${team.id}`}>
              <Card className="h-full transition-colors hover:bg-accent/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                    <Badge
                      variant={
                        team.status === "active" ? "default" : "secondary"
                      }
                    >
                      {team.status}
                    </Badge>
                  </div>
                  <CardDescription>{team.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Mission:</span>
                      <p className="text-muted-foreground line-clamp-2">
                        {team.mission}
                      </p>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>
                        {team.agentCount} agent{team.agentCount !== 1 && "s"}
                      </span>
                      <span>Created {team.createdAt}</span>
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
