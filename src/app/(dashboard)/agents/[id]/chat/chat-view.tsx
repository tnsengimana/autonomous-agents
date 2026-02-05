"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Chat } from "@/components/chat";

export function AgentChatView({
  agent,
}: {
  agent: { id: string; name: string; systemPrompt: string };
}) {
  const [isSystemPromptOpen, setIsSystemPromptOpen] = useState(false);

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/agents/${agent.id}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            Back to Agent
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Chat with {agent.name}</h1>
        </div>
        <Dialog open={isSystemPromptOpen} onOpenChange={setIsSystemPromptOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              View System Prompt
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
            <DialogHeader>
              <DialogTitle>System Prompt</DialogTitle>
              <DialogDescription>
                The system prompt that guides this agent&apos;s behavior.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-auto">
              <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">
                {agent.systemPrompt}
              </pre>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Chat
        agentId={agent.id}
        agentName={agent.name}
        title="Conversation"
        description="Chat with your agent"
      />
    </div>
  );
}
