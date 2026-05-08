import "@/lib/db/migrate";

import { NextResponse } from "next/server";

import { apiError, assetSchema, getCurrentUserId, notFound, readJson, requireWorkspace, unauthorized } from "@/lib/api";
import { db, makeId, now, parseJsonArray, toJsonArray } from "@/lib/db/client";

type Context = { params: Promise<{ workspaceId: string }> };

function serializeAsset(asset: Record<string, unknown>) {
  return {
    ...asset,
    imageUrls: parseJsonArray(asset.image_urls),
    audioUrl: asset.audio_url,
    audioMimeType: asset.audio_mime_type,
  };
}

export async function GET(_request: Request, context: Context) {
  const { workspaceId } = await context.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }

  if (!requireWorkspace(workspaceId, userId)) {
    return notFound("Workspace not found");
  }

  const assets = db
    .prepare("SELECT * FROM assets WHERE workspace_id = ? ORDER BY type ASC, updated_at DESC")
    .all(workspaceId)
    .map((asset) => serializeAsset(asset as Record<string, unknown>));

  return NextResponse.json({ assets });
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

    const input = await readJson(request, assetSchema);
    const createdAt = now();
    const asset = {
      id: makeId("ast"),
      workspace_id: workspaceId,
      type: input.type,
      title: input.title,
      description: input.description,
      text: input.text,
      image_urls: toJsonArray(input.imageUrls),
      audio_url: input.audioUrl,
      audio_mime_type: input.audioMimeType,
      created_at: createdAt,
      updated_at: createdAt,
    };

    db.prepare(
      `INSERT INTO assets (id, workspace_id, type, title, description, text, image_urls, audio_url, audio_mime_type, created_at, updated_at)
       VALUES (@id, @workspace_id, @type, @title, @description, @text, @image_urls, @audio_url, @audio_mime_type, @created_at, @updated_at)`,
    ).run(asset);

    return NextResponse.json({ asset: serializeAsset(asset) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
