"use client";

import { useState } from "react";
import { Search, Check, Image as ImageIcon, Maximize2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LibraryImage } from "./types";
import { cn } from "@/lib/utils";
import { useImagePreview } from "./image-preview";

interface ImagePickerProps {
  images: LibraryImage[];
  value?: string;
  onChange: (url: string) => void;
  onGenerate?: () => void;
  label: string;
  name?: string;
  className?: string;
}

export function ImagePicker({
  images,
  value,
  onChange,
  onGenerate,
  label,
  name,
  className,
}: ImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { openImage } = useImagePreview();

  const filteredImages = images.filter((img) =>
    img.title.toLowerCase().includes(search.toLowerCase()) ||
    img.description.toLowerCase().includes(search.toLowerCase())
  );

  const selectedImage = images.find((img) => img.sourceUrl === value);

  return (
    <div className={cn("grid gap-2", className)}>
      {name && <input type="hidden" name={name} value={value || ""} />}
      <Dialog open={open} onOpenChange={setOpen}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "group relative flex h-32 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 transition-all hover:border-primary hover:bg-muted",
            value && "border-solid border-primary/20 bg-background"
          )}
        >
            {selectedImage ? (
              <>
                <img
                  src={selectedImage.thumbnailUrl || selectedImage.sourceUrl}
                  alt={selectedImage.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center">
                  <span className="text-white text-xs font-medium px-2 py-1 bg-black/50 rounded-md backdrop-blur-sm">
                    Change Image
                  </span>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  className="absolute right-2 top-2 rounded bg-background/90 p-1.5 opacity-0 shadow-sm transition group-hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    openImage({ title: selectedImage.title, url: selectedImage.sourceUrl });
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    openImage({ title: selectedImage.title, url: selectedImage.sourceUrl });
                  }}
                >
                  <Maximize2 className="size-4" />
                </span>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground transition-colors group-hover:text-primary">
                <ImageIcon className="size-8" />
                <span className="text-sm font-medium">{label}</span>
              </div>
            )}
        </button>
        <DialogContent className="sm:max-w-3xl dialog-content-scrollable !p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Choose {label}</DialogTitle>
          </DialogHeader>
          
          <div className="flex items-center gap-2 px-6 pb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search images..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {onGenerate && (
              <Button onClick={() => { setOpen(false); onGenerate(); }} variant="secondary" className="gap-2">
                <Plus className="size-4" />
                Generate New
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              <div
                onClick={() => { onChange(""); setOpen(false); }}
                className={cn(
                  "group relative aspect-video cursor-pointer overflow-hidden rounded-md border-2 border-dashed border-muted-foreground/20 bg-muted/30 transition-all hover:border-primary/50 hover:bg-muted",
                  !value && "border-primary bg-primary/5"
                )}
              >
                <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground group-hover:text-primary">
                  <span className="text-xs font-medium">None</span>
                </div>
              </div>
              
              {filteredImages.map((image) => (
                <div
                  key={image.id}
                  onClick={() => { onChange(image.sourceUrl); setOpen(false); }}
                  className={cn(
                  "group relative aspect-video cursor-pointer overflow-hidden rounded-md border-2 border-transparent transition-all hover:border-primary",
                    value === image.sourceUrl && "border-primary"
                  )}
                >
                  <img
                    src={image.thumbnailUrl || image.sourceUrl}
                    alt={image.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity group-hover:bg-black/35 group-hover:opacity-100" />
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded bg-background/90 p-1 opacity-0 shadow-sm transition group-hover:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation();
                      openImage({ title: image.title, url: image.sourceUrl });
                    }}
                  >
                    <Maximize2 className="size-3.5" />
                    <span className="sr-only">Preview full image</span>
                  </button>
                  {value === image.sourceUrl && (
                    <div className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                      <Check className="size-3" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/65 p-1.5 opacity-90 transition-opacity group-hover:opacity-100">
                    <p className="truncate text-[10px] font-medium text-white">
                      {image.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {filteredImages.length === 0 && (
              <div className="flex h-40 flex-col items-center justify-center text-muted-foreground">
                <ImageIcon className="size-8 mb-2 opacity-20" />
                <p className="text-sm">No images found</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
