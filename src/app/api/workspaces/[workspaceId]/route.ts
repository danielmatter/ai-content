import "@/lib/db/migrate";

import { NextResponse } from "next/server";

import { apiError, getCurrentUserId, notFound, readJson, requireWorkspace, slugify, unauthorized, workspaceSchema } from "@/lib/api";
import { db, now, parseJsonArray } from "@/lib/db/client";

type Context = { params: Promise<{ workspaceId: string }> };

function parseTimelineState(value: unknown) {
  if (!value || typeof value !== "string") return { sceneClips: [], audioClips: [] };
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : { sceneClips: [], audioClips: [] };
  } catch {
    return { sceneClips: [], audioClips: [] };
  }
}

function serializeAsset(asset: Record<string, unknown>) {
  return {
    ...asset,
    imageUrls: parseJsonArray(asset.image_urls),
    audioUrl: asset.audio_url,
    audioMimeType: asset.audio_mime_type,
  };
}

function serializeProject(project: Record<string, unknown>, assetIds: string[] = []) {
  return {
    ...project,
    assetIds,
    timelineState: parseTimelineState(project.timeline_state),
  };
}

export async function GET(_request: Request, context: Context) {
  const { workspaceId } = await context.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }
  const workspace = requireWorkspace(workspaceId, userId);

  if (!workspace) {
    return notFound("Workspace not found");
  }

  const assets = db
    .prepare("SELECT * FROM assets WHERE workspace_id = ? ORDER BY updated_at DESC")
    .all(workspaceId)
    .map((asset) => serializeAsset(asset as Record<string, unknown>));
  const projects = db
    .prepare("SELECT * FROM projects WHERE workspace_id = ? ORDER BY updated_at DESC")
    .all(workspaceId)
    .map((project) => {
      const assetIds = db
        .prepare("SELECT asset_id FROM project_assets WHERE project_id = ? ORDER BY created_at ASC")
        .all((project as { id: string }).id)
        .map((row) => String((row as { asset_id: string }).asset_id));
      return serializeProject(project as Record<string, unknown>, assetIds);
    });

  return NextResponse.json({ workspace, assets, projects });
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { workspaceId } = await context.params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorized();
    }

    if (!requireWorkspace(workspaceId, userId)) {
      return notFound("Workspace not found");
    }

    const input = await readJson(request, workspaceSchema.partial());
    const current = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(workspaceId) as {
      name: string;
      slug: string;
      description: string;
    };
    const updated = {
      id: workspaceId,
      name: input.name ?? current.name,
      slug: input.slug ?? (input.name ? slugify(input.name) : current.slug),
      description: input.description ?? current.description,
      updated_at: now(),
    };

    db.prepare(
      "UPDATE workspaces SET name = @name, slug = @slug, description = @description, updated_at = @updated_at WHERE id = @id",
    ).run(updated);

    const workspace = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(workspaceId);
    return NextResponse.json({ workspace });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { workspaceId } = await context.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }

  if (!requireWorkspace(workspaceId, userId)) {
    return notFound("Workspace not found");
  }

  db.prepare("DELETE FROM workspaces WHERE id = ?").run(workspaceId);
  return NextResponse.json({ ok: true });
}
