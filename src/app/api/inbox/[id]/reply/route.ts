/**
 * POST /api/inbox/[id]/reply - Reply to an inbox item
 *
 * Sends a reply message to the agent that created the inbox item.
 * The message includes context from the original inbox item.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getInboxItemById, deleteInboxItem } from '@/lib/db/queries/inboxItems';
import { Agent } from '@/lib/agents/agent';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // 1. Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // 3. Get inbox item
    const { id } = await params;
    const inboxItem = await getInboxItemById(id);

    if (!inboxItem) {
      return NextResponse.json(
        { error: 'Inbox item not found' },
        { status: 404 }
      );
    }

    // 4. Verify ownership
    if (inboxItem.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 5. Load agent
    const agent = await Agent.fromId(inboxItem.agentId);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // 6. Format message with context
    const formattedMessage = `User is replying to your inbox message:

---
**Original Message (${inboxItem.type}): ${inboxItem.title}**
${inboxItem.content}
---

**User's Reply:**
${message}`;

    // 7. Send to agent
    await agent.handleMessageSync(formattedMessage);

    // 8. Delete inbox item after successful reply
    await deleteInboxItem(id);

    return NextResponse.json({
      success: true,
      message: 'Reply sent to agent',
      agentId: inboxItem.agentId,
    });
  } catch (error) {
    console.error('Inbox reply error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
