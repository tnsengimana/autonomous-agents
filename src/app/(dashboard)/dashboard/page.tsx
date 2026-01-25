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
import { ScrollArea } from "@/components/ui/scroll-area";

// Placeholder data - will be replaced with database queries
const mockTeams = [
  {
    id: "1",
    name: "Research Team",
    description: "Market research and competitive analysis",
    status: "active",
    agentCount: 3,
  },
  {
    id: "2",
    name: "Content Team",
    description: "Blog posts and social media content",
    status: "active",
    agentCount: 2,
  },
];

const mockInboxItems = [
  {
    id: "1",
    type: "briefing",
    title: "Daily Market Summary",
    preview: "Key findings from today's market analysis...",
    createdAt: "2 hours ago",
    read: false,
  },
  {
    id: "2",
    type: "signal",
    title: "Competitor Launch Detected",
    preview: "New product announcement from Acme Corp...",
    createdAt: "5 hours ago",
    read: false,
  },
  {
    id: "3",
    type: "alert",
    title: "Unusual Traffic Pattern",
    preview: "Website traffic spike detected...",
    createdAt: "1 day ago",
    read: true,
  },
];

function InboxItemBadge({ type }: { type: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    briefing: "default",
    signal: "secondary",
    alert: "destructive",
  };
  return <Badge variant={variants[type] || "outline"}>{type}</Badge>;
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Link href="/teams/new">
          <Button>Create Team</Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Teams List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Teams</CardTitle>
            <CardDescription>
              Active teams and their current status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-4">
                {mockTeams.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <p>No teams yet.</p>
                    <Link href="/teams/new">
                      <Button variant="link">Create your first team</Button>
                    </Link>
                  </div>
                ) : (
                  mockTeams.map((team) => (
                    <Link
                      key={team.id}
                      href={`/teams/${team.id}`}
                      className="block"
                    >
                      <div className="rounded-lg border p-4 transition-colors hover:bg-accent">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{team.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {team.description}
                            </p>
                          </div>
                          <Badge
                            variant={
                              team.status === "active" ? "default" : "secondary"
                            }
                          >
                            {team.status}
                          </Badge>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {team.agentCount} agent{team.agentCount !== 1 && "s"}
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Inbox Preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Inbox</CardTitle>
                <CardDescription>
                  Recent briefings, signals, and alerts
                </CardDescription>
              </div>
              <Link href="/inbox">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-4">
                {mockInboxItems.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <p>No items in inbox.</p>
                    <p className="text-sm">
                      Your agents will send updates here.
                    </p>
                  </div>
                ) : (
                  mockInboxItems.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-lg border p-4 ${
                        !item.read ? "bg-accent/50" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <InboxItemBadge type={item.type} />
                            <span className="text-xs text-muted-foreground">
                              {item.createdAt}
                            </span>
                          </div>
                          <h3 className="mt-1 font-medium">{item.title}</h3>
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {item.preview}
                          </p>
                        </div>
                        {!item.read && (
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
