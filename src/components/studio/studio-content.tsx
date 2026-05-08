import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ProjectDetail } from "./project-detail";
import { ProjectList } from "./project-list";
import { AssetList } from "./asset-list";
import { AssetCreateDialog } from "./asset-create-dialog";
import { ImageLibrary } from "./image-library";
import { JobsTab } from "./jobs-tab";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ProjectCreateDialog } from "./dialogs/project-dialogs";
import { useStudio } from "./studio-context";

export function StudioContent() {
  const {
    state,
    projectActions,
    assetActions,
    sharedActions,
    assetCreateTypes,
  } = useStudio();
  const activeImageId = state.routeTarget?.type === "image" ? state.routeTarget.id : "";
  const activeJobId = state.routeTarget?.type === "job" ? state.routeTarget.id : "";

  return (
    <Tabs value={state.activeTab} onValueChange={state.changeTab} className="grid gap-4">
      <TabsContent value="projects" className="grid gap-4">
        {!state.projectDetailOpen || !state.activeProject ? (
          <section className="grid gap-3">
            <div className="flex flex-row items-center justify-between gap-3">
              <h3 className="text-base font-medium">Projects in {state.activeWorkspace?.name ?? "workspace"}</h3>
              <Button size="sm" disabled={!state.workspaceId} onClick={() => state.setProjectDialogOpen(true)}>
                <Plus className="size-4 mr-1" />
                New
              </Button>
            </div>
            <ProjectList
              projects={state.projects}
              onOpenProject={state.openProject}
              onEditProject={projectActions.openProjectEditor}
              onDeleteProject={projectActions.deleteProject}
            />
          </section>
        ) : (
          <ProjectDetail />
        )}
        <ProjectCreateDialog
          workspaceId={state.workspaceId}
          activeWorkspace={state.activeWorkspace}
          open={state.projectDialogOpen}
          onOpenChange={state.setProjectDialogOpen}
          formRef={state.projectCreateRef}
          onSubmit={projectActions.createProject}
          busy={state.busy}
          onGenerateDraft={() =>
            sharedActions.generateDraft(`/api/workspaces/${state.workspaceId}/projects/generate`, state.projectCreateRef.current, {
              assetIds: state.newProjectAssetIds,
            })
          }
          assets={state.assets}
          newProjectAssetIds={state.newProjectAssetIds}
          setNewProjectAssetIds={state.setNewProjectAssetIds}
        />
      </TabsContent>

      <TabsContent value="assets" className="grid gap-4">
        <div className="flex flex-wrap justify-end gap-2">
          {assetCreateTypes.map((assetType) => (
            <AssetCreateDialog
              key={assetType}
              assetType={assetType}
              busy={state.busy}
              images={state.images}
              open={state.assetDialogType === assetType}
              workspaceId={state.workspaceId}
              onGenerateDraft={(form: HTMLFormElement | null, type: string) =>
                sharedActions.generateDraft(`/api/workspaces/${state.workspaceId}/assets/generate`, form, { assetType: type })
              }
              onOpenChange={(open: boolean) => state.setAssetDialogType(open ? assetType : null)}
              onSubmit={assetActions.createAsset}
            />
          ))}
        </div>

        <AssetList
          groupedAssets={state.groupedAssets}
          images={state.images}
          onOpenAsset={state.openAsset}
          onEditAsset={state.openAsset}
          onDeleteAsset={assetActions.deleteAsset}
        />
      </TabsContent>

      <TabsContent value="images" className="grid gap-4">
        <ImageLibrary
          images={state.images}
          workspaceId={state.workspaceId}
          busy={state.busy}
          activeImageId={activeImageId}
          onOpenImage={state.openImage}
          onUpload={sharedActions.uploadImage}
        />
      </TabsContent>

      <TabsContent value="jobs" className="grid gap-4">
        <JobsTab
          jobs={state.jobs}
          scenes={state.scenes}
          activeJobId={activeJobId}
          onOpenJob={state.openJob}
          onRenderScene={state.setVideoReviewScene}
        />
      </TabsContent>
    </Tabs>
  );
}
