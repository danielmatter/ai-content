import "@/lib/db/migrate";

import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, getCurrentUserId, notFound, readJson, requireProject, requireScene, requireWorkspace, unauthorized } from "@/lib/api";
import { createFrameImageJob, kickImageJobWorker } from "@/lib/image-jobs";

const inputSchema = z.object({
  description: z.string().min(1),
  frameType: z.enum(["first", "last"]),
  referenceImageUrls: z.array(z.string()).optional().default([]),
  model: z.string().optional(),
  settings: z.object({
    aspectRatio: z.string().optional(),
    imageSize: z.string().optional(),
    quality: z.string().optional(),
  }).optional().default({}),
  scene: z.object({ title: z.string() }).optional(),
});

type Context = { params: Promise<{ workspaceId: string; projectId: string; sceneId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { workspaceId, projectId, sceneId } = await context.params;
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();
    if (!requireWorkspace(workspaceId, userId)) return notFound("Workspace not found");
    if (!requireProject(workspaceId, projectId)) return notFound("Project not found");

    const { description, frameType, referenceImageUrls, model, settings } = await readJson(request, inputSchema);
    if (sceneId !== "new") {
      const scene = requireScene(workspaceId, projectId, sceneId);
      if (!scene) return notFound("Scene not found");
    }

    const jobId = createFrameImageJob({ workspaceId, projectId, sceneId, frameType, description, referenceImageUrls, model, settings });
    kickImageJobWorker(workspaceId);
    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
