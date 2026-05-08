import "@/lib/db/migrate";

import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, filterOwnedAssetIds, getCurrentUserId, notFound, projectSceneSchema, readJson, requireProject, requireWorkspace, unauthorized } from "@/lib/api";
import { db, makeId, now, parseJsonArray, toJsonArray } from "@/lib/db/client";

type Context = { params: Promise<{ workspaceId: string; projectId: string }> };

const reorderScenesSchema = z.object({
  sceneIds: z.array(z.string()).min(1),
});

function serializeScene(scene: Record<string, unknown>) {
  return {
    ...scene,
    assetIds: parseJsonArray(scene.asset_ids),
    firstFrameDescription: scene.first_frame_description,
    lastFrameDescription: scene.last_frame_description,
  };
}

export async function GET(_request: Request, context: Context) {
  const { workspaceId, projectId } = await context.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }

  if (!requireWorkspace(workspaceId, userId)) {
    return notFound("Workspace not found");
  }

  const project = requireProject(workspaceId, projectId);
  if (!project) {
    return notFound("Project not found");
  }

  const scenes = db
    .prepare("SELECT * FROM project_scenes WHERE project_id = ? ORDER BY position ASC, created_at ASC")
    .all(projectId)
    .map((scene) => serializeScene(scene as Record<string, unknown>));

  return NextResponse.json({ scenes });
}

export async function POST(request: Request, context: Context) {
  try {
    const { workspaceId, projectId } = await context.params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorized();
    }

    if (!requireWorkspace(workspaceId, userId)) {
      return notFound("Workspace not found");
    }

    const project = requireProject(workspaceId, projectId);
    if (!project) {
      return notFound("Project not found");
    }

    const input = await readJson(request, projectSceneSchema);
    const ownedAssetIds = filterOwnedAssetIds(workspaceId, input.assetIds);
    if (ownedAssetIds.size !== input.assetIds.length) {
      return NextResponse.json({ error: "One or more assets are unavailable in this workspace" }, { status: 400 });
    }

    const position =
      input.position ??
      Number(
        (db
          .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM project_scenes WHERE project_id = ?")
          .get(projectId) as { next_position: number }).next_position,
      );
    const createdAt = now();
    const sceneId = makeId("scn");
    const scene = {
      id: sceneId,
      project_id: projectId,
      position,
      title: input.title,
      description: input.description,
      action: input.action,
      look: input.look,
      first_frame_url: input.firstFrameUrl,
      last_frame_url: input.lastFrameUrl,
      first_frame_description: input.firstFrameDescription,
      last_frame_description: input.lastFrameDescription,
      asset_ids: toJsonArray(input.assetIds),
      created_at: createdAt,
      updated_at: createdAt,
    };

    db.transaction(() => {
      db.prepare(
        `INSERT INTO project_scenes
         (id, project_id, position, title, description, action, look, first_frame_url, last_frame_url, first_frame_description, last_frame_description, asset_ids, created_at, updated_at)
         VALUES (@id, @project_id, @position, @title, @description, @action, @look, @first_frame_url, @last_frame_url, @first_frame_description, @last_frame_description, @asset_ids, @created_at, @updated_at)`,
      ).run(scene);

      if (input.assetIds.length > 0) {
        const stmt = db.prepare("INSERT INTO scene_assets (scene_id, asset_id, created_at) VALUES (?, ?, ?)");
        for (const assetId of input.assetIds) {
          stmt.run(sceneId, assetId, createdAt);
        }
      }
    })();

    return NextResponse.json({ scene: serializeScene(scene) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const { workspaceId, projectId } = await context.params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorized();
    }

    if (!requireWorkspace(workspaceId, userId)) {
      return notFound("Workspace not found");
    }

    const project = requireProject(workspaceId, projectId);
    if (!project) {
      return notFound("Project not found");
    }

    const input = await readJson(request, reorderScenesSchema);
    const currentSceneIds = db
      .prepare("SELECT id FROM project_scenes WHERE project_id = ? ORDER BY position ASC, created_at ASC")
      .all(projectId)
      .map((scene) => String((scene as { id: string }).id));
    const requestedIds = new Set(input.sceneIds);

    if (requestedIds.size !== input.sceneIds.length || input.sceneIds.length !== currentSceneIds.length) {
      return NextResponse.json({ error: "Scene order must include each scene exactly once" }, { status: 400 });
    }

    for (const sceneId of currentSceneIds) {
      if (!requestedIds.has(sceneId)) {
        return NextResponse.json({ error: "Scene order must include each scene exactly once" }, { status: 400 });
      }
    }

    const updatedAt = now();
    db.transaction(() => {
      const update = db.prepare("UPDATE project_scenes SET position = ?, updated_at = ? WHERE project_id = ? AND id = ?");
      input.sceneIds.forEach((sceneId, index) => {
        update.run(index, updatedAt, projectId, sceneId);
      });
    })();

    const scenes = db
      .prepare("SELECT * FROM project_scenes WHERE project_id = ? ORDER BY position ASC, created_at ASC")
      .all(projectId)
      .map((scene) => serializeScene(scene as Record<string, unknown>));

    return NextResponse.json({ scenes });
  } catch (error) {
    return apiError(error);
  }
}
