import { FormEvent } from "react";
import { LibraryImage, ProjectScene, RenderJob } from "../types";
import { api, emptyIfNone } from "../utils";
import { useStudioMutations } from "./use-mutations";
import { GenerationReviewValue } from "../generation-review-dialog";

export function useSceneActions({
  workspaceId,
  projectId,
  setBusy,
  scenes,
  projectAssetIds,
  setNewSceneFirstFrameUrl,
  setNewSceneLastFrameUrl,
  setSceneDialogOpen,
  editingScene,
  setEditingScene,
  routeTarget,
  openProject,
  setGenerationStatus,
  jobs,
  busy,
}: any) {
  const { setScenes, setJobs, setImages } = useStudioMutations(workspaceId, projectId);

  async function createScene(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      const data = await api<{ scene: ProjectScene }>(
        `/api/workspaces/${workspaceId}/projects/${projectId}/scenes`,
        {
          method: "POST",
          body: JSON.stringify({
            title: form.get("title"),
            description: form.get("description"),
            action: form.get("action"),
            look: form.get("look"),
            firstFrameUrl: emptyIfNone(form.get("firstFrameUrl")),
            lastFrameUrl: emptyIfNone(form.get("lastFrameUrl")),
            firstFrameDescription: emptyIfNone(form.get("firstFrameDescription")),
            lastFrameDescription: emptyIfNone(form.get("lastFrameDescription")),
            position: scenes.length,
            assetIds: projectAssetIds,
          }),
        },
      );
      setScenes((items) => [...items, data.scene]);
      setNewSceneFirstFrameUrl("");
      setNewSceneLastFrameUrl("");
      formElement.reset();
      setSceneDialogOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function updateScene(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingScene) return;

    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const data = await api<{ scene: ProjectScene }>(
        `/api/workspaces/${workspaceId}/projects/${projectId}/scenes/${editingScene.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: form.get("title"),
            description: form.get("description"),
            action: form.get("action"),
            look: form.get("look"),
            firstFrameUrl: emptyIfNone(form.get("firstFrameUrl")),
            lastFrameUrl: emptyIfNone(form.get("lastFrameUrl")),
            firstFrameDescription: emptyIfNone(form.get("firstFrameDescription")),
            lastFrameDescription: emptyIfNone(form.get("lastFrameDescription")),
            assetIds: editingScene.assetIds ?? projectAssetIds,
          }),
        },
      );
      setScenes((items) => items.map((scene) => (scene.id === data.scene.id ? data.scene : scene)));
      setEditingScene(null);
    } finally {
      setBusy(false);
    }
  }

  async function saveSceneInline(scene: ProjectScene) {
    if (!workspaceId || !projectId) return;
    setBusy(true);
    try {
      const data = await api<{ scene: ProjectScene }>(
        `/api/workspaces/${workspaceId}/projects/${projectId}/scenes/${scene.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: scene.title,
            description: scene.description,
            action: scene.action,
            look: scene.look,
            firstFrameUrl: emptyIfNone(scene.first_frame_url),
            lastFrameUrl: emptyIfNone(scene.last_frame_url),
            firstFrameDescription: emptyIfNone(scene.first_frame_description ?? ""),
            lastFrameDescription: emptyIfNone(scene.last_frame_description ?? ""),
            assetIds: scene.assetIds,
          }),
        },
      );
      setScenes((items) => items.map((s) => (s.id === data.scene.id ? data.scene : s)));
    } finally {
      setBusy(false);
    }
  }

  async function moveScene(scene: ProjectScene, direction: "up" | "down") {
    if (!workspaceId || !projectId || busy) return;

    const currentIndex = scenes.findIndex((item: ProjectScene) => item.id === scene.id);
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= scenes.length) {
      return;
    }

    const previousScenes = scenes;
    const nextScenes = [...scenes];
    [nextScenes[currentIndex], nextScenes[nextIndex]] = [nextScenes[nextIndex], nextScenes[currentIndex]];
    const positionedScenes = nextScenes.map((item, index) => ({ ...item, position: index }));

    setScenes(positionedScenes);
    setBusy(true);
    try {
      const data = await api<{ scenes: ProjectScene[] }>(`/api/workspaces/${workspaceId}/projects/${projectId}/scenes`, {
        method: "PUT",
        body: JSON.stringify({ sceneIds: positionedScenes.map((item) => item.id) }),
      });
      setScenes(data.scenes);
    } catch (error) {
      setScenes(previousScenes);
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function deleteScene(scene: ProjectScene) {
    if (!workspaceId || !projectId) return;
    if (!window.confirm(`Delete scene "${scene.title}"?`)) {
      return;
    }

    setBusy(true);
    try {
      await api(`/api/workspaces/${workspaceId}/projects/${projectId}/scenes/${scene.id}`, { method: "DELETE" });
      setScenes((items) => items.filter((item) => item.id !== scene.id));
      setJobs((items) => items.filter((job) => job.scene_id !== scene.id));
      if (editingScene?.id === scene.id) {
        setEditingScene(null);
      }
      if (routeTarget?.type === "scene" && routeTarget.sceneId === scene.id) {
        openProject(projectId);
      }
    } finally {
      setBusy(false);
    }
  }

  async function renderScene(scene: ProjectScene, review?: GenerationReviewValue) {
    if (!workspaceId || !projectId) return;

    const optimisticJob: RenderJob = {
      id: `temp-${Date.now()}`,
      workspace_id: workspaceId,
      project_id: projectId,
      scene_id: scene.id,
      kind: "video",
      asset_id: null,
      frame_type: null,
      description: `${scene.title} video render`,
      image_id: null,
      image_url: null,
      status: "pending",
      progress: 0,
      video_url: null,
      error: null,
      openrouter_job_id: null,
      openrouter_polling_url: null,
      last_queried: null,
      last_query_status: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setJobs(current => [optimisticJob, ...current]);
    setGenerationStatus("Starting video render...");

    try {
      await api<{ jobId: string }>(
        `/api/workspaces/${workspaceId}/projects/${projectId}/scenes/${scene.id}/render`,
        {
          method: "POST",
          body: JSON.stringify(review ? {
            prompt: review.prompt,
            firstFrameUrl: review.imageInputs.find((input) => input.kind === "First Frame")?.url,
            lastFrameUrl: review.imageInputs.find((input) => input.kind === "Last Frame")?.url,
            referenceImageUrls: review.imageInputs.filter((input) => input.kind === "Reference").map((input) => input.url),
            model: review.settings.model,
            settings: review.settings,
          } : {}),
        }
      );

      const jobsData = await api<{ jobs: RenderJob[] }>(`/api/workspaces/${workspaceId}/jobs`);
      setJobs(jobsData.jobs);
      setGenerationStatus("Video render started successfully.");
    } catch (error) {
      console.error(error);
      setJobs(current => current.filter(j => j.id !== optimisticJob.id));
      setGenerationStatus(`Failed to start render: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  function latestCompletedRenderForScene(sceneId: string) {
    return jobs.find((job: RenderJob) => job.scene_id === sceneId && job.kind === "video" && job.video_url && (job.status === "completed" || job.status === "downloaded"));
  }

  async function extractRenderFrame(
    sourceScene: ProjectScene,
    frameType: "first" | "last",
    options: { targetSceneId?: string; targetFrameType?: "first" | "last"; applyToNewSceneFirstFrame?: boolean } = {},
    renderJobId?: string,
  ) {
    if (!workspaceId || !projectId) return;

    setBusy(true);
    setGenerationStatus(`Extracting ${frameType} frame from ${sourceScene.title}...`);
    try {
      const data = await api<{ image: LibraryImage; targetScene?: ProjectScene | null }>(
        `/api/workspaces/${workspaceId}/projects/${projectId}/scenes/${sourceScene.id}/frames/extract`,
        {
          method: "POST",
          body: JSON.stringify({
            frameType,
            renderJobId,
            targetSceneId: options.targetSceneId,
            targetFrameType: options.targetFrameType,
          }),
        },
      );

      setImages((items) => [data.image, ...items]);
      if (data.targetScene) {
        setScenes((items) => items.map((scene) => (scene.id === data.targetScene?.id ? data.targetScene : scene)));
        if (editingScene?.id === data.targetScene.id) {
          setEditingScene(data.targetScene);
        }
      }
      if (options.applyToNewSceneFirstFrame) {
        setNewSceneFirstFrameUrl(data.image.sourceUrl);
      }
      setGenerationStatus(`Extracted ${frameType} frame.`);
    } catch (error) {
      console.error(error);
      setGenerationStatus(error instanceof Error ? error.message : "Failed to extract frame.");
    } finally {
      setBusy(false);
    }
  }

  async function continueFromPreviousRender(targetScene?: ProjectScene) {
    const targetIndex = targetScene ? scenes.findIndex((scene: ProjectScene) => scene.id === targetScene.id) : scenes.length;
    const previousScene = scenes[targetIndex - 1];
    if (!previousScene) return;

    await extractRenderFrame(previousScene, "last", targetScene
      ? { targetSceneId: targetScene.id, targetFrameType: "first" }
      : { applyToNewSceneFirstFrame: true });
  }

  return {
    createScene,
    updateScene,
    saveSceneInline,
    moveScene,
    deleteScene,
    renderScene,
    extractRenderFrame,
    continueFromPreviousRender,
    latestCompletedRenderForScene,
  };
}
