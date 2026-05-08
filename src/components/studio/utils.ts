import { Asset } from "./types";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    console.error("API request failed:", { path, init, payload });

    throw new Error(payload.error ?? "Request failed");
  }

  return response.json();
}

export function emptyIfNone(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  return text === "none" ? "" : text;
}

export function fillForm(form: HTMLFormElement | null, values: Record<string, unknown>) {
  if (!form) {
    return;
  }

  Object.entries(values).forEach(([name, value]) => {
    const field = form.elements.namedItem(name);
    if (!field || typeof value !== "string") {
      return;
    }

    if (field instanceof RadioNodeList) {
      field.value = value;
      return;
    }

    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
      field.value = value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

export function parseJsonField(form: FormData, fieldName: string) {
  const value = String(form.get(fieldName) ?? "");
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function readImageUrls(asset: Asset | (Asset & { image_urls?: unknown })) {
  if (Array.isArray(asset.imageUrls)) {
    return asset.imageUrls;
  }

  if ("image_urls" in asset && typeof asset.image_urls === "string") {
    try {
      const parsed = JSON.parse(asset.image_urls);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  return [];
}
