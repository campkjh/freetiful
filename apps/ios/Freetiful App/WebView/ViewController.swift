import UIKit
import SwiftUI
import WebKit
import CoreLocation
import KakaoSDKAuth
import KakaoSDKUser
import GoogleSignIn
import NaverThirdPartyLogin
import AuthenticationServices
import Lottie
import OneSignalFramework
import SafariServices
import AVKit

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
                      NativeHomeContentDelegate,
                      NativeMyContentDelegate,
                      NativeBackHeaderDelegate,
                      NativeNotificationsDelegate,
                      NativeSearchDelegate,
                      NativeCustomerInquiriesDelegate,
                      NativeHelpDelegate,
                      NativeCategoryListDelegate,
                      NativeProDetailDelegate {

    var webView: WKWebView!
    var logoAnimationView: LottieAnimationView!
    private let nativeNavBar = LiquidGlassNavigationBar()
    private let nativeChatHeader = NativeChatHeaderView()
    private let nativeChatInputBar = NativeChatInputBar()
    private var nativeChatInputBottom: NSLayoutConstraint?
    private var nativeChatState = NativeChatState()
    private var nativeCustomerRequestInfo: NativeCustomerRequestModal.Info?   // ⋮ → 고객 견적 정보 모달용 캐시
    private var isOnChatDetail = false
    private let nativeChatListBar = NativeChatListBar()
    private let nativeMyHeader = NativeSimpleGlassHeader()
    private let nativeMyContent = NativeMyContent()
    private var isOnMy = false
    private let nativeBackHeader = NativeBackHeader()   // 상세화면 글래스 뒤로가기 헤더
    private let nativeBizNav = NativeBizNav()            // 비즈 페이지 네이티브 글래스 하단 네비
    private var isOnBiz = false
    private var isOnDetail = false
    private let nativeNotifications = NativeNotificationsContent()   // 알림 화면 네이티브
    private var isOnNotifications = false
    private let nativeSearch = NativeSearchContent()   // 검색 화면 네이티브
    private var isOnSearch = false
    private let nativeCustomerInquiries = NativeCustomerInquiries()   // 고객 문의목록 네이티브
    private var isOnCustomerInquiries = false
    private let nativeHelp = NativeHelpContent()   // 고객센터(FAQ/공지/약관) 네이티브
    private var isOnHelp = false
    // 고객센터(/my/support)는 웹 페이지(연락처·운영시간)를 그대로 노출 — FAQ/공지/약관만 네이티브 글래스 탭
    private let helpPaths = ["/my/faq", "/my/announcements", "/my/terms"]
    private let nativeProDetail = NativeProDetailContent()   // 사회자 상세 네이티브
    private var isOnProDetail = false
    private var currentProDetailId = ""
    private let nativeBizDetail = NativeBusinessDetailContent()   // 웨딩파트너 상세 네이티브
    private var isOnBizDetail = false
    private var currentBizDetailId = ""
    private let nativeCategoryList = NativeCategoryListContent()   // 홈 카테고리 → 네이티브 리스트
    private var isOnCategoryList = false
    private let nativeReviewList = NativeReviewListContent()   // 사회자 리뷰 전체 리스트
    private var isOnReviewList = false
    private var currentReviewProId = ""
    private let chatLocationManager = CLLocationManager()   // 채팅 위치 공유
    private var pendingLocationSend = false
    private let nativeHomeHeader = NativeHomeHeader()
    private var isOnHome = false
    private let nativeHomeContent = NativeHomeContent(imageBase: "https://freetiful.com")
    private var hasLoadedHome = false
    private var didFirstOnHome = false
    private var didRevealHomeEarly = false
    private var isOnChatList = false
    private var lastListContext = "chat"
    private let nativeChatListContent = NativeChatListContent()
    private let nativeInquiryContent = NativeInquiryContent()
    private let nativeChatMessages = NativeChatMessagesView()
    private var isOnInquiry = false
    private var isOnChatRows = false   // 채팅 리스트 본문 진입 감지(탭바 가드 isOnChatList 와 분리)
    private var hasLoadedChatMessagesOnce = false
    private var lastChatDetailPath = ""
    // 채팅방에서 webView 를 화면 가장자리까지(상/하단 safe area 제거) 토글
    private var webViewTopSafe: NSLayoutConstraint?
    private var webViewBottomSafe: NSLayoutConstraint?
    private var webViewTopFull: NSLayoutConstraint?
    private var webViewBottomFull: NSLayoutConstraint?
    private var currentNativePath = "/" {
        didSet {
            // 프로필 편집(/pro-edit)을 떠나면(저장 가능성) 상세 캐시 무효화 + 네이티브 상세 재로딩 강제
            // + 홈/카테고리 리스트도 신선 데이터로 재로딩 → 사회자가 프로필 수정하면 전 화면 즉시 반영
            if oldValue.contains("/pro-edit"), !currentNativePath.contains("/pro-edit") {
                NativeHomeData.clearDetailCaches()
                nativeProDetail.invalidate()
                nativeCategoryList.invalidate()
                nativeHomeContent.loadInitial()
            }
        }
    }
    private var currentNativeQuery = ""   // location.search (예: "?category=웨딩홀")
    // 상세화면 뒤로가기의 논리적 목적지 — 직전에 머문 비-상세(리스트/홈/탭) 화면. raw goBack 의 히스토리 오염 회피.
    private var lastBrowsePath = "/main"
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
        print("❌ 네이버 로그인 실패/취소:", error?.localizedDescription ?? "unknown")
        // 사용자가 네이버 OAuth 를 취소하면 웹이 로그인 전환 로딩 상태에 멈춤(무한로딩) →
        // 전환 플래그 정리 + 현재 페이지 새로고침으로 복구하고 안내 토스트 표시.
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.webView.evaluateJavaScript("try{sessionStorage.removeItem('freetiful-auth-switching');}catch(e){}") { [weak self] _, _ in
                self?.webView.reload()
            }
            self.showNativeToast("로그인이 취소되었어요")
        }
    }

    // MARK: - Life Cycle
    override func viewDidLoad() {
        super.viewDidLoad()
        print("🧭 Freetiful current native auth build marker: 2026-05-08-kakao-native-api")
        setupWebView()
        setupBackSwipe()
        setupBizNav()
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
        // 홈 데이터를 앱 실행 즉시 로드 (웹 셸 onHome 신호 안 기다림) — 디스크 캐시 즉시 렌더 + 백그라운드 갱신
        hasLoadedHome = true
        nativeHomeContent.loadInitial()
        OneSignalManager.shared.deliverCurrentPushId()
    }

    // 비즈 페이지 네이티브 글래스 하단 네비 (홈 버튼 + 4 섹션 탭)
    private func setupBizNav() {
        nativeBizNav.isHidden = true
        nativeBizNav.onHome = { [weak self] in
            self?.webView.evaluateJavaScript("(window.__freetifulNavigate && window.__freetifulNavigate('/main'));", completionHandler: nil)
        }
        nativeBizNav.onTab = { [weak self] section in
            self?.webView.evaluateJavaScript("(window.__freetifulBizScroll && window.__freetifulBizScroll(\(self?.jsLiteral(section) ?? "''")));", completionHandler: nil)
        }
        view.addSubview(nativeBizNav)
        NSLayoutConstraint.activate([
            // 홈 네비바와 동일: 좌우 6, 화면 맨 아래 flush, 높이 80 (글래스 알약은 NativeBizNav 가 안전영역 위로 띄움)
            nativeBizNav.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 6),
            nativeBizNav.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -6),
            nativeBizNav.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            nativeBizNav.heightAnchor.constraint(equalToConstant: 80),
        ])
    }

    // 좌→우 엣지 스와이프로 이전 페이지
    // - 웹 페이지: WKWebView 자체 인터랙티브 슬라이드(allowsBackForwardNavigationGestures)
    // - 네이티브 오버레이(상세/채팅/알림 등): 손가락 따라 슬라이드되는 인터랙티브 back
    private var backSwipeViews: [UIView] = []
    private func setupBackSwipe() {
        let edge = UIScreenEdgePanGestureRecognizer(target: self, action: #selector(handleBackEdgePan(_:)))
        edge.edges = .left
        edge.delegate = self
        view.addGestureRecognizer(edge)
    }
    private func currentOverlayViews() -> [UIView] {
        var vs: [UIView] = []
        if isOnChatDetail { vs += [nativeChatMessages, nativeChatInputBar, nativeChatHeader] }
        else if isOnProDetail { vs.append(nativeProDetail) }
        else if isOnBizDetail { vs.append(nativeBizDetail) }
        else if isOnReviewList { vs.append(nativeReviewList) }
        else if isOnCategoryList { vs.append(nativeCategoryList) }
        else if isOnNotifications { vs.append(nativeNotifications) }
        else if isOnCustomerInquiries { vs.append(nativeCustomerInquiries) }
        else if isOnHelp { vs.append(nativeHelp) }
        else if isOnSearch { vs.append(nativeSearch) }
        if !isOnChatDetail && !nativeBackHeader.isHidden { vs.append(nativeBackHeader) }
        return vs
    }
    private func backSwipeOverlayActive() -> Bool {
        isOnChatDetail || isOnProDetail || isOnBizDetail || isOnReviewList || isOnCategoryList || isOnNotifications || isOnCustomerInquiries || isOnHelp || isOnSearch
    }
    @objc private func handleBackEdgePan(_ g: UIScreenEdgePanGestureRecognizer) {
        let tx = max(0, g.translation(in: view).x)
        switch g.state {
        case .began:
            backSwipeViews = currentOverlayViews()
        case .changed:
            for v in backSwipeViews { v.transform = CGAffineTransform(translationX: tx, y: 0) }
        case .ended, .cancelled, .failed:
            let w = view.bounds.width
            let complete = tx > w * 0.32 || g.velocity(in: view).x > 700
            let views = backSwipeViews
            backSwipeViews = []
            if complete {
                UIView.animate(withDuration: 0.22, delay: 0, options: [.curveEaseOut], animations: {
                    for v in views { v.transform = CGAffineTransform(translationX: w, y: 0) }
                }, completion: { _ in
                    // 숨긴 뒤 transform 리셋 → 원위치로 튀는 깜빡임 방지 (경로 옵저버가 곧 가시성 재설정)
                    for v in views { v.isHidden = true; v.transform = .identity }
                    if self.isOnChatDetail {
                        self.chatBarsDidTapBack()
                    } else if self.isTopLevelTab(self.currentNativePath) {
                        // 문의목록 등 최상위 탭 오버레이: raw goBack 이 이전 탭/구버전으로 가던 버그 → 홈으로
                        self.navigateNativeWeb(to: "/main", replace: true)
                    } else {
                        self.backHeaderTapBack()
                    }
                })
            } else {
                UIView.animate(withDuration: 0.2) { for v in views { v.transform = .identity } }
            }
        default: break
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
        ["kakaoLogin", "naverLogin", "googleLogin", "appleLogin", "socialLogout", "showNativeLogin", "oneSignalLogin", "pushLogin", "setOneSignalExternalId", "nativeNavState", "nativeChatState", "nativeChatListState", "nativeChatListRows", "nativeInquiryRows", "nativeChatMessages", "nativeHomeRows", "nativeHomeBanners", "nativeMyProfile", "nativeHomeBusiness", "nativeNotifications", "nativeCustomerInquiries", "nativeMCSearch"].forEach {
            contentController.add(self, name: $0)
        }

        let config = WKWebViewConfiguration()
        config.userContentController = contentController
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // 앱 시작 시 WKWebView 디스크/메모리 캐시 1회 비움 — 옛 JS 번들 고착으로 배포 수정이
        // 앱에 반영 안 되던 문제 방지(채팅 사진 등 웹 수정 즉시 반영)
        WKWebsiteDataStore.default().removeData(
            ofTypes: [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache],
            modifiedSince: Date(timeIntervalSince1970: 0),
            completionHandler: {}
        )

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.scrollView.delegate = self
        webView.allowsBackForwardNavigationGestures = true   // 웹 페이지: 좌→우 네이티브 인터랙티브 슬라이드 뒤로가기
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
          'html.freetiful-ios-native-nav [data-native-biz-nav]{display:none!important;pointer-events:none!important;}',
          'html.freetiful-ios-native-nav [data-native-chat-footer]{display:none!important;pointer-events:none!important;}',
          'html.freetiful-ios-native-nav [data-native-chatlist-header]{display:none!important;pointer-events:none!important;}',
          'html.freetiful-ios-native-nav [data-native-my-header]{display:none!important;pointer-events:none!important;}',
          'html.freetiful-ios-native-nav [data-native-home-header]{display:none!important;pointer-events:none!important;}',
          'html.freetiful-ios-native-nav [data-native-back-header]{display:none!important;pointer-events:none!important;}'
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
          search: window.location.search || '',
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
        currentNativeQuery = (state["search"] as? String) ?? ""
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
        let newPath = url.path.isEmpty ? "/" : url.path
        currentNativePath = newPath   // didSet 이 /pro-edit 이탈 시 상세 캐시 무효화 처리
        currentNativeQuery = url.query ?? ""
        renderNativeNavigation(animated: true)
    }

    private func renderNativeNavigation(animated: Bool) {
        // 상세가 아닌 화면(리스트/홈/탭)에 있을 때 그 경로를 기억 → 상세에서 뒤로가기 시 여기로 복귀
        if !isDetailPath(currentNativePath) {
            let q = currentNativeQuery.isEmpty ? "" : (currentNativeQuery.hasPrefix("?") ? currentNativeQuery : "?\(currentNativeQuery)")
            lastBrowsePath = currentNativePath + q
        }
        // 웹과 동일: role === 'pro' 이면 PRO nav, 아니면 USER nav (viewAsUser 무관, nav 내 토글 없음)
        let items = currentNativeActualIsPro ? nativeProNavItems : nativeUserNavItems

        nativeNavBar.configure(
            items: items,
            selectedPath: currentNativePath,
            showsModeToggle: false,
            isProMode: false
        )
        // 현재 보고 있는 탭의 뱃지는 즉시 숨김(새요청/채팅 진입 = 확인) — 웹 카운트 갱신 지연과 무관하게 바로 사라짐
        var displayBadges = currentNavBadges
        if currentNativePath == "/pro-dashboard/inquiries" { displayBadges["requests"] = 0 }
        if currentNativePath == "/chat" || currentNativePath.hasPrefix("/chat/") { displayBadges["chat"] = 0 }
        nativeNavBar.setBadges(displayBadges)

        let hidden = currentNativeHasBlockingOverlay || shouldHideNativeNavigation(path: currentNativePath)
        nativeNavBar.setVisible(!hidden, animated: animated)
        webView.scrollView.contentInset.bottom = hidden ? 0 : 88
        webView.scrollView.verticalScrollIndicatorInsets.bottom = hidden ? 0 : 88
        // 최상위 탭(홈/Biz/문의목록/채팅/마이)에선 WKWebView 자체 스와이프백을 끔 —
        // 탭은 "뒤로" 개념이 없어 raw history goBack 이 엉뚱한 이전 탭/구버전 렌더로 가던 버그 방지.
        // 서브페이지(상세 등)에선 켜둠. 네이티브 오버레이는 별도 엣지팬(handleBackEdgePan)이 처리.
        webView.allowsBackForwardNavigationGestures = !isTopLevelTab(currentNativePath) && !backSwipeOverlayActive()
        updateNativeChatVisibility()
        // updateNativeChatVisibility 가 isOnProDetail 등 오버레이 플래그를 갱신 → 최신값으로 재확정.
        // 네이티브 오버레이(사회자 상세 등) 화면에선 WKWebView 스와이프를 꺼야 함.
        // (안 끄면 웹 레이어만 스와이프 애니메이션되고 불투명 오버레이는 그대로라 '현재 페이지가 뒤에 보이는' 버그)
        webView.allowsBackForwardNavigationGestures = !isTopLevelTab(currentNativePath) && !backSwipeOverlayActive()

        // 비즈 메인 페이지: 네이티브 글래스 하단 네비 표출 (웹 하단 네비 숨김은 CSS로)
        let onBiz = (currentNativePath == "/biz" || currentNativePath == "/biz/")
        if onBiz != isOnBiz {
            isOnBiz = onBiz
            nativeBizNav.isHidden = !onBiz
            if onBiz {
                // 비즈 페이지: 하단 세이프에어리어 제거 — webView 가 화면 맨 아래까지(흰 여백 제거)
                webViewBottomSafe?.isActive = false
                webViewBottomFull?.isActive = true
            } else if !isOnChatDetail {
                // /biz 이탈 시 복귀 (채팅상세가 full-bottom 을 쓰는 중이면 유지)
                webViewBottomFull?.isActive = false
                webViewBottomSafe?.isActive = true
            }
        }
        if onBiz { view.bringSubviewToFront(nativeBizNav) }
    }

    // 하단 네비 최상위 탭 경로 — "뒤로가기" 개념이 없는 화면들
    private func isTopLevelTab(_ rawPath: String) -> Bool {
        let path = rawPath.split(separator: "?").first.map(String.init) ?? rawPath
        // /biz 전체(서브섹션 /biz/clients, /biz/faq 등 포함)는 WKWebView 스와이프백 금지 —
        // 서브페이지가 최상위로 인식 안 되면 스와이프가 켜져 오염된 SPA 히스토리(직전 /inquiries 등)로 가던 버그.
        if path == "/biz" || path.hasPrefix("/biz/") { return true }
        return ["/main", "/inquiries", "/pro-dashboard/inquiries", "/chat", "/my"].contains(path)
    }

    private func shouldHideNativeNavigation(path rawPath: String) -> Bool {
        // 웹 layout.tsx 의 HIDE_NAV_PATTERNS 와 동일하게 nav 를 숨길 경로
        let path = rawPath.split(separator: "?").first.map(String.init) ?? rawPath   // 쿼리 제거(?category= 등)
        if path.hasPrefix("/chat/") { return true }
        if path.hasPrefix("/pros/") { return true }
        if path.hasPrefix("/businesses/") { return true }
        if path.hasPrefix("/my/") { return true }
        if path.hasPrefix("/notifications") { return true }
        if path.hasPrefix("/pro-register") { return true }
        if path.hasPrefix("/biz") { return true }
        if path.hasPrefix("/search") { return true }
        if path.hasPrefix("/wedding-mc") { return true }
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

        // 마이페이지 네이티브 본문 (웹 위 덮음, 헤더 아래)
        nativeMyContent.delegate = self
        nativeMyContent.isHidden = true
        view.insertSubview(nativeMyContent, belowSubview: nativeMyHeader)
        NSLayoutConstraint.activate([
            nativeMyContent.topAnchor.constraint(equalTo: view.topAnchor),
            nativeMyContent.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            nativeMyContent.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            nativeMyContent.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        // 상세화면 글래스 백헤더 (뒤로가기)
        nativeBackHeader.isHidden = true
        nativeBackHeader.delegate = self
        view.addSubview(nativeBackHeader)
        NSLayoutConstraint.activate([
            nativeBackHeader.topAnchor.constraint(equalTo: view.topAnchor),
            nativeBackHeader.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            nativeBackHeader.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            nativeBackHeader.titleTopAnchorRef.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 4),
        ])

        // 알림 화면 네이티브 본문 (웹 위 덮음, 백헤더 아래)
        nativeNotifications.isHidden = true
        nativeNotifications.delegate = self
        view.insertSubview(nativeNotifications, belowSubview: nativeBackHeader)
        NSLayoutConstraint.activate([
            nativeNotifications.topAnchor.constraint(equalTo: view.topAnchor),
            nativeNotifications.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            nativeNotifications.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            nativeNotifications.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        // 검색 화면 네이티브 본문 (웹 위 덮음 — 자체 검색바)
        nativeSearch.isHidden = true
        nativeSearch.delegate = self
        view.insertSubview(nativeSearch, belowSubview: nativeBackHeader)
        NSLayoutConstraint.activate([
            nativeSearch.topAnchor.constraint(equalTo: view.topAnchor),
            nativeSearch.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            nativeSearch.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            nativeSearch.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        // 고객 문의목록 네이티브 본문 (웹 위 덮음, 백헤더 아래)
        nativeCustomerInquiries.isHidden = true
        nativeCustomerInquiries.delegate = self
        view.insertSubview(nativeCustomerInquiries, belowSubview: nativeBackHeader)
        NSLayoutConstraint.activate([
            nativeCustomerInquiries.topAnchor.constraint(equalTo: view.topAnchor),
            nativeCustomerInquiries.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            nativeCustomerInquiries.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            nativeCustomerInquiries.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        // 고객센터(FAQ/공지/약관) 네이티브 본문 (웹 위 덮음, 백헤더 아래)
        nativeHelp.isHidden = true
        nativeHelp.delegate = self
        view.insertSubview(nativeHelp, belowSubview: nativeBackHeader)
        NSLayoutConstraint.activate([
            nativeHelp.topAnchor.constraint(equalTo: view.topAnchor),
            nativeHelp.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            nativeHelp.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            nativeHelp.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        // 사회자 상세 네이티브 본문 (웹 위 덮음, 백헤더 아래)
        nativeProDetail.isHidden = true
        nativeProDetail.delegate = self
        view.insertSubview(nativeProDetail, belowSubview: nativeBackHeader)
        NSLayoutConstraint.activate([
            nativeProDetail.topAnchor.constraint(equalTo: view.topAnchor),
            nativeProDetail.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            nativeProDetail.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            nativeProDetail.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        // 웨딩파트너 상세 네이티브 본문 (웹 위 덮음, 백헤더 아래)
        nativeBizDetail.isHidden = true
        view.insertSubview(nativeBizDetail, belowSubview: nativeBackHeader)
        NSLayoutConstraint.activate([
            nativeBizDetail.topAnchor.constraint(equalTo: view.topAnchor),
            nativeBizDetail.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            nativeBizDetail.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            nativeBizDetail.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        // 카테고리 리스트 네이티브 본문 (웹 위 덮음, 백헤더 아래)
        nativeCategoryList.isHidden = true
        nativeCategoryList.delegate = self
        nativeCategoryList.onHeaderGlass = { [weak self] progress in self?.nativeBackHeader.setGlassProgress(progress) }
        view.insertSubview(nativeCategoryList, belowSubview: nativeBackHeader)
        NSLayoutConstraint.activate([
            nativeCategoryList.topAnchor.constraint(equalTo: view.topAnchor),
            nativeCategoryList.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            nativeCategoryList.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            nativeCategoryList.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        // 리뷰 전체 리스트 네이티브 본문 (웹 위 덮음, 백헤더 아래)
        nativeReviewList.isHidden = true
        view.insertSubview(nativeReviewList, belowSubview: nativeBackHeader)
        NSLayoutConstraint.activate([
            nativeReviewList.topAnchor.constraint(equalTo: view.topAnchor),
            nativeReviewList.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            nativeReviewList.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            nativeReviewList.bottomAnchor.constraint(equalTo: view.bottomAnchor),
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
            let top = nativeChatListBar.frame.height > 0 ? nativeChatListBar.frame.height - 8 : (view.safeAreaInsets.top + 84)
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
        // 키보드 프레임을 뷰 좌표계로 변환 후 겹침 계산 (윈도우 좌표 불일치로 인한 빈틈/웹뷰 노출 방지)
        let kbInView = view.convert(frame, from: nil)
        let overlap = max(0, view.bounds.maxY - kbInView.minY)
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
        refreshNativeCustomerRequestInfo()   // ⋮ → '고객 정보 보기' 모달용 — 견적폼 닫아도 유지
    }

    // 고객 요청(견적) 정보를 웹 브리지에서 받아 VC 에 캐시(폴백용)
    private func refreshNativeCustomerRequestInfo() {
        fetchCustomerRequestInfo { [weak self] info in if let info = info { self?.nativeCustomerRequestInfo = info } }
    }
    // 항상 최신 roomMeta 로 새로 패치 — 초기(roomMeta 미로드) 캐시가 날짜/장소 미정으로 남던 버그 방지
    private func fetchCustomerRequestInfo(_ done: @escaping (NativeCustomerRequestModal.Info?) -> Void) {
        guard nativeChatState.isPro else { done(nil); return }
        let js = "(function(){ try { return JSON.stringify((window.__freetifulChatActions && window.__freetifulChatActions.getRequestInfo) ? window.__freetifulChatActions.getRequestInfo() : null); } catch(e){ return 'null'; } })();"
        webView.evaluateJavaScript(js) { result, _ in
            guard let s = result as? String, s != "null", let data = s.data(using: .utf8),
                  let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { done(nil); return }
            var i = NativeCustomerRequestModal.Info()
            i.customerName = (o["customerName"] as? String) ?? ""
            i.customerImage = (o["customerImage"] as? String) ?? ""
            i.eventName = (o["eventName"] as? String) ?? ""
            i.eventDate = (o["eventDate"] as? String) ?? ""
            i.eventTime = (o["eventTime"] as? String) ?? ""
            i.eventLocation = (o["eventLocation"] as? String) ?? ""
            i.planLabel = (o["planLabel"] as? String) ?? ""
            i.categoryName = (o["categoryName"] as? String) ?? ""
            i.memo = (o["memo"] as? String) ?? ""
            i.latestAmount = (o["latestAmount"] as? Int) ?? Int((o["latestAmount"] as? Double) ?? 0)
            done(i)
        }
    }

    private func buildAttachItems(isPro: Bool) -> [ChatMenuItem] {
        var items: [ChatMenuItem] = []
        if isPro {
            items.append(ChatMenuItem(id: "quote", label: "견적서 발송", sf: "doc.text.fill", destructive: false))
        }
        items.append(contentsOf: [
            ChatMenuItem(id: "camera", label: "카메라", sf: "camera.fill", destructive: false),
            ChatMenuItem(id: "photo", label: "사진", sf: "photo.fill", destructive: false),
            ChatMenuItem(id: "file", label: "파일", sf: "doc.fill", destructive: false),
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
            let topInset = view.safeAreaInsets.top + 52 + 2 // 글래스 헤더 높이 + 여백(타이트)
            nativeChatMessages.setInsets(top: topInset, bottom: 10)
            requestNativeChatMessages()
        }

        // ─── 채팅 리스트 ───
        if onList != isOnChatList {
            isOnChatList = onList
            nativeChatListBar.isHidden = !onList
            if onList { nativeChatListContent.scrollToTop() }   // 진입 시 최상단
        }
        if onList { requestNativeChatListState() }

        // 마이페이지 글래스 헤더
        let onMy = currentNativePath == "/my"
        if onMy != isOnMy {
            isOnMy = onMy
            nativeMyHeader.isHidden = !onMy
            nativeMyContent.isHidden = !onMy
            if onMy { nativeMyContent.scrollToTop() }   // 진입 시 최상단
        }
        if onMy {
            view.bringSubviewToFront(nativeMyContent)
            view.bringSubviewToFront(nativeMyHeader)
            view.bringSubviewToFront(nativeNavBar)   // 하단 네비바가 본문 위에 보이도록
            nativeMyContent.setInsets(top: view.safeAreaInsets.top + 36, bottom: 92)   // 헤더 그라데이션 마스크라 타이틀 바로 아래로 당김(+8 스택 패딩 보정)
            nativeMyContent.setPartnerRowHidden(currentNativeActualIsPro)   // 사회자면 파트너 신청 숨김(웹과 동일)
            // 브리지 준비 타이밍 보강 — 프로필 몇 번 재요청 (로그인 직후 리로드 하이드레이션까지 커버)
            for delay in [0.0, 0.4, 1.2, 2.5, 5.0, 10.0] {
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in self?.requestMyProfile() }
            }
        }

        // 상세화면 글래스 백헤더 (사회자/업체 상세 등 — 뒤로가기)
        let onDetailPage = isDetailPath(currentNativePath)
        let enteringWebDetail = onDetailPage && !isOnDetail   // 웹 상세(프로필수정/구매내역 등) 진입 전환
        isOnDetail = onDetailPage
        nativeBackHeader.setSearchVisible(false)   // 기본 숨김 — 웨딩파트너 리스트에서만 표출
        let detailPathOnlyEarly = currentNativePath.split(separator: "?").first.map(String.init) ?? currentNativePath
        let nativeOwnsTitle = detailPathOnlyEarly.hasPrefix("/businesses/") || detailPathOnlyEarly.hasSuffix("/reviews")   // 업체 상세/리뷰리스트는 네이티브가 타이틀 주입
        if onDetailPage {
            view.bringSubviewToFront(nativeBackHeader)
            // 기본: 일반 상세(웹)는 글래스 항상 ON·공유 없음 — 사회자 상세는 아래 onProDetail에서 스크롤 구동으로 덮어씀
            nativeBackHeader.setShareVisible(false)
            nativeBackHeader.setGlassProgress(1)
            // document.title이 브랜드명/빈값이면 페이지 H1(브랜드 제외)로 폴백, 그래도 없으면 빈 타이틀
            if !nativeOwnsTitle {
                let titleJS = "(function(){var bad=function(s){return !s||/freetiful|프리티풀/i.test(s);};var t=(document.title||'').trim();if(bad(t)){var hs=document.querySelectorAll('main h1, h1');for(var i=0;i<hs.length;i++){var x=(hs[i].textContent||'').trim();if(x&&!bad(x))return x;}return '';}return t;})()"
                webView.evaluateJavaScript(titleJS) { [weak self] r, _ in
                    guard let self = self, let t = r as? String else { return }
                    self.nativeBackHeader.setTitle(self.cleanDetailTitle(t))
                }
            }
        }

        // 알림 화면 (네이티브 리스트 + 글래스 백헤더)
        let onNotif = currentNativePath == "/notifications"
        if onNotif != isOnNotifications {
            isOnNotifications = onNotif
            nativeNotifications.isHidden = !onNotif
        }
        if onNotif {
            view.bringSubviewToFront(nativeNotifications)
            view.bringSubviewToFront(nativeBackHeader)
            nativeBackHeader.setShareVisible(false)
            nativeBackHeader.setGlassProgress(1)
            nativeBackHeader.setTitle("알림")
            nativeNotifications.setInsets(top: view.safeAreaInsets.top + 50, bottom: view.safeAreaInsets.bottom + 12)
            for delay in [0.0, 0.4, 1.2, 2.5] {
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in self?.requestNotifications() }
            }
        }

        // 검색 화면 (네이티브 글래스 검색바 + 결과)
        let onSearch = currentNativePath == "/search"
        if onSearch != isOnSearch {
            isOnSearch = onSearch
            nativeSearch.isHidden = !onSearch
            if onSearch {
                nativeSearch.setInsets(top: view.safeAreaInsets.top + 8, bottom: view.safeAreaInsets.bottom + 12)
                view.bringSubviewToFront(nativeSearch)
                nativeSearch.prepareForShow()   // 소개 문구 회전 + 최근검색어/추천 갱신
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in self?.nativeSearch.focus() }
            } else {
                nativeSearch.resignSearch()
            }
        }

        // 고객 문의목록 화면 (네이티브 상태 카드 + 문의내역/보관함 탭)
        let onCustInq = currentNativePath == "/inquiries"
        if onCustInq != isOnCustomerInquiries {
            isOnCustomerInquiries = onCustInq
            nativeCustomerInquiries.isHidden = !onCustInq
            if onCustInq {
                loadCachedCustomerInquiries()   // 진입 즉시 캐시 표시 (웹 브리지 응답 전)
                nativeCustomerInquiries.scrollToTop()   // 진입 시 최상단
                MCSearchActivity.endAll()       // 요청목록 확인 = 사회자 찾기 액티비티 종료
            }
        }
        if onCustInq {
            view.bringSubviewToFront(nativeCustomerInquiries)
            view.bringSubviewToFront(nativeBackHeader)
            nativeBackHeader.setShareVisible(false)
            nativeBackHeader.setGlassProgress(1)
            nativeBackHeader.setTitle("문의목록")
            nativeCustomerInquiries.setInsets(top: view.safeAreaInsets.top + 50, bottom: view.safeAreaInsets.bottom + 12)
            for delay in [0.0, 0.4, 1.2, 2.5] {
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in self?.requestCustomerInquiries() }
            }
        }

        // 고객센터(FAQ/공지/약관) 화면 — 글래스 탭 네이티브
        let onHelp = helpPaths.contains(currentNativePath)
        if onHelp != isOnHelp {
            isOnHelp = onHelp
            nativeHelp.isHidden = !onHelp
        }
        if onHelp {
            view.bringSubviewToFront(nativeHelp)
            view.bringSubviewToFront(nativeBackHeader)
            let tab: Int
            let title: String
            switch currentNativePath {
            case "/my/announcements": tab = 1; title = "공지사항"
            case "/my/terms": tab = 2; title = "약관 및 정책"
            case "/my/faq": tab = 0; title = "자주 묻는 질문"
            default: tab = 0; title = "고객센터"
            }
            nativeHelp.setInsets(top: view.safeAreaInsets.top + 50, bottom: view.safeAreaInsets.bottom + 12)
            nativeHelp.setTab(tab)
            nativeHelp.loadIfNeeded()   // 3개 탭 모두 미리 로드
            nativeBackHeader.setShareVisible(false)
            nativeBackHeader.setGlassProgress(1)
            nativeBackHeader.setTitle(title)
        }

        // 사회자 상세 네이티브 (정확히 /pros/:id 만 — 하위 리뷰/체크아웃 제외)
        let detailPathOnly = currentNativePath.split(separator: "?").first.map(String.init) ?? currentNativePath
        let onProDetail = detailPathOnly.range(of: "^/pros/[^/]+$", options: .regularExpression) != nil
        if onProDetail != isOnProDetail {
            isOnProDetail = onProDetail
            nativeProDetail.isHidden = !onProDetail
        }
        if onProDetail {
            view.bringSubviewToFront(nativeProDetail)
            view.bringSubviewToFront(nativeBackHeader)
            nativeProDetail.setInsets(top: view.safeAreaInsets.top + 50, bottom: view.safeAreaInsets.bottom)
            // 사회자 상세: 헤더는 히어로 위에선 투명(글래스 버튼만), 스크롤로 가리면 글래스 + 공유 버튼 노출
            nativeBackHeader.setShareVisible(true)
            nativeBackHeader.setGlassProgress(0)
            nativeProDetail.onScroll = { [weak self] p in self?.nativeBackHeader.setGlassProgress(p) }
            let pid = String(detailPathOnly.dropFirst("/pros/".count))
            if pid != currentProDetailId {
                currentProDetailId = pid
                nativeProDetail.loadDetail(id: pid)
            }
        } else {
            currentProDetailId = ""
        }

        // 웨딩파트너(업체) 상세 네이티브 (정확히 /businesses/:id)
        let onBizDetail = detailPathOnly.range(of: "^/businesses/[^/]+$", options: .regularExpression) != nil
        if onBizDetail != isOnBizDetail {
            isOnBizDetail = onBizDetail
            nativeBizDetail.isHidden = !onBizDetail
        }
        if onBizDetail {
            view.bringSubviewToFront(nativeBizDetail)
            view.bringSubviewToFront(nativeBackHeader)
            nativeBizDetail.setInsets(top: view.safeAreaInsets.top + 50, bottom: view.safeAreaInsets.bottom)
            nativeBackHeader.setShareVisible(true)
            nativeBackHeader.setGlassProgress(0)
            nativeBizDetail.onScroll = { [weak self] p in self?.nativeBackHeader.setGlassProgress(p) }
            nativeBizDetail.onTitle = { [weak self] name in self?.nativeBackHeader.setTitle(name) }
            let bid = String(detailPathOnly.dropFirst("/businesses/".count))
            if bid != currentBizDetailId {
                currentBizDetailId = bid
                nativeBizDetail.loadDetail(id: bid)
            }
        } else {
            currentBizDetailId = ""
        }

        // 카테고리 리스트 네이티브 (홈 카테고리 아이콘 → /pros, /businesses)
        let onProCategory = detailPathOnly == "/pros"
        let onBizCategory = detailPathOnly == "/businesses"
        let onCategoryList = onProCategory || onBizCategory
        if onCategoryList != isOnCategoryList {
            isOnCategoryList = onCategoryList
            nativeCategoryList.isHidden = !onCategoryList
        }
        if onCategoryList {
            view.bringSubviewToFront(nativeCategoryList)
            view.bringSubviewToFront(nativeBackHeader)
            nativeCategoryList.setInsets(top: view.safeAreaInsets.top + 50, bottom: view.safeAreaInsets.bottom + 12)
            nativeBackHeader.setShareVisible(false)
            nativeBackHeader.setSearchVisible(onBizCategory)   // 웨딩파트너 리스트만 검색 버튼
            nativeBackHeader.onSearch = { [weak self] in self?.nativeCategoryList.toggleSearch() }
            let cat = queryParam("category", from: currentNativeQuery)
            // 웨딩홀: 상단 그라데이션 블러가 헤더 배경을 담당 → 백헤더 글래스 끔(뒤로/타이틀만 표시)
            nativeBackHeader.setGlassProgress((onBizCategory && cat == "웨딩홀") ? 0 : 1)
            if onProCategory {
                nativeBackHeader.setTitle(cat.isEmpty ? "사회자" : cat)
                nativeCategoryList.configure(mode: .pro, category: cat)
            } else {
                nativeBackHeader.setTitle("웨딩파트너")
                nativeCategoryList.configure(mode: .business, category: cat)
            }
        }

        // 사회자 리뷰 전체 리스트 (/pros/:id/reviews)
        let onReviewList = detailPathOnly.range(of: "^/pros/[^/]+/reviews$", options: .regularExpression) != nil
        if onReviewList != isOnReviewList {
            isOnReviewList = onReviewList
            nativeReviewList.isHidden = !onReviewList
        }
        if onReviewList {
            view.bringSubviewToFront(nativeReviewList)
            view.bringSubviewToFront(nativeBackHeader)
            nativeReviewList.setInsets(top: view.safeAreaInsets.top + 50, bottom: view.safeAreaInsets.bottom + 12)
            nativeBackHeader.setShareVisible(false)
            nativeBackHeader.setGlassProgress(1)
            nativeBackHeader.setTitle("리뷰")
            let rid = String(detailPathOnly.dropFirst("/pros/".count).dropLast("/reviews".count))
            if rid != currentReviewProId {
                currentReviewProId = rid
                nativeReviewList.loadReviews(proId: rid)
            }
        } else {
            currentReviewProId = ""
        }

        // 백헤더 가시성 통합 제어 — 상세/알림/문의목록/카테고리리스트/리뷰가 아니면 반드시 숨김 (뒤로가기 후 잔존 방지)
        nativeBackHeader.isHidden = !(onDetailPage || onNotif || onCustInq || onCategoryList || onReviewList)

        // 홈 글래스 헤더 (스페이서가 공간 확보하므로 콘텐츠 인셋은 변경 안 함)
        let onHome = currentNativePath == "/main" || currentNativePath == "/"
        if onHome != isOnHome {
            isOnHome = onHome
            nativeHomeHeader.isHidden = !onHome
            nativeHomeContent.isHidden = !onHome
        }
        if onHome {
            view.bringSubviewToFront(nativeHomeHeader)
            let top = view.safeAreaInsets.top + 58
            nativeHomeContent.setInsets(top: top, bottom: 92)
            homeRequestBusiness()   // 웹 큐레이션 웨딩파트너 요청 (매 진입)
            // 홈 데이터(loadInitial)는 앱 실행 즉시 이미 로드함 — 여기선 웹 의존 업체 브리지만 보강
            if !didFirstOnHome {
                didFirstOnHome = true
                // 웨딩파트너 큐레이션(웹 브리지)은 웹 로드 후 가능 — 첫 진입 시 레이스 보강
                for delay in [0.5, 1.5, 3.0, 5.0] {
                    DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in self?.homeRequestBusiness() }
                }
            }
        }

        // 네이티브 헤더(리스트/마이) 아래에서 웹 콘텐츠 시작하도록 상단 인셋 (홈은 네이티브가 덮음)
        let needsHeaderInset = onList || onMy
        let webTopInset: CGFloat = needsHeaderInset ? 88 : (onDetailPage ? 50 : 0)
        webView.scrollView.contentInset.top = webTopInset
        webView.scrollView.verticalScrollIndicatorInsets.top = webTopInset
        // 웹 상세(프로필수정/구매내역 등) 진입 시 페이지 최상단이 헤더에 가려지던 문제 —
        // 인셋만 주고 오프셋을 안 당겨 '이름'부터 보였음. 진입 시 -inset 으로 스냅(+Next 늦은 scrollTo(0,0) 보정)
        if enteringWebDetail, webTopInset > 0 {
            webView.scrollView.setContentOffset(CGPoint(x: 0, y: -webTopInset), animated: false)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
                guard let self = self, self.isOnDetail, !self.webView.scrollView.isTracking,
                      self.webView.scrollView.contentOffset.y == 0 else { return }
                self.webView.scrollView.setContentOffset(CGPoint(x: 0, y: -webTopInset), animated: false)
            }
        }

        // 리스트 본문(네이티브 테이블) — 채팅(/chat) & 새요청(/pro-dashboard/inquiries)
        let onChatListNative = currentNativePath == "/chat"
        let onInquiryNative = currentNativePath == "/pro-dashboard/inquiries"
        // 주의: isOnChatList 는 위 탭바 가드(/chat+새요청 공용) 전용 — 여기서 덮어쓰면
        // 새요청에서 false 가 되어 홈 이동 시 탭바가 안 숨겨짐(잔존 버그). 본문 진입 감지는 별도 플래그.
        let enteringChat = onChatListNative && !isOnChatRows        // 채팅 진입 전환
        let enteringInquiry = onInquiryNative && !isOnInquiry       // 새요청 진입 전환
        isOnChatRows = onChatListNative
        isOnInquiry = onInquiryNative
        nativeChatListContent.isHidden = !onChatListNative
        nativeInquiryContent.isHidden = !onInquiryNative
        let listTop = nativeChatListBar.frame.height > 0 ? nativeChatListBar.frame.height - 8 : (view.safeAreaInsets.top + 84)   // 탭 알약 바로 아래로 당김(바 하단 10pt 패딩 축소)
        if onChatListNative {
            if enteringChat {
                // 탭바 즉시 표시(웹 왕복 기다리지 않음) + 캐시 행 즉시 렌더
                nativeChatListBar.exitSearch()
                nativeChatListBar.setTitle("채팅")
                nativeChatListBar.setSearchHidden(false)
                nativeChatListBar.configure(tabs: ["전체", "읽음", "안 읽음", "숨김"], selected: cachedListTab("chat"))
                webChatRowsArrived = false
                loadCachedChatRows()
                // 토큰 확보까지 재시도하며 직접 fetch — 웹뷰 체인(하이드레이션/마운트) 안 기다림
                directFetchWithTokenRetry(isChat: true)
            }
            nativeChatListContent.setInsets(top: listTop, bottom: 92)
            requestNativeChatListRows()
        }
        if onInquiryNative {
            nativeInquiryContent.setInsets(top: listTop, bottom: 92)
            if enteringInquiry {
                // 탭바 즉시 표시 + 캐시 행 즉시 렌더
                nativeChatListBar.exitSearch()
                nativeChatListBar.setTitle("새 요청")
                nativeChatListBar.setSearchHidden(true)
                nativeChatListBar.configure(tabs: ["전체", "다수요청", "개인요청", "보관"], selected: cachedListTab("inquiry"))
                webInquiryRowsArrived = false
                loadCachedInquiryRows()
                nativeInquiryContent.scrollToTop()
                // 토큰 확보까지 재시도하며 직접 fetch — 첫 실행(토큰 미저장)도 동작
                directFetchWithTokenRetry(isChat: false)
                // 페이지 마운트 지연 대비 재요청 사다리 (프리페치 브리지 → 페이지 브리지 순으로 채워짐)
                for delay in [0.3, 0.9, 2.0] {
                    DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in self?.requestNativeInquiryRows() }
                }
            }
            requestNativeInquiryRows()
        }
    }
    private func cachedListTab(_ context: String) -> String {
        UserDefaults.standard.string(forKey: context == "inquiry" ? "ftInquiryTab" : "ftChatTab") ?? "전체"
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
        // 선택 탭 저장 → 다음 진입 시 즉시 복원
        if !tab.isEmpty { UserDefaults.standard.set(tab, forKey: context == "inquiry" ? "ftInquiryTab" : "ftChatTab") }
    }

    // MARK: - NativeChatListBarDelegate
    func chatListSelectTab(_ tab: String) {
        let hook = lastListContext == "inquiry" ? "__freetifulInquiryList" : "__freetifulChatList"
        webView.evaluateJavaScript("window.\(hook) && window.\(hook).setTab(\(jsLiteral(tab)));", completionHandler: nil)
    }
    func chatListTapSearch() {
        // 검색 UI는 NativeChatListBar 가 자체 표시 — 여기선 추가 동작 없음
    }
    func chatListSearchChanged(_ query: String) {
        // 웹 리스트 필터(search state) → 필터된 행이 자동으로 네이티브에 재전송됨
        webView.evaluateJavaScript("window.__freetifulChatList && window.__freetifulChatList.setSearch && window.__freetifulChatList.setSearch(\(jsLiteral(query)));", completionHandler: nil)
    }

    private func requestNativeChatListRows() {
        webView.evaluateJavaScript("window.__freetifulChatListRowsPost && window.__freetifulChatListRowsPost();", completionHandler: nil)
    }

    private func handleNativeChatListRows(_ body: Any) {
        guard nativeNavigationEnabled, let arr = body as? [[String: Any]] else { return }
        webChatRowsArrived = true
        applyChatRows(arr, cache: true)
    }
    private func applyChatRows(_ arr: [[String: Any]], cache: Bool) {
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
        // 디스크 캐시 (다음 진입 시 즉시 표시) — 빈 배열이면 캐시 유지
        if cache, !arr.isEmpty, let data = try? JSONSerialization.data(withJSONObject: arr) {
            UserDefaults.standard.set(data, forKey: "ftChatRows")
        }
    }
    private func loadCachedChatRows() {
        guard let data = UserDefaults.standard.data(forKey: "ftChatRows"),
              let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            NSLog("[ft.perf] chat cache: EMPTY")
            return
        }
        NSLog("[ft.perf] chat cache: %d rows → 즉시 표시", arr.count)
        applyChatRows(arr, cache: false)
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
        // 페이지 브리지(탭 필터 정확) 우선, 미마운트면 레이아웃 프리페치 캐시로 즉시 행 전송
        let js = "(function(){ if (window.__freetifulInquiryList && window.__freetifulInquiryRowsPost) { window.__freetifulInquiryRowsPost(); return; } if (window.__freetifulInquiryPrefetchPost) { window.__freetifulInquiryPrefetchPost(); } })();"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    private func handleNativeInquiryRows(_ body: Any) {
        guard nativeNavigationEnabled, let arr = body as? [[String: Any]] else { return }
        webInquiryRowsArrived = true
        applyInquiryRows(arr, cache: true)
    }

    private func applyInquiryRows(_ arr: [[String: Any]], cache: Bool) {
        let items: [NativeInquiryItem] = arr.compactMap { d in
            guard let id = d["id"] as? String else { return nil }
            let parts = (d["parts"] as? [String]) ?? []
            return NativeInquiryItem(
                id: id,
                customerId: (d["customerId"] as? String) ?? "",
                matchRequestId: (d["matchRequestId"] as? String) ?? "",
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
        // 디스크 캐시 (다음 진입 시 즉시 표시) — 신선 응답이 빈 배열이면 캐시 유지
        if cache, !arr.isEmpty, let data = try? JSONSerialization.data(withJSONObject: arr) {
            UserDefaults.standard.set(data, forKey: "ftInquiryRows")
        }
    }

    private func loadCachedInquiryRows() {
        guard let data = UserDefaults.standard.data(forKey: "ftInquiryRows"),
              let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            NSLog("[ft.perf] inquiry cache: EMPTY")
            return
        }
        NSLog("[ft.perf] inquiry cache: %d rows → 즉시 표시", arr.count)
        applyInquiryRows(arr, cache: false)
    }

    // ─── 새요청 직접 fetch (웹뷰/페이지 마운트 불요 — 토큰만 있으면 즉시) ───
    private var nativeAuthToken: String { UserDefaults.standard.string(forKey: "ftAccessToken") ?? "" }
    private func syncAuthToken(_ completion: (() -> Void)? = nil) {
        let js = "(function(){try{var a=JSON.parse(localStorage.getItem('prettyful-auth')||'{}');return (a.state&&a.state.accessToken)||'';}catch(e){return ''}})()"
        webView.evaluateJavaScript(js) { result, err in
            if let t = result as? String {
                NSLog("[ft.perf] token sync: %d chars", t.count)
                if t.isEmpty { UserDefaults.standard.removeObject(forKey: "ftAccessToken") }
                else { UserDefaults.standard.set(t, forKey: "ftAccessToken") }
            } else {
                NSLog("[ft.perf] token sync FAIL: %@", err?.localizedDescription ?? "nil result")
            }
            completion?()
        }
    }
    private var webInquiryRowsArrived = false   // 이번 진입에서 웹(브리지) 행 수신 여부 — 직접 fetch 가 덮어쓰지 않게
    private func fetchProInquiriesDirect() {
        let token = nativeAuthToken
        guard !token.isEmpty else { return }
        NativeHomeData.loadProInquiries(token: token) { [weak self] rows in
            guard let self = self, let rows = rows, !rows.isEmpty else { return }
            // 웹 브리지 행(탭 필터 정확)이 이미 왔으면 양보 — 직접 fetch 는 빈 화면을 빠르게 채우는 용도
            guard !self.webInquiryRowsArrived else {
                // 디스크 캐시 워밍만 (다음 실행 즉시 표시)
                if let data = try? JSONSerialization.data(withJSONObject: rows) {
                    UserDefaults.standard.set(data, forKey: "ftInquiryRows")
                }
                return
            }
            self.applyInquiryRows(rows, cache: true)
        }
    }

    private var webChatRowsArrived = false   // 채팅 — 동일 가드
    private func fetchChatRoomsDirect() {
        let token = nativeAuthToken
        guard !token.isEmpty else { return }
        NativeHomeData.loadChatRooms(token: token) { [weak self] rows in
            guard let self = self, let rows = rows, !rows.isEmpty else { return }
            guard !self.webChatRowsArrived else {
                if let data = try? JSONSerialization.data(withJSONObject: rows) {
                    UserDefaults.standard.set(data, forKey: "ftChatRows")
                }
                return
            }
            self.applyChatRows(rows, cache: true)
        }
    }

    // 토큰이 아직 동기화 전(첫 실행 직진입)이어도 확보될 때까지 재시도 — 둘 다 직접 fetch 보장
    private var directFetchSeq = 0
    private func directFetchWithTokenRetry(isChat: Bool) {
        directFetchSeq += 1
        let seq = directFetchSeq
        func attempt(_ remaining: [Double]) {
            guard seq == directFetchSeq else { return }   // 새 진입이 시작되면 이전 사다리 중단
            syncAuthToken { [weak self] in
                guard let self = self, seq == self.directFetchSeq else { return }
                if !self.nativeAuthToken.isEmpty {
                    isChat ? self.fetchChatRoomsDirect() : self.fetchProInquiriesDirect()
                    return
                }
                // 웹 행이 이미 왔으면 중단, 아니면 잠시 후 재시도(웹뷰 로드 대기)
                if isChat ? self.webChatRowsArrived : self.webInquiryRowsArrived { return }
                guard let next = remaining.first else { return }
                DispatchQueue.main.asyncAfter(deadline: .now() + next) { attempt(Array(remaining.dropFirst())) }
            }
        }
        attempt([0.8, 1.5, 2.5, 4.0])
    }

    // MARK: - NativeInquiryContentDelegate
    private var inquiryChatOpening = false
    func inquiryDidTapChat(_ id: String, customerId: String, matchRequestId: String) {
        guard !inquiryChatOpening else { return }   // 중복 탭 방지
        inquiryChatOpening = true
        let token = nativeAuthToken
        NSLog("[ft.perf] inquiry TAP: customerId=%@ matchReq=%@ token=%dchars path=%@",
              customerId.isEmpty ? "EMPTY" : "ok", matchRequestId.isEmpty ? "EMPTY" : "ok",
              token.count, token.isEmpty ? "webBridge" : (customerId.isEmpty ? "resolve" : "direct"))
        let openRoom: (String?) -> Void = { [weak self] roomId in
            guard let self = self else { return }
            if let roomId = roomId, !roomId.isEmpty {
                self.inquiryChatOpening = false
                self.webView.evaluateJavaScript("try{window.dispatchEvent(new Event('freetiful:match-requests-changed'))}catch(e){}", completionHandler: nil)
                self.navigateNativeWeb(to: "/chat/\(roomId)")
            } else {
                self.openChatViaWebBridge(id)   // 직접 경로 실패 → 웹 브리지 폴백
            }
        }
        guard !token.isEmpty else { openChatViaWebBridge(id); return }
        showNativeToast("채팅방을 여는 중…")
        if !customerId.isEmpty {
            // 1순위: 행에 customerId 있음 → 바로 방생성 (1콜)
            NativeHomeData.createRoomAsPro(customerUserId: customerId, matchRequestId: matchRequestId, token: token, openRoom)
        } else {
            // 오래된 캐시 행(customerId 없음) → 고속 직접 세션으로 재조회+해석 후 방생성
            // (느린 웹 폴백/getProRequests-콜드 경로 회피)
            NativeHomeData.openChatResolving(deliveryId: id, token: token, openRoom)
        }
    }
    // 폴백: 전역 웹 브리지(페이지 미마운트여도 동작) → 결과 기반 피드백
    private func openChatViaWebBridge(_ id: String) {
        inquiryChatOpening = true
        let js = """
        if (window.__freetifulInquiryOpenChat) { return await window.__freetifulInquiryOpenChat(\(jsLiteral(id))); }
        if (window.__freetifulInquiryList && window.__freetifulInquiryList.invokeChat) { window.__freetifulInquiryList.invokeChat(\(jsLiteral(id))); return 'page'; }
        return 'fail:준비 중입니다. 잠시 후 다시 시도해주세요.';
        """
        webView.callAsyncJavaScript(js, arguments: [:], in: nil, in: .page) { [weak self] result in
            guard let self = self else { return }
            self.inquiryChatOpening = false
            let r = ((try? result.get()) as? String) ?? "fail:채팅 연결에 실패했습니다."
            if r.hasPrefix("fail:") {
                self.showNativeToast(String(r.dropFirst(5)))
            }
            // 'ok'/'page' → 경로 변경이 채팅 상세 오버레이를 띄움(별도 피드백 불필요)
        }
    }
    func inquiryDidTapReject(_ id: String) {
        // 거절 사유 글래스 모달 → 작성 후 전송해야 거절
        let modal = NativeRejectModal()
        modal.onSubmit = { [weak self] message in
            guard let self = self else { return }
            self.webView.evaluateJavaScript("window.__freetifulInquiryList && window.__freetifulInquiryList.invokeReject && window.__freetifulInquiryList.invokeReject(\(self.jsLiteral(id)), \(self.jsLiteral(message)));", completionHandler: nil)
        }
        present(modal, animated: true)
    }
    func inquiryDidArchive(_ id: String) {
        webView.evaluateJavaScript("window.__freetifulInquiryList && window.__freetifulInquiryList.invokeArchive && window.__freetifulInquiryList.invokeArchive(\(jsLiteral(id)));", completionHandler: nil)
    }
    func inquiryDidPullRefresh() {
        // 웹 매칭요청 재조회 트리거 + 즉시 재전송(목록 갱신 → setRows 가 endRefresh 호출)
        webView.evaluateJavaScript("(function(){ try { window.dispatchEvent(new Event('freetiful:match-requests-changed')); if (window.__freetifulInquiryRowsPost) window.__freetifulInquiryRowsPost(); } catch(e){} })();", completionHandler: nil)
    }

    // MARK: - 채팅 본문(네이티브 메시지) (B3)
    private func requestNativeChatMessages() {
        webView.evaluateJavaScript("window.__freetifulChatMessagesPost && window.__freetifulChatMessagesPost();", completionHandler: nil)
    }

    private func handleNativeChatMessages(_ body: Any) {
        guard nativeNavigationEnabled, let arr = body as? [[String: Any]] else { return }
        NSLog("[ft.perf] chat messages arrived: %d", arr.count)
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
                quotationId: (d["quotationId"] as? String) ?? "",
                quoteEventName: (d["quoteEventName"] as? String) ?? "",
                quotePlanLabel: (d["quotePlanLabel"] as? String) ?? "",
                quoteProImage: (d["quoteProImage"] as? String) ?? "",
                quoteIsLatest: (d["quoteIsLatest"] as? Bool) ?? false
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

    func chatMessagesVideoTap(_ url: String) {
        let trimmed = url.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let full: String
        if trimmed.hasPrefix("http") || trimmed.hasPrefix("data:") { full = trimmed }
        else if trimmed.hasPrefix("/") { full = "\(kWebBase)\(trimmed)" }
        else { full = "\(kWebBase)/\(trimmed)" }
        guard let videoURL = URL(string: full) else { return }
        let vc = AVPlayerViewController()
        vc.player = AVPlayer(url: videoURL)
        present(vc, animated: true) { vc.player?.play() }
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
    func homeRequestBusiness() {
        webView.evaluateJavaScript("(window.__freetifulBusinessPost && window.__freetifulBusinessPost());", completionHandler: nil)
    }
    private func handleNativeHomeBusiness(_ body: Any) {
        guard let dict = body as? [String: Any] else { return }
        let arr = (dict["sections"] as? [[String: Any]]) ?? []
        let sections: [HomeBusinessSection] = arr.compactMap { s in
            guard let cat = s["category"] as? String else { return nil }
            let items = ((s["items"] as? [[String: Any]]) ?? []).compactMap { (d: [String: Any]) -> HomeBusiness? in
                guard let id = d["id"] as? String else { return nil }
                return HomeBusiness(id: id, name: (d["name"] as? String) ?? "", location: (d["location"] as? String) ?? "",
                                    image: (d["image"] as? String) ?? "", tags: (d["tags"] as? [String]) ?? [],
                                    isPopular: (d["isPopular"] as? Bool) ?? false)
            }
            return items.isEmpty ? nil : HomeBusinessSection(category: cat, items: items)
        }
        if !sections.isEmpty { nativeHomeContent.setBusinessSections(sections) }
    }

    func requestNotifications() {
        webView.evaluateJavaScript("(window.__freetifulNotifications && window.__freetifulNotifications.post && window.__freetifulNotifications.post());", completionHandler: nil)
    }
    private func handleNativeNotifications(_ body: Any) {
        guard let dict = body as? [String: Any] else { return }
        let arr = (dict["items"] as? [[String: Any]]) ?? []
        let items: [NativeNotification] = arr.compactMap { d in
            guard let id = d["id"] as? String else { return nil }
            return NativeNotification(id: id, title: (d["title"] as? String) ?? "", body: (d["body"] as? String) ?? "",
                                      date: (d["date"] as? String) ?? "", isRead: (d["isRead"] as? Bool) ?? false,
                                      url: (d["url"] as? String) ?? "")
        }
        nativeNotifications.setItems(items)
    }

    // MARK: - NativeNotificationsDelegate
    func notificationDidTap(_ id: String, url: String) {
        webView.evaluateJavaScript("(window.__freetifulNotifications && window.__freetifulNotifications.invokeRead && window.__freetifulNotifications.invokeRead(\(jsLiteral(id))));", completionHandler: nil)
        if !url.isEmpty, let norm = normalizedInternalPath(from: url) { navigateNativeWeb(to: norm) }
    }
    func notificationDidDelete(_ id: String) {
        webView.evaluateJavaScript("(window.__freetifulNotifications && window.__freetifulNotifications.invokeDelete && window.__freetifulNotifications.invokeDelete(\(jsLiteral(id))));", completionHandler: nil)
    }

    // MARK: - NativeSearchDelegate
    func searchDidTapPro(_ id: String) {
        nativeSearch.resignSearch()
        webView.evaluateJavaScript("(window.__freetifulNavigate && window.__freetifulNavigate('/pros/' + \(jsLiteral(id))));", completionHandler: nil)
    }
    func searchDidCancel() {
        if webView.canGoBack { webView.goBack() }
        else { webView.evaluateJavaScript("(window.__freetifulNavigate && window.__freetifulNavigate('/main'));", completionHandler: nil) }
    }

    // MARK: - NativeHelpDelegate
    func helpDidTapPolicy(_ slug: String) {
        navigateNativeWeb(to: "/my/terms/\(slug)")
    }

    // MARK: - NativeProDetailDelegate
    func proDetailInquiry(_ id: String) {
        // 입력 폼: 로그인=행사일·부·장소 / 비로그인=+이름·전화(자동 회원화+로그인 유지)
        let stateJS = "(function(){try{var st=window.__freetifulProInquiryState?window.__freetifulProInquiryState():null;return JSON.stringify(st||{});}catch(e){return '{}'}})()"
        webView.evaluateJavaScript(stateJS) { [weak self] result, _ in
            guard let self = self else { return }
            var loggedIn = false
            var proName = ""
            if let str = result as? String, let data = str.data(using: .utf8),
               let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
                loggedIn = (obj["loggedIn"] as? Bool) ?? false
                proName = (obj["proName"] as? String) ?? ""
            }
            let form = NativeProInquiryFormViewController(loggedIn: loggedIn, proName: proName)
            form.onSubmit = { [weak self] payload in self?.sendProInquiry(payload) }
            self.present(form, animated: false)
        }
    }
    private func sendProInquiry(_ payload: [String: String]) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        let js = """
        if (window.__freetifulProInquirySubmit) { return await window.__freetifulProInquirySubmit(\(json)); }
        if (window.__freetifulProInquirySendAsync) { return await window.__freetifulProInquirySendAsync(); }
        return 'fail:페이지 준비 중입니다. 잠시 후 다시 시도해주세요.';
        """
        webView.callAsyncJavaScript(js, arguments: [:], in: nil, in: .page) { [weak self] result in
            guard let self = self else { return }
            let r = ((try? result.get()) as? String) ?? "fail:오류가 발생했습니다."
            if r == "ok" || r == "ok:signed" {
                self.showNativeToast(r == "ok:signed"
                    ? "문의를 보냈어요! 가입까지 완료됐어요 🎉"
                    : "문의를 보냈어요! 문의목록에서 확인할 수 있어요")
                self.requestCustomerInquiries()                  // 고객 문의목록 즉시 갱신
                self.syncAuthToken()                              // 자동 로그인 토큰 영속(계속 로그인 유지)
                self.refreshNativeNavState()                      // 로그인 상태 UI 반영
            } else {
                let msg = r.hasPrefix("fail:") ? String(r.dropFirst(5)) : "문의 전송에 실패했습니다."
                self.showNativeToast(msg)
            }
        }
    }
    func proDetailOpen(_ id: String) {
        // 추천 사회자 탭 → 웹 라우트 이동(경로 옵저버가 네이티브 상세 재로딩)
        guard !id.isEmpty else { return }
        webView.evaluateJavaScript("(window.__freetifulNavigate && window.__freetifulNavigate('/pros/' + \(jsLiteral(id))));", completionHandler: nil)
    }
    func proDetailOpenReviews(_ id: String) {
        // 리뷰 전체보기 → /pros/:id/reviews (경로 옵저버가 네이티브 리뷰 리스트 표출)
        guard !id.isEmpty else { return }
        webView.evaluateJavaScript("(window.__freetifulNavigate && window.__freetifulNavigate('/pros/' + \(jsLiteral(id)) + '/reviews'));", completionHandler: nil)
    }

    // MARK: - NativeCustomerInquiriesDelegate
    func customerInquiryDidTap(_ link: String, hasRoom: Bool) {
        if hasRoom, !link.isEmpty, let norm = normalizedInternalPath(from: link) { navigateNativeWeb(to: norm) }
        else { showNativeToast("사회자가 문의를 승인하면 채팅방이 열립니다") }
    }
    func customerInquiryDidArchive(_ id: String) {
        webView.evaluateJavaScript("(window.__freetifulInquiries && window.__freetifulInquiries.invokeArchive && window.__freetifulInquiries.invokeArchive(\(jsLiteral(id))));", completionHandler: nil)
    }
    func customerInquiryDidUnarchive(_ id: String) {
        webView.evaluateJavaScript("(window.__freetifulInquiries && window.__freetifulInquiries.invokeUnarchive && window.__freetifulInquiries.invokeUnarchive(\(jsLiteral(id))));", completionHandler: nil)
    }
    func requestCustomerInquiries() {
        webView.evaluateJavaScript("(window.__freetifulInquiries && window.__freetifulInquiries.post && window.__freetifulInquiries.post());", completionHandler: nil)
    }
    private func handleNativeCustomerInquiries(_ body: Any) {
        guard let dict = body as? [String: Any] else { return }
        applyCustomerInquiries(dict, cache: true)
    }
    private func applyCustomerInquiries(_ dict: [String: Any], cache: Bool) {
        func parse(_ key: String) -> [NativeInquiryCard] {
            let arr = (dict[key] as? [[String: Any]]) ?? []
            return arr.compactMap { d in
                guard let id = d["id"] as? String else { return nil }
                return NativeInquiryCard(id: id, proName: (d["proName"] as? String) ?? "사회자",
                                         proImage: (d["proImage"] as? String) ?? "", status: (d["status"] as? String) ?? "요청중",
                                         category: (d["category"] as? String) ?? "", date: (d["date"] as? String) ?? "",
                                         location: (d["location"] as? String) ?? "", link: (d["link"] as? String) ?? "",
                                         hasRoom: (d["hasRoom"] as? Bool) ?? false)
            }
        }
        let active = parse("active"); let archived = parse("archived")
        nativeCustomerInquiries.setData(active: active, archived: archived)
        // 디스크 캐시 (다음 진입 즉시 표시) — 둘 다 비면 캐시 유지
        if cache, (!active.isEmpty || !archived.isEmpty), let data = try? JSONSerialization.data(withJSONObject: dict) {
            UserDefaults.standard.set(data, forKey: "ftCustomerInquiries")
        }
    }
    private func loadCachedCustomerInquiries() {
        guard let data = UserDefaults.standard.data(forKey: "ftCustomerInquiries"),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        applyCustomerInquiries(dict, cache: false)
    }

    // 결혼식 사회자 찾기 폼 제출 → 다이나믹 아일랜드 "사회자 찾는 중" 라이브 액티비티
    private func handleNativeMCSearch(_ body: Any) {
        let dict = body as? [String: Any]
        let action = (dict?["action"] as? String) ?? "start"
        if action == "end" { MCSearchActivity.endAll(); return }
        MCSearchActivity.start(category: (dict?["category"] as? String) ?? "결혼식 사회자")
    }

    private func showNativeToast(_ text: String) {
        let label = PaddingLabel2()
        label.text = text
        label.textInsets = UIEdgeInsets(top: 10, left: 16, bottom: 10, right: 16)
        label.font = .systemFont(ofSize: 14, weight: .medium)
        label.textColor = .white
        label.backgroundColor = UIColor.black.withAlphaComponent(0.82)
        label.numberOfLines = 0
        label.textAlignment = .center
        label.layer.cornerRadius = 18
        label.clipsToBounds = true
        label.alpha = 0
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -90),
            label.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 40),
            label.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -40),
        ])
        UIView.animate(withDuration: 0.25, animations: { label.alpha = 1 }) { _ in
            UIView.animate(withDuration: 0.3, delay: 1.8, options: [], animations: { label.alpha = 0 }) { _ in label.removeFromSuperview() }
        }
    }
    func homeOpenPath(_ path: String) {
        webView.evaluateJavaScript("(window.__freetifulNavigate && window.__freetifulNavigate(\(jsLiteral(path))));", completionHandler: nil)
    }
    // MARK: - NativeCategoryListDelegate
    func categoryListDidSelect(path: String) {
        guard !path.isEmpty else { return }
        webView.evaluateJavaScript("(window.__freetifulNavigate && window.__freetifulNavigate(\(jsLiteral(path))));", completionHandler: nil)
    }
    // 쿼리스트링에서 파라미터 추출 (예: "?category=결혼식사회자" 또는 "category=...")
    private func queryParam(_ name: String, from rawQuery: String) -> String {
        let q = rawQuery.hasPrefix("?") ? String(rawQuery.dropFirst()) : rawQuery
        for pair in q.split(separator: "&") {
            let kv = pair.split(separator: "=", maxSplits: 1).map(String.init)
            if kv.first == name, kv.count > 1 {
                return kv[1].removingPercentEncoding ?? kv[1]
            }
        }
        return ""
    }
    func homeOpenBusiness(_ id: String) {
        webView.evaluateJavaScript("(window.__freetifulNavigate && window.__freetifulNavigate('/businesses/' + \(jsLiteral(id))));", completionHandler: nil)
    }
    func homeRequestSections() {
        webView.evaluateJavaScript("(window.__freetifulHomeSectionsPost && window.__freetifulHomeSectionsPost());", completionHandler: nil)
    }

    // MARK: - NativeMyContentDelegate
    func myOpenPath(_ path: String) {
        webView.evaluateJavaScript("(window.__freetifulNavigate && window.__freetifulNavigate(\(jsLiteral(path))));", completionHandler: nil)
    }
    func myTapProfileCard() {
        // 사회자: 본인 상세 보기(비공개여도 확인 가능), 일반: 프로필 설정
        webView.evaluateJavaScript("(function(){try{return localStorage.getItem('freetiful-my-pro-id')||'';}catch(e){return ''}})()") { [weak self] result, _ in
            guard let self = self else { return }
            let pid = (result as? String) ?? ""
            if self.currentNativeActualIsPro, !pid.isEmpty {
                self.navigateNativeWeb(to: "/pros/\(pid)")
            } else {
                self.navigateNativeWeb(to: "/my/settings")
            }
        }
    }

    func myLogout() {
        // 낙관적 로그아웃 — 네이티브 마이는 즉시 로그아웃 상태로, 웹 정리는 백그라운드
        socialLogout()   // OneSignal 로그아웃 + 개인 캐시/토큰 삭제
        nativeMyContent.setProfile(MyProfile(loggedIn: false, name: "", email: "", image: "", proPending: false))
        // 웹: /my 미마운트여도 동작하는 폴백 포함(스토어/스토리지 정리 + 홈 이동)
        let js = """
        (function(){
          if (window.__freetifulLogout) { window.__freetifulLogout(); return; }
          try { localStorage.removeItem('prettyful-auth'); localStorage.removeItem('userRole'); localStorage.removeItem('viewAsUser'); localStorage.removeItem('freetiful-my-pro-id'); } catch(e) {}
          try { window.location.replace('/main'); } catch(e) {}
        })();
        """
        webView.evaluateJavaScript(js, completionHandler: nil)
    }
    func myShowLogin() {
        webView.evaluateJavaScript("window.dispatchEvent(new Event('freetiful:show-login'));", completionHandler: nil)
    }
    private func requestMyProfile() {
        webView.evaluateJavaScript("(window.__freetifulMyProfilePost && window.__freetifulMyProfilePost());", completionHandler: nil)
    }
    private func handleNativeMyProfile(_ body: Any) {
        guard let d = body as? [String: Any] else { return }
        let p = MyProfile(loggedIn: (d["loggedIn"] as? Bool) ?? false,
                          name: (d["name"] as? String) ?? "",
                          email: (d["email"] as? String) ?? "",
                          image: (d["image"] as? String) ?? "",
                          proPending: (d["proPending"] as? Bool) ?? false)
        nativeMyContent.setProfile(p)
    }

    // MARK: - NativeBackHeaderDelegate
    func backHeaderTapBack() {
        // raw webView.goBack() 은 SPA 히스토리 오염(예: 사회자 상세 뒤로 → 엉뚱하게 비즈)로 이어짐.
        // 경로 기반 논리적 뒤로가기로 교체.
        let p = currentNativePath.split(separator: "?").first.map(String.init) ?? currentNativePath
        // 사회자 리뷰 전체 → 사회자 상세
        if p.range(of: "^/pros/[^/]+/reviews$", options: .regularExpression) != nil {
            let id = String(p.dropFirst("/pros/".count).dropLast("/reviews".count))
            navigateNativeWeb(to: "/pros/\(id)", replace: true)
            return
        }
        // 상세(사회자/업체/마이 하위) → 직전 브라우즈 화면(리스트/홈)
        if isDetailPath(p) {
            navigateNativeWeb(to: lastBrowsePath, replace: true)
            return
        }
        // 문의목록/알림/검색 등 네이티브 자체헤더 화면 + 최상위 탭: raw goBack 은 오염된 SPA 히스토리
        // (예: 문의내역 '<' → 엉뚱하게 비즈)로 가므로 항상 홈으로. (최상위 탭 스와이프백 동작과 일치)
        if isTopLevelTab(p) || p == "/notifications" || p == "/search" {
            navigateNativeWeb(to: "/main", replace: true)
            return
        }
        // 그 외 — 기존 동작 유지
        if webView.canGoBack {
            webView.goBack()
        } else {
            webView.evaluateJavaScript("(window.__freetifulNavigate && window.__freetifulNavigate('/main'));", completionHandler: nil)
        }
    }
    func backHeaderTapShare() {
        // 현재 상세 페이지 URL 공유 (네이티브 공유 시트)
        let urlStr = (webView.url?.absoluteString) ?? (currentProDetailId.isEmpty ? "https://freetiful.com" : "https://freetiful.com/pros/\(currentProDetailId)")
        guard let url = URL(string: urlStr) else { return }
        let av = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        av.popoverPresentationController?.sourceView = nativeBackHeader
        av.popoverPresentationController?.sourceRect = CGRect(x: nativeBackHeader.bounds.maxX - 40, y: nativeBackHeader.bounds.maxY - 20, width: 1, height: 1)
        present(av, animated: true)
    }

    // 상세화면(뒤로가기 헤더 적용 대상) 경로 판별 — 점진 확장
    private func isDetailPath(_ rawPath: String) -> Bool {
        let p = rawPath.split(separator: "?").first.map(String.init) ?? rawPath
        // 네이티브 전용 화면(이미 자체 헤더)은 제외
        if p == "/notifications" || p == "/search" || p == "/inquiries" { return false }
        let patterns = ["^/pros/[^/]+", "^/businesses/[^/]+", "^/my/.+"]
        for pat in patterns where p.range(of: pat, options: .regularExpression) != nil { return true }
        return false
    }
    private func cleanDetailTitle(_ raw: String) -> String {
        var t = raw
        for suffix in [" | 프리티풀", " - 프리티풀", " | Freetiful", " - Freetiful"] {
            if t.hasSuffix(suffix) { t = String(t.dropLast(suffix.count)) }
        }
        t = t.trimmingCharacters(in: .whitespacesAndNewlines)
        // 브랜드명이 포함된 일반 타이틀은 헤더에 표시하지 않음
        if t.range(of: "freetiful", options: .caseInsensitive) != nil || t.contains("프리티풀") { return "" }
        return t
    }

    private func handleNativeHomeRows(_ body: Any) {
        // 카테고리 리스트(결혼식/행사/외국어)는 NativeHomeData(직접 fetch — 전체 27명 + 경력)가 단일 소스.
        // 웹 브리지는 slice(0,12) + 경력없음이라 덮어쓰면 12명·확인중이 됨 → 무시.
    }

    func homeOpenBanner(_ link: String) {
        guard !link.isEmpty else { return }
        if link.hasPrefix("http"), let url = URL(string: link) {
            UIApplication.shared.open(url)
        } else {
            webView.evaluateJavaScript("(window.__freetifulNavigate && window.__freetifulNavigate(\(jsLiteral(link))));", completionHandler: nil)
        }
    }

    private func handleNativeHomeBanners(_ body: Any) {
        guard nativeNavigationEnabled, let dict = body as? [String: Any] else { return }
        let arr = (dict["items"] as? [[String: Any]]) ?? []
        let items: [HomeBanner] = arr.compactMap { d in
            guard let image = d["image"] as? String, !image.isEmpty else { return nil }
            return HomeBanner(image: image, link: (d["link"] as? String) ?? "")
        }
        nativeHomeContent.setBanners(items)
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
        if id == "location" {
            requestNativeLocationForChat()
            return
        }
        // ChatExtras(lazy) 미마운트 레이스 — 브리지 없으면 0.6s 후 1회 재시도
        let js = "(function(){ if (window.__freetifulChatActions) { window.__freetifulChatActions.invokeAttach(\(jsLiteral(id))); return true; } return false; })();"
        webView.evaluateJavaScript(js) { [weak self] ok, _ in
            if (ok as? Bool) != true {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                    self?.webView.evaluateJavaScript(js, completionHandler: nil)
                }
            }
        }
    }

    // 위치 공유 — 네이티브 CLLocationManager 로 현재 위치 → 웹 sendLocation 브리지
    private func requestNativeLocationForChat() {
        let status = chatLocationManager.authorizationStatus
        if status == .denied || status == .restricted {
            showNativeToast("설정 > 프리티풀에서 위치 접근을 허용해주세요")
            return
        }
        pendingLocationSend = true
        chatLocationManager.delegate = self
        if status == .notDetermined { chatLocationManager.requestWhenInUseAuthorization() }
        else { chatLocationManager.requestLocation() }
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
        // 네이티브 처리 항목 — 웹 오버레이가 가려져 보이지 않는 액션들
        if id == "search" {
            let alert = UIAlertController(title: "대화 내용 검색", message: nil, preferredStyle: .alert)
            alert.addTextField { tf in tf.placeholder = "검색어"; tf.returnKeyType = .search }
            alert.addAction(UIAlertAction(title: "취소", style: .cancel))
            alert.addAction(UIAlertAction(title: "검색", style: .default) { [weak self, weak alert] _ in
                guard let self = self else { return }
                let q = alert?.textFields?.first?.text ?? ""
                let count = self.nativeChatMessages.searchScroll(q)
                self.showNativeToast(count > 0 ? "\(count)개의 메시지를 찾았습니다" : "검색 결과가 없습니다")
            })
            present(alert, animated: true)
            return
        }
        if id == "mute" {
            let willMute = !nativeChatState.muted
            webView.evaluateJavaScript("window.__freetifulChatActions && window.__freetifulChatActions.invokeMenu('mute');", completionHandler: nil)
            showNativeToast(willMute ? "이 채팅의 알림을 껐습니다" : "이 채팅의 알림을 켰습니다")
            return
        }
        if id == "profile", nativeChatState.isPro {
            // 사회자 → 고객 견적 정보를 네이티브 모달로 표시. 탭마다 최신 roomMeta 로 새로 패치
            // (초기 캐시는 roomMeta 미로드 상태라 날짜/장소가 미정으로 비어있을 수 있음).
            fetchCustomerRequestInfo { [weak self] info in
                guard let self = self else { return }
                if let info = info {
                    self.nativeCustomerRequestInfo = info
                    self.present(NativeCustomerRequestModal(info: info), animated: true)
                } else if let cached = self.nativeCustomerRequestInfo {
                    self.present(NativeCustomerRequestModal(info: cached), animated: true)
                } else {
                    self.showNativeToast("고객 요청 정보를 불러오지 못했습니다")
                }
            }
            return
        }
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

    // replace=true: 히스토리에 안 쌓음 — 하단 탭 전환용(뒤로가기가 탭 이력으로 랜덤 이동하던 버그 방지)
    private func navigateNativeWeb(to path: String, replace: Bool = false) {
        currentNativePath = path
        renderNativeNavigation(animated: true)

        let pathLiteral = jsLiteral(path)
        let urlLiteral = jsLiteral("\(kWebBase)\(path)")
        let replaceLiteral = replace ? "true" : "false"
        let script = """
        (function() {
          var path = \(pathLiteral);
          var url = \(urlLiteral);
          var rep = \(replaceLiteral);
          if (window.__freetifulNavigate) { window.__freetifulNavigate(path, rep); return; }
          var link = document.querySelector('a[href="' + path + '"]');
          if (link && !rep) { link.click(); return; }
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

    func liquidGlassNavigationBar(_ navBar: LiquidGlassNavigationBar, didSelect item: LiquidNavItem) {
        guard item.path != currentNativePath else { return }   // 같은 탭 재탭 — 히스토리 오염 방지
        navigateNativeWeb(to: item.path, replace: true)        // 탭 전환은 히스토리에 안 쌓음
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

    private var didCheckLaunchPopup = false
    private func loadInitialPage() {
        // 홈 진입 팝업(배너 placement=popup) — 런치 1회, 홈 보인 뒤 약간 지연 후 네이티브 바텀시트
        if !didCheckLaunchPopup {
            didCheckLaunchPopup = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
                guard let self = self else { return }
                NativePopupModalViewController.checkAndPresent(from: self) { [weak self] link in
                    self?.navigateNativeWeb(to: link)
                }
            }
        }
        // 새요청+채팅 프리워밍 — 저장된 토큰으로 앱 시작 즉시 직접 fetch(디스크 캐시 갱신 → 진입 시 0초 표시)
        // 채팅 rooms 는 서버 콜드 응답이 5~10s 걸릴 수 있어 시작 시 미리 때려 서버 캐시도 데움
        if !nativeAuthToken.isEmpty {
            NativeHomeData.loadProInquiries(token: nativeAuthToken) { rows in
                guard let rows = rows, !rows.isEmpty, let data = try? JSONSerialization.data(withJSONObject: rows) else { return }
                UserDefaults.standard.set(data, forKey: "ftInquiryRows")
            }
            NativeHomeData.loadChatRooms(token: nativeAuthToken) { rows in
                guard let rows = rows, !rows.isEmpty, let data = try? JSONSerialization.data(withJSONObject: rows) else { return }
                UserDefaults.standard.set(data, forKey: "ftChatRows")
            }
        }
        // 토큰 동기화 — 첫 실행이면 확보되는 즉시 프리워밍(채팅+새요청)까지 수행
        let hadToken = !nativeAuthToken.isEmpty
        for delay in [3.0, 8.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.syncAuthToken { [weak self] in
                    guard let self = self, !hadToken, !self.nativeAuthToken.isEmpty else { return }
                    NativeHomeData.loadProInquiries(token: self.nativeAuthToken) { rows in
                        guard let rows = rows, !rows.isEmpty, let data = try? JSONSerialization.data(withJSONObject: rows) else { return }
                        UserDefaults.standard.set(data, forKey: "ftInquiryRows")
                    }
                    NativeHomeData.loadChatRooms(token: self.nativeAuthToken) { rows in
                        guard let rows = rows, !rows.isEmpty, let data = try? JSONSerialization.data(withJSONObject: rows) else { return }
                        UserDefaults.standard.set(data, forKey: "ftChatRows")
                    }
                }
            }
        }
        if let deepLink = OneSignalManager.shared.consumePendingDeepLink(),
           let path = normalizedInternalPath(from: deepLink) {
            loadInternalPath(path)
            return
        }
        loadHome()
    }

    private func loadHome() {
        // 캐시 무시 로드 — WKWebView 가 옛 JS 번들을 붙잡고 있어 배포한 수정이 앱에 반영 안 되던 문제 방지
        var homeReq = URLRequest(url: URL(string: "\(kWebBase)/")!)
        homeReq.cachePolicy = .reloadIgnoringLocalCacheData
        webView.load(homeReq)
        // 스플래시를 웹 셸 로딩과 무관하게 조기 해제 + 네이티브 홈 표출 (기본 홈 랜딩)
        // → 콜드스타트여도 네이티브 홈(디스크 캐시/로딩표시)이 바로 보임
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in self?.revealNativeHomeEarly() }
    }

    private func revealNativeHomeEarly() {
        guard !didRevealHomeEarly else { return }
        // 딥링크 등 홈이 아닌 경로로 진입 중이면 건너뜀
        guard currentNativePath == "/" || currentNativePath == "/main" else { return }
        didRevealHomeEarly = true
        dismissSplash()
        updateNativeChatVisibility()   // onHome 분기 → 네이티브 홈/헤더/네비 표출
    }

    private func dismissSplash() {
        guard let lav = logoAnimationView, lav.superview != nil else { return }
        UIView.animate(withDuration: 0.25) { lav.alpha = 0 } completion: { _ in lav.removeFromSuperview() }
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
        dismissSplash()   // 이미 조기 해제됐으면 no-op
        webView.isHidden = false
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
        case "nativeHomeBanners": handleNativeHomeBanners(message.body)
        case "nativeMyProfile": handleNativeMyProfile(message.body)
        case "nativeHomeBusiness": handleNativeHomeBusiness(message.body)
        case "nativeNotifications": handleNativeNotifications(message.body)
        case "nativeCustomerInquiries": handleNativeCustomerInquiries(message.body)
        case "nativeMCSearch": handleNativeMCSearch(message.body)
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
        host.modalPresentationStyle = .overFullScreen   // 앱 위 글래스 바텀시트
        host.view.backgroundColor = .clear
        DispatchQueue.main.async { [weak self] in
            // 슬라이드업/딤 페이드는 NativeLoginView 내부에서 처리 → 표준 전환 끔
            self?.present(host, animated: false)
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
            // 직접 fetch 토큰 즉시 저장 + 네이티브 마이 낙관 반영(웹 리로드 기다리지 않음)
            UserDefaults.standard.set(accessToken, forKey: "ftAccessToken")
            if let udata = userJSON.data(using: .utf8),
               let u = (try? JSONSerialization.jsonObject(with: udata)) as? [String: Any] {
                self.nativeMyContent.setProfile(MyProfile(
                    loggedIn: true,
                    name: (u["name"] as? String) ?? "",
                    email: (u["email"] as? String) ?? "",
                    image: (u["profileImageUrl"] as? String) ?? "",
                    proPending: false
                ))
            }
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
        UserDefaults.standard.removeObject(forKey: "ftInquiryRows")   // 개인 새요청 캐시 삭제
        UserDefaults.standard.removeObject(forKey: "ftChatRows")      // 개인 채팅 캐시 삭제
        UserDefaults.standard.removeObject(forKey: "ftAccessToken")   // 직접 fetch 토큰 삭제
    }

    // MARK: - API 호출 + JWT 주입
    // 프리티풀 API를 호출하고, 응답받은 JWT를 웹앱의 Zustand localStorage에 주입합니다.
    private func callAPI(endpoint: String, body: [String: Any]) {
        guard let url = URL(string: "\(kAPIBase)\(endpoint)") else { return }
        // (아래 request 에 15s 타임아웃 적용 — 기본 60s 가 로그인 1분 무응답의 원인)
        print("🌐 [CurrentAuth] API request:", url.absoluteString)
        var request = URLRequest(url: url)
        request.timeoutInterval = 15
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
            UserDefaults.standard.set(accessToken, forKey: "ftAccessToken")   // 직접 fetch 용 즉시 저장
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

// MARK: - 엣지 스와이프 뒤로가기 (네이티브 오버레이에서만 내 제스처 — 웹 페이지는 WKWebView 슬라이드에 위임)
// 채팅 위치 공유 — 현재 위치 1회 취득 → 웹 sendLocation 브리지
extension ViewController: CLLocationManagerDelegate {
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard pendingLocationSend else { return }
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            manager.requestLocation()
        case .denied, .restricted:
            pendingLocationSend = false
            showNativeToast("설정 > 프리티풀에서 위치 접근을 허용해주세요")
        default: break
        }
    }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard pendingLocationSend, let loc = locations.first else { return }
        pendingLocationSend = false
        let js = "window.__freetifulChatActions && window.__freetifulChatActions.sendLocation && window.__freetifulChatActions.sendLocation(\(loc.coordinate.latitude), \(loc.coordinate.longitude));"
        webView.evaluateJavaScript(js, completionHandler: nil)
        showNativeToast("내 위치를 전송했습니다")
    }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard pendingLocationSend else { return }
        pendingLocationSend = false
        showNativeToast("위치를 가져오지 못했습니다")
    }
}

extension ViewController: UIGestureRecognizerDelegate {
    func gestureRecognizerShouldBegin(_ g: UIGestureRecognizer) -> Bool {
        if g is UIScreenEdgePanGestureRecognizer {
            return nativeNavigationEnabled && backSwipeOverlayActive()
        }
        return true
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
