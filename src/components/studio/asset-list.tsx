"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Asset, AssetType, assetMeta, LibraryImage } from "./types";
import { PreviewableImage } from "./image-preview";

interface AssetListProps {
  groupedAssets: Record<AssetType, Asset[]>;
  images: LibraryImage[];
  onOpenAsset: (asset: Asset) => void;
  onEditAsset: (asset: Asset) => void;
  onDeleteAsset: (asset: Asset) => void;
}

export function AssetList({ groupedAssets, images, onOpenAsset, onEditAsset, onDeleteAsset }: AssetListProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {(Object.keys(groupedAssets) as AssetType[]).map((type) => {
        const Icon = assetMeta[type].icon;
        return (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="size-4" />
                {assetMeta[type].label}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {groupedAssets[type].map((asset) => (
                <div key={asset.id} className="interactive-card group">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" onClick={() => onOpenAsset(asset)} className="min-w-0 text-left">
                      <h3 className="truncate font-medium">{asset.title}</h3>
                    </button>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-[10px]">{asset.type === "audio" ? "audio" : `${asset.imageUrls?.length ?? 0} img`}</Badge>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100"
                        onClick={() => onEditAsset(asset)}
                      >
                        <Pencil className="size-3.5" />
                        <span className="sr-only">Edit asset</span>
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-destructive hover:text-destructive"
                        onClick={() => onDeleteAsset(asset)}
                      >
                        <Trash2 className="size-3.5" />
                        <span className="sr-only">Delete asset</span>
                      </Button>
                    </div>
                  </div>
                  <button type="button" onClick={() => onOpenAsset(asset)} className="mt-1 block w-full text-left">
                    <p className="line-clamp-2 text-xs text-muted-foreground">{asset.description || asset.text}</p>
                  </button>
                  {asset.imageUrls?.length ? (
                    <div className="mt-2 flex gap-1.5 overflow-hidden">
                      {asset.imageUrls.slice(0, 4).map((url) => {
                        const image = images.find((item) => item.sourceUrl === url);
                        return (
                          <PreviewableImage
                            key={url}
                            src={image?.thumbnailUrl || url}
                            previewUrl={url}
                            title={image?.title || asset.title}
                            alt=""
                            className="thumb-xs"
                          />
                        );
                      })}
                    </div>
                  ) : null}
                  {asset.audioUrl ? <audio src={asset.audioUrl} controls className="mt-2 w-full h-8" /> : null}
                </div>
              ))}
              {!groupedAssets[type].length ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No items.</p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
