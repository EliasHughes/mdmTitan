import { useEffect, useRef, useState } from 'react'
import { tokenStorage } from '../auth/tokenStorage'
import type { LoginResponse } from '../types/auth'

export function EntraLoginCallbackPage() {
  const started = useRef(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (started.current) return
    started.current = true

    async function finishLogin() {
      try {
        const response = await fetch('/api/auth/entra/exchange', {
          method: 'POST',
          credentials: 'same-origin',
        })

        if (!response.ok) {
          const payload = await response
            .json()
            .catch(() => null) as
              | { message?: string }
              | null

          throw new Error(
            payload?.message ??
              'No se pudo completar el ingreso con Microsoft.',
          )
        }

        const session =
          await response.json() as LoginResponse

        tokenStorage.setTokens(
          session.accessToken,
          session.refreshToken,
        )

        window.location.replace('/')
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'No se pudo completar el ingreso.',
        )
      }
    }

    void finishLogin()
  }, [])

  return (
    <main
      className="titan-page"
      style={{
        maxWidth: 560,
        margin: '80px auto',
        padding: 28,
        border: '1px solid #dfe6f3',
        borderRadius: 18,
        background: '#fff',
      }}
    >
      <h1>Ingreso con Microsoft</h1>

      {error ? (
        <>
          <p role="alert">{error}</p>
          <a href="/login">Volver al inicio de sesión</a>
        </>
      ) : (
        <p>Comprobando tu acceso a TitanMDM…</p>
      )}
    </main>
  )
}