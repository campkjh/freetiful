import UIKit
import SwiftUI
import WebKit
import KakaoSDKAuth
import KakaoSDKUser
import GoogleSignIn
import NaverThirdPartyLogin
import AuthenticationServices
import Lottie
import OneSignalFramework
import SafariServices

// ─── Config ───────────────────────────────────────────────────────────────────
private let kAPIBase  = "https://freetiful.com/api/v1"   // 프리티풀 API
private let kWebBase  = "https://freetiful.com"           // 프리티풀 웹앱
// ──────────────────────────────────────────────────────────────────────────────

class ViewController: UIViewController,
                      WKNavigationDelegate,
                      WKUIDelegate,
                      UIScrollViewDelegate,
                      WKScriptMessageHandler,
                      NaverThirdPartyLoginConnectionDelegate {

    var webView: WKWebView!
    var logoAnimationView: LottieAnimationView!

    // Apple Sign In coordinator (retained during auth flow)
    private var appleCoordinator: AppleSignInCoordinator?

    // MARK: - NaverThirdPartyLoginConnectionDelegate
    func oauth20ConnectionDidFinishRequestACTokenWithAuthCode()    { fetchNaverToken() }
    func oauth20ConnectionDidFinishRequestACTokenWithRefreshToken(){ fetchNaverToken() }
    func oauth20ConnectionDidFinishDeleteToken() {}
    func oauth20Connection(_ oauthConnection: NaverThirdPartyLoginConnection?,
                           didFailWithError error: Error?) {
        print("❌ 네이버 로그인 실패:", error?.localizedDescription ?? "unknown")
    }

    // MARK: - Life Cycle
    override func viewDidLoad() {
        super.viewDidLoad()
        setupWebView()
        setupLoading()
        loadHome()
    }

    // MARK: - WebView Setup
    private func setupWebView() {
        let metaScript = """
        var m=document.createElement('meta');
        m.name='viewport';
        m.content='width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no';
        document.head.appendChild(m);
        document.documentElement.style.webkitUserSelect='none';
        document.documentElement.style.webkitTouchCallout='none';
        """
        let userScript = WKUserScript(source: metaScript, injectionTime: .atDocumentEnd, forMainFrameOnly: true)

        let contentController = WKUserContentController()
        contentController.addUserScript(userScript)

        // JS → iOS 브릿지 등록
        ["kakaoLogin", "naverLogin", "googleLogin", "appleLogin", "socialLogout", "showNativeLogin"].forEach {
            contentController.add(self, name: $0)
        }

        let config = WKWebViewConfiguration()
        config.userContentController = contentController
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.scrollView.delegate = self
        webView.isHidden = true
        webView.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
        ])
    }

    // MARK: - Loading Animation
    private func setupLoading() {
        view.backgroundColor = .white
        logoAnimationView = LottieAnimationView(name: "freetiful_loading")
        logoAnimationView.loopMode = .loop
        logoAnimationView.play()
        logoAnimationView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(logoAnimationView)
        NSLayoutConstraint.activate([
            logoAnimationView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            logoAnimationView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            logoAnimationView.widthAnchor.constraint(equalToConstant: 48),
            logoAnimationView.heightAnchor.constraint(equalToConstant: 48),
        ])
    }

    private func loadHome() {
        webView.load(URLRequest(url: URL(string: "\(kWebBase)/")!))
    }

    // MARK: - WKNavigationDelegate
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        UIView.animate(withDuration: 0.3) { self.logoAnimationView.alpha = 0 } completion: { _ in
            self.logoAnimationView.removeFromSuperview()
            self.webView.isHidden = false
        }
    }

    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.allow); return }
        let host = url.host ?? ""

        if host.contains("apps.apple.com") || host.contains("play.google.com") || url.scheme == "tel" {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
            webView.load(URLRequest(url: url))
        }
        return nil
    }

    // MARK: - 줌 방지
    func scrollViewWillBeginZooming(_ scrollView: UIScrollView, with view: UIView?) {
        scrollView.pinchGestureRecognizer?.isEnabled = false
    }

    // MARK: - JS → iOS 메시지 수신
    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        print("📨 메시지 받음: \(message.name)")
        switch message.name {
        case "showNativeLogin": presentNativeLoginSheet()
        case "kakaoLogin":  presentNativeLoginSheet()  // 웹의 카카오 버튼 → 네이티브 sheet
        case "naverLogin":  startNaverLogin()
        case "googleLogin": startGoogleLogin()
        case "appleLogin":  startAppleLogin()
        case "socialLogout": socialLogout()
        default: break
        }
    }

    // MARK: - Native Login Sheet (Stady-style)
    private func presentNativeLoginSheet() {
        let host = UIHostingController(rootView: NativeLoginView())
        host.modalPresentationStyle = .formSheet
        DispatchQueue.main.async { [weak self] in
            self?.present(host, animated: true)
        }
    }

    // (카카오 로그인은 NativeLoginView.swift 의 Sheet 가 담당합니다)

    // MARK: - Naver Login
    private func startNaverLogin() {
        let naver = NaverThirdPartyLoginConnection.getSharedInstance()
        naver?.delegate = self
        naver?.requestThirdPartyLogin()
    }

    private func fetchNaverToken() {
        guard let accessToken = NaverThirdPartyLoginConnection.getSharedInstance()?.accessToken else { return }
        callAPI(endpoint: "/auth/login/naver/native", body: ["accessToken": accessToken])
    }

    // MARK: - Google Login
    private func startGoogleLogin() {
        guard let rootVC = view.window?.rootViewController else { return }
        GIDSignIn.sharedInstance.signIn(withPresenting: rootVC) { result, error in
            guard let user = result?.user, error == nil else {
                print("❌ 구글 로그인 실패:", error!); return
            }
            guard let idToken = user.idToken?.tokenString else {
                print("❌ 구글 idToken 없음"); return
            }
            self.callAPI(endpoint: "/auth/login/google", body: ["idToken": idToken])
        }
    }

    // MARK: - Apple Login
    private func startAppleLogin() {
        let coordinator = AppleSignInCoordinator { [weak self] result in
            switch result {
            case .success(let (identityToken, fullName)):
                var body: [String: Any] = ["identityToken": identityToken]
                if let name = fullName, !name.isEmpty { body["fullName"] = name }
                self?.callAPI(endpoint: "/auth/login/apple", body: body)
            case .failure(let error):
                print("❌ 애플 로그인 실패:", error)
            }
            self?.appleCoordinator = nil
        }
        appleCoordinator = coordinator
        coordinator.start()
    }

    // MARK: - Logout
    private func socialLogout() {
        OneSignal.logout()
    }

    // MARK: - API 호출 + JWT 주입
    // 프리티풀 API를 호출하고, 응답받은 JWT를 웹앱의 Zustand localStorage에 주입합니다.
    private func callAPI(endpoint: String, body: [String: Any]) {
        guard let url = URL(string: "\(kAPIBase)\(endpoint)") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            if let error = error { print("❌ API 실패:", error); return }
            guard
                let data = data,
                let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                let tokens = json["tokens"] as? [String: Any],
                let accessToken  = tokens["accessToken"]  as? String,
                let refreshToken = tokens["refreshToken"] as? String,
                let user = json["user"] as? [String: Any],
                let userId = user["id"] as? String
            else {
                print("❌ 응답 파싱 실패:", String(data: data ?? Data(), encoding: .utf8) ?? "")
                return
            }

            let userData = (try? JSONSerialization.data(withJSONObject: user)) ?? Data()
            let userJSON = String(data: userData, encoding: .utf8) ?? "{}"

            // OneSignal에 유저 연결
            DispatchQueue.main.async { OneSignal.login(userId) }

            self?.injectJWT(accessToken: accessToken, refreshToken: refreshToken, userJSON: userJSON)
        }.resume()
    }

    /// Zustand의 localStorage 키 `prettyful-auth`에 JWT를 주입하고 /main으로 이동합니다.
    private func injectJWT(accessToken: String, refreshToken: String, userJSON: String) {
        let safe = { (s: String) in s.replacingOccurrences(of: "\\", with: "\\\\")
                                     .replacingOccurrences(of: "\"", with: "\\\"") }
        let js = """
        (function() {
          var auth = { state: { user: \(userJSON), accessToken: "\(safe(accessToken))", refreshToken: "\(safe(refreshToken))" }, version: 0 };
          localStorage.setItem('prettyful-auth', JSON.stringify(auth));
          window.location.href = '\(kWebBase)/main';
        })();
        """
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript(js) { _, err in
                if let err = err { print("❌ JS 주입 실패:", err) }
            }
        }
    }
}

// MARK: - Apple Sign In Coordinator
class AppleSignInCoordinator: NSObject,
                               ASAuthorizationControllerDelegate,
                               ASAuthorizationControllerPresentationContextProviding {

    private let completion: (Result<(String, String?), Error>) -> Void

    init(completion: @escaping (Result<(String, String?), Error>) -> Void) {
        self.completion = completion
    }

    func start() {
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
            completion(.failure(NSError(domain: "Apple", code: -1)))
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
