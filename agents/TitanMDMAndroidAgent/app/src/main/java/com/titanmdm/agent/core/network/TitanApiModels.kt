package com.titanmdm.agent.core.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/*
 * ============================================================
 * TITANMDM ANDROID AGENT - API CONTRACT MODELS
 * ============================================================
 *
 * Modelos utilizados para la comunicación entre:
 *
 * TitanMDM Android Agent
 *          |
 *          v
 * TitanMDM ASP.NET Core API
 *
 * No almacenar secretos de dispositivo en logs.
 * ============================================================
 */


/* ============================================================
 * REGISTRATION
 * ============================================================ */

@Serializable
data class RegisterDeviceRequest(

    @SerialName("enrollmentToken")
    val enrollmentToken: String,

    @SerialName("deviceName")
    val deviceName: String,

    @SerialName("platform")
    val platform: String = "Android",

    @SerialName("serialNumber")
    val serialNumber: String? = null,

    @SerialName("manufacturer")
    val manufacturer: String? = null,

    @SerialName("model")
    val model: String? = null,

    @SerialName("operatingSystem")
    val operatingSystem: String = "Android",

    @SerialName("operatingSystemVersion")
    val operatingSystemVersion: String? = null,

    @SerialName("agentVersion")
    val agentVersion: String,

    @SerialName("ipAddress")
    val ipAddress: String? = null,

    @SerialName("androidId")
    val androidId: String? = null,

    @SerialName("apiLevel")
    val apiLevel: Int? = null,

    @SerialName("securityPatch")
    val securityPatch: String? = null,

    @SerialName("hardware")
    val hardware: String? = null,

    @SerialName("board")
    val board: String? = null,

    @SerialName("bootloader")
    val bootloader: String? = null,

    @SerialName("buildNumber")
    val buildNumber: String? = null,

    @SerialName("device")
    val device: String? = null,

    @SerialName("product")
    val product: String? = null
)


@Serializable
data class RegisterDeviceResponse(

    @SerialName("deviceId")
    val deviceId: String,

    @SerialName("deviceSecret")
    val deviceSecret: String,

    @SerialName("organizationId")
    val organizationId: String? = null,

    @SerialName("deviceName")
    val deviceName: String? = null,

    @SerialName("registeredAtUtc")
    val registeredAtUtc: String? = null,

    @SerialName("message")
    val message: String? = null
)


/* ============================================================
 * HEARTBEAT
 * ============================================================ */

@Serializable
data class HeartbeatRequest(

    @SerialName("deviceId")
    val deviceId: String,

    @SerialName("deviceSecret")
    val deviceSecret: String,

    @SerialName("agentVersion")
    val agentVersion: String,

    @SerialName("batteryLevel")
    val batteryLevel: Int? = null,

    @SerialName("ipAddress")
    val ipAddress: String? = null,

    @SerialName("operatingSystemVersion")
    val operatingSystemVersion: String? = null,

    @SerialName("apiLevel")
    val apiLevel: Int? = null,

    @SerialName("securityPatch")
    val securityPatch: String? = null,

    @SerialName("manufacturer")
    val manufacturer: String? = null,

    @SerialName("model")
    val model: String? = null,

    @SerialName("serialNumber")
    val serialNumber: String? = null
)


@Serializable
data class HeartbeatResponse(

    @SerialName("success")
    val success: Boolean = true,

    @SerialName("message")
    val message: String? = null,

    @SerialName("serverTimeUtc")
    val serverTimeUtc: String? = null,

    @SerialName("nextHeartbeatSeconds")
    val nextHeartbeatSeconds: Long? = null
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
 * COMMAND STATUS
 * ============================================================ */

@Serializable
data class CommandStatusRequest(

    @SerialName("deviceId")
    val deviceId: String,

    @SerialName("deviceSecret")
    val deviceSecret: String,

    @SerialName("status")
    val status: String,

    @SerialName("result")
    val result: String? = null,

    @SerialName("error")
    val error: String? = null,

    @SerialName("executedAtUtc")
    val executedAtUtc: String? = null
)


/* ============================================================
 * GENERIC API RESPONSE
 * ============================================================ */

@Serializable
data class ApiMessageResponse(

    @SerialName("success")
    val success: Boolean = true,

    @SerialName("message")
    val message: String? = null
)


/* ============================================================
 * DEVICE INVENTORY
 * ============================================================ */

@Serializable
data class DeviceInventoryRequest(

    @SerialName("deviceId")
    val deviceId: String,

    @SerialName("deviceSecret")
    val deviceSecret: String,

    @SerialName("deviceName")
    val deviceName: String,

    @SerialName("manufacturer")
    val manufacturer: String? = null,

    @SerialName("model")
    val model: String? = null,

    @SerialName("serialNumber")
    val serialNumber: String? = null,

    @SerialName("operatingSystem")
    val operatingSystem: String = "Android",

    @SerialName("operatingSystemVersion")
    val operatingSystemVersion: String? = null,

    @SerialName("apiLevel")
    val apiLevel: Int? = null,

    @SerialName("securityPatch")
    val securityPatch: String? = null,

    @SerialName("agentVersion")
    val agentVersion: String,

    @SerialName("ipAddress")
    val ipAddress: String? = null,

    @SerialName("androidId")
    val androidId: String? = null,

    @SerialName("hardware")
    val hardware: String? = null,

    @SerialName("board")
    val board: String? = null,

    @SerialName("bootloader")
    val bootloader: String? = null,

    @SerialName("buildNumber")
    val buildNumber: String? = null,

    @SerialName("batteryLevel")
    val batteryLevel: Int? = null
)


/* ============================================================
 * AGENT STATUS
 * ============================================================ */

@Serializable
data class AgentStatusResponse(

    @SerialName("registered")
    val registered: Boolean = false,

    @SerialName("deviceId")
    val deviceId: String? = null,

    @SerialName("organizationId")
    val organizationId: String? = null,

    @SerialName("serverTimeUtc")
    val serverTimeUtc: String? = null
)