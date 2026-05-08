"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { LibraryImage } from "./types";
import { PreviewableImage } from "./image-preview";

export function ImageChecklist({ images, defaultValue = [] }: { images: LibraryImage[]; defaultValue?: string[] }) {
  if (!images.length) {
    return <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No saved images yet.</p>;
  }

  return (
    <div className="grid max-h-56 gap-2 overflow-auto rounded-md border p-2">
      {images.map((image) => (
        <div key={image.id} className="flex min-h-14 items-center gap-3 rounded-md px-2 py-1 text-sm hover:bg-muted/70">
          <Checkbox name="imageUrls" value={image.sourceUrl} defaultChecked={defaultValue.includes(image.sourceUrl)} />
          <PreviewableImage src={image.thumbnailUrl || image.sourceUrl} previewUrl={image.sourceUrl} title={image.title} className="size-10 rounded-md object-cover" />
          <span className="min-w-0 flex-1 truncate">{image.title}</span>
        </div>
      ))}
    </div>
  );
}
