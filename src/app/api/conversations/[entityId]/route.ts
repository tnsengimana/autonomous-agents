import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getEntityById } from "@/lib/db/queries/entities";
import { getLatestConversation } from "@/lib/db/queries/conversations";
import { getMessagesByConversationId, getMessageText } from "@/lib/db/queries/messages";

/**
 * GET /api/conversations/[entityId]
 *
 * Returns the conversation for an entity.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  try {
    // 1. Verify user is authenticated
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { entityId } = await params;

    // 2. Verify user owns the entity
    const entity = await getEntityById(entityId);
    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    if (entity.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Get the conversation and messages
    const conversation = await getLatestConversation(entityId);
    if (!conversation) {
      return NextResponse.json({ messages: [] });
    }

    const messages = await getMessagesByConversationId(conversation.id);

    // 4. Filter out summary messages and format response
    // Map 'llm' role to 'assistant' for UI compatibility
    const filteredMessages = messages
      .filter((m) => m.role !== "summary")
      .map((m) => ({
        id: m.id,
        role: m.role === "llm" ? "assistant" : m.role,
        content: getMessageText(m),
        createdAt: m.createdAt,
      }));

    return NextResponse.json({
      conversationId: conversation.id,
      messages: filteredMessages,
    });
  } catch (error) {
    console.error("Conversation API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
