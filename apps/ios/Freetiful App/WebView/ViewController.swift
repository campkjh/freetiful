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

// 웹 nav 와 동일하게 구성 (apps/web/src/app/(main)/layout.tsx 의 USER_NAV_ITEMS / PRO_NAV_ITEMS)
// 문의목록·새요청은 웹에서 같은 아이콘(NewRequestNavIcon)을 쓰므로 nav-requests 에셋을 공유.
private let nativeUserNavItems = [
    LiquidNavItem(id: "home", title: "홈", path: "/main", iconAssetName: "nav-home"),
    LiquidNavItem(id: "biz", title: "Biz", path: "/biz", iconAssetName: "nav-biz"),
    LiquidNavItem(id: "inquiries", title: "문의목록", path: "/inquiries", iconAssetName: "nav-requests"),
    LiquidNavItem(id: "chat", title: "채팅", path: "/chat", iconAssetName: "nav-chat"),
    LiquidNavItem(id: "my", title: "마이", path: "/my", iconAssetName: "nav-my")
]

private let nativeProNavItems = [
    LiquidNavItem(id: "home", title: "홈", path: "/main", iconAssetName: "nav-home"),
    LiquidNavItem(id: "biz", title: "Biz", path: "/biz", iconAssetName: "nav-biz"),
    LiquidNavItem(id: "requests", title: "새요청", path: "/pro-dashboard/inquiries", iconAssetName: "nav-requests"),
    LiquidNavItem(id: "chat", title: "채팅", path: "/chat", iconAssetName: "nav-chat"),
    LiquidNavItem(id: "my", title: "마이", path: "/my", iconAssetName: "nav-my")
]

class ViewController: UIViewController,
                      WKNavigationDelegate,
                      WKUIDelegate,
                      UIScrollViewDelegate,
                      WKScriptMessageHandler,
                      NaverThirdPartyLoginConnectionDelegate,
                      LiquidGlassNavigationBarDelegate,
                      NativeChatBarsDelegate,
                      NativeChatListBarDelegate,
                      NativeChatListContentDelegate,
                      NativeInquiryContentDelegate,
                      NativeChatMessagesDelegate,
                      NativeHomeHeaderDelegate,
                      NativeHomeContentDelegate {

    var webView: WKWebView!
    var logoAnimationView: LottieAnimationView!
    private let nativeNavBar = LiquidGlassNavigationBar()
    private let nativeChatHeader = NativeChatHeaderView()
    private let nativeChatInputBar = NativeChatInputBar()
    private var nativeChatInputBottom: NSLayoutConstraint?
    private var nativeChatState = NativeChatState()
    private var isOnChatDetail = false
    private let nativeChatListBar = NativeChatListBar()
    private let nativeMyHeader = NativeSimpleGlassHeader()
    private var isOnMy = false
    private let nativeHomeHeader = NativeHomeHeader()
    private var isOnHome = false
    private let nativeHomeContent = NativeHomeContent(imageBase: "https://freetiful.com")
    private var hasLoadedHome = false
    private var isOnChatList = false
    private var lastListContext = "chat"
    private let nativeChatListContent = NativeChatListContent()
    private let nativeInquiryContent = NativeInquiryContent()
    private let nativeChatMessages = NativeChatMessagesView()
    private var isOnInquiry = false
    private var hasLoadedChatMessagesOnce = false
    private var lastChatDetailPath = ""
    // 채팅방에서 webView 를 화면 가장자리까지(상/하단 safe area 제거) 토글
    private var webViewTopSafe: NSLayoutConstraint?
    private var webViewBottomSafe: NSLayoutConstraint?
    private var webViewTopFull: NSLayoutConstraint?
    private var webViewBottomFull: NSLayoutConstraint?
    private var currentNativePath = "/"
    private var currentNativeActualIsPro = false
    private var currentNativeIsProMode = false
    private var currentNativeViewAsUser = false
    private var currentNativeHasBlockingOverlay = false
    private var currentNavBadges: [String: Int] = [:]
    private var nativeToastView: UIVisualEffectView?
    private var pendingPushSubscriptionId: String?
    private let nativeNavigationEnabled = true

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
        print("🧭 Freetiful current native auth build marker: 2026-05-08-kakao-native-api")
        setupWebView()
        if nativeNavigationEnabled {
            setupNativeNavigationBar()
            setupNativeChatBars()
            observeKeyboardForChat()
        }
        setupLoading()
        observeGoHomeNotification()
        observePushIdNotification()
        observePushDeepLinkNotification()
        loadInitialPage()
        OneSignalManager.shared.deliverCurrentPushId()
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
        if nativeNavigationEnabled {
            contentController.addUserScript(nativeNavScript)
        }

        // JS → iOS 브릿지 등록
        ["kakaoLogin", "naverLogin", "googleLogin", "appleLogin", "socialLogout", "showNativeLogin", "oneSignalLogin", "pushLogin", "setOneSignalExternalId", "nativeNavState", "nativeChatState", "nativeChatListState", "nativeChatListRows", "nativeInquiryRows", "nativeChatMessages", "nativeHomeRows"].forEach {
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
        webViewTopSafe = webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor)
        webViewBottomSafe = webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        webViewTopFull = webView.topAnchor.constraint(equalTo: view.topAnchor)
        webViewBottomFull = webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        NSLayoutConstraint.activate([
            webViewTopSafe!,
            webViewBottomSafe!,
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
          'html.freetiful-ios-native-nav [data-ios-native-nav-hidden]{display:none!important;pointer-events:none!important;}',
          'html.freetiful-ios-native-nav [data-native-chat-header]{display:none!important;pointer-events:none!important;}',
          'html.freetiful-ios-native-nav [data-native-chat-gradient]{display:none!important;pointer-events:none!important;}',
          'html.freetiful-ios-native-nav [data-native-chat-footer]{display:none!important;pointer-events:none!important;}',
          'html.freetiful-ios-native-nav [data-native-chatlist-header]{display:none!important;pointer-events:none!important;}',
          'html.freetiful-ios-native-nav [data-native-my-header]{display:none!important;pointer-events:none!important;}',
          'html.freetiful-ios-native-nav [data-native-home-header]{display:none!important;pointer-events:none!important;}'
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
        var badges = {};
        try { badges = window.__freetifulNavBadges || {}; } catch (e) {}
        return {
          path: window.location.pathname || '/',
          actualIsPro: actualIsPro,
          isProMode: actualIsPro && !viewAsUser,
          viewAsUser: viewAsUser,
          hasBlockingOverlay: hasBlockingOverlay,
          badges: badges
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

      window.__freetifulChatPostState = function() {
        try {
          if (window.__freetifulChat &&
              window.webkit && window.webkit.messageHandlers &&
              window.webkit.messageHandlers.nativeChatState) {
            var s = window.__freetifulChat.getState();
            if (window.__freetifulChatActions) {
              s.attachItems = window.__freetifulChatActions.attachItems || [];
              s.menuItems = window.__freetifulChatActions.menuItems || [];
            }
            window.webkit.messageHandlers.nativeChatState.postMessage(s);
          }
        } catch (e) {}
      };

      window.__freetifulChatListPostState = function() {
        try {
          var src = window.__freetifulChatList || window.__freetifulInquiryList;
          if (src && window.webkit && window.webkit.messageHandlers &&
              window.webkit.messageHandlers.nativeChatListState) {
            var st = src.getState();
            st.context = window.__freetifulChatList ? 'chat' : 'inquiry';
            window.webkit.messageHandlers.nativeChatListState.postMessage(st);
          }
        } catch (e) {}
      };

      window.__freetifulChatListRowsPost = function() {
        try {
          var rsrc = window.__freetifulChatList;
          if (rsrc && rsrc.getRooms && window.webkit && window.webkit.messageHandlers &&
              window.webkit.messageHandlers.nativeChatListRows) {
            window.webkit.messageHandlers.nativeChatListRows.postMessage(rsrc.getRooms());
          }
        } catch (e) {}
      };

      window.__freetifulInquiryRowsPost = function() {
        try {
          var isrc = window.__freetifulInquiryList;
          if (isrc && isrc.getItems && window.webkit && window.webkit.messageHandlers &&
              window.webkit.messageHandlers.nativeInquiryRows) {
            window.webkit.messageHandlers.nativeInquiryRows.postMessage(isrc.getItems());
          }
        } catch (e) {}
      };

      window.__freetifulChatMessagesPost = function() {
        try {
          if (window.__freetifulChat && window.__freetifulChat.getMessages &&
              window.webkit && window.webkit.messageHandlers &&
              window.webkit.messageHandlers.nativeChatMessages) {
            window.webkit.messageHandlers.nativeChatMessages.postMessage(window.__freetifulChat.getMessages());
          }
        } catch (e) {}
      };

      if (window.__freetifulNativeNavInstalled) {
        window.__freetifulNativeNavPostState();
        window.__freetifulChatPostState();
        window.__freetifulChatListPostState();
        window.__freetifulChatListRowsPost();
        window.__freetifulInquiryRowsPost();
        window.__freetifulChatMessagesPost();
        return;
      }

      window.__freetifulNativeNavInstalled = true;
      window.addEventListener('freetiful:chat-state', window.__freetifulChatPostState);
      window.addEventListener('freetiful:chatlist-state', window.__freetifulChatListPostState);
      window.addEventListener('freetiful:chatlist-rows', window.__freetifulChatListRowsPost);
      window.addEventListener('freetiful:inquiry-rows', window.__freetifulInquiryRowsPost);
      window.addEventListener('freetiful:chat-messages', window.__freetifulChatMessagesPost);
      var notify = function() {
        hideWebBottomNav();
        setTimeout(window.__freetifulNativeNavPostState, 30);
        setTimeout(window.__freetifulNativeNavPostState, 260);
        if (window.__freetifulChatPostState) {
          setTimeout(window.__freetifulChatPostState, 60);
          setTimeout(window.__freetifulChatPostState, 320);
        }
        if (window.__freetifulChatListPostState) {
          setTimeout(window.__freetifulChatListPostState, 60);
          setTimeout(window.__freetifulChatListPostState, 320);
        }
        if (window.__freetifulChatListRowsPost) {
          setTimeout(window.__freetifulChatListRowsPost, 60);
          setTimeout(window.__freetifulChatListRowsPost, 320);
        }
        if (window.__freetifulInquiryRowsPost) {
          setTimeout(window.__freetifulInquiryRowsPost, 60);
          setTimeout(window.__freetifulInquiryRowsPost, 320);
        }
        if (window.__freetifulChatMessagesPost) {
          setTimeout(window.__freetifulChatMessagesPost, 60);
          setTimeout(window.__freetifulChatMessagesPost, 320);
        }
      };

      var pushState = history.pushState;
      history.pushState = function() {
        var result = pushState.apply(this, arguments);
        notify();
        return result;
      };

      var replaceState = history.replaceState;
      history.replaceState = function() {
        var result = replaceState.apply(this, arguments);
        notify();
        return result;
      };

      window.addEventListener('popstate', notify);
      window.addEventListener('storage', notify);
      window.addEventListener('freetiful:view-mode-changed', notify);
      // 이전에 모든 click 마다 notify 를 걸어 매 탭마다 getBoundingClientRect/getComputedStyle 폭주 → 채팅 리스트 등에서 큰 lag.
      // 클릭으로 인한 nav 상태 변화는 pushState/replaceState/popstate 가 이미 알린다. click 리스너 제거.

      // MutationObserver 가 document.documentElement 전체를 childList+subtree 로 관찰하면서 hideWebBottomNav 를 매 변경마다 호출하던 게 iOS 앱 전용 큰 lag 의 진짜 원인.
      // hideWebBottomNav 가 nav/footer/div 전부 순회하며 getBoundingClientRect+getComputedStyle 을 강제해 React 렌더마다 reflow 수십 ms ~ 수백 ms 가 누적.
      // 해법: 디바운스(idle) + body 만 관찰 + nav element 가 새로 attach 될 때만 발화하게 좁힌다.
      if (window.MutationObserver) {
        var moScheduled = false;
        var moRun = function() {
          moScheduled = false;
          hideWebBottomNav();
        };
        var schedule = function() {
          if (moScheduled) return;
          moScheduled = true;
          if (window.requestIdleCallback) {
            window.requestIdleCallback(moRun, { timeout: 400 });
          } else {
            setTimeout(moRun, 200);
          }
        };
        var observer = new MutationObserver(function(mutations) {
          for (var i = 0; i < mutations.length; i++) {
            var added = mutations[i].addedNodes;
            for (var j = 0; j < added.length; j++) {
              var n = added[j];
              if (n && n.nodeType === 1) {
                var tag = n.tagName;
                if (tag === 'NAV' || tag === 'FOOTER' || (n.querySelector && (n.querySelector('[data-nav-pill]') || n.querySelector('[data-ios-mobile-bottom-nav]')))) {
                  schedule();
                  return;
                }
              }
            }
          }
        });
        // body 만, childList 만 (subtree 제거하면 매 텍스트노드 변경마다 발화 안 함)
        // body 가 아직 없을 수도 있으니 안전하게 documentElement 의 직속 child(body) 로 attach 될 때까지 기다림.
        var attach = function() {
          if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
          } else {
            setTimeout(attach, 50);
          }
        };
        attach();
      }

      notify();
      setTimeout(notify, 800);
    })();
    """

    private func handleNativeNavState(_ body: Any) {
        guard nativeNavigationEnabled else { return }
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
        if let badges = state["badges"] as? [String: Any] {
            var parsed: [String: Int] = [:]
            for (key, value) in badges {
                if let n = value as? Int { parsed[key] = n }
                else if let d = value as? Double { parsed[key] = Int(d) }
            }
            currentNavBadges = parsed
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
        // 웹과 동일: role === 'pro' 이면 PRO nav, 아니면 USER nav (viewAsUser 무관, nav 내 토글 없음)
        let items = currentNativeActualIsPro ? nativeProNavItems : nativeUserNavItems

        nativeNavBar.configure(
            items: items,
            selectedPath: currentNativePath,
            showsModeToggle: false,
            isProMode: false
        )
        nativeNavBar.setBadges(currentNavBadges)

        let hidden = currentNativeHasBlockingOverlay || shouldHideNativeNavigation(path: currentNativePath)
        nativeNavBar.setVisible(!hidden, animated: animated)
        webView.scrollView.contentInset.bottom = hidden ? 0 : 88
        webView.scrollView.verticalScrollIndicatorInsets.bottom = hidden ? 0 : 88
        updateNativeChatVisibility()
    }

    private func shouldHideNativeNavigation(path: String) -> Bool {
        // 웹 layout.tsx 의 HIDE_NAV_PATTERNS 와 동일하게 nav 를 숨길 경로
        if path.hasPrefix("/chat/") { return true }
        if path.hasPrefix("/pros/") { return true }
        if path.hasPrefix("/businesses/") { return true }
        if path.hasPrefix("/my/") { return true }
        if path.hasPrefix("/notifications") { return true }
        if path.hasPrefix("/pro-register") { return true }
        if path.hasPrefix("/biz") { return true }
        if path.hasPrefix("/search") { return true }
        if path == "/pros" || path == "/businesses" || path == "/careers" { return true }
        return false
    }

    // MARK: - 네이티브 채팅 헤더/입력바
    private func setupNativeChatBars() {
        nativeChatHeader.delegate = self
        nativeChatInputBar.delegate = self
        nativeChatHeader.isHidden = true
        nativeChatInputBar.isHidden = true
        view.addSubview(nativeChatHeader)
        view.addSubview(nativeChatInputBar)

        nativeChatInputBottom = nativeChatInputBar.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        NSLayoutConstraint.activate([
            nativeChatHeader.topAnchor.constraint(equalTo: view.topAnchor),
            nativeChatHeader.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            nativeChatHeader.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            nativeChatHeader.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 52),

            nativeChatInputBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            nativeChatInputBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            nativeChatInputBottom!,
        ])

        // 채팅 리스트 상단 고정 바 (글래스 헤더 + 탭 + 그라데이션 블러)
        nativeChatListBar.delegate = self
        nativeChatListBar.isHidden = true
        view.addSubview(nativeChatListBar)
        NSLayoutConstraint.activate([
            nativeChatListBar.topAnchor.constraint(equalTo: view.topAnchor),
            nativeChatListBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            nativeChatListBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            nativeChatListBar.titleTopAnchorRef.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 4),
        ])

        // 마이페이지 글래스 헤더 (그라데이션 블러)
        nativeMyHeader.isHidden = true
        nativeMyHeader.setTitle("마이페이지")
        view.addSubview(nativeMyHeader)
        NSLayoutConstraint.activate([
            nativeMyHeader.topAnchor.constraint(equalTo: view.topAnchor),
            nativeMyHeader.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            nativeMyHeader.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            nativeMyHeader.titleTopAnchorRef.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 4),
        ])

        // 홈 글래스 헤더 (로고 + 글래스 검색 + 글래스 알림)
        nativeHomeHeader.delegate = self
        nativeHomeHeader.isHidden = true
        view.addSubview(nativeHomeHeader)
        NSLayoutConstraint.activate([
            nativeHomeHeader.topAnchor.constraint(equalTo: view.topAnchor),
            nativeHomeHeader.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            nativeHomeHeader.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            nativeHomeHeader.titleTopAnchorRef.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 6),
        ])

        // 네이티브 홈 본문 (웹 홈 위 풀스크린, 헤더 아래) — 완성 전엔 숨김
        nativeHomeContent.delegate = self
        nativeHomeContent.isHidden = true
        view.insertSubview(nativeHomeContent, aboveSubview: webView)
        NSLayoutConstraint.activate([
            nativeHomeContent.topAnchor.constraint(equalTo: view.topAnchor),
            nativeHomeContent.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            nativeHomeContent.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            nativeHomeContent.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        view.bringSubviewToFront(nativeHomeHeader)

        // 네이티브 채팅 리스트 본문 (웹뷰 위, 글래스 바 아래)
        nativeChatListContent.delegate = self
        nativeChatListContent.isHidden = true
        view.insertSubview(nativeChatListContent, aboveSubview: webView)
        NSLayoutConstraint.activate([
            nativeChatListContent.topAnchor.constraint(equalTo: view.topAnchor),
            nativeChatListContent.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            nativeChatListContent.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            nativeChatListContent.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        // 네이티브 새요청 본문 (웹뷰 위, 글래스 바 아래)
        nativeInquiryContent.delegate = self
        nativeInquiryContent.isHidden = true
        view.insertSubview(nativeInquiryContent, aboveSubview: webView)
        NSLayoutConstraint.activate([
            nativeInquiryContent.topAnchor.constraint(equalTo: view.topAnchor),
            nativeInquiryContent.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            nativeInquiryContent.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            nativeInquiryContent.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        // 글래스 바가 본문 위에 오도록
        view.bringSubviewToFront(nativeChatListBar)

        // 네이티브 채팅 본문 (B3) — 글래스 헤더 아래에서 시작(인셋), 입력바 위까지
        nativeChatMessages.delegate = self
        nativeChatMessages.isHidden = true
        view.insertSubview(nativeChatMessages, aboveSubview: webView)
        NSLayoutConstraint.activate([
            nativeChatMessages.topAnchor.constraint(equalTo: view.topAnchor),
            nativeChatMessages.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            nativeChatMessages.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            nativeChatMessages.bottomAnchor.constraint(equalTo: nativeChatInputBar.topAnchor),
        ])
        // 헤더/입력바가 메시지 위에 떠 있도록
        view.bringSubviewToFront(nativeChatHeader)
        view.bringSubviewToFront(nativeChatInputBar)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        if isOnChatList {
            let top = nativeChatListBar.frame.height > 0 ? nativeChatListBar.frame.height : (view.safeAreaInsets.top + 92)
            nativeChatListContent.setInsets(top: top, bottom: 92)
            if isOnInquiry { nativeInquiryContent.setInsets(top: top, bottom: 92) }
        }
    }

    private func observeKeyboardForChat() {
        NotificationCenter.default.addObserver(self, selector: #selector(chatKeyboardWillChange(_:)),
                                               name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(chatKeyboardWillHide(_:)),
                                               name: UIResponder.keyboardWillHideNotification, object: nil)
    }

    @objc private func chatKeyboardWillChange(_ note: Notification) {
        guard isOnChatDetail,
              let frame = (note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue else { return }
        let overlap = max(0, view.bounds.height - frame.origin.y)
        let duration = (note.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double) ?? 0.25
        nativeChatInputBottom?.constant = -overlap
        UIView.animate(withDuration: duration) { self.view.layoutIfNeeded() }
        if overlap > 0 { nativeChatMessages.scrollToBottom(animated: true) }
    }

    @objc private func chatKeyboardWillHide(_ note: Notification) {
        let duration = (note.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double) ?? 0.25
        nativeChatInputBottom?.constant = 0
        UIView.animate(withDuration: duration) { self.view.layoutIfNeeded() }
    }

    private func handleNativeChatState(_ body: Any) {
        guard nativeNavigationEnabled, let dict = body as? [String: Any] else { return }
        var s = NativeChatState()
        s.name = (dict["name"] as? String) ?? ""
        s.imageUrl = (dict["imageUrl"] as? String) ?? ""
        s.online = (dict["online"] as? Bool) ?? false
        s.statusText = (dict["statusText"] as? String) ?? ""
        s.partnerIsPro = (dict["partnerIsPro"] as? Bool) ?? false
        s.partnerRoleKnown = (dict["partnerRoleKnown"] as? Bool) ?? false
        s.isPro = (dict["isPro"] as? Bool) ?? false
        s.ready = (dict["ready"] as? Bool) ?? false
        s.muted = (dict["muted"] as? Bool) ?? false
        nativeChatState = s
        nativeChatHeader.apply(s)
        nativeChatInputBar.apply(s)
        // 메뉴 항목은 네이티브에서 직접 구성 — 웹 배포/캐시 타이밍과 무관하게 항상 표시
        nativeChatInputBar.setAttachItems(buildAttachItems(isPro: s.isPro))
        nativeChatHeader.setMenuItems(buildMenuItems(isPro: s.isPro, muted: s.muted))
    }

    private func buildAttachItems(isPro: Bool) -> [ChatMenuItem] {
        var items: [ChatMenuItem] = []
        if isPro {
            items.append(ChatMenuItem(id: "quote", label: "견적서 발송", sf: "doc.text.fill", destructive: false))
        }
        items.append(contentsOf: [
            ChatMenuItem(id: "camera", label: "카메라", sf: "camera.fill", destructive: false),
            ChatMenuItem(id: "photo", label: "사진", sf: "photo.fill", destructive: false),
            ChatMenuItem(id: "emoji", label: "이모티콘", sf: "face.smiling", destructive: false),
            ChatMenuItem(id: "file", label: "파일", sf: "doc.fill", destructive: false),
            ChatMenuItem(id: "location", label: "위치", sf: "mappin.and.ellipse", destructive: false),
            ChatMenuItem(id: "audio", label: "오디오", sf: "music.note", destructive: false),
        ])
        return items
    }

    private func buildMenuItems(isPro: Bool, muted: Bool) -> [ChatMenuItem] {
        return [
            ChatMenuItem(id: "search", label: "대화 내용 검색", sf: "magnifyingglass", destructive: false),
            ChatMenuItem(id: "mute", label: muted ? "알림 켜기" : "알림 끄기", sf: muted ? "bell.fill" : "bell.slash.fill", destructive: false),
            ChatMenuItem(id: "profile", label: isPro ? "고객 정보 보기" : "프로필 보기", sf: "person.crop.circle", destructive: false),
            ChatMenuItem(id: "delete", label: "대화 삭제", sf: "trash", destructive: true),
        ]
    }

    private func updateNativeChatVisibility() {
        guard nativeNavigationEnabled else { return }
        let onDetail = currentNativePath.hasPrefix("/chat/")
        let onList = currentNativePath == "/chat" || currentNativePath == "/pro-dashboard/inquiries"

        // ─── 채팅 상세 ───
        if onDetail != isOnChatDetail {
            isOnChatDetail = onDetail
            nativeChatHeader.isHidden = !onDetail
            nativeChatInputBar.isHidden = !onDetail
            if onDetail {
                webViewTopSafe?.isActive = false
                webViewBottomSafe?.isActive = false
                webViewTopFull?.isActive = true
                webViewBottomFull?.isActive = true
            } else {
                webViewTopFull?.isActive = false
                webViewBottomFull?.isActive = false
                webViewTopSafe?.isActive = true
                webViewBottomSafe?.isActive = true
                view.endEditing(true)
                nativeChatInputBottom?.constant = 0
            }
        }
        if onDetail { requestNativeChatState() }

        // 채팅 본문(네이티브 메시지 리스트) — 채팅 상세에서만 (B3)
        // 웹이 getMessages 로 실제 응답할 때만 표시(handleNativeChatMessages) → 구버전 웹에선 웹 폴백
        if !onDetail {
            nativeChatMessages.isHidden = true
        } else {
            if currentNativePath != lastChatDetailPath {
                hasLoadedChatMessagesOnce = false // 방 전환마다 첫 로드 시 맨 아래로
                lastChatDetailPath = currentNativePath
            }
            let topInset = view.safeAreaInsets.top + 52 + 8 // 글래스 헤더 높이 + 여백
            nativeChatMessages.setInsets(top: topInset, bottom: 10)
            requestNativeChatMessages()
        }

        // ─── 채팅 리스트 ───
        if onList != isOnChatList {
            isOnChatList = onList
            nativeChatListBar.isHidden = !onList
        }
        if onList { requestNativeChatListState() }

        // 마이페이지 글래스 헤더
        let onMy = currentNativePath == "/my"
        if onMy != isOnMy {
            isOnMy = onMy
            nativeMyHeader.isHidden = !onMy
        }
        if onMy { view.bringSubviewToFront(nativeMyHeader) }

        // 홈 글래스 헤더 (스페이서가 공간 확보하므로 콘텐츠 인셋은 변경 안 함)
        let onHome = currentNativePath == "/main" || currentNativePath == "/"
        if onHome != isOnHome {
            isOnHome = onHome
            nativeHomeHeader.isHidden = !onHome
            nativeHomeContent.isHidden = !onHome
        }
        if onHome {
            view.bringSubviewToFront(nativeHomeHeader)
            let top = view.safeAreaInsets.top + 56
            nativeHomeContent.setInsets(top: top, bottom: 92)
            if !hasLoadedHome { hasLoadedHome = true; nativeHomeContent.loadInitial() }
        }

        // 네이티브 헤더(리스트/마이) 아래에서 웹 콘텐츠 시작하도록 상단 인셋
        let needsHeaderInset = onList || onMy
        webView.scrollView.contentInset.top = needsHeaderInset ? 88 : 0
        webView.scrollView.verticalScrollIndicatorInsets.top = needsHeaderInset ? 88 : 0

        // 리스트 본문(네이티브 테이블) — 채팅(/chat) & 새요청(/pro-dashboard/inquiries)
        let onChatListNative = currentNativePath == "/chat"
        let onInquiryNative = currentNativePath == "/pro-dashboard/inquiries"
        isOnInquiry = onInquiryNative
        nativeChatListContent.isHidden = !onChatListNative
        nativeInquiryContent.isHidden = !onInquiryNative
        let listTop = nativeChatListBar.frame.height > 0 ? nativeChatListBar.frame.height : (view.safeAreaInsets.top + 92)
        if onChatListNative {
            nativeChatListContent.setInsets(top: listTop, bottom: 92)
            requestNativeChatListRows()
        }
        if onInquiryNative {
            nativeInquiryContent.setInsets(top: listTop, bottom: 92)
            requestNativeInquiryRows()
        }
    }

    private func requestNativeChatState() {
        webView.evaluateJavaScript("window.__freetifulChatPostState && window.__freetifulChatPostState();", completionHandler: nil)
    }

    private func requestNativeChatListState() {
        webView.evaluateJavaScript("window.__freetifulChatListPostState && window.__freetifulChatListPostState();", completionHandler: nil)
    }

    private func handleNativeChatListState(_ body: Any) {
        guard nativeNavigationEnabled, let dict = body as? [String: Any] else { return }
        let context = (dict["context"] as? String) ?? "chat"
        lastListContext = context
        nativeChatListBar.setTitle(context == "inquiry" ? "새 요청" : "채팅")
        nativeChatListBar.setSearchHidden(context == "inquiry")
        let tabs = (dict["tabs"] as? [String]) ?? []
        let tab = (dict["tab"] as? String) ?? ""
        if !tabs.isEmpty { nativeChatListBar.configure(tabs: tabs, selected: tab) }
    }

    // MARK: - NativeChatListBarDelegate
    func chatListSelectTab(_ tab: String) {
        let hook = lastListContext == "inquiry" ? "__freetifulInquiryList" : "__freetifulChatList"
        webView.evaluateJavaScript("window.\(hook) && window.\(hook).setTab(\(jsLiteral(tab)));", completionHandler: nil)
    }
    func chatListTapSearch() {
        webView.evaluateJavaScript("window.__freetifulChatList && window.__freetifulChatList.toggleSearch && window.__freetifulChatList.toggleSearch();", completionHandler: nil)
    }

    private func requestNativeChatListRows() {
        webView.evaluateJavaScript("window.__freetifulChatListRowsPost && window.__freetifulChatListRowsPost();", completionHandler: nil)
    }

    private func handleNativeChatListRows(_ body: Any) {
        guard nativeNavigationEnabled, let arr = body as? [[String: Any]] else { return }
        let rows: [NativeChatRow] = arr.compactMap { d in
            guard let id = d["id"] as? String else { return nil }
            return NativeChatRow(
                id: id,
                name: (d["name"] as? String) ?? "",
                image: (d["image"] as? String) ?? "",
                lastMessage: (d["lastMessage"] as? String) ?? "",
                time: (d["time"] as? String) ?? "",
                unread: (d["unread"] as? Int) ?? Int((d["unread"] as? Double) ?? 0)
            )
        }
        nativeChatListContent.setRows(rows)
    }

    // MARK: - NativeChatListContentDelegate
    func chatListContentDidSelect(_ id: String) {
        webView.evaluateJavaScript("window.__freetifulChatList && window.__freetifulChatList.openRoom(\(jsLiteral(id)));", completionHandler: nil)
    }
    func chatListContentDidHide(_ id: String) {
        webView.evaluateJavaScript("window.__freetifulChatList && window.__freetifulChatList.hideRoom(\(jsLiteral(id)));", completionHandler: nil)
    }

    // MARK: - 새요청(새요청 리스트) 본문
    private func requestNativeInquiryRows() {
        webView.evaluateJavaScript("window.__freetifulInquiryRowsPost && window.__freetifulInquiryRowsPost();", completionHandler: nil)
    }

    private func handleNativeInquiryRows(_ body: Any) {
        guard nativeNavigationEnabled, let arr = body as? [[String: Any]] else { return }
        let items: [NativeInquiryItem] = arr.compactMap { d in
            guard let id = d["id"] as? String else { return nil }
            let parts = (d["parts"] as? [String]) ?? []
            return NativeInquiryItem(
                id: id,
                name: (d["name"] as? String) ?? "고객",
                image: (d["image"] as? String) ?? "",
                kindLabel: (d["kindLabel"] as? String) ?? "",
                isMulti: (d["isMulti"] as? Bool) ?? ((d["kind"] as? String) == "multi"),
                timeAgo: (d["timeAgo"] as? String) ?? "",
                category: (d["category"] as? String) ?? "",
                parts: parts,
                dateText: (d["dateText"] as? String) ?? "",
                location: (d["location"] as? String) ?? "",
                note: (d["note"] as? String) ?? ""
            )
        }
        nativeInquiryContent.setRows(items)
    }

    // MARK: - NativeInquiryContentDelegate
    func inquiryDidTapChat(_ id: String) {
        webView.evaluateJavaScript("window.__freetifulInquiryList && window.__freetifulInquiryList.invokeChat && window.__freetifulInquiryList.invokeChat(\(jsLiteral(id)));", completionHandler: nil)
    }
    func inquiryDidTapReject(_ id: String) {
        webView.evaluateJavaScript("window.__freetifulInquiryList && window.__freetifulInquiryList.invokeReject && window.__freetifulInquiryList.invokeReject(\(jsLiteral(id)));", completionHandler: nil)
    }

    // MARK: - 채팅 본문(네이티브 메시지) (B3)
    private func requestNativeChatMessages() {
        webView.evaluateJavaScript("window.__freetifulChatMessagesPost && window.__freetifulChatMessagesPost();", completionHandler: nil)
    }

    private func handleNativeChatMessages(_ body: Any) {
        guard nativeNavigationEnabled, let arr = body as? [[String: Any]] else { return }
        let msgs: [NativeChatMessage] = arr.compactMap { d in
            guard let id = d["id"] as? String else { return nil }
            return NativeChatMessage(
                id: id,
                mine: (d["mine"] as? Bool) ?? false,
                content: (d["content"] as? String) ?? "",
                imageUrl: (d["imageUrl"] as? String) ?? "",
                type: (d["type"] as? String) ?? "text",
                createdAt: (d["createdAt"] as? String) ?? "",
                isRead: (d["isRead"] as? Bool) ?? false,
                replyName: (d["replyName"] as? String) ?? "",
                replyContent: (d["replyContent"] as? String) ?? "",
                reaction: (d["reaction"] as? String) ?? "",
                pending: (d["pending"] as? Bool) ?? false,
                systemKind: (d["systemKind"] as? String) ?? "",
                quoteAmount: (d["quoteAmount"] as? Int) ?? Int((d["quoteAmount"] as? Double) ?? 0),
                quoteTitle: (d["quoteTitle"] as? String) ?? "",
                quoteDate: (d["quoteDate"] as? String) ?? "",
                quoteTime: (d["quoteTime"] as? String) ?? "",
                quoteLocation: (d["quoteLocation"] as? String) ?? "",
                quotationId: (d["quotationId"] as? String) ?? ""
            )
        }
        nativeChatMessages.setMessages(msgs, forceScroll: !hasLoadedChatMessagesOnce)
        if !msgs.isEmpty { hasLoadedChatMessagesOnce = true }
        // 웹이 실제 응답했으므로 이제 네이티브 본문을 표시 (채팅 상세인 동안)
        if isOnChatDetail { nativeChatMessages.isHidden = false }
    }

    // MARK: - NativeChatMessagesDelegate (꾹눌러 글래스 메뉴 액션)
    func chatMessagesReply(_ id: String) {
        Haptics.tap()
        webView.evaluateJavaScript("window.__freetifulChat && window.__freetifulChat.replyMessage && window.__freetifulChat.replyMessage(\(jsLiteral(id)));", completionHandler: nil)
    }
    func chatMessagesAnnounce(_ id: String) {
        Haptics.tap()
        webView.evaluateJavaScript("window.__freetifulChat && window.__freetifulChat.announceMessage && window.__freetifulChat.announceMessage(\(jsLiteral(id)));", completionHandler: nil)
    }
    func chatMessagesPartialCopy(_ id: String) {
        Haptics.tap()
        webView.evaluateJavaScript("window.__freetifulChat && window.__freetifulChat.partialCopyMessage && window.__freetifulChat.partialCopyMessage(\(jsLiteral(id)));", completionHandler: nil)
    }
    func chatMessagesReact(_ id: String, emoji: String) {
        webView.evaluateJavaScript("window.__freetifulChat && window.__freetifulChat.reactMessage && window.__freetifulChat.reactMessage(\(jsLiteral(id)), \(jsLiteral(emoji)));", completionHandler: nil)
    }
    func chatMessagesQuoteTap(_ quotationId: String) {
        webView.evaluateJavaScript("window.__freetifulChat && window.__freetifulChat.openQuotePayment && window.__freetifulChat.openQuotePayment(\(jsLiteral(quotationId)));", completionHandler: nil)
    }
    func chatMessagesImageTap(_ url: String) {
        guard !url.isEmpty else { return }
        present(NativeImageViewer(url: url), animated: true)
    }

    // MARK: - NativeHomeHeaderDelegate
    func homeHeaderTapSearch() {
        webView.evaluateJavaScript("(window.__freetifulNavigate && window.__freetifulNavigate('/search'));", completionHandler: nil)
    }
    func homeHeaderTapBell() {
        webView.evaluateJavaScript("(window.__freetifulNavigate && window.__freetifulNavigate('/notifications'));", completionHandler: nil)
    }

    // MARK: - NativeHomeContentDelegate
    func homeOpenWeddingFind() {
        webView.evaluateJavaScript("(window.__freetifulNavigate && window.__freetifulNavigate('/wedding-mc'));", completionHandler: nil)
    }
    func homeOpenEventRequest() {
        webView.evaluateJavaScript("(window.__freetifulNavigate && window.__freetifulNavigate('/pros?category=' + encodeURIComponent('전문행사사회자')));", completionHandler: nil)
    }
    func homeOpenCategory(_ category: String) {
        webView.evaluateJavaScript("(window.__freetifulNavigate && window.__freetifulNavigate('/pros?category=' + encodeURIComponent(\(jsLiteral(category)))));", completionHandler: nil)
    }
    func homeOpenPro(_ proId: String) {
        webView.evaluateJavaScript("(window.__freetifulNavigate && window.__freetifulNavigate('/pros/' + \(jsLiteral(proId))));", completionHandler: nil)
    }
    func homeRequestPros(_ categoryIndex: Int) {
        webView.evaluateJavaScript("(window.__freetifulHomeRowsPost && window.__freetifulHomeRowsPost(\(categoryIndex)));", completionHandler: nil)
    }

    private func handleNativeHomeRows(_ body: Any) {
        guard nativeNavigationEnabled, let dict = body as? [String: Any] else { return }
        let index = (dict["index"] as? Int) ?? Int((dict["index"] as? Double) ?? 0)
        let arr = (dict["items"] as? [[String: Any]]) ?? []
        let items: [HomeProItem] = arr.compactMap { d in
            guard let id = d["id"] as? String else { return nil }
            return HomeProItem(
                id: id,
                name: (d["name"] as? String) ?? "사회자",
                image: (d["image"] as? String) ?? "",
                rating: (d["rating"] as? Double) ?? Double((d["rating"] as? Int) ?? 0),
                reviewCount: (d["reviewCount"] as? Int) ?? Int((d["reviewCount"] as? Double) ?? 0),
                intro: (d["intro"] as? String) ?? ""
            )
        }
        nativeHomeContent.setPros(categoryIndex: index, items: items)
    }

    // MARK: - NativeChatBarsDelegate
    func chatBarsDidTapBack() {
        view.endEditing(true)
        webView.evaluateJavaScript("(window.__freetifulChat && window.__freetifulChat.back && window.__freetifulChat.back());") { [weak self] _, err in
            if err != nil { self?.webView.goBack() }
        }
    }
    func chatBarsDidTapProfile() {
        webView.evaluateJavaScript("window.__freetifulChat && window.__freetifulChat.openProfile && window.__freetifulChat.openProfile();", completionHandler: nil)
    }
    func chatBarsDidTapMenu() {
        webView.evaluateJavaScript("window.__freetifulChat && window.__freetifulChat.openMenu && window.__freetifulChat.openMenu();", completionHandler: nil)
    }
    func chatBarsDidSend(_ text: String) {
        webView.evaluateJavaScript("window.__freetifulChat && window.__freetifulChat.sendText(\(jsLiteral(text)));", completionHandler: nil)
    }
    func chatBarsDidTapAttach() {
        view.endEditing(true)
        webView.evaluateJavaScript("window.__freetifulChat && window.__freetifulChat.openAttach && window.__freetifulChat.openAttach();", completionHandler: nil)
    }
    func chatBarsDidTapQuote() {
        presentNativeQuoteForm()
    }
    func chatBarsDidTapVoice() {
        view.endEditing(true)
        webView.evaluateJavaScript("window.__freetifulChat && window.__freetifulChat.startVoice && window.__freetifulChat.startVoice();", completionHandler: nil)
    }
    func chatBarsInvokeAttach(_ id: String) {
        view.endEditing(true)
        if id == "quote" {
            presentNativeQuoteForm()
            return
        }
        webView.evaluateJavaScript("window.__freetifulChatActions && window.__freetifulChatActions.invokeAttach(\(jsLiteral(id)));", completionHandler: nil)
    }

    private func presentNativeQuoteForm() {
        view.endEditing(true)
        let js = "(function(){ try { return JSON.stringify(window.__freetifulChatActions ? window.__freetifulChatActions.getQuoteDefaults() : {}); } catch(e){ return '{}'; } })();"
        webView.evaluateJavaScript(js) { [weak self] result, _ in
            guard let self = self else { return }
            var d = NativeQuoteFormViewController.Defaults()
            if let s = result as? String, let data = s.data(using: .utf8),
               let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
                d.eventName = (obj["eventName"] as? String) ?? ""
                d.eventDate = (obj["eventDate"] as? String) ?? ""
                d.eventTime = (obj["eventTime"] as? String) ?? ""
                d.eventLocation = (obj["eventLocation"] as? String) ?? ""
                d.planLabel = (obj["planLabel"] as? String) ?? ""
                d.planPrice = (obj["planPrice"] as? Int) ?? Int((obj["planPrice"] as? Double) ?? 0)
            }
            let form = NativeQuoteFormViewController(defaults: d)
            form.onSubmit = { [weak self] payload in self?.submitNativeQuote(payload) }
            self.present(form, animated: false)
        }
    }

    private func submitNativeQuote(_ payload: [String: String]) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.__freetifulChatActions && window.__freetifulChatActions.submitQuote && window.__freetifulChatActions.submitQuote(\(json));", completionHandler: nil)
    }
    func chatBarsInvokeMenu(_ id: String, label: String, destructive: Bool) {
        let js = "window.__freetifulChatActions && window.__freetifulChatActions.invokeMenu(\(jsLiteral(id)));"
        if destructive {
            let alert = UIAlertController(title: label, message: "되돌릴 수 없습니다. 계속할까요?", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "취소", style: .cancel))
            alert.addAction(UIAlertAction(title: label, style: .destructive) { [weak self] _ in
                self?.webView.evaluateJavaScript(js, completionHandler: nil)
            })
            present(alert, animated: true)
        } else {
            webView.evaluateJavaScript(js, completionHandler: nil)
        }
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
          if (link) {
            link.click();
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
        webView.load(URLRequest(url: URL(string: "\(kWebBase)/")!))
    }

    private func loadInternalPath(_ path: String) {
        guard let url = URL(string: "\(kWebBase)\(path)") else { return }
        currentNativePath = path
        webView.load(URLRequest(url: url))
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
        flushPendingPushSubscriptionId()
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
        case "kakaoLogin":  startKakaoLogin()
        case "naverLogin":  startNaverLogin()
        case "googleLogin": startGoogleLogin()
        case "appleLogin":  startAppleLogin()
        case "socialLogout": socialLogout()
        case "nativeNavState": handleNativeNavState(message.body)
        case "nativeChatState": handleNativeChatState(message.body)
        case "nativeChatListState": handleNativeChatListState(message.body)
        case "nativeChatListRows": handleNativeChatListRows(message.body)
        case "nativeInquiryRows": handleNativeInquiryRows(message.body)
        case "nativeChatMessages": handleNativeChatMessages(message.body)
        case "nativeHomeRows": handleNativeHomeRows(message.body)
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
                    self.schedulePushIdentityRefresh()
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

    // MARK: - Kakao Login
    private func startKakaoLogin() {
        print("🟣 [CurrentAuth] startKakaoLogin uses /auth/login/kakao/native")
        let handle: (OAuthToken?, Error?) -> Void = { [weak self] token, error in
            if let token = token {
                print("🟢 [CurrentAuth] Kakao token received, calling native API")
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
        print("🌐 [CurrentAuth] API request:", url.absoluteString)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            if let error = error { print("❌ API 실패:", error); return }
            if let http = response as? HTTPURLResponse {
                print("🌐 [CurrentAuth] API status:", http.statusCode)
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

            print("✅ [CurrentAuth] API login success, injecting JWT for user:", userId)
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
