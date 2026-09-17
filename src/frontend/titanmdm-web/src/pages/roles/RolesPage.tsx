import { UserCog } from 'lucide-react'
import { ModulePlaceholder } from '../../components/common/ModulePlaceholder'

export function RolesPage() {
  return (
    <ModulePlaceholder
      title="Roles y permisos"
      description="Administración del modelo RBAC y permisos de acceso a la plataforma."
      icon={UserCog}
    />
  )
}