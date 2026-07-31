package com.freetiful.freetiful

import android.app.Application
import android.content.Intent
import android.util.Log
import com.onesignal.OneSignal
import com.onesignal.notifications.INotificationClickListener
import com.onesignal.notifications.INotificationClickEvent
import com.onesignal.notifications.INotificationLifecycleListener
import com.onesignal.notifications.INotificationWillDisplayEvent
import com.onesignal.user.subscriptions.IPushSubscriptionObserver
import com.onesignal.user.subscriptions.PushSubscriptionChangedState
import org.json.JSONObject

object PushDeepLinkStore {
    private var pendingPath: String? = null

    fun set(path: String?) {
        pendingPath = path
    }

    fun consume(): String? {
        val value = pendingPath
        pendingPath = null
        return value
    }
}

class MyApplication : Application() {

    override fun onCreate() {
        super.onCreate()

        // 🔥 OneSignal SDK v5 초기화 (initWithContext가 appId까지 한 번에 받음)
        OneSignal.initWithContext(this, "fcf1313b-36ee-40ab-8fbc-4da8727ae83f")

        // 🔔 Player ID(구독 ID) 변경 감지 — 디버그 로그용
        OneSignal.User.pushSubscription.addObserver(object : IPushSubscriptionObserver {
            override fun onPushSubscriptionChange(state: PushSubscriptionChangedState) {
                Log.d("ONESIGNAL_ID", "Subscription changed: ${state.current.id}")
            }
        })

        // 🔔 포그라운드 알림 수신
        OneSignal.Notifications.addForegroundLifecycleListener(object : INotificationLifecycleListener {
            override fun onWillDisplay(event: INotificationWillDisplayEvent) {
                Log.d("PUSH_DEBUG", "푸시 수신됨: ${event.notification.title}")
            }
        })

        // 🔔 알림 클릭
        OneSignal.Notifications.addClickListener(object : INotificationClickListener {
            override fun onClick(event: INotificationClickEvent) {
                val targetPath = normalizePushTarget(event)
                Log.d("PUSH_DEBUG", "알림 열림 target=$targetPath")
                PushDeepLinkStore.set(targetPath)

                val intent = Intent(this@MyApplication, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    putExtra("push_target_path", targetPath)
                }
                startActivity(intent)
            }
        })
    }

    private fun normalizePushTarget(event: INotificationClickEvent): String {
        val data = event.notification.additionalData
        val raw =
            stringValue(data, "url")
                ?: stringValue(data, "link")
                ?: stringValue(data, "deepLink")
                ?: stringValue(data, "deeplink")
                ?: stringValue(data, "launchURL")
                ?: stringValue(data, "launchUrl")
                ?: stringValue(data, "app_url")
                ?: stringValue(data, "web_url")
                ?: event.result.url
                ?: event.notification.launchURL
                ?: chatTarget(data)
                ?: "/notifications"

        return normalizeInternalPath(raw)
    }

    private fun chatTarget(data: JSONObject?): String? {
        if (data == null) return null
        val keys = listOf("roomId", "chatRoomId", "room_id", "chat_room_id")
        for (key in keys) {
            val value = stringValue(data, key)
            if (!value.isNullOrBlank()) return "/chat/$value"
        }
        return null
    }

    private fun stringValue(data: JSONObject?, key: String): String? {
        if (data == null || !data.has(key) || data.isNull(key)) return null
        return data.optString(key).trim().ifEmpty { null }
    }

    private fun normalizeInternalPath(rawValue: String): String {
        val raw = rawValue.trim()
        if (raw.isEmpty()) return "/notifications"
        if (raw.startsWith("/")) return raw

        return try {
            val uri = android.net.Uri.parse(raw)
            when (uri.scheme?.lowercase()) {
                "http", "https" -> {
                    val host = uri.host?.lowercase()
                    if (host == "freetiful.com" || host == "www.freetiful.com") {
                        val path = uri.path?.takeIf { it.isNotBlank() } ?: "/"
                        if (uri.query.isNullOrBlank()) path else "$path?${uri.query}"
                    } else {
                        "/notifications"
                    }
                }
                "freetiful" -> {
                    val host = uri.host.orEmpty()
                    val path = buildString {
                        if (host.isNotBlank()) append("/").append(host)
                        append(uri.path.orEmpty())
                    }.ifBlank { "/notifications" }
                    if (uri.query.isNullOrBlank()) path else "$path?${uri.query}"
                }
                else -> "/$raw"
            }
        } catch (_: Exception) {
            "/notifications"
        }
    }
}
