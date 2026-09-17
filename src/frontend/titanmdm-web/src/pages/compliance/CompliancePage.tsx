import { BadgeCheck } from 'lucide-react'
import { ModulePlaceholder } from '../../components/common/ModulePlaceholder'

export function CompliancePage() {
  return (
    <ModulePlaceholder
      title="Cumplimiento"
      description="Evaluación centralizada del cumplimiento de dispositivos y políticas."
      icon={BadgeCheck}
    />
  )
}