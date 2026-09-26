import UIKit
import KakaoSDKAuth
import GoogleSignIn
import NaverThirdPartyLogin

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    /// 앱이 꺼져 있을 때 링크(https://freetiful.com/… 유니버설 링크, freetiful://…)로 열린 경우 —
    /// 화면(ViewController)이 아직 안 떠 있으니 맡겨 두고, 첫 화면을 그 주소로 연다(loadInitialPage).
    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        let web = connectionOptions.userActivities
            .first { $0.activityType == NSUserActivityTypeBrowsingWeb }?.webpageURL
        let app = connectionOptions.urlContexts.first { $0.url.scheme == "freetiful" }?.url
        if let url = web ?? app {
            OneSignalManager.shared.setPendingDeepLink(url.absoluteString)
        }
    }

    /// 앱이 떠 있을 때 유니버설 링크 — 그 화면으로
    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        guard userActivity.activityType == NSUserActivityTypeBrowsingWeb, let url = userActivity.webpageURL else { return }
        NotificationCenter.default.post(name: .pushDeepLinkRequested, object: url.absoluteString)
    }

    func scene(
        _ scene: UIScene,
        openURLContexts URLContexts: Set<UIOpenURLContext>
    ) {
        guard let url = URLContexts.first?.url else { return }

        print("🟣 SCENE OPEN URL:", url.absoluteString)

        // 1. 네이버 로그인 콜백
        if NaverThirdPartyLoginConnection.getSharedInstance()?.application(
            UIApplication.shared,
            open: url,
            options: [:]
        ) == true {
            print("🟢 네이버 로그인 콜백 처리 완료")
            return
        }

        // 2. 카카오 로그인 콜백
        if AuthApi.isKakaoTalkLoginUrl(url) {
            print("🟢 카카오 로그인 콜백 처리 완료")
            _ = AuthController.handleOpenUrl(url: url)
            return
        }

        // 3. 구글 로그인 콜백
        if GIDSignIn.sharedInstance.handle(url) {
            print("🔵 구글 로그인 콜백 처리 완료")
            return
        }

        // 4. 앱 링크 freetiful://inquiries 등 → 그 화면으로
        if url.scheme == "freetiful" {
            NotificationCenter.default.post(name: .pushDeepLinkRequested, object: url.absoluteString)
        }
    }
}
