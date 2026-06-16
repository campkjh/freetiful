import UIKit
import AVFoundation

// 웨딩홀 리스트 히어로 — 빌라드지디 청담 (영상 배경 + 로고 + 소개)
// 영상/로고: Vercel Blob CDN. tableHeaderView 로 사용.
final class NativeVilladegdHero: UIView {
    private static let videoURL = URL(string: "https://jnhwlzeyberhyv7s.public.blob.vercel-storage.com/villadegd/villadegd-hero.mp4")!
    private static let logoURL = "https://jnhwlzeyberhyv7s.public.blob.vercel-storage.com/villadegd/villadegd-logo-white.png"

    private let card = UIView()
    private var player: AVPlayer?
    private var playerLayer: AVPlayerLayer?
    private var looper: Any?
    private let gradient = CAGradientLayer()
    private let logoView = UIImageView()

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setup() {
        backgroundColor = .clear

        card.translatesAutoresizingMaskIntoConstraints = false
        card.backgroundColor = .black
        card.clipsToBounds = true   // 풀스크린 풀블리드(라운딩 없음)
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

        // 로고 (흰색 PNG)
        logoView.translatesAutoresizingMaskIntoConstraints = false
        logoView.contentMode = .scaleAspectFit
        logoView.setContentHuggingPriority(.required, for: .horizontal)
        logoView.layer.shadowColor = UIColor.black.cgColor
        logoView.layer.shadowOpacity = 0.7
        logoView.layer.shadowRadius = 5
        logoView.layer.shadowOffset = CGSize(width: 0, height: 1)
        NativeChatImageLoader.load(Self.logoURL, into: logoView, fallback: nil)
        card.addSubview(logoView)

        let title = UILabel()
        title.text = "웨딩의 가장 완벽한 색감"
        title.font = .systemFont(ofSize: 26, weight: .bold)
        title.textColor = .white
        title.layer.shadowColor = UIColor.black.cgColor
        title.layer.shadowOpacity = 0.5
        title.layer.shadowRadius = 4
        title.layer.shadowOffset = CGSize(width: 0, height: 1)
        title.translatesAutoresizingMaskIntoConstraints = false

        let subtitle = UILabel()
        subtitle.text = "도심 안에서 펼쳐지는 숲 속 웨딩, 신랑신부를 더욱 빛나게 하는 청담 빌라드지디"
        subtitle.font = .systemFont(ofSize: 13)
        subtitle.textColor = UIColor.white.withAlphaComponent(0.85)
        subtitle.numberOfLines = 2
        subtitle.translatesAutoresizingMaskIntoConstraints = false

        let location = UILabel()
        location.text = "📍 서울 강남구 학동로 519 · 02-542-7513"
        location.font = .systemFont(ofSize: 11.5)
        location.textColor = UIColor.white.withAlphaComponent(0.65)
        location.translatesAutoresizingMaskIntoConstraints = false

        let tagRow = UIStackView()
        tagRow.axis = .horizontal
        tagRow.spacing = 6
        tagRow.translatesAutoresizingMaskIntoConstraints = false
        for t in ["색으로 소통하는 공간", "나이트웨딩", "웨딩 뮤지컬"] {
            let tag = PaddingLabel3()
            tag.text = t
            tag.font = .systemFont(ofSize: 11, weight: .semibold)
            tag.textColor = .white
            tag.backgroundColor = UIColor.white.withAlphaComponent(0.12)
            tag.textInsets = UIEdgeInsets(top: 5, left: 10, bottom: 5, right: 10)
            tag.layer.cornerRadius = 11
            tag.layer.borderWidth = 1
            tag.layer.borderColor = UIColor.white.withAlphaComponent(0.25).cgColor
            tag.clipsToBounds = true
            tagRow.addArrangedSubview(tag)
        }
        tagRow.addArrangedSubview(UIView())  // 좌측 정렬용 스페이서

        let col = UIStackView(arrangedSubviews: [logoView, title, subtitle, location, tagRow])
        col.axis = .vertical
        col.alignment = .leading
        col.spacing = 9
        col.setCustomSpacing(14, after: logoView)
        col.setCustomSpacing(9, after: location)
        col.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(col)

        NSLayoutConstraint.activate([
            card.topAnchor.constraint(equalTo: topAnchor),
            card.leadingAnchor.constraint(equalTo: leadingAnchor),
            card.trailingAnchor.constraint(equalTo: trailingAnchor),
            card.bottomAnchor.constraint(equalTo: bottomAnchor),
            logoView.heightAnchor.constraint(equalToConstant: 34),
            logoView.widthAnchor.constraint(lessThanOrEqualToConstant: 180),
            col.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 22),
            col.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -22),
            col.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -104),
        ])

        player?.play()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        playerLayer?.frame = card.bounds
        gradient.frame = card.bounds
    }

    // tableHeaderView 용 권장 높이 계산
    static func preferredHeight(forWidth width: CGFloat) -> CGFloat {
        let cardW = width - 32
        return cardW * 0.66 + 16   // 카드 비율 + 상하 여백
    }

    // 스크롤로 화면 밖일 때 재생/일시정지 (선택적 최적화 — 여기선 항상 재생)
    func resume() { player?.play() }
    func pause() { player?.pause() }
}
