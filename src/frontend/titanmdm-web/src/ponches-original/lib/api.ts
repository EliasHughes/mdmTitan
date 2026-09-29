import apiClient from '../../api/apiClient'

export async function authFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!path.startsWith('/api/')) {
    throw new Error('Ruta inválida de Ponches')
  }

  const target = '/ponches/legacy/' + path.slice('/api/'.length)

  try {
    const result = await apiClient.request<ArrayBuffer>({
      url: target,
      method: init.method ?? 'GET',
      data: init.body,
      headers: init.headers
        ? Object.fromEntries(new Headers(init.headers))
        : undefined,
      responseType: 'arraybuffer',
      validateStatus: () => true,
    })

    const headers = new Headers()

    if (result.headers['content-type']) {
      headers.set(
        'content-type',
        String(result.headers['content-type']),
      )
    }

    if (result.headers['content-disposition']) {
      headers.set(
        'content-disposition',
        String(result.headers['content-disposition']),
      )
    }

    return new Response(
      result.status === 204 ? null : result.data,
      {
        status: result.status,
        headers,
      },
    )
  } catch (error) {
    throw new Error(
      'No se pudo conectar con el servicio de Ponches',
      { cause: error },
    )
  }
}