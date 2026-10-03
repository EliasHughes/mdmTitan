import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import axios from 'axios'

import apiClient from '../../api/apiClient'

import './HelpdeskRequestTemplates.css'

export interface HelpdeskTemplateDraft {
  subject: string
  description: string
  category: string
  ticketType: 'incident' | 'request'
}

interface Props {
  disabled?: boolean
  onApply: (draft: HelpdeskTemplateDraft) => void
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

function getMessage(error: unknown) {
  return axios.isAxiosError(error) &&
    typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : 'No se pudieron cargar las plantillas.'
}

export function HelpdeskRequestTemplates({
  disabled = false,
  onApply,
}: Props) {
  const [items, setItems] =
    useState<Template[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [selectedId, setSelectedId] =
    useState('')

  const [subject, setSubject] =
    useState('')

  const [answers, setAnswers] =
    useState<Record<number, string>>({})

  useEffect(() => {
    const controller =
      new AbortController()

    setLoading(true)
    setError('')

    void apiClient
      .get<{ items: Template[] }>(
        '/my/helpdesk/templates',
        {
          signal: controller.signal,
        },
      )
      .then(result => {
        if (
          controller
            .signal
            .aborted
        ) return

        const active =
          result.data.items
            .filter(
              item =>
                item.isActive,
            )
            .sort(
              (
                left,
                right,
              ) =>
                left.title.localeCompare(
                  right.title,
                  'es',
                ),
            )

        setItems(active)
      })
      .catch(exception => {
        if (
          controller
            .signal
            .aborted
        ) return

        setError(
          getMessage(
            exception,
          ),
        )
      })
      .finally(() => {
        if (
          !controller
            .signal
            .aborted
        ) {
          setLoading(false)
        }
      })

    return () =>
      controller.abort()
  }, [])

  const selected =
    useMemo(
      () =>
        items.find(
          item =>
            item.id ===
            selectedId,
        ),
      [
        items,
        selectedId,
      ],
    )

  const preparedDescription =
    useMemo(() => {
      if (!selected) {
        return ''
      }

      return selected.questions
        .map(
          (
            question,
            index,
          ) => {
            const answer =
              (
                answers[
                  index
                ] ?? ''
              ).trim()

            return (
              `${question}\n` +
              `${answer}`
            )
          },
        )
        .join(
          '\n\n',
        )
        .trim()
    }, [
      answers,
      selected,
    ])

  const complete =
    !!selected &&
    subject.trim().length >
      0 &&
    selected.questions.every(
      (
        _,
        index,
      ) =>
        !!answers[
          index
        ]?.trim(),
    ) &&
    preparedDescription.length <=
      4000

  function selectTemplate(
    id: string,
  ) {
    setSelectedId(
      id,
    )

    setSubject('')
    setAnswers({})
  }

  function apply() {
    if (
      !selected ||
      !complete
    ) return

    onApply({
      subject:
        subject.trim(),

      description:
        preparedDescription,

      category:
        selected.category,

      ticketType:
        selected.ticketType,
    })

    setSelectedId('')
    setSubject('')
    setAnswers({})
  }

  /*
   * IMPORTANTE:
   *
   * Si no hay plantillas activas
   * no renderizamos absolutamente nada.
   *
   * El usuario no debe ver:
   * - mensajes vacíos
   * - paneles innecesarios
   * - botones administrativos
   */
  if (
    !loading &&
    !error &&
    items.length === 0
  ) {
    return null
  }

  /*
   * Un fallo del catálogo
   * tampoco debe impedir
   * crear un ticket manualmente.
   */
  if (
    !loading &&
    error
  ) {
    return null
  }

  if (loading) {
    return null
  }

  return (
    <section
      className="hrt hrt--compact"
      aria-label="Plantilla opcional"
    >
      <label
        className="hrt-template-selector"
        htmlFor="helpdesk-template"
      >
        <span>
          Plantilla opcional
        </span>

        <select
          id="helpdesk-template"
          disabled={disabled}
          value={selectedId}
          onChange={event =>
            selectTemplate(
              event.target.value,
            )
          }
        >
          <option value="">
            Sin plantilla
          </option>

          {items.map(
            item => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.title}
              </option>
            ),
          )}
        </select>
      </label>

      {selected && (
        <div
          className="hrt-template-panel"
        >
          {selected.description && (
            <p
              className="hrt-template-description"
            >
              {selected.description}
            </p>
          )}

          <label>
            Asunto
            <input
              maxLength={250}
              disabled={disabled}
              value={subject}
              placeholder={
                selected.title
              }
              onChange={event =>
                setSubject(
                  event.target.value,
                )
              }
            />
          </label>

          {selected.questions.map(
            (
              question,
              index,
            ) => (
              <label
                key={
                  `${selected.id}-${index}`
                }
              >
                {question}

                <textarea
                  rows={2}
                  maxLength={800}
                  disabled={
                    disabled
                  }
                  value={
                    answers[
                      index
                    ] ?? ''
                  }
                  onChange={event =>
                    setAnswers(
                      current => ({
                        ...current,

                        [index]:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                />
              </label>
            ),
          )}

          <div
            className="hrt-template-footer"
          >
            <small>
              {
                preparedDescription
                  .length
              }
              /4000 caracteres
            </small>

            <button
              type="button"
              className={
                'helpdesk-ui-button ' +
                'helpdesk-ui-button--primary'
              }
              disabled={
                disabled ||
                !complete
              }
              onClick={
                apply
              }
            >
              Aplicar plantilla
            </button>
          </div>
        </div>
      )}
    </section>
  )
}