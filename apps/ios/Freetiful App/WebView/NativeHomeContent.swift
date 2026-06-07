import UIKit

protocol NativeHomeContentDelegate: AnyObject {
    func homeOpenWeddingFind()
    func homeOpenEventRequest()
    func homeOpenCategory(_ category: String)
    func homeOpenPro(_ proId: String)
}

// 네이티브 홈 스크린 본문 (웹 홈 위에 전체 덮음) — 완성될 때까지 단계적으로 섹션 추가.
// 현재: 히어로 카드(전문결혼식/전문행사 찾기). 이후: 카테고리 탭/스와이프, 배너, 사회자 리스트.
final class NativeHomeContent: UIView, UIScrollViewDelegate {
    weak var delegate: NativeHomeContentDelegate?
    private let scrollView = UIScrollView()
    private let stack = UIStackView()
    private let imageBase: String

    init(imageBase: String) {
        self.imageBase = imageBase
        super.init(frame: .zero)
        setup()
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setInsets(top: CGFloat, bottom: CGFloat) {
        scrollView.contentInset = UIEdgeInsets(top: top, left: 0, bottom: bottom, right: 0)
        scrollView.verticalScrollIndicatorInsets = UIEdgeInsets(top: top, left: 0, bottom: bottom, right: 0)
    }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .white

        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = true
        scrollView.contentInsetAdjustmentBehavior = .never
        scrollView.showsVerticalScrollIndicator = false
        addSubview(scrollView)

        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 8
        scrollView.addSubview(stack)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: bottomAnchor),
            stack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 12),
            stack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 10),
            stack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -10),
            stack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -24),
        ])

        buildHeroCards()
    }

    // MARK: - 히어로 카드 (전문결혼식 / 전문행사 찾기)
    private func buildHeroCards() {
        let row = UIStackView()
        row.axis = .horizontal
        row.distribution = .fillEqually
        row.spacing = 12

        let wedding = HeroCardView(
            imageURL: "\(imageBase)/images/category-icons/wedding-mc.png",
            line1: "전문결혼식", line2: "사회자 찾기", showChevron: true
        )
        wedding.onTap = { [weak self] in self?.delegate?.homeOpenWeddingFind() }

        let event = HeroCardView(
            imageURL: "\(imageBase)/images/category-icons/event-mc.png",
            line1: "전문행사", line2: "사회자 찾기", showChevron: false
        )
        event.onTap = { [weak self] in self?.delegate?.homeOpenEventRequest() }

        row.addArrangedSubview(wedding)
        row.addArrangedSubview(event)
        stack.addArrangedSubview(row)
    }
}

// MARK: - 히어로 카드 (정사각형, 배경 이미지 + 흰 그라데이션 + 타이틀 + 프레스 애니메이션)
final class HeroCardView: UIControl {
    var onTap: (() -> Void)?
    private let bg = UIImageView()
    private let overlay = CAGradientLayer()

    init(imageURL: String, line1: String, line2: String, showChevron: Bool) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        layer.cornerRadius = 18
        layer.cornerCurve = .continuous
        clipsToBounds = true
        backgroundColor = UIColor(red: 0.93, green: 0.96, blue: 1.0, alpha: 1)
        layer.shadowColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1).cgColor
        layer.shadowOpacity = 0.08
        layer.shadowRadius = 11
        layer.shadowOffset = CGSize(width: 0, height: 8)
        layer.masksToBounds = false

        bg.translatesAutoresizingMaskIntoConstraints = false
        bg.contentMode = .scaleAspectFill
        bg.clipsToBounds = true
        bg.layer.cornerRadius = 18
        bg.layer.cornerCurve = .continuous
        bg.isUserInteractionEnabled = false
        addSubview(bg)
        NativeChatImageLoader.load(imageURL, into: bg, fallback: nil)

        overlay.colors = [
            UIColor.white.withAlphaComponent(0).cgColor,
            UIColor.white.withAlphaComponent(0.35).cgColor,
            UIColor.white.withAlphaComponent(0.95).cgColor,
        ]
        overlay.locations = [0.3, 0.65, 1]
        bg.layer.addSublayer(overlay)

        let l1 = UILabel()
        l1.text = line1
        l1.font = .systemFont(ofSize: 16, weight: .bold)
        l1.textColor = UIColor(red: 0.169, green: 0.192, blue: 0.239, alpha: 1)
        let l2 = UILabel()
        l2.text = line2
        l2.font = .systemFont(ofSize: 16, weight: .bold)
        l2.textColor = UIColor(red: 0.169, green: 0.192, blue: 0.239, alpha: 1)
        let titleStack = UIStackView(arrangedSubviews: [l1, l2])
        titleStack.axis = .vertical
        titleStack.spacing = 0
        titleStack.translatesAutoresizingMaskIntoConstraints = false
        titleStack.isUserInteractionEnabled = false
        addSubview(titleStack)

        NSLayoutConstraint.activate([
            bg.topAnchor.constraint(equalTo: topAnchor),
            bg.leadingAnchor.constraint(equalTo: leadingAnchor),
            bg.trailingAnchor.constraint(equalTo: trailingAnchor),
            bg.bottomAnchor.constraint(equalTo: bottomAnchor),
            heightAnchor.constraint(equalTo: widthAnchor), // 정사각형
            titleStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
            titleStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -14),
        ])

        if showChevron {
            let chev = UIImageView(image: UIImage(systemName: "chevron.right", withConfiguration: UIImage.SymbolConfiguration(pointSize: 16, weight: .semibold)))
            chev.tintColor = UIColor(white: 0.17, alpha: 0.8)
            chev.translatesAutoresizingMaskIntoConstraints = false
            chev.isUserInteractionEnabled = false
            addSubview(chev)
            NSLayoutConstraint.activate([
                chev.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -14),
                chev.centerYAnchor.constraint(equalTo: titleStack.centerYAnchor),
            ])
        }

        addTarget(self, action: #selector(pressDown), for: [.touchDown, .touchDragEnter])
        addTarget(self, action: #selector(pressUp), for: [.touchUpInside, .touchUpOutside, .touchDragExit, .touchCancel])
        addTarget(self, action: #selector(fire), for: .touchUpInside)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() {
        super.layoutSubviews()
        overlay.frame = bg.bounds
    }

    @objc private func pressDown() {
        UIView.animate(withDuration: 0.18, delay: 0, usingSpringWithDamping: 0.7, initialSpringVelocity: 0.4) {
            self.transform = CGAffineTransform(scaleX: 0.96, y: 0.96)
        }
    }
    @objc private func pressUp() {
        UIView.animate(withDuration: 0.3, delay: 0, usingSpringWithDamping: 0.65, initialSpringVelocity: 0.5) {
            self.transform = .identity
        }
    }
    @objc private func fire() { Haptics.tap(); onTap?() }
}
