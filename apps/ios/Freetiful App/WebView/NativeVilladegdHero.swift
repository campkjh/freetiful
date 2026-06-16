import UIKit
import AVFoundation

// 웨딩홀 리스트 히어로 — 빌라드지디 안양 (영상 배경 + 로고 + 소개)
// 영상/로고: Vercel Blob CDN. tableHeaderView 로 사용.
final class NativeVilladegdHero: UIView {
    private static let videoURL = URL(string: "https://jnhwlzeyberhyv7s.public.blob.vercel-storage.com/villadegd/villadegd-hero.mp4")!
    private static let logoURL = "https://jnhwlzeyberhyv7s.public.blob.vercel-storage.com/villadegd/villadegd-logo-white.png"
    private static let logoAspect: CGFloat = 778.0 / 248.0   // 크롭된 워드마크 비율

    private let card = UIView()
    private var player: AVPlayer?
    private var playerLayer: AVPlayerLayer?
    private var looper: Any?
    private let gradient = CAGradientLayer()
    private let logoView = UIImageView()
    private let col = UIStackView()

    // 진입 인트로 (검은화면 → 로고 → 영상)
    private let introCover = UIView()
    private let introLogo = UIImageView()
    private var introPlayed = false

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setup() {
        backgroundColor = .clear

        card.translatesAutoresizingMaskIntoConstraints = false
        card.backgroundColor = .black
        card.clipsToBounds = true
        addSubview(card)

        // 영상 (looping, muted)
        let item = AVPlayerItem(url: Self.videoURL)
        let queue = AVQueuePlayer(playerItem: item)
        queue.isMuted = true
        if #available(iOS 10.0, *) { looper = AVPlayerLooper(player: queue, templateItem: item) }
        let pl = AVPlayerLayer(player: queue)
        pl.videoGravity = .resizeAspectFill
        card.layer.addSublayer(pl)
        self.player = queue
        self.playerLayer = pl

        // 가독성 그라데이션
        gradient.colors = [
            UIColor.black.withAlphaComponent(0.45).cgColor,
            UIColor.black.withAlphaComponent(0.12).cgColor,
            UIColor.black.withAlphaComponent(0.72).cgColor,
            UIColor.black.withAlphaComponent(0.92).cgColor,
        ]
        gradient.locations = [0, 0.32, 0.72, 1]
        card.layer.addSublayer(gradient)

        // 로고 (흰색 PNG) — 좌측 정렬 위해 정확한 비율로 폭 고정
        logoView.translatesAutoresizingMaskIntoConstraints = false
        logoView.contentMode = .scaleAspectFit
        logoView.layer.shadowColor = UIColor.black.cgColor
        logoView.layer.shadowOpacity = 0.6
        logoView.layer.shadowRadius = 5
        logoView.layer.shadowOffset = CGSize(width: 0, height: 1)
        NativeChatImageLoader.load(Self.logoURL, into: logoView, fallback: nil)

        let title = UILabel()
        title.text = "빛과 웨딩이 어우러지다"
        title.font = .systemFont(ofSize: 26, weight: .bold)
        title.textColor = .white
        title.layer.shadowColor = UIColor.black.cgColor
        title.layer.shadowOpacity = 0.5
        title.layer.shadowRadius = 4
        title.layer.shadowOffset = CGSize(width: 0, height: 1)
        title.translatesAutoresizingMaskIntoConstraints = false

        let subtitle = UILabel()
        subtitle.text = "최초 미디어아트 웨딩, 신랑신부의 스토리를 빛으로 담는 안양 빌라드지디"
        subtitle.font = .systemFont(ofSize: 13)
        subtitle.textColor = UIColor.white.withAlphaComponent(0.85)
        subtitle.numberOfLines = 2
        subtitle.translatesAutoresizingMaskIntoConstraints = false

        let location = UILabel()
        location.text = "📍 경기 안양시 동안구 관악대로 254 · 031-382-3838"
        location.font = .systemFont(ofSize: 11.5)
        location.textColor = UIColor.white.withAlphaComponent(0.65)
        location.translatesAutoresizingMaskIntoConstraints = false

        // 글래스 태그 (상하 패딩 ↑)
        let tagRow = UIStackView()
        tagRow.axis = .horizontal
        tagRow.spacing = 6
        tagRow.translatesAutoresizingMaskIntoConstraints = false
        for t in ["미디어아트 웨딩", "커스터마이징 웨딩", "하우스 웨딩"] {
            tagRow.addArrangedSubview(glassTag(t))
        }
        tagRow.addArrangedSubview(UIView())  // 좌측 정렬 스페이서

        col.axis = .vertical
        col.alignment = .leading
        col.spacing = 9
        col.translatesAutoresizingMaskIntoConstraints = false
        [logoView, title, subtitle, location, tagRow].forEach { col.addArrangedSubview($0) }
        col.setCustomSpacing(14, after: logoView)
        col.setCustomSpacing(9, after: location)
        col.alpha = 0   // 인트로 후 표출
        card.addSubview(col)

        // 인트로: 검은 커버 + 중앙 로고 (영상 위)
        introCover.translatesAutoresizingMaskIntoConstraints = false
        introCover.backgroundColor = .black
        card.addSubview(introCover)
        introLogo.translatesAutoresizingMaskIntoConstraints = false
        introLogo.contentMode = .scaleAspectFit
        introLogo.alpha = 0
        NativeChatImageLoader.load(Self.logoURL, into: introLogo, fallback: nil)
        card.addSubview(introLogo)

        NSLayoutConstraint.activate([
            card.topAnchor.constraint(equalTo: topAnchor),
            card.leadingAnchor.constraint(equalTo: leadingAnchor),
            card.trailingAnchor.constraint(equalTo: trailingAnchor),
            card.bottomAnchor.constraint(equalTo: bottomAnchor),

            logoView.heightAnchor.constraint(equalToConstant: 34),
            logoView.widthAnchor.constraint(equalTo: logoView.heightAnchor, multiplier: Self.logoAspect),

            col.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 22),
            col.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -22),
            col.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -104),

            introCover.topAnchor.constraint(equalTo: card.topAnchor),
            introCover.leadingAnchor.constraint(equalTo: card.leadingAnchor),
            introCover.trailingAnchor.constraint(equalTo: card.trailingAnchor),
            introCover.bottomAnchor.constraint(equalTo: card.bottomAnchor),

            introLogo.centerXAnchor.constraint(equalTo: card.centerXAnchor),
            introLogo.centerYAnchor.constraint(equalTo: card.centerYAnchor),
            introLogo.widthAnchor.constraint(equalToConstant: 210),
            introLogo.heightAnchor.constraint(equalToConstant: 210 / Self.logoAspect),
        ])

        player?.play()
    }

    private func glassTag(_ text: String) -> UIView {
        let blur = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
        blur.translatesAutoresizingMaskIntoConstraints = false
        blur.layer.cornerRadius = 16
        blur.layer.cornerCurve = .continuous
        blur.clipsToBounds = true
        blur.layer.borderWidth = 0.5
        blur.layer.borderColor = UIColor.white.withAlphaComponent(0.4).cgColor
        let tint = UIView()
        tint.translatesAutoresizingMaskIntoConstraints = false
        tint.backgroundColor = UIColor.white.withAlphaComponent(0.14)
        tint.isUserInteractionEnabled = false
        blur.contentView.addSubview(tint)
        let lbl = UILabel()
        lbl.text = text
        lbl.font = .systemFont(ofSize: 12, weight: .semibold)
        lbl.textColor = .white
        lbl.translatesAutoresizingMaskIntoConstraints = false
        blur.contentView.addSubview(lbl)
        NSLayoutConstraint.activate([
            tint.topAnchor.constraint(equalTo: blur.contentView.topAnchor),
            tint.bottomAnchor.constraint(equalTo: blur.contentView.bottomAnchor),
            tint.leadingAnchor.constraint(equalTo: blur.contentView.leadingAnchor),
            tint.trailingAnchor.constraint(equalTo: blur.contentView.trailingAnchor),
            lbl.topAnchor.constraint(equalTo: blur.contentView.topAnchor, constant: 8.5),
            lbl.bottomAnchor.constraint(equalTo: blur.contentView.bottomAnchor, constant: -8.5),
            lbl.leadingAnchor.constraint(equalTo: blur.contentView.leadingAnchor, constant: 13),
            lbl.trailingAnchor.constraint(equalTo: blur.contentView.trailingAnchor, constant: -13),
        ])
        return blur
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        playerLayer?.frame = card.bounds
        gradient.frame = card.bounds
    }

    static func preferredHeight(forWidth width: CGFloat) -> CGFloat {
        let cardW = width - 32
        return cardW * 0.66 + 16
    }

    // 진입 인트로: 검은화면 → 로고 → 영상 자연스럽게
    private func playIntro() {
        introCover.isHidden = false
        introLogo.isHidden = false
        introCover.alpha = 1
        introLogo.alpha = 0
        col.alpha = 0
        // 1) 로고 페이드인 (검은 배경 위)
        UIView.animate(withDuration: 0.45, delay: 0.05, options: [.curveEaseOut]) {
            self.introLogo.alpha = 1
            self.introLogo.transform = CGAffineTransform(scaleX: 1.04, y: 1.04)
        }
        // 2) 잠시 후 검은 커버 페이드아웃 → 영상 표출 + 하단 콘텐츠 페이드인
        UIView.animate(withDuration: 0.8, delay: 0.95, options: [.curveEaseInOut]) {
            self.introCover.alpha = 0
            self.introLogo.alpha = 0
        } completion: { _ in
            self.introCover.isHidden = true
            self.introLogo.isHidden = true
        }
        UIView.animate(withDuration: 0.6, delay: 1.25, options: [.curveEaseOut]) {
            self.col.alpha = 1
        }
    }

    func resume() {
        player?.play()
        if !introPlayed {
            introPlayed = true
            playIntro()
        }
    }
    func pause() {
        player?.pause()
        introPlayed = false   // 다음 진입 시 인트로 재생
    }
}
