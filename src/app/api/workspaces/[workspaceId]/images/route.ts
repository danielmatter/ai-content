import "@/lib/db/migrate";

import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, getCurrentUserId, notFound, readJson, requireWorkspace, unauthorized } from "@/lib/api";
import { db } from "@/lib/db/client";
import { insertImage, serializeImage } from "@/lib/image-library";

type Context = { params: Promise<{ workspaceId: string }> };

const imageSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2400).optional().default(""),
  sourceUrl: z.string().min(1).max(4000),
  thumbnailUrl: z.string().max(4000).optional().default(""),
  mimeType: z.string().max(120).optional().default(""),
});

export async function GET(_request: Request, context: Context) {
  const { workspaceId } = await context.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }

  if (!requireWorkspace(workspaceId, userId)) {
    return notFound("Workspace not found");
  }

  const images = db
    .prepare("SELECT * FROM images WHERE workspace_id = ? ORDER BY created_at DESC")
    .all(workspaceId)
    .map((image) => serializeImage(image as Record<string, unknown>));

  return NextResponse.json({ images });
}

export async function POST(request: Request, context: Context) {
  try {
    const { workspaceId } = await context.params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorized();
    }

    if (!requireWorkspace(workspaceId, userId)) {
      return notFound("Workspace not found");
    }

    const input = await readJson(request, imageSchema);
    const image = insertImage({
      workspaceId,
      title: input.title,
      description: input.description,
      sourceUrl: input.sourceUrl,
      thumbnailUrl: input.thumbnailUrl || input.sourceUrl,
      mimeType: input.mimeType,
    });

    return NextResponse.json({ image: serializeImage(image) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
