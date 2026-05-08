import "@/lib/db/migrate";

import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, getCurrentUserId, notFound, readJson, requireWorkspace, unauthorized } from "@/lib/api";
import { db } from "@/lib/db/client";
import { createAssetImageJob, kickImageJobWorker } from "@/lib/image-jobs";

type Context = { params: Promise<{ workspaceId: string; assetId: string }> };

const inputSchema = z.object({
  prompt: z.string().optional(),
  referenceImageUrls: z.array(z.string()).optional().default([]),
  model: z.string().optional(),
  settings: z.object({
    aspectRatio: z.string().optional(),
    imageSize: z.string().optional(),
    quality: z.string().optional(),
  }).optional().default({}),
});

export async function POST(request: Request, context: Context) {
  try {
    const { workspaceId, assetId } = await context.params;
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();
    if (!requireWorkspace(workspaceId, userId)) return notFound("Workspace not found");

    const asset = db.prepare("SELECT id FROM assets WHERE workspace_id = ? AND id = ?").get(workspaceId, assetId);
    if (!asset) return notFound("Asset not found");

    const input: z.infer<typeof inputSchema> = await readJson(request, inputSchema).catch(() => ({ referenceImageUrls: [], settings: {} }));
    const jobId = createAssetImageJob({
      workspaceId,
      assetId,
      prompt: input.prompt,
      referenceImageUrls: input.referenceImageUrls,
      model: input.model,
      settings: input.settings,
    });
    kickImageJobWorker(workspaceId);
    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
