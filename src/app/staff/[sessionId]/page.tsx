import { StaffDashboard } from '@/components/staff/StaffDashboard';

export default async function StaffSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <StaffDashboard focusSessionId={decodeURIComponent(sessionId).toUpperCase()} />;
}
