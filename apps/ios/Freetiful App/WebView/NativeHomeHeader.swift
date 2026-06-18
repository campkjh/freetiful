import UIKit

protocol NativeHomeHeaderDelegate: AnyObject {
    func homeHeaderTapSearch()
    func homeHeaderTapBell()
}

// 홈 네이티브 글래스 헤더 — 로고 + 글래스 검색바 + 글래스 알림벨 (위 흐림→아래 선명 그라데이션 블러)
final class NativeHomeHeader: UIView {
    weak var delegate: NativeHomeHeaderDelegate?

    // 블러는 NativeHomeContent.topBlur(헤더+탭 통합 그라데이션 블러)가 담당 → 헤더는 투명 오버레이
    private let logo = UIImageView()
    private let searchPill = GlassPill(corner: 21)
    private let searchButton = UIButton(type: .system)
    private let bellPill = GlassPill(corner: 21)
    private let bellButton = UIButton(type: .system)
    private let unreadDot = UIView()

    var titleTopAnchorRef: NSLayoutYAxisAnchor { searchPill.topAnchor }

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .clear

        logo.translatesAutoresizingMaskIntoConstraints = false
        logo.image = UIImage(named: "logo-wordmark")?.withRenderingMode(.alwaysOriginal)
        logo.contentMode = .scaleAspectFit
        logo.setContentHuggingPriority(.required, for: .horizontal)
        addSubview(logo)

        var searchCfg = UIButton.Configuration.plain()
        searchCfg.image = UIImage(systemName: "magnifyingglass", withConfiguration: UIImage.SymbolConfiguration(pointSize: 15, weight: .semibold))
        searchCfg.imagePadding = 8
        searchCfg.baseForegroundColor = UIColor(white: 0.6, alpha: 1)
        searchCfg.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 14, bottom: 0, trailing: 14)
        var attr = AttributedString("어떤 사회자를 찾으시나요?")
        attr.font = .systemFont(ofSize: 15, weight: .medium)
        searchCfg.attributedTitle = attr
        searchButton.configuration = searchCfg
        searchButton.contentHorizontalAlignment = .leading
        searchButton.addTarget(self, action: #selector(tapSearch), for: .touchUpInside)
        searchPill.setContent(searchButton)
        addSubview(searchPill)

        var bellCfg = UIButton.Configuration.plain()
        bellCfg.image = UIImage(systemName: "bell.fill", withConfiguration: UIImage.SymbolConfiguration(pointSize: 17, weight: .semibold))
        bellCfg.baseForegroundColor = UIColor(white: 0.25, alpha: 1)
        bellButton.configuration = bellCfg
        bellButton.addTarget(self, action: #selector(tapBell), for: .touchUpInside)
        bellPill.setContent(bellButton)
        addSubview(bellPill)

        unreadDot.translatesAutoresizingMaskIntoConstraints = false
        unreadDot.backgroundColor = UIColor(red: 0.192, green: 0.502, blue: 0.969, alpha: 1)
        unreadDot.layer.cornerRadius = 4
        unreadDot.layer.borderWidth = 1.5
        unreadDot.layer.borderColor = UIColor.white.cgColor
        unreadDot.isHidden = true
        bellPill.contentView.addSubview(unreadDot)

        NSLayoutConstraint.activate([
            logo.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
            logo.centerYAnchor.constraint(equalTo: searchPill.centerYAnchor),
            logo.heightAnchor.constraint(equalToConstant: 22),
            logo.widthAnchor.constraint(equalToConstant: 78),

            searchPill.leadingAnchor.constraint(equalTo: logo.trailingAnchor, constant: 10),
            searchPill.trailingAnchor.constraint(equalTo: bellPill.leadingAnchor, constant: -8),
            searchPill.heightAnchor.constraint(equalToConstant: 42),
            searchPill.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -10),

            bellPill.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -14),
            bellPill.centerYAnchor.constraint(equalTo: searchPill.centerYAnchor),
            bellPill.widthAnchor.constraint(equalToConstant: 42),
            bellPill.heightAnchor.constraint(equalToConstant: 42),

            unreadDot.widthAnchor.constraint(equalToConstant: 8),
            unreadDot.heightAnchor.constraint(equalToConstant: 8),
            unreadDot.topAnchor.constraint(equalTo: bellPill.contentView.topAnchor, constant: 9),
            unreadDot.trailingAnchor.constraint(equalTo: bellPill.contentView.trailingAnchor, constant: -10),
        ])
    }

    func setUnread(_ hasUnread: Bool) { unreadDot.isHidden = !hasUnread }

    @objc private func tapSearch() { Haptics.tap(); delegate?.homeHeaderTapSearch() }
    @objc private func tapBell() { Haptics.tap(); delegate?.homeHeaderTapBell() }
}
