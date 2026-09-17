import { FileBarChart } from 'lucide-react'
import { ModulePlaceholder } from '../../components/common/ModulePlaceholder'

export function ReportsPage() {
  return (
    <ModulePlaceholder
      title="Reportes"
      description="Informes operativos, de inventario, seguridad y cumplimiento."
      icon={FileBarChart}
    />
  )
}