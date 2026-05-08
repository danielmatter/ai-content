import "@/lib/db/migrate";

import { NextResponse } from "next/server";

import { apiError, getCurrentUserId, notFound, readJson, requireWorkspace, unauthorized } from "@/lib/api";
import { db } from "@/lib/db/client";
import { generateFormDraft, steeringSchema } from "@/lib/form-generation";

type Context = { params: Promise<{ workspaceId: string; projectId: string }> };
type ProjectRow = {
  title: string;
  logline: string;
};

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

    const input = await readJson(request, steeringSchema);
    const result = await generateFormDraft({
      target: "scene",
      steering: input.steering,
      fields: ["title", "description", "action", "look"],
      context: {
        workspace: { name: workspace.name, description: workspace.description },
        project: { title: project.title, logline: project.logline },
        assets: db
          .prepare(
            `SELECT assets.type, assets.title, assets.description FROM assets
             INNER JOIN project_assets ON project_assets.asset_id = assets.id
             WHERE project_assets.project_id = ?
             ORDER BY assets.type ASC, assets.title ASC`,
          )
          .all(projectId),
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
