import Foundation
import OneSignalFramework

class OneSignalManager {

    static let shared = OneSignalManager()
    private init() {}

    func initialize() {

        OneSignal.initialize("fcf1313b-36ee-40ab-8fbc-4da8727ae83f")

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

    func logout() {
        OneSignal.logout()
    }
}

extension Notification.Name {
    static let didReceivePushId = Notification.Name("didReceivePushId")
    /// 네이티브 로그인 시트에서 "나중에 하기" / OAuth 취소 시 게시 — ViewController가 웹뷰를 /main으로 이동
    static let goHomeRequested = Notification.Name("goHomeRequested")
    /// 네이티브 소셜 로그인 성공 시 게시 — ViewController가 JWT를 localStorage에 주입 + /main 이동
    /// userInfo: ["accessToken": String, "refreshToken": String, "userJSON": String]
    static let loginCompleted = Notification.Name("loginCompleted")
}
