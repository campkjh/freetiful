import UIKit

// 비즈 페이지 네이티브 글래스 하단 네비바 — 홈 버튼 + 4 섹션 탭 (웹 /biz 하단 네비와 동일 섹션)
final class NativeBizNav: UIView {
    var onHome: (() -> Void)?
    var onTab: ((String) -> Void)?   // 섹션 id 전달

    private let bar = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
    private let homePill = GlassPill(corner: 23)
    private let homeButton = UIButton(type: .system)
    private var tabButtons: [UIButton] = []
    private var indicator = UIView()

    // 사용자 선택: 웹 현재 그대로 (회사소개·서비스·자료실·문의)
    let sections = ["회사소개", "핵심서비스", "자료실", "문의폼"]
    private let labels = ["회사소개", "서비스", "자료실", "문의"]
    private let icons = ["bizBuilding", "bizFlag", "bizMedal", "bizStack"]
    private let blue = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
    private let inactive = UIColor(white: 0.62, alpha: 1)
    private(set) var activeIndex = 0

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .clear

        // 플로팅 글래스 바
        bar.translatesAutoresizingMaskIntoConstraints = false
        bar.layer.cornerRadius = 31; bar.layer.cornerCurve = .continuous
        bar.clipsToBounds = true
        bar.layer.borderWidth = 1; bar.layer.borderColor = UIColor.white.withAlphaComponent(0.5).cgColor
        bar.contentView.backgroundColor = UIColor.white.withAlphaComponent(0.55)
        addSubview(bar)
        // 그림자(별도 컨테이너 레이어)
        layer.shadowColor = UIColor(red: 0.1, green: 0.15, blue: 0.3, alpha: 1).cgColor
        layer.shadowOpacity = 0.12; layer.shadowRadius = 18; layer.shadowOffset = CGSize(width: 0, height: 6)

        // 홈 버튼 (홈 아이콘 → 일반 홈)
        var hcfg = UIButton.Configuration.plain()
        hcfg.image = UIImage(named: "iconHome")?.withRenderingMode(.alwaysTemplate)
        homeButton.configuration = hcfg
        homeButton.tintColor = UIColor(white: 0.13, alpha: 1)
        homeButton.imageView?.contentMode = .scaleAspectFit
        homeButton.addTarget(self, action: #selector(tapHome), for: .touchUpInside)
        homePill.setContent(homeButton, insets: UIEdgeInsets(top: 11, left: 11, bottom: 11, right: 11))
        bar.contentView.addSubview(homePill)

        // 탭 스택
        let stack = UIStackView(); stack.axis = .horizontal; stack.distribution = .fillEqually; stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        bar.contentView.addSubview(stack)

        indicator.backgroundColor = blue
        indicator.layer.cornerRadius = 2
        bar.contentView.addSubview(indicator)

        for i in 0..<sections.count {
            let b = UIButton(type: .system)
            var cfg = UIButton.Configuration.plain()
            cfg.image = UIImage(named: icons[i])?.withRenderingMode(.alwaysTemplate)
            cfg.title = labels[i]
            cfg.imagePlacement = .top
            cfg.imagePadding = 3
            cfg.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { var o = $0; o.font = .systemFont(ofSize: 10, weight: .semibold); return o }
            cfg.contentInsets = NSDirectionalEdgeInsets(top: 6, leading: 2, bottom: 6, trailing: 2)
            b.configuration = cfg
            b.tag = i
            b.tintColor = inactive
            b.addTarget(self, action: #selector(tapTab(_:)), for: .touchUpInside)
            tabButtons.append(b)
            stack.addArrangedSubview(b)
        }

        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo: topAnchor),
            bar.bottomAnchor.constraint(equalTo: bottomAnchor),
            bar.leadingAnchor.constraint(equalTo: leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: trailingAnchor),
            homePill.leadingAnchor.constraint(equalTo: bar.contentView.leadingAnchor, constant: 8),
            homePill.centerYAnchor.constraint(equalTo: bar.contentView.centerYAnchor),
            homePill.widthAnchor.constraint(equalToConstant: 46),
            homePill.heightAnchor.constraint(equalToConstant: 46),
            stack.leadingAnchor.constraint(equalTo: homePill.trailingAnchor, constant: 4),
            stack.trailingAnchor.constraint(equalTo: bar.contentView.trailingAnchor, constant: -8),
            stack.topAnchor.constraint(equalTo: bar.contentView.topAnchor),
            stack.bottomAnchor.constraint(equalTo: bar.contentView.bottomAnchor),
        ])
        setActive(0, animated: false)
    }

    @objc private func tapHome() { Haptics.tap(); onHome?() }
    @objc private func tapTab(_ s: UIButton) {
        Haptics.tap()
        setActive(s.tag, animated: true)
        onTab?(sections[s.tag])
    }

    func setActive(_ index: Int, animated: Bool) {
        guard index >= 0, index < tabButtons.count else { return }
        activeIndex = index
        for (i, b) in tabButtons.enumerated() { b.tintColor = i == index ? blue : inactive }
        layoutIndicator(animated: animated)
    }
    private func layoutIndicator(animated: Bool) {
        guard !tabButtons.isEmpty, let target = tabButtons[safe: activeIndex] else { return }
        let f = target.convert(target.bounds, to: bar.contentView)
        let w: CGFloat = 18
        let newFrame = CGRect(x: f.midX - w/2, y: bar.contentView.bounds.height - 6, width: w, height: 3)
        if animated { UIView.animate(withDuration: 0.3, delay: 0, options: [.curveEaseInOut]) { self.indicator.frame = newFrame } }
        else { indicator.frame = newFrame }
    }
    override func layoutSubviews() {
        super.layoutSubviews()
        layoutIndicator(animated: false)
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}
