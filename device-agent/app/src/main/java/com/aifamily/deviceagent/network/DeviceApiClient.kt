package com.aifamily.deviceagent.network

import com.aifamily.deviceagent.model.DeviceCommand
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiException(val statusCode: Int, message: String) : IOException(message)

/**
 * کلاینت HTTP برای مسیرهای مخصوص Device Agent در بک‌اند — دقیقاً مطابق قرارداد
 * backend/src/modules/devices/devices.controller.ts و policies.controller.ts/locations.controller.ts
 * (بخش‌هایی که با نقش "device" محافظت شده‌اند).
 */
class DeviceApiClient(private val baseUrl: String, private val deviceToken: String) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private fun url(path: String) = baseUrl.trimEnd('/') + "/" + path.trimStart('/')

    private fun authorizedRequest(path: String) = Request.Builder()
        .url(url(path))
        .addHeader("Authorization", "Bearer $deviceToken")

    /** GET /devices/commands/pending — Outbox Pull Pattern (I-C02). */
    fun fetchPendingCommands(): List<DeviceCommand> {
        val request = authorizedRequest("devices/commands/pending").get().build()
        val body = execute(request)
        val array = org.json.JSONArray(body)
        return (0 until array.length()).mapNotNull { i ->
            DeviceCommand.fromJson(array.getJSONObject(i))
        }
    }

    /** POST /devices/commands/{id}/ack */
    fun ackCommand(commandId: String, status: String, failureReason: String? = null) {
        val json = JSONObject().apply {
            put("status", status)
            if (failureReason != null) put("failureReason", failureReason)
        }
        val request = authorizedRequest("devices/commands/$commandId/ack")
            .post(json.toString().toRequestBody(jsonMediaType))
            .build()
        execute(request)
    }

    /** GET /policies/current — دریافت آخرین Policy برای اعمال محلی بعد از SYNC_POLICY. */
    fun fetchCurrentPolicy(): JSONObject {
        val request = authorizedRequest("policies/current").get().build()
        return JSONObject(execute(request))
    }

    /** POST /locations/report — فقط اگر Consent فعال باشد موفق می‌شود (در غیر این صورت 403). */
    fun reportLocation(lat: Double, lng: Double, accuracyMeters: Float?, capturedAtIso8601: String) {
        val json = JSONObject().apply {
            put("lat", lat)
            put("lng", lng)
            if (accuracyMeters != null) put("accuracyMeters", accuracyMeters.toDouble())
            put("capturedAt", capturedAtIso8601)
        }
        val request = authorizedRequest("locations/report")
            .post(json.toString().toRequestBody(jsonMediaType))
            .build()
        execute(request)
    }

    private fun execute(request: Request): String {
        client.newCall(request).execute().use { response ->
            val bodyString = response.body?.string() ?: ""
            if (!response.isSuccessful) {
                throw ApiException(response.code, "HTTP ${response.code}: $bodyString")
            }
            return bodyString
        }
    }
}
