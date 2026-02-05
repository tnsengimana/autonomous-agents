import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getAgentById } from "@/lib/db/queries/agents";
import { AgentChatView } from "./chat-view";

export default async function AgentChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const { id } = await params;

  const agent = await getAgentById(id);
  if (!agent || agent.userId !== session.user.id) notFound();

  return (
    <AgentChatView
      agent={{
        id: agent.id,
        name: agent.name,
        systemPrompt: agent.conversationSystemPrompt ?? '',
      }}
    />
  );
}
