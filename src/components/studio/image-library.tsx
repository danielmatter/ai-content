"use client";

import { FormEvent } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LibraryImage } from "./types";
import { PreviewableImage } from "./image-preview";

interface ImageLibraryProps {
  images: LibraryImage[];
  workspaceId: string;
  busy: boolean;
  activeImageId?: string;
  onOpenImage: (imageId: string) => void;
  onUpload: (event: FormEvent<HTMLFormElement>) => void;
}

export function ImageLibrary({ images, workspaceId, busy, activeImageId = "", onOpenImage, onUpload }: ImageLibraryProps) {
  return (
    <div className="grid gap-4">
      <div className="rounded-md border bg-background p-4">
        <form onSubmit={onUpload} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="grid gap-1.5">
            <Label>Title</Label>
            <Input name="title" placeholder="Reference image title" />
          </div>
          <div className="grid gap-1.5">
            <Label>Image file</Label>
            <Input name="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required />
          </div>
          <Button disabled={!workspaceId || busy} type="submit">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Upload
          </Button>
          <Textarea name="description" placeholder="Description or usage notes" rows={2} className="md:col-span-3" />
        </form>
      </div>

      <div className="overflow-hidden rounded-md border bg-background">
        <div className="grid grid-cols-[72px_1fr_1fr] gap-3 border-b px-3 py-2 text-xs font-medium uppercase text-muted-foreground">
          <span>Image</span>
          <span>Title</span>
          <span>Reference</span>
        </div>
        {images.map((image) => (
          <div
            key={image.id}
            onClick={() => onOpenImage(image.id)}
            className={`grid grid-cols-[72px_1fr_1fr] items-center gap-3 border-b px-3 py-2 text-left transition last:border-b-0 hover:bg-muted/80 hover:ring-1 hover:ring-primary/25 ${
              image.id === activeImageId ? "bg-primary/10" : ""
            }`}
          >
            <PreviewableImage src={image.thumbnailUrl || image.sourceUrl} previewUrl={image.sourceUrl} title={image.title} className="size-14 rounded-md object-cover" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{image.title}</div>
              <div className="truncate text-xs text-muted-foreground">{image.description || image.mimeType}</div>
            </div>
            <code className="truncate text-xs text-muted-foreground">{image.sourceUrl}</code>
          </div>
        ))}
        {!images.length ? (
          <p className="p-4 text-sm text-muted-foreground">No images saved yet.</p>
        ) : null}
      </div>
    </div>
  );
}
