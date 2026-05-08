import "@/lib/db/migrate";

import { NextResponse } from "next/server";

import { apiError, getCurrentUserId, notFound, projectSceneSchema, readJson, requireWorkspace, unauthorized } from "@/lib/api";
import { db, now, parseJsonArray, toJsonArray } from "@/lib/db/client";

type Context = { params: Promise<{ workspaceId: string; projectId: string; sceneId: string }> };

function getScene(projectId: string, sceneId: string) {
  return db
    .prepare("SELECT * FROM project_scenes WHERE project_id = ? AND id = ?")
    .get(projectId, sceneId) as Record<string, unknown> | undefined;
}

function serializeScene(scene: Record<string, unknown>) {
  return {
    ...scene,
    assetIds: parseJsonArray(scene.asset_ids),
    firstFrameDescription: scene.first_frame_description,
    lastFrameDescription: scene.last_frame_description,
  };
}

export async function GET(_request: Request, context: Context) {
  const { workspaceId, projectId, sceneId } = await context.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }

  if (!requireWorkspace(workspaceId, userId)) {
    return notFound("Workspace not found");
  }

  const scene = getScene(projectId, sceneId);
  return scene ? NextResponse.json({ scene: serializeScene(scene) }) : notFound("Scene not found");
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { workspaceId, projectId, sceneId } = await context.params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorized();
    }

    if (!requireWorkspace(workspaceId, userId)) {
      return notFound("Workspace not found");
    }

    const current = getScene(projectId, sceneId);
    if (!current) {
      return notFound("Scene not found");
    }

    const input = await readJson(request, projectSceneSchema.partial());
    const updatedAt = now();
    const nextScene = {
      id: sceneId,
      position: input.position ?? current.position,
      title: input.title ?? current.title,
      description: input.description ?? current.description,
      action: input.action ?? current.action,
      look: input.look ?? current.look,
      first_frame_url: input.firstFrameUrl ?? current.first_frame_url,
      last_frame_url: input.lastFrameUrl ?? current.last_frame_url,
      first_frame_description: input.firstFrameDescription ?? current.first_frame_description,
      last_frame_description: input.lastFrameDescription ?? current.last_frame_description,
      asset_ids: input.assetIds ? toJsonArray(input.assetIds) : current.asset_ids,
      updated_at: updatedAt,
    };

    db.transaction(() => {
      db.prepare(
        `UPDATE project_scenes
         SET position = @position, title = @title, description = @description, action = @action, look = @look,
             first_frame_url = @first_frame_url, last_frame_url = @last_frame_url,
             first_frame_description = @first_frame_description, last_frame_description = @last_frame_description,
             asset_ids = @asset_ids, updated_at = @updated_at
         WHERE id = @id`,
      ).run(nextScene);

      if (input.assetIds) {
        // Sync scene_assets
        db.prepare("DELETE FROM scene_assets WHERE scene_id = ?").run(sceneId);
        if (input.assetIds.length > 0) {
          const stmt = db.prepare("INSERT INTO scene_assets (scene_id, asset_id, created_at) VALUES (?, ?, ?)");
          for (const assetId of input.assetIds) {
            stmt.run(sceneId, assetId, updatedAt);
          }
        }
      }
    })();

    return NextResponse.json({ scene: serializeScene(getScene(projectId, sceneId)!) });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { workspaceId, projectId, sceneId } = await context.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }

  if (!requireWorkspace(workspaceId, userId)) {
    return notFound("Workspace not found");
  }

  db.prepare("DELETE FROM project_scenes WHERE project_id = ? AND id = ?").run(projectId, sceneId);
  return NextResponse.json({ ok: true });
}
