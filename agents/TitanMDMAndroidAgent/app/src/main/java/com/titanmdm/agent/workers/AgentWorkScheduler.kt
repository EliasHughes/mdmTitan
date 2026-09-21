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

    fun schedule(context: Context) {

        scheduleHeartbeat(
            context.applicationContext
        )
    }

    private fun scheduleHeartbeat(
        context: Context
    ) {

        val constraints =
            Constraints.Builder()
                .setRequiredNetworkType(
                    NetworkType.CONNECTED
                )
                .build()

        val request =
            PeriodicWorkRequestBuilder<
                    HeartbeatWorker
                    >(
                AgentConfig
                    .HEARTBEAT_INTERVAL_MINUTES,
                TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    30,
                    TimeUnit.SECONDS
                )
                .build()

        WorkManager
            .getInstance(context)
            .enqueueUniquePeriodicWork(
                AgentConfig.HEARTBEAT_WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                request
            )
    }
}