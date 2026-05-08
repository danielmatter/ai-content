import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { getCurrentUserId } from "@/lib/api";
import { refreshProcessingRenderJobs } from "@/lib/render-jobs";
import { kickImageJobWorker } from "@/lib/image-jobs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { workspaceId } = await params;

  // Validate workspace access
  const workspace = db.prepare("SELECT id FROM workspaces WHERE id = ? AND user_id = ?").get(workspaceId, userId);
  if (!workspace) return new NextResponse("Workspace not found", { status: 404 });

  kickImageJobWorker(workspaceId);
  await refreshProcessingRenderJobs(workspaceId);

  const jobs = db.prepare("SELECT * FROM render_jobs WHERE workspace_id = ? ORDER BY created_at DESC").all(workspaceId);
  return NextResponse.json({ jobs });
}
