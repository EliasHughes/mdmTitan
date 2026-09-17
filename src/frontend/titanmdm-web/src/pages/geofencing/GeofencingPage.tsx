import { MapPinned } from 'lucide-react'
import { ModulePlaceholder } from '../../components/common/ModulePlaceholder'

export function GeofencingPage() {
  return (
    <ModulePlaceholder
      title="Geofencing"
      description="Administración de zonas geográficas y reglas asociadas a dispositivos."
      icon={MapPinned}
    />
  )
}