import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getEntityById } from "@/lib/db/queries/entities";
import { getWorkerIterationsWithInteractions } from "@/lib/db/queries/worker-iterations";

/**
 * GET /api/entities/[id]/interactions - List worker iterations with LLM interactions for an entity
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: entityId } = await params;

    // Verify entity exists and belongs to user
    const entity = await getEntityById(entityId);
    if (!entity || entity.userId !== session.user.id) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    // Get worker iterations with their interactions
    const iterations = await getWorkerIterationsWithInteractions(entityId);

    return NextResponse.json(iterations);
  } catch (error) {
    console.error("Error fetching worker iterations:", error);
    return NextResponse.json(
      { error: "Failed to fetch iterations" },
      { status: 500 }
    );
  }
}
