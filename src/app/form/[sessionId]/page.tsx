import { notFound } from 'next/navigation';
import { PatientForm } from '@/components/form/PatientForm';
import { isValidSessionId } from '@/lib/realtime/events';

export default async function PatientFormPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const normalised = decodeURIComponent(sessionId).toUpperCase();
  if (!isValidSessionId(normalised)) notFound();
  return <PatientForm sessionId={normalised} />;
}
