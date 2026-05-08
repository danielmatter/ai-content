"use client";

import { ArrowLeft, ArrowDown, ArrowUp, ImageIcon, Loader2, Play, Sparkles, Trash2, Video, Pencil, X, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Asset, LibraryImage, ProjectScene, RenderJob } from "./types";
import { AssetPicker, PickedAsset } from "./asset-picker";
import { PreviewableImage } from "./image-preview";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { AssetChecklist } from "./asset-checklist";

type SceneDetailProps = {
  assets: Asset[];
  busy: boolean;
  canMoveDown: boolean;
  canMoveUp: boolean;
  images: LibraryImage[];
  index: number;
  jobs: RenderJob[];
  onBack: () => void;
  onDelete: (scene: ProjectScene) => void;
  onMoveDown: (scene: ProjectScene) => void;
  onMoveUp: (scene: ProjectScene) => void;
  onRender: (scene: ProjectScene) => void;
  onExtractFrame: (scene: ProjectScene, frameType: "first" | "last", renderJobId?: string) => void;
  onGenerateFrame: (type: "first" | "last", scene: ProjectScene) => void;
  onSave: (scene: ProjectScene) => void;
  onEdit: (scene: ProjectScene) => void;
  scene: ProjectScene;
  projectAssetIds: string[];
};

export function SceneDetail({
  assets,
  busy,
  canMoveDown,
  canMoveUp,
  images,
  index,
  jobs,
  onBack,
  onDelete,
  onMoveDown,
  onMoveUp,
  onRender,
  onExtractFrame,
  onGenerateFrame,
  onSave,
  onEdit,
  scene,
  projectAssetIds,
}: SceneDetailProps) {
  const [localScene, setLocalScene] = useState(scene);
  
  useEffect(() => {
    setLocalScene(scene);
  }, [scene]);

  const handleBlur = () => {
    if (JSON.stringify(localScene) !== JSON.stringify(scene)) {
      onSave(localScene);
    }
  };
  const activeJob = jobs.find((job) => job.status === "pending" || job.status === "processing");
  const completedVideoJobs = jobs.filter((job) => job.kind === "video" && (job.status === "downloaded" || job.status === "completed") && job.video_url);
  const [selectedRenderId, setSelectedRenderId] = useState("");
  const selectedRenderJob = completedVideoJobs.find((job) => job.id === selectedRenderId) ?? completedVideoJobs[0];
  const sceneAssets = assets.filter((asset) => scene.assetIds?.includes(asset.id));

  const handleClearFrame = (type: "first" | "last") => {
    const updated = {
      ...localScene,
      [type === "first" ? "first_frame_url" : "last_frame_url"]: "",
      [type === "first" ? "first_frame_description" : "last_frame_description"]: "",
    };
    setLocalScene(updated);
    onSave(updated);
  };

  const handleChooseFrame = (type: "first" | "last", picked: PickedAsset | null) => {
    if (!picked) {
      handleClearFrame(type);
      return;
    }
    const updated = {
      ...localScene,
      [type === "first" ? "first_frame_url" : "last_frame_url"]: picked.url,
      [type === "first" ? "first_frame_description" : "last_frame_description"]: picked.title,
    };
    setLocalScene(updated);
    onSave(updated);
  };

  return (
    <div className="grid gap-4">
      {/* Back link */}
      <Button type="button" variant="ghost" size="sm" className="w-fit -ml-2 text-muted-foreground" onClick={onBack}>
        <ArrowLeft className="size-4 mr-1" />
        Back to project
      </Button>

      {/* Toolbar — separated from content */}
      <div className="toolbar">
        <Badge variant="outline">Scene {index + 1}</Badge>
        {activeJob ? <Badge variant="secondary">Rendering</Badge> : null}

        <div className="toolbar-end">
          <Button type="button" size="sm" variant="ghost" disabled={busy || !canMoveUp} onClick={() => onMoveUp(scene)}>
            <ArrowUp className="size-3.5 mr-1" />
            Up
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={busy || !canMoveDown} onClick={() => onMoveDown(scene)}>
            <ArrowDown className="size-3.5 mr-1" />
            Down
          </Button>
          <div className="w-px h-5 bg-border" />
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onEdit(scene)}>
            <Pencil className="size-3.5 mr-1" />
            Full edit
          </Button>
          <Button type="button" size="sm" className="btn-accent" disabled={busy || Boolean(activeJob)} onClick={() => onRender(scene)}>
            {activeJob ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Play className="size-3.5 mr-1" />}
            Render video
          </Button>
          <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(scene)}>
            <Trash2 className="size-3.5 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Inline editable title & description — full width, no button interference */}
      <div className="card">
        <Input 
          value={localScene.title} 
          onChange={e => setLocalScene({...localScene, title: e.target.value})}
          onBlur={handleBlur}
          className="inline-edit-title"
        />
        <Textarea 
          value={localScene.description} 
          onChange={e => setLocalScene({...localScene, description: e.target.value})}
          onBlur={handleBlur}
          placeholder="No scene description."
          className="inline-edit-area mt-2"
        />
      </div>

      {/* Action & Look — two columns */}
      <div className="grid-layout">
        <section className="card">
          <h4 className="section-heading mb-2">Action</h4>
          <Textarea 
            value={localScene.action} 
            onChange={e => setLocalScene({...localScene, action: e.target.value})}
            onBlur={handleBlur}
            placeholder="No action notes."
            className="inline-edit-area"
          />
        </section>
        <section className="card">
          <h4 className="section-heading mb-2">Look</h4>
          <Textarea 
            value={localScene.look} 
            onChange={e => setLocalScene({...localScene, look: e.target.value})}
            onBlur={handleBlur}
            placeholder="No look notes."
            className="inline-edit-area"
          />
        </section>
      </div>

      {/* Frames */}
      <section className="card">
        <h4 className="section-heading mb-3">Frames</h4>
        <div className="grid-layout">
          <FramePreview 
            label="First frame" 
            url={scene.first_frame_url} 
            description={scene.first_frame_description} 
            images={images} 
            assets={assets}
            busy={busy}
            onGenerate={() => onGenerateFrame("first", scene)}
            onClear={() => handleClearFrame("first")}
            onChoose={(picked) => handleChooseFrame("first", picked)}
          />
          <FramePreview 
            label="Last frame" 
            url={scene.last_frame_url} 
            description={scene.last_frame_description} 
            images={images} 
            assets={assets}
            busy={busy}
            onGenerate={() => onGenerateFrame("last", scene)}
            onClear={() => handleClearFrame("last")}
            onChoose={(picked) => handleChooseFrame("last", picked)}
          />
        </div>
      </section>

      {/* Linked assets */}
      <section className="card">
        <h4 className="section-heading mb-2">Linked assets</h4>
        <AssetChecklist 
          assets={assets.filter(a => projectAssetIds.includes(a.id))} 
          value={localScene.assetIds || []} 
          onChange={(ids) => {
            const updated = {...localScene, assetIds: ids};
            setLocalScene(updated);
            onSave(updated);
          }} 
        />
      </section>

      {/* Renders */}
      {completedVideoJobs.length ? (
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="grid gap-1">
              <h4 className="flex items-center gap-2 section-heading">
                <Video className="size-4" />
                Scene renders
              </h4>
              <select
                value={selectedRenderJob?.id ?? ""}
                onChange={(event) => setSelectedRenderId(event.target.value)}
                className="h-8 rounded-md border bg-background px-2 text-xs"
              >
                {completedVideoJobs.map((job, renderIndex) => (
                  <option key={job.id} value={job.id}>
                    {job.description || `${scene.title} render ${completedVideoJobs.length - renderIndex}`} - {new Date(job.created_at).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            <div className="button-group">
              <Button type="button" size="sm" variant="outline" disabled={busy || !selectedRenderJob} onClick={() => onExtractFrame(scene, "first", selectedRenderJob?.id)}>
                <ImageIcon className="size-3.5 mr-1" />
                Extract first frame
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={busy || !selectedRenderJob} onClick={() => onExtractFrame(scene, "last", selectedRenderJob?.id)}>
                <ImageIcon className="size-3.5 mr-1" />
                Extract last frame
              </Button>
            </div>
          </div>
          {selectedRenderJob?.video_url ? <video src={selectedRenderJob.video_url} controls className="w-full rounded-md bg-black" /> : null}
        </section>
      ) : null}
    </div>
  );
}

function FramePreview({
  description,
  images,
  assets = [],
  label,
  url,
  busy,
  onGenerate,
  onClear,
  onChoose,
}: {
  description?: string;
  images: LibraryImage[];
  assets?: Asset[];
  label: string;
  url: string;
  busy: boolean;
  onGenerate: () => void;
  onClear: () => void;
  onChoose: (picked: PickedAsset | null) => void;
}) {
  const image = images.find((item) => item.sourceUrl === url);

  return (
    <div className="grid gap-2">
      <div className="section-heading">{label}</div>
      {url ? (
        <div className="relative group/frame">
          <PreviewableImage
            src={image?.thumbnailUrl || url}
            previewUrl={url}
            title={image?.title || label}
            className="media-compact"
          />
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="absolute -right-2 -top-2 size-6 rounded-full opacity-0 group-hover/frame:opacity-100 transition-opacity shadow-lg"
            onClick={onClear}
            disabled={busy}
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : (
        <div className="media-compact border border-dashed bg-transparent text-sm text-muted-foreground h-32 flex flex-col gap-2 items-center justify-center">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onGenerate}>
            <Sparkles className="size-3.5 mr-1" />
            Generate {label.toLowerCase()}
          </Button>
          <AssetPicker
            images={images}
            assets={assets}
            value={url}
            onChange={onChoose}
            label={label}
            trigger={
              <Button type="button" size="sm" variant="ghost" disabled={busy} className="h-7 text-xs">
                <Search className="size-3 mr-1" />
                Choose existing
              </Button>
            }
          />
        </div>
      )}
      {url ? (
        <div className="mt-1 flex justify-end gap-1">
          <AssetPicker
            images={images}
            assets={assets}
            value={url}
            onChange={onChoose}
            label={label}
            trigger={
              <Button type="button" size="sm" variant="ghost" disabled={busy} className="h-7 text-xs">
                <Search className="size-3 mr-1" />
                Choose different
              </Button>
            }
          />
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onGenerate} className="h-7 text-xs">
            <Sparkles className="size-3 mr-1" />
            Regenerate
          </Button>
        </div>
      ) : null}
      {description ? <p className="text-xs text-muted-foreground line-clamp-2">{description}</p> : null}
    </div>
  );
}
