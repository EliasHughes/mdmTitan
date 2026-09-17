import { ShieldCheck } from 'lucide-react'
import { ModulePlaceholder } from '../../components/common/ModulePlaceholder'

export function SecurityPage() {
  return (
    <ModulePlaceholder
      title="Seguridad"
      description="Supervisión de la postura de seguridad de los dispositivos administrados."
      icon={ShieldCheck}
    />
  )
}