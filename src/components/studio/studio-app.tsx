"use client";

import { ArrowLeft, BriefcaseBusiness, FolderKanban, Loader2, Menu, Pencil, Sparkles, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { AssetType, StudioRoute, StudioTab } from "./types";
import { AuthScreen } from "./auth-screen";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { FrameGenerator } from "./frame-generator";
import { OngoingGenerations } from "./ongoing-generations";
import { ImagePreviewProvider } from "./image-preview";
import { GenerationReviewDialog } from "./generation-review-dialog";

import { useStudioState } from "./hooks/use-studio-state";
import { useWorkspaceActions } from "./hooks/use-workspace-actions";
import { useProjectActions } from "./hooks/use-project-actions";
import { useSceneActions } from "./hooks/use-scene-actions";
import { useAssetActions } from "./hooks/use-asset-actions";
import { useSharedActions } from "./hooks/use-shared-actions";
import { useStudioMutations } from "./hooks/use-mutations";

import { WorkspaceCreateDialog, WorkspaceEditDialog } from "./dialogs/workspace-dialogs";
import { ProjectEditDialog } from "./dialogs/project-dialogs";
import { SceneCreateDialog, SceneEditDialog } from "./dialogs/scene-dialogs";
import { AssetEditDialog } from "./dialogs/asset-edit-dialog";
import { StudioContent } from "./studio-content";
import { StudioProvider } from "./studio-context";

const assetCreateTypes: AssetType[] = ["character", "scene", "style", "audio"];

export function StudioApp({
  initialWorkspaceId = "",
  initialRoute,
  initialTab,
}: {
  initialWorkspaceId?: string;
  initialRoute?: StudioRoute;
  initialTab?: StudioTab;
}) {
  const session = authClient.useSession();
  const state = useStudioState({ initialWorkspaceId, initialRoute, initialTab });

  const workspaceActions = useWorkspaceActions(state);
  const projectActions = useProjectActions(state);
  const sceneActions = useSceneActions(state);
  const assetActions = useAssetActions(state);
  const sharedActions = useSharedActions(state);
  const mutations = useStudioMutations(state.workspaceId, state.projectId);

  if (session.isPending || state.loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin" />
      </main>
    );
  }

  if (!state.user) {
    return <AuthScreen onSignedIn={() => void session.refetch()} />;
  }

  return (
    <ImagePreviewProvider>
      <StudioProvider value={{ state, projectActions, sceneActions, assetActions, sharedActions, mutations, assetCreateTypes }}>
      <main className="min-h-screen bg-muted/30 text-foreground">
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[300px_1fr]">
          <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:hidden">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{state.activeWorkspace?.name ?? "AI Content Studio"}</div>
              <div className="truncate text-xs text-muted-foreground">
                {state.projectDetailOpen && state.activeProject ? state.activeProject.title : "Workspace dashboard"}
              </div>
            </div>
            <Button size="icon" variant="outline" onClick={() => state.setMobileNavOpen((open: boolean) => !open)} aria-label="Toggle navigation">
              {state.mobileNavOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </Button>
          </div>

          {state.mobileNavOpen ? (
            <div className="sticky top-0 inset-0 z-30 bg-black/20 lg:hidden" onClick={() => state.setMobileNavOpen(false)} />
          ) : null}

          <div
            className={`fixed inset-y-0 left-0 z-40 w-[min(320px,calc(100vw-2rem))] transition-transform lg:sticky lg:top-0 lg:z-auto lg:w-auto lg:translate-x-0 ${state.mobileNavOpen ? "translate-x-0" : "-translate-x-full"
              }`}
          >
            <WorkspaceSidebar
              user={state.user}
              workspaces={state.workspaces}
              projects={state.projects}
              activeWorkspaceId={state.workspaceId}
              activeProjectId={state.projectId}
              activeSection={state.activeTab}
              onWorkspaceSelect={state.selectWorkspace}
              onProjectSelect={state.openProject}
              onSectionSelect={state.changeTab}
              onSignOut={() => void authClient.signOut().then(() => session.refetch())}
              onNewWorkspace={() => {
                state.setMobileNavOpen(false);
                state.setWorkspaceDialogOpen(true);
              }}
            />
          </div>

          <section className="p-4 lg:p-6">
            <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                {state.projectDetailOpen && state.activeProject ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-3 w-fit"
                    onClick={state.openWorkspaceHome}
                  >
                    <ArrowLeft className="size-4" />
                    Back to projects
                  </Button>
                ) : null}
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="gap-1">
                    <BriefcaseBusiness className="size-3" />
                    {state.activeWorkspace?.name ?? "No workspace"}
                  </Badge>
                  {state.projectDetailOpen && state.activeProject ? (
                    <Badge variant="secondary" className="gap-1">
                      <FolderKanban className="size-3" />
                      {state.activeProject.title}
                    </Badge>
                  ) : null}
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {state.projectDetailOpen && state.activeProject ? state.activeProject.title : state.activeWorkspace?.name ?? "Create a workspace"}
                </h2>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  {state.projectDetailOpen && state.activeProject
                    ? state.activeProject.logline || "Project scenes, assets, and drafts live here."
                    : state.activeWorkspace?.description || "Workspaces contain projects. Projects contain scenes. Assets stay scoped to the selected workspace."}
                </p>
              </div>
              {state.activeWorkspace && !state.projectDetailOpen ? (
                <div className="flex shrink-0 items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => state.setEditingWorkspace(state.activeWorkspace ?? null)}>
                    <Pencil className="size-4" />
                    Edit workspace
                  </Button>
                  <Button type="button" size="sm" variant="destructive" onClick={() => workspaceActions.deleteWorkspace(state.activeWorkspace!)}>
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                </div>
              ) : null}
            </div>

            {state.generationStatus ? (
              <div className="mb-4 flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
                {state.busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {state.generationStatus}
              </div>
            ) : null}

            <StudioContent />

            <WorkspaceCreateDialog
              open={state.workspaceDialogOpen}
              onOpenChange={state.setWorkspaceDialogOpen}
              formRef={state.workspaceCreateRef}
              onSubmit={workspaceActions.createWorkspace}
              busy={state.busy}
              onGenerateDraft={() => sharedActions.generateDraft("/api/workspaces/generate", state.workspaceCreateRef.current)}
            />

            <WorkspaceEditDialog
              workspace={state.editingWorkspace}
              onOpenChange={() => state.setEditingWorkspace(null)}
              formRef={state.workspaceEditRef}
              onSubmit={workspaceActions.updateWorkspace}
              busy={state.busy}
              onGenerateDraft={() => sharedActions.generateDraft(`/api/workspaces/${state.editingWorkspace?.id}/generate`, state.workspaceEditRef.current)}
            />

            <ProjectEditDialog
              project={state.editingProject}
              onOpenChange={() => { state.setEditingProject(null); state.setEditingProjectAssetIds([]); }}
              formRef={state.projectEditRef}
              onSubmit={projectActions.updateProject}
              busy={state.busy}
              onGenerateDraft={() => sharedActions.generateDraft(`/api/workspaces/${state.workspaceId}/projects/${state.editingProject?.id}/generate`, state.projectEditRef.current, { assetIds: state.editingProjectAssetIds })}
              assets={state.assets}
              editingProjectAssetIds={state.editingProjectAssetIds}
              setEditingProjectAssetIds={state.setEditingProjectAssetIds}
            />

            <SceneCreateDialog
              activeProject={state.activeProject}
              open={state.sceneDialogOpen}
              onOpenChange={state.setSceneDialogOpen}
              formRef={state.sceneCreateRef}
              onSubmit={sceneActions.createScene}
              busy={state.busy}
              onGenerateDraft={() => sharedActions.generateDraft(`/api/workspaces/${state.workspaceId}/projects/${state.projectId}/scenes/generate`, state.sceneCreateRef.current)}
              scenes={state.scenes}
              images={state.images}
              newSceneFirstFrameUrl={state.newSceneFirstFrameUrl}
              setNewSceneFirstFrameUrl={state.setNewSceneFirstFrameUrl}
              newSceneLastFrameUrl={state.newSceneLastFrameUrl}
              setNewSceneLastFrameUrl={state.setNewSceneLastFrameUrl}
              latestCompletedRenderForScene={sceneActions.latestCompletedRenderForScene}
              continueFromPreviousRender={() => sceneActions.continueFromPreviousRender()}
              onGenerateFirstFrame={() => state.openFrameGenerator("first", state.readSceneCreateDraft())}
              onGenerateLastFrame={() => state.openFrameGenerator("last", state.readSceneCreateDraft())}
            />

            <SceneEditDialog
              scene={state.editingScene}
              onOpenChange={() => state.setEditingScene(null)}
              formRef={state.sceneEditRef}
              onSubmit={sceneActions.updateScene}
              busy={state.busy}
              onGenerateDraft={() => sharedActions.generateDraft(`/api/workspaces/${state.workspaceId}/projects/${state.projectId}/scenes/${state.editingScene?.id}/generate`, state.sceneEditRef.current)}
              scenes={state.scenes}
              images={state.images}
              assets={state.assets}
              projectAssetIds={state.activeProject?.assetIds ?? []}
              latestCompletedRenderForScene={sceneActions.latestCompletedRenderForScene}
              continueFromPreviousRender={(scene) => sceneActions.continueFromPreviousRender(scene)}
              onChangeFirstFrameUrl={(url) => state.setEditingScene({ ...state.editingScene!, first_frame_url: url })}
              onChangeLastFrameUrl={(url) => state.setEditingScene({ ...state.editingScene!, last_frame_url: url })}
              onChangeAssetIds={(ids) => state.setEditingScene({ ...state.editingScene!, assetIds: ids })}
              onGenerateFirstFrame={() => state.openFrameGenerator("first", state.editingScene || undefined)}
              onGenerateLastFrame={() => state.openFrameGenerator("last", state.editingScene || undefined)}
            />

            <AssetEditDialog
              asset={state.editingAsset}
              onOpenChange={() => {
                state.setEditingAsset(null);
                if (state.routeTarget?.type === "asset") {
                  state.setRouteTarget(undefined);
                  state.changeTab("assets");
                }
              }}
              formRef={state.assetEditRef}
              onSubmit={assetActions.updateAsset}
              busy={state.busy}
              onGenerateDraft={() => sharedActions.generateDraft(`/api/workspaces/${state.workspaceId}/assets/${state.editingAsset?.id}/generate`, state.assetEditRef.current)}
              images={state.images}
              onQueueImage={state.setAssetImageReview}
              onDeleteAsset={assetActions.deleteAsset}
            />

          </section>
        </div>

        <FrameGenerator
          open={state.frameGeneratorOpen}
          onOpenChange={state.setFrameGeneratorOpen}
          workspaceId={state.workspaceId}
          projectId={state.projectId}
          sceneId={state.frameGeneratorScene?.id}
          scene={state.frameGeneratorScene}
          frameType={state.frameGeneratorType}
          images={state.images}
          assets={state.assets}
        />

        {state.assetImageReview ? (
          <GenerationReviewDialog
            key={`asset:${state.assetImageReview.id}`}
            busy={state.busy}
            images={state.images}
            assets={state.assets}
            initialValue={{
              prompt: assetActions.assetImagePrompt(state.assetImageReview),
              imageInputs: (state.assetImageReview.imageUrls ?? []).map((url) => ({ kind: "Reference", url })),
              settings: {},
            }}
            mode="image"
            open={Boolean(state.assetImageReview)}
            title={`Review Image Generation: ${state.assetImageReview.title}`}
            description="Review the raw prompt and references before the image job starts."
            onOpenChange={(open) => { if (!open) state.setAssetImageReview(null); }}
            onConfirm={(value) => {
              const asset = state.assetImageReview;
              if (!asset) return;
              state.setAssetImageReview(null);
              void assetActions.startAssetImageGeneration(asset, value);
            }}
          />
        ) : null}

        {state.videoReviewScene ? (
          <GenerationReviewDialog
            key={`video:${state.videoReviewScene.id}`}
            busy={state.busy}
            images={state.images}
            assets={state.assets}
            initialValue={{
              prompt: [
                "# Video Rendering",
                "Generate a high-quality video based on the provided cinematic context, scene details, and visual references. Maintain consistency with the character designs and environmental style described below.",
                "",
                `## Project: ${state.activeProject?.title}`,
                state.activeProject?.logline,
                "",
                `## Scene: ${state.videoReviewScene.title}`,
                state.videoReviewScene.description,
                "",
                "### Action",
                state.videoReviewScene.action || "No specific action defined.",
                "",
                "### Look",
                state.videoReviewScene.look || "No specific visual style defined.",
              ].filter(Boolean).join("\n"),
              imageInputs: [
                ...(state.videoReviewScene.first_frame_url ? [{ kind: "First Frame" as const, url: state.videoReviewScene.first_frame_url, text: state.videoReviewScene.first_frame_description }] : []),
                ...(state.videoReviewScene.last_frame_url ? [{ kind: "Last Frame" as const, url: state.videoReviewScene.last_frame_url, text: state.videoReviewScene.last_frame_description }] : []),
                ...state.assets
                  .filter((asset) => state.videoReviewScene?.assetIds?.includes(asset.id))
                  .flatMap((asset) => (asset.imageUrls ?? []).map((url: string) => ({ kind: "Reference" as const, url, assetId: asset.id, title: asset.title, text: asset.description || asset.text }))),
              ],
              settings: {},
            }}
            mode="video"
            open={Boolean(state.videoReviewScene)}
            title={`Review Video Generation: ${state.videoReviewScene.title}`}
            description="Review the raw prompt, references, and frame images before the video job starts."
            onOpenChange={(open) => { if (!open) state.setVideoReviewScene(null); }}
            onConfirm={(value) => {
              const scene = state.videoReviewScene;
              if (!scene) return;
              state.setVideoReviewScene(null);
              void sceneActions.renderScene(scene, value);
            }}
          />
        ) : null}
        
        <OngoingGenerations jobs={state.jobs} scenes={state.scenes} workspaceId={state.workspaceId} />
      </main>
      </StudioProvider>
    </ImagePreviewProvider>
  );
}
