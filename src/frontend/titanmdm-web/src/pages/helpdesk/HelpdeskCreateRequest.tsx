import { useEffect, useRef, useState, type FormEvent } from 'react'
import axios from 'axios'
import apiClient from '../../api/apiClient'
import { HelpdeskRequestTemplates } from './HelpdeskRequestTemplates'

type Group = {
  id: string
  name: string
  categories: string[]
}

type Props = {
  console?: boolean
  onCreated: (id: string) => void
  onCancel: () => void
}

export function HelpdeskCreateRequest({
  console: consoleMode = false,
  onCreated,
  onCancel,
}: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [groupId, setGroupId] = useState('')
  const [category, setCategory] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('incident')
  const [assistantEnabled, setAssistantEnabled] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [recommendations, setRecommendations] = useState<string[]>([])
  const [notice, setNotice] = useState('')

  const firstInput = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLElement>(null)
  const submitting = useRef(false)
  const selected = groups.find(x => x.id === groupId)

  useEffect(() => {
    const abort = new AbortController()
    const previous = document.activeElement as HTMLElement | null

    firstInput.current?.focus()

    void apiClient
      .get<Group[]>('/my/helpdesk/request-form/groups', {
        signal: abort.signal,
      })
      .then(({ data }) => {
        if (!abort.signal.aborted) setGroups(data)
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setError(
            'No se pudieron cargar los grupos. ' +
            'Cierra y vuelve a abrir el formulario.',
          )
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })

    void apiClient
      .get<{ enabled: boolean }>('/helpdesk/operations/assistant/me', {
        signal: abort.signal,
      })
      .then(({ data }) => {
        if (!abort.signal.aborted) {
          setAssistantEnabled(data.enabled === true)
        }
      })
      .catch(() => {})

    return () => {
      abort.abort()
      previous?.focus()
    }
  }, [])

  async function suggest() {
    setSuggesting(true)
    setNotice('')
    setRecommendations([])

    try {
      const { data } = await apiClient.post<{
        suggestedSubject: string
        suggestedCategory: string
        recommendations: string[]
      }>('/my/helpdesk/assistant/suggest', {
        subject: subject.trim(),
        description: description.trim(),
      })

      setRecommendations(data.recommendations ?? [])
      setNotice(
        `Asunto sugerido: ${data.suggestedSubject || subject}. ` +
        `Categoría sugerida: ${data.suggestedCategory}. ` +
        'Revisa y selecciona el grupo correspondiente.',
      )
    } catch {
      setNotice(
        'El asistente no está disponible. ' +
        'Puedes enviar tu solicitud sin sugerencias.',
      )
    } finally {
      setSuggesting(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()

    if (
      submitting.current ||
      suggesting ||
      !selected ||
      !selected.categories.includes(category)
    ) return

    submitting.current = true
    setSaving(true)
    setError('')

    try {
      const { data } = await apiClient.post<{ id: string }>(
        '/my/helpdesk/request-form/tickets',
        {
          subject: subject.trim(),
          description: description.trim(),
          type,
          groupId,
          category,
          console: consoleMode,
        },
      )

      onCreated(data.id)
    } catch (ex) {
      setError(
        axios.isAxiosError(ex) &&
        typeof ex.response?.data?.message === 'string'
          ? ex.response.data.message
          : 'No se pudo crear la solicitud.',
      )
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <div
      className="helpdesk-inbox__overlay"
      onMouseDown={event => {
        if (
          event.target === event.currentTarget &&
          !saving &&
          !suggesting
        ) onCancel()
      }}
    >
      <section
        ref={dialog}
        className="helpdesk-inbox__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hd-create-title"
        onKeyDown={event => {
          if (event.key === 'Escape' && !saving && !suggesting) {
            onCancel()
          }

          if (event.key === 'Tab') {
            const nodes = dialog.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input:not(:disabled),' +
              'textarea:not(:disabled),select:not(:disabled),a[href]',
            )

            if (!nodes?.length) return

            const first = nodes[0]
            const last = nodes[nodes.length - 1]

            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault()
              last.focus()
            } else if (
              !event.shiftKey &&
              document.activeElement === last
            ) {
              event.preventDefault()
              first.focus()
            }
          }
        }}
      >
        <header>
          <div>
            <h2 id="hd-create-title">
              {consoleMode ? 'Nuevo ticket' : 'Nueva solicitud'}
            </h2>
            <p>
              Selecciona el grupo y una de sus categorías
              para dirigir el caso.
            </p>
          </div>

          <button
            type="button"
            aria-label="Cerrar"
            disabled={saving || suggesting}
            onClick={onCancel}
          >
            ×
          </button>
        </header>

        {error && (
          <div className="helpdesk-inbox__error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={event => void submit(event)}>
          <HelpdeskRequestTemplates
            disabled={loading || saving || suggesting}
            onApply={draft => {
              setSubject(draft.subject)
              setDescription(draft.description)
              setType(draft.ticketType)

              const matching = groups.filter(x =>
                x.categories.includes(draft.category),
              )

              const preferred =
                matching.find(x => x.id === groupId) ??
                (matching.length === 1 ? matching[0] : undefined)

              setGroupId(preferred?.id ?? '')
              setCategory(preferred ? draft.category : '')
              setNotice(
                preferred
                  ? ''
                  : 'Plantilla aplicada. Selecciona el grupo y su categoría.',
              )
            }}
          />

          {notice && <p role="status">{notice}</p>}

          <label>
            Asunto
            <input
              ref={firstInput}
              required
              maxLength={250}
              value={subject}
              disabled={saving || suggesting}
              onChange={e => setSubject(e.target.value)}
            />
          </label>

          <label>
            Descripción
            <textarea
              required
              maxLength={4000}
              rows={5}
              value={description}
              disabled={saving || suggesting}
              onChange={e => setDescription(e.target.value)}
            />
          </label>

          <div className="helpdesk-inbox__form-grid">
            <label>
              Tipo
              <select
                value={type}
                disabled={saving || suggesting}
                onChange={e => setType(e.target.value)}
              >
                <option value="incident">Incidente</option>
                <option value="request">Solicitud</option>
              </select>
            </label>

            <label>
              Grupo de trabajo
              <select
                required
                value={groupId}
                disabled={loading || saving || suggesting}
                onChange={e => {
                  setGroupId(e.target.value)
                  setCategory('')
                  setNotice('')
                }}
              >
                <option value="">
                  {loading ? 'Cargando grupos…' : 'Selecciona un grupo'}
                </option>

                {groups.map(x => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Categoría
            <select
              required
              value={category}
              disabled={
                loading ||
                saving ||
                suggesting ||
                !selected?.categories.length
              }
              onChange={e => setCategory(e.target.value)}
            >
              <option value="">Selecciona una categoría</option>

              {selected?.categories.map(x => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>

          {!loading && !groups.length && (
            <p>No hay grupos activos. TIC debe configurarlos.</p>
          )}

          {selected && !selected.categories.length && (
            <p>
              Este grupo no tiene categorías configuradas.
              TIC debe agregarlas antes de utilizarlo.
            </p>
          )}

          <p>
            La prioridad se determina desde el sistema
            o por el equipo TIC.
          </p>

          {assistantEnabled && (
            <div className="my-helpdesk__assistant">
              <button
                type="button"
                className="helpdesk-ui-button helpdesk-ui-button--secondary"
                disabled={
                  saving ||
                  suggesting ||
                  description.trim().length < 15
                }
                onClick={() => void suggest()}
              >
                {suggesting
                  ? 'Preparando sugerencia…'
                  : 'Pedir sugerencia al asistente'}
              </button>

              {recommendations.length > 0 && (
                <ul>
                  {recommendations.map((text, index) => (
                    <li key={index}>{text}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="helpdesk-inbox__dialog-actions">
            <button
              type="button"
              className="helpdesk-ui-button helpdesk-ui-button--secondary"
              disabled={saving || suggesting}
              onClick={onCancel}
            >
              Cancelar
            </button>

            <button
              className="helpdesk-ui-button helpdesk-ui-button--primary"
              disabled={
                loading ||
                saving ||
                suggesting ||
                !subject.trim() ||
                !description.trim() ||
                !selected?.categories.includes(category)
              }
            >
              {saving ? 'Creando…' : 'Crear ticket'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}