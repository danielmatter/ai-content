import { FormEvent, RefObject } from "react";
import { ImageIcon, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Asset, LibraryImage } from "../types";
import { GenerateButton } from "../generate-button";
import { ImageChecklist } from "../image-checklist";

export function AssetEditDialog({
  asset,
  onOpenChange,
  formRef,
  onSubmit,
  busy,
  onGenerateDraft,
  images,
  onQueueImage,
  onDeleteAsset,
}: {
  asset: Asset | null;
  onOpenChange: (open: boolean) => void;
  formRef: RefObject<HTMLFormElement | null>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  onGenerateDraft: () => void;
  images: LibraryImage[];
  onQueueImage: (asset: Asset) => void;
  onDeleteAsset: (asset: Asset) => void;
}) {
  return (
    <Dialog open={Boolean(asset)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl dialog-content-scrollable">
        <DialogHeader className="dialog-header-fixed">
          <DialogTitle>Edit workspace asset</DialogTitle>
          <DialogDescription>Update the asset reference used across projects in this workspace.</DialogDescription>
        </DialogHeader>
        {asset ? (
          <form ref={formRef} onSubmit={onSubmit} className="contents">
            <div className="dialog-body-scrollable grid gap-3">
              <Textarea name="steering" placeholder="Optional generation note" rows={2} />
              <GenerateButton busy={busy} onClick={onGenerateDraft} />
              <Select name="type" defaultValue={asset.type}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="character">Character</SelectItem>
                  <SelectItem value="scene">Scene asset</SelectItem>
                  <SelectItem value="style">Visual style</SelectItem>
                  <SelectItem value="audio">Audio clip</SelectItem>
                </SelectContent>
              </Select>
              <Input name="title" defaultValue={asset.title} placeholder="Name or title" required />
              <Textarea name="description" defaultValue={asset.description} placeholder="Description" rows={4} />
              <Textarea
                name="text"
                defaultValue={asset.text}
                placeholder="Reference text, traits, constraints, continuity notes"
                rows={5}
              />
              <div className="grid gap-1.5">
                <Label>Upload images</Label>
                <Input name="imageFiles" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple />
              </div>
              <div className="grid gap-1.5">
                <Label>Upload audio</Label>
                <Input name="audioFile" type="file" accept="audio/*" />
              </div>
              <Input name="audioUrl" defaultValue={asset.audioUrl ?? ""} placeholder="Audio URL for audio assets" />
              <Input name="audioMimeType" defaultValue={asset.audioMimeType ?? ""} placeholder="Audio MIME type" />
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Images</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onQueueImage(asset)}>
                      <ImageIcon className="size-4 mr-1" />
                      Queue Image
                    </Button>
                    <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => onDeleteAsset(asset)}>
                      Delete asset
                    </Button>
                  </div>
                </div>
                <ImageChecklist images={images} defaultValue={asset.imageUrls ?? []} />
              </div>
            </div>
            <div className="dialog-footer-fixed">
              <Button disabled={busy} type="submit">
                {busy ? <Loader2 className="size-4 animate-spin mr-1" /> : <Save className="size-4 mr-1" />}
                Save changes
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
