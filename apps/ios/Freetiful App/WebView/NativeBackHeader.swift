import UIKit

protocol NativeBackHeaderDelegate: AnyObject {
    func backHeaderTapBack()
}

// 상세화면용 글래스 백헤더 — 그라데이션 블러(위 흐림→아래 선명) + 글래스 뒤로가기 버튼 + 중앙 타이틀
final class NativeBackHeader: UIView {
    weak var delegate: NativeBackHeaderDelegate?

    private let blur = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterial))
    private let blurMask = CAGradientLayer()
    private let tintHost = UIView()
    private let tintGradient = CAGradientLayer()
    private let backPill = GlassPill(corner: 19)
    private let backButton = UIButton(type: .system)
    private let titleLabel = UILabel()

    var titleTopAnchorRef: NSLayoutYAxisAnchor { backPill.topAnchor }

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .clear

        blur.translatesAutoresizingMaskIntoConstraints = false
        blurMask.colors = [
            UIColor(white: 1, alpha: 1).cgColor,
            UIColor(white: 1, alpha: 1).cgColor,
            UIColor(white: 1, alpha: 0).cgColor,
        ]
        blurMask.locations = [0, 0.55, 1]
        blur.layer.mask = blurMask
        addSubview(blur)

        tintHost.translatesAutoresizingMaskIntoConstraints = false
        tintHost.isUserInteractionEnabled = false
        tintGradient.colors = [
            UIColor(white: 1, alpha: 0.72).cgColor,
            UIColor(white: 1, alpha: 0.32).cgColor,
            UIColor(white: 1, alpha: 0).cgColor,
        ]
        tintGradient.locations = [0, 0.55, 1]
        tintHost.layer.addSublayer(tintGradient)
        addSubview(tintHost)

        var cfg = UIButton.Configuration.plain()
        cfg.image = UIImage(systemName: "chevron.left", withConfiguration: UIImage.SymbolConfiguration(pointSize: 17, weight: .semibold))
        cfg.baseForegroundColor = UIColor(white: 0.2, alpha: 1)
        backButton.configuration = cfg
        backButton.addTarget(self, action: #selector(tapBack), for: .touchUpInside)
        backPill.setContent(backButton)
        addSubview(backPill)

        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.font = .systemFont(ofSize: 17, weight: .bold)
        titleLabel.textColor = UIColor(white: 0.1, alpha: 1)
        titleLabel.textAlignment = .center
        titleLabel.lineBreakMode = .byTruncatingTail
        addSubview(titleLabel)

        NSLayoutConstraint.activate([
            blur.topAnchor.constraint(equalTo: topAnchor),
            blur.leadingAnchor.constraint(equalTo: leadingAnchor),
            blur.trailingAnchor.constraint(equalTo: trailingAnchor),
            blur.bottomAnchor.constraint(equalTo: bottomAnchor),
            tintHost.topAnchor.constraint(equalTo: topAnchor),
            tintHost.leadingAnchor.constraint(equalTo: leadingAnchor),
            tintHost.trailingAnchor.constraint(equalTo: trailingAnchor),
            tintHost.bottomAnchor.constraint(equalTo: bottomAnchor),
            backPill.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            backPill.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
            backPill.widthAnchor.constraint(equalToConstant: 38),
            backPill.heightAnchor.constraint(equalToConstant: 38),
            titleLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: backPill.centerYAnchor),
            titleLabel.leadingAnchor.constraint(greaterThanOrEqualTo: backPill.trailingAnchor, constant: 8),
            titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -50),
        ])
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        blurMask.frame = blur.bounds
        tintGradient.frame = tintHost.bounds
    }

    func setTitle(_ t: String) { titleLabel.text = t }
    @objc private func tapBack() { Haptics.tap(); delegate?.backHeaderTapBack() }
}
