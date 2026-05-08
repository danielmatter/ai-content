import "@/lib/db/migrate";

import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, getCurrentUserId, notFound, readJson, requireWorkspace, unauthorized } from "@/lib/api";
import { db } from "@/lib/db/client";
import { generateFormDraft, steeringSchema } from "@/lib/form-generation";

type Context = { params: Promise<{ workspaceId: string }> };

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

export async function POST(request: Request, context: Context) {
  try {
    const { workspaceId } = await context.params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorized();
    }

    const workspace = requireWorkspace(workspaceId, userId);
    if (!workspace) {
      return notFound("Workspace not found");
    }

    const input = await readJson(request, projectGenerateSchema);
    const assetIds = input.assetIds ?? [];
    const result = await generateFormDraft({
      target: "project",
      steering: input.steering,
      fields: ["title", "logline", "scenes", "assets"],
      context: {
        workspace: { name: workspace.name, description: workspace.description },
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
        projects: db
          .prepare("SELECT title, logline FROM projects WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 5")
          .all(workspaceId),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
