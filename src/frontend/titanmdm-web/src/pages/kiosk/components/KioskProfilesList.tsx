import {
  CheckCircle2,
  PanelsTopLeft,
} from 'lucide-react'

import type {
  Policy,
} from '../../../api/policiesApi'

interface Props {
  loading:
    boolean

  profiles:
    Policy[]

  selectedId:
    string

  onSelect:
    (
      policy:
        Policy,
    ) => void
}

export function KioskProfilesList({
  loading,
  profiles,
  selectedId,
  onSelect,
}: Props) {
  return (
    <section className="kiosk-profiles">
      <div className="kiosk-section-title">
        <div>
          <PanelsTopLeft
            size={18}
          />

          <strong>
            Perfiles existentes
          </strong>
        </div>
      </div>

      {loading ? (
        <div className="kiosk-empty">
          Cargando...
        </div>
      ) : profiles.length ===
        0 ? (
        <div className="kiosk-empty">
          No existen perfiles Kiosk.
        </div>
      ) : (
        profiles.map(
          profile => (
            <button
              type="button"
              className={
                profile.id ===
                selectedId
                  ? 'kiosk-profile selected'
                  : 'kiosk-profile'
              }
              key={profile.id}
              onClick={() =>
                onSelect(
                  profile,
                )
              }
            >
              <div className="kiosk-profile-icon">
                <PanelsTopLeft
                  size={20}
                />
              </div>

              <div>
                <strong>
                  {profile.name}
                </strong>

                <span>
                  {profile.description
                  ??
                  'Sin descripción'}
                </span>

                <small>
                  Versión{' '}
                  {profile.currentVersion}
                  {' · '}
                  {profile.assignedDevices}
                  {' dispositivos'}
                </small>
              </div>

              <div className="kiosk-profile-status">
                <CheckCircle2
                  size={14}
                />

                {profile.status}
              </div>
            </button>
          ),
        )
      )}
    </section>
  )
}