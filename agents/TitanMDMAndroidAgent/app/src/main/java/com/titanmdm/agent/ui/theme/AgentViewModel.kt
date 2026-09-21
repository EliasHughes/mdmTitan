package com.titanmdm.agent.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.titanmdm.agent.core.config.AgentConfig
import com.titanmdm.agent.core.storage.AgentIdentity
import com.titanmdm.agent.core.storage.AgentIdentityStore
import com.titanmdm.agent.enrollment.registration.RegistrationRepository
import com.titanmdm.agent.enrollment.registration.RegistrationResult
import com.titanmdm.agent.heartbeat.HeartbeatRepository
import com.titanmdm.agent.heartbeat.HeartbeatResult
import com.titanmdm.agent.inventory.DeviceInventoryProvider
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AgentUiState(
    val loading: Boolean = true,
    val registering: Boolean = false,
    val synchronizing: Boolean = false,
    val enrolled: Boolean = false,
    val enrollmentToken: String = "",
    val identity: AgentIdentity? = null,
    val deviceName: String = "",
    val manufacturer: String = "",
    val model: String = "",
    val androidVersion: String = "",
    val apiLevel: Int = 0,
    val serialNumber: String = "",
    val batteryLevel: Int? = null,
    val ipAddress: String? = null,
    val agentVersion: String = AgentConfig.AGENT_VERSION,
    val lastHeartbeatStatus: String = "Sin sincronizar",
    val message: String? = null,
    val error: String? = null
)

class AgentViewModel(
    application: Application
) : AndroidViewModel(application) {

    private val appContext =
        application.applicationContext

    private val identityStore =
        AgentIdentityStore(appContext)

    private val registrationRepository =
        RegistrationRepository(appContext)

    private val heartbeatRepository =
        HeartbeatRepository(appContext)

    private val inventoryProvider =
        DeviceInventoryProvider(appContext)

    private val _uiState =
        MutableStateFlow(AgentUiState())

    val uiState: StateFlow<AgentUiState> =
        _uiState.asStateFlow()

    init {
        loadState()
    }

    fun updateEnrollmentToken(value: String) {
        _uiState.value =
            _uiState.value.copy(
                enrollmentToken = value,
                error = null,
                message = null
            )
    }

    fun loadState() {
        viewModelScope.launch {

            _uiState.value =
                _uiState.value.copy(
                    loading = true,
                    error = null
                )

            try {
                val inventory =
                    inventoryProvider.collect()

                val identity =
                    identityStore.get()

                _uiState.value =
                    _uiState.value.copy(
                        loading = false,
                        enrolled = identity != null,
                        identity = identity,
                        deviceName =
                            identity?.deviceName
                                ?: inventory.deviceName,
                        manufacturer =
                            inventory.manufacturer,
                        model =
                            inventory.model,
                        androidVersion =
                            inventory.operatingSystemVersion,
                        apiLevel =
                            inventory.apiLevel,
                        serialNumber =
                            inventory.serialNumber,
                        batteryLevel =
                            inventory.batteryLevel,
                        ipAddress =
                            inventory.ipAddress
                    )

            } catch (exception: Exception) {

                _uiState.value =
                    _uiState.value.copy(
                        loading = false,
                        error =
                            exception.message
                                ?: "No fue posible cargar el estado del agente."
                    )
            }
        }
    }

    fun register() {

        val token =
            _uiState.value.enrollmentToken.trim()

        if (token.isBlank()) {
            _uiState.value =
                _uiState.value.copy(
                    error =
                        "Introduce un token de inscripción."
                )
            return
        }

        if (_uiState.value.registering) {
            return
        }

        viewModelScope.launch {

            _uiState.value =
                _uiState.value.copy(
                    registering = true,
                    error = null,
                    message = null
                )

            when (
                val result =
                    registrationRepository.register(token)
            ) {

                is RegistrationResult.Success -> {

                    _uiState.value =
                        _uiState.value.copy(
                            registering = false,
                            enrolled = true,
                            enrollmentToken = "",
                            identity = result.identity,
                            deviceName =
                                result.identity.deviceName,
                            message =
                                "Dispositivo inscrito correctamente en TitanMDM.",
                            error = null
                        )

                    sendHeartbeat()
                }

                is RegistrationResult.Failure -> {

                    _uiState.value =
                        _uiState.value.copy(
                            registering = false,
                            error = result.message
                        )
                }
            }
        }
    }

    fun sendHeartbeat() {

        if (_uiState.value.synchronizing) {
            return
        }

        viewModelScope.launch {

            _uiState.value =
                _uiState.value.copy(
                    synchronizing = true,
                    error = null,
                    message = null
                )

            when (
                val result =
                    heartbeatRepository.send()
            ) {

                HeartbeatResult.Success -> {

                    _uiState.value =
                        _uiState.value.copy(
                            synchronizing = false,
                            lastHeartbeatStatus =
                                "Sincronizado correctamente",
                            message =
                                "TitanMDM recibió el heartbeat del dispositivo."
                        )
                }

                HeartbeatResult.NotEnrolled -> {

                    _uiState.value =
                        _uiState.value.copy(
                            synchronizing = false,
                            enrolled = false,
                            identity = null,
                            lastHeartbeatStatus =
                                "Dispositivo no inscrito",
                            error =
                                "El dispositivo todavía no está inscrito."
                        )
                }

                is HeartbeatResult.Failure -> {

                    _uiState.value =
                        _uiState.value.copy(
                            synchronizing = false,
                            lastHeartbeatStatus =
                                "Error de sincronización",
                            error = result.message
                        )
                }
            }
        }
    }

    fun refresh() {
        loadState()
    }
}