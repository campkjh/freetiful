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
import AVFoundation

// ─── Config ───────────────────────────────────────────────────────────────────
private let kAPIBase  = "https://freetiful.com/api/v1"   // 프리티풀 API
private let kWebBase  = "https://freetiful.com"           // 프리티풀 웹앱
private let kWebHosts: Set<String> = ["freetiful.com", "www.freetiful.com"]
// ──────────────────────────────────────────────────────────────────────────────

// 웹 하단 탭과 같은 구성 (apps/web/src/app/(main)/layout.tsx 의 USER_NAV_ITEMS / PRO_NAV_ITEMS)
// 매칭(고객)·새요청(사회자) 은 웹에서 다른 아이콘이라 nav-match / nav-requests 를 따로 쓴다.
private let nativeUserNavItems = [
    LiquidNavItem(id: "home", title: "홈", path: "/main", iconAssetName: "nav-home"),
    LiquidNavItem(id: "community", title: "웨딩숲", path: "/community", iconAssetName: "nav-community"),
    LiquidNavItem(id: "inquiries", title: "매칭", path: "/inquiries", iconAssetName: "nav-match"),
    LiquidNavItem(id: "chat", title: "채팅", path: "/chat", iconAssetName: "nav-chat"),
    LiquidNavItem(id: "my", title: "마이", path: "/my", iconAssetName: "nav-my")
]

private let nativeProNavItems = [
    LiquidNavItem(id: "home", title: "홈", path: "/main", iconAssetName: "nav-home"),
    LiquidNavItem(id: "community", title: "웨딩숲", path: "/community", iconAssetName: "nav-community"),
    LiquidNavItem(id: "requests", title: "새요청", path: "/pro-dashboard/inquiries", iconAssetName: "nav-requests"),
    LiquidNavItem(id: "chat", title: "채팅", path: "/chat", iconAssetName: "nav-chat"),
    LiquidNavItem(id: "my", title: "마이", path: "/my", iconAssetName: "nav-my")
]

/// 프리티풀 iOS = 화면은 전부 웹, 하단 탭바만 네이티브(260927 사장 "네이티브 걷어내고 딱 네비게이션바만 네이티브로").
///  · 웹에서 고친 게 앱에도 그대로 보인다 — 앱 자체 화면(홈·채팅·새요청·마이·상세·알림·검색·빌라드지디 랜딩 …)은 모두 뺐다.
///  · 네이티브로 남긴 것: 하단 탭바, 로그인(카카오·네이버·구글·애플 SDK + 로그인 시트 — 웹 로그인 창엔 애플 로그인이 없어
///    앱스토어 심사(다른 소셜 로그인이 있으면 애플도 필수) 때문에 시트 유지), 푸시(OneSignal)·푸시로 열기, 첫 로딩 애니메이션,
///    JS 알림창(alert/confirm/prompt), 바깥 링크(전화·문자·지도·결제 앱은 그 앱으로, 다른 사이트는 인앱 사파리로).
///  · 탭바는 웹이 알려 주는 상태로만 그린다 — 웹 하단 탭([data-ios-mobile-bottom-nav])이 그려진 화면에서만 보이고,
///    웹 모달(role=dialog)이 떠 있으면 숨는다. 웹 하단 탭 자체는 CSS 로 숨긴다.
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

    // 웹이 알려 준 현재 상태(nativeNavState)
    private var currentPath = "/"
    private var isActualPro = false
    private var hasWebNav = false            // 웹이 하단 탭을 그리는 화면인지 — 웹 layout 의 HIDE_NAV_PATTERNS 결과를 그대로 따른다
    private var hasBlockingOverlay = false   // 웹 모달이 떠 있는지
    private var navBadges: [String: Int] = [:]

    private var didShowFirstPage = false
    private var didFinishFirstLoad = false   // 첫 화면을 한 번이라도 다 받았는지 — 그 전의 실패만 '다시 시도' 화면
    private var loadErrorView: UIView?
    // 파일 받기(웹 채팅 첨부 등) — 받는 중인 파일의 저장 위치, 미리보기 창
    private var downloadDestinations: [ObjectIdentifier: URL] = [:]
    private var filePreview: UIDocumentInteractionController?
    private var pendingPushSubscriptionId: String?

    // Apple Sign In coordinator (retained during auth flow)
    private var appleCoordinator: AppleSignInCoordinator?

    // MARK: - NaverThirdPartyLoginConnectionDelegate
    func oauth20ConnectionDidFinishRequestACTokenWithAuthCode()    { fetchNaverToken() }
    func oauth20ConnectionDidFinishRequestACTokenWithRefreshToken(){ fetchNaverToken() }
    func oauth20ConnectionDidFinishDeleteToken() {}
    func oauth20Connection(_ oauthConnection: NaverThirdPartyLoginConnection?,
                           didFailWithError error: Error?) {
        print("❌ 네이버 로그인 실패/취소:", error?.localizedDescription ?? "unknown")
        // 사용자가 네이버 OAuth 를 취소하면 웹이 로그인 전환 로딩 상태에 멈춤(무한로딩) →
        // 전환 플래그 정리 + 현재 페이지 새로고침으로 복구하고 안내 토스트 표시.
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.webView.evaluateJavaScript("try{sessionStorage.removeItem('freetiful-auth-switching');}catch(e){}") { [weak self] _, _ in
                self?.webView.reload()
            }
            self.showToast("로그인이 취소되었어요")
        }
    }

    // MARK: - Life Cycle
    override func viewDidLoad() {
        super.viewDidLoad()
        // 전역 오디오 세션 — 기본 .soloAmbient 는 무음 스위치 ON 이면 인라인 <video> 소리를 죽임
        // ("영상 소리 안 남" QA). .playback + mixWithOthers 로 무음 스위치를 무시하되
        // 앱 실행만으로 다른 앱 음악을 끊지 않게 setActive 는 호출하지 않는다(재생 시 자동 활성).
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback, options: [.mixWithOthers])
        } catch {
            print("⚠️ AVAudioSession 카테고리 설정 실패: \(error)")
        }
        clearLegacyNativeCaches()
        setupWebView()
        setupNativeNavigationBar()
        setupLoading()
        observeGoHomeNotification()
        observePushIdNotification()
        observePushDeepLinkNotification()
        loadInitialPage()
        OneSignalManager.shared.deliverCurrentPushId()
    }

    /// 예전 네이티브 화면들이 남긴 디스크 캐시(개인 채팅·요청 목록, 홈·상세 데이터, 토큰 사본) — 이제 안 쓰므로 지운다
    private func clearLegacyNativeCaches() {
        let defaults = UserDefaults.standard
        let exact: Set<String> = ["ftInquiryRows", "ftChatRows", "ftAccessToken", "ftCustomerInquiries", "ftInquiryTab", "ftChatTab"]
        let prefixes = ["ftHomeV2_", "ftProDetail_", "ftBizCat_", "ftBizDetail_"]
        for key in defaults.dictionaryRepresentation().keys where exact.contains(key) || prefixes.contains(where: { key.hasPrefix($0) }) {
            defaults.removeObject(forKey: key)
        }
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
        let contentController = WKUserContentController()
        contentController.addUserScript(WKUserScript(source: metaScript, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        contentController.addUserScript(WKUserScript(source: Self.navBridgeScript, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        #if DEBUG
        // 개발용: `simctl launch … -debugJS "…"` — 페이지마다 맨 먼저 실행(첫 화면 팝업 끄기·뱃지 흉내 등). 출시 빌드엔 없음
        if let debugJS = UserDefaults.standard.string(forKey: "debugJS"), !debugJS.isEmpty {
            contentController.addUserScript(WKUserScript(source: debugJS, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        #endif

        // JS → iOS 브릿지 — 로그인·푸시·탭바 상태만 남긴다
        ["kakaoLogin", "naverLogin", "googleLogin", "appleLogin", "socialLogout", "showNativeLogin",
         "oneSignalLogin", "pushLogin", "setOneSignalExternalId", "nativeNavState"].forEach {
            contentController.add(self, name: $0)
        }

        let config = WKWebViewConfiguration()
        config.userContentController = contentController
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // 앱 시작 시 WKWebView 디스크/메모리 캐시 1회 비움 — 옛 JS 번들 고착으로 배포 수정이
        // 앱에 반영 안 되던 문제 방지(웹 수정 즉시 반영)
        WKWebsiteDataStore.default().removeData(
            ofTypes: [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache],
            modifiedSince: Date(timeIntervalSince1970: 0),
            completionHandler: {}
        )

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.scrollView.delegate = self
        webView.allowsBackForwardNavigationGestures = true   // 좌→우 스와이프 = 웹 뒤로가기(탭 화면에선 끔 — renderNavigation)
        webView.isHidden = true
        webView.translatesAutoresizingMaskIntoConstraints = false
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        #endif

        view.addSubview(webView)
        // 위아래 안전영역 안쪽 — 웹은 앱 안에서 safe-area-inset 을 0 으로 보고 그려져 있다(globals.css .pb-safe 주석)
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

        let compactWidth = nativeNavBar.widthAnchor.constraint(equalTo: view.widthAnchor, constant: -12)
        compactWidth.priority = .defaultHigh

        NSLayoutConstraint.activate([
            nativeNavBar.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            nativeNavBar.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 6),
            nativeNavBar.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -6),
            compactWidth,
            nativeNavBar.widthAnchor.constraint(lessThanOrEqualToConstant: 600),
            nativeNavBar.heightAnchor.constraint(equalToConstant: 80),
            // 하단 safe area 무시하고 화면 맨 아래에 붙임
            nativeNavBar.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        renderNavigation(animated: false)
    }

    /// 웹 → 탭바 상태 브리지.
    ///  · 웹 하단 탭은 CSS 로 숨기고(요소는 남아 있어 '이 화면에 탭이 있나'의 표시로 쓴다), 상태가 바뀔 때만 한 번씩 알린다.
    ///  · 화면 이동(pushState/replaceState/popstate)과 DOM 변화(모달 열고 닫기·탭 생기고 사라짐)를 짧게 모아 확인 —
    ///    확인은 querySelector 몇 번뿐이라 가볍다(예전처럼 nav/div 전부 훑으며 레이아웃을 재지 않는다).
    private static let navBridgeScript = """
    (function() {
      if (window.__freetifulNativeNavInstalled) {
        if (window.__freetifulNativeNavPostState) window.__freetifulNativeNavPostState(true);
        return;
      }
      window.__freetifulNativeNavInstalled = true;

      // 웹 하단 탭 숨김 — 페이지가 그리는 중(하이드레이션·레이아웃 전환)에 html 클래스·<style> 이 지워지는 화면이 있어
      // (웨딩숲에서 웹 탭이 네이티브 탭바 위로 삐져나옴) 확인할 때마다 다시 붙이고, 탭 요소에도 직접 display:none 을 건다.
      function ensureWebNavHidden() {
        var root = document.documentElement;
        if (!root.classList.contains('freetiful-ios-native-nav')) root.classList.add('freetiful-ios-native-nav');
        if (!document.getElementById('freetiful-ios-native-nav-style')) {
          var style = document.createElement('style');
          style.id = 'freetiful-ios-native-nav-style';
          style.textContent = 'html.freetiful-ios-native-nav [data-ios-mobile-bottom-nav],' +
            'html.freetiful-ios-native-nav [data-ios-mobile-bottom-nav-blur]{display:none!important;pointer-events:none!important;}';
          (document.head || root).appendChild(style);
        }
        var navs = document.querySelectorAll('[data-ios-mobile-bottom-nav], [data-ios-mobile-bottom-nav-blur]');
        for (var i = 0; i < navs.length; i++) {
          if (navs[i].style.getPropertyValue('display') !== 'none') navs[i].style.setProperty('display', 'none', 'important');
        }
      }
      ensureWebNavHidden();

      function overlayOpen() {
        var list = document.querySelectorAll('[aria-modal="true"], [role="dialog"]');
        for (var i = 0; i < list.length; i++) {
          var r = list[i].getBoundingClientRect();
          if (r.width < 2 || r.height < 2) continue;
          if (r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth) continue;
          var cs = window.getComputedStyle(list[i]);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          return true;
        }
        return false;
      }

      function readState() {
        var auth = {};
        try { auth = JSON.parse(localStorage.getItem('prettyful-auth') || '{}'); } catch (e) {}
        var user = (auth && auth.state && auth.state.user) ? auth.state.user : {};
        var role = user.role || localStorage.getItem('userRole') || 'general';
        var badges = {};
        try { badges = window.__freetifulNavBadges || {}; } catch (e) {}
        return {
          path: window.location.pathname || '/',
          actualIsPro: role === 'pro',
          hasWebNav: !!document.querySelector('[data-ios-mobile-bottom-nav]'),
          hasBlockingOverlay: overlayOpen(),
          badges: badges
        };
      }

      var last = '';
      window.__freetifulNativeNavPostState = function(force) {
        ensureWebNavHidden();
        var s = readState();
        var key = JSON.stringify(s);
        if (force !== true && key === last) return;
        last = key;
        try { window.webkit.messageHandlers.nativeNavState.postMessage(s); } catch (e) {}
      };

      var timer = 0;
      var schedule = function() {
        if (timer) return;
        timer = setTimeout(function() { timer = 0; window.__freetifulNativeNavPostState(false); }, 80);
      };
      var notify = function() {
        schedule();
        setTimeout(function() { window.__freetifulNativeNavPostState(false); }, 320);
      };

      var pushState = history.pushState;
      history.pushState = function() { var r = pushState.apply(this, arguments); notify(); return r; };
      var replaceState = history.replaceState;
      history.replaceState = function() { var r = replaceState.apply(this, arguments); notify(); return r; };
      window.addEventListener('popstate', notify);
      window.addEventListener('storage', notify);
      window.addEventListener('pageshow', function() { window.__freetifulNativeNavPostState(true); });

      if (window.MutationObserver) {
        var observe = function() {
          if (!document.body) { setTimeout(observe, 50); return; }
          new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
        };
        observe();
      }

      window.__freetifulNativeNavPostState(true);
      setTimeout(function() { window.__freetifulNativeNavPostState(false); }, 800);
    })();
    """

    // MARK: - 탭바
    private func handleNavState(_ body: Any) {
        guard let state = body as? [String: Any] else { return }
        if let path = state["path"] as? String, !path.isEmpty { currentPath = path }
        isActualPro = (state["actualIsPro"] as? Bool) ?? false
        hasWebNav = (state["hasWebNav"] as? Bool) ?? false
        hasBlockingOverlay = (state["hasBlockingOverlay"] as? Bool) ?? false
        if let badges = state["badges"] as? [String: Any] {
            var parsed: [String: Int] = [:]
            for (key, value) in badges {
                if let n = value as? Int { parsed[key] = n }
                else if let d = value as? Double { parsed[key] = Int(d) }
            }
            navBadges = parsed
        }
        renderNavigation(animated: true)
    }

    private func refreshNavState() {
        webView.evaluateJavaScript("window.__freetifulNativeNavPostState && window.__freetifulNativeNavPostState(true);", completionHandler: nil)
    }

    private func renderNavigation(animated: Bool) {
        // 웹과 동일: role === 'pro' 이면 사회자 탭, 아니면 고객 탭
        nativeNavBar.configure(
            items: isActualPro ? nativeProNavItems : nativeUserNavItems,
            selectedPath: currentPath,
            showsModeToggle: false,
            isProMode: false
        )
        // 지금 보고 있는 탭의 뱃지는 바로 숨김(새요청/채팅 진입 = 확인) — 웹 카운트 갱신 지연과 무관하게
        var displayBadges = navBadges
        if currentPath == "/pro-dashboard/inquiries" { displayBadges["requests"] = 0 }
        if currentPath == "/chat" || currentPath.hasPrefix("/chat/") { displayBadges["chat"] = 0 }
        nativeNavBar.setBadges(displayBadges)

        nativeNavBar.setVisible(didShowFirstPage && hasWebNav && !hasBlockingOverlay, animated: animated)
        // 탭 화면에선 WKWebView 스와이프 뒤로가기를 끈다 — 탭 전환은 기록을 안 쌓아서(replace)
        // 스와이프하면 엉뚱한 옛 화면으로 가던 것. 상세 화면에선 켠다.
        webView?.allowsBackForwardNavigationGestures = !isTopLevelTab(currentPath)
    }

    private func isTopLevelTab(_ path: String) -> Bool {
        ["/", "/main", "/community", "/inquiries", "/pro-dashboard/inquiries", "/chat", "/my"].contains(path)
    }

    func liquidGlassNavigationBar(_ navBar: LiquidGlassNavigationBar, didSelect item: LiquidNavItem) {
        if item.path == currentPath || (item.path == "/main" && currentPath == "/") {
            // 같은 탭을 다시 누르면 맨 위로(기록은 안 쌓는다)
            webView.evaluateJavaScript("window.scrollTo({ top: 0, behavior: 'smooth' });", completionHandler: nil)
            return
        }
        navigateWeb(to: item.path, replace: true)   // 탭 전환은 기록에 안 쌓음
    }

    func liquidGlassNavigationBarDidTapModeToggle(_ navBar: LiquidGlassNavigationBar) {}

    /// 웹 안에서 이동 — (main) 레이아웃이 있으면 SPA 라우팅(__freetifulNavigate), 없으면 주소 이동
    private func navigateWeb(to path: String, replace: Bool = false) {
        currentPath = path.split(separator: "?").first.map(String.init) ?? path
        renderNavigation(animated: true)   // 누른 탭이 바로 선택돼 보이게

        let script = """
        (function() {
          var path = \(jsLiteral(path));
          var rep = \(replace ? "true" : "false");
          if (window.__freetifulNavigate) { window.__freetifulNavigate(path, rep); return; }
          var url = \(jsLiteral("\(kWebBase)\(path)"));
          if (rep) { window.location.replace(url); } else { window.location.href = url; }
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

    // MARK: - Loading
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
        var debugStart: String?
        var debugURL: URL?
        #if DEBUG
        // 개발용: `simctl launch … -startPath /community`(또는 -startURL 전체 주소) 로 첫 화면을 고른다(출시 빌드엔 없음)
        debugStart = UserDefaults.standard.string(forKey: "startPath").flatMap { $0.hasPrefix("/") ? $0 : nil }
        debugURL = UserDefaults.standard.string(forKey: "startURL").flatMap { URL(string: $0) }
        #endif
        if let url = debugURL {
            webView.load(URLRequest(url: url))
        } else if let start = debugStart {
            loadInternalPath(start)
        } else if let deepLink = OneSignalManager.shared.consumePendingDeepLink(),
                  let path = normalizedInternalPath(from: deepLink) {
            loadInternalPath(path)
        } else {
            loadHome()
        }
        // 느린 망 안전장치 — 첫 화면이 다 받아지지 않아도 6초 뒤엔 로딩 화면을 걷고 웹이 그린 만큼 보인다
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { [weak self] in
            guard let self = self, self.loadErrorView == nil else { return }
            self.revealWeb()
        }
    }

    private func loadHome() {
        // 캐시 무시 로드 — WKWebView 가 옛 JS 번들을 붙잡고 있어 배포한 수정이 앱에 반영 안 되던 문제 방지
        var request = URLRequest(url: URL(string: "\(kWebBase)/main")!)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        currentPath = "/main"
        webView.load(request)
    }

    private func loadInternalPath(_ path: String) {
        guard let url = URL(string: "\(kWebBase)\(path)") else { return }
        currentPath = path.split(separator: "?").first.map(String.init) ?? path
        webView.load(URLRequest(url: url))
    }

    private func revealWeb() {
        guard !didShowFirstPage else { return }
        didShowFirstPage = true
        webView.isHidden = false
        if let lav = logoAnimationView, lav.superview != nil {
            UIView.animate(withDuration: 0.25) { lav.alpha = 0 } completion: { _ in lav.removeFromSuperview() }
        }
        renderNavigation(animated: true)
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
                guard let host = url.host?.lowercased(), kWebHosts.contains(host) else {
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

    // MARK: - 첫 화면 실패(오프라인 등)
    private func showLoadError() {
        guard loadErrorView == nil else { return }
        logoAnimationView?.removeFromSuperview()

        let box = UIView()
        box.backgroundColor = .white
        box.translatesAutoresizingMaskIntoConstraints = false

        let title = UILabel()
        title.text = "인터넷 연결을 확인해 주세요"
        title.font = .systemFont(ofSize: 18, weight: .bold)
        title.textColor = UIColor(red: 0.10, green: 0.12, blue: 0.16, alpha: 1)
        title.textAlignment = .center

        let sub = UILabel()
        sub.text = "연결되면 다시 시도를 눌러 주세요."
        sub.font = .systemFont(ofSize: 15)
        sub.textColor = UIColor(red: 0.55, green: 0.58, blue: 0.63, alpha: 1)
        sub.textAlignment = .center

        var config = UIButton.Configuration.filled()
        config.title = "다시 시도"
        config.baseBackgroundColor = UIColor(red: 0.19, green: 0.51, blue: 0.96, alpha: 1)
        config.cornerStyle = .large
        config.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 28, bottom: 12, trailing: 28)
        let retry = UIButton(configuration: config, primaryAction: UIAction { [weak self] _ in self?.retryFirstLoad() })

        let stack = UIStackView(arrangedSubviews: [title, sub, retry])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 10
        stack.setCustomSpacing(24, after: sub)
        stack.translatesAutoresizingMaskIntoConstraints = false
        box.addSubview(stack)
        view.addSubview(box)
        NSLayoutConstraint.activate([
            box.topAnchor.constraint(equalTo: view.topAnchor),
            box.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            box.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            box.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            stack.centerXAnchor.constraint(equalTo: box.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: box.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: box.leadingAnchor, constant: 24),
        ])
        loadErrorView = box
    }

    private func retryFirstLoad() {
        loadErrorView?.removeFromSuperview()
        loadErrorView = nil
        if webView.url != nil { webView.reload() } else { loadHome() }
    }

    // MARK: - WKNavigationDelegate
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        didFinishFirstLoad = true
        loadErrorView?.removeFromSuperview()
        loadErrorView = nil
        revealWeb()
        refreshNavState()
        flushPendingPushSubscriptionId()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handleLoadError(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleLoadError(error)
    }

    private func handleLoadError(_ error: Error) {
        let e = error as NSError
        // 취소(-999: 다른 주소로 넘어감)·앱으로 넘긴 링크(WebKit 102: 프레임 로드 중단)는 실패가 아니다
        if e.domain == NSURLErrorDomain && e.code == NSURLErrorCancelled { return }
        if e.domain == "WebKitErrorDomain" && e.code == 102 { return }
        print("❌ 웹 로드 실패:", e.domain, e.code, e.localizedDescription)
        // 첫 화면을 아직 한 번도 다 못 받았을 때만 안내(느린 망에서 6초 뒤 로딩 화면을 걷은 뒤 실패해도 포함).
        // 이미 떠 있는 화면은 WKWebView 가 그대로 두고 웹이 알아서 다시 받는다.
        if !didFinishFirstLoad { showLoadError() }
    }

    /// 웹 콘텐츠 프로세스가 죽으면(메모리 부족) 흰 화면만 남는다 → 다시 불러온다
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        if webView.url != nil { webView.reload() } else { loadHome() }
    }

    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.allow); return }
        let scheme = (url.scheme ?? "").lowercased()
        let host = (url.host ?? "").lowercased()

        // 파일 받기(<a download>·blob — 웹 채팅 첨부 파일) → 앱이 받아서 미리보기로
        if navigationAction.shouldPerformDownload {
            decisionHandler(.download)
            return
        }
        // 웹 주소가 아니면 그 앱으로(전화·문자·메일·카카오·지도·결제 앱 등)
        if !["http", "https", "about", "blob", "data", "javascript"].contains(scheme) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            decisionHandler(.cancel)
            return
        }
        if host.hasSuffix("apps.apple.com") || host.hasSuffix("itunes.apple.com") {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            decisionHandler(.cancel)
            return
        }
        // 우리 화면에서 누른 다른 사이트 링크는 인앱 사파리로 — 앱 화면이 남의 사이트로 바뀌지 않게.
        // (결제·로그인처럼 스크립트가 넘기는 이동은 그대로 둔다)
        let isMainFrame = navigationAction.targetFrame?.isMainFrame ?? true
        let fromOurPage = kWebHosts.contains((webView.url?.host ?? "").lowercased())
        if isMainFrame, navigationAction.navigationType == .linkActivated, fromOurPage,
           scheme == "http" || scheme == "https", !kWebHosts.contains(host) {
            openInAppBrowser(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    // window.open / target=_blank — 우리 주소는 이 화면에서, 다른 사이트는 인앱 사파리로
    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard navigationAction.targetFrame == nil, let url = navigationAction.request.url else { return nil }
        let scheme = (url.scheme ?? "").lowercased()
        if scheme == "http" || scheme == "https" {
            if kWebHosts.contains((url.host ?? "").lowercased()) {
                webView.load(URLRequest(url: url))
            } else {
                openInAppBrowser(url)
            }
        } else {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }
        return nil
    }

    private func openInAppBrowser(_ url: URL) {
        let safari = SFSafariViewController(url: url)
        safari.dismissButtonStyle = .close
        topPresenter().present(safari, animated: true)
    }

    /// 화면에 못 띄우는 파일(첨부로 내려오는 응답 등)은 받아서 미리보기로
    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        let disposition = (navigationResponse.response as? HTTPURLResponse)?
            .value(forHTTPHeaderField: "Content-Disposition")?.lowercased() ?? ""
        if navigationResponse.isForMainFrame && (!navigationResponse.canShowMIMEType || disposition.hasPrefix("attachment")) {
            decisionHandler(.download)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    private func topPresenter() -> UIViewController {
        var top: UIViewController = self
        while let presented = top.presentedViewController { top = presented }
        return top
    }

    // MARK: - 줌 방지
    func scrollViewWillBeginZooming(_ scrollView: UIScrollView, with view: UIView?) {
        scrollView.pinchGestureRecognizer?.isEnabled = false
    }

    // MARK: - JS → iOS 메시지 수신
    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        switch message.name {
        case "showNativeLogin": presentNativeLoginSheet()
        case "kakaoLogin":  startKakaoLogin()
        case "naverLogin":  startNaverLogin()
        case "googleLogin": startGoogleLogin()
        case "appleLogin":  startAppleLogin()
        case "socialLogout": socialLogout()
        case "nativeNavState": handleNavState(message.body)
        case "oneSignalLogin", "pushLogin", "setOneSignalExternalId":
            // 웹(자동로그인·세션복원 포함)에서 userId 전달 → OneSignal external_id 매핑
            if let userId = message.body as? String, !userId.isEmpty {
                print("📌 OneSignal.login(\(userId))")
                DispatchQueue.main.async {
                    OneSignal.login(userId)
                    self.schedulePushIdentityRefresh()
                }
            }
        default: break
        }
    }

    // MARK: - 토스트
    private func showToast(_ text: String) {
        let label = UILabel()
        label.text = text
        label.font = .systemFont(ofSize: 14, weight: .medium)
        label.textColor = .white
        label.textAlignment = .center
        label.numberOfLines = 0
        label.translatesAutoresizingMaskIntoConstraints = false

        let pill = UIView()
        pill.backgroundColor = UIColor.black.withAlphaComponent(0.82)
        pill.layer.cornerRadius = 18
        pill.layer.cornerCurve = .continuous
        pill.alpha = 0
        pill.translatesAutoresizingMaskIntoConstraints = false
        pill.addSubview(label)
        view.addSubview(pill)
        NSLayoutConstraint.activate([
            label.topAnchor.constraint(equalTo: pill.topAnchor, constant: 10),
            label.bottomAnchor.constraint(equalTo: pill.bottomAnchor, constant: -10),
            label.leadingAnchor.constraint(equalTo: pill.leadingAnchor, constant: 16),
            label.trailingAnchor.constraint(equalTo: pill.trailingAnchor, constant: -16),
            pill.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            pill.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -90),
            pill.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 40),
        ])
        UIView.animate(withDuration: 0.25, animations: { pill.alpha = 1 }) { _ in
            UIView.animate(withDuration: 0.3, delay: 1.8, options: [], animations: { pill.alpha = 0 }) { _ in pill.removeFromSuperview() }
        }
    }

    // MARK: - Native Login Sheet
    private func presentNativeLoginSheet() {
        let host = UIHostingController(rootView: NativeLoginView())
        host.modalPresentationStyle = .overFullScreen   // 앱 위 글래스 바텀시트
        host.view.backgroundColor = .clear
        DispatchQueue.main.async { [weak self] in
            // 슬라이드업/딤 페이드는 NativeLoginView 내부에서 처리 → 표준 전환 끔
            guard let self = self, self.presentedViewController == nil else { return }
            self.present(host, animated: false)
        }
    }

    /// Sheet에서 "나중에 하기" 또는 OAuth 취소 시 보내는 알림 옵저버 — /main 으로.
    /// Sheet 안에서 웹뷰를 찾으면 시트 위 scene 을 집을 수 있어 VC 에서 직접 처리한다.
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

        /// Sheet에서 로그인 성공 — JWT를 WebView localStorage에 주입해 로그인 상태로.
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
                    self.schedulePushIdentityRefresh()
                }
            }
            if let presented = self.presentedViewController {
                presented.dismiss(animated: true) { inject() }
            } else {
                inject()
            }
        }
    }

    // MARK: - Push
    private func observePushIdNotification() {
        NotificationCenter.default.addObserver(
            forName: .didReceivePushId,
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard let self = self, let pushId = note.object as? String, !pushId.isEmpty else { return }
            self.pendingPushSubscriptionId = pushId
            self.flushPendingPushSubscriptionId()
        }
    }

    private func flushPendingPushSubscriptionId() {
        guard let pushId = pendingPushSubscriptionId, !pushId.isEmpty, webView?.url != nil else { return }
        let safePushId = pushId
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
        let js = """
        (function() {
          var payload = { playerId: "\(safePushId)", subscriptionId: "\(safePushId)", platform: "iOS" };
          var delivered = false;
          var names = [
            'bubble_fn_savePushId',
            'bubble_fn_saveOneSignalPlayerId',
            'freetifulSavePushId',
            'savePushId',
            'saveOneSignalPlayerId'
          ];
          for (var i = 0; i < names.length; i++) {
            try {
              if (typeof window[names[i]] === 'function') {
                window[names[i]](payload);
                delivered = true;
              }
            } catch (e) {}
          }
          if (!delivered) {
            try {
              localStorage.setItem('freetiful-onesignal-pending', JSON.stringify(payload));
              localStorage.setItem('freetiful-onesignal-pending-platform', 'iOS');
            } catch (e) {}
          }
          try {
            if (typeof window.freetifulFlushOneSignalPlayerId === 'function') {
              window.freetifulFlushOneSignalPlayerId();
            }
          } catch (e) {}
        })();
        """
        webView.evaluateJavaScript(js) { [weak self] _, error in
            if let error = error {
                print("❌ Push ID JS 전달 실패:", error)
                return
            }
            print("📌 URL로 onesignalID 전달: \(pushId)")
            self?.pendingPushSubscriptionId = nil
        }
    }

    private func schedulePushIdentityRefresh() {
        OneSignalManager.shared.deliverCurrentPushId()
        [0.8, 2.0, 4.0].forEach { delay in
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                OneSignalManager.shared.deliverCurrentPushId()
            }
        }
    }

    /// 푸시·링크로 열기 — 떠 있는 시트를 닫고 그 화면으로
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
                    self.navigateWeb(to: path)
                }
            }

            if let presented = self.presentedViewController {
                presented.dismiss(animated: true) { navigate() }
            } else {
                navigate()
            }
        }
    }

    // MARK: - Kakao Login
    private func startKakaoLogin() {
        let handle: (OAuthToken?, Error?) -> Void = { [weak self] token, error in
            if let token = token {
                self?.callAPI(endpoint: "/auth/login/kakao/native", body: ["accessToken": token.accessToken])
            } else {
                print("❌ 카카오 로그인 실패:", error?.localizedDescription ?? "unknown")
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
        GIDSignIn.sharedInstance.signIn(withPresenting: rootVC) { [weak self] result, error in
            guard let user = result?.user, error == nil else {
                print("❌ 구글 로그인 실패:", error?.localizedDescription ?? "unknown"); return
            }
            guard let idToken = user.idToken?.tokenString else {
                print("❌ 구글 idToken 없음"); return
            }
            self?.callAPI(endpoint: "/auth/login/google", body: ["idToken": idToken])
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
        request.timeoutInterval = 15   // 기본 60s 가 로그인 1분 무응답의 원인
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
            DispatchQueue.main.async {
                OneSignal.login(userId)
                self?.schedulePushIdentityRefresh()
            }
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

    private var activeController: ASAuthorizationController?   // 진행 중 강참조 — 중도 해제로 간헐 실패하던 문제 방지
    func start() {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        activeController = controller
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
        activeController = nil
        completion(.success((identityToken, fullName.isEmpty ? nil : fullName)))
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        activeController = nil
        completion(.failure(error))
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        // 시트 전환 중 isKeyWindow 가 잠시 false 일 수 있음 — 분리된 UIWindow() 반환이 간헐 실패(에러 1000) 원인
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.compactMap { $0.keyWindow }.first
            ?? scenes.flatMap { $0.windows }.first { $0.isKeyWindow }
            ?? scenes.flatMap { $0.windows }.first
            ?? ASPresentationAnchor()
    }
}

// MARK: - 파일 받기 → 미리보기(QuickLook)·공유
// 웹 채팅의 파일 받기는 fetch→blob→<a download> 라, WKWebView 가 다운로드로 넘겨줘야 한다(안 받으면 무반응 또는 화면이 파일로 바뀜).
extension ViewController: WKDownloadDelegate, UIDocumentInteractionControllerDelegate {
    func download(_ download: WKDownload,
                  decideDestinationUsing response: URLResponse,
                  suggestedFilename: String,
                  completionHandler: @escaping (URL?) -> Void) {
        // 같은 이름이 있으면 실패하므로 받을 때마다 새 폴더
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("downloads", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let name = suggestedFilename.trimmingCharacters(in: .whitespacesAndNewlines)
        let dest = dir.appendingPathComponent(name.isEmpty ? "download" : name)
        downloadDestinations[ObjectIdentifier(download)] = dest
        completionHandler(dest)
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let url = downloadDestinations.removeValue(forKey: ObjectIdentifier(download)) else { return }
        DispatchQueue.main.async { self.previewFile(url) }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        downloadDestinations.removeValue(forKey: ObjectIdentifier(download))
        print("❌ 파일 받기 실패:", error.localizedDescription)
        DispatchQueue.main.async { self.showToast("파일을 받지 못했어요") }
    }

    /// 미리보기(공유·파일에 저장 버튼 포함) — 미리보기가 안 되는 형식이면 공유 시트
    private func previewFile(_ url: URL) {
        let controller = UIDocumentInteractionController(url: url)
        controller.delegate = self
        filePreview = controller
        if !controller.presentPreview(animated: true) {
            filePreview = nil
            let share = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            share.popoverPresentationController?.sourceView = view
            topPresenter().present(share, animated: true)
        }
    }

    func documentInteractionControllerViewControllerForPreview(_ controller: UIDocumentInteractionController) -> UIViewController {
        topPresenter()
    }

    func documentInteractionControllerDidEndPreview(_ controller: UIDocumentInteractionController) {
        filePreview = nil
    }
}

// MARK: - WKUIDelegate: JS alert/confirm/prompt
// 미구현 시 WKWebView 에서 window.confirm() 이 조용히 false 를 반환 → 회원탈퇴 등 confirm 기반 액션이 "무응답"이 됨.
extension ViewController {
    private func presentJSPanel(_ alert: UIAlertController, onFailure: @escaping () -> Void) {
        var top: UIViewController = self
        while let presented = top.presentedViewController, !(presented is UIAlertController) {
            top = presented
        }
        // 이미 알럿이 떠 있으면 중첩 표시 충돌 방지
        guard !(top.presentedViewController is UIAlertController) else { onFailure(); return }
        top.present(alert, animated: true)
    }

    func webView(_ webView: WKWebView,
                 runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "확인", style: .default) { _ in completionHandler() })
        presentJSPanel(alert, onFailure: completionHandler)
    }

    func webView(_ webView: WKWebView,
                 runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "취소", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "확인", style: .default) { _ in completionHandler(true) })
        presentJSPanel(alert) { completionHandler(false) }
    }

    func webView(_ webView: WKWebView,
                 runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: "취소", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "확인", style: .default) { [weak alert] _ in
            completionHandler(alert?.textFields?.first?.text)
        })
        presentJSPanel(alert) { completionHandler(nil) }
    }
}
