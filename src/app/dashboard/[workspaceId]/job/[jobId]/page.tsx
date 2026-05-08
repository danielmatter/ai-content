import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ workspaceId: string; jobId: string }>;
};

export default async function JobDashboardPage({ params }: Props) {
  const { workspaceId, jobId } = await params;

  redirect(`/dashboard/${workspaceId}/render-jobs/${jobId}`);
}
