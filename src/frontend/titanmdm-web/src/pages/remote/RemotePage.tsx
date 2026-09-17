import { RadioTower } from 'lucide-react'
import { ModulePlaceholder } from '../../components/common/ModulePlaceholder'

export function RemotePage() {
  return (
    <ModulePlaceholder
      title="Soporte remoto"
      description="Centro de operaciones y asistencia remota para endpoints administrados."
      icon={RadioTower}
    />
  )
}