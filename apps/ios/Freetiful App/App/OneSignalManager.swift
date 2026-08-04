import Foundation
import OneSignalFramework

class OneSignalManager: NSObject, OSNotificationClickListener, OSNotificationLifecycleListener {

    static let shared = OneSignalManager()
    private var pendingDeepLink: String?

    private override init() {
        super.init()
    }

    func initialize() {

        OneSignal.initialize("fcf1313b-36ee-40ab-8fbc-4da8727ae83f")
        OneSignal.Notifications.addClickListener(self)
        // 포그라운드 수신 리스너 — 앱 사용 중에도 배너가 항상 표시되도록 명시하고,
        // 푸시가 기기까지 도달하는지 콘솔에서 진단할 수 있게 수신 로그를 남긴다.
        OneSignal.Notifications.addForegroundLifecycleListener(self)

        OneSignal.Notifications.requestPermission { accepted in
            print("🔔 Permission: \(accepted)")

            // 권한 요청 후 약간 딜레이 주고 ID 확인
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                self.fetchPushId()
            }
        }
    }

    func deliverCurrentPushId() {
        fetchPushId()
    }

    private func fetchPushId(retryCount: Int = 0) {
        if let id = OneSignal.User.pushSubscription.id {
            print("📌 Player ID: \(id)")
            sendPushId(id)
        } else {
            print("❌ Push ID 아직 없음")
            guard retryCount < 5 else { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                self.fetchPushId(retryCount: retryCount + 1)
            }
        }
    }

    private func sendPushId(_ id: String) {
        NotificationCenter.default.post(
            name: .didReceivePushId,
            object: id
        )
    }

    func consumePendingDeepLink() -> String? {
        let value = pendingDeepLink
        pendingDeepLink = nil
        return value
    }

    /// 포그라운드 수신 — preventDefault 를 호출하지 않으면 배너가 그대로 표시된다.
    /// (수신 자체가 되는지 콘솔 진단용 로그 포함)
    func onWillDisplay(event: OSNotificationWillDisplayEvent) {
        let n = event.notification
        print("🔔 [푸시 수신/포그라운드] id=\(n.notificationId ?? "-") title=\(n.title ?? "-")")
    }

    func onClick(event: OSNotificationClickEvent) {
        let data = event.notification.additionalData
        let target = clickTarget(from: data, launchURL: event.notification.launchURL)

        guard let target, !target.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return
        }

        pendingDeepLink = target
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .pushDeepLinkRequested,
                object: target
            )
        }
    }

    private func clickTarget(from data: [AnyHashable: Any]?, launchURL: String?) -> String? {
        if let data {
            let keys = ["url", "link", "deepLink", "deeplink", "launchURL", "launchUrl", "app_url", "web_url"]
            for key in keys {
                if let value = data[key] as? String, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    return value
                }
            }
        }

        if let launchURL, !launchURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return launchURL
        }

        return chatTarget(from: data)
    }

    private func chatTarget(from data: [AnyHashable: Any]?) -> String? {
        guard let data else { return nil }
        let keys = ["roomId", "chatRoomId", "room_id", "chat_room_id"]
        for key in keys {
            if let value = data[key] as? String, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return "/chat/\(value)"
            }
            if let value = data[key] as? NSNumber {
                return "/chat/\(value.stringValue)"
            }
        }
        return nil
    }

    func logout() {
        OneSignal.logout()
    }
}

extension Notification.Name {
    static let didReceivePushId = Notification.Name("didReceivePushId")
    /// 푸시 알림 클릭 시 앱 내부 웹뷰가 해당 경로로 이동하도록 요청
    static let pushDeepLinkRequested = Notification.Name("pushDeepLinkRequested")
    /// 네이티브 로그인 시트에서 "나중에 하기" / OAuth 취소 시 게시 — ViewController가 웹뷰를 /main으로 이동
    static let goHomeRequested = Notification.Name("goHomeRequested")
    /// 네이티브 소셜 로그인 성공 시 게시 — ViewController가 JWT를 localStorage에 주입 + /main 이동
    /// userInfo: ["accessToken": String, "refreshToken": String, "userJSON": String]
    static let loginCompleted = Notification.Name("loginCompleted")
}
