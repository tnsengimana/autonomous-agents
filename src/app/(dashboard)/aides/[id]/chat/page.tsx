import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { getAideById, getAideLead } from '@/lib/db/queries/aides';
import { Chat } from '@/components/chat';

export default async function AideChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Check authentication
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const { id } = await params;

  // Get aide and verify ownership
  const aide = await getAideById(id);
  if (!aide || aide.userId !== session.user.id) {
    notFound();
  }

  // Get lead agent
  const leadAgent = await getAideLead(id);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/aides/${aide.id}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            Back to {aide.name}
          </Link>
          <h1 className="text-2xl font-bold">Chat with {aide.name}</h1>
        </div>
      </div>

      {leadAgent ? (
        <Chat
          aideId={aide.id}
          agentId={leadAgent.id}
          agentName={leadAgent.name}
          title={`${leadAgent.name} (Lead)`}
          description={`Chat with your aide's lead agent. ${leadAgent.role}`}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-lg border bg-muted/30">
          <div className="text-center">
            <p className="text-lg font-medium text-muted-foreground">
              No Lead Agent
            </p>
            <p className="text-sm text-muted-foreground">
              This aide does not have a lead agent configured.
            </p>
            <Link
              href={`/aides/${aide.id}/agents`}
              className="mt-4 inline-block text-sm text-primary hover:underline"
            >
              Configure agents
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
