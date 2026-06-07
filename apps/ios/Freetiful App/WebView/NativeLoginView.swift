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
    @State private var appleCoordinator: AppleNativeLoginCoordinator?
    // 로그인 성공으로 닫힌 건지, 드래그/취소로 닫힌 건지 구분
    @State private var didLoginSuccessfully = false

    var body: some View {
        ZStack {
            // 딤 배경 (앱이 비치는 적정 크기 모달)
            Color.black.opacity(0.38).ignoresSafeArea()
                .onTapGesture { goHome() }

            // 글래스 카드
            VStack(spacing: 16) {
                Image("logo-wordmark")
                    .resizable().scaledToFit().frame(height: 32)
                    .padding(.top, 4)

                Text("나의 특별한 행사를 완성하는 전문가")
                    .font(.system(size: 13))
                    .foregroundColor(.secondary)
                    .padding(.bottom, 4)

                VStack(spacing: 10) {
                    socialButton(icon: "login-kakao", title: "카카오로 시작하기",
                                 bg: Color(red: 1.0, green: 0.898, blue: 0.0),
                                 fg: Color(red: 0.098, green: 0.098, blue: 0.098), action: handleKakaoLogin)
                    socialButton(icon: "login-naver", title: "네이버로 시작하기",
                                 bg: Color(red: 0.012, green: 0.780, blue: 0.353), fg: .white, action: handleNaverLogin)
                    socialButton(icon: "login-google", title: "Google로 시작하기",
                                 bg: .white, fg: Color(red: 0.3, green: 0.3, blue: 0.3), bordered: true, action: handleGoogleLogin)
                    socialButton(icon: "login-apple", title: "Apple로 시작하기",
                                 bg: .black, fg: .white, action: handleAppleLogin)

                    Button("나중에 하기") { goHome() }
                        .foregroundColor(.secondary)
                        .font(.system(size: 14))
                        .padding(.top, 6)
                }
            }
            .padding(26)
            .frame(maxWidth: 360)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).stroke(Color.white.opacity(0.45), lineWidth: 1))
            .shadow(color: .black.opacity(0.25), radius: 28, y: 12)
            .padding(.horizontal, 28)

            if isLoading {
                ProgressView().scaleEffect(1.4).tint(.white)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.black.opacity(0.25).ignoresSafeArea())
            }
        }
        // OAuth 앱 전환 중 시트가 잠깐 사라질 수 있어 로딩 중에는 홈 이동을 막는다.
        .onDisappear {
            if !didLoginSuccessfully && !isLoading {
                goHome()
            }
        }
    }

    // 소셜 로그인 버튼 (제공 아이콘 + 브랜드 컬러)
    @ViewBuilder
    private func socialButton(icon: String, title: String, bg: Color, fg: Color, bordered: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(icon).resizable().scaledToFit().frame(width: 20, height: 20)
                Text(title).fontWeight(.bold)
            }
            .frame(maxWidth: .infinity).frame(height: 50)
            .background(bg)
            .foregroundColor(fg)
            .cornerRadius(14)
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(Color.gray.opacity(bordered ? 0.25 : 0), lineWidth: 1)
            )
        }
    }

    // MARK: - Kakao (app-to-app SSO + 백엔드 /auth/login/kakao/native)
    func handleKakaoLogin() {
        isLoading = true
        let handle: (OAuthToken?, Error?) -> Void = { token, error in
            if let token = token {
                self.callAPI(endpoint: "/auth/login/kakao/native", body: ["accessToken": token.accessToken])
            } else {
                // 취소/실패 → 홈으로
                print("❌ 카카오 로그인 취소·실패:", error?.localizedDescription ?? "unknown")
                self.isLoading = false
            }
        }
        let loginWithKakaoAccount = {
            UserApi.shared.loginWithKakaoAccount(completion: handle)
        }
        if UserApi.isKakaoTalkLoginAvailable() {
            UserApi.shared.loginWithKakaoTalk { token, error in
                if let token = token {
                    handle(token, nil)
                } else {
                    print("⚠️ 카카오톡 로그인 실패, 카카오계정 로그인으로 재시도:", error?.localizedDescription ?? "unknown")
                    loginWithKakaoAccount()
                }
            }
        } else {
            loginWithKakaoAccount()
        }
    }

    // MARK: - Google (/auth/login/google — idToken)
    func handleGoogleLogin() {
        isLoading = true
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootVC = windowScene.windows.first?.rootViewController else {
            print("❌ Google: rootVC 없음"); isLoading = false; goHome(); return
        }
        var presenter = rootVC
        while let presented = presenter.presentedViewController { presenter = presented }

        GIDSignIn.sharedInstance.signIn(withPresenting: presenter) { result, error in
            guard let idToken = result?.user.idToken?.tokenString, error == nil else {
                // 취소/실패 → 홈으로
                print("❌ 구글 로그인 취소·실패:", error?.localizedDescription ?? "no idToken")
                self.isLoading = false
                self.goHome()
                return
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
                    // 취소/실패 → 홈으로
                    print("❌ 네이버 로그인 취소·실패:", error)
                    self.isLoading = false
                    self.goHome()
                }
                self.naverCoordinator = nil
            }
        }
        self.naverCoordinator = coordinator
        coordinator.signIn()
    }

    // MARK: - Apple (/auth/login/apple — identityToken)
    func handleAppleLogin() {
        isLoading = true
        let coordinator = AppleNativeLoginCoordinator { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let (identityToken, fullName)):
                    var body: [String: Any] = ["identityToken": identityToken]
                    if let name = fullName, !name.isEmpty { body["fullName"] = name }
                    self.callAPI(endpoint: "/auth/login/apple", body: body)
                case .failure(let error):
                    // 취소/실패 → 홈으로
                    print("❌ 애플 로그인 취소·실패:", error)
                    self.isLoading = false
                    self.goHome()
                }
                self.appleCoordinator = nil
            }
        }
        self.appleCoordinator = coordinator
        coordinator.signIn()
    }

    // MARK: - "나중에 하기" — 홈으로
    /// ViewController가 observer로 수신해서 모달 닫고 /main으로 이동.
    /// findWebView() 방식은 sheet 위의 scene을 집을 수 있어서 알림 패턴이 더 안정적.
    func goHome() {
        NotificationCenter.default.post(name: .goHomeRequested, object: nil)
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
                // 성공 플래그를 먼저 세워야 dismiss/onDisappear가 goHome을 다시 쏘지 않는다.
                self.didLoginSuccessfully = true
                // OneSignal external_id 매핑 (푸시용)
                OneSignal.login(userId)
                // ViewController에게 JWT 주입을 위임 (WebView 참조 안정성 위해 NotificationCenter 사용)
                NotificationCenter.default.post(
                    name: .loginCompleted,
                    object: nil,
                    userInfo: [
                        "accessToken": accessToken,
                        "refreshToken": refreshToken,
                        "userJSON": userJSON,
                    ]
                )
            }
        }.resume()
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

// MARK: - Apple Sign In Coordinator
class AppleNativeLoginCoordinator: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    /// .success((identityToken, fullName?)) — identityToken은 JWT, fullName은 첫 로그인 시에만 받을 수 있음
    private let completion: (Result<(String, String?), Error>) -> Void

    init(completion: @escaping (Result<(String, String?), Error>) -> Void) {
        self.completion = completion
    }

    func signIn() {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    func authorizationController(controller: ASAuthorizationController,
                                 didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = cred.identityToken,
              let identityToken = String(data: tokenData, encoding: .utf8) else {
            completion(.failure(NSError(domain: "Apple", code: -1, userInfo: [NSLocalizedDescriptionKey: "identityToken 누락"])))
            return
        }
        let fn = cred.fullName?.givenName ?? ""
        let ln = cred.fullName?.familyName ?? ""
        let fullName = [fn, ln].filter { !$0.isEmpty }.joined(separator: " ")
        completion(.success((identityToken, fullName.isEmpty ? nil : fullName)))
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        completion(.failure(error))
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? UIWindow()
    }
}
