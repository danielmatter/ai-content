import { StudioApp } from "@/components/studio/studio-app";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function WorkspaceRenderJobsPage({ params }: Props) {
  const { workspaceId } = await params;

  return <StudioApp key={`${workspaceId}:render-jobs`} initialWorkspaceId={workspaceId} initialTab="jobs" />;
}
