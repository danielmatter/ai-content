"use client";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Asset } from "./types";

export function AssetChecklist({
  assets,
  value,
  onChange,
}: {
  assets: Asset[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  if (!assets.length) {
    return <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No workspace assets yet.</p>;
  }

  return (
    <div className="space-y-2 max-w-full">
      {assets.map((asset) => (
        <label
          key={asset.id}
          className="flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm transition hover:border-primary/60 hover:bg-muted/70"
        >
          <Checkbox
            checked={value.includes(asset.id)}
            onCheckedChange={(checked) =>
              onChange(checked ? [...value, asset.id] : value.filter((assetId) => assetId !== asset.id))
            }
          />
          <span className="truncate">{asset.title}</span>
          <Badge variant="outline" className="ml-auto shrink-0">
            {asset.type}
          </Badge>
        </label>
      ))}
    </div>
  );
}
