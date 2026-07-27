import UIKit
import AVFoundation

/// 빌라드지디 첫 진입 랜딩 — 앱 최초 1회 전체화면으로 표시(글래스 X 로 닫기).
/// 웹 오버레이(VilladegdEventOverlay.tsx)의 네이티브 버전.
/// 웹 모달은 네이티브 홈 오버레이에 가려지고 hasBlockingOverlay 로 하단 네비를 숨기는 부작용이
/// 있어 웹에선 억제하고(=iOS 가드), 대신 이 화면을 네이티브로 띄운다.
final class NativeVilladegdLandingViewController: UIViewController {

    private static let blob = "https://jnhwlzeyberhyv7s.public.blob.vercel-storage.com/villadegd"
    private static let heroVideo = URL(string: "\(blob)/villadegd-hero.mp4")!
    private static let logoURL = "\(blob)/villadegd-logo-white.png"
    private static let dismissKey = "ftVilladegdLanding_v3"   // 올리면 재노출

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
    private var players: [AVPlayer] = []
    private var loopers: [Any] = []
    private var playerLayers: [(AVPlayerLayer, UIView)] = []
    private let marqueeTrack = UIStackView()
    private var marqueeStarted = false

    // MARK: - 표시 조건

    static func shouldPresent() -> Bool {
        !UserDefaults.standard.bool(forKey: dismissKey)
    }

    static func presentIfNeeded(from presenter: UIViewController, openWeddingHalls: @escaping () -> Void) {
        let dismissed = UserDefaults.standard.bool(forKey: dismissKey)
        let blocked = presenter.presentedViewController != nil
        NSLog("[VilladegdLanding] present 시도 — 이미닫음=\(dismissed) 다른모달=\(blocked)")
        guard shouldPresent(), !blocked else { return }
        let vc = NativeVilladegdLandingViewController()
        vc.onOpenWeddingHalls = openWeddingHalls
        vc.modalPresentationStyle = .fullScreen
        presenter.present(vc, animated: true)
    }

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white
        buildScroll()
        buildHero()
        buildMarquee()
        buildStrengths()
        Self.branches.forEach { buildBranch($0) }
        buildClosing()
        buildCloseButton()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        playerLayers.forEach { layer, host in layer.frame = host.bounds }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        players.forEach { $0.play() }
        startMarquee()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        players.forEach { $0.pause() }
    }

    // MARK: - Build

    private func buildScroll() {
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = true
        scrollView.contentInsetAdjustmentBehavior = .never
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

        let item = AVPlayerItem(url: url)
        let queue = AVQueuePlayer(playerItem: item)
        queue.isMuted = true
        loopers.append(AVPlayerLooper(player: queue, templateItem: item))
        let layer = AVPlayerLayer(player: queue)
        layer.videoGravity = .resizeAspectFill
        host.layer.addSublayer(layer)
        players.append(queue)
        playerLayers.append((layer, host))

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
    }

    /// 히어로 바로 아래 — 지점 워드마크가 좌→우로 천천히 흐르는 무한 캐러셀
    private func buildMarquee() {
        let host = UIView()
        host.translatesAutoresizingMaskIntoConstraints = false
        host.backgroundColor = .black
        host.clipsToBounds = true
        content.addArrangedSubview(host)
        host.heightAnchor.constraint(equalToConstant: 108).isActive = true

        marqueeTrack.translatesAutoresizingMaskIntoConstraints = false
        marqueeTrack.axis = .horizontal
        marqueeTrack.alignment = .center
        marqueeTrack.spacing = 44
        host.addSubview(marqueeTrack)
        NSLayoutConstraint.activate([
            marqueeTrack.centerYAnchor.constraint(equalTo: host.centerYAnchor),
            marqueeTrack.leadingAnchor.constraint(equalTo: host.leadingAnchor),
        ])

        // 끊김 없는 루프를 위해 동일 세트를 2벌 배치
        for _ in 0..<2 {
            for url in Self.branchLogos {
                let iv = UIImageView()
                iv.translatesAutoresizingMaskIntoConstraints = false
                iv.contentMode = .scaleAspectFit
                iv.alpha = 0.9
                iv.widthAnchor.constraint(equalToConstant: 132).isActive = true
                iv.heightAnchor.constraint(equalToConstant: 46).isActive = true
                loadImage(url, into: iv)
                marqueeTrack.addArrangedSubview(iv)
            }
        }
    }

    /// 한 세트 폭만큼 왼쪽으로 흐른 뒤 원위치 — 육안으로는 끊김 없이 이어진다.
    private func startMarquee() {
        guard !marqueeStarted else { return }
        marqueeTrack.layoutIfNeeded()
        let full = marqueeTrack.bounds.width
        guard full > 0 else { return }
        marqueeStarted = true
        let half = (full + marqueeTrack.spacing) / 2
        func loop() {
            marqueeTrack.transform = .identity
            UIView.animate(withDuration: 26, delay: 0, options: [.curveLinear, .allowUserInteraction]) {
                self.marqueeTrack.transform = CGAffineTransform(translationX: -half, y: 0)
            } completion: { finished in
                if finished { loop() }
            }
        }
        loop()
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

        let eyebrow = "VILLA DE GD \(b.en)" + (b.hall.map { " · \($0)" } ?? "")
        head.addArrangedSubview(label(eyebrow, size: 13, weight: .semibold,
                                      color: UIColor(white: 0.62, alpha: 1), spacing: 0.4, align: .center))
        head.addArrangedSubview(label("빌라드지디 \(b.name)", size: 27, weight: .heavy,
                                      color: UIColor(red: 0.10, green: 0.12, blue: 0.16, alpha: 1), align: .center))
        head.addArrangedSubview(label(b.intro, size: 16, weight: .regular,
                                      color: UIColor(red: 0.42, green: 0.46, blue: 0.52, alpha: 1), align: .center))
        box.addArrangedSubview(head)
        box.setCustomSpacing(20, after: head)

        // 대표 영상
        if let url = URL(string: b.video) {
            let wrap = UIView()
            wrap.translatesAutoresizingMaskIntoConstraints = false
            let video = makeVideoView(url: url, dim: 0)
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

    private func buildCloseButton() {
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.setImage(UIImage(systemName: "xmark",
                                     withConfiguration: UIImage.SymbolConfiguration(pointSize: 16, weight: .bold)), for: .normal)
        closeButton.tintColor = .white
        closeButton.addTarget(self, action: #selector(tapClose), for: .touchUpInside)
        // 리퀴드 글래스 원형(네이티브 UIGlassEffect, 미지원 OS 는 블러 폴백)
        let glass = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
        glass.translatesAutoresizingMaskIntoConstraints = false
        glass.isUserInteractionEnabled = false
        glass.layer.cornerRadius = 22
        glass.layer.cornerCurve = .continuous
        glass.clipsToBounds = true
        if !LiquidGlassEffectFactory.supportsNativeLiquidGlass {
            glass.backgroundColor = UIColor.black.withAlphaComponent(0.28)
            glass.layer.borderWidth = 1
            glass.layer.borderColor = UIColor.white.withAlphaComponent(0.28).cgColor
        }
        closeButton.insertSubview(glass, at: 0)
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

    private func loadImage(_ urlString: String, into view: UIImageView) {
        guard let url = URL(string: urlString) else { return }
        URLSession.shared.dataTask(with: url) { data, _, _ in
            guard let data = data, let img = UIImage(data: data) else { return }
            DispatchQueue.main.async { view.image = img }
        }.resume()
    }

    // MARK: - Actions

    @objc private func tapClose() {
        UserDefaults.standard.set(true, forKey: Self.dismissKey)
        players.forEach { $0.pause() }
        dismiss(animated: true)
    }

    @objc private func tapWeddingHalls() {
        UserDefaults.standard.set(true, forKey: Self.dismissKey)
        players.forEach { $0.pause() }
        let open = onOpenWeddingHalls
        dismiss(animated: true) { open?() }
    }
}
