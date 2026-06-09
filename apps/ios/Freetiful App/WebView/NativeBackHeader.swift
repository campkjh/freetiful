import UIKit

protocol NativeBackHeaderDelegate: AnyObject {
    func backHeaderTapBack()
    func backHeaderTapShare()
}

// 상세화면 백헤더 — 히어로 위에선 투명(글래스 버튼만), 스크롤로 히어로를 가리면 글래스 바가 페이드인 + 중앙 타이틀
final class NativeBackHeader: UIView {
    weak var delegate: NativeBackHeaderDelegate?

    private let glassBg = UIVisualEffectView(effect: LiquidGlassEffectFactory.navigationEffect())
    private let bottomBorder = UIView()
    private let backPill = GlassPill(corner: 19)
    private let backButton = UIButton(type: .system)
    private let sharePill = GlassPill(corner: 19)
    private let shareButton = UIButton(type: .system)
    private let searchPill = GlassPill(corner: 19)
    private let searchButton = UIButton(type: .system)
    var onSearch: (() -> Void)?
    private let titleLabel = UILabel()

    var titleTopAnchorRef: NSLayoutYAxisAnchor { backPill.topAnchor }

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .clear

        // 글래스 배경 (그라데이션 마스크 없음 — 스크롤 진행도로 alpha 제어)
        glassBg.translatesAutoresizingMaskIntoConstraints = false
        glassBg.alpha = 0
        glassBg.isUserInteractionEnabled = false
        addSubview(glassBg)

        bottomBorder.translatesAutoresizingMaskIntoConstraints = false
        bottomBorder.backgroundColor = UIColor(white: 0.86, alpha: 1)
        bottomBorder.alpha = 0
        addSubview(bottomBorder)

        // 뒤로
        var bcfg = UIButton.Configuration.plain()
        bcfg.image = UIImage(systemName: "chevron.left", withConfiguration: UIImage.SymbolConfiguration(pointSize: 17, weight: .semibold))
        bcfg.baseForegroundColor = UIColor(white: 0.2, alpha: 1)
        backButton.configuration = bcfg
        backButton.addTarget(self, action: #selector(tapBack), for: .touchUpInside)
        backPill.setContent(backButton)
        addSubview(backPill)

        // 공유
        var scfg = UIButton.Configuration.plain()
        scfg.image = UIImage(systemName: "square.and.arrow.up", withConfiguration: UIImage.SymbolConfiguration(pointSize: 16, weight: .semibold))
        scfg.baseForegroundColor = UIColor(white: 0.2, alpha: 1)
        shareButton.configuration = scfg
        shareButton.addTarget(self, action: #selector(tapShare), for: .touchUpInside)
        sharePill.setContent(shareButton)
        addSubview(sharePill)

        // 검색 (웨딩파트너 리스트)
        var sccfg = UIButton.Configuration.plain()
        sccfg.image = UIImage(systemName: "magnifyingglass", withConfiguration: UIImage.SymbolConfiguration(pointSize: 16, weight: .semibold))
        sccfg.baseForegroundColor = UIColor(white: 0.2, alpha: 1)
        searchButton.configuration = sccfg
        searchButton.addTarget(self, action: #selector(tapSearch), for: .touchUpInside)
        searchPill.setContent(searchButton)
        searchPill.isHidden = true
        addSubview(searchPill)

        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.font = .systemFont(ofSize: 17, weight: .bold)
        titleLabel.textColor = UIColor(white: 0.1, alpha: 1)
        titleLabel.textAlignment = .center
        titleLabel.lineBreakMode = .byTruncatingTail
        titleLabel.alpha = 0
        addSubview(titleLabel)

        NSLayoutConstraint.activate([
            glassBg.topAnchor.constraint(equalTo: topAnchor),
            glassBg.leadingAnchor.constraint(equalTo: leadingAnchor),
            glassBg.trailingAnchor.constraint(equalTo: trailingAnchor),
            glassBg.bottomAnchor.constraint(equalTo: bottomAnchor),
            bottomBorder.leadingAnchor.constraint(equalTo: leadingAnchor),
            bottomBorder.trailingAnchor.constraint(equalTo: trailingAnchor),
            bottomBorder.bottomAnchor.constraint(equalTo: bottomAnchor),
            bottomBorder.heightAnchor.constraint(equalToConstant: 0.5),
            backPill.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            backPill.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
            backPill.widthAnchor.constraint(equalToConstant: 38),
            backPill.heightAnchor.constraint(equalToConstant: 38),
            sharePill.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            sharePill.centerYAnchor.constraint(equalTo: backPill.centerYAnchor),
            sharePill.widthAnchor.constraint(equalToConstant: 38),
            sharePill.heightAnchor.constraint(equalToConstant: 38),
            searchPill.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            searchPill.centerYAnchor.constraint(equalTo: backPill.centerYAnchor),
            searchPill.widthAnchor.constraint(equalToConstant: 38),
            searchPill.heightAnchor.constraint(equalToConstant: 38),
            titleLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: backPill.centerYAnchor),
            titleLabel.leadingAnchor.constraint(greaterThanOrEqualTo: backPill.trailingAnchor, constant: 8),
            titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: sharePill.leadingAnchor, constant: -8),
        ])
    }

    func setTitle(_ t: String) { titleLabel.text = t }

    // 스크롤 진행도(0 = 히어로 위 투명, 1 = 히어로 가림 글래스)
    func setGlassProgress(_ p: CGFloat) {
        let c = max(0, min(1, p))
        glassBg.alpha = c
        bottomBorder.alpha = c
        titleLabel.alpha = c
    }
    func setShareVisible(_ v: Bool) { sharePill.isHidden = !v }
    func setSearchVisible(_ v: Bool) { searchPill.isHidden = !v }

    @objc private func tapBack() { Haptics.tap(); delegate?.backHeaderTapBack() }
    @objc private func tapShare() { Haptics.tap(); delegate?.backHeaderTapShare() }
    @objc private func tapSearch() { Haptics.tap(); onSearch?() }
}
