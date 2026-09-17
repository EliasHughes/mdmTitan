import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'

import axios from 'axios'

import {
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom'

import {
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  Monitor,
} from 'lucide-react'

import { useAuth } from '../auth/AuthContext'

interface LocationState {
  from?: string
}

export function LoginPage() {
  const {
    login,
    isAuthenticated,
  } = useAuth()

  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] =
    useState('')

  const [password, setPassword] =
    useState('')

  const [
    showPassword,
    setShowPassword,
  ] = useState(false)

  const [error, setError] =
    useState('')

  const [isSubmitting, setIsSubmitting] =
    useState(false)

  useEffect(() => {
    document.title =
      'Iniciar sesión | TitanMDM'
  }, [])

  if (isAuthenticated) {
    return (
      <Navigate
        to="/"
        replace
      />
    )
  }

  const handleSubmit =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault()

      setError('')

      const normalizedEmail =
        email.trim().toLowerCase()

      if (
        !normalizedEmail ||
        !password
      ) {
        setError(
          'Ingresa tu correo electrónico y contraseña.',
        )

        return
      }

      setIsSubmitting(true)

      try {
        await login({
          email: normalizedEmail,
          password,
        })

        const state =
          location.state as
            | LocationState
            | null

        navigate(
          state?.from || '/',
          {
            replace: true,
          },
        )
      } catch (requestError) {
        if (axios.isAxiosError(
          requestError,
        )) {
          if (
            requestError.response
              ?.status === 401
          ) {
            setError(
              'Correo electrónico o contraseña incorrectos.',
            )
          } else if (
            !requestError.response
          ) {
            setError(
              'No fue posible conectar con el servidor TitanMDM.',
            )
          } else {
            setError(
              'No fue posible iniciar sesión. Inténtalo nuevamente.',
            )
          }
        } else {
          setError(
            'Ocurrió un error inesperado.',
          )
        }
      } finally {
        setIsSubmitting(false)
      }
    }

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="login-brand__content">
          <div className="brand">
            <div className="brand__mark">
              T
            </div>

            <div>
              <strong>
                TitanMDM
              </strong>

              <span>
                Enterprise
              </span>
            </div>
          </div>

          <div className="login-brand__hero">
            <span className="eyebrow">
              Unified Endpoint Management
            </span>

            <h1>
              Control empresarial.
              <br />
              Seguridad centralizada.
            </h1>

            <p>
              Administra dispositivos
              Android y Windows desde una
              plataforma segura,
              centralizada y preparada
              para crecer.
            </p>

            <div className="platforms">
              <div>
                <Smartphone size={20} />
                Android
              </div>

              <div>
                <Monitor size={20} />
                Windows
              </div>

              <div>
                <ShieldCheck size={20} />
                Seguridad
              </div>
            </div>
          </div>

          <div className="login-brand__footer">
            TitanMDM Enterprise
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-card__mobile-brand">
            <div className="brand__mark">
              T
            </div>

            <strong>
              TitanMDM
            </strong>
          </div>

          <div className="login-card__heading">
            <div className="login-icon">
              <LockKeyhole size={23} />
            </div>

            <h2>
              Bienvenido
            </h2>

            <p>
              Ingresa tus credenciales
              para acceder a la consola.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="login-form"
          >
            <label>
              Correo electrónico

              <input
                type="email"
                value={email}
                autoComplete="username"
                placeholder="usuario@empresa.com"
                disabled={isSubmitting}
                onChange={(event) =>
                  setEmail(
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Contraseña

              <div className="password-field">
                <input
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={password}
                  autoComplete="current-password"
                  placeholder="Ingresa tu contraseña"
                  disabled={isSubmitting}
                  onChange={(event) =>
                    setPassword(
                      event.target.value,
                    )
                  }
                />

                <button
                  type="button"
                  className="password-toggle"
                  aria-label={
                    showPassword
                      ? 'Ocultar contraseña'
                      : 'Mostrar contraseña'
                  }
                  onClick={() =>
                    setShowPassword(
                      (current) =>
                        !current,
                    )
                  }
                >
                  {showPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>
            </label>

            {error && (
              <div
                className="login-error"
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Verificando...'
                : 'Iniciar sesión'}
            </button>
          </form>

          <div className="login-security">
            <ShieldCheck size={17} />

            <span>
              Acceso protegido por
              TitanMDM Security
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}