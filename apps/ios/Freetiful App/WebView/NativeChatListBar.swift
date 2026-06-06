import UIKit

protocol NativeChatListBarDelegate: AnyObject {
    func chatListSelectTab(_ tab: String)
    func chatListTapSearch()
}

// 채팅 리스트 상단 고정 바 — "채팅" 헤더 + 글래스 탭 + 위가 가장 흐리고 아래로 선명해지는 그라데이션 블러
final class NativeChatListBar: UIView {
    weak var delegate: NativeChatListBarDelegate?

    private let blur = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterial))
    private let blurMask = CAGradientLayer()
    private let tintHost = UIView()
    private let tintGradient = CAGradientLayer()

    private let titleLabel = UILabel()
    private let searchPill = GlassPill(corner: 19)
    private let searchButton = UIButton(type: .system)
    private let tabsRow = UIStackView()

    private var tabButtons: [(tab: String, button: UIButton)] = []
    private var selectedTab = "전체"
    private let activeColor = UIColor(white: 0.1, alpha: 1)

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .clear

        // 그라데이션 블러: 위(불투명=블러 강함) → 아래(투명=블러 없음)
        blur.translatesAutoresizingMaskIntoConstraints = false
        blurMask.colors = [
            UIColor(white: 1, alpha: 1).cgColor,
            UIColor(white: 1, alpha: 1).cgColor,
            UIColor(white: 1, alpha: 0).cgColor,
        ]
        blurMask.locations = [0, 0.5, 1]
        blur.layer.mask = blurMask
        addSubview(blur)

        // 가독성용 흰색 틴트(위 진함 → 아래 투명)
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
        titleLabel.text = "채팅"
        titleLabel.font = .systemFont(ofSize: 24, weight: .bold)
        titleLabel.textColor = UIColor(white: 0.07, alpha: 1)
        addSubview(titleLabel)

        var searchCfg = UIButton.Configuration.plain()
        searchCfg.image = UIImage(systemName: "magnifyingglass", withConfiguration: UIImage.SymbolConfiguration(pointSize: 17, weight: .semibold))
        searchCfg.baseForegroundColor = UIColor(white: 0.13, alpha: 1)
        searchButton.configuration = searchCfg
        searchButton.addTarget(self, action: #selector(tapSearch), for: .touchUpInside)
        searchPill.setContent(searchButton)
        addSubview(searchPill)

        tabsRow.translatesAutoresizingMaskIntoConstraints = false
        tabsRow.axis = .horizontal
        tabsRow.alignment = .center
        tabsRow.spacing = 8
        addSubview(tabsRow)

        NSLayoutConstraint.activate([
            blur.topAnchor.constraint(equalTo: topAnchor),
            blur.leadingAnchor.constraint(equalTo: leadingAnchor),
            blur.trailingAnchor.constraint(equalTo: trailingAnchor),
            blur.bottomAnchor.constraint(equalTo: bottomAnchor),
            tintHost.topAnchor.constraint(equalTo: topAnchor),
            tintHost.leadingAnchor.constraint(equalTo: leadingAnchor),
            tintHost.trailingAnchor.constraint(equalTo: trailingAnchor),
            tintHost.bottomAnchor.constraint(equalTo: bottomAnchor),

            searchPill.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            searchPill.centerYAnchor.constraint(equalTo: titleLabel.centerYAnchor),
            searchPill.widthAnchor.constraint(equalToConstant: 38),
            searchPill.heightAnchor.constraint(equalToConstant: 38),

            titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 18),
            titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: searchPill.leadingAnchor, constant: -8),

            tabsRow.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            tabsRow.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 10),
            tabsRow.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -10),
        ])
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        blurMask.frame = blur.bounds
        tintGradient.frame = tintHost.bounds
    }

    // titleLabel 의 top 은 외부(safe area)에서 잡도록 노출
    var titleTopAnchorRef: NSLayoutYAxisAnchor { titleLabel.topAnchor }

    func configure(tabs: [String], selected: String) {
        if tabButtons.map({ $0.tab }) != tabs {
            tabButtons.forEach { $0.button.removeFromSuperview() }
            tabsRow.arrangedSubviews.forEach { $0.removeFromSuperview() }
            tabButtons = tabs.map { tab in
                let b = UIButton(type: .system)
                b.translatesAutoresizingMaskIntoConstraints = false
                b.setTitle(tab, for: .normal)
                b.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
                b.layer.cornerRadius = 16
                b.layer.cornerCurve = .continuous
                b.contentEdgeInsets = UIEdgeInsets(top: 7, left: 15, bottom: 7, right: 15)
                b.addTarget(self, action: #selector(tapTab(_:)), for: .touchUpInside)
                tabsRow.addArrangedSubview(b)
                return (tab, b)
            }
        }
        selectedTab = selected
        updateTabStyles(animated: false)
    }

    private func updateTabStyles(animated: Bool) {
        let apply = {
            for (tab, b) in self.tabButtons {
                let on = tab == self.selectedTab
                b.backgroundColor = on ? UIColor(white: 0.1, alpha: 1) : UIColor(white: 0.55, alpha: 0.14)
                b.setTitleColor(on ? .white : UIColor(white: 0.35, alpha: 1), for: .normal)
            }
        }
        if animated { UIView.animate(withDuration: 0.2, animations: apply) } else { apply() }
    }

    @objc private func tapTab(_ sender: UIButton) {
        guard let title = sender.title(for: .normal) else { return }
        selectedTab = title
        updateTabStyles(animated: true)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        delegate?.chatListSelectTab(title)
    }

    @objc private func tapSearch() { delegate?.chatListTapSearch() }
}
