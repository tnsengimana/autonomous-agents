import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// Placeholder data
const mockInboxItems = [
  {
    id: "1",
    type: "briefing",
    title: "Daily Market Summary",
    content:
      "Today's market analysis shows significant movement in the tech sector. Key highlights include: increased activity in AI-related stocks, new regulatory announcements affecting cryptocurrency markets, and emerging trends in sustainable technology investments. Our research team recommends focusing attention on the renewable energy sector for the coming week.",
    teamName: "Research Team",
    agentName: "Research Lead",
    createdAt: "2 hours ago",
    read: false,
  },
  {
    id: "2",
    type: "signal",
    title: "Competitor Launch Detected",
    content:
      "Acme Corp has announced a new product that directly competes with our flagship offering. Initial market reception appears positive based on social media sentiment analysis. Recommend scheduling a competitive analysis session to evaluate potential impacts on our market position.",
    teamName: "Research Team",
    agentName: "Web Researcher",
    createdAt: "5 hours ago",
    read: false,
  },
  {
    id: "3",
    type: "alert",
    title: "Unusual Traffic Pattern",
    content:
      "Website traffic from organic search has increased 340% in the last 24 hours. This spike appears to be driven by a viral social media post mentioning our product. Consider preparing additional server capacity and customer support resources.",
    teamName: "Research Team",
    agentName: "Data Analyst",
    createdAt: "1 day ago",
    read: true,
  },
  {
    id: "4",
    type: "briefing",
    title: "Content Performance Report",
    content:
      "This week's content performance metrics are in. Blog posts about AI productivity tools performed 2x better than average. Social media engagement is up 15% week-over-week. Recommend creating more AI-focused content to capitalize on this trend.",
    teamName: "Content Team",
    agentName: "Content Lead",
    createdAt: "2 days ago",
    read: true,
  },
];

function InboxItemBadge({ type }: { type: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    briefing: "default",
    signal: "secondary",
    alert: "destructive",
  };
  const labels: Record<string, string> = {
    briefing: "Briefing",
    signal: "Signal",
    alert: "Alert",
  };
  return <Badge variant={variants[type] || "outline"}>{labels[type] || type}</Badge>;
}

export default function InboxPage() {
  const unreadCount = mockInboxItems.filter((item) => !item.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inbox</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} unread message${unreadCount !== 1 ? "s" : ""}`
              : "All caught up!"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Mark All Read
          </Button>
          <Button variant="outline" size="sm">
            Filter
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Item List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Messages</CardTitle>
            <CardDescription>
              Briefings, signals, and alerts from your teams
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="divide-y">
                {mockInboxItems.map((item) => (
                  <div
                    key={item.id}
                    className={`cursor-pointer p-4 transition-colors hover:bg-accent ${
                      !item.read ? "bg-accent/50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <InboxItemBadge type={item.type} />
                          {!item.read && (
                            <div className="h-2 w-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <h3 className="mt-1 font-medium truncate">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.teamName} - {item.createdAt}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Item Detail */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <InboxItemBadge type={mockInboxItems[0].type} />
                  <span className="text-sm text-muted-foreground">
                    {mockInboxItems[0].createdAt}
                  </span>
                </div>
                <CardTitle className="mt-2">{mockInboxItems[0].title}</CardTitle>
                <CardDescription>
                  From {mockInboxItems[0].agentName} ({mockInboxItems[0].teamName})
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Archive
                </Button>
                <Button variant="outline" size="sm">
                  Reply
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p>{mockInboxItems[0].content}</p>
            </div>
            <Separator className="my-6" />
            <div className="text-sm text-muted-foreground">
              <p>
                <span className="font-medium">Source:</span>{" "}
                {mockInboxItems[0].teamName}
              </p>
              <p>
                <span className="font-medium">Agent:</span>{" "}
                {mockInboxItems[0].agentName}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
