import UIKit
import KakaoSDKAuth
import GoogleSignIn
import NaverThirdPartyLogin

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    // 콜드 스타트(앱 종료 상태에서 Live Activity 탭)용 — willConnectTo 에서 들어온 딥링크 보관
    static var pendingDeepLinkPath: String?

    // freetiful://inquiries 등 앱 딥링크 → 내부 경로("/inquiries")로 변환
    private func internalPath(from url: URL) -> String? {
        guard url.scheme == "freetiful" else { return nil }
        let host = url.host ?? ""
        let path = "/" + host + url.path
        return path == "/" ? "/main" : path
    }

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        // 앱이 꺼진 상태에서 Live Activity(다이나믹 아일랜드) 탭으로 실행된 경우
        if let url = connectionOptions.urlContexts.first?.url, let path = internalPath(from: url) {
            SceneDelegate.pendingDeepLinkPath = path
            // ViewController 의 옵저버가 viewDidLoad 에서 등록될 시간을 준 뒤 전달
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                let target = SceneDelegate.pendingDeepLinkPath
                SceneDelegate.pendingDeepLinkPath = nil
                if let target = target {
                    NotificationCenter.default.post(name: .pushDeepLinkRequested, object: target)
                }
            }
        }
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

        // 4. 앱 딥링크 (Live Activity → 문의목록 등): freetiful://inquiries
        if let path = internalPath(from: url) {
            print("🟡 freetiful 딥링크:", path)
            NotificationCenter.default.post(name: .pushDeepLinkRequested, object: path)
            return
        }
    }
}
