import PlaceForm from '../components/PlaceForm';

export default function NewPlacePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Nouveau lieu</h1>
      <PlaceForm />
    </div>
  );
}
