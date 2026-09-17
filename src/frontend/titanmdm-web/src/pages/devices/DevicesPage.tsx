import { MonitorSmartphone } from 'lucide-react'
import { ModulePlaceholder } from '../../components/common/ModulePlaceholder'

export function DevicesPage() {
  return (
    <ModulePlaceholder
      title="Dispositivos"
      description="Inventario centralizado de dispositivos Android y Windows administrados por TitanMDM."
      icon={MonitorSmartphone}
    />
  )
}