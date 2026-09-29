import { useState, type FormEvent } from 'react'
import apiClient from '../../api/apiClient'

interface ChatResponse {
  answer: string
  availableActions: string[]
  module: string
}

interface ChatLine {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  firstName: string
  module: string
  onClose: () => void
}

export function TitanAgentChatPanel({
  firstName,
  module,
  onClose,
}: Props) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [lines, setLines] = useState<ChatLine[]>([])
  const [error, setError] = useState('')

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const message = input.trim()
    if (!message || sending) return

    setInput('')
    setError('')
    setSending(true)

    setLines((current) => [
      ...current,
      { role: 'user', content: message },
    ])

    try {
      const response = await apiClient.post<ChatResponse>(
        '/virtual-agent/chat',
        { message, module },
      )

      setLines((current) => [
        ...current,
        {
          role: 'assistant',
          content: response.data.answer,
        },
      ])
    } catch {
      setError(
        'No pude responder ahora. Comprueba que Ollama esté habilitado.',
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <section
      className="titan-chat-preview"
      data-titan-blocking="true"
      aria-label="Conversación con Titan"
    >
      <div className="titan-chat-preview__header">
        <div>
          <strong>Titan Assistant</strong>
          <span>{firstName} · {module}</span>
        </div>

        <button
          type="button"
          aria-label="Cerrar conversación"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div
        className="titan-chat-preview__body"
        role="log"
        aria-live="polite"
        style={{
          maxHeight: 280,
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
        }}
      >
        {lines.length === 0 && (
          <p>
            Hola, {firstName}. Puedo orientarte según tu sesión
            y las herramientas que tengas autorizadas.
          </p>
        )}

        {lines.map((line, index) => (
          <p key={`${line.role}-${index}`}>
            <strong>
              {line.role === 'user' ? 'Tú' : 'Titan'}:
            </strong>{' '}
            {line.content}
          </p>
        ))}

        {sending && <p>Titan está preparando la respuesta…</p>}
        {error && <p role="alert">{error}</p>}
      </div>

      <form
        onSubmit={(event) => void send(event)}
        style={{
          display: 'flex',
          gap: 8,
          padding: 12,
        }}
      >
        <input
          aria-label="Mensaje para Titan"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          maxLength={1500}
          placeholder="Escribe tu consulta…"
          style={{
            flex: 1,
            minWidth: 0,
          }}
        />

        <button
          type="submit"
          disabled={sending || !input.trim()}
        >
          Enviar
        </button>
      </form>
    </section>
  )
}