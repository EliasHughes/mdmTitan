import { AppWindow } from 'lucide-react'
import { ModulePlaceholder } from '../../components/common/ModulePlaceholder'

export function AppsPage() {
  return (
    <ModulePlaceholder
      title="Aplicaciones"
      description="Repositorio y distribución centralizada de aplicaciones empresariales."
      icon={AppWindow}
    />
  )
}