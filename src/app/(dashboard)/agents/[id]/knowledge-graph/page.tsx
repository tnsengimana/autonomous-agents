import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getAgentById } from "@/lib/db/queries/agents";
import { KnowledgeGraphView } from "./knowledge-graph-view";

export default async function KnowledgeGraphPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const { id } = await params;
  const agent = await getAgentById(id);

  if (!agent || agent.userId !== session.user.id) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/agents/${agent.id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          Back to {agent.name}
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Knowledge Graph</h1>
        <p className="text-muted-foreground">
          Interactive visualization of {agent.name}&apos;s knowledge
        </p>
      </div>
      <div className="h-[calc(100vh-14rem)]">
        <KnowledgeGraphView agentId={agent.id} />
      </div>
    </div>
  );
}
