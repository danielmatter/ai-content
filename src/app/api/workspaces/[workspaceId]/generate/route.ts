import "@/lib/db/migrate";

import { NextResponse } from "next/server";

import { apiError, getCurrentUserId, notFound, readJson, requireWorkspace, unauthorized } from "@/lib/api";
import { db } from "@/lib/db/client";
import { generateFormDraft, steeringSchema } from "@/lib/form-generation";

type Context = { params: Promise<{ workspaceId: string }> };

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

    const input = await readJson(request, steeringSchema);
    const result = await generateFormDraft({
      target: "workspace",
      steering: input.steering,
      fields: ["name", "description"],
      context: {
        workspace: { name: workspace.name, description: workspace.description },
        projects: db
          .prepare("SELECT title, logline FROM projects WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 10")
          .all(workspaceId),
        assets: db
          .prepare("SELECT type, title, description FROM assets WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 20")
          .all(workspaceId),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
