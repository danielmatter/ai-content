import { StudioApp } from "@/components/studio/studio-app";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function WorkspaceDashboardPage({ params }: Props) {
  const { workspaceId } = await params;
  return <StudioApp key={workspaceId} initialWorkspaceId={workspaceId} />;
}
