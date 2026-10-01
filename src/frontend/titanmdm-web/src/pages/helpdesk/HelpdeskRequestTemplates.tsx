import { useEffect, useState } from 'react'
import axios from 'axios'

import apiClient from '../../api/apiClient'
import { useAuth } from '../../auth/AuthContext'
import { HelpdeskCategorySelect } from './HelpdeskCategorySelect'

import './HelpdeskRequestTemplates.css'

interface Draft {
  subject: string
  description: string
  category: string
  ticketType: 'incident' | 'request'
}

interface Props {
  disabled?: boolean
  onApply: (draft: Draft) => void
}

interface Template {
  id: string
  title: string
  description: string
  category: string
  ticketType: 'incident' | 'request'
  questions: string[]
  isActive: boolean
  revision: number
}

const empty = (): Template => ({
  id: '',
  title: '',
  description: '',
  category: 'general',
  ticketType: 'incident',
  questions: ['¿Qué necesitas resolver?'],
  isActive: true,
  revision: 0,
})

function message(error: unknown) {
  return axios.isAxiosError(error) &&
    typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : 'No se pudo completar la operación. Comprueba que ' +
        'el backend y la migración estén disponibles.'
}

export function HelpdeskRequestTemplates({
  disabled = false,
  onApply,
}: Props) {
  const { hasPermission } = useAuth()

  const manager =
    hasPermission('helpdesk.manage') ||
    hasPermission('settings.manage')

  const [items, setItems] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [managing, setManaging] = useState(false)
  const [editor, setEditor] = useState<Template | null>(null)

  const [selected, setSelected] =
    useState<string | null>(null)

  const [subject, setSubject] = useState('')

  const [answers, setAnswers] =
    useState<Record<string, string>>({})

  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)

    void apiClient
      .get<{ items: Template[] }>(
        '/my/helpdesk/templates',
        { signal: controller.signal },
      )
      .then(result => {
        if (!controller.signal.aborted) {
          setItems(result.data.items)
        }
      })
      .catch(ex => {
        if (!controller.signal.aborted) {
          setError(message(ex))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [])

  async function load(all: boolean): Promise<boolean> {
    setLoading(true)
    setError('')

    try {
      const result =
        await apiClient.get<{ items: Template[] }>(
          '/my/helpdesk/templates',
          { params: { all } },
        )

      setItems(result.data.items)
      return true
    } catch (ex) {
      setError(message(ex))
      return false
    } finally {
      setLoading(false)
    }
  }

  async function switchMode(all: boolean) {
    if (await load(all)) {
      setManaging(all)
      setSelected(null)
      setEditor(null)
      setConfirm(false)
      setSuccess('')
    }
  }

  async function save() {
    if (!editor || saving) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        ...editor,
        questions: editor.questions
          .map(x => x.trim())
          .filter(Boolean),
      }

      if (editor.id) {
        await apiClient.put(
          `/my/helpdesk/templates/${editor.id}`,
          payload,
        )
      } else {
        await apiClient.post(
          '/my/helpdesk/templates',
          payload,
        )
      }

      setEditor(null)

      if (await load(true)) {
        setSuccess(
          'Plantilla guardada. Las plantillas activas ' +
            'están disponibles para los usuarios.',
        )
      }
    } catch (ex) {
      setError(message(ex))
    } finally {
      setSaving(false)
    }
  }

  const template = items.find(
    item => item.id === selected && item.isActive,
  )

  const description =
    template?.questions
      .map(
        (question, index) =>
          `${question}: ${
            (
              answers[`${selected}-${index}`] ?? ''
            ).trim()
          }`,
      )
      .join('\n\n') ?? ''

  const complete =
    !!template &&
    !!subject.trim() &&
    description.length <= 4000 &&
    template.questions.every(
      (_, index) =>
        !!answers[`${selected}-${index}`]?.trim(),
    )

  const locked = disabled || saving || loading

  return (
    <section
      className="hrt"
      aria-label="Catálogo de plantillas"
    >
      <div className="hrt-heading">
        <div>
          <h3>
            {managing
              ? 'Administrar plantillas'
              : '¿En qué podemos ayudarte?'}
          </h3>

          <p>
            {managing
              ? 'Configura categoría, tipo, preguntas y disponibilidad.'
              : 'Utiliza una plantilla o completa el formulario directamente.'}
          </p>
        </div>

        {manager && (
          <button
            type="button"
            className="helpdesk-ui-button"
            disabled={locked}
            onClick={() => void switchMode(!managing)}
          >
            {managing
              ? 'Volver al catálogo'
              : 'Administrar plantillas'}
          </button>
        )}
      </div>

      {error && (
        <p className="hrt-error" role="alert">
          {error}
        </p>
      )}

      {success && <p role="status">{success}</p>}

      {loading && (
        <p role="status">Cargando catálogo…</p>
      )}

      {!loading && managing && (
        <>
          <button
            type="button"
            className="helpdesk-ui-button"
            disabled={locked}
            onClick={() => {
              setEditor(empty())
              setSuccess('')
            }}
          >
            Crear plantilla
          </button>

          <div className="hrt-grid">
            {items.map(item => (
              <button
                type="button"
                key={item.id}
                className="hrt-card"
                disabled={locked}
                onClick={() => {
                  setEditor({
                    ...item,
                    questions: [...item.questions],
                  })
                  setSuccess('')
                }}
              >
                <strong>{item.title}</strong>
                <span>
                  {item.category} ·{' '}
                  {item.ticketType === 'request'
                    ? 'Solicitud'
                    : 'Incidente'}{' '}
                  · {item.isActive ? 'Activa' : 'Desactivada'}
                </span>
              </button>
            ))}
          </div>

          {editor && (
            <div className="hrt-fields">
              <label>
                Título
                <input
                  maxLength={100}
                  disabled={locked}
                  value={editor.title}
                  onChange={event =>
                    setEditor({
                      ...editor,
                      title: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Descripción breve
                <textarea
                  maxLength={300}
                  rows={2}
                  disabled={locked}
                  value={editor.description}
                  onChange={event =>
                    setEditor({
                      ...editor,
                      description: event.target.value,
                    })
                  }
                />
              </label>

              <HelpdeskCategorySelect
                key={editor.id || 'new'}
                id="hrt-editor-category"
                value={editor.category}
                onChange={category =>
                  setEditor(current =>
                    current
                      ? { ...current, category }
                      : null,
                  )
                }
                disabled={locked}
              />

              <label>
                Tipo
                <select
                  value={editor.ticketType}
                  disabled={locked}
                  onChange={event =>
                    setEditor({
                      ...editor,
                      ticketType:
                        event.target.value === 'request'
                          ? 'request'
                          : 'incident',
                    })
                  }
                >
                  <option value="incident">Incidente</option>
                  <option value="request">
                    Solicitud de servicio
                  </option>
                </select>
              </label>

              <label>
                Preguntas: una por línea, máximo 8
                <textarea
                  rows={6}
                  maxLength={1000}
                  disabled={locked}
                  value={editor.questions.join('\n')}
                  onChange={event =>
                    setEditor({
                      ...editor,
                      questions:
                        event.target.value.split('\n'),
                    })
                  }
                />
              </label>

              <label className="hrt-checkbox">
                <input
                  type="checkbox"
                  disabled={locked}
                  checked={editor.isActive}
                  onChange={event =>
                    setEditor({
                      ...editor,
                      isActive: event.target.checked,
                    })
                  }
                />
                Disponible para los usuarios
              </label>

              <div>
                <button
                  type="button"
                  className="helpdesk-ui-button helpdesk-ui-button--primary"
                  disabled={
                    locked ||
                    editor.title.trim().length < 3
                  }
                  onClick={() => void save()}
                >
                  {saving
                    ? 'Guardando…'
                    : 'Guardar plantilla'}
                </button>

                <button
                  type="button"
                  className="helpdesk-ui-button"
                  disabled={locked}
                  onClick={() => setEditor(null)}
                >
                  Cancelar edición
                </button>

                <button
                  type="button"
                  className="helpdesk-ui-button"
                  disabled={locked}
                  onClick={() => {
                    setEditor(null)
                    void load(true)
                  }}
                >
                  Actualizar catálogo
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {!loading && !managing && (
        <>
          {!items.length && (
            <p>
              No hay plantillas activas. Puedes crear tu
              solicitud con el formulario habitual.
            </p>
          )}

          <div className="hrt-grid">
            {items
              .filter(item => item.isActive)
              .map(item => (
                <button
                  type="button"
                  key={item.id}
                  disabled={locked}
                  aria-pressed={selected === item.id}
                  className={
                    selected === item.id
                      ? 'hrt-card hrt-card--selected'
                      : 'hrt-card'
                  }
                  onClick={() => {
                    setSelected(item.id)
                    setConfirm(false)
                  }}
                >
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </button>
              ))}
          </div>

          {template && (
            <div className="hrt-fields">
              <label htmlFor="hrt-subject">
                Asunto
                <input
                  id="hrt-subject"
                  maxLength={250}
                  value={subject}
                  disabled={locked}
                  onChange={event => {
                    setSubject(event.target.value)
                    setConfirm(false)
                  }}
                />
              </label>

              {template.questions.map(
                (question, index) => (
                  <label
                    key={`${selected}-${index}`}
                    htmlFor={`hrt-field-${index}`}
                  >
                    {question}
                    <textarea
                      id={`hrt-field-${index}`}
                      rows={2}
                      maxLength={800}
                      disabled={locked}
                      value={
                        answers[`${selected}-${index}`] ?? ''
                      }
                      onChange={event => {
                        const value = event.target.value

                        setAnswers(current => ({
                          ...current,
                          [`${selected}-${index}`]: value,
                        }))

                        setConfirm(false)
                      }}
                    />
                  </label>
                ),
              )}

              <small>
                {description.length}/4000 caracteres.
                No incluyas contraseñas.
              </small>

              {!confirm ? (
                <button
                  type="button"
                  className="helpdesk-ui-button"
                  disabled={locked || !complete}
                  onClick={() => setConfirm(true)}
                >
                  Preparar datos
                </button>
              ) : (
                <div className="hrt-confirm">
                  <p>
                    Se reemplazarán el asunto, descripción,
                    categoría y tipo del formulario.
                    Podrás revisarlos antes de enviar.
                  </p>

                  <button
                    type="button"
                    className="helpdesk-ui-button helpdesk-ui-button--primary"
                    disabled={locked || !complete}
                    onClick={() => {
                      onApply({
                        subject: subject.trim(),
                        description,
                        category: template.category,
                        ticketType: template.ticketType,
                      })

                      setSelected(null)
                      setConfirm(false)
                    }}
                  >
                    Aplicar plantilla
                  </button>

                  <button
                    type="button"
                    className="helpdesk-ui-button"
                    disabled={locked}
                    onClick={() => setConfirm(false)}
                  >
                    Volver
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}