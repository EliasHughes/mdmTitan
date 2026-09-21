package com.titanmdm.agent.workers

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.titanmdm.agent.core.config.AgentConfig
import java.util.concurrent.TimeUnit

object AgentWorkScheduler {

    fun schedule(
        context: Context
    ) {

        val appContext =
            context.applicationContext

        scheduleHeartbeat(
            appContext
        )

        scheduleCommands(
            appContext
        )
    }

    private fun networkConstraints():
            Constraints {

        return Constraints.Builder()
            .setRequiredNetworkType(
                NetworkType.CONNECTED
            )
            .build()
    }

    private fun scheduleHeartbeat(
        context: Context
    ) {

        val request =
            PeriodicWorkRequestBuilder<
                    HeartbeatWorker
                    >(
                AgentConfig
                    .HEARTBEAT_INTERVAL_MINUTES,

                TimeUnit.MINUTES
            )
                .setConstraints(
                    networkConstraints()
                )
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    30,
                    TimeUnit.SECONDS
                )
                .build()

        WorkManager
            .getInstance(context)
            .enqueueUniquePeriodicWork(
                AgentConfig
                    .HEARTBEAT_WORK_NAME,

                ExistingPeriodicWorkPolicy.UPDATE,

                request
            )
    }

    private fun scheduleCommands(
        context: Context
    ) {

        val request =
            PeriodicWorkRequestBuilder<
                    CommandWorker
                    >(
                AgentConfig
                    .COMMAND_POLL_INTERVAL_MINUTES,

                TimeUnit.MINUTES
            )
                .setConstraints(
                    networkConstraints()
                )
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    30,
                    TimeUnit.SECONDS
                )
                .build()

        WorkManager
            .getInstance(context)
            .enqueueUniquePeriodicWork(
                AgentConfig
                    .COMMAND_WORK_NAME,

                ExistingPeriodicWorkPolicy.UPDATE,

                request
            )
    }
}