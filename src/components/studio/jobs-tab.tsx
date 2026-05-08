"use client";

import { AlertCircle, CheckCircle2, ImageIcon, Loader2, RefreshCcw, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RenderJob } from "./types";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProjectScene } from "./types";
import { PreviewableImage } from "./image-preview";

interface JobsTabProps {
  jobs: RenderJob[];
  scenes?: ProjectScene[];
  activeJobId?: string;
  onOpenJob: (jobId: string) => void;
  onRenderScene: (scene: ProjectScene) => void;
}

export function JobsTab({ jobs, scenes = [], activeJobId = "", onOpenJob, onRenderScene }: JobsTabProps) {
  if (jobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Render Jobs</CardTitle>
          <CardDescription>No rendering jobs have been started yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {jobs.map((job) => {
        const queryErrored = job.last_query_status === "error";
        const scene = scenes.find((item) => item.id === job.scene_id);

        return (
          <Card key={job.id} className={`overflow-hidden ${job.id === activeJobId ? "border-primary" : ""}`}>
            <div className="flex flex-col sm:flex-row">
              <div className="flex-1 p-4 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <button type="button" onClick={() => onOpenJob(job.id)} className="grid gap-1 text-left">
                    <h3 className="font-semibold flex items-center gap-2">
                      {job.kind === "image" ? (
                        <ImageIcon className="size-4 text-muted-foreground" />
                      ) : (
                        <Video className="size-4 text-muted-foreground" />
                      )}
                      {job.kind === "timeline"
                        ? "Timeline render"
                        : job.kind === "image"
                          ? (scene ? `${scene.title} image` : "Image generation")
                          : scene ? scene.title : "Scene Render"}
                    </h3>
                    <div className="text-sm text-muted-foreground">
                      Job ID: <span className="font-mono text-xs">{job.id}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Type: {job.kind === "image" ? "Image" : job.kind === "timeline" ? "Timeline" : "Video"}
                      {job.frame_type ? ` (${job.frame_type} frame)` : ""}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Started: {new Date(job.created_at).toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Last queried: {job.last_queried ? new Date(job.last_queried).toLocaleString() : "Never"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Last query status: {job.last_query_status ?? "Unknown"}
                    </div>
                  </button>

                  <Badge
                    variant={
                      job.status === "completed" || job.status === "downloaded"
                        ? "default"
                        : job.status === "failed" || queryErrored
                          ? "destructive"
                          : "secondary"
                    }
                    className="capitalize"
                  >
                    {queryErrored || job.status === "failed" ? (
                      <AlertCircle className="mr-1 size-3" />
                    ) : job.status === "processing" || job.status === "pending" ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : job.status === "completed" || job.status === "downloaded" ? (
                      <CheckCircle2 className="mr-1 size-3" />
                    ) : null}
                    {job.status}
                  </Badge>
                </div>

                {job.error && (
                  <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {job.error}
                  </div>
                )}

                {job.status === "failed" && scene && job.kind === "video" ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-dashed bg-muted/30 p-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <AlertCircle className="size-4 text-destructive" />
                      Failed jobs stay in history and do not block a new render.
                    </div>
                    <Button type="button" size="sm" variant="secondary" onClick={() => onRenderScene(scene)}>
                      <RefreshCcw className="mr-2 size-4" />
                      Regenerate video
                    </Button>
                  </div>
                ) : null}
              </div>

              {job.video_url && (job.status === "completed" || job.status === "downloaded") && (
                <div className="bg-muted/50 sm:w-1/3 border-t sm:border-l sm:border-t-0 border-border p-4 flex items-center justify-center">
                  <video
                    src={job.video_url}
                    controls
                    className="w-full rounded-md shadow-sm"
                  />
                </div>
              )}
              {job.image_url && job.kind === "image" && job.status === "completed" && (
                <div className="bg-muted/50 sm:w-1/3 border-t sm:border-l sm:border-t-0 border-border p-4 flex items-center justify-center">
                  <PreviewableImage src={job.image_url} previewUrl={job.image_url} className="w-full rounded-md object-cover shadow-sm" />
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
