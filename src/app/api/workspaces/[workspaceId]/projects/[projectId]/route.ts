import "@/lib/db/migrate";

import { NextResponse } from "next/server";

import { apiError, getCurrentUserId, notFound, projectSchema, readJson, requireWorkspace, unauthorized } from "@/lib/api";
import { db, now, parseJsonArray } from "@/lib/db/client";

type Context = { params: Promise<{ workspaceId: string; projectId: string }> };

function getProject(workspaceId: string, projectId: string) {
  return db
    .prepare("SELECT * FROM projects WHERE workspace_id = ? AND id = ?")
    .get(workspaceId, projectId) as Record<string, unknown> | undefined;
}

function getProjectAssetIds(projectId: string) {
  return db
    .prepare("SELECT asset_id FROM project_assets WHERE project_id = ? ORDER BY created_at ASC")
    .all(projectId)
    .map((row) => String((row as { asset_id: string }).asset_id));
}

function serializeScene(scene: Record<string, unknown>) {
  return { ...scene, assetIds: parseJsonArray(scene.asset_ids) };
}

function parseTimelineState(value: unknown) {
  if (!value || typeof value !== "string") {
    return { sceneClips: [], audioClips: [] };
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : { sceneClips: [], audioClips: [] };
  } catch {
    return { sceneClips: [], audioClips: [] };
  }
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

  const project = getProject(workspaceId, projectId);
  if (!project) {
    return notFound("Project not found");
  }

  const assetIds = getProjectAssetIds(projectId);
  const scenes = db
    .prepare("SELECT * FROM project_scenes WHERE project_id = ? ORDER BY position ASC, created_at ASC")
    .all(projectId)
    .map((scene) => serializeScene(scene as Record<string, unknown>));

  return NextResponse.json({ project: { ...project, assetIds, timelineState: parseTimelineState(project.timeline_state) }, scenes });
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { workspaceId, projectId } = await context.params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorized();
    }

    if (!requireWorkspace(workspaceId, userId)) {
      return notFound("Workspace not found");
    }

    const current = getProject(workspaceId, projectId);
    if (!current) {
      return notFound("Project not found");
    }

    const input = await readJson(request, projectSchema.partial());
    const updatedAt = now();
    const nextProject = {
      id: projectId,
      title: input.title ?? current.title,
      logline: input.logline ?? current.logline,
      timeline_state: current.timeline_state,
      updated_at: updatedAt,
    };

    const transaction = db.transaction(() => {
      db.prepare(
        "UPDATE projects SET title = @title, logline = @logline, timeline_state = @timeline_state, updated_at = @updated_at WHERE id = @id",
      ).run(nextProject);

      if (input.assetIds) {
        db.prepare("DELETE FROM project_assets WHERE project_id = ?").run(projectId);
        const insert = db.prepare("INSERT OR IGNORE INTO project_assets (project_id, asset_id, created_at) VALUES (?, ?, ?)");
        for (const assetId of input.assetIds) {
          insert.run(projectId, assetId, updatedAt);
        }
      }
    });

    transaction();

    const project = getProject(workspaceId, projectId);
    return NextResponse.json({
      project: { ...project, assetIds: getProjectAssetIds(projectId), timelineState: parseTimelineState(project?.timeline_state) },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { workspaceId, projectId } = await context.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }

  if (!requireWorkspace(workspaceId, userId)) {
    return notFound("Workspace not found");
  }

  db.prepare("DELETE FROM projects WHERE workspace_id = ? AND id = ?").run(workspaceId, projectId);
  return NextResponse.json({ ok: true });
}
