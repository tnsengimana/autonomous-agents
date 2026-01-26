import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getAideById } from "@/lib/db/queries/aides";
import { getAgentById } from "@/lib/db/queries/agents";
import {
  getOwnPendingTasks,
  getCompletedTasksForAgent,
} from "@/lib/db/queries/agentTasks";
import { AgentTasksView } from "@/components/agents";

export default async function AideAgentTasksPage({
  params,
}: {
  params: Promise<{ id: string; agentId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const { id, agentId } = await params;

  const aide = await getAideById(id);
  if (!aide || aide.userId !== session.user.id) notFound();

  const agent = await getAgentById(agentId);
  if (!agent || agent.aideId !== id) notFound();

  const [pendingTasks, completedTasks] = await Promise.all([
    getOwnPendingTasks(agentId),
    getCompletedTasksForAgent(agentId),
  ]);

  return (
    <AgentTasksView
      owner={{ type: "aide", id: aide.id, name: aide.name }}
      agent={agent}
      pendingTasks={pendingTasks}
      completedTasks={completedTasks}
    />
  );
}
