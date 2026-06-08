import UIKit

protocol NativeHelpDelegate: AnyObject {
    func helpDidTapPolicy(_ slug: String)
}

// 고객센터 네이티브 — 글래스 탭(자주 묻는 질문 / 공지사항 / 약관·정책) + 네이티브 콘텐츠
final class NativeHelpContent: UIView {
    weak var delegate: NativeHelpDelegate?

    private let tabBar = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterial))
    private let tabStack = UIStackView()
    private var tabButtons: [UIButton] = []
    private let indicator = UIView()
    private var indicatorLeading: NSLayoutConstraint!
    private var indicatorWidth: NSLayoutConstraint!

    private let scrolls: [UIScrollView] = [UIScrollView(), UIScrollView(), UIScrollView()]
    private let stacks: [UIStackView] = [UIStackView(), UIStackView(), UIStackView()]
    private let loadings: [UILabel] = [UILabel(), UILabel(), UILabel()]
    private var tabTop: NSLayoutConstraint!

    private var current = 0
    private var loaded = [false, false, false]
    private let titles = ["자주 묻는 질문", "공지사항", "약관·정책"]
    private static let base = "https://freetiful.com/api/v1"

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setInsets(top: CGFloat, bottom: CGFloat) {
        tabTop?.constant = top
        for s in scrolls {
            s.contentInset = UIEdgeInsets(top: 0, left: 0, bottom: bottom, right: 0)
            s.verticalScrollIndicatorInsets = UIEdgeInsets(top: 0, left: 0, bottom: bottom, right: 0)
        }
    }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = UIColor(red: 0.969, green: 0.973, blue: 0.980, alpha: 1)

        // 글래스 탭바
        tabBar.translatesAutoresizingMaskIntoConstraints = false
        tabBar.layer.cornerRadius = 16
        tabBar.layer.cornerCurve = .continuous
        tabBar.clipsToBounds = true
        tabBar.layer.borderWidth = 1
        tabBar.layer.borderColor = UIColor.white.withAlphaComponent(0.45).cgColor
        addSubview(tabBar)

        indicator.translatesAutoresizingMaskIntoConstraints = false
        indicator.backgroundColor = .white
        indicator.layer.cornerRadius = 12
        indicator.layer.cornerCurve = .continuous
        indicator.layer.shadowColor = UIColor.black.cgColor
        indicator.layer.shadowOpacity = 0.08
        indicator.layer.shadowRadius = 6
        indicator.layer.shadowOffset = CGSize(width: 0, height: 2)
        tabBar.contentView.addSubview(indicator)

        tabStack.axis = .horizontal
        tabStack.distribution = .fillEqually
        tabStack.translatesAutoresizingMaskIntoConstraints = false
        tabBar.contentView.addSubview(tabStack)
        for (i, t) in titles.enumerated() {
            let b = UIButton(type: .system)
            b.setTitle(t, for: .normal)
            b.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
            b.setTitleColor(i == 0 ? UIColor(white: 0.1, alpha: 1) : UIColor(white: 0.5, alpha: 1), for: .normal)
            b.tag = i
            b.addTarget(self, action: #selector(tabTapped(_:)), for: .touchUpInside)
            tabButtons.append(b)
            tabStack.addArrangedSubview(b)
        }

        // 콘텐츠 스크롤 3개
        for (i, s) in scrolls.enumerated() {
            s.translatesAutoresizingMaskIntoConstraints = false
            s.alwaysBounceVertical = true
            s.showsVerticalScrollIndicator = false
            s.contentInsetAdjustmentBehavior = .never
            s.isHidden = i != 0
            addSubview(s)
            let st = stacks[i]
            st.axis = .vertical
            st.spacing = 10
            st.translatesAutoresizingMaskIntoConstraints = false
            s.addSubview(st)
            let ld = loadings[i]
            ld.text = "불러오는 중…"
            ld.font = .systemFont(ofSize: 14)
            ld.textColor = UIColor(white: 0.6, alpha: 1)
            ld.textAlignment = .center
            ld.translatesAutoresizingMaskIntoConstraints = false
            s.addSubview(ld)
            NSLayoutConstraint.activate([
                s.topAnchor.constraint(equalTo: tabBar.bottomAnchor, constant: 12),
                s.leadingAnchor.constraint(equalTo: leadingAnchor),
                s.trailingAnchor.constraint(equalTo: trailingAnchor),
                s.bottomAnchor.constraint(equalTo: bottomAnchor),
                st.topAnchor.constraint(equalTo: s.contentLayoutGuide.topAnchor, constant: 6),
                st.leadingAnchor.constraint(equalTo: s.frameLayoutGuide.leadingAnchor, constant: 16),
                st.trailingAnchor.constraint(equalTo: s.frameLayoutGuide.trailingAnchor, constant: -16),
                st.bottomAnchor.constraint(equalTo: s.contentLayoutGuide.bottomAnchor, constant: -24),
                ld.topAnchor.constraint(equalTo: s.topAnchor, constant: 60),
                ld.centerXAnchor.constraint(equalTo: centerXAnchor),
            ])
        }

        tabTop = tabBar.topAnchor.constraint(equalTo: topAnchor, constant: 0)
        indicatorLeading = indicator.leadingAnchor.constraint(equalTo: tabBar.contentView.leadingAnchor, constant: 4)
        indicatorWidth = indicator.widthAnchor.constraint(equalToConstant: 100)
        NSLayoutConstraint.activate([
            tabTop,
            tabBar.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            tabBar.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            tabBar.heightAnchor.constraint(equalToConstant: 44),
            tabStack.topAnchor.constraint(equalTo: tabBar.contentView.topAnchor),
            tabStack.bottomAnchor.constraint(equalTo: tabBar.contentView.bottomAnchor),
            tabStack.leadingAnchor.constraint(equalTo: tabBar.contentView.leadingAnchor),
            tabStack.trailingAnchor.constraint(equalTo: tabBar.contentView.trailingAnchor),
            indicator.topAnchor.constraint(equalTo: tabBar.contentView.topAnchor, constant: 4),
            indicator.bottomAnchor.constraint(equalTo: tabBar.contentView.bottomAnchor, constant: -4),
            indicatorLeading, indicatorWidth,
        ])
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        updateIndicator(animated: false)
    }

    private func updateIndicator(animated: Bool) {
        guard tabBar.bounds.width > 0 else { return }
        let w = (tabBar.bounds.width - 8) / CGFloat(titles.count)
        indicatorWidth.constant = w
        indicatorLeading.constant = 4 + w * CGFloat(current)
        if animated { UIView.animate(withDuration: 0.22) { self.layoutIfNeeded() } }
    }

    @objc private func tabTapped(_ b: UIButton) { setTab(b.tag) }

    func setTab(_ index: Int) {
        guard index >= 0, index < titles.count else { return }
        current = index
        for (i, b) in tabButtons.enumerated() {
            b.setTitleColor(i == index ? UIColor(white: 0.1, alpha: 1) : UIColor(white: 0.5, alpha: 1), for: .normal)
        }
        for (i, s) in scrolls.enumerated() { s.isHidden = i != index }
        updateIndicator(animated: true)
        loadTab(index)
    }

    func loadIfNeeded() { loadTab(current) }

    // MARK: - 로드
    private func loadTab(_ index: Int) {
        if loaded[index] { return }
        loaded[index] = true
        switch index {
        case 0: fetchJSON("\(Self.base)/faqs") { [weak self] arr in self?.renderFaqs(arr) }
        case 1: fetchJSON("\(Self.base)/announcements") { [weak self] arr in self?.renderAnnouncements(arr) }
        default: fetchJSON("\(Self.base)/policies") { [weak self] arr in self?.renderPolicies(arr) }
        }
    }

    private func fetchJSON(_ urlStr: String, _ done: @escaping ([[String: Any]]) -> Void) {
        guard let url = URL(string: urlStr) else { done([]); return }
        var req = URLRequest(url: url)
        req.timeoutInterval = 30
        req.cachePolicy = .reloadIgnoringLocalCacheData
        URLSession.shared.dataTask(with: req) { data, _, _ in
            var arr: [[String: Any]] = []
            if let data = data, let obj = try? JSONSerialization.jsonObject(with: data) {
                if let a = obj as? [[String: Any]] { arr = a }
                else if let d = obj as? [String: Any], let a = (d["data"] as? [[String: Any]]) ?? (d["items"] as? [[String: Any]]) { arr = a }
            }
            DispatchQueue.main.async { done(arr) }
        }.resume()
    }

    private func renderFaqs(_ arr: [[String: Any]]) {
        let st = stacks[0]; loadings[0].isHidden = true
        st.arrangedSubviews.forEach { $0.removeFromSuperview() }
        let pub = arr.filter { ($0["isPublished"] as? Bool) ?? true }
        var byCat: [String: [[String: Any]]] = [:]
        var order: [String] = []
        for f in pub {
            let c = (f["category"] as? String) ?? "기타"
            if byCat[c] == nil { byCat[c] = []; order.append(c) }
            byCat[c]?.append(f)
        }
        if pub.isEmpty { loadings[0].isHidden = false; loadings[0].text = "등록된 FAQ가 없습니다"; return }
        for c in order {
            st.addArrangedSubview(sectionHeader(c))
            for f in byCat[c] ?? [] {
                st.addArrangedSubview(ExpandableCard(title: (f["question"] as? String) ?? "", body: (f["answer"] as? String) ?? ""))
            }
        }
    }

    private func renderAnnouncements(_ arr: [[String: Any]]) {
        let st = stacks[1]; loadings[1].isHidden = true
        st.arrangedSubviews.forEach { $0.removeFromSuperview() }
        let pub = arr.filter { ($0["isPublished"] as? Bool) ?? true }
        if pub.isEmpty { loadings[1].isHidden = false; loadings[1].text = "등록된 공지가 없습니다"; return }
        for a in pub {
            let tag = (a["tag"] as? String) ?? ""
            let date = shortDate((a["publishedAt"] as? String) ?? (a["createdAt"] as? String) ?? "")
            st.addArrangedSubview(ExpandableCard(title: (a["title"] as? String) ?? "", body: (a["content"] as? String) ?? "", badge: tag, date: date))
        }
    }

    private func renderPolicies(_ arr: [[String: Any]]) {
        let st = stacks[2]; loadings[2].isHidden = true
        st.arrangedSubviews.forEach { $0.removeFromSuperview() }
        var items = arr.compactMap { d -> (String, String)? in
            guard let slug = d["slug"] as? String, let title = d["title"] as? String else { return nil }
            return (slug, title)
        }
        if items.isEmpty {
            // 폴백 (정적)
            items = [("service", "서비스 이용약관"), ("privacy", "개인정보 수집 및 이용약관"),
                     ("third-party", "개인정보 제3자 제공 동의서"), ("electronic-finance", "전자금융거래 이용약관"),
                     ("marketing", "마케팅 정보 수신 동의"), ("meta-ads", "META 광고 데이터 처리 약관")]
        }
        for (slug, title) in items {
            let row = PolicyRow(title: title)
            row.onTap = { [weak self] in self?.delegate?.helpDidTapPolicy(slug) }
            st.addArrangedSubview(row)
        }
    }

    // MARK: - 헬퍼
    private func sectionHeader(_ t: String) -> UILabel {
        let l = PaddingLabel4()
        l.text = t
        l.font = .systemFont(ofSize: 13, weight: .heavy)
        l.textColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
        l.textInsets = UIEdgeInsets(top: 8, left: 2, bottom: 0, right: 2)
        return l
    }
    private func shortDate(_ iso: String) -> String {
        guard iso.count >= 10 else { return "" }
        let p = iso.prefix(10).split(separator: "-")
        guard p.count == 3 else { return "" }
        return "\(p[0]).\(p[1]).\(p[2])"
    }
}

// 펼침 카드 (FAQ/공지 — 질문/제목 탭하면 답변/내용 펼침)
final class ExpandableCard: UIView {
    private let bodyLabel = UILabel()
    private var bodyHeight: NSLayoutConstraint!
    private let chevron = UIImageView(image: UIImage(systemName: "chevron.down"))
    private var expanded = false

    init(title: String, body: String, badge: String = "", date: String = "") {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .white
        layer.cornerRadius = 14
        layer.cornerCurve = .continuous

        let titleLabel = UILabel()
        titleLabel.text = title
        titleLabel.font = .systemFont(ofSize: 15, weight: .semibold)
        titleLabel.textColor = UIColor(white: 0.13, alpha: 1)
        titleLabel.numberOfLines = 0

        chevron.tintColor = UIColor(white: 0.6, alpha: 1)
        chevron.contentMode = .scaleAspectFit
        chevron.translatesAutoresizingMaskIntoConstraints = false
        chevron.setContentHuggingPriority(.required, for: .horizontal)

        let topRow = UIStackView(arrangedSubviews: [titleLabel, chevron])
        topRow.axis = .horizontal; topRow.spacing = 10; topRow.alignment = .center
        topRow.translatesAutoresizingMaskIntoConstraints = false

        bodyLabel.text = body.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
        bodyLabel.font = .systemFont(ofSize: 14)
        bodyLabel.textColor = UIColor(white: 0.4, alpha: 1)
        bodyLabel.numberOfLines = 0
        bodyLabel.translatesAutoresizingMaskIntoConstraints = false
        bodyLabel.clipsToBounds = true

        addSubview(topRow)
        addSubview(bodyLabel)

        var topRowTop: CGFloat = 16
        if !badge.isEmpty || !date.isEmpty {
            let meta = UILabel()
            let parts = [badge, date].filter { !$0.isEmpty }
            meta.text = parts.joined(separator: " · ")
            meta.font = .systemFont(ofSize: 11.5, weight: .medium)
            meta.textColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
            meta.translatesAutoresizingMaskIntoConstraints = false
            addSubview(meta)
            NSLayoutConstraint.activate([
                meta.topAnchor.constraint(equalTo: topAnchor, constant: 12),
                meta.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            ])
            topRowTop = 32
        }

        chevron.widthAnchor.constraint(equalToConstant: 14).isActive = true
        bodyHeight = bodyLabel.heightAnchor.constraint(equalToConstant: 0)
        NSLayoutConstraint.activate([
            topRow.topAnchor.constraint(equalTo: topAnchor, constant: topRowTop),
            topRow.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            topRow.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            bodyLabel.topAnchor.constraint(equalTo: topRow.bottomAnchor, constant: 8),
            bodyLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            bodyLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            bodyLabel.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -16),
            bodyHeight,
        ])
        addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(toggle)))
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    @objc private func toggle() {
        expanded.toggle()
        bodyHeight.isActive = !expanded
        chevron.image = UIImage(systemName: expanded ? "chevron.up" : "chevron.down")
        Haptics.tap()
        if let sv = superview?.superview { UIView.animate(withDuration: 0.22) { sv.layoutIfNeeded() } }
    }
}

// 약관 행 (탭 → 웹 상세)
final class PolicyRow: UIControl {
    var onTap: (() -> Void)?
    init(title: String) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .white
        layer.cornerRadius = 14
        layer.cornerCurve = .continuous
        let label = UILabel()
        label.text = title
        label.font = .systemFont(ofSize: 15, weight: .medium)
        label.textColor = UIColor(white: 0.15, alpha: 1)
        label.translatesAutoresizingMaskIntoConstraints = false
        let chevron = UIImageView(image: UIImage(systemName: "chevron.right"))
        chevron.tintColor = UIColor(white: 0.7, alpha: 1)
        chevron.translatesAutoresizingMaskIntoConstraints = false
        addSubview(label); addSubview(chevron)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(equalToConstant: 54),
            label.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            label.centerYAnchor.constraint(equalTo: centerYAnchor),
            chevron.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            chevron.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
        addTarget(self, action: #selector(tapped), for: .touchUpInside)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    @objc private func tapped() { Haptics.tap(); onTap?() }
}

final class PaddingLabel4: UILabel {
    var textInsets = UIEdgeInsets.zero
    override func drawText(in rect: CGRect) { super.drawText(in: rect.inset(by: textInsets)) }
    override var intrinsicContentSize: CGSize {
        let s = super.intrinsicContentSize
        return CGSize(width: s.width + textInsets.left + textInsets.right, height: s.height + textInsets.top + textInsets.bottom)
    }
}
