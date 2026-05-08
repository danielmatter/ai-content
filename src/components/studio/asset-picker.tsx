"use client";

import { useState } from "react";
import { Search, Check, Image as ImageIcon, Maximize2, Plus, Type } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Asset, LibraryImage, assetMeta } from "./types";
import { cn } from "@/lib/utils";
import { useImagePreview } from "./image-preview";
import { Badge } from "../ui/badge";

export type PickedAsset = {
  type: "image" | "asset";
  id: string;
  url: string;
  title: string;
  text?: string;
  kind?: string;
};

interface AssetPickerProps {
  images: LibraryImage[];
  assets?: Asset[]; // If provided, enables picking assets too
  value?: string; // matches id or url
  onChange: (asset: PickedAsset | null) => void;
  onGenerate?: () => void;
  label: string;
  name?: string;
  className?: string;
  trigger?: React.ReactNode;
}

export function AssetPicker({
  images,
  assets = [],
  value,
  onChange,
  onGenerate,
  label,
  name,
  className,
  trigger,
}: AssetPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { openImage } = useImagePreview();

  const filteredImages = images.filter((img) =>
    img.title.toLowerCase().includes(search.toLowerCase()) ||
    img.description.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAssets = assets.filter((a) => 
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.description.toLowerCase().includes(search.toLowerCase())
  );

  const selectedImage = images.find((img) => img.sourceUrl === value || img.id === value);
  const selectedAsset = assets.find((a) => a.id === value);
  
  const displayUrl = selectedImage ? (selectedImage.thumbnailUrl || selectedImage.sourceUrl) : (selectedAsset?.imageUrls?.[0]);
  const displayTitle = selectedImage?.title || selectedAsset?.title || "";

  return (
    <div className={cn("grid gap-2", className)}>
      {name && <input type="hidden" name={name} value={value || ""} />}
      <Dialog open={open} onOpenChange={setOpen}>
        {trigger ? (
          <div onClick={() => setOpen(true)} className={className}>
            {trigger}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "group relative flex h-32 w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-muted-foreground/25 bg-muted/50 transition-all hover:border-primary hover:bg-muted",
              value && "border-solid border-primary/20 bg-background"
            )}
          >
            {displayUrl ? (
              <>
                <img
                  src={displayUrl}
                  alt={displayTitle}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center">
                  <span className="text-white text-xs font-medium px-2 py-1 bg-black/50 rounded-md backdrop-blur-sm">
                    Change {label}
                  </span>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  className="absolute right-2 top-2 rounded bg-background/90 p-1.5 opacity-0 shadow-sm transition group-hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    openImage({ title: displayTitle, url: displayUrl });
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    openImage({ title: displayTitle, url: displayUrl });
                  }}
                >
                  <Maximize2 className="size-4" />
                </span>
              </>
            ) : selectedAsset ? (
              <div className="flex flex-col items-center gap-2 p-4 text-center">
                <Type className="size-8 text-primary" />
                <span className="text-sm font-medium line-clamp-1">{displayTitle}</span>
                <span className="text-xs text-muted-foreground line-clamp-2">{selectedAsset.text}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground transition-colors group-hover:text-primary">
                <ImageIcon className="size-8" />
                <span className="text-sm font-medium">{label}</span>
              </div>
            )}
          </button>
        )}
        <DialogContent className="sm:max-w-3xl dialog-content-scrollable !p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Choose {label}</DialogTitle>
          </DialogHeader>
          
          <div className="flex items-center gap-2 px-6 py-4 border-b bg-muted/20">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search images and assets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>
            {onGenerate && (
              <Button onClick={() => { setOpen(false); onGenerate(); }} variant="secondary" className="gap-2">
                <Plus className="size-4" />
                Generate New
              </Button>
            )}
          </div>

          <div className="dialog-body-scrollable space-y-6">
            {assets.length > 0 && (
              <div className="grid gap-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Assets</h4>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {filteredAssets.map((asset) => {
                    const AssetIcon = assetMeta[asset.type].icon;
                    return (
                      <div
                        key={asset.id}
                        onClick={() => {
                          onChange({
                            type: "asset",
                            id: asset.id,
                            url: asset.imageUrls?.[0] || "",
                            title: asset.title,
                            text: asset.description || asset.text,
                            kind: asset.type,
                          });
                          setOpen(false);
                        }}
                        className={cn(
                          "group relative flex flex-col cursor-pointer overflow-hidden rounded-md border-2 bg-card transition-all hover:border-primary",
                          value === asset.id ? "border-primary ring-1 ring-primary/20" : "border-border"
                        )}
                      >
                        {asset.imageUrls?.[0] ? (
                          <div className="aspect-video w-full overflow-hidden bg-muted">
                            <img src={asset.imageUrls[0]} alt={asset.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                          </div>
                        ) : (
                          <div className="flex aspect-video w-full items-center justify-center bg-muted/50 text-muted-foreground">
                            <AssetIcon className="size-8 opacity-50" />
                          </div>
                        )}
                        <div className="p-2.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase tracking-wider">
                              {asset.type}
                            </Badge>
                          </div>
                          <p className="font-medium text-sm line-clamp-1">{asset.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{asset.description || asset.text}</p>
                        </div>
                        {value === asset.id && (
                          <div className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-primary-foreground shadow-sm">
                            <Check className="size-3" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredAssets.length === 0 && (
                    <div className="col-span-full py-4 text-center text-sm text-muted-foreground border border-dashed rounded-md">
                      No assets found matching "{search}"
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-3">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Library Images</h4>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                <div
                  onClick={() => { onChange(null); setOpen(false); }}
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
                    onClick={() => {
                      onChange({
                        type: "image",
                        id: image.id,
                        url: image.sourceUrl,
                        title: image.title,
                        kind: "Image",
                      });
                      setOpen(false);
                    }}
                    className={cn(
                      "group relative aspect-video cursor-pointer overflow-hidden rounded-md border-2 border-transparent transition-all hover:border-primary ring-offset-background",
                      (value === image.sourceUrl || value === image.id) && "border-primary ring-2 ring-primary ring-offset-1"
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
                    {(value === image.sourceUrl || value === image.id) && (
                      <div className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground shadow-sm">
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
                <div className="py-8 text-center text-sm text-muted-foreground border border-dashed rounded-md">
                  No images found
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
