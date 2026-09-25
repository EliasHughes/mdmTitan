import {
  Clock3,
} from 'lucide-react'

import type {
  SoftwareDeployment,
} from '../../../api/applicationsApi'

interface Props {
  deployments:
    SoftwareDeployment[]
}

export function SoftwareDeploymentsTab({
  deployments,
}: Props) {
  return (
    <div className="apps-table-wrapper">
      <table className="apps-table">
        <thead>
          <tr>
            <th>
              Software
            </th>

            <th>
              Versión
            </th>

            <th>
              Destino
            </th>

            <th>
              Tipo
            </th>

            <th>
              Equipos
            </th>

            <th>
              Estado
            </th>

            <th>
              Fecha
            </th>
          </tr>
        </thead>

        <tbody>
          {deployments.length ===
          0 ? (
            <tr>
              <td
                colSpan={7}
                className="apps-empty"
              >
                No hay deployments.
              </td>
            </tr>
          ) : (
            deployments.map(
              item => (
                <tr
                  key={item.id}
                >
                  <td>
                    <strong>
                      {item.packageName}
                    </strong>
                  </td>

                  <td>
                    {
                      item
                        .packageVersion
                    }
                  </td>

                  <td>
                    {item.targetName}
                  </td>

                  <td>
                    <span className="apps-target-badge">
                      {
                        item
                          .targetType
                      }
                    </span>
                  </td>

                  <td>
                    {
                      item
                        .queuedDevices
                    }
                  </td>

                  <td>
                    <span
                      className={
                        `apps-deployment-status ${item.status.toLowerCase()}`
                      }
                    >
                      {item.status}
                    </span>
                  </td>

                  <td>
                    <span className="apps-date-cell">
                      <Clock3
                        size={13}
                      />

                      {new Date(
                        item.createdAtUtc,
                      )
                        .toLocaleString()}
                    </span>
                  </td>
                </tr>
              ),
            )
          )}
        </tbody>
      </table>
    </div>
  )
}