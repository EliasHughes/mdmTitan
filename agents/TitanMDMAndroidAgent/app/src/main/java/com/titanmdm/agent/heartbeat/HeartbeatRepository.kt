package com.titanmdm.agent.heartbeat

import android.content.Context
import com.titanmdm.agent.core.config.AgentConfig
import com.titanmdm.agent.core.network.DeviceHeartbeatRequest
import com.titanmdm.agent.core.network.TitanApiClient
import com.titanmdm.agent.core.storage.AgentIdentityStore
import com.titanmdm.agent.inventory.DeviceInventoryProvider

sealed interface HeartbeatResult {

    data object Success :
        HeartbeatResult

    data object NotEnrolled :
        HeartbeatResult

    data class Failure(
        val message: String,
        val retryable: Boolean
    ) : HeartbeatResult
}

class HeartbeatRepository(
    context: Context
) {

    private val appContext =
        context.applicationContext

    private val identityStore =
        AgentIdentityStore(appContext)

    private val inventoryProvider =
        DeviceInventoryProvider(appContext)

    suspend fun send(): HeartbeatResult {

        val identity =
            identityStore.get()
                ?: return HeartbeatResult.NotEnrolled

        return try {

            val inventory =
                inventoryProvider.collect()

            val response =
                TitanApiClient.service.heartbeat(
                    DeviceHeartbeatRequest(
                        deviceId =
                            identity.deviceId,

                        deviceSecret =
                            identity.deviceSecret,

                        ipAddress =
                            inventory.ipAddress,

                        batteryLevel =
                            inventory.batteryLevel,

                        agentVersion =
                            AgentConfig.agentVersion,

                        operatingSystemVersion =
                            inventory.operatingSystemVersion
                    )
                )

            when {

                response.isSuccessful ->
                    HeartbeatResult.Success

                response.code() in 500..599 ->
                    HeartbeatResult.Failure(
                        message =
                            "TitanMDM API HTTP ${response.code()}",
                        retryable = true
                    )

                else ->
                    HeartbeatResult.Failure(
                        message =
                            "Heartbeat rechazado HTTP ${response.code()}",
                        retryable = false
                    )
            }

        } catch (exception: Exception) {

            HeartbeatResult.Failure(
                message =
                    exception.message
                        ?: "Error de comunicación.",
                retryable = true
            )
        }
    }
}