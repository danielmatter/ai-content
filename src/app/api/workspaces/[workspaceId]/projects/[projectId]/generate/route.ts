import "@/lib/db/migrate";

import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, getCurrentUserId, notFound, readJson, requireWorkspace, unauthorized } from "@/lib/api";
import { db } from "@/lib/db/client";
import { generateFormDraft, steeringSchema } from "@/lib/form-generation";

type Context = { params: Promise<{ workspaceId: string; projectId: string }> };
type ProjectRow = {
  title: string;
  logline: string;
};

const projectGenerateSchema = steeringSchema.extend({
  assetIds: z.array(z.string()).optional(),
});

function serializeAsset(asset: Record<string, unknown>) {
  return {
    type: asset.type,
    title: asset.title,
    description: asset.description,
    text: asset.text,
    imageUrls: JSON.parse(String(asset.image_urls ?? "[]")),
  };
}

function getProjectAssetIds(projectId: string) {
  return db
    .prepare("SELECT asset_id FROM project_assets WHERE project_id = ? ORDER BY created_at ASC")
    .all(projectId)
    .map((row) => String((row as { asset_id: string }).asset_id));
}

export async function POST(request: Request, context: Context) {
  try {
    const { workspaceId, projectId } = await context.params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorized();
    }

    const workspace = requireWorkspace(workspaceId, userId);
    if (!workspace) {
      return notFound("Workspace not found");
    }

    const project = db.prepare("SELECT * FROM projects WHERE workspace_id = ? AND id = ?").get(workspaceId, projectId) as ProjectRow | undefined;
    if (!project) {
      return notFound("Project not found");
    }

    const input = await readJson(request, projectGenerateSchema);
    const assetIds = input.assetIds ?? getProjectAssetIds(projectId);
    const result = await generateFormDraft({
      target: "project",
      steering: input.steering,
      fields: ["title", "logline", "scenes", "assets"],
      context: {
        workspace: { name: workspace.name, description: workspace.description },
        project: { title: project.title, logline: project.logline },
        assets: assetIds.length
          ? db
            .prepare(
              `SELECT * FROM assets
               WHERE workspace_id = ? AND id IN (${assetIds.map(() => "?").join(",")})
               ORDER BY type ASC, title ASC`,
            )
            .all(workspaceId, ...assetIds)
            .map((asset) => serializeAsset(asset as Record<string, unknown>))
          : [],
        scenes: db
          .prepare("SELECT title, description FROM project_scenes WHERE project_id = ? ORDER BY position ASC LIMIT 50")
          .all(projectId),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
