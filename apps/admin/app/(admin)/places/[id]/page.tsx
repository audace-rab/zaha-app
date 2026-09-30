import { notFound, redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import PlaceForm from '../components/PlaceForm';

export default async function EditPlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) {
    redirect('/login');
  }

  const { data: place } = await admin.supabase
    .from('places')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!place) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">
        Modifier « {place.name} »
      </h1>
      <PlaceForm initialPlace={place} />
    </div>
  );
}
