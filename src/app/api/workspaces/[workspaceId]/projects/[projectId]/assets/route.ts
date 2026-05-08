import "@/lib/db/migrate";

import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, filterOwnedAssetIds, getCurrentUserId, notFound, readJson, requireProject, requireWorkspace, unauthorized } from "@/lib/api";
import { db, now } from "@/lib/db/client";

type Context = { params: Promise<{ workspaceId: string; projectId: string }> };

const projectAssetsSchema = z.object({
  assetIds: z.array(z.string()),
});

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

  const assets = db
    .prepare(
      `SELECT assets.* FROM assets
       INNER JOIN project_assets ON project_assets.asset_id = assets.id
       WHERE project_assets.project_id = ? AND assets.workspace_id = ?
       ORDER BY assets.type ASC, assets.title ASC`,
    )
     .all(projectId, workspaceId);

  return NextResponse.json({ assets });
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

    const input = await readJson(request, projectAssetsSchema);
    const ownedAssetIds = filterOwnedAssetIds(workspaceId, input.assetIds);
    if (ownedAssetIds.size !== input.assetIds.length) {
      return NextResponse.json({ error: "One or more assets are unavailable in this workspace" }, { status: 400 });
    }

    const createdAt = now();
    const transaction = db.transaction(() => {
      db.prepare("DELETE FROM project_assets WHERE project_id = ?").run(projectId);
      const insert = db.prepare("INSERT OR IGNORE INTO project_assets (project_id, asset_id, created_at) VALUES (?, ?, ?)");
      for (const assetId of input.assetIds) {
        insert.run(projectId, assetId, createdAt);
      }
    });

    transaction();

    return NextResponse.json({ ok: true, assetIds: input.assetIds });
  } catch (error) {
    return apiError(error);
  }
}
