import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { getCurrentUserId } from "@/lib/api";
import { refreshRenderJob } from "@/lib/render-jobs";
import { kickImageJobWorker } from "@/lib/image-jobs";
import { serializeImage } from "@/lib/image-library";

type RenderJobRow = {
  id: string;
  workspace_id: string;
  kind: "video" | "image";
  project_id: string;
  scene_id: string;
  asset_id: string | null;
  frame_type: "first" | "last" | null;
  description: string;
  image_id: string | null;
  image_url: string | null;
  status: "pending" | "processing" | "completed" | "downloaded" | "failed";
  video_url: string | null;
  error: string | null;
  openrouter_job_id: string | null;
  openrouter_polling_url: string | null;
  last_queried: string | null;
  last_query_status: string | null;
  created_at: string;
  updated_at: string;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; jobId: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { workspaceId, jobId } = await params;

  // Validate workspace access
  const workspace = db.prepare("SELECT id FROM workspaces WHERE id = ? AND user_id = ?").get(workspaceId, userId);
  if (!workspace) return new NextResponse("Workspace not found", { status: 404 });

  const job = db.prepare("SELECT * FROM render_jobs WHERE id = ? AND workspace_id = ?").get(jobId, workspaceId) as RenderJobRow | undefined;
  if (!job) return new NextResponse("Job not found", { status: 404 });

  const refreshedJob = job.kind === "image" ? job : await refreshRenderJob(job);
  if (job.kind === "image") {
    kickImageJobWorker(workspaceId);
  }
  const imageId = job.kind === "image" ? job.image_id : null;
  const image = imageId
    ? db.prepare("SELECT * FROM images WHERE id = ? AND workspace_id = ?").get(imageId, workspaceId)
    : null;
  return NextResponse.json({
    job: refreshedJob,
    image: image ? serializeImage(image as Record<string, unknown>) : null,
  });
}
