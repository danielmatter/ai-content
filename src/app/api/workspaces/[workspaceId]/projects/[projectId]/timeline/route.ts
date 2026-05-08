import "@/lib/db/migrate";

import { NextResponse } from "next/server";

import { apiError, getCurrentUserId, notFound, readJson, requireWorkspace, timelineStateSchema, unauthorized } from "@/lib/api";
import { db, now } from "@/lib/db/client";

type Context = { params: Promise<{ workspaceId: string; projectId: string }> };

function emptyTimeline() {
  return { sceneClips: [], audioClips: [] };
}

function parseTimelineState(value: unknown) {
  if (!value || typeof value !== "string") return emptyTimeline();
  try {
    const parsed = timelineStateSchema.parse(JSON.parse(value));
    return parsed;
  } catch {
    return emptyTimeline();
  }
}

function getProject(workspaceId: string, projectId: string) {
  return db
    .prepare("SELECT * FROM projects WHERE workspace_id = ? AND id = ?")
    .get(workspaceId, projectId) as Record<string, unknown> | undefined;
}

export async function GET(_request: Request, context: Context) {
  const { workspaceId, projectId } = await context.params;
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  if (!requireWorkspace(workspaceId, userId)) {
    return notFound("Workspace not found");
  }

  const project = getProject(workspaceId, projectId);
  if (!project) {
    return notFound("Project not found");
  }

  return NextResponse.json({ timelineState: parseTimelineState(project.timeline_state) });
}

export async function PUT(request: Request, context: Context) {
  try {
    const { workspaceId, projectId } = await context.params;
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    if (!requireWorkspace(workspaceId, userId)) {
      return notFound("Workspace not found");
    }

    const project = getProject(workspaceId, projectId);
    if (!project) {
      return notFound("Project not found");
    }

    const input = await readJson(request, timelineStateSchema);
    const projectSceneIds = new Set(
      db.prepare("SELECT id FROM project_scenes WHERE project_id = ?").all(projectId).map((row) => String((row as { id: string }).id)),
    );
    const audioAssetIds = new Set(
      db.prepare("SELECT id FROM assets WHERE workspace_id = ? AND type = 'audio'").all(workspaceId).map((row) => String((row as { id: string }).id)),
    );

    if (input.sceneClips.some((clip) => !projectSceneIds.has(clip.sceneId))) {
      return NextResponse.json({ error: "Timeline contains a scene outside this project" }, { status: 400 });
    }

    if (input.audioClips.some((clip) => !audioAssetIds.has(clip.assetId))) {
      return NextResponse.json({ error: "Timeline contains an unavailable audio asset" }, { status: 400 });
    }

    db.prepare("UPDATE projects SET timeline_state = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(input), now(), projectId);

    return NextResponse.json({ timelineState: input });
  } catch (error) {
    return apiError(error);
  }
}
