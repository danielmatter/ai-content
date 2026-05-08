"use client";

import { ArrowDown, ArrowUp, Eye, ImageIcon, Loader2, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectScene, LibraryImage, RenderJob } from "./types";
import { PreviewableImage } from "./image-preview";

interface SceneItemProps {
  scene: ProjectScene;
  index: number;
  images: LibraryImage[];
  jobs: RenderJob[];
  onMoveUp: (scene: ProjectScene) => void;
  onMoveDown: (scene: ProjectScene) => void;
  onRender: (scene: ProjectScene) => void;
  onOpen: (scene: ProjectScene) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  busy: boolean;
}

export function SceneItem({
  scene,
  index,
  images,
  jobs,
  onMoveUp,
  onMoveDown,
  onRender,
  onOpen,
  canMoveUp,
  canMoveDown,
  busy,
}: SceneItemProps) {
  const activeJob = jobs.find(j => j.status === "pending" || j.status === "processing");
  const latestCompletedJob = jobs.find(j => (j.status === "downloaded" || j.status === "completed") && j.video_url);

  const firstFrameImage = scene.first_frame_url ? images.find((item) => item.sourceUrl === scene.first_frame_url) : undefined;
  const lastFrameImage = scene.last_frame_url ? images.find((item) => item.sourceUrl === scene.last_frame_url) : undefined;

  return (
    <div className="scene-card group cursor-pointer" onClick={() => onOpen(scene)}>
      <div className="flex items-start gap-3">
        {/* Left: number + thumbnails */}
        <div className="flex items-center gap-3 shrink-0">
          <Badge variant="outline" className="shrink-0">{index + 1}</Badge>
          <div className="flex gap-1.5">
            {scene.first_frame_url ? (
              <PreviewableImage
                src={firstFrameImage?.thumbnailUrl || scene.first_frame_url}
                previewUrl={scene.first_frame_url}
                title={firstFrameImage?.title || "First frame"}
                className="thumb-xs"
              />
            ) : (
              <div className="thumb-xs thumb-placeholder border border-dashed">
                <ImageIcon className="size-3 opacity-40" />
              </div>
            )}
            {scene.last_frame_url ? (
              <PreviewableImage
                src={lastFrameImage?.thumbnailUrl || scene.last_frame_url}
                previewUrl={scene.last_frame_url}
                title={lastFrameImage?.title || "Last frame"}
                className="thumb-xs"
              />
            ) : (
              <div className="thumb-xs thumb-placeholder border border-dashed">
                <ImageIcon className="size-3 opacity-40" />
              </div>
            )}
          </div>
        </div>

        {/* Center: title + description */}
        <div className="flex-1 min-w-0">
          <button type="button" className="scene-card-title block" onClick={(e) => { e.stopPropagation(); onOpen(scene); }}>
            <span className="line-clamp-1">{scene.title}</span>
          </button>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{scene.description}</p>
        </div>

        {/* Right: compact actions */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button type="button" size="icon-sm" variant="ghost" disabled={busy || !canMoveUp} onClick={() => onMoveUp(scene)}>
            <ArrowUp className="size-3.5" />
            <span className="sr-only">Move up</span>
          </Button>
          <Button type="button" size="icon-sm" variant="ghost" disabled={busy || !canMoveDown} onClick={() => onMoveDown(scene)}>
            <ArrowDown className="size-3.5" />
            <span className="sr-only">Move down</span>
          </Button>

          <div className="w-px h-5 bg-border mx-1" />

          <Button type="button" size="sm" variant="outline" onClick={() => onOpen(scene)}>
            <Eye className="size-3.5 mr-1" />
            Open
          </Button>
          <Button
            type="button"
            size="sm"
            className="btn-accent"
            disabled={busy || !!activeJob}
            onClick={() => onRender(scene)}
          >
            {activeJob ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Play className="size-3.5 mr-1" />}
            Render
          </Button>
        </div>
      </div>

      {/* Status badges */}
      {(latestCompletedJob?.video_url || activeJob) && (
        <div className="flex gap-2 mt-2 ml-11">
          {latestCompletedJob?.video_url && <Badge variant="positive" className="text-[10px]">Rendered</Badge>}
          {activeJob && <Badge variant="secondary" className="text-[10px]">Rendering…</Badge>}
        </div>
      )}
    </div>
  );
}
