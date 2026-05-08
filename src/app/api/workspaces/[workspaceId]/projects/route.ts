import "@/lib/db/migrate";

import { NextResponse } from "next/server";

import { apiError, getCurrentUserId, notFound, projectSchema, readJson, requireWorkspace, unauthorized } from "@/lib/api";
import { db, makeId, now } from "@/lib/db/client";

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

function serializeProject(project: Record<string, unknown>) {
  return { ...project, timelineState: parseTimelineState(project.timeline_state) };
}

function replaceProjectAssets(projectId: string, assetIds: string[]) {
  const createdAt = now();
  const insert = db.prepare("INSERT OR IGNORE INTO project_assets (project_id, asset_id, created_at) VALUES (?, ?, ?)");

  db.prepare("DELETE FROM project_assets WHERE project_id = ?").run(projectId);
  for (const assetId of assetIds) {
    insert.run(projectId, assetId, createdAt);
  }
}

export async function GET(_request: Request, context: Context) {
  const { workspaceId } = await context.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }

  if (!requireWorkspace(workspaceId, userId)) {
    return notFound("Workspace not found");
  }

  const projects = db
    .prepare("SELECT * FROM projects WHERE workspace_id = ? ORDER BY updated_at DESC")
    .all(workspaceId)
    .map((project) => serializeProject(project as Record<string, unknown>));

  return NextResponse.json({ projects });
}

export async function POST(request: Request, context: Context) {
  try {
    const { workspaceId } = await context.params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorized();
    }

    if (!requireWorkspace(workspaceId, userId)) {
      return notFound("Workspace not found");
    }

    const input = await readJson(request, projectSchema);
    const createdAt = now();
    const project = {
      id: makeId("prj"),
      workspace_id: workspaceId,
      title: input.title,
      logline: input.logline,
      timeline_state: "",
      created_at: createdAt,
      updated_at: createdAt,
    };

    const transaction = db.transaction(() => {
      db.prepare(
        `INSERT INTO projects (id, workspace_id, title, logline, timeline_state, created_at, updated_at)
         VALUES (@id, @workspace_id, @title, @logline, @timeline_state, @created_at, @updated_at)`,
      ).run(project);
      const projectAssetIds = [...input.assetIds];
      
      if (input.assets && Array.isArray(input.assets)) {
        const insertAsset = db.prepare(
          `INSERT INTO assets (id, workspace_id, type, title, description, text, image_urls, audio_url, audio_mime_type, created_at, updated_at)
           VALUES (@id, @workspace_id, @type, @title, @description, @text, @image_urls, @audio_url, @audio_mime_type, @created_at, @updated_at)`
        );
        for (const asset of input.assets) {
          const assetId = makeId("ast");
          insertAsset.run({
            id: assetId,
            workspace_id: workspaceId,
            type: asset.type || "character",
            title: asset.title || "Untitled",
            description: asset.description || "",
            text: asset.text || "",
            image_urls: "[]",
            audio_url: "",
            audio_mime_type: "",
            created_at: createdAt,
            updated_at: createdAt,
          });
          projectAssetIds.push(assetId);
        }
      }

      replaceProjectAssets(project.id, projectAssetIds);

      if (input.scenes && Array.isArray(input.scenes)) {
        const insertScene = db.prepare(
          `INSERT INTO project_scenes (id, project_id, position, title, description, action, look, first_frame_url, last_frame_url, asset_ids, created_at, updated_at)
           VALUES (@id, @project_id, @position, @title, @description, @action, @look, @first_frame_url, @last_frame_url, @asset_ids, @created_at, @updated_at)`
        );
        for (let i = 0; i < input.scenes.length; i++) {
          const scene = input.scenes[i];
          insertScene.run({
            id: makeId("scn"),
            project_id: project.id,
            position: i,
            title: scene.title || "Untitled",
            description: scene.description || "",
            action: scene.action || "",
            look: scene.look || "",
            first_frame_url: "",
            last_frame_url: "",
            asset_ids: "[]",
            created_at: createdAt,
            updated_at: createdAt,
          });
        }
      }
    });

    transaction();

    return NextResponse.json({ project: serializeProject(project) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
