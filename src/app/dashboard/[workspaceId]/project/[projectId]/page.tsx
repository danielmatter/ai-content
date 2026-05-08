import { StudioApp } from "@/components/studio/studio-app";

type Props = {
  params: Promise<{ workspaceId: string; projectId: string }>;
};

export default async function ProjectDashboardPage({ params }: Props) {
  const { workspaceId, projectId } = await params;

  return (
    <StudioApp
      key={`${workspaceId}:project:${projectId}`}
      initialWorkspaceId={workspaceId}
      initialRoute={{ type: "project", id: projectId }}
    />
  );
}
