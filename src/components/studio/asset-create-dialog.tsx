"use client";

import { FormEvent, useRef } from "react";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { GenerateButton } from "./generate-button";
import { ImageChecklist } from "./image-checklist";
import { AssetType, LibraryImage, assetMeta } from "./types";

type AssetCreateDialogProps = {
  assetType: AssetType;
  busy: boolean;
  images: LibraryImage[];
  open: boolean;
  workspaceId: string;
  onGenerateDraft: (form: HTMLFormElement | null, assetType: AssetType) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const fieldCopy = {
  scene: {
    title: "Create scene asset",
    description: "Reusable locations, sets, props, and environments for this workspace.",
    namePlaceholder: "Scene asset name",
    detailsPlaceholder: "Environment, purpose, mood, layout, or production details",
    textPlaceholder: "Continuity notes, geography, props, constraints, and reference details",
  },
  character: {
    title: "Create character",
    description: "Character assets keep appearance and behavior consistent across projects.",
    namePlaceholder: "Character name",
    detailsPlaceholder: "Role, appearance, personality, wardrobe, or story function",
    textPlaceholder: "Continuity notes, traits, constraints, relationships, and visual references",
  },
  style: {
    title: "Create visual style",
    description: "Style assets define reusable visual direction for projects and scenes.",
    namePlaceholder: "Style name",
    detailsPlaceholder: "Visual treatment, palette, lighting, lensing, texture, or genre",
    textPlaceholder: "Style rules, references, do/don't notes, shot language, and constraints",
  },
  audio: {
    title: "Create audio clip",
    description: "Audio assets can be used as reference material in project timelines.",
    namePlaceholder: "Audio title",
    detailsPlaceholder: "Sound source, mood, usage, duration, or placement notes",
    textPlaceholder: "Audio cues, lyrics/transcript notes, mix constraints, and timing guidance",
  },
} satisfies Record<AssetType, Record<string, string>>;

export function AssetCreateDialog({
  assetType,
  busy,
  images,
  open,
  workspaceId,
  onGenerateDraft,
  onOpenChange,
  onSubmit,
}: AssetCreateDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const meta = assetMeta[assetType];
  const copy = fieldCopy[assetType];
  const Icon = meta.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button disabled={!workspaceId} variant="outline" />}>
        <Plus className="size-4" />
        New {meta.label}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-4" />
            {copy.title}
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={onSubmit} className="grid gap-3">
          <input type="hidden" name="type" value={assetType} />
          <Textarea name="steering" placeholder="Optional generation note" rows={2} />
          <GenerateButton busy={busy} onClick={() => onGenerateDraft(formRef.current, assetType)} />
          <Input name="title" placeholder={copy.namePlaceholder} required />
          <Textarea name="description" placeholder={copy.detailsPlaceholder} rows={4} />
          <Textarea name="text" placeholder={copy.textPlaceholder} rows={5} />
          <div className="grid gap-1.5">
            <Label>Upload images</Label>
            <Input name="imageFiles" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple />
          </div>
          {assetType === "audio" ? (
            <>
              <div className="grid gap-1.5">
                <Label>Upload audio</Label>
                <Input name="audioFile" type="file" accept="audio/*" />
              </div>
              <Input name="audioUrl" placeholder="Audio URL" />
              <Input name="audioMimeType" placeholder="Audio MIME type" />
            </>
          ) : null}
          <div className="grid gap-2">
            <Label>Images</Label>
            <ImageChecklist images={images} />
          </div>
          <DialogFooter>
            <Button disabled={!workspaceId || busy} type="submit">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Save {meta.label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
