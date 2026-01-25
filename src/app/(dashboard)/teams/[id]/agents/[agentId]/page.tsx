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
import { Input } from "@/components/ui/input";

// Placeholder data
const mockAgents: Record<string, {
  id: string;
  name: string;
  type: string;
  status: string;
  description: string;
  systemPrompt: string;
  teamId: string;
  teamName: string;
}> = {
  a1: {
    id: "a1",
    name: "Research Lead",
    type: "lead",
    status: "running",
    description: "Coordinates research activities and synthesizes findings",
    systemPrompt:
      "You are an expert market researcher with 10 years of experience. You focus on identifying trends and providing actionable insights. You coordinate a team of researchers and analysts to deliver comprehensive market intelligence.",
    teamId: "1",
    teamName: "Research Team",
  },
  a2: {
    id: "a2",
    name: "Web Researcher",
    type: "worker",
    status: "idle",
    description: "Searches the web for relevant information and sources",
    systemPrompt:
      "You are a skilled web researcher. You excel at finding authoritative sources, verifying information, and summarizing key findings.",
    teamId: "1",
    teamName: "Research Team",
  },
  a3: {
    id: "a3",
    name: "Data Analyst",
    type: "worker",
    status: "idle",
    description: "Analyzes data and generates insights",
    systemPrompt:
      "You are a data analyst specializing in market data. You identify patterns, create visualizations, and provide data-driven recommendations.",
    teamId: "1",
    teamName: "Research Team",
  },
  a4: {
    id: "a4",
    name: "Content Lead",
    type: "lead",
    status: "running",
    description: "Plans content strategy and coordinates writers",
    systemPrompt:
      "You are a content strategist and editor. You plan content calendars, review drafts, and ensure brand consistency.",
    teamId: "2",
    teamName: "Content Team",
  },
  a5: {
    id: "a5",
    name: "Writer",
    type: "worker",
    status: "idle",
    description: "Creates blog posts and social media content",
    systemPrompt:
      "You are a skilled copywriter. You create engaging blog posts, social media content, and marketing copy.",
    teamId: "2",
    teamName: "Content Team",
  },
};

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string; agentId: string }>;
}) {
  const { id, agentId } = await params;
  const agent = mockAgents[agentId];

  if (!agent || agent.teamId !== id) {
    notFound();
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/teams/${agent.teamId}/agents`}
            className="text-sm text-muted-foreground hover:underline"
          >
            Back to Agents
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{agent.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">{agent.type}</Badge>
            <Badge
              variant={agent.status === "running" ? "default" : "secondary"}
            >
              {agent.status}
            </Badge>
          </div>
        </div>
        <Button variant="outline">Edit Agent</Button>
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-2">
        {/* Agent Info */}
        <Card>
          <CardHeader>
            <CardTitle>Agent Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium">Description</div>
              <p className="text-sm text-muted-foreground">
                {agent.description}
              </p>
            </div>
            <div>
              <div className="text-sm font-medium">System Prompt</div>
              <p className="mt-1 rounded-lg border bg-muted/50 p-3 text-sm">
                {agent.systemPrompt}
              </p>
            </div>
            <div>
              <div className="text-sm font-medium">Team</div>
              <Link
                href={`/teams/${agent.teamId}`}
                className="text-sm text-primary hover:underline"
              >
                {agent.teamName}
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Direct Chat */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Direct Chat</CardTitle>
            <CardDescription>
              Chat directly with this agent
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {/* Messages area - placeholder */}
            <div className="flex-1 rounded-lg border bg-muted/30 p-4">
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <p className="font-medium">Direct chat coming soon</p>
                  <p className="text-sm">
                    This is a placeholder for the agent chat UI.
                  </p>
                </div>
              </div>
            </div>

            {/* Input area - placeholder */}
            <div className="mt-4 flex gap-2">
              <Input
                placeholder="Type your message..."
                disabled
                className="flex-1"
              />
              <Button disabled>Send</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
