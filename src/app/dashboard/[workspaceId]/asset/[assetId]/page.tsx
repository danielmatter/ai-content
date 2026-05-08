import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ workspaceId: string; assetId: string }>;
};

export default async function AssetDashboardPage({ params }: Props) {
  const { workspaceId, assetId } = await params;

  redirect(`/dashboard/${workspaceId}/assets/${assetId}`);
}
