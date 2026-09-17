import { ClipboardCheck } from 'lucide-react'
import { ModulePlaceholder } from '../../components/common/ModulePlaceholder'

export function PoliciesPage() {
  return (
    <ModulePlaceholder
      title="Políticas"
      description="Creación, asignación y seguimiento de políticas corporativas."
      icon={ClipboardCheck}
    />
  )
}