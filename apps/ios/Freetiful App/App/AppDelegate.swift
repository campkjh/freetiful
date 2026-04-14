import UIKit
import KakaoSDKCommon
import KakaoSDKAuth
import GoogleSignIn
import NaverThirdPartyLogin
import OneSignalFramework
import UserNotifications
import Firebase

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        
        FirebaseApp.configure()

        // -----------------------------
        // Kakao 초기화
        // -----------------------------
        KakaoSDK.initSDK(appKey: "c0c3d8d54694eea9e142783494004639")

        // -----------------------------
        // Google 초기화
        // -----------------------------
        let signInConfig = GIDConfiguration(
            clientID: "919806921995-gk8dq3i013briji7ll6upefvuerivrij.apps.googleusercontent.com"
        )
        GIDSignIn.sharedInstance.configuration = signInConfig

        // -----------------------------
        // Naver 초기화
        // -----------------------------
        let naver = NaverThirdPartyLoginConnection.getSharedInstance()
        naver?.consumerKey = "cnaly_pSLgjMyP3Itds_"
        naver?.consumerSecret = "dmDCW1zGye"
        naver?.appName = "Freetiful"
        naver?.serviceUrlScheme = "naverfreetiful"

        // -----------------------------
        // 🔔 OneSignal 초기화
        // -----------------------------
        OneSignal.initialize("fcf1313b-36ee-40ab-8fbc-4da8727ae83f")

        // 🔔 알림 권한 요청
        OneSignal.Notifications.requestPermission({ accepted in
            print("🔔 알림 허용 여부:", accepted)
        }, fallbackToSettings: true)

        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            print("🧪 OneSignal ID:", OneSignal.User.pushSubscription.id ?? "nil")
        }
        return true
    }

    // -----------------------------
    // URL 열림 처리 (Kakao / Google / Naver)
    // -----------------------------
    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey : Any] = [:]
    ) -> Bool {

        if AuthApi.isKakaoTalkLoginUrl(url) {
            return AuthController.handleOpenUrl(url: url)
        }

        if GIDSignIn.sharedInstance.handle(url) {
            return true
        }

        if NaverThirdPartyLoginConnection
            .getSharedInstance()?
            .application(app, open: url, options: options) == true {
            return true
        }

        return false
    }

    // -----------------------------
    // UIScene 사용 시 필요
    // -----------------------------
    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {

        return UISceneConfiguration(
            name: "Default Configuration",
            sessionRole: connectingSceneSession.role
        )
    }

    func application(
        _ application: UIApplication,
        didDiscardSceneSessions sceneSessions: Set<UISceneSession>
    ) {
        // Scene 삭제 시 처리
    }
}
