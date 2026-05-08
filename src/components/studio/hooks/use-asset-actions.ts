import { FormEvent } from "react";
import { Asset, LibraryImage } from "../types";
import { api } from "../utils";
import { useStudioMutations } from "./use-mutations";
import { GenerationReviewValue } from "../generation-review-dialog";

export function useAssetActions({
  workspaceId,
  setBusy,
  setAssetDialogType,
  editingAsset,
  setEditingAsset,
  routeTarget,
  openWorkspaceHome,
  setGenerationStatus,
  setNewProjectAssetIds,
  setEditingProjectAssetIds,
  setEditingScene,
}: any) {
  const { setAssets, setProjects, setScenes, setImages, refreshJobs } = useStudioMutations(workspaceId, "");

  async function uploadAssetFiles(form: FormData) {
    const imageUrls: string[] = [];
    let audioUrl = "";
    let audioMimeType = "";

    const imageFiles = form.getAll("imageFiles").filter((value): value is File => value instanceof File && value.size > 0);
    for (const imageFile of imageFiles) {
      const upload = new FormData();
      upload.set("file", imageFile);
      upload.set("title", String(form.get("title") || imageFile.name || "Asset image"));
      upload.set("description", String(form.get("description") || ""));
      const response = await fetch(`/api/workspaces/${workspaceId}/images/upload`, { method: "POST", body: upload });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Image upload failed");
      }
      const data = (await response.json()) as { image: LibraryImage };
      imageUrls.push(data.image.sourceUrl);
      setImages((items) => [data.image, ...items]);
    }

    const audioFile = form.get("audioFile");
    if (audioFile instanceof File && audioFile.size > 0) {
      const upload = new FormData();
      upload.set("file", audioFile);
      upload.set("createAsset", "false");
      const response = await fetch(`/api/workspaces/${workspaceId}/audio/upload`, { method: "POST", body: upload });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Audio upload failed");
      }
      const data = (await response.json()) as { audioUrl: string; audioMimeType: string };
      audioUrl = data.audioUrl;
      audioMimeType = data.audioMimeType;
    }

    return { imageUrls, audioUrl, audioMimeType };
  }

  async function createAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      const uploadedFiles = await uploadAssetFiles(form);
      const data = await api<{ asset: Asset }>(`/api/workspaces/${workspaceId}/assets`, {
        method: "POST",
        body: JSON.stringify({
          type: form.get("type"),
          title: form.get("title"),
          description: form.get("description"),
          text: form.get("text"),
          imageUrls: [...form.getAll("imageUrls").map(String).filter(Boolean), ...uploadedFiles.imageUrls],
          audioUrl: uploadedFiles.audioUrl || form.get("audioUrl") || "",
          audioMimeType: uploadedFiles.audioMimeType || form.get("audioMimeType") || "",
        }),
      });
      setAssets((items) => [data.asset, ...items]);
      formElement.reset();
      setAssetDialogType(null);
    } finally {
      setBusy(false);
    }
  }

  async function updateAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAsset) return;

    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const uploadedFiles = await uploadAssetFiles(form);
      const data = await api<{ asset: Asset }>(`/api/workspaces/${workspaceId}/assets/${editingAsset.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          type: form.get("type"),
          title: form.get("title"),
          description: form.get("description"),
          text: form.get("text"),
          imageUrls: [...form.getAll("imageUrls").map(String).filter(Boolean), ...uploadedFiles.imageUrls],
          audioUrl: uploadedFiles.audioUrl || form.get("audioUrl") || "",
          audioMimeType: uploadedFiles.audioMimeType || form.get("audioMimeType") || "",
        }),
      });
      setAssets((items) => items.map((asset) => (asset.id === data.asset.id ? data.asset : asset)));
      setEditingAsset(null);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAsset(asset: Asset) {
    if (!workspaceId) return;
    if (!window.confirm(`Delete asset "${asset.title}"? This will remove it from projects and scenes.`)) {
      return;
    }

    setBusy(true);
    try {
      await api(`/api/workspaces/${workspaceId}/assets/${asset.id}`, { method: "DELETE" });
      setAssets((items) => items.filter((item) => item.id !== asset.id));
      setProjects((items) =>
        items.map((project) => ({
          ...project,
          assetIds: project.assetIds?.filter((assetId) => assetId !== asset.id),
        })),
      );
      setScenes((items) =>
        items.map((scene) => ({
          ...scene,
          assetIds: scene.assetIds?.filter((assetId) => assetId !== asset.id),
        })),
      );
      setNewProjectAssetIds((assetIds: string[]) => assetIds.filter((assetId) => assetId !== asset.id));
      setEditingProjectAssetIds((assetIds: string[]) => assetIds.filter((assetId) => assetId !== asset.id));
      setEditingScene((current: any) =>
        current
          ? {
            ...current,
            assetIds: current.assetIds?.filter((assetId: string) => assetId !== asset.id),
          }
          : current,
      );
      if (editingAsset?.id === asset.id) {
        setEditingAsset(null);
      }
      if (routeTarget?.type === "asset" && routeTarget.id === asset.id) {
        openWorkspaceHome();
      }
    } finally {
      setBusy(false);
    }
  }

  function assetImagePrompt(asset: Asset) {
    return `Asset design for a ${asset.type}: ${asset.title}. ${asset.description}. ${asset.text ? `Continuity and visual notes: ${asset.text}` : ""}`.trim();
  }

  async function startAssetImageGeneration(asset: Asset, review?: GenerationReviewValue) {
    if (!workspaceId) return;
    setBusy(true);
    setGenerationStatus(`Starting image job for ${asset.title}...`);
    try {
      const data = await api<{ jobId: string }>(`/api/workspaces/${workspaceId}/assets/${asset.id}/generate-image`, {
        method: "POST",
        body: JSON.stringify(review ? {
          prompt: review.prompt,
          referenceImageUrls: review.imageInputs.filter((input) => input.kind === "Reference").map((input) => input.url),
          model: review.settings.model,
          settings: review.settings,
        } : {}),
      });
      await refreshJobs();
      setGenerationStatus(`Image job ${data.jobId} started.`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setEditingAsset(null);
    } catch (error) {
      console.error(error);
      setGenerationStatus(error instanceof Error ? error.message : "Failed to start image job.");
    } finally {
      setBusy(false);
    }
  }

  return { createAsset, updateAsset, deleteAsset, startAssetImageGeneration, assetImagePrompt };
}
