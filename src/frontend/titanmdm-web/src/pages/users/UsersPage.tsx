import { Users } from 'lucide-react'
import { ModulePlaceholder } from '../../components/common/ModulePlaceholder'

export function UsersPage() {
  return (
    <ModulePlaceholder
      title="Usuarios"
      description="Administración de cuentas con acceso a la consola TitanMDM."
      icon={Users}
    />
  )
}