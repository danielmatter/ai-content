import "@/lib/db/migrate";

import { NextResponse } from "next/server";

import { apiError, assetTypeSchema, getCurrentUserId, notFound, readJson, requireWorkspace, unauthorized } from "@/lib/api";
import { db } from "@/lib/db/client";
import { assetDraftSteeringSchema, generateFormDraft } from "@/lib/form-generation";

type Context = { params: Promise<{ workspaceId: string; assetId: string }> };
type AssetRow = {
  type: string;
  title: string;
  description: string;
  text: string;
};

export async function POST(request: Request, context: Context) {
  try {
    const { workspaceId, assetId } = await context.params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorized();
    }

    const workspace = requireWorkspace(workspaceId, userId);
    if (!workspace) {
      return notFound("Workspace not found");
    }

    const asset = db.prepare("SELECT * FROM assets WHERE workspace_id = ? AND id = ?").get(workspaceId, assetId) as AssetRow | undefined;
    if (!asset) {
      return notFound("Asset not found");
    }

    const input = await readJson(request, assetDraftSteeringSchema);
    const assetType = input.assetType ?? assetTypeSchema.parse(asset.type);
    const result = await generateFormDraft({
      target: "asset",
      steering: input.steering,
      fields: ["type", "title", "description", "text"],
      assetType,
      context: {
        workspace: { name: workspace.name, description: workspace.description },
        asset: { type: asset.type, title: asset.title, description: asset.description, text: asset.text },
        assetType,
        assets: db
          .prepare("SELECT type, title, description FROM assets WHERE workspace_id = ? AND id != ? ORDER BY updated_at DESC LIMIT 20")
          .all(workspaceId, assetId),
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
