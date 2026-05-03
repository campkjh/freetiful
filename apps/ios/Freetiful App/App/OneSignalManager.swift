import Foundation
import OneSignalFramework

class OneSignalManager: NSObject, OSNotificationClickListener {

    static let shared = OneSignalManager()
    private var pendingDeepLink: String?

    private override init() {
        super.init()
    }

    func initialize() {

        OneSignal.initialize("fcf1313b-36ee-40ab-8fbc-4da8727ae83f")
        OneSignal.Notifications.addClickListener(self)

        OneSignal.Notifications.requestPermission { accepted in
            print("🔔 Permission: \(accepted)")

            // 권한 요청 후 약간 딜레이 주고 ID 확인
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                self.fetchPushId()
            }
        }
    }

    private func fetchPushId() {
        if let id = OneSignal.User.pushSubscription.id {
            print("📌 Player ID: \(id)")
            sendPushId(id)
        } else {
            print("❌ Push ID 아직 없음")
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

    func onClick(event: OSNotificationClickEvent) {
        let data = event.notification.additionalData
        let target =
            data?["url"] as? String ??
            data?["deepLink"] as? String ??
            data?["deeplink"] as? String ??
            event.notification.launchURL

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
