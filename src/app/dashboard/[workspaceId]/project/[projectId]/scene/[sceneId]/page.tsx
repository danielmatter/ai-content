import { StudioApp } from "@/components/studio/studio-app";

type Props = {
  params: Promise<{ workspaceId: string; projectId: string; sceneId: string }>;
};

export default async function SceneDashboardPage({ params }: Props) {
  const { workspaceId, projectId, sceneId } = await params;

  return (
    <StudioApp
      key={`${workspaceId}:project:${projectId}:scene:${sceneId}`}
      initialWorkspaceId={workspaceId}
      initialRoute={{ type: "scene", projectId, sceneId }}
    />
  );
}
