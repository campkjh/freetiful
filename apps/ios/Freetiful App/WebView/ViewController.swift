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

private let nativeUserNavItems = [
    LiquidNavItem(id: "home", title: "홈", path: "/main", iconAssetName: "nav-home"),
    LiquidNavItem(id: "schedule", title: "스케줄", path: "/schedule", iconAssetName: "nav-schedule"),
    LiquidNavItem(id: "biz", title: "Biz", path: "/biz", iconAssetName: "nav-biz"),
    LiquidNavItem(id: "chat", title: "채팅", path: "/chat", iconAssetName: "nav-chat"),
    LiquidNavItem(id: "favorites", title: "찜", path: "/favorites", iconAssetName: "nav-favorites"),
    LiquidNavItem(id: "my", title: "마이", path: "/my", iconAssetName: "nav-my")
]

private let nativeProUserNavItems = nativeUserNavItems.filter { $0.id != "biz" }

private let nativeProNavItems = [
    LiquidNavItem(id: "home", title: "홈", path: "/pro-dashboard", iconAssetName: "nav-home"),
    LiquidNavItem(id: "requests", title: "새요청", path: "/pro-dashboard/inquiries", iconAssetName: "nav-requests"),
    LiquidNavItem(id: "schedule", title: "스케줄", path: "/schedule", iconAssetName: "nav-schedule"),
    LiquidNavItem(id: "chat", title: "채팅", path: "/chat", iconAssetName: "nav-chat"),
    LiquidNavItem(id: "my", title: "마이", path: "/my", iconAssetName: "nav-my")
]

class ViewController: UIViewController,
                      WKNavigationDelegate,
                      WKUIDelegate,
                      UIScrollViewDelegate,
                      WKScriptMessageHandler,
                      NaverThirdPartyLoginConnectionDelegate,
                      LiquidGlassNavigationBarDelegate {

    var webView: WKWebView!
    var logoAnimationView: LottieAnimationView!
    private let nativeNavBar = LiquidGlassNavigationBar()
    private var currentNativePath = "/"
    private var currentNativeActualIsPro = false
    private var currentNativeIsProMode = false
    private var currentNativeViewAsUser = false
    private var currentNativeHasBlockingOverlay = false
    private var nativeToastView: UIVisualEffectView?

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
        setupNativeNavigationBar()
        setupLoading()
        observeGoHomeNotification()
        observePushDeepLinkNotification()
        loadInitialPage()
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
        let nativeNavScript = WKUserScript(
            source: Self.nativeNavigationBridgeScript,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )

        let contentController = WKUserContentController()
        contentController.addUserScript(userScript)
        contentController.addUserScript(nativeNavScript)

        // JS → iOS 브릿지 등록
        ["kakaoLogin", "naverLogin", "googleLogin", "appleLogin", "socialLogout", "showNativeLogin", "oneSignalLogin", "nativeNavState"].forEach {
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

    private func setupNativeNavigationBar() {
        nativeNavBar.delegate = self
        nativeNavBar.alpha = 0
        nativeNavBar.transform = CGAffineTransform(translationX: 0, y: 22).scaledBy(x: 0.94, y: 0.94)
        view.addSubview(nativeNavBar)

        let compactWidth = nativeNavBar.widthAnchor.constraint(equalTo: view.widthAnchor, constant: -24)
        compactWidth.priority = .defaultHigh

        NSLayoutConstraint.activate([
            nativeNavBar.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            nativeNavBar.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 12),
            nativeNavBar.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -12),
            compactWidth,
            nativeNavBar.widthAnchor.constraint(lessThanOrEqualToConstant: 480),
            nativeNavBar.heightAnchor.constraint(equalToConstant: 66),
            nativeNavBar.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -8)
        ])
    }

    private static let nativeNavigationBridgeScript = """
    (function() {
      function ensureStyle() {
        if (document.getElementById('freetiful-ios-native-nav-style')) return;
        var style = document.createElement('style');
        style.id = 'freetiful-ios-native-nav-style';
        style.textContent = [
          'html.freetiful-ios-native-nav [data-nav-pill]{display:none!important;pointer-events:none!important;}',
          'html.freetiful-ios-native-nav [data-ios-mobile-bottom-nav]{display:none!important;pointer-events:none!important;}',
          'html.freetiful-ios-native-nav [data-ios-mobile-bottom-nav-blur]{display:none!important;pointer-events:none!important;}',
          'html.freetiful-ios-native-nav nav:has([data-nav-pill]){display:none!important;pointer-events:none!important;}',
          'html.freetiful-ios-native-nav [data-recommended-pro-bar]{display:none!important;pointer-events:none!important;}',
          'html.freetiful-ios-native-nav [data-ios-native-nav-hidden]{display:none!important;pointer-events:none!important;}'
        ].join('\\n');
        document.head && document.head.appendChild(style);
      }

      function hideRecommendedProBar() {
        var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-recommended-pro-bar], [style*="80px"], p'));
        nodes.forEach(function(node) {
          var text = node.textContent || '';
          var className = String(node.className || '');
          var styleText = String(node.getAttribute('style') || '');
          var isRecommendedBar =
            node.hasAttribute('data-recommended-pro-bar') ||
            text.indexOf('오늘의 추천 전문가') !== -1 ||
            (className.indexOf('pointer-events-none') !== -1 && styleText.indexOf('80px') !== -1);

          if (!isRecommendedBar) return;
          var target = node.closest('[data-recommended-pro-bar]') ||
            node.closest('div[class*="fixed"]') ||
            node.closest('button') ||
            node;
          target.setAttribute('data-ios-native-nav-hidden', 'true');
          target.style.setProperty('display', 'none', 'important');
          target.style.setProperty('pointer-events', 'none', 'important');
        });
      }

      function hideNode(node) {
        if (!node || !node.style) return;
        node.setAttribute('data-ios-native-nav-hidden', 'true');
        node.style.setProperty('display', 'none', 'important');
        node.style.setProperty('pointer-events', 'none', 'important');
      }

      function hideBottomNavCandidates() {
        var labels = ['홈', '새요청', '스케줄', '채팅', '마이', 'Biz', '찜'];
        var nodes = Array.prototype.slice.call(document.querySelectorAll('nav, footer, div'));
        nodes.forEach(function(node) {
          if (node.hasAttribute('data-ios-native-nav-hidden')) return;
          if (node.closest('[role="dialog"], [aria-modal="true"]')) return;
          var rect = node.getBoundingClientRect && node.getBoundingClientRect();
          if (!rect || rect.width <= 0 || rect.height <= 0) return;
          if (rect.height > 150 || rect.width < window.innerWidth * 0.45) return;

          var style = window.getComputedStyle ? window.getComputedStyle(node) : null;
          var position = style ? style.position : '';
          var bottom = style ? parseFloat(style.bottom || '999') : 999;
          var isFixedBottom = position === 'fixed' && (bottom <= 24 || rect.bottom >= window.innerHeight - 2);
          if (!isFixedBottom) return;

          var text = node.textContent || '';
          var labelMatches = labels.filter(function(label) { return text.indexOf(label) !== -1; }).length;
          var hasKnownPill = !!node.querySelector('[data-nav-pill]');
          var className = String(node.className || '');
          var looksLikeBottomNav = hasKnownPill ||
            labelMatches >= 3 ||
            (className.indexOf('pb-safe') !== -1 && className.indexOf('z-50') !== -1);

          if (looksLikeBottomNav) {
            hideNode(node);
          }
        });
      }

      function hideWebBottomNav() {
        document.documentElement.classList.add('freetiful-ios-native-nav');
        ensureStyle();
        hideRecommendedProBar();
        Array.prototype.slice.call(document.querySelectorAll('[data-ios-mobile-bottom-nav], [data-ios-mobile-bottom-nav-blur]')).forEach(function(node) {
          hideNode(node);
        });
        hideBottomNavCandidates();
        var pill = document.querySelector('[data-nav-pill]');
        if (!pill) return;
        var nav = pill.closest('nav');
        if (nav) {
          hideNode(nav);
          var prev = nav.previousElementSibling;
          if (prev && prev.className && String(prev.className).indexOf('bottom-0') !== -1) {
            hideNode(prev);
          }
        }
      }

      function readState() {
        var auth = {};
        try { auth = JSON.parse(localStorage.getItem('prettyful-auth') || '{}'); } catch (e) {}
        var user = (auth && auth.state && auth.state.user) ? auth.state.user : {};
        var role = user.role || localStorage.getItem('userRole') || 'general';
        var viewAsUser = localStorage.getItem('viewAsUser') === 'true';
        var actualIsPro = role === 'pro';
        var hasBlockingOverlay = !!document.querySelector('[aria-modal="true"], [role="dialog"]');
        return {
          path: window.location.pathname || '/',
          actualIsPro: actualIsPro,
          isProMode: actualIsPro && !viewAsUser,
          viewAsUser: viewAsUser,
          hasBlockingOverlay: hasBlockingOverlay
        };
      }

      window.__freetifulNativeNavPostState = function() {
        hideWebBottomNav();
        try {
          window.webkit &&
          window.webkit.messageHandlers &&
          window.webkit.messageHandlers.nativeNavState &&
          window.webkit.messageHandlers.nativeNavState.postMessage(readState());
        } catch (e) {}
      };

      if (window.__freetifulNativeNavInstalled) {
        window.__freetifulNativeNavPostState();
        return;
      }

      window.__freetifulNativeNavInstalled = true;

      // pushState/replaceState: pathname이 즉시 바뀌므로 딜레이 없이 바로 알림.
      // contentInset.bottom이 즉시 업데이트돼 채팅방 진입 시 하단 여백 제거.
      // 260ms 후 재알림은 role·overlay 같은 React 상태가 반영된 후 풀 싱크용.
      var notifyImmediate = function() {
        hideWebBottomNav();
        window.__freetifulNativeNavPostState && window.__freetifulNativeNavPostState();
        setTimeout(window.__freetifulNativeNavPostState, 260);
      };

      // popstate·storage 등 기타 이벤트는 약간의 딜레이 유지 (React 렌더 완료 대기)
      var notify = function() {
        hideWebBottomNav();
        setTimeout(window.__freetifulNativeNavPostState, 30);
        setTimeout(window.__freetifulNativeNavPostState, 260);
      };

      var pushState = history.pushState;
      history.pushState = function() {
        var result = pushState.apply(this, arguments);
        notifyImmediate();
        return result;
      };

      var replaceState = history.replaceState;
      history.replaceState = function() {
        var result = replaceState.apply(this, arguments);
        notifyImmediate();
        return result;
      };

      window.addEventListener('popstate', notify);
      window.addEventListener('storage', notify);
      window.addEventListener('freetiful:view-mode-changed', notify);
      document.addEventListener('click', function() { setTimeout(notify, 80); }, true);

      if (window.MutationObserver) {
        new MutationObserver(hideWebBottomNav).observe(document.documentElement, {
          childList: true,
          subtree: true
        });
      }

      notify();
      setTimeout(notify, 800);
    })();
    """

    private func handleNativeNavState(_ body: Any) {
        guard let state = body as? [String: Any] else { return }
        if let path = state["path"] as? String, !path.isEmpty {
            currentNativePath = path
        }
        if let actualIsPro = state["actualIsPro"] as? Bool {
            currentNativeActualIsPro = actualIsPro
        }
        if let isProMode = state["isProMode"] as? Bool {
            currentNativeIsProMode = isProMode
        }
        if let viewAsUser = state["viewAsUser"] as? Bool {
            currentNativeViewAsUser = viewAsUser
        }
        if let hasBlockingOverlay = state["hasBlockingOverlay"] as? Bool {
            currentNativeHasBlockingOverlay = hasBlockingOverlay
        }
        renderNativeNavigation(animated: true)
    }

    private func refreshNativeNavState() {
        webView.evaluateJavaScript("window.__freetifulNativeNavPostState && window.__freetifulNativeNavPostState();", completionHandler: nil)
    }

    private func updateNativePath(from url: URL?) {
        guard let url = url, (url.host ?? "").contains("freetiful.com") else { return }
        currentNativePath = url.path.isEmpty ? "/" : url.path
        renderNativeNavigation(animated: true)
    }

    private func renderNativeNavigation(animated: Bool) {
        let items: [LiquidNavItem]
        if currentNativeIsProMode {
            items = nativeProNavItems
        } else if currentNativeActualIsPro {
            items = nativeProUserNavItems
        } else {
            items = nativeUserNavItems
        }

        nativeNavBar.configure(
            items: items,
            selectedPath: currentNativePath,
            showsModeToggle: currentNativeActualIsPro,
            isProMode: currentNativeIsProMode
        )

        let hidden = currentNativeHasBlockingOverlay || shouldHideNativeNavigation(path: currentNativePath)
        nativeNavBar.setVisible(!hidden, animated: animated)
        webView.scrollView.contentInset.bottom = hidden ? 0 : 94
        webView.scrollView.verticalScrollIndicatorInsets.bottom = hidden ? 0 : 94
    }

    private func shouldHideNativeNavigation(path: String) -> Bool {
        if path.hasPrefix("/chat/") { return true }
        if path.hasPrefix("/pros/") { return true }
        if path.hasPrefix("/businesses") { return true }
        if path.hasPrefix("/my/") { return true }
        if path.hasPrefix("/notifications") { return true }
        if path.hasPrefix("/pro-register") { return true }
        if path.hasPrefix("/biz") { return true }
        if path.hasPrefix("/quote") { return true }
        if path.hasPrefix("/schedule/") { return true }
        if path.hasPrefix("/search") { return true }
        if path.hasPrefix("/match") { return true }
        if path.hasPrefix("/payment") { return true }
        if path.hasPrefix("/admin") { return true }
        if path == "/pros" || path == "/careers" { return true }
        return false
    }

    private func navigateNativeWeb(to path: String) {
        currentNativePath = path
        renderNativeNavigation(animated: true)

        let pathLiteral = jsLiteral(path)
        let urlLiteral = jsLiteral("\(kWebBase)\(path)")
        let script = """
        (function() {
          var path = \(pathLiteral);
          var url = \(urlLiteral);
          var link = document.querySelector('a[href="' + path + '"]');
          if (link) { link.click(); return; }
          if (typeof window.__freetifulNavigate === 'function') {
            window.__freetifulNavigate(path);
          } else {
            window.location.href = url;
          }
        })();
        """

        webView.evaluateJavaScript(script) { [weak self] _, error in
            if error != nil, let url = URL(string: "\(kWebBase)\(path)") {
                self?.webView.load(URLRequest(url: url))
            }
        }
    }

    private func jsLiteral(_ value: String) -> String {
        guard
            let data = try? JSONSerialization.data(withJSONObject: [value]),
            let json = String(data: data, encoding: .utf8)
        else {
            return "\"\(value)\""
        }
        return String(json.dropFirst().dropLast())
    }

    func liquidGlassNavigationBar(_ navBar: LiquidGlassNavigationBar, didSelect item: LiquidNavItem) {
        navigateNativeWeb(to: item.path)
    }

    func liquidGlassNavigationBarDidTapModeToggle(_ navBar: LiquidGlassNavigationBar) {
        guard currentNativeActualIsPro else { return }

        let nextViewAsUser = currentNativeIsProMode
        currentNativeViewAsUser = nextViewAsUser
        currentNativeIsProMode = !nextViewAsUser
        let targetPath = nextViewAsUser ? "/main" : "/pro-dashboard"
        let message = nextViewAsUser ? "일반회원으로 전환되었습니다" : "프로회원으로 전환되었습니다"
        showNativeModeToast(message)

        let nextLiteral = nextViewAsUser ? "true" : "false"
        let script = """
        (function() {
          var viewAsUser = \(nextLiteral);
          try {
            if (viewAsUser) localStorage.setItem('viewAsUser', 'true');
            else localStorage.removeItem('viewAsUser');
            window.dispatchEvent(new CustomEvent('freetiful:view-mode-changed', { detail: { viewAsUser: viewAsUser } }));
            if (window.__freetifulNativeNavPostState) window.__freetifulNativeNavPostState();
          } catch (e) {}
        })();
        """

        webView.evaluateJavaScript(script) { [weak self] _, _ in
            guard let self = self else { return }
            if self.currentNativePath == "/my" {
                self.refreshNativeNavState()
            } else {
                self.navigateNativeWeb(to: targetPath)
            }
        }
    }

    private func showNativeModeToast(_ message: String) {
        nativeToastView?.removeFromSuperview()

        let toast = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterial))
        toast.translatesAutoresizingMaskIntoConstraints = false
        toast.alpha = 0
        toast.layer.cornerRadius = 18
        toast.layer.cornerCurve = .continuous
        toast.clipsToBounds = true

        let label = UILabel()
        label.translatesAutoresizingMaskIntoConstraints = false
        label.text = message
        label.textColor = UIColor(red: 0.07, green: 0.09, blue: 0.14, alpha: 1)
        label.font = .systemFont(ofSize: 14, weight: .bold)
        label.textAlignment = .center
        toast.contentView.addSubview(label)
        view.addSubview(toast)
        nativeToastView = toast

        NSLayoutConstraint.activate([
            toast.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 10),
            toast.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            toast.heightAnchor.constraint(equalToConstant: 42),
            toast.widthAnchor.constraint(lessThanOrEqualTo: view.widthAnchor, multiplier: 0.88),

            label.leadingAnchor.constraint(equalTo: toast.contentView.leadingAnchor, constant: 18),
            label.trailingAnchor.constraint(equalTo: toast.contentView.trailingAnchor, constant: -18),
            label.centerYAnchor.constraint(equalTo: toast.contentView.centerYAnchor)
        ])

        toast.transform = CGAffineTransform(translationX: 0, y: -12).scaledBy(x: 0.96, y: 0.96)
        UIView.animate(
            withDuration: 0.34,
            delay: 0,
            usingSpringWithDamping: 0.76,
            initialSpringVelocity: 0.5,
            options: [.allowUserInteraction, .beginFromCurrentState]
        ) {
            toast.alpha = 1
            toast.transform = .identity
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) { [weak toast] in
            UIView.animate(withDuration: 0.24, animations: {
                toast?.alpha = 0
                toast?.transform = CGAffineTransform(translationX: 0, y: -8)
            }, completion: { _ in
                toast?.removeFromSuperview()
            })
        }
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

    private func loadInitialPage() {
        if let deepLink = OneSignalManager.shared.consumePendingDeepLink(),
           let path = normalizedInternalPath(from: deepLink) {
            loadInternalPath(path)
            return
        }
        loadHome()
    }

    private func loadHome() {
        let url = URL(string: "\(kWebBase)/")!
        // HTML 은 매번 서버 재검증 (Next.js 빌드 ID 변경 즉시 반영). JS/CSS 청크는 immutable 헤더로 캐시 유지.
        var req = URLRequest(url: url)
        req.cachePolicy = .reloadRevalidatingCacheData
        webView.load(req)
    }

    private func loadInternalPath(_ path: String) {
        guard let url = URL(string: "\(kWebBase)\(path)") else { return }
        currentNativePath = path
        var req = URLRequest(url: url)
        req.cachePolicy = .reloadRevalidatingCacheData
        webView.load(req)
    }

    private func normalizedInternalPath(from rawValue: String?) -> String? {
        guard let raw = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }

        if raw.hasPrefix("/") {
            return raw
        }

        if let url = URL(string: raw), let scheme = url.scheme?.lowercased() {
            if scheme == "http" || scheme == "https" {
                guard let host = url.host?.lowercased(), host == "freetiful.com" || host == "www.freetiful.com" else {
                    return nil
                }
                var path = url.path.isEmpty ? "/" : url.path
                if let query = url.query, !query.isEmpty {
                    path += "?\(query)"
                }
                return path
            }

            if scheme == "freetiful" {
                var path = ""
                if let host = url.host, !host.isEmpty {
                    path += "/\(host)"
                }
                path += url.path
                if path.isEmpty {
                    path = "/notifications"
                }
                if let query = url.query, !query.isEmpty {
                    path += "?\(query)"
                }
                return path
            }
        }

        return "/\(raw)"
    }

    // MARK: - WKNavigationDelegate
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        updateNativePath(from: webView.url)
        refreshNativeNavState()
        UIView.animate(withDuration: 0.3) { self.logoAnimationView.alpha = 0 } completion: { _ in
            self.logoAnimationView.removeFromSuperview()
            self.webView.isHidden = false
        }
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        updateNativePath(from: webView.url)
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

    // MARK: - WKWebView 마이크/카메라 권한 허용 (getUserMedia 녹음 지원)
    func webView(_ webView: WKWebView,
                 requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo,
                 type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.grant)
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
        case "nativeNavState": handleNativeNavState(message.body)
        case "oneSignalLogin":
            // 웹(자동로그인·세션복원 포함)에서 userId 전달 → OneSignal external_id 매핑
            if let userId = message.body as? String, !userId.isEmpty {
                print("📌 OneSignal.login(\(userId))")
                DispatchQueue.main.async { OneSignal.login(userId) }
            }
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

    /// Sheet에서 "나중에 하기" 또는 OAuth 취소 시 보내는 알림 옵저버.
    /// findWebView() 방식이 sheet 위의 scene을 집을 수 있어 WebView 참조가
    /// 안정적인 VC 레벨에서 직접 /main으로 네비게이션한다.
    func observeGoHomeNotification() {
        NotificationCenter.default.addObserver(
            forName: .goHomeRequested,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self = self, let url = URL(string: "\(kWebBase)/main") else { return }
            if let presented = self.presentedViewController {
                presented.dismiss(animated: true) { self.webView.load(URLRequest(url: url)) }
            } else {
                self.webView.load(URLRequest(url: url))
            }
        }

        /// Sheet에서 callAPI 성공 시 — JWT를 WebView localStorage에 주입해 자동로그인 준비.
        /// Sheet 내부의 findWebView()는 모달 위 scene을 집을 수 있어서 VC 레벨에서 주입.
        NotificationCenter.default.addObserver(
            forName: .loginCompleted,
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard let self = self,
                  let info = note.userInfo,
                  let accessToken  = info["accessToken"]  as? String,
                  let refreshToken = info["refreshToken"] as? String,
                  let userJSON     = info["userJSON"]     as? String else { return }
            let js = self.authInjectionScript(
                accessToken: accessToken,
                refreshToken: refreshToken,
                userJSON: userJSON
            )
            let inject = {
                self.webView.evaluateJavaScript(js) { _, err in
                    if let err = err { print("❌ loginCompleted JS 주입 실패:", err) }
                }
            }
            if let presented = self.presentedViewController {
                presented.dismiss(animated: true) {
                    inject()
                }
            } else {
                inject()
            }
        }
    }

    private func observePushDeepLinkNotification() {
        NotificationCenter.default.addObserver(
            forName: .pushDeepLinkRequested,
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard
                let self = self,
                let path = self.normalizedInternalPath(from: note.object as? String)
            else { return }

            let navigate = {
                if self.webView.url == nil {
                    self.loadInternalPath(path)
                } else {
                    self.navigateNativeWeb(to: path)
                }
            }

            if let presented = self.presentedViewController {
                presented.dismiss(animated: true) {
                    navigate()
                }
            } else {
                navigate()
            }
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

    private func authInjectionScript(accessToken: String, refreshToken: String, userJSON: String) -> String {
        let safe = { (s: String) in s.replacingOccurrences(of: "\\", with: "\\\\")
                                     .replacingOccurrences(of: "\"", with: "\\\"") }
        return """
        (function() {
          var payload = {
            user: \(userJSON),
            tokens: {
              accessToken: "\(safe(accessToken))",
              refreshToken: "\(safe(refreshToken))"
            }
          };
          var auth = {
            state: {
              user: payload.user,
              accessToken: payload.tokens.accessToken,
              refreshToken: payload.tokens.refreshToken
            },
            version: 0
          };
          localStorage.setItem('prettyful-auth', JSON.stringify(auth));
          localStorage.setItem('userRole', payload.user && payload.user.role ? payload.user.role : 'general');

          var goMain = function() { window.location.href = '\(kWebBase)/main'; };
          try {
            var handler = window.FreetifulAuth && window.FreetifulAuth.completeLogin
              ? window.FreetifulAuth.completeLogin
              : window.freetifulCompleteLogin;
            if (handler) {
              var result = handler(payload);
              if (result && typeof result.catch === 'function') result.catch(goMain);
            } else {
              goMain();
            }
          } catch (e) {
            goMain();
          }
        })();
        """
    }

    /// Zustand의 localStorage 키 `prettyful-auth`에 JWT를 주입하고 /main으로 이동합니다.
    private func injectJWT(accessToken: String, refreshToken: String, userJSON: String) {
        let js = authInjectionScript(
            accessToken: accessToken,
            refreshToken: refreshToken,
            userJSON: userJSON
        )
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
