import "@/lib/db/migrate";

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, getCurrentUserId, notFound, readJson, requireWorkspace, unauthorized } from "@/lib/api";
import { db, makeId, now, parseJsonArray } from "@/lib/db/client";
import { ensureUploadDirs, getImageUrl, getThumbnailUrl, insertImage, serializeImage } from "@/lib/image-library";

type Context = { params: Promise<{ workspaceId: string; projectId: string; sceneId: string }> };

const execFileAsync = promisify(execFile);

const extractFrameSchema = z.object({
  frameType: z.enum(["first", "last"]),
  renderJobId: z.string().optional(),
  targetSceneId: z.string().optional(),
  targetFrameType: z.enum(["first", "last"]).optional(),
});

type SceneRow = {
  id: string;
  title: string;
  first_frame_url: string;
  last_frame_url: string;
};

type RenderJobRow = {
  id: string;
  video_url: string | null;
  status: string;
  updated_at: string;
};

function videoPathFromUrl(videoUrl: string) {
  const prefix = "/api/assets/videos/";
  if (!videoUrl.startsWith(prefix)) {
    return null;
  }

  const filename = videoUrl.slice(prefix.length);
  if (!filename || filename !== path.basename(filename) || filename.includes("..")) {
    return null;
  }

  return path.join(process.cwd(), "storage", "uploads", "videos", filename);
}

function getLatestRender(projectId: string, sceneId: string) {
  return db
    .prepare(
      `SELECT * FROM render_jobs
       WHERE project_id = ? AND scene_id = ? AND kind = 'video'
         AND video_url IS NOT NULL AND status IN ('completed', 'downloaded')
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`,
    )
    .get(projectId, sceneId) as RenderJobRow | undefined;
}

function getRender(projectId: string, sceneId: string, renderJobId?: string) {
  if (!renderJobId) {
    return getLatestRender(projectId, sceneId);
  }

  return db
    .prepare(
      `SELECT * FROM render_jobs
       WHERE id = ? AND project_id = ? AND scene_id = ? AND kind = 'video'
         AND video_url IS NOT NULL AND status IN ('completed', 'downloaded')
       LIMIT 1`,
    )
    .get(renderJobId, projectId, sceneId) as RenderJobRow | undefined;
}

function getScene(projectId: string, sceneId: string) {
  return db.prepare("SELECT * FROM project_scenes WHERE project_id = ? AND id = ?").get(projectId, sceneId) as SceneRow | undefined;
}

function serializeScene(scene: SceneRow | undefined) {
  if (!scene) return null;
  return {
    ...scene,
    assetIds: parseJsonArray((scene as Record<string, unknown>).asset_ids),
  };
}

export async function POST(request: Request, context: Context) {
  try {
    const { workspaceId, projectId, sceneId } = await context.params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorized();
    }

    if (!requireWorkspace(workspaceId, userId)) {
      return notFound("Workspace not found");
    }

    const sourceScene = getScene(projectId, sceneId);
    if (!sourceScene) {
      return notFound("Scene not found");
    }

    const input = await readJson(request, extractFrameSchema);
    const render = getRender(projectId, sceneId, input.renderJobId);
    if (!render?.video_url) {
      return NextResponse.json({ error: "The selected render is not available for this scene." }, { status: 400 });
    }

    const videoPath = videoPathFromUrl(render.video_url);
    if (!videoPath) {
      return NextResponse.json({ error: "The selected render has not been downloaded locally yet." }, { status: 400 });
    }

    const { uploadDir, thumbDir } = await ensureUploadDirs();
    const imageId = makeId("img");
    const filename = `${imageId}.png`;
    const thumbFilename = `${imageId}.jpg`;
    const filePath = path.join(uploadDir, filename);
    const thumbPath = path.join(thumbDir, thumbFilename);
    const seekArgs = input.frameType === "last" ? ["-sseof", "-0.08"] : ["-ss", "0"];

    await execFileAsync("ffmpeg", [
      "-y",
      ...seekArgs,
      "-i",
      videoPath,
      "-frames:v",
      "1",
      filePath,
    ]);
    await execFileAsync("magick", [filePath, "-auto-orient", "-thumbnail", "256x256^", "-gravity", "center", "-extent", "256x256", thumbPath]);

    const label = input.frameType === "first" ? "first frame" : "last frame";
    const image = insertImage({
      workspaceId,
      title: `${sourceScene.title} - extracted ${label}`,
      description: `Extracted from render ${render.id} of "${sourceScene.title}".`,
      sourceUrl: getImageUrl(filename),
      thumbnailUrl: getThumbnailUrl(thumbFilename),
      filePath,
      mimeType: "image/png",
    });

    let targetScene: SceneRow | undefined;
    if (input.targetSceneId && input.targetFrameType) {
      targetScene = getScene(projectId, input.targetSceneId);
      if (!targetScene) {
        return notFound("Target scene not found");
      }

      const updatedAt = now();
      const field = input.targetFrameType === "first" ? "first_frame_url" : "last_frame_url";
      db.prepare(`UPDATE project_scenes SET ${field} = ?, updated_at = ? WHERE project_id = ? AND id = ?`).run(
        image.source_url,
        updatedAt,
        projectId,
        input.targetSceneId,
      );
      targetScene = getScene(projectId, input.targetSceneId);
    }

    return NextResponse.json({
      image: serializeImage(image),
      targetScene: serializeScene(targetScene),
    });
  } catch (error) {
    return apiError(error);
  }
}
