import UIKit

protocol NativeChatListBarDelegate: AnyObject {
    func chatListSelectTab(_ tab: String)
    func chatListTapSearch()
    func chatListSearchChanged(_ query: String)
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
    // 검색 모드 (검색버튼 탭 → 글래스 인풋 표시, 입력 시 리스트 필터)
    private let searchWrap = GlassPill(corner: 19)
    private let searchField = UITextField()
    private let searchCancel = UIButton(type: .system)
    private var searchActive = false

    private var tabCells: [(tab: String, button: UIButton, tint: UIView)] = []
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

        // 검색 인풋 (기본 숨김 — 검색버튼 탭 시 타이틀 자리에 표시)
        let mag = UIImageView(image: UIImage(systemName: "magnifyingglass", withConfiguration: UIImage.SymbolConfiguration(pointSize: 13, weight: .semibold)))
        mag.tintColor = UIColor(white: 0.5, alpha: 1)
        mag.translatesAutoresizingMaskIntoConstraints = false
        searchField.placeholder = "이름·메시지 검색"
        searchField.font = .systemFont(ofSize: 15)
        searchField.textColor = UIColor(white: 0.1, alpha: 1)
        searchField.clearButtonMode = .whileEditing
        searchField.returnKeyType = .search
        searchField.autocorrectionType = .no
        searchField.translatesAutoresizingMaskIntoConstraints = false
        searchField.addTarget(self, action: #selector(searchChanged), for: .editingChanged)
        searchField.addTarget(self, action: #selector(searchDone), for: .editingDidEndOnExit)
        searchWrap.contentView.addSubview(mag)
        searchWrap.contentView.addSubview(searchField)
        searchWrap.isHidden = true
        addSubview(searchWrap)

        var ccfg = UIButton.Configuration.plain()
        ccfg.title = "취소"
        ccfg.baseForegroundColor = UIColor(white: 0.25, alpha: 1)
        ccfg.contentInsets = NSDirectionalEdgeInsets(top: 6, leading: 8, bottom: 6, trailing: 4)
        searchCancel.configuration = ccfg
        searchCancel.titleLabel?.font = .systemFont(ofSize: 15, weight: .medium)
        searchCancel.addTarget(self, action: #selector(cancelSearch), for: .touchUpInside)
        searchCancel.isHidden = true
        searchCancel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(searchCancel)

        NSLayoutConstraint.activate([
            searchWrap.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            searchWrap.centerYAnchor.constraint(equalTo: titleLabel.centerYAnchor),
            searchWrap.heightAnchor.constraint(equalToConstant: 38),
            searchWrap.trailingAnchor.constraint(equalTo: searchCancel.leadingAnchor, constant: -4),
            searchCancel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            searchCancel.centerYAnchor.constraint(equalTo: titleLabel.centerYAnchor),
            mag.leadingAnchor.constraint(equalTo: searchWrap.contentView.leadingAnchor, constant: 12),
            mag.centerYAnchor.constraint(equalTo: searchWrap.contentView.centerYAnchor),
            searchField.leadingAnchor.constraint(equalTo: mag.trailingAnchor, constant: 7),
            searchField.trailingAnchor.constraint(equalTo: searchWrap.contentView.trailingAnchor, constant: -10),
            searchField.topAnchor.constraint(equalTo: searchWrap.contentView.topAnchor),
            searchField.bottomAnchor.constraint(equalTo: searchWrap.contentView.bottomAnchor),
        ])

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

    func setTitle(_ t: String) { titleLabel.text = t }
    func setSearchHidden(_ hidden: Bool) { searchPill.isHidden = hidden }

    func configure(tabs: [String], selected: String) {
        if tabCells.map({ $0.tab }) != tabs {
            tabsRow.arrangedSubviews.forEach { $0.removeFromSuperview() }
            tabCells = tabs.map { tab in
                // 각 탭 = 네이티브 글래스 캡슐
                let pill = GlassPill(corner: 16)
                let tint = UIView()
                tint.translatesAutoresizingMaskIntoConstraints = false
                tint.backgroundColor = UIColor(white: 0.1, alpha: 1)
                tint.alpha = 0
                tint.isUserInteractionEnabled = false
                let b = UIButton(type: .system)
                b.translatesAutoresizingMaskIntoConstraints = false
                b.setTitle(tab, for: .normal)
                b.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
                b.addTarget(self, action: #selector(tapTab(_:)), for: .touchUpInside)
                pill.contentView.addSubview(tint)
                pill.contentView.addSubview(b)
                NSLayoutConstraint.activate([
                    tint.topAnchor.constraint(equalTo: pill.contentView.topAnchor),
                    tint.leadingAnchor.constraint(equalTo: pill.contentView.leadingAnchor),
                    tint.trailingAnchor.constraint(equalTo: pill.contentView.trailingAnchor),
                    tint.bottomAnchor.constraint(equalTo: pill.contentView.bottomAnchor),
                    b.topAnchor.constraint(equalTo: pill.contentView.topAnchor, constant: 7),
                    b.bottomAnchor.constraint(equalTo: pill.contentView.bottomAnchor, constant: -7),
                    b.leadingAnchor.constraint(equalTo: pill.contentView.leadingAnchor, constant: 16),
                    b.trailingAnchor.constraint(equalTo: pill.contentView.trailingAnchor, constant: -16),
                ])
                tabsRow.addArrangedSubview(pill)
                return (tab, b, tint)
            }
        }
        selectedTab = selected
        updateTabStyles(animated: false)
    }

    private func updateTabStyles(animated: Bool) {
        let apply = {
            for (tab, b, tint) in self.tabCells {
                let on = tab == self.selectedTab
                tint.alpha = on ? 1 : 0
                b.setTitleColor(on ? .white : UIColor(white: 0.28, alpha: 1), for: .normal)
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

    @objc private func tapSearch() {
        Haptics.tap()
        setSearchActive(!searchActive)
    }
    private func setSearchActive(_ on: Bool) {
        searchActive = on
        searchWrap.isHidden = !on
        searchCancel.isHidden = !on
        titleLabel.isHidden = on
        searchPill.isHidden = on
        if on {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { self.searchField.becomeFirstResponder() }
        } else {
            searchField.text = ""
            searchField.resignFirstResponder()
            delegate?.chatListSearchChanged("")
        }
    }
    @objc private func cancelSearch() { Haptics.tap(); setSearchActive(false) }
    @objc private func searchChanged() { delegate?.chatListSearchChanged(searchField.text ?? "") }
    @objc private func searchDone() { searchField.resignFirstResponder() }
    func exitSearch() { if searchActive { setSearchActive(false) } }
}
