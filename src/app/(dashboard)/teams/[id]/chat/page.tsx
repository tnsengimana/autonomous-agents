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
import { Input } from "@/components/ui/input";

// Placeholder data
const mockTeams: Record<string, { id: string; name: string }> = {
  "1": { id: "1", name: "Research Team" },
  "2": { id: "2", name: "Content Team" },
};

export default async function TeamChatPage({
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
    <div className="flex h-[calc(100vh-8rem)] flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/teams/${team.id}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            Back to {team.name}
          </Link>
          <h1 className="text-2xl font-bold">Chat with {team.name}</h1>
        </div>
      </div>

      <Card className="flex flex-1 flex-col">
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
          <CardDescription>
            Chat with your team lead agent. Messages are processed by the AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          {/* Messages area - placeholder */}
          <div className="flex-1 rounded-lg border bg-muted/30 p-4">
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-lg font-medium">Chat interface coming soon</p>
                <p className="text-sm">
                  This is a placeholder for the real-time chat UI.
                </p>
                <p className="mt-4 text-xs">
                  The chat interface will be implemented in Phase 4.
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
  );
}
