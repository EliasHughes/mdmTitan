import {
  useCallback,
  useMemo,
  useState,
} from 'react'

import { enrollmentApi } from '../../../api/enrollmentApi'

import type {
  CreatedEnrollmentToken,
  EnrollmentToken,
} from '../../../types/enrollment'

import {
  extractRequestError,
  getEffectiveTokenStatus,
} from '../utils/enrollmentFormatters'

export function useWindowsEnrollment() {
  const [
    tokens,
    setTokens,
  ] = useState<EnrollmentToken[]>([])

  const [
    expirationMinutes,
    setExpirationMinutes,
  ] = useState(60)

  const [
    maxUses,
    setMaxUses,
  ] = useState(1)

  const [
    createdToken,
    setCreatedToken,
  ] =
    useState<CreatedEnrollmentToken | null>(
      null,
    )

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    creating,
    setCreating,
  ] = useState(false)

  const [
    copied,
    setCopied,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState<string | null>(null)

  const [
    success,
    setSuccess,
  ] = useState<string | null>(null)

  const windowsTokens =
    useMemo(
      () =>
        tokens.filter(
          (token) =>
            token.platform === 'Windows',
        ),
      [tokens],
    )

  const statistics =
    useMemo(
      () => ({
        total: windowsTokens.length,

        active:
          windowsTokens.filter(
            (token) =>
              getEffectiveTokenStatus(
                token.status,
                token.expiresAtUtc,
              ) === 'Active',
          ).length,

        expired:
          windowsTokens.filter(
            (token) =>
              getEffectiveTokenStatus(
                token.status,
                token.expiresAtUtc,
              ) === 'Expired',
          ).length,

        revoked:
          windowsTokens.filter(
            (token) =>
              token.status === 'Revoked',
          ).length,
      }),
      [windowsTokens],
    )

  const loadTokens =
    useCallback(async () => {
      try {
        setLoading(true)
        setError(null)

        const response =
          await enrollmentApi.getTokens()

        setTokens(response)
      } catch (requestError) {
        console.error(requestError)

        setError(
          extractRequestError(
            requestError,
            'No fue posible cargar las credenciales Windows.',
          ),
        )
      } finally {
        setLoading(false)
      }
    }, [])

  const createToken =
    useCallback(async () => {
      if (
        maxUses < 1 ||
        maxUses > 1000
      ) {
        setError(
          'Los usos permitidos deben estar entre 1 y 1000.',
        )

        return
      }

      try {
        setCreating(true)
        setError(null)
        setSuccess(null)
        setCreatedToken(null)
        setCopied(false)

        const response =
          await enrollmentApi.createToken({
            platform: 'Windows',
            expirationMinutes,
            maxUses,
          })

        setCreatedToken(response)

        setSuccess(
          'La credencial Windows fue creada correctamente.',
        )

        await loadTokens()
      } catch (requestError) {
        console.error(requestError)

        setError(
          extractRequestError(
            requestError,
            'No fue posible crear la credencial Windows.',
          ),
        )
      } finally {
        setCreating(false)
      }
    }, [
      expirationMinutes,
      maxUses,
      loadTokens,
    ])

  const revokeToken =
    useCallback(
      async (
        token: EnrollmentToken,
      ) => {
        const effectiveStatus =
          getEffectiveTokenStatus(
            token.status,
            token.expiresAtUtc,
          )

        if (effectiveStatus !== 'Active') {
          return
        }

        const confirmed =
          window.confirm(
            '¿Deseas revocar esta credencial Windows?',
          )

        if (!confirmed) {
          return
        }

        try {
          setError(null)
          setSuccess(null)

          await enrollmentApi.revokeToken(
            token.id,
          )

          setSuccess(
            'La credencial Windows fue revocada.',
          )

          await loadTokens()
        } catch (requestError) {
          console.error(requestError)

          setError(
            extractRequestError(
              requestError,
              'No fue posible revocar la credencial Windows.',
            ),
          )
        }
      },
      [loadTokens],
    )

  const copyToken =
    useCallback(async () => {
      if (!createdToken) {
        return
      }

      try {
        await navigator.clipboard.writeText(
          createdToken.token,
        )

        setCopied(true)

        window.setTimeout(
          () => setCopied(false),
          2500,
        )
      } catch (copyError) {
        console.error(copyError)

        setError(
          'No fue posible copiar la credencial Windows.',
        )
      }
    }, [createdToken])

  return {
    tokens: windowsTokens,
    statistics,

    expirationMinutes,
    setExpirationMinutes,

    maxUses,
    setMaxUses,

    createdToken,

    loading,
    creating,
    copied,

    error,
    success,

    loadTokens,
    createToken,
    revokeToken,
    copyToken,
  }
}

export type WindowsEnrollmentController =
  ReturnType<typeof useWindowsEnrollment>