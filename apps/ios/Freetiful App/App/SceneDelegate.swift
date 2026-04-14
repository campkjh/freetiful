import UIKit
import KakaoSDKAuth
import GoogleSignIn
import NaverThirdPartyLogin

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

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
    }
}
