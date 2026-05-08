"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SceneItem } from "./scene-item";
import { AssetChecklist } from "./asset-checklist";
import { TimelineEditor } from "./timeline-editor";
import { SceneDetail } from "./scene-detail";
import { useStudio } from "./studio-context";

export function ProjectDetail() {
  const { state, projectActions, sceneActions, mutations } = useStudio();
  const { activeProject } = state;
  const activeSceneId = state.routeTarget?.type === "scene" ? state.routeTarget.sceneId : "";
  const projectAssetIds = activeProject?.assetIds ?? [];
  const scenes = state.scenes;
  const jobs = state.jobs;
  const activeSceneIndex = scenes.findIndex((scene) => scene.id === activeSceneId);
  const activeScene = activeSceneIndex >= 0 ? scenes[activeSceneIndex] : undefined;

  if (!activeProject) {
    return null;
  }

  if (activeScene) {
    return (
      <SceneDetail
        assets={state.assets}
        busy={state.busy}
        canMoveDown={activeSceneIndex < scenes.length - 1}
        canMoveUp={activeSceneIndex > 0}
        images={state.images}
        index={activeSceneIndex}
        jobs={jobs.filter((job) => job.scene_id === activeScene.id)}
        onBack={() => state.openProject(state.projectId)}
        onDelete={sceneActions.deleteScene}
        onSave={sceneActions.saveSceneInline}
        onMoveDown={(scene) => sceneActions.moveScene(scene, "down")}
        onMoveUp={(scene) => sceneActions.moveScene(scene, "up")}
        onRender={state.setVideoReviewScene}
        onExtractFrame={(scene, frameType, renderJobId) => sceneActions.extractRenderFrame(scene, frameType, {}, renderJobId)}
        onGenerateFrame={state.openFrameGenerator}
        onEdit={state.setEditingScene}
        scene={activeScene}
        projectAssetIds={projectAssetIds}
      />
    );
  }

  return (
    <div className="grid gap-4">
      {/* Project toolbar */}
      <div className="toolbar">
        <span className="text-sm font-medium text-muted-foreground">Project actions</span>
        <div className="toolbar-end">
          <Button type="button" size="sm" variant="ghost" disabled={state.busy} onClick={() => projectActions.openProjectEditor(activeProject)}>
            <Pencil className="size-3.5 mr-1" />
            Edit
          </Button>
          <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={state.busy} onClick={() => projectActions.deleteProject(activeProject)}>
            <Trash2 className="size-3.5 mr-1" />
            Delete
          </Button>
          <div className="w-px h-5 bg-border" />
          <Button size="sm" disabled={!activeProject} onClick={() => state.setSceneDialogOpen(true)}>
            <Plus className="size-3.5 mr-1" />
            New scene
          </Button>
        </div>
      </div>

      <Tabs defaultValue="scenes" className="grid gap-4">
        <TabsList>
          <TabsTrigger value="scenes">Scenes</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="scenes">
          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            <section className="grid gap-3">
              <div className="flex flex-row items-center justify-between gap-3">
                <h3 className="text-base font-medium">Scenes in this project</h3>
                <Badge variant="outline">{scenes.length}</Badge>
              </div>
              {scenes.map((scene, index) => (
                <SceneItem
                  key={scene.id}
                  scene={scene}
                  index={index}
                  images={state.images}
                  jobs={jobs.filter(j => j.scene_id === scene.id)}
                  busy={state.busy}
                  onMoveUp={(scene) => sceneActions.moveScene(scene, "up")}
                  onMoveDown={(scene) => sceneActions.moveScene(scene, "down")}
                  onRender={state.setVideoReviewScene}
                  onOpen={state.openScene}
                  canMoveUp={index > 0}
                  canMoveDown={index < scenes.length - 1}
                />
              ))}
              {!scenes.length ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  This project has no scenes yet.
                </p>
              ) : null}
            </section>

            <section className="card self-start">
              <h3 className="text-base font-medium mb-3">Project assets</h3>
              <AssetChecklist assets={state.assets.filter((asset) => asset.type !== "audio")} value={projectAssetIds} onChange={projectActions.updateProjectAssets} />
            </section>
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <TimelineEditor
            key={activeProject.id}
            workspaceId={state.activeWorkspace?.id ?? ""}
            projectId={activeProject.id}
            scenes={scenes}
            assets={state.assets}
            jobs={jobs}
            timelineState={activeProject.timelineState}
            busy={state.busy}
            onBusyChange={state.setBusy}
            onStatusChange={state.setGenerationStatus}
            onTimelineChange={projectActions.updateProjectTimeline}
            onAssetsChange={mutations.setAssets}
            onJobsRefresh={mutations.refreshJobs}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
