import UIKit

// 재사용 글래스 헤더 — 그라데이션 블러(위 흐림 → 아래 선명) + 타이틀. (마이페이지/홈 등)
final class NativeSimpleGlassHeader: UIView {
    private let blur = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterial))
    private let blurMask = CAGradientLayer()
    private let tintHost = UIView()
    private let tintGradient = CAGradientLayer()
    private let titleLabel = UILabel()

    var titleTopAnchorRef: NSLayoutYAxisAnchor { titleLabel.topAnchor }

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
        blurMask.locations = [0, 0.5, 1]
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

        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.font = .systemFont(ofSize: 24, weight: .bold)
        titleLabel.textColor = UIColor(white: 0.07, alpha: 1)
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
            titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 18),
            titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -16),
            titleLabel.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12),
        ])
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        blurMask.frame = blur.bounds
        tintGradient.frame = tintHost.bounds
    }

    func setTitle(_ t: String) { titleLabel.text = t }
}
