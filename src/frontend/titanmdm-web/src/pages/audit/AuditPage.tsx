import { ScrollText } from 'lucide-react'
import { ModulePlaceholder } from '../../components/common/ModulePlaceholder'

export function AuditPage() {
  return (
    <ModulePlaceholder
      title="Auditoría"
      description="Trazabilidad de acciones administrativas y eventos críticos de TitanMDM."
      icon={ScrollText}
    />
  )
}