import UIKit
import AVFoundation

/// 빌라드지디 첫 진입 랜딩 — 앱 최초 1회 전체화면으로 표시(글래스 X 로 닫기).
/// 웹 오버레이(VilladegdEventOverlay.tsx)의 네이티브 버전.
/// 웹 모달은 네이티브 홈 오버레이에 가려지고 hasBlockingOverlay 로 하단 네비를 숨기는 부작용이
/// 있어 웹에선 억제하고(=iOS 가드), 대신 이 화면을 네이티브로 띄운다.
final class NativeVilladegdLandingViewController: UIViewController, UIScrollViewDelegate {

    private static let blob = "https://jnhwlzeyberhyv7s.public.blob.vercel-storage.com/villadegd"
    private static let heroVideo = URL(string: "\(blob)/villadegd-hero.mp4")!
    private static let logoURL = "\(blob)/villadegd-logo-white.png"
    // '앱 초기 진입 화면'이라 앱을 새로 켤 때마다 노출한다(X 는 그 실행에서만 닫기).
    // 영구 저장(UserDefaults)으로 한 번 닫으면 다시 안 뜨던 동작을 제거.
    // 노출 빈도를 제한하려면 여기서 마지막 노출 시각을 기준으로 가드하면 된다.

    /// 닫힌 뒤 '웨딩홀 둘러보기' 로 이동시킬 때 호출
    var onOpenWeddingHalls: (() -> Void)?

    private struct Branch {
        let slug: String
        let name: String
        let en: String
        let hall: String?
        let address: String
        let phone: String
        let intro: String
        let video: String
        let imageCount: Int
    }

    private static let branches: [Branch] = [
        .init(slug: "villadegd-cheongdam", name: "청담", en: "CHUNGDAM", hall: nil,
              address: "서울 강남구 학동로 519", phone: "02-542-7513",
              intro: "청담동, 도심 속 프리미엄 하우스 웨딩. 감각적인 공간에서 품격 있는 하루를 완성합니다.",
              video: "\(blob)/villadegd-hero.mp4", imageCount: 23),
        .init(slug: "villadegd-suseo", name: "수서", en: "SUSEO", hall: "르씨엘홀",
              address: "서울 강남구 밤고개로21길 79", phone: "02-543-2555",
              intro: "자연광 가득한 르씨엘홀. 빛으로 물드는 로맨틱한 분위기 속에서 특별한 예식을 담습니다.",
              video: "\(blob)/villadegd-suseo.mp4", imageCount: 20),
        .init(slug: "villadegd-anyang", name: "안양", en: "ANYANG", hall: "갤러리아홀",
              address: "경기 안양시 동안구 관악대로 254", phone: "031-382-3838",
              intro: "빛과 컨셉이 어우러진 갤러리아홀. 미디어아트로 완성하는 가장 감각적인 웨딩.",
              video: "\(blob)/villadegd-anyang.mp4", imageCount: 29),
        .init(slug: "villadegd-ansan", name: "안산", en: "ANSAN", hall: "그레이스켈리홀",
              address: "경기 안산시 단원구 광덕4로 140", phone: "031-487-8100",
              intro: "스페셜 플라워 브랜딩이 빛나는 그레이스켈리홀. 우아함이 흐르는 프리미엄 예식.",
              video: "\(blob)/villadegd-ansan.mp4", imageCount: 27),
        .init(slug: "villadegd-nonhyeon", name: "논현", en: "NONHYEON", hall: nil,
              address: "서울 강남구 언주로126길 23", phone: "02-547-3381",
              intro: "2024 리뉴얼로 새롭게 태어난 논현. 세련된 도심형 웨딩홀에서의 완벽한 하루.",
              video: "\(blob)/villadegd-nonhyeon.mp4", imageCount: 19),
    ]

    private static let strengths: [(String, String)] = [
        ("전국 5개 지점", "청담 · 수서 · 안양 · 안산 · 논현, 가까운 곳에서 편하게"),
        ("미디어아트 웨딩", "빛과 영상으로 완성하는 단 하나뿐인 예식"),
        ("커스터마이징 하우스 웨딩", "신랑신부의 스토리를 공간과 연출로 담아내요"),
        ("프리미엄 플라워 브랜딩", "감각적인 홀과 스페셜 플라워로 품격을 더해요"),
    ]

    /// 히어로 아래 무한 캐러셀에 흐를 지점 워드마크(흰색 PNG)
    private static let branchLogos = ["cheongdam", "suseo", "anyang", "ansan", "nonhyeon"]
        .map { "\(blob)/villadegd-logo-\($0).png" }

    private let scrollView = UIScrollView()
    private let content = UIStackView()
    private let closeButton = UIButton(type: .system)
    /// 영상 슬롯 — 화면에 들어올 때 플레이어를 만들고(지연 생성), 벗어나면 멈춘다.
    /// 미리 다 만들면 AVPlayerItem 7개가 동시에 네트워크를 물어 첫 재생이 매우 늦어진다.
    private final class VideoSlot {
        let url: URL
        let host: UIView
        var player: AVQueuePlayer?
        var layer: AVPlayerLayer?
        var looper: Any?
        var poster: UIImageView?        // 버퍼링 동안 보여줄 정지 이미지
        var readyObs: NSKeyValueObservation?
        init(url: URL, host: UIView) { self.url = url; self.host = host }
    }
    private var videoSlots: [VideoSlot] = []
    private let marqueeTrack = UIStackView()
    private var marqueeStarted = false
    /// 상단 그라데이션 블러(아래로 갈수록 사라지는 프로그레시브 블러)
    private let headerBlur = UIVisualEffectView(effect: UIBlurEffect(style: .systemUltraThinMaterialDark))
    private let headerMask = CAGradientLayer()
    private var headerBlurHeight: NSLayoutConstraint?

    /// 스크롤에 따라 흐르는 배경 그라데이션.
    /// 색은 지점 사진들의 실제 톤을 분석해 뽑았다(전체 평균 #727263 — 웜 그레이지/샌드,
    /// 안양만 다크 블루그레이 #344349). 그 톤을 아주 밝게 눌러 '은은하게' 흐르도록 한다.
    private let toneGradient = CAGradientLayer()
    /// 각 구간 3스톱(위→중간→아래). 분석 톤을 '보일 만큼'만 남기고 밝게 눌렀다.
    /// (이전엔 0.90~0.98 로 너무 하얘서 변화가 육안으로 보이지 않았다)
    private static func rgb(_ hex: UInt32) -> UIColor {
        UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
                blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    }
    private static let tonePalette: [[UIColor]] = [
        // 청담 — 아이보리 → 웜 토프 (#807c69 계열)
        [rgb(0xFBF8F2), rgb(0xF0E9DC), rgb(0xDFD6C4)],
        // 수서 — 라이트 올리브 샌드 (#909078)
        [rgb(0xF7F6EE), rgb(0xE9E7D6), rgb(0xD6D4BE)],
        // 안양 — 쿨 블루그레이 (#344349 를 밝게)
        [rgb(0xF2F5F8), rgb(0xE0E6ED), rgb(0xCBD5E0)],
        // 안산 — 브론즈 웜 (#68604e)
        [rgb(0xFAF5EC), rgb(0xEFE3D0), rgb(0xDCCBB0)],
        // 논현 → 다시 아이보리로 (끝과 처음이 이어지게)
        [rgb(0xF9F7F1), rgb(0xEDEADF), rgb(0xDCD8C9)],
    ]

    // MARK: - 표시 조건

    /// 앱을 새로 켤 때마다 노출(영구 dismiss 없음). loadInitialPage 가 콜드 스타트에서만 호출된다.
    static func shouldPresent() -> Bool { true }

    static func presentIfNeeded(from presenter: UIViewController, openWeddingHalls: @escaping () -> Void) {
        let blocked = presenter.presentedViewController != nil
        NSLog("[VilladegdLanding] present 시도 — 다른모달=\(blocked)")
        guard !blocked else { return }
        let vc = NativeVilladegdLandingViewController()
        vc.onOpenWeddingHalls = openWeddingHalls
        vc.modalPresentationStyle = .fullScreen
        presenter.present(vc, animated: true)
    }

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white
        // 배경 그라데이션 — 흰 배경 대신 깔아두고 스크롤에 따라 톤이 흐르게 한다.
        // (히어로·클로징은 자체 검정 배경이 있어 덮이고, 중간 섹션들은 배경이 없어 이게 비친다)
        toneGradient.colors = Self.tonePalette[0].map { $0.cgColor }
        toneGradient.locations = [0, 0.5, 1]
        toneGradient.startPoint = CGPoint(x: 0.5, y: 0)
        toneGradient.endPoint = CGPoint(x: 0.5, y: 1)
        view.layer.insertSublayer(toneGradient, at: 0)
        buildScroll()
        buildHero()
        buildStrengths()
        Self.branches.forEach { buildBranch($0) }
        buildClosing()
        buildHeaderBlur()     // X 버튼보다 먼저 — 블러가 아래, X 가 위
        buildCloseButton()

        // 백그라운드 복귀 시 CA 애니메이션/영상이 멈춘 채로 남지 않게 재개
        NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
        ) { [weak self] _ in
            guard let self = self, self.view.window != nil else { return }
            self.updateVisibleVideos()
            self.startMarquee()
        }
    }

    deinit { NotificationCenter.default.removeObserver(self) }

    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        updateVisibleVideos()
        updateToneGradient()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        videoSlots.forEach { $0.layer?.frame = $0.host.bounds }
        toneGradient.frame = view.bounds
        headerBlurHeight?.constant = view.safeAreaInsets.top + 52
        headerMask.frame = headerBlur.bounds
    }

    /// 스크롤 진행도에 따라 팔레트를 부드럽게 섞고, 방향도 함께 흐르게 한다.
    /// 색을 매 프레임 갈아끼우되 암시적 애니메이션을 끊어 스크롤이 끈적이지 않게 한다.
    private func updateToneGradient() {
        let span = max(1, scrollView.contentSize.height - scrollView.bounds.height)
        let p = min(1, max(0, scrollView.contentOffset.y / span))

        // 팔레트 구간 사이 선형 보간
        let steps = Self.tonePalette.count - 1
        let pos = p * CGFloat(steps)
        let i = min(steps - 1, max(0, Int(pos)))
        let t = pos - CGFloat(i)
        let from = Self.tonePalette[i], to = Self.tonePalette[i + 1]
        let mixed = zip(from, to).map { mix($0, $1, t) }

        // 방향 드리프트 + 밴드 이동 — 색만 바뀌는 게 아니라 '띠가 흐르는' 느낌을 준다.
        let drift = 0.45 * sin(Double(p) * .pi * 2)          // 좌우로 기울기
        let band = 0.28 * CGFloat(sin(Double(p) * .pi * 3))  // 중간 스톱이 위아래로 이동
        let mid = min(0.85, max(0.15, 0.5 + band))

        CATransaction.begin()
        CATransaction.setDisableActions(true)
        toneGradient.colors = mixed.map { $0.cgColor }
        toneGradient.locations = [0, mid as NSNumber, 1]
        toneGradient.startPoint = CGPoint(x: 0.5 - drift, y: 0)
        toneGradient.endPoint = CGPoint(x: 0.5 + drift, y: 1)
        CATransaction.commit()
    }

    private func mix(_ a: UIColor, _ b: UIColor, _ t: CGFloat) -> UIColor {
        var ar: CGFloat = 0, ag: CGFloat = 0, ab: CGFloat = 0, aa: CGFloat = 0
        var br: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0, ba: CGFloat = 0
        a.getRed(&ar, green: &ag, blue: &ab, alpha: &aa)
        b.getRed(&br, green: &bg, blue: &bb, alpha: &ba)
        return UIColor(red: ar + (br - ar) * t, green: ag + (bg - ag) * t,
                       blue: ab + (bb - ab) * t, alpha: aa + (ba - aa) * t)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        updateVisibleVideos()
        startMarquee()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        videoSlots.forEach { $0.player?.pause() }
    }

    /// 슬롯에 플레이어를 붙인다(최초 1회). 버퍼가 조금만 차도 바로 재생 시작해 체감 지연을 줄인다.
    private func attach(_ slot: VideoSlot) {
        guard slot.player == nil else { return }
        let item = AVPlayerItem(url: slot.url)
        item.preferredForwardBufferDuration = 2   // 2초만 받으면 시작
        let queue = AVQueuePlayer(playerItem: item)
        queue.isMuted = true
        queue.automaticallyWaitsToMinimizeStalling = false   // 끊김 방지보다 빠른 시작 우선
        slot.looper = AVPlayerLooper(player: queue, templateItem: item)
        let layer = AVPlayerLayer(player: queue)
        layer.videoGravity = .resizeAspectFill
        layer.frame = slot.host.bounds
        slot.host.layer.insertSublayer(layer, at: 0)
        slot.player = queue
        slot.layer = layer
        // 첫 프레임이 실제로 준비되면 포스터를 부드럽게 걷어낸다.
        if let poster = slot.poster {
            slot.readyObs = layer.observe(\.isReadyForDisplay, options: [.initial, .new]) { l, _ in
                guard l.isReadyForDisplay else { return }
                DispatchQueue.main.async {
                    UIView.animate(withDuration: 0.35) { poster.alpha = 0 }
                }
            }
        }
    }

    /// 화면에 보이는 영상만 재생한다.
    /// 7개(히어로+지점5+클로징)를 한꺼번에 play() 하면 iOS 동시 H.264 디코더 한도를 넘겨
    /// 아래쪽 지점 영상이 검은 화면으로 남거나 로드되지 않는다.
    private func updateVisibleVideos() {
        // 화면(+위아래 200pt 프리롤)에 걸치는 슬롯만 준비/재생한다.
        let viewport = CGRect(x: 0, y: scrollView.contentOffset.y - 200,
                              width: scrollView.bounds.width,
                              height: scrollView.bounds.height + 400)
        for slot in videoSlots {
            let onScreen = slot.host.convert(slot.host.bounds, to: scrollView).intersects(viewport)
            if onScreen {
                attach(slot)
                if slot.player?.rate == 0 { slot.player?.play() }
            } else {
                slot.player?.pause()
            }
        }
    }

    // MARK: - Build

    private func buildScroll() {
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = true
        scrollView.contentInsetAdjustmentBehavior = .never
        scrollView.delegate = self   // 보이는 영상만 재생하기 위해 스크롤 추적
        view.addSubview(scrollView)

        content.translatesAutoresizingMaskIntoConstraints = false
        content.axis = .vertical
        content.spacing = 0
        scrollView.addSubview(content)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            content.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            content.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            content.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            content.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            content.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),
        ])
    }

    /// 영상 배경 뷰(무음 루프)
    private func makeVideoView(url: URL, dim: CGFloat) -> UIView {
        let host = UIView()
        host.backgroundColor = .black
        host.clipsToBounds = true
        // 플레이어는 화면에 들어올 때 만든다(지연 생성).
        // 7개(히어로+지점5+클로징)를 미리 만들면 AVPlayerItem 들이 동시에 네트워크를 물어
        // 대역폭을 나눠 먹고 첫 재생이 한참 뒤에 시작된다. url 만 들고 있다가 필요할 때 붙인다.
        videoSlots.append(VideoSlot(url: url, host: host))

        if dim > 0 {
            let dimView = UIView()
            dimView.translatesAutoresizingMaskIntoConstraints = false
            dimView.backgroundColor = UIColor.black.withAlphaComponent(dim)
            dimView.isUserInteractionEnabled = false
            host.addSubview(dimView)
            NSLayoutConstraint.activate([
                dimView.topAnchor.constraint(equalTo: host.topAnchor),
                dimView.leadingAnchor.constraint(equalTo: host.leadingAnchor),
                dimView.trailingAnchor.constraint(equalTo: host.trailingAnchor),
                dimView.bottomAnchor.constraint(equalTo: host.bottomAnchor),
            ])
        }
        return host
    }

    private func buildHero() {
        let hero = makeVideoView(url: Self.heroVideo, dim: 0.42)
        hero.translatesAutoresizingMaskIntoConstraints = false
        content.addArrangedSubview(hero)
        // 화면을 정확히 꽉 채우는 풀스크린 히어로(세이프에어리어 무시 — scrollView 가 view 전체에 핀되어 있음)
        hero.heightAnchor.constraint(equalTo: scrollView.frameLayoutGuide.heightAnchor).isActive = true

        let col = UIStackView()
        col.translatesAutoresizingMaskIntoConstraints = false
        col.axis = .vertical
        col.alignment = .center
        col.spacing = 12
        hero.addSubview(col)

        let logo = UIImageView()
        logo.translatesAutoresizingMaskIntoConstraints = false
        logo.contentMode = .scaleAspectFit
        logo.heightAnchor.constraint(equalToConstant: 38).isActive = true
        loadImage(Self.logoURL, into: logo)
        col.addArrangedSubview(logo)

        col.addArrangedSubview(label("VILLA DE GD · WEDDING", size: 13, weight: .semibold,
                                     color: UIColor.white.withAlphaComponent(0.72), spacing: 2.6))
        col.addArrangedSubview(label("빛과 웨딩이\n어우러지다", size: 32, weight: .heavy, color: .white, align: .center))
        col.addArrangedSubview(label("미디어아트 웨딩의 정수, 전국 5개 지점에서\n신랑신부의 스토리를 빛으로 담습니다",
                                     size: 15, weight: .regular,
                                     color: UIColor.white.withAlphaComponent(0.85), align: .center))

        let cta = glassButton("웨딩홀 둘러보기")
        cta.addTarget(self, action: #selector(tapWeddingHalls), for: .touchUpInside)
        col.addArrangedSubview(cta)
        col.setCustomSpacing(24, after: col.arrangedSubviews[3])

        NSLayoutConstraint.activate([
            col.centerYAnchor.constraint(equalTo: hero.centerYAnchor),
            col.leadingAnchor.constraint(equalTo: hero.leadingAnchor, constant: 24),
            col.trailingAnchor.constraint(equalTo: hero.trailingAnchor, constant: -24),
        ])

        // 스크롤 유도 — 문구 + 아래 화살표(위아래로 천천히 부유)
        let hint = UIStackView()
        hint.translatesAutoresizingMaskIntoConstraints = false
        hint.axis = .vertical
        hint.alignment = .center
        hint.spacing = 6
        hint.addArrangedSubview(label("스크롤을 내려주세요", size: 13, weight: .semibold,
                                      color: UIColor.white.withAlphaComponent(0.8), spacing: 0.6))
        let chevron = UIImageView(image: UIImage(systemName: "chevron.down",
                                                 withConfiguration: UIImage.SymbolConfiguration(pointSize: 15, weight: .semibold)))
        chevron.tintColor = UIColor.white.withAlphaComponent(0.75)
        chevron.contentMode = .scaleAspectFit
        hint.addArrangedSubview(chevron)
        hero.addSubview(hint)
        NSLayoutConstraint.activate([
            hint.centerXAnchor.constraint(equalTo: hero.centerXAnchor),
            hint.bottomAnchor.constraint(equalTo: hero.bottomAnchor, constant: -26),
        ])
        UIView.animate(withDuration: 1.5, delay: 0.6, options: [.repeat, .autoreverse, .curveEaseInOut]) {
            hint.transform = CGAffineTransform(translationX: 0, y: 8)
        }

        // 지점 워드마크 캐러셀 — 영상 위, 스크롤 안내 바로 위
        buildMarquee(in: hero, above: hint)
    }

    // 캐러셀 치수 — 레이아웃에 의존하지 않도록 상수로 고정(폭을 런타임에 재면
    // 아직 레이아웃 전이라 0 이 나와 애니메이션이 시작되지 않는다).
    private static let mqItemW: CGFloat = 132
    private static let mqItemH: CGFloat = 46
    private static let mqGap: CGFloat = 44
    /// 한 세트 폭 + 간격 = 이만큼 왼쪽으로 흐르면 두 번째 세트가 정확히 첫 세트 자리에 온다.
    private static var mqShift: CGFloat {
        let n = CGFloat(branchLogos.count)
        return (n * mqItemW + (n - 1) * mqGap) + mqGap
    }

    /// 히어로 영상 위에 얹는 지점 워드마크 무한 캐러셀 (스크롤 안내 바로 위)
    private func buildMarquee(in hero: UIView, above anchorView: UIView) {
        let clip = UIView()
        clip.translatesAutoresizingMaskIntoConstraints = false
        clip.backgroundColor = .clear          // 영상이 그대로 비치도록
        clip.clipsToBounds = true
        hero.addSubview(clip)
        NSLayoutConstraint.activate([
            clip.leadingAnchor.constraint(equalTo: hero.leadingAnchor),
            clip.trailingAnchor.constraint(equalTo: hero.trailingAnchor),
            clip.bottomAnchor.constraint(equalTo: anchorView.topAnchor, constant: -18),
            clip.heightAnchor.constraint(equalToConstant: Self.mqItemH + 8),
        ])

        marqueeTrack.translatesAutoresizingMaskIntoConstraints = false
        marqueeTrack.axis = .horizontal
        marqueeTrack.alignment = .center
        marqueeTrack.spacing = Self.mqGap
        clip.addSubview(marqueeTrack)
        NSLayoutConstraint.activate([
            marqueeTrack.centerYAnchor.constraint(equalTo: clip.centerYAnchor),
            marqueeTrack.leadingAnchor.constraint(equalTo: clip.leadingAnchor),
        ])

        // 끊김 없는 루프를 위해 동일 세트를 2벌 배치
        for _ in 0..<2 {
            for url in Self.branchLogos {
                let iv = UIImageView()
                iv.translatesAutoresizingMaskIntoConstraints = false
                iv.contentMode = .scaleAspectFit
                iv.alpha = 0.92
                iv.widthAnchor.constraint(equalToConstant: Self.mqItemW).isActive = true
                iv.heightAnchor.constraint(equalToConstant: Self.mqItemH).isActive = true
                loadImage(url, into: iv)
                marqueeTrack.addArrangedSubview(iv)
            }
        }
    }

    /// CoreAnimation 으로 무한 스크롤 — 레이아웃/런루프와 무관하게 확실히 돈다.
    private func startMarquee() {
        // 백그라운드 복귀 시 CA 애니메이션이 제거되므로 '이미 붙어있는지'로 판단(플래그 아님)
        guard marqueeTrack.layer.animation(forKey: "villadegdMarquee") == nil else { return }
        marqueeStarted = true
        let anim = CABasicAnimation(keyPath: "transform.translation.x")
        anim.fromValue = 0
        anim.toValue = -Self.mqShift
        anim.duration = 26                     // 천천히
        anim.repeatCount = .infinity
        anim.isRemovedOnCompletion = false
        anim.timingFunction = CAMediaTimingFunction(name: .linear)
        marqueeTrack.layer.add(anim, forKey: "villadegdMarquee")
    }

    private func buildStrengths() {
        let box = UIStackView()
        box.axis = .vertical
        box.spacing = 0
        box.isLayoutMarginsRelativeArrangement = true
        box.layoutMargins = UIEdgeInsets(top: 56, left: 24, bottom: 40, right: 24)

        box.addArrangedSubview(label("WHY VILLA DE GD", size: 13, weight: .semibold,
                                     color: UIColor(white: 0.72, alpha: 1), spacing: 2.2, align: .center))
        let title = label("웨딩은 왜\n빌라드지디일까요?", size: 26, weight: .heavy,
                          color: UIColor(red: 0.10, green: 0.12, blue: 0.16, alpha: 1), align: .center)
        box.addArrangedSubview(title)
        box.setCustomSpacing(10, after: box.arrangedSubviews[0])
        box.setCustomSpacing(32, after: title)

        for (t, d) in Self.strengths {
            let row = UIStackView()
            row.axis = .horizontal
            row.alignment = .top
            row.spacing = 12

            let check = UIImageView(image: UIImage(systemName: "checkmark",
                                                   withConfiguration: UIImage.SymbolConfiguration(pointSize: 15, weight: .bold)))
            check.tintColor = UIColor(red: 0.19, green: 0.51, blue: 0.96, alpha: 1)
            check.translatesAutoresizingMaskIntoConstraints = false
            check.contentMode = .scaleAspectFit
            check.widthAnchor.constraint(equalToConstant: 22).isActive = true
            check.heightAnchor.constraint(equalToConstant: 24).isActive = true
            row.addArrangedSubview(check)

            let texts = UIStackView()
            texts.axis = .vertical
            texts.spacing = 4
            texts.addArrangedSubview(label(t, size: 17, weight: .bold,
                                           color: UIColor(red: 0.10, green: 0.12, blue: 0.16, alpha: 1), align: .left))
            texts.addArrangedSubview(label(d, size: 14.5, weight: .regular,
                                           color: UIColor(red: 0.55, green: 0.58, blue: 0.63, alpha: 1), align: .left))
            row.addArrangedSubview(texts)

            box.addArrangedSubview(row)
            box.setCustomSpacing(22, after: row)
        }
        content.addArrangedSubview(box)
    }

    private func buildBranch(_ b: Branch) {
        let box = UIStackView()
        box.axis = .vertical
        box.spacing = 0
        box.isLayoutMarginsRelativeArrangement = true
        box.layoutMargins = UIEdgeInsets(top: 24, left: 0, bottom: 32, right: 0)

        let head = UIStackView()
        head.axis = .vertical
        head.spacing = 8
        head.isLayoutMarginsRelativeArrangement = true
        head.layoutMargins = UIEdgeInsets(top: 0, left: 24, bottom: 0, right: 24)

        // 영문 'VILLA DE GD OOO' 텍스트 대신 지점 워드마크 로고를 넣는다.
        // 원본이 흰색 PNG 라 밝은 배경에선 안 보이므로 template 로 칠해서 쓴다.
        let logo = UIImageView()
        logo.translatesAutoresizingMaskIntoConstraints = false
        logo.contentMode = .scaleAspectFit
        logo.tintColor = UIColor(red: 0.10, green: 0.12, blue: 0.16, alpha: 1)
        logo.heightAnchor.constraint(equalToConstant: 44).isActive = true
        loadImage("\(Self.blob)/villadegd-logo-\(b.slug.replacingOccurrences(of: "villadegd-", with: "")).png",
                  into: logo, asTemplate: true)
        head.addArrangedSubview(logo)
        if let hall = b.hall {
            head.addArrangedSubview(label(hall, size: 13, weight: .semibold,
                                          color: UIColor(white: 0.62, alpha: 1), spacing: 0.4, align: .center))
        }
        head.addArrangedSubview(label(b.intro, size: 16, weight: .regular,
                                      color: UIColor(red: 0.42, green: 0.46, blue: 0.52, alpha: 1), align: .center))
        box.addArrangedSubview(head)
        box.setCustomSpacing(20, after: head)

        // 대표 영상
        if let url = URL(string: b.video) {
            let wrap = UIView()
            wrap.translatesAutoresizingMaskIntoConstraints = false
            let video = makeVideoView(url: url, dim: 0)
            // 버퍼링 동안 검은 화면이 아니라 지점 사진이 보이도록 포스터를 깐다.
            // (영상 레이어는 attach 시 insertSublayer(at:0) 로 이 이미지 '아래'가 아니라
            //  뷰 계층상 이미지 뒤에 들어가므로, 포스터는 영상이 준비되면 서서히 감춘다.)
            let poster = UIImageView()
            poster.translatesAutoresizingMaskIntoConstraints = false
            poster.contentMode = .scaleAspectFill
            poster.clipsToBounds = true
            loadImage("https://freetiful.com/images/wedding-partners/wedding-hall/\(b.slug)/01.webp", into: poster)
            video.addSubview(poster)
            NSLayoutConstraint.activate([
                poster.topAnchor.constraint(equalTo: video.topAnchor),
                poster.bottomAnchor.constraint(equalTo: video.bottomAnchor),
                poster.leadingAnchor.constraint(equalTo: video.leadingAnchor),
                poster.trailingAnchor.constraint(equalTo: video.trailingAnchor),
            ])
            videoSlots.last?.poster = poster
            video.translatesAutoresizingMaskIntoConstraints = false
            video.layer.cornerRadius = 24
            video.layer.cornerCurve = .continuous
            wrap.addSubview(video)
            NSLayoutConstraint.activate([
                video.topAnchor.constraint(equalTo: wrap.topAnchor),
                video.bottomAnchor.constraint(equalTo: wrap.bottomAnchor),
                video.leadingAnchor.constraint(equalTo: wrap.leadingAnchor, constant: 24),
                video.trailingAnchor.constraint(equalTo: wrap.trailingAnchor, constant: -24),
                video.heightAnchor.constraint(equalTo: video.widthAnchor, multiplier: 9.0 / 16.0),
            ])
            box.addArrangedSubview(wrap)
            box.setCustomSpacing(12, after: wrap)
        }

        // 이미지 캐러셀(가로 스크롤)
        let carousel = UIScrollView()
        carousel.translatesAutoresizingMaskIntoConstraints = false
        carousel.showsHorizontalScrollIndicator = false
        carousel.contentInset = UIEdgeInsets(top: 0, left: 24, bottom: 0, right: 24)
        let strip = UIStackView()
        strip.translatesAutoresizingMaskIntoConstraints = false
        strip.axis = .horizontal
        strip.spacing = 10
        carousel.addSubview(strip)

        let shown = min(b.imageCount, 10)
        for i in 1...shown {
            let iv = UIImageView()
            iv.translatesAutoresizingMaskIntoConstraints = false
            iv.contentMode = .scaleAspectFill
            iv.clipsToBounds = true
            iv.backgroundColor = UIColor(white: 0.95, alpha: 1)
            iv.layer.cornerRadius = 18
            iv.layer.cornerCurve = .continuous
            iv.widthAnchor.constraint(equalToConstant: 168).isActive = true
            iv.heightAnchor.constraint(equalToConstant: 224).isActive = true
            let name = String(format: "%02d", i)
            loadImage("https://freetiful.com/images/wedding-partners/wedding-hall/\(b.slug)/\(name).webp", into: iv)
            strip.addArrangedSubview(iv)
        }
        NSLayoutConstraint.activate([
            strip.topAnchor.constraint(equalTo: carousel.contentLayoutGuide.topAnchor),
            strip.bottomAnchor.constraint(equalTo: carousel.contentLayoutGuide.bottomAnchor),
            strip.leadingAnchor.constraint(equalTo: carousel.contentLayoutGuide.leadingAnchor),
            strip.trailingAnchor.constraint(equalTo: carousel.contentLayoutGuide.trailingAnchor),
            strip.heightAnchor.constraint(equalTo: carousel.frameLayoutGuide.heightAnchor),
            carousel.heightAnchor.constraint(equalToConstant: 224),
        ])
        box.addArrangedSubview(carousel)
        box.setCustomSpacing(18, after: carousel)

        let addr = label("\(b.address) · \(b.phone)", size: 14, weight: .regular,
                         color: UIColor(red: 0.55, green: 0.58, blue: 0.63, alpha: 1), align: .center)
        let addrWrap = UIStackView(arrangedSubviews: [addr])
        addrWrap.isLayoutMarginsRelativeArrangement = true
        addrWrap.layoutMargins = UIEdgeInsets(top: 0, left: 24, bottom: 0, right: 24)
        box.addArrangedSubview(addrWrap)

        content.addArrangedSubview(box)
    }

    private func buildClosing() {
        let host = makeVideoView(url: Self.heroVideo, dim: 0.72)
        host.translatesAutoresizingMaskIntoConstraints = false
        content.addArrangedSubview(host)
        host.heightAnchor.constraint(equalToConstant: 460).isActive = true

        let col = UIStackView()
        col.translatesAutoresizingMaskIntoConstraints = false
        col.axis = .vertical
        col.alignment = .center
        col.spacing = 14
        host.addSubview(col)

        col.addArrangedSubview(label("당신의 웨딩,\n빌라드지디에서 시작하세요", size: 28, weight: .heavy,
                                     color: .white, align: .center))
        col.addArrangedSubview(label("원하는 지점의 홀과 상담을 프리티풀에서 바로 확인하세요.",
                                     size: 15, weight: .regular,
                                     color: UIColor.white.withAlphaComponent(0.8), align: .center))

        let cta = glassButton("웨딩홀 둘러보기", fontSize: 16, height: 54)
        cta.addTarget(self, action: #selector(tapWeddingHalls), for: .touchUpInside)
        col.addArrangedSubview(cta)
        col.setCustomSpacing(26, after: col.arrangedSubviews[1])

        let later = UIButton(type: .system)
        later.setTitle("닫기", for: .normal)
        later.setTitleColor(UIColor.white.withAlphaComponent(0.6), for: .normal)
        later.titleLabel?.font = .systemFont(ofSize: 15, weight: .semibold)
        later.addTarget(self, action: #selector(tapClose), for: .touchUpInside)
        col.addArrangedSubview(later)

        NSLayoutConstraint.activate([
            col.centerYAnchor.constraint(equalTo: host.centerYAnchor),
            col.leadingAnchor.constraint(equalTo: host.leadingAnchor, constant: 24),
            col.trailingAnchor.constraint(equalTo: host.trailingAnchor, constant: -24),
        ])
    }

    /// 상단 그라데이션 블러 — 아래로 갈수록 서서히 사라지는(프로그레시브) 블러 띠.
    /// 스크롤 콘텐츠가 상태바 밑으로 지나갈 때 지저분해 보이지 않게 정리해준다.
    private func buildHeaderBlur() {
        headerBlur.translatesAutoresizingMaskIntoConstraints = false
        headerBlur.isUserInteractionEnabled = false
        view.addSubview(headerBlur)
        // 높이 = 세이프에어리어 상단 + 52 (레이아웃 단계에서 갱신)
        headerBlurHeight = headerBlur.heightAnchor.constraint(equalToConstant: 96)
        NSLayoutConstraint.activate([
            headerBlur.topAnchor.constraint(equalTo: view.topAnchor),
            headerBlur.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            headerBlur.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            headerBlurHeight!,
        ])

        // 아래로 갈수록 투명해지는 마스크 = 그라데이션 블러
        headerMask.colors = [
            UIColor.white.cgColor,
            UIColor.white.withAlphaComponent(0.75).cgColor,
            UIColor.white.withAlphaComponent(0).cgColor,
        ]
        headerMask.locations = [0, 0.55, 1]
        headerBlur.layer.mask = headerMask
    }

    private func buildCloseButton() {
        // 글래스 '안'(contentView)에 X 를 넣는다.
        // 이전엔 버튼의 subview 로 글래스를 깔았는데, 리퀴드글래스가 위로 합성돼
        // X 가 글래스 뒤에 있는 것처럼 흐려 보였다.
        let glass = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
        glass.translatesAutoresizingMaskIntoConstraints = false
        glass.isUserInteractionEnabled = false
        glass.layer.cornerRadius = 22
        glass.layer.cornerCurve = .continuous
        glass.clipsToBounds = true
        if !LiquidGlassEffectFactory.supportsNativeLiquidGlass {
            glass.backgroundColor = UIColor.black.withAlphaComponent(0.30)
            glass.layer.borderWidth = 1
            glass.layer.borderColor = UIColor.white.withAlphaComponent(0.28).cgColor
        }

        let icon = UIImageView(image: UIImage(systemName: "xmark",
                                              withConfiguration: UIImage.SymbolConfiguration(pointSize: 16, weight: .bold)))
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.tintColor = .white
        icon.contentMode = .center
        glass.contentView.addSubview(icon)
        NSLayoutConstraint.activate([
            icon.centerXAnchor.constraint(equalTo: glass.contentView.centerXAnchor),
            icon.centerYAnchor.constraint(equalTo: glass.contentView.centerYAnchor),
        ])

        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.addTarget(self, action: #selector(tapClose), for: .touchUpInside)
        closeButton.addSubview(glass)
        NSLayoutConstraint.activate([
            glass.topAnchor.constraint(equalTo: closeButton.topAnchor),
            glass.bottomAnchor.constraint(equalTo: closeButton.bottomAnchor),
            glass.leadingAnchor.constraint(equalTo: closeButton.leadingAnchor),
            glass.trailingAnchor.constraint(equalTo: closeButton.trailingAnchor),
        ])
        view.addSubview(closeButton)
        NSLayoutConstraint.activate([
            closeButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            closeButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            closeButton.widthAnchor.constraint(equalToConstant: 44),
            closeButton.heightAnchor.constraint(equalToConstant: 44),
        ])
    }

    // MARK: - Helpers

    private func label(_ text: String, size: CGFloat, weight: UIFont.Weight, color: UIColor,
                       spacing: CGFloat = 0, align: NSTextAlignment = .center) -> UILabel {
        let l = UILabel()
        l.numberOfLines = 0
        l.textAlignment = align
        l.textColor = color
        l.font = .systemFont(ofSize: size, weight: weight)
        if spacing > 0 {
            l.attributedText = NSAttributedString(string: text, attributes: [.kern: spacing])
            l.textColor = color
            l.font = .systemFont(ofSize: size, weight: weight)
            l.textAlignment = align
        } else {
            let p = NSMutableParagraphStyle()
            p.alignment = align
            p.lineHeightMultiple = 1.18
            l.attributedText = NSAttributedString(string: text, attributes: [
                .paragraphStyle: p, .font: UIFont.systemFont(ofSize: size, weight: weight), .foregroundColor: color,
            ])
        }
        return l
    }

    /// 리퀴드 글래스 버튼 — 프로젝트 공용 LiquidGlassEffectFactory(네이티브 UIGlassEffect,
    /// 미지원 OS 는 블러로 폴백)를 써서 하단 네비바와 동일한 재질로 맞춘다.
    private func glassButton(_ title: String, fontSize: CGFloat = 15, height: CGFloat = 50) -> UIButton {
        let b = UIButton(type: .system)
        b.translatesAutoresizingMaskIntoConstraints = false
        b.setTitle(title, for: .normal)
        b.setTitleColor(.white, for: .normal)
        b.titleLabel?.font = .systemFont(ofSize: fontSize, weight: .bold)
        b.contentEdgeInsets = UIEdgeInsets(top: 0, left: 34, bottom: 0, right: 34)
        b.heightAnchor.constraint(equalToConstant: height).isActive = true

        let glass = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
        glass.translatesAutoresizingMaskIntoConstraints = false
        glass.isUserInteractionEnabled = false
        glass.layer.cornerRadius = height / 2
        glass.layer.cornerCurve = .continuous
        glass.clipsToBounds = true
        // 네이티브 리퀴드글래스는 자체 테두리/하이라이트를 갖고 있어 폴백(블러)일 때만 보더를 얹는다.
        if !LiquidGlassEffectFactory.supportsNativeLiquidGlass {
            glass.layer.borderWidth = 1
            glass.layer.borderColor = UIColor.white.withAlphaComponent(0.34).cgColor
        }
        b.insertSubview(glass, at: 0)
        NSLayoutConstraint.activate([
            glass.topAnchor.constraint(equalTo: b.topAnchor),
            glass.bottomAnchor.constraint(equalTo: b.bottomAnchor),
            glass.leadingAnchor.constraint(equalTo: b.leadingAnchor),
            glass.trailingAnchor.constraint(equalTo: b.trailingAnchor),
        ])
        return b
    }

    /// asTemplate=true 면 tintColor 로 칠해 쓴다(흰색 PNG 로고를 밝은 배경에 올릴 때).
    private func loadImage(_ urlString: String, into view: UIImageView, asTemplate: Bool = false) {
        guard let url = URL(string: urlString) else { return }
        URLSession.shared.dataTask(with: url) { data, _, _ in
            guard let data = data, let img = UIImage(data: data) else { return }
            let final = asTemplate ? img.withRenderingMode(.alwaysTemplate) : img
            DispatchQueue.main.async { view.image = final }
        }.resume()
    }

    // MARK: - Actions

    @objc private func tapClose() {
        videoSlots.forEach { $0.player?.pause() }
        dismiss(animated: true)
    }

    @objc private func tapWeddingHalls() {
        videoSlots.forEach { $0.player?.pause() }
        let open = onOpenWeddingHalls
        dismiss(animated: true) { open?() }
    }
}
