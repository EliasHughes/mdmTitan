import axios, {
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios'

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

  const empty = [204, 205, 304].includes(
    result.status,
  )

  return new Response(
    empty
      ? null
      : result.data,
    {
      status: result.status,
      statusText: result.statusText,
      headers,
    },
  )
}

function validateApiPath(
  path: string,
): string {
  if (
    !path.startsWith('/api/') ||
    path.startsWith('/api//')
  ) {
    throw new Error(
      'Ruta inválida de Ponches',
    )
  }

  const relative =
    path.slice('/api/'.length)

  const parsed =
    new URL(
      relative,
      'https://titan.invalid/',
    )

  const invalidSegments =
    relative
      .split('?')[0]
      .split('/')
      .some(
        part =>
          part === '..' ||
          part === '.',
      )

  if (
    parsed.origin !==
      'https://titan.invalid' ||
    invalidSegments
  ) {
    throw new Error(
      'Ruta inválida de Ponches',
    )
  }

  return relative
}

async function execute(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const headers =
    new Headers(
      init.headers,
    )

  /*
   * Nunca permitimos que una pantalla
   * inyecte manualmente otro JWT.
   *
   * apiClient utiliza la sesión normal
   * de TitanMDM.
   */
  headers.delete(
    'Authorization',
  )

  const form =
    typeof FormData !==
      'undefined' &&
    init.body instanceof
      FormData

  const raw =
    typeof Blob !==
      'undefined' &&
    init.body instanceof
      Blob

  const contentType =
    headers.get(
      'Content-Type',
    ) ??
    (
      form || raw
        ? null
        : 'application/json'
    )

  const config: AxiosRequestConfig = {
  url,

  method:
    init.method ??
    'GET',

  /*
   * RequestInit.body puede ser:
   *
   * string
   * Blob
   * FormData
   * ArrayBuffer
   * ReadableStream
   * null
   *
   * AxiosRequestConfig no debe restringirse a ArrayBuffer.
   * ArrayBuffer se utiliza solamente como tipo de RESPUESTA.
   */
  data:
    init.body ??
    undefined,

  headers: {
    ...Object.fromEntries(
      headers,
    ),

    ...(contentType
      ? {
          'Content-Type':
            contentType,
        }
      : {}),
  },

  responseType:
    'arraybuffer',

  timeout:
    200_000,

  signal:
    init.signal ??
    undefined,
}
 

  try {
    const result =
      await apiClient
        .request<ArrayBuffer>(
          config,
        )

    return asResponse(
      result,
    )
  } catch (error) {
    if (
      axios.isAxiosError<ArrayBuffer>(
        error,
      ) &&
      error.response
    ) {
      const response =
        asResponse(
          error.response,
        )

      try {
        const text =
          await response
            .clone()
            .text()

        const data =
          JSON.parse(
            text,
          ) as {
            detail?: unknown
            message?: string
            code?: string
          }

        /*
         * Las pantallas heredadas
         * esperaban "detail".
         *
         * Lo conservamos mientras
         * terminamos F3-F9.
         */
        if (
          !data.detail &&
          data.message
        ) {
          return new Response(
            JSON.stringify({
              ...data,
              detail:
                data.message,
            }),
            {
              status:
                response.status,

              headers: {
                'Content-Type':
                  'application/json',
              },
            },
          )
        }
      } catch {
        /*
         * Exportaciones PDF/Excel,
         * descargas y algunos errores
         * no necesariamente son JSON.
         */
      }

      return response
    }

    if (
      axios.isCancel(
        error,
      )
    ) {
      throw error
    }

    throw new Error(
      'No se pudo conectar con TitanMDM.',
      {
        cause:
          error,
      },
    )
  }
}

/**
 * API empresarial TitanMDM.
 *
 * Usar para las rutas definitivas:
 *
 * /api/ponches/dashboard
 * /api/ponches/records
 * /api/ponches/device-health
 * /api/ponches/health
 */
export async function titanFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  validateApiPath(
    path,
  )

  if (
    !path.startsWith(
      '/api/ponches/',
    )
  ) {
    throw new Error(
      'titanFetch solamente admite endpoints de /api/ponches.',
    )
  }

  return execute(
    path.replace(
      /^\/api/,
      '',
    ),
    init,
  )
}

/**
 * Bridge temporal para las pantallas
 * heredadas del sistema original.
 *
 * F3-F9 irán eliminando gradualmente
 * estas llamadas.
 */
export async function authFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const relative =
    validateApiPath(
      path,
    )

  return execute(
    '/ponches/legacy/' +
      relative,
    init,
  )
}