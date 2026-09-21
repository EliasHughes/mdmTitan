package com.titanmdm.agent.core.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/*
 * ============================================================
 * TITANMDM ANDROID AGENT
 * API CONTRACT MODELS
 * ============================================================
 *
 * Estos modelos reflejan los contratos actuales del backend
 * TitanMDM.
 *
 * IMPORTANTE:
 * - Nunca registrar deviceSecret en logs.
 * - Nunca persistir enrollmentToken después del registro.
 * ============================================================
 */


/* ============================================================
 * DEVICE REGISTRATION
 *
 * Backend:
 * POST /api/enrollment/register
 * ============================================================ */

@Serializable
data class RegisterDeviceRequest(

    @SerialName("enrollmentToken")
    val enrollmentToken: String,

    @SerialName("deviceName")
    val deviceName: String,

    @SerialName("platform")
    val platform: String,

    @SerialName("serialNumber")
    val serialNumber: String,

    @SerialName("manufacturer")
    val manufacturer: String? = null,

    @SerialName("model")
    val model: String? = null,

    @SerialName("operatingSystem")
    val operatingSystem: String? = null,

    @SerialName("operatingSystemVersion")
    val operatingSystemVersion: String? = null,

    @SerialName("agentVersion")
    val agentVersion: String? = null,

    @SerialName("ipAddress")
    val ipAddress: String? = null,

    @SerialName("macAddress")
    val macAddress: String? = null
)


@Serializable
data class RegisterDeviceResponse(

    @SerialName("deviceId")
    val deviceId: String,

    @SerialName("organizationId")
    val organizationId: String,

    @SerialName("deviceName")
    val deviceName: String,

    @SerialName("platform")
    val platform: String,

    @SerialName("status")
    val status: String,

    @SerialName("complianceStatus")
    val complianceStatus: String,

    @SerialName("isManaged")
    val isManaged: Boolean,

    @SerialName("enrolledAtUtc")
    val enrolledAtUtc: String,

    @SerialName("deviceSecret")
    val deviceSecret: String
)


/* ============================================================
 * HEARTBEAT
 *
 * Backend:
 * POST /api/device/heartbeat
 * ============================================================ */

@Serializable
data class HeartbeatRequest(

    @SerialName("deviceId")
    val deviceId: String,

    @SerialName("deviceSecret")
    val deviceSecret: String,

    @SerialName("ipAddress")
    val ipAddress: String? = null,

    @SerialName("batteryLevel")
    val batteryLevel: Int? = null,

    @SerialName("agentVersion")
    val agentVersion: String? = null,

    @SerialName("operatingSystemVersion")
    val operatingSystemVersion: String? = null
)


@Serializable
data class HeartbeatResponse(

    @SerialName("deviceId")
    val deviceId: String,

    @SerialName("status")
    val status: String,

    @SerialName("complianceStatus")
    val complianceStatus: String,

    @SerialName("serverTimeUtc")
    val serverTimeUtc: String,

    @SerialName("lastSeenAtUtc")
    val lastSeenAtUtc: String? = null
)


/* ============================================================
 * DEVICE COMMANDS
 * ============================================================ */

@Serializable
data class DeviceCommandDto(

    @SerialName("id")
    val id: String,

    @SerialName("commandType")
    val commandType: String,

    @SerialName("payload")
    val payload: String? = null,

    @SerialName("status")
    val status: String? = null,

    @SerialName("createdAtUtc")
    val createdAtUtc: String? = null,

    @SerialName("expiresAtUtc")
    val expiresAtUtc: String? = null,

    @SerialName("priority")
    val priority: Int? = null
)


/* ============================================================
 * COMMAND SUCCESS
 * ============================================================ */

@Serializable
data class CommandSuccessRequest(

    @SerialName("resultJson")
    val resultJson: String? = null
)


/* ============================================================
 * COMMAND FAILURE
 * ============================================================ */

@Serializable
data class CommandFailedRequest(

    @SerialName("errorCode")
    val errorCode: String,

    @SerialName("errorMessage")
    val errorMessage: String,

    @SerialName("resultJson")
    val resultJson: String? = null
)


/* ============================================================
 * GENERIC API RESPONSE
 * ============================================================ */

@Serializable
data class ApiMessageResponse(

    @SerialName("message")
    val message: String? = null
)