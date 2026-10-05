import axios, { type AxiosResponse } from 'axios'
import apiClient from '../../../api/apiClient'

function asResponse(
  result: AxiosResponse<ArrayBuffer>,
): Response {
  const headers = new Headers()

  for (const name of [
    'content-type',
    'content-disposition',
    'retry-after',
  ]) {
    const value = result.headers[name]

    if (value != null) {
      headers.set(name, String(value))
    }
  }

  const empty = [204, 205, 304].includes(result.status)

  return new Response(
    empty ? null : result.data,
    {
      status: result.status,
      statusText: result.statusText,
      headers,
    },
  )
}

export async function authFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (
    !path.startsWith('/api/') ||
    path.startsWith('/api//')
  ) {
    throw new Error('Ruta invÃ¡lida de Ponches')
  }

  const relative = path.slice('/api/'.length)

  const parsed = new URL(
    relative,
    'https://titan.invalid/',
  )

  const invalidSegments = relative
    .split('?')[0]
    .split('/')
    .some(part => part === '..' || part === '.')

  if (
    parsed.origin !== 'https://titan.invalid' ||
    invalidSegments
  ) {
    throw new Error('Ruta invÃ¡lida de Ponches')
  }

  const headers = new Headers(init.headers)

  // La identidad proviene de la sesiÃ³n de TitanMDM.
  headers.delete('Authorization')

  const form =
    typeof FormData !== 'undefined' &&
    init.body instanceof FormData

  const raw =
    typeof Blob !== 'undefined' &&
    init.body instanceof Blob

  const contentType =
    headers.get('Content-Type') ??
    (form || raw ? null : 'application/json')

  try {
    const result =
      await apiClient.request<ArrayBuffer>({
        url: '/ponches/legacy/' + relative,
        method: init.method ?? 'GET',
        data: init.body,

        headers: {
          ...Object.fromEntries(headers),
          'Content-Type': contentType,
        },

        responseType: 'arraybuffer',
        timeout: 200_000,
        signal: init.signal ?? undefined,

        // Axios mantiene su manejo normal de errores.
        // AsÃ­ el interceptor puede renovar la sesiÃ³n ante 401.
      })

    return asResponse(result)
  } catch (error) {
    if (
      axios.isAxiosError<ArrayBuffer>(error) &&
      error.response
    ) {
      const response = asResponse(error.response)

      try {
        const text = await response.clone().text()

        const data = JSON.parse(text) as {
          detail?: unknown
          message?: string
        }

        // Las pantallas originales utilizan "detail".
        if (!data.detail && data.message) {
          return new Response(
            JSON.stringify({
              ...data,
              detail: data.message,
            }),
            {
              status: response.status,
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )
        }
      } catch {
        // Exportaciones y algunos errores pueden no ser JSON.
      }

      return response
    }

    if (axios.isCancel(error)) {
      throw error
    }

    throw new Error(
      'No se pudo conectar con Ponches. ' +
      'Revisa que TitanMDM estÃ© activo.',
      {
        cause: error,
      },
    )
  }
}