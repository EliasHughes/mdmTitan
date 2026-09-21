package com.titanmdm.agent.commands.handlers

import android.content.Context
import com.titanmdm.agent.apps.AppInventoryProvider
import com.titanmdm.agent.commands.CommandExecutionResult
import com.titanmdm.agent.core.network.DeviceCommandDto
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class AppInventoryCommandHandler(
    context: Context
) : CommandHandler {

    private val applicationContext =
        context.applicationContext

    private val inventoryProvider =
        AppInventoryProvider(
            applicationContext
        )

    private val json =
        Json {
            encodeDefaults = true
            explicitNulls = false
            ignoreUnknownKeys = true
        }

    override fun supports(
        commandType: String
    ): Boolean {

        return commandType.equals(
            "APP_INVENTORY",
            ignoreCase = true
        )
    }

    override suspend fun execute(
        command: DeviceCommandDto
    ): CommandExecutionResult {

        return try {

            val applications =
                inventoryProvider.collect()

            val applicationsJson =
                json.encodeToString(
                    applications
                )

            val result =
                buildJsonObject {

                    put(
                        "commandId",
                        command.commandId
                    )

                    put(
                        "commandType",
                        command.commandType
                    )

                    put(
                        "platform",
                        "Android"
                    )

                    put(
                        "applicationCount",
                        applications.size
                    )

                    put(
                        "applications",
                        applicationsJson
                    )
                }

            CommandExecutionResult.Success(
                resultJson =
                    result.toString()
            )

        } catch (exception: Exception) {

            CommandExecutionResult.Failure(
                errorCode =
                    "APP_INVENTORY_FAILED",

                errorMessage =
                    exception.message
                        ?: "No fue posible obtener el inventario de aplicaciones Android."
            )
        }
    }
}