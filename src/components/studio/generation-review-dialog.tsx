"use client";

import { useMemo, useState } from "react";
import { Image as ImageIcon, Loader2, Plus, Trash2, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Asset, LibraryImage } from "./types";
import { AssetPicker, PickedAsset } from "./asset-picker";
import { PreviewableImage } from "./image-preview";
import { GenerationSettings, generationModelConfigs } from "@/lib/generation-options";

export type GenerationImageInput = {
  kind: "Reference" | "First Frame" | "Last Frame";
  url: string;
  assetId?: string;
  title?: string;
  text?: string;
};

export type GenerationReviewValue = {
  prompt: string;
  imageInputs: GenerationImageInput[];
  settings: GenerationSettings;
};

type GenerationReviewDialogProps = {
  busy?: boolean;
  confirmLabel?: string;
  description?: string;
  images: LibraryImage[];
  assets?: Asset[];
  initialValue: GenerationReviewValue;
  mode: "image" | "video";
  open: boolean;
  title: string;
  onConfirm: (value: GenerationReviewValue) => void;
  onOpenChange: (open: boolean) => void;
};

export function GenerationReviewDialog({
  busy = false,
  confirmLabel,
  description,
  images,
  assets = [],
  initialValue,
  mode,
  open,
  title,
  onConfirm,
  onOpenChange,
}: GenerationReviewDialogProps) {
  const [prompt, setPrompt] = useState(initialValue.prompt);
  const [imageInputs, setImageInputs] = useState<GenerationImageInput[]>(initialValue.imageInputs);
  const [settings, setSettings] = useState<GenerationSettings>(() => defaultSettings(mode, initialValue.settings));
  const Icon = mode === "video" ? Video : ImageIcon;

  const references = useMemo(() => imageInputs.filter((input) => input.kind === "Reference"), [imageInputs]);
  const firstFrame = imageInputs.find((input) => input.kind === "First Frame")?.url ?? "";
  const lastFrame = imageInputs.find((input) => input.kind === "Last Frame")?.url ?? "";
  const selectedConfig = mode === "video"
    ? generationModelConfigs.video.find((config) => config.id === settings.model) ?? generationModelConfigs.video[0]
    : generationModelConfigs.image.find((config) => config.id === settings.model) ?? generationModelConfigs.image[0];

  const assetContext = useMemo(() => {
    if (mode !== "video") return "";

    const parts = imageInputs
      .filter((input) => input.title || input.text)
      .map((input) => {
        const title = input.title || input.kind;
        const description = input.text || "No description provided.";
        return `### ${title}\n${description}`;
      });

    if (parts.length === 0) return "";
    return `## Asset & Visual Context\n\n${parts.join("\n\n")}`;
  }, [imageInputs, mode]);

  function setSingle(kind: "First Frame" | "Last Frame", picked: PickedAsset | null) {
    setImageInputs((items) => [
      ...items.filter((item) => item.kind !== kind),
      ...(picked ? [{ kind, url: picked.url, assetId: picked.type === "asset" ? picked.id : undefined, title: picked.title, text: picked.text }] : []),
    ]);
  }

  function addReference(picked: PickedAsset | null) {
    if (!picked) return;
    setImageInputs((items) => items.some((item) => item.kind === "Reference" && (item.url === picked.url && item.assetId === (picked.type === "asset" ? picked.id : undefined))) ? items : [
      ...items,
      { kind: "Reference", url: picked.url, assetId: picked.type === "asset" ? picked.id : undefined, title: picked.title, text: picked.text }
    ]);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!busy) onOpenChange(nextOpen); }}>
      <DialogContent className="sm:max-w-3xl dialog-content-scrollable">
        <DialogHeader className="dialog-header-fixed">
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-4" />
            {title}
          </DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className="dialog-body-scrollable grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="generation-prompt">Raw text input</Label>
            <Textarea
              id="generation-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="min-h-32 font-mono text-xs leading-5"
              disabled={busy}
            />
            <p className="text-[10px] text-muted-foreground">The generation prompt is fully editable.</p>
          </div>

          <GenerationSettingsBar
            mode={mode}
            settings={settings}
            onChange={setSettings}
          />

          {assetContext ? (
            <div className="grid gap-2">
              <Label htmlFor="generation-context">Immutable Context</Label>
              <Textarea
                id="generation-context"
                value={assetContext}
                readOnly
                className="min-h-32 font-mono text-xs leading-5 bg-muted/30 opacity-80"
                disabled={busy}
              />
              <p className="text-[10px] text-muted-foreground">This context is automatically derived from your selected assets and cannot be edited directly.</p>
            </div>
          ) : null}

          {mode === "video" ? (
            <div className="grid-layout">
              <AssetPicker images={images} assets={assets} value={firstFrame} onChange={(asset) => setSingle("First Frame", asset)} label="First Frame" />
              <AssetPicker images={images} assets={assets} value={lastFrame} onChange={(asset) => setSingle("Last Frame", asset)} label="Last Frame" />
            </div>
          ) : null}

          <div className="grid gap-2 border-t pt-4">
            <Label>Asset Inputs</Label>
            <p className="text-[10px] text-muted-foreground mb-1">These assets guide the visual generation. Removing an asset here omits it from this generation.</p>
            <div className="grid gap-2 rounded-md border p-2 bg-muted/20">
              {imageInputs.length ? imageInputs.map((input) => (
                <ImageInputRow
                  key={`${input.kind}:${input.url || input.assetId}`}
                  input={input}
                  image={input.url ? images.find((item) => item.sourceUrl === input.url) : undefined}
                  removable={input.kind === "Reference"}
                  onRemove={() => setImageInputs((items) => items.filter((item) => item !== input))}
                />
              )) : (
                <p className="p-2 text-sm text-muted-foreground">No extra asset inputs selected.</p>
              )}
            </div>
            <ReferenceAdder images={images} assets={assets} selectedUrls={references.map((item) => item.url).filter(Boolean)} onAdd={addReference} />
          </div>
        </div>

        <div className="dialog-footer-fixed">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || !prompt.trim()}
            onClick={() => onConfirm({
              prompt: prompt.trim() + (assetContext ? "\n\n" + assetContext : ""),
              imageInputs,
              settings: normalizeSettings(mode, settings, selectedConfig),
            })}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
            {confirmLabel ?? (mode === "video" ? "Start Video" : "Start Image")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function defaultSettings(mode: "image" | "video", initial: GenerationSettings = {}): GenerationSettings {
  if (mode === "video") {
    const config = generationModelConfigs.video.find((item) => item.id === initial.model) ?? generationModelConfigs.video[0];
    return {
      model: config.id,
      size: config.sizes.includes(initial.size ?? "") ? initial.size : config.sizes[0],
      duration: initial.duration && config.durations.includes(initial.duration) ? initial.duration : config.durations[0],
      generateAudio: typeof initial.generateAudio === "boolean" && config.generateAudio.includes(initial.generateAudio)
        ? initial.generateAudio
        : config.generateAudio[0],
    };
  }

  const config = generationModelConfigs.image.find((item) => item.id === initial.model) ?? generationModelConfigs.image[0];
  return {
    model: config.id,
    aspectRatio: config.aspectRatios.includes(initial.aspectRatio ?? "") ? initial.aspectRatio : config.aspectRatios[0],
    imageSize: config.sizes.includes(initial.imageSize ?? "") ? initial.imageSize : config.sizes[0],
    quality: config.qualities.includes(initial.quality ?? "") ? initial.quality : config.qualities[0],
  };
}

function normalizeSettings(
  mode: "image" | "video",
  current: GenerationSettings,
  config: typeof generationModelConfigs.image[number] | typeof generationModelConfigs.video[number],
): GenerationSettings {
  if (mode === "video" && "durations" in config) {
    return {
      model: config.id,
      size: config.sizes.includes(current.size ?? "") ? current.size : config.sizes[0],
      duration: current.duration && config.durations.includes(current.duration) ? current.duration : config.durations[0],
      generateAudio: typeof current.generateAudio === "boolean" && config.generateAudio.includes(current.generateAudio)
        ? current.generateAudio
        : config.generateAudio[0],
    };
  }

  if ("qualities" in config) {
    return {
      model: config.id,
      aspectRatio: config.aspectRatios.includes(current.aspectRatio ?? "") ? current.aspectRatio : config.aspectRatios[0],
      imageSize: config.sizes.includes(current.imageSize ?? "") ? current.imageSize : config.sizes[0],
      quality: config.qualities.includes(current.quality ?? "") ? current.quality : config.qualities[0],
    };
  }

  return current;
}

function GenerationSettingsBar({
  mode,
  settings,
  onChange,
}: {
  mode: "image" | "video";
  settings: GenerationSettings;
  onChange: (settings: GenerationSettings) => void;
}) {
  const configs = mode === "video" ? generationModelConfigs.video : generationModelConfigs.image;
  const config = configs.find((item) => item.id === settings.model) ?? configs[0];

  function setModel(model: string) {
    onChange(defaultSettings(mode, { model }));
  }

  function patch(next: GenerationSettings) {
    onChange(normalizeSettings(mode, { ...settings, ...next }, config));
  }

  return (
    <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 shadow-sm shadow-cyan-500/10">
      <div className="mb-2 flex items-center justify-between gap-3">
        <Label className="text-xs font-semibold uppercase tracking-wide text-cyan-900 dark:text-cyan-100">Generation Settings</Label>
        <span className="text-[10px] text-cyan-900/70 dark:text-cyan-100/70">{mode === "video" ? "Video model" : "Image model"}</span>
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        <SettingsSelect label="Model" value={config.id} onChange={setModel} options={configs.map((item) => ({ value: item.id, label: item.label }))} />
        {mode === "video" && "durations" in config ? (
          <>
            <SettingsSelect label="Size" value={settings.size ?? config.sizes[0]} onChange={(size) => patch({ size })} options={config.sizes.map((size) => ({ value: size, label: size }))} />
            <SettingsSelect label="Duration" value={String(settings.duration ?? config.durations[0])} onChange={(duration) => patch({ duration: Number(duration) })} options={config.durations.map((duration) => ({ value: String(duration), label: `${duration}s` }))} />
            <SettingsSelect label="Audio" value={String(settings.generateAudio ?? config.generateAudio[0])} onChange={(value) => patch({ generateAudio: value === "true" })} options={config.generateAudio.map((value) => ({ value: String(value), label: value ? "With audio" : "No audio" }))} />
          </>
        ) : null}
        {mode === "image" && "qualities" in config ? (
          <>
            <SettingsSelect label="Ratio" value={settings.aspectRatio ?? config.aspectRatios[0]} onChange={(aspectRatio) => patch({ aspectRatio })} options={config.aspectRatios.map((ratio) => ({ value: ratio, label: ratio }))} />
            <SettingsSelect label="Size" value={settings.imageSize ?? config.sizes[0]} onChange={(imageSize) => patch({ imageSize })} options={config.sizes.map((size) => ({ value: size, label: size }))} />
            <SettingsSelect label="Quality" value={settings.quality ?? config.qualities[0]} onChange={(quality) => patch({ quality })} options={config.qualities.map((quality) => ({ value: quality, label: quality }))} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function SettingsSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-[10px] font-medium uppercase tracking-wide text-cyan-950/70 dark:text-cyan-50/70">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-md border border-cyan-600/30 bg-background/90 px-2 text-xs font-medium normal-case tracking-normal text-foreground outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/30"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function ImageInputRow({
  image,
  input,
  removable,
  onRemove,
}: {
  image?: LibraryImage;
  input: GenerationImageInput;
  removable: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="flex min-h-16 items-start gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/60">
      {input.url ? (
        <PreviewableImage src={image?.thumbnailUrl || input.url} previewUrl={input.url} title={input.title || image?.title || input.kind} className="size-12 shrink-0 rounded-md object-cover bg-muted" />
      ) : (
        <div className="size-12 shrink-0 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
          <ImageIcon className="size-5 opacity-50" />
        </div>
      )}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{input.kind}</Badge>
          <span className="font-medium truncate">{input.title || image?.title || input.url || "Unknown Asset"}</span>
        </div>
        {input.text && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{input.text}</p>
        )}
      </div>
      {removable ? (
        <Button type="button" size="icon-sm" variant="ghost" onClick={onRemove} className="shrink-0 mt-0.5">
          <Trash2 className="size-4" />
          <span className="sr-only">Remove reference</span>
        </Button>
      ) : null}
    </div>
  );
}

function ReferenceAdder({
  images,
  assets,
  selectedUrls,
  onAdd,
}: {
  images: LibraryImage[];
  assets: Asset[];
  selectedUrls: string[];
  onAdd: (picked: PickedAsset | null) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="flex items-end gap-2">
      <AssetPicker
        images={images.filter((image) => !selectedUrls.includes(image.sourceUrl))}
        assets={assets}
        value={value}
        onChange={(picked) => {
          setValue(picked?.url || picked?.id || "");
          onAdd(picked);
          setValue("");
        }}
        label="Reference"
        className="flex-1"
      />
      <Button type="button" variant="outline" disabled>
        <Plus className="size-4" />
        Reference
      </Button>
    </div>
  );
}
