"use client";

import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { Maximize2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type PreviewImage = {
  alt?: string;
  title?: string;
  url: string;
};

type ImagePreviewContextValue = {
  openImage: (image: PreviewImage) => void;
};

const ImagePreviewContext = createContext<ImagePreviewContextValue | null>(null);

export function ImagePreviewProvider({ children }: { children: ReactNode }) {
  const [image, setImage] = useState<PreviewImage | null>(null);
  const value = useMemo(() => ({ openImage: setImage }), []);

  return (
    <ImagePreviewContext.Provider value={value}>
      {children}
      <Dialog open={Boolean(image)} onOpenChange={(open) => !open && setImage(null)}>
        <DialogContent className="w-full sm:max-w-5xl max-h-[95vh] overflow-hidden p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle className="truncate text-base">{image?.title || image?.alt || "Image preview"}</DialogTitle>
          </DialogHeader>
          {image ? (
            <div className="overflow-hidden p-4 pt-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={image.alt ?? ""} className="mx-auto block h-auto max-h-[80vh] w-full max-w-full rounded-md object-contain shadow-sm" />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </ImagePreviewContext.Provider>
  );
}

export function useImagePreview() {
  const context = useContext(ImagePreviewContext);
  if (!context) {
    return { openImage: () => undefined };
  }
  return context;
}

export function PreviewableImage({
  alt = "",
  className,
  previewUrl,
  src,
  title,
}: {
  alt?: string;
  className?: string;
  previewUrl?: string;
  src: string;
  title?: string;
}) {
  const { openImage } = useImagePreview();
  const url = previewUrl || src;

  return (
    <button
      type="button"
      aria-label={`Preview ${title || alt || "image"}`}
      className="group/image relative inline-flex overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={(event) => {
        event.stopPropagation();
        openImage({ alt, title, url });
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={cn("transition group-hover/image:brightness-90", className)} />
      <span className="pointer-events-none absolute right-1 top-1 rounded bg-background/90 p-1 opacity-0 shadow-sm transition group-hover/image:opacity-100">
        <Maximize2 className="size-3.5" />
      </span>
    </button>
  );
}
