import "@/lib/db/migrate";

import { NextResponse } from "next/server";

import { apiError, assetSchema, getCurrentUserId, notFound, readJson, requireWorkspace, unauthorized } from "@/lib/api";
import { db, now, parseJsonArray, toJsonArray } from "@/lib/db/client";

type Context = { params: Promise<{ workspaceId: string; assetId: string }> };

function getAsset(workspaceId: string, assetId: string) {
  return db
    .prepare("SELECT * FROM assets WHERE workspace_id = ? AND id = ?")
    .get(workspaceId, assetId) as Record<string, unknown> | undefined;
}

function serializeAsset(asset: Record<string, unknown>) {
  return {
    ...asset,
    imageUrls: parseJsonArray(asset.image_urls),
    audioUrl: asset.audio_url,
    audioMimeType: asset.audio_mime_type,
  };
}

export async function GET(_request: Request, context: Context) {
  const { workspaceId, assetId } = await context.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }

  if (!requireWorkspace(workspaceId, userId)) {
    return notFound("Workspace not found");
  }

  const asset = getAsset(workspaceId, assetId);
  return asset ? NextResponse.json({ asset: serializeAsset(asset) }) : notFound("Asset not found");
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { workspaceId, assetId } = await context.params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorized();
    }

    if (!requireWorkspace(workspaceId, userId)) {
      return notFound("Workspace not found");
    }

    const current = getAsset(workspaceId, assetId);
    if (!current) {
      return notFound("Asset not found");
    }

    const input = await readJson(request, assetSchema.partial());
    const nextAsset = {
      id: assetId,
      type: input.type ?? current.type,
      title: input.title ?? current.title,
      description: input.description ?? current.description,
      text: input.text ?? current.text,
      image_urls: input.imageUrls ? toJsonArray(input.imageUrls) : current.image_urls,
      audio_url: input.audioUrl ?? current.audio_url,
      audio_mime_type: input.audioMimeType ?? current.audio_mime_type,
      updated_at: now(),
    };

    db.prepare(
      `UPDATE assets
       SET type = @type, title = @title, description = @description, text = @text, image_urls = @image_urls,
           audio_url = @audio_url, audio_mime_type = @audio_mime_type, updated_at = @updated_at
       WHERE id = @id`,
    ).run(nextAsset);

    return NextResponse.json({ asset: serializeAsset(getAsset(workspaceId, assetId)!) });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { workspaceId, assetId } = await context.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }

  if (!requireWorkspace(workspaceId, userId)) {
    return notFound("Workspace not found");
  }

  const scenes = db
    .prepare(
      `SELECT project_scenes.id, project_scenes.asset_ids
       FROM project_scenes
       INNER JOIN projects ON projects.id = project_scenes.project_id
       WHERE projects.workspace_id = ?`,
    )
    .all(workspaceId) as { id: string; asset_ids: string }[];

  db.transaction(() => {
    const updateScene = db.prepare("UPDATE project_scenes SET asset_ids = ? WHERE id = ?");

    for (const scene of scenes) {
      const currentAssetIds = parseJsonArray(scene.asset_ids);
      const nextAssetIds = currentAssetIds.filter((id) => id !== assetId);
      if (nextAssetIds.length !== currentAssetIds.length) {
        updateScene.run(toJsonArray(nextAssetIds), scene.id);
      }
    }

    db.prepare("DELETE FROM assets WHERE workspace_id = ? AND id = ?").run(workspaceId, assetId);
  })();

  return NextResponse.json({ ok: true });
}
