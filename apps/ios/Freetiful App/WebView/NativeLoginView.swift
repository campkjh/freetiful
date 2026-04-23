import SwiftUI
import AuthenticationServices
import WebKit
import KakaoSDKUser
import KakaoSDKAuth
import GoogleSignIn
import NaverThirdPartyLogin
import OneSignalFramework

private let kWebAppURL = "https://freetiful.com"
private let kAPIBase   = "https://freetiful.com/api/v1"

struct NativeLoginView: View {
    @Environment(\.dismiss) var dismiss
    @State private var isLoading = false
    @State private var naverCoordinator: NaverNativeLoginCoordinator?

    var body: some View {
        ZStack {
            Color.white.ignoresSafeArea()

            VStack(spacing: 20) {
                Spacer()

                Text("Freetiful")
                    .font(.system(size: 32, weight: .black))
                    .foregroundColor(Color(red: 0.24, green: 0.51, blue: 0.97))

                Text("나의 특별한 행사를 완성하는 전문가")
                    .font(.system(size: 14))
                    .foregroundColor(.gray)

                Spacer().frame(maxHeight: 40)

                VStack(spacing: 10) {
                    // Kakao
                    Button(action: handleKakaoLogin) {
                        Text("카카오로 시작하기")
                            .fontWeight(.bold)
                            .frame(maxWidth: .infinity).frame(height: 48)
                            .background(Color(red: 1.0, green: 0.898, blue: 0.0))
                            .foregroundColor(Color(red: 0.098, green: 0.098, blue: 0.098))
                            .cornerRadius(14)
                    }

                    // Naver
                    Button(action: handleNaverLogin) {
                        Text("네이버로 시작하기")
                            .fontWeight(.bold)
                            .frame(maxWidth: .infinity).frame(height: 48)
                            .background(Color(red: 0.012, green: 0.780, blue: 0.353))
                            .foregroundColor(.white)
                            .cornerRadius(14)
                    }

                    // Google
                    Button(action: handleGoogleLogin) {
                        Text("Google로 시작하기")
                            .fontWeight(.bold)
                            .frame(maxWidth: .infinity).frame(height: 48)
                            .background(Color.white)
                            .foregroundColor(Color(red: 0.3, green: 0.3, blue: 0.3))
                            .cornerRadius(14)
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.gray.opacity(0.3), lineWidth: 1))
                    }

                    // Apple (web-based via Freetiful web login)
                    Button(action: handleAppleLogin) {
                        HStack(spacing: 6) {
                            Image(systemName: "apple.logo")
                            Text("Apple로 시작하기").fontWeight(.bold)
                        }
                        .frame(maxWidth: .infinity).frame(height: 48)
                        .background(Color.black)
                        .foregroundColor(.white)
                        .cornerRadius(14)
                    }

                    // "나중에 하기" — 시트 닫고 홈으로 이동 (Android 동일 UX)
                    Button("나중에 하기") { goHome() }
                        .foregroundColor(.gray)
                        .padding(.top, 8)
                }
                .padding(.horizontal, 40)
                .padding(.bottom, 40)
            }

            if isLoading {
                ProgressView().scaleEffect(1.5)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.black.opacity(0.2))
            }
        }
    }

    // MARK: - Kakao (app-to-app SSO + 백엔드 /auth/login/kakao/native)
    func handleKakaoLogin() {
        isLoading = true
        let handle: (OAuthToken?, Error?) -> Void = { token, error in
            if let token = token {
                self.callAPI(endpoint: "/auth/login/kakao/native", body: ["accessToken": token.accessToken])
            } else {
                print("❌ 카카오 로그인 실패:", error?.localizedDescription ?? "unknown")
                self.isLoading = false
            }
        }
        if UserApi.isKakaoTalkLoginAvailable() {
            UserApi.shared.loginWithKakaoTalk(completion: handle)
        } else {
            UserApi.shared.loginWithKakaoAccount(completion: handle)
        }
    }

    // MARK: - Google (/auth/login/google — idToken)
    func handleGoogleLogin() {
        isLoading = true
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootVC = windowScene.windows.first?.rootViewController else {
            print("❌ Google: rootVC 없음"); isLoading = false; return
        }
        var presenter = rootVC
        while let presented = presenter.presentedViewController { presenter = presented }

        GIDSignIn.sharedInstance.signIn(withPresenting: presenter) { result, error in
            guard let idToken = result?.user.idToken?.tokenString, error == nil else {
                print("❌ 구글 로그인 실패:", error?.localizedDescription ?? "no idToken")
                self.isLoading = false; return
            }
            self.callAPI(endpoint: "/auth/login/google", body: ["idToken": idToken])
        }
    }

    // MARK: - Naver (/auth/login/naver/native — accessToken)
    func handleNaverLogin() {
        isLoading = true
        let coordinator = NaverNativeLoginCoordinator { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let accessToken):
                    self.callAPI(endpoint: "/auth/login/naver/native", body: ["accessToken": accessToken])
                case .failure(let error):
                    print("❌ 네이버 로그인 실패:", error)
                    self.isLoading = false
                }
                self.naverCoordinator = nil
            }
        }
        self.naverCoordinator = coordinator
        coordinator.signIn()
    }

    // MARK: - Apple: 웹 기반 로그인으로 이동 (네이티브 시트 사용 안 함)
    func handleAppleLogin() {
        // 네이티브 Apple 시트 대신 Freetiful 웹 로그인 페이지로 이동.
        // 거기서 Apple 버튼 → 웹 OAuth 흐름.
        guard let webView = findWebView(),
              let url = URL(string: "\(kWebAppURL)/login") else { return }
        webView.load(URLRequest(url: url))
        dismiss()
    }

    // MARK: - "나중에 하기" — 홈으로
    func goHome() {
        // 1) 시트 dismiss 전에 미리 WebView를 잡아두기 (sheet가 떠있을 때의 상태에서 가져옴)
        let webView = findWebView()

        // 2) 시트 닫기
        dismiss()

        // 3) 시트 dismiss 애니메이션 완료 후 WebView 네비게이션 수행.
        //    webView.load(URLRequest)가 evaluateJavaScript보다 원자적.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
            guard let webView = webView,
                  let url = URL(string: "\(kWebAppURL)/main") else {
                print("❌ goHome: WebView 못 찾음")
                return
            }
            webView.load(URLRequest(url: url))
        }
    }

    // MARK: - 공통: 백엔드 → JWT 수신 → localStorage 주입
    /// iOS ViewController.callAPI()와 동등. 소셜 토큰을 백엔드에 POST →
    /// JWT 응답 받아 WebView localStorage('prettyful-auth')에 주입.
    /// OneSignal.login(userId)까지 처리하여 푸시 매핑도 완성.
    private func callAPI(endpoint: String, body: [String: Any]) {
        guard let url = URL(string: "\(kAPIBase)\(endpoint)") else { self.isLoading = false; return }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        request.timeoutInterval = 15

        URLSession.shared.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async { self.isLoading = false }
            if let error = error {
                print("❌ callAPI 네트워크:", error.localizedDescription); return
            }
            guard
                let data = data,
                let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                let tokens = json["tokens"] as? [String: Any],
                let accessToken  = tokens["accessToken"]  as? String,
                let refreshToken = tokens["refreshToken"] as? String,
                let user = json["user"] as? [String: Any],
                let userId = user["id"] as? String
            else {
                print("❌ callAPI 응답 파싱 실패:", String(data: data ?? Data(), encoding: .utf8) ?? "")
                return
            }

            let userData = (try? JSONSerialization.data(withJSONObject: user)) ?? Data()
            let userJSON = String(data: userData, encoding: .utf8) ?? "{}"

            DispatchQueue.main.async {
                // OneSignal external_id 매핑
                OneSignal.login(userId)
                // JWT 주입 + /main 이동 + sheet 닫기
                self.injectJWT(accessToken: accessToken, refreshToken: refreshToken, userJSON: userJSON)
            }
        }.resume()
    }

    private func injectJWT(accessToken: String, refreshToken: String, userJSON: String) {
        let safe = { (s: String) in s.replacingOccurrences(of: "\\", with: "\\\\")
                                     .replacingOccurrences(of: "\"", with: "\\\"") }
        let js = """
        (function() {
          var auth = { state: { user: \(userJSON), accessToken: "\(safe(accessToken))", refreshToken: "\(safe(refreshToken))" }, version: 0 };
          localStorage.setItem('prettyful-auth', JSON.stringify(auth));
          window.location.href = '\(kWebAppURL)/main';
        })();
        """
        if let webView = findWebView() {
            webView.evaluateJavaScript(js) { _, err in
                if let err = err { print("❌ JS 주입 실패:", err) }
            }
        }
        dismiss()
    }

    // MARK: - WebView Finder
    func findWebView() -> WKWebView? {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = scene.windows.first else { return nil }
        return findWebViewInView(window)
    }

    func findWebViewInView(_ view: UIView) -> WKWebView? {
        if let webView = view as? WKWebView { return webView }
        for subview in view.subviews {
            if let webView = findWebViewInView(subview) { return webView }
        }
        return nil
    }
}

// MARK: - Naver Sign In Coordinator (access token만 반환 — 백엔드가 user info fetch)
class NaverNativeLoginCoordinator: NSObject, NaverThirdPartyLoginConnectionDelegate {
    private let completion: (Result<String, Error>) -> Void
    private let naver = NaverThirdPartyLoginConnection.getSharedInstance()

    init(completion: @escaping (Result<String, Error>) -> Void) {
        self.completion = completion
        super.init()
    }

    func signIn() {
        naver?.delegate = self
        naver?.requestThirdPartyLogin()
    }

    func oauth20ConnectionDidFinishRequestACTokenWithAuthCode() {
        if let token = naver?.accessToken {
            completion(.success(token))
        } else {
            completion(.failure(NSError(domain: "Naver", code: -2)))
        }
    }
    func oauth20ConnectionDidFinishRequestACTokenWithRefreshToken() {
        if let token = naver?.accessToken {
            completion(.success(token))
        }
    }
    func oauth20ConnectionDidFinishDeleteToken() {}
    func oauth20Connection(_ oauthConnection: NaverThirdPartyLoginConnection?, didFailWithError error: Error?) {
        completion(.failure(error ?? NSError(domain: "Naver", code: -1)))
    }
}
