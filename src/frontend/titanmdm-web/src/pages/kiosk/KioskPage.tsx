import { PanelsTopLeft } from 'lucide-react'
import { ModulePlaceholder } from '../../components/common/ModulePlaceholder'

export function KioskPage() {
  return (
    <ModulePlaceholder
      title="Kiosk"
      description="Configuración y administración de dispositivos dedicados y modo kiosco."
      icon={PanelsTopLeft}
    />
  )
}