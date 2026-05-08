import "@/lib/db/migrate";

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { NextResponse } from "next/server";

import { getCurrentUserId, notFound, requireWorkspace, timelineStateSchema, unauthorized } from "@/lib/api";
import { db, makeId, now } from "@/lib/db/client";

type Context = { params: Promise<{ workspaceId: string; projectId: string }> };

type TimelineAnchor = {
  type: "seconds" | "track-end" | "scene";
  trackType?: "video" | "audio";
  trackIndex?: number;
  sceneId?: string;
  edge?: "start" | "end";
  offset?: number;
};

type SceneClip = {
  sceneId: string;
  start: number;
  duration: number;
  speed: number;
  fadeIn: number;
  fadeOut: number;
  anchor?: TimelineAnchor;
};

type AudioClip = {
  assetId: string;
  start: number;
  duration?: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  anchor?: TimelineAnchor;
};

type RemovedRange = {
  start: number;
  end: number;
};

const execFileAsync = promisify(execFile);

function parseTimelineState(value: unknown) {
  if (!value || typeof value !== "string") return timelineStateSchema.parse({ sceneClips: [], audioClips: [] });
  return timelineStateSchema.parse(JSON.parse(value));
}

function videoUrlToFilePath(url: string) {
  if (!url.startsWith("/api/assets/videos/")) return null;
  const filename = url.replace("/api/assets/videos/", "");
  if (!filename || filename !== path.basename(filename) || filename.includes("..")) return null;
  return path.join(process.cwd(), "storage", "uploads", "videos", filename);
}

function audioUrlToFilePath(url: string) {
  if (!url.startsWith("/api/assets/audio/")) return null;
  const filename = url.replace("/api/assets/audio/", "");
  if (!filename || filename !== path.basename(filename) || filename.includes("..")) return null;
  return path.join(process.cwd(), "storage", "uploads", "audio", filename);
}

async function ensureTimelineVideoDir() {
  const videoDir = path.join(process.cwd(), "storage", "uploads", "videos");
  await mkdir(videoDir, { recursive: true });
  return videoDir;
}

function getVideoUrl(filename: string) {
  return `/api/assets/videos/${filename}`;
}

function py(value: unknown) {
  return JSON.stringify(value);
}

function shiftStart(start: number, removedRanges: RemovedRange[]) {
  let shift = 0;
  for (const range of removedRanges) {
    if (range.start >= start) break;
    shift += Math.min(start, range.end) - range.start;
  }
  return Math.max(0, start - shift);
}

function numberExpression(value: number) {
  return Number.isFinite(value) ? String(value) : "0";
}

function offsetExpression(offset: number | undefined) {
  const value = Number.isFinite(offset) ? offset ?? 0 : 0;
  if (value === 0) return "";
  return value > 0 ? ` + ${value}` : ` - ${Math.abs(value)}`;
}

function buildRenderScript(input: {
  sceneClips: Array<SceneClip & { filePath: string }>;
  audioClips: Array<AudioClip & { filePath: string }>;
  outputPath: string;
}) {
  const sceneVariableById = new Map(input.sceneClips.map((clip, index) => [clip.sceneId, `scene_${index}`]));
  const sceneIndexById = new Map(input.sceneClips.map((clip, index) => [clip.sceneId, index]));

  function clipStartExpression(clip: SceneClip | AudioClip) {
    const anchor = clip.anchor;
    if (anchor?.type === "scene" && anchor.sceneId) {
      const sceneVariable = sceneVariableById.get(anchor.sceneId);
      if (sceneVariable) return `${sceneVariable}.${anchor.edge ?? "end"}${offsetExpression(anchor.offset)}`;
    }
    return numberExpression(clip.start);
  }

  function sceneStartOrder() {
    const ordered: number[] = [];
    const visiting = new Set<number>();
    const visited = new Set<number>();

    function visit(index: number) {
      if (visited.has(index)) return;
      if (visiting.has(index)) {
        ordered.push(index);
        visited.add(index);
        return;
      }
      visiting.add(index);
      const anchorSceneId = input.sceneClips[index]?.anchor?.type === "scene" ? input.sceneClips[index].anchor?.sceneId : undefined;
      const anchorIndex = anchorSceneId ? sceneIndexById.get(anchorSceneId) : undefined;
      if (anchorIndex !== undefined && anchorIndex !== index) visit(anchorIndex);
      visiting.delete(index);
      if (!visited.has(index)) {
        ordered.push(index);
        visited.add(index);
      }
    }

    input.sceneClips.forEach((_, index) => visit(index));
    return ordered;
  }

  const sceneBaseDefs = input.sceneClips.map((clip, index) => {
    const variable = `scene_${index}`;
    const lines = [
      `${variable} = VideoFileClip(${py(clip.filePath)})`,
      `${variable} = ${variable}.subclipped(0, min(${variable}.duration, ${clip.duration * clip.speed}))`,
    ];

    if (clip.speed !== 1) lines.push(`${variable} = vfx.MultiplySpeed(${clip.speed}).apply(${variable})`);
    lines.push(`${variable} = ${variable}.with_duration(${clip.duration})`);
    if (clip.fadeIn > 0) lines.push(`${variable} = vfx.FadeIn(${Math.min(clip.fadeIn, clip.duration)}).apply(${variable})`);
    if (clip.fadeOut > 0) lines.push(`${variable} = vfx.FadeOut(${Math.min(clip.fadeOut, clip.duration)}).apply(${variable})`);

    return lines.join("\n");
  });

  const sceneStartDefs = sceneStartOrder().map((index) => {
    const variable = `scene_${index}`;
    return `${variable} = ${variable}.with_start(${clipStartExpression(input.sceneClips[index])})`;
  });

  const audioBaseDefs = input.audioClips.map((clip, index) => {
    const variable = `audio_${index}`;
    const lines = [`${variable} = AudioFileClip(${py(clip.filePath)})`];

    if (clip.duration) lines.push(`${variable} = ${variable}.subclipped(0, min(${variable}.duration, ${clip.duration}))`);
    if (clip.volume !== 1) lines.push(`${variable} = ${variable}.with_volume_scaled(${clip.volume})`);
    if (clip.fadeIn > 0) lines.push(`${variable} = afx.AudioFadeIn(${clip.fadeIn}).apply(${variable})`);
    if (clip.fadeOut > 0) lines.push(`${variable} = afx.AudioFadeOut(${clip.fadeOut}).apply(${variable})`);

    return lines.join("\n");
  });

  const audioStartDefs = input.audioClips.map((clip, index) => `audio_${index} = audio_${index}.with_start(${clipStartExpression(clip)})`);
  const sceneNames = input.sceneClips.map((_, index) => `scene_${index}`).join(", ");
  const audioNames = input.audioClips.map((_, index) => `audio_${index}`).join(", ");
  const sceneEnds = input.sceneClips.map((clip) => clip.start + clip.duration);
  const timelineDurationFallback = Math.max(0.1, ...sceneEnds, ...input.audioClips.map((clip) => clip.start + (clip.duration ?? 0)));
  const durationParts = [
    ...input.sceneClips.map((clip) => `${clipStartExpression(clip)} + ${clip.duration}`),
    ...input.audioClips.map((clip, index) => clip.duration ? `${clipStartExpression(clip)} + ${clip.duration}` : `${clipStartExpression(clip)} + audio_${index}.duration`),
    String(timelineDurationFallback),
  ];

  return `from moviepy import AudioFileClip, CompositeAudioClip, CompositeVideoClip, VideoFileClip, vfx, afx

${sceneBaseDefs.join("\n\n")}

${audioBaseDefs.join("\n\n")}

${sceneStartDefs.join("\n")}

${audioStartDefs.join("\n")}

timeline_duration = max(${durationParts.join(", ")})
final_video = CompositeVideoClip([${sceneNames}], bg_color=(0, 0, 0)).with_duration(timeline_duration)
${input.audioClips.length ? `final_video = final_video.with_audio(CompositeAudioClip([${audioNames}]))` : ""}
final_video.write_videofile(${py(input.outputPath)}, codec="libx264", audio_codec="aac", audio_bitrate="192k", temp_audiofile="temp-audio.m4a", remove_temp=True)
`;
}

export async function POST(_request: Request, context: Context) {
  const { workspaceId, projectId } = await context.params;
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  if (!requireWorkspace(workspaceId, userId)) {
    return notFound("Workspace not found");
  }

  const project = db
    .prepare("SELECT * FROM projects WHERE workspace_id = ? AND id = ?")
    .get(workspaceId, projectId) as { timeline_state: string } | undefined;
  if (!project) {
    return notFound("Project not found");
  }

  const timelineState = parseTimelineState(project.timeline_state);
  if (!timelineState.sceneClips.length) {
    return NextResponse.json({ error: "Timeline has no scene clips" }, { status: 400 });
  }

  const firstScene = timelineState.sceneClips[0];
  const jobId = makeId("job");
  const startedAt = now();
  db.prepare(
    `INSERT INTO render_jobs (id, workspace_id, project_id, scene_id, kind, description, status, progress, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'timeline', 'Timeline render', 'processing', 10, ?, ?)`,
  ).run(jobId, workspaceId, projectId, firstScene.sceneId, startedAt, startedAt);

  try {
    const sceneRows = db
      .prepare(
        `SELECT project_scenes.id, render_jobs.video_url
         FROM project_scenes
         LEFT JOIN render_jobs ON render_jobs.id = (
           SELECT id FROM render_jobs child
           WHERE child.scene_id = project_scenes.id
             AND child.kind = 'video'
             AND child.video_url IS NOT NULL
             AND child.status IN ('completed', 'downloaded')
           ORDER BY child.updated_at DESC
           LIMIT 1
         )
         WHERE project_scenes.project_id = ?`,
      )
      .all(projectId) as { id: string; video_url: string | null }[];
    const sceneVideos = new Map(sceneRows.map((row) => [row.id, row.video_url]));

    const audioRows = db
      .prepare("SELECT id, audio_url FROM assets WHERE workspace_id = ? AND type = 'audio'")
      .all(workspaceId) as { id: string; audio_url: string }[];
    const audioAssets = new Map(audioRows.map((row) => [row.id, row.audio_url]));

    const renderableSceneClips = timelineState.sceneClips.flatMap((clip) => {
      const videoUrl = sceneVideos.get(clip.sceneId);
      const filePath = videoUrl ? videoUrlToFilePath(videoUrl) : null;
      return filePath ? [{ ...clip, filePath }] : [];
    });

    if (!renderableSceneClips.length) {
      throw new Error("Timeline has no rendered scene videos to compose");
    }

    const removedRanges = timelineState.sceneClips
      .filter((clip) => !renderableSceneClips.some((renderableClip) => renderableClip.sceneId === clip.sceneId))
      .map((clip) => ({ start: clip.start, end: clip.start + clip.duration }))
      .sort((a, b) => a.start - b.start);

    const sceneClips = renderableSceneClips.map((clip) => ({
      ...clip,
      start: shiftStart(clip.start, removedRanges),
    }));

    const audioClips = timelineState.audioClips.map((clip) => {
      const audioUrl = audioAssets.get(clip.assetId);
      const filePath = audioUrl ? audioUrlToFilePath(audioUrl) : null;
      if (!filePath) throw new Error(`Audio asset ${clip.assetId} is not available`);
      return { ...clip, start: shiftStart(clip.start, removedRanges), filePath };
    });

    const videoDir = await ensureTimelineVideoDir();
    const renderDir = path.join(process.cwd(), "storage", "renders", projectId);
    await mkdir(renderDir, { recursive: true });
    const outputFilename = `${jobId}.mp4`;
    const outputPath = path.join(videoDir, outputFilename);
    const scriptPath = path.join(renderDir, `${jobId}.py`);
    await writeFile(scriptPath, buildRenderScript({ sceneClips, audioClips, outputPath }));

    const PYTHON_PATH = process.env.PYTHON_PATH || "python3";
    await execFileAsync(PYTHON_PATH, [scriptPath], { maxBuffer: 1024 * 1024 * 20 });
    const completedAt = now();
    const videoUrl = getVideoUrl(outputFilename);
    db.prepare("UPDATE render_jobs SET status = 'completed', progress = 100, video_url = ?, updated_at = ? WHERE id = ?").run(
      videoUrl,
      completedAt,
      jobId,
    );

    return NextResponse.json({ jobId, videoUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Timeline render failed";
    db.prepare("UPDATE render_jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?").run(message, now(), jobId);
    return NextResponse.json({ error: message, jobId }, { status: 500 });
  }
}
