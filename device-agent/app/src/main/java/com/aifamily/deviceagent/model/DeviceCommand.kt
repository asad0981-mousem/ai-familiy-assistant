package com.aifamily.deviceagent.model

import org.json.JSONObject

/**
 * نوع‌های دستور — دقیقاً مطابق CommandType در
 * backend/src/modules/devices/entities/device-command.entity.ts (باید هم‌زمان با آن به‌روز بماند).
 */
enum class CommandType(val wireValue: String) {
    LOCK_DEVICE("lock_device"),
    UNLOCK_DEVICE("unlock_device"),
    SET_SCREEN_TIME_LIMIT("set_screen_time_limit"),
    BLOCK_APP("block_app"),
    UNBLOCK_APP("unblock_app"),
    FORCE_LOCATION_UPDATE("force_location_update"),
    SLEEP_MODE_ENABLE("sleep_mode_enable"),
    SLEEP_MODE_DISABLE("sleep_mode_disable"),
    SYNC_POLICY("sync_policy"),
    SEND_PARENT_MESSAGE("send_parent_message"),
    REMOTE_ALARM("remote_alarm"),
    WIPE_DATA("wipe_data");

    companion object {
        fun fromWire(value: String): CommandType? = entries.find { it.wireValue == value }
    }
}

enum class CommandStatus(val wireValue: String) {
    RECEIVED("received"),
    EXECUTING("executing"),
    EXECUTED("executed"),
    FAILED("failed");
}

/**
 * یک دستور دریافتی از GET /devices/commands/pending.
 * payloadRaw به‌صورت Map<String, Any?> نگه داشته می‌شود تا هم برای اجرای دستور قابل‌استفاده باشد،
 * هم بتوان دقیقاً همان مقدار را برای تایید امضا به CommandSigner داد (بدون وابستگی به ترتیب کلید).
 */
data class DeviceCommand(
    val id: String,
    val deviceId: String,
    val type: CommandType,
    val payload: Map<String, Any?>,
    val idempotencyKey: String,
    val signature: String,
) {
    /** دقیقاً همان شکلی از Payload که سرور هنگام امضا استفاده کرده (فصل ۱۶ / CommandSignerService). */
    fun signingPayload(): Map<String, Any?> = mapOf(
        "deviceId" to deviceId,
        "type" to type.wireValue,
        "payload" to payload,
        "idempotencyKey" to idempotencyKey,
    )

    companion object {
        fun fromJson(json: JSONObject): DeviceCommand? {
            val typeRaw = json.optString("type", "")
            val type = CommandType.fromWire(typeRaw) ?: return null
            return DeviceCommand(
                id = json.getString("id"),
                deviceId = json.getString("deviceId"),
                type = type,
                payload = jsonObjectToMap(json.optJSONObject("payload") ?: JSONObject()),
                idempotencyKey = json.getString("idempotencyKey"),
                signature = json.getString("signature"),
            )
        }
    }
}

/** تبدیل بازگشتی JSONObject/JSONArray به Map/List ساده Kotlin — برای استفاده در CommandSigner. */
fun jsonObjectToMap(obj: JSONObject): Map<String, Any?> {
    val map = LinkedHashMap<String, Any?>()
    val keys = obj.keys()
    while (keys.hasNext()) {
        val key = keys.next()
        map[key] = jsonValueToKotlin(obj.get(key))
    }
    return map
}

private fun jsonValueToKotlin(value: Any?): Any? = when (value) {
    JSONObject.NULL -> null
    is JSONObject -> jsonObjectToMap(value)
    is org.json.JSONArray -> (0 until value.length()).map { jsonValueToKotlin(value.get(it)) }
    else -> value
}
