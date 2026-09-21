package com.titanmdm.agent.core.network

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.PATCH
import retrofit2.http.Path

interface TitanApiService {

    /*
     * Registro inicial del agente.
     *
     * La ruta se validará contra el contrato definitivo del backend
     * TitanMDM antes de realizar la prueba end-to-end.
     */
    @POST("api/device/register")
    suspend fun registerDevice(
        @Body request: RegisterDeviceRequest
    ): Response<RegisterDeviceResponse>

    /*
     * Heartbeat autenticado del dispositivo.
     */
    @POST("api/device/heartbeat")
    suspend fun heartbeat(
        @Header("X-Device-Id") deviceId: String,
        @Header("X-Device-Secret") deviceSecret: String,
        @Body request: HeartbeatRequest
    ): Response<HeartbeatResponse>

    /*
     * Recuperación de comandos pendientes.
     */
    @GET("api/device/commands")
    suspend fun getPendingCommands(
        @Header("X-Device-Id") deviceId: String,
        @Header("X-Device-Secret") deviceSecret: String
    ): Response<List<DeviceCommandDto>>

    /*
     * Actualización del estado de un comando.
     */
    @PATCH("api/device/commands/{commandId}/status")
    suspend fun updateCommandStatus(
        @Path("commandId") commandId: String,
        @Header("X-Device-Id") deviceId: String,
        @Header("X-Device-Secret") deviceSecret: String,
        @Body request: CommandStatusRequest
    ): Response<ApiMessageResponse>
}