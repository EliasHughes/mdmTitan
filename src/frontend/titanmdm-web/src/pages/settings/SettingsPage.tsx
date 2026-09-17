import { Settings } from 'lucide-react'
import { ModulePlaceholder } from '../../components/common/ModulePlaceholder'

export function SettingsPage() {
  return (
    <ModulePlaceholder
      title="Configuración"
      description="Parámetros globales y configuración administrativa de TitanMDM."
      icon={Settings}
    />
  )
}