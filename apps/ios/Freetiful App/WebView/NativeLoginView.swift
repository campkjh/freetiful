import SwiftUI
import AuthenticationServices
import WebKit
import KakaoSDKUser
import KakaoSDKAuth
import GoogleSignIn
import NaverThirdPartyLogin

private let kWebAppURL = "https://freetiful.com"

struct NativeLoginView: View {
    @Environment(\.dismiss) var dismiss
    @State private var isLoading = false
    @State private var appleCoordinator: AppleNativeLoginCoordinator?
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

                    // Apple
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

                    Button("취소") { dismiss() }
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

    // MARK: - Kakao
    func handleKakaoLogin() {
        isLoading = true
        let handle: (OAuthToken?, Error?) -> Void = { _, error in
            if error == nil { self.fetchKakaoUser() }
            else { print("❌ 카카오 로그인 실패:", error!); self.isLoading = false }
        }
        if UserApi.isKakaoTalkLoginAvailable() {
            UserApi.shared.loginWithKakaoTalk(completion: handle)
        } else {
            UserApi.shared.loginWithKakaoAccount(completion: handle)
        }
    }

    func fetchKakaoUser() {
        UserApi.shared.me { user, error in
            guard let user = user, error == nil else {
                print("❌ 카카오 유저정보 실패:", error!); self.isLoading = false; return
            }
            let id = String(user.id ?? 0)
            let email = user.kakaoAccount?.email ?? ""
            let nickname = user.kakaoAccount?.profile?.nickname ?? "카카오 사용자"
            self.navigateToMobilePage(path: "kakao", params: [
                "kakaoId": id, "email": email, "nickname": nickname
            ])
        }
    }

    // MARK: - Google
    func handleGoogleLogin() {
        isLoading = true
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootVC = windowScene.windows.first?.rootViewController else {
            print("❌ Google: rootVC 없음"); isLoading = false; return
        }
        // 네이티브 sheet 위에 Google이 뜰 수 있게 최상위 presenter 사용
        var presenter = rootVC
        while let presented = presenter.presentedViewController { presenter = presented }

        GIDSignIn.sharedInstance.signIn(withPresenting: presenter) { result, error in
            guard let user = result?.user, error == nil else {
                print("❌ 구글 로그인 실패:", error!); self.isLoading = false; return
            }
            let googleId = user.userID ?? ""
            let email = user.profile?.email ?? ""
            let name = user.profile?.name ?? "구글 사용자"
            self.navigateToMobilePage(path: "google", params: [
                "googleId": googleId, "email": email, "name": name
            ])
        }
    }

    // MARK: - Naver
    func handleNaverLogin() {
        isLoading = true
        let coordinator = NaverNativeLoginCoordinator { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let (naverId, email, name)):
                    self.navigateToMobilePage(path: "naver", params: [
                        "naverId": naverId, "email": email, "name": name
                    ])
                case .failure(let error):
                    print("❌ 네이버 로그인 실패:", error); self.isLoading = false
                }
                self.naverCoordinator = nil
            }
        }
        self.naverCoordinator = coordinator
        coordinator.signIn()
    }

    // MARK: - Apple
    func handleAppleLogin() {
        isLoading = true
        let coordinator = AppleNativeLoginCoordinator { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let (appleUserId, fullName)):
                    self.navigateToMobilePage(path: "apple", params: [
                        "appleUserId": appleUserId,
                        "fullName": fullName ?? ""
                    ])
                case .failure(let error):
                    print("❌ 애플 로그인 실패:", error); self.isLoading = false
                }
                self.appleCoordinator = nil
            }
        }
        self.appleCoordinator = coordinator
        coordinator.signIn()
    }

    // MARK: - Shared navigation
    func navigateToMobilePage(path: String, params: [String: String]) {
        let enc: (String) -> String = { $0.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? $0 }
        let query = params.map { "\($0.key)=\(enc($0.value))" }.joined(separator: "&")
        let urlStr = "\(kWebAppURL)/auth/\(path)/mobile?\(query)"
        DispatchQueue.main.async {
            if let webView = self.findWebView(), let url = URL(string: urlStr) {
                webView.load(URLRequest(url: url))
                self.isLoading = false
                self.dismiss()
            } else {
                print("❌ WebView 못 찾음")
                self.isLoading = false
            }
        }
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

// MARK: - Apple Sign In Coordinator
class AppleNativeLoginCoordinator: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private let completion: (Result<(String, String?), Error>) -> Void
    init(completion: @escaping (Result<(String, String?), Error>) -> Void) { self.completion = completion }

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
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential else {
            completion(.failure(NSError(domain: "Apple", code: -1))); return
        }
        // cred.user 는 Apple이 발급하는 고유한 안정적인 사용자 ID (재로그인 시에도 동일)
        let appleUserId = cred.user
        let fn = cred.fullName?.givenName ?? ""
        let ln = cred.fullName?.familyName ?? ""
        let fullName = [fn, ln].filter { !$0.isEmpty }.joined(separator: " ")
        completion(.success((appleUserId, fullName.isEmpty ? nil : fullName)))
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

// MARK: - Naver Sign In Coordinator
class NaverNativeLoginCoordinator: NSObject, NaverThirdPartyLoginConnectionDelegate {
    private let completion: (Result<(String, String, String), Error>) -> Void
    private let naver = NaverThirdPartyLoginConnection.getSharedInstance()

    init(completion: @escaping (Result<(String, String, String), Error>) -> Void) {
        self.completion = completion
        super.init()
    }

    func signIn() {
        naver?.delegate = self
        naver?.requestThirdPartyLogin()
    }

    func oauth20ConnectionDidFinishRequestACTokenWithAuthCode() { fetchUserInfo() }
    func oauth20ConnectionDidFinishRequestACTokenWithRefreshToken() { fetchUserInfo() }
    func oauth20ConnectionDidFinishDeleteToken() {}
    func oauth20Connection(_ oauthConnection: NaverThirdPartyLoginConnection?, didFailWithError error: Error?) {
        completion(.failure(error ?? NSError(domain: "Naver", code: -1)))
    }

    private func fetchUserInfo() {
        guard let accessToken = naver?.accessToken else {
            completion(.failure(NSError(domain: "Naver", code: -2))); return
        }
        let url = URL(string: "https://openapi.naver.com/v1/nid/me")!
        var req = URLRequest(url: url)
        req.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        URLSession.shared.dataTask(with: req) { [weak self] data, _, error in
            guard let data = data, error == nil,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let response = json["response"] as? [String: Any] else {
                self?.completion(.failure(error ?? NSError(domain: "Naver", code: -3))); return
            }
            let id = response["id"] as? String ?? ""
            let email = response["email"] as? String ?? ""
            let name = response["name"] as? String ?? response["nickname"] as? String ?? "네이버 사용자"
            self?.completion(.success((id, email, name)))
        }.resume()
    }
}
