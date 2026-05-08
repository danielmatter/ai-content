import { FormEvent } from "react";
import { LibraryImage } from "../types";
import { api, fillForm } from "../utils";
import { useStudioMutations } from "./use-mutations";

export function useSharedActions({
  workspaceId,
  setBusy,
  setGenerationStatus,
}: any) {
  const { setImages } = useStudioMutations(workspaceId, "");

  async function uploadImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/images/upload`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Image upload failed");
      }
      const data = (await response.json()) as { image: LibraryImage };
      setImages((items) => [data.image, ...items]);
      formElement.reset();
    } finally {
      setBusy(false);
    }
  }

  async function generateDraft(path: string, form: HTMLFormElement | null, extraBody: Record<string, unknown> = {}) {
    const formData = form ? new FormData(form) : null;
    const steering = formData ? String(formData.get("steering") ?? "") : "";
    const assetType = formData?.get("type");
    setBusy(true);
    setGenerationStatus("Filling form with structured output...");
    try {
      const data = await api<{ draft: Record<string, string>; logPath?: string }>(path, {
        method: "POST",
        body: JSON.stringify({ steering, ...(typeof assetType === "string" ? { assetType } : {}), ...extraBody }),
      });
      fillForm(form, data.draft);
      setGenerationStatus(data.logPath ? `Form filled. Log saved to ${data.logPath}` : "Form filled.");
    } finally {
      setBusy(false);
    }
  }

  return { uploadImage, generateDraft };
}
