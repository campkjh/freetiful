import UIKit

protocol NativeHomeContentDelegate: AnyObject {
    func homeOpenWeddingFind()
    func homeOpenEventRequest()
    func homeOpenCategory(_ category: String)
    func homeOpenPro(_ proId: String)
    func homeRequestPros(_ categoryIndex: Int)
    func homeOpenBanner(_ link: String)
}

struct HomeBanner {
    let image: String
    let link: String
}

// 홈 사회자 카드 한 행 (웹 브리지에서 카테고리별로 전달)
struct HomeProItem {
    let id: String
    let name: String
    let image: String
    let rating: Double
    let reviewCount: Int
    let intro: String
}

// 네이티브 홈 스크린 본문 (웹 홈 위에 전체 덮음) — 완성될 때까지 단계적으로 섹션 추가.
// 현재: 히어로 카드(전문결혼식/전문행사 찾기). 이후: 카테고리 탭/스와이프, 배너, 사회자 리스트.
final class NativeHomeContent: UIView, UIScrollViewDelegate {
    weak var delegate: NativeHomeContentDelegate?
    private let imageBase: String

    // 헤더 탭: 전체(=웹 홈) / 결혼식사회자 / 행사사회자 / 외국어사회자
    private let tabTitles = ["전체", "결혼식사회자", "행사사회자", "외국어사회자"]
    private let categoryCount = 3  // 결혼식/행사/외국어 (전체 제외)
    private let categoryTabs = HomeCategoryTabsView()
    private let pager = UIScrollView()
    private let pageRow = UIStackView()
    private var pageScrolls: [UIScrollView] = []   // 0=결혼식,1=행사,2=외국어
    private var pageLists: [UIStackView] = []
    private var pageEmpties: [UILabel] = []
    private var currentTab = 0   // 0=전체, 1~3=카테고리
    private var requestedPages = Set<Int>()

    private var topInset: CGFloat = 0
    private var bottomInset: CGFloat = 0
    private var tabsTop: NSLayoutConstraint!

    // 빈 영역(전체=웹 모드의 페이저 아래) 터치는 뒤의 웹뷰로 통과
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let v = super.hitTest(point, with: event)
        if v === self { return nil }
        return v
    }

    init(imageBase: String) {
        self.imageBase = imageBase
        super.init(frame: .zero)
        setup()
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    // top = 글래스 헤더 높이(탭을 헤더 바로 아래 고정), bottom = 하단 탭바 높이
    func setInsets(top: CGFloat, bottom: CGFloat) {
        topInset = top
        bottomInset = bottom
        tabsTop?.constant = top
        for s in pageScrolls {
            s.contentInset = UIEdgeInsets(top: 0, left: 0, bottom: bottom, right: 0)
            s.verticalScrollIndicatorInsets = UIEdgeInsets(top: 0, left: 0, bottom: bottom, right: 0)
        }
    }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .clear   // 전체(웹) 모드에서 뒤 웹뷰가 비치도록

        // 헤더 탭 (상단 고정 — 글래스 헤더 바로 아래)
        categoryTabs.translatesAutoresizingMaskIntoConstraints = false
        categoryTabs.backgroundColor = .white
        categoryTabs.configure(tabs: tabTitles)
        categoryTabs.onSelect = { [weak self] idx in self?.showTab(idx, animated: true) }
        addSubview(categoryTabs)
        tabsTop = categoryTabs.topAnchor.constraint(equalTo: topAnchor, constant: topInset)

        // 좌우 스와이프 페이저 (카테고리 3개) — 전체 탭에선 숨겨 웹 노출
        pager.translatesAutoresizingMaskIntoConstraints = false
        pager.isPagingEnabled = true
        pager.showsHorizontalScrollIndicator = false
        pager.delegate = self
        pager.backgroundColor = .white
        pager.contentInsetAdjustmentBehavior = .never
        pager.isHidden = true   // 기본 전체(웹)
        addSubview(pager)

        NSLayoutConstraint.activate([
            tabsTop,
            categoryTabs.leadingAnchor.constraint(equalTo: leadingAnchor),
            categoryTabs.trailingAnchor.constraint(equalTo: trailingAnchor),
            categoryTabs.heightAnchor.constraint(equalToConstant: 46),

            pager.topAnchor.constraint(equalTo: categoryTabs.bottomAnchor),
            pager.leadingAnchor.constraint(equalTo: leadingAnchor),
            pager.trailingAnchor.constraint(equalTo: trailingAnchor),
            pager.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        pageRow.axis = .horizontal
        pageRow.translatesAutoresizingMaskIntoConstraints = false
        pager.addSubview(pageRow)
        NSLayoutConstraint.activate([
            pageRow.topAnchor.constraint(equalTo: pager.contentLayoutGuide.topAnchor),
            pageRow.bottomAnchor.constraint(equalTo: pager.contentLayoutGuide.bottomAnchor),
            pageRow.leadingAnchor.constraint(equalTo: pager.contentLayoutGuide.leadingAnchor),
            pageRow.trailingAnchor.constraint(equalTo: pager.contentLayoutGuide.trailingAnchor),
            pageRow.heightAnchor.constraint(equalTo: pager.frameLayoutGuide.heightAnchor),
        ])

        for _ in 0..<categoryCount {
            let pageScroll = UIScrollView()
            pageScroll.translatesAutoresizingMaskIntoConstraints = false
            pageScroll.alwaysBounceVertical = true
            pageScroll.showsVerticalScrollIndicator = false
            pageScroll.backgroundColor = .white
            pageScroll.contentInsetAdjustmentBehavior = .never
            pageRow.addArrangedSubview(pageScroll)
            // 계층 추가 후 width 제약 활성화 (frameLayoutGuide 공통조상 필요)
            pageScroll.widthAnchor.constraint(equalTo: pager.frameLayoutGuide.widthAnchor).isActive = true

            let content = UIStackView()
            content.axis = .vertical
            content.spacing = 10
            content.translatesAutoresizingMaskIntoConstraints = false
            pageScroll.addSubview(content)
            NSLayoutConstraint.activate([
                content.topAnchor.constraint(equalTo: pageScroll.contentLayoutGuide.topAnchor, constant: 14),
                content.leadingAnchor.constraint(equalTo: pageScroll.frameLayoutGuide.leadingAnchor, constant: 16),
                content.trailingAnchor.constraint(equalTo: pageScroll.frameLayoutGuide.trailingAnchor, constant: -16),
                content.bottomAnchor.constraint(equalTo: pageScroll.contentLayoutGuide.bottomAnchor, constant: -24),
            ])

            let list = UIStackView()
            list.axis = .vertical
            list.spacing = 10
            content.addArrangedSubview(list)

            let empty = UILabel()
            empty.text = "불러오는 중…"
            empty.font = .systemFont(ofSize: 14)
            empty.textColor = UIColor(white: 0.6, alpha: 1)
            empty.textAlignment = .center
            content.addArrangedSubview(empty)

            pageScrolls.append(pageScroll)
            pageLists.append(list)
            pageEmpties.append(empty)
        }
    }

    func setBanners(_ items: [HomeBanner]) { /* 전체(홈)는 웹뷰가 표시 — 네이티브 배너 미사용 */ }

    // 표시 시점 — 카테고리 리스트(결혼식/행사/외국어) 미리 요청
    func loadInitial() {
        for page in 0..<categoryCount { requestPageIfNeeded(page) }
    }

    // 탭 전환: 0=전체(페이저 숨겨 웹 노출), 1~3=카테고리(페이저 표시)
    func showTab(_ tab: Int, animated: Bool) {
        guard tab >= 0, tab < tabTitles.count else { return }
        currentTab = tab
        categoryTabs.select(tab)
        if tab == 0 {
            pager.isHidden = true
        } else {
            pager.isHidden = false
            let page = tab - 1
            let w = pager.bounds.width
            if w > 0 { pager.setContentOffset(CGPoint(x: CGFloat(page) * w, y: 0), animated: animated) }
            requestPageIfNeeded(page)
        }
    }

    // 현재 전체(웹) 모드인지
    var isShowingWebHome: Bool { currentTab == 0 }

    private func requestPageIfNeeded(_ page: Int) {
        guard page >= 0, page < categoryCount else { return }
        guard !requestedPages.contains(page) else { return }
        requestedPages.insert(page)
        delegate?.homeRequestPros(page + 1)   // 웹 인덱스 1=결혼식,2=행사,3=외국어
    }

    func scrollViewDidEndDecelerating(_ sv: UIScrollView) {
        guard sv == pager, pager.bounds.width > 0 else { return }
        let page = Int(round(pager.contentOffset.x / pager.bounds.width))
        let tab = page + 1
        if tab != currentTab {
            currentTab = tab
            categoryTabs.select(tab)
            Haptics.tap() // 스와이프 전환 진동
        }
        requestPageIfNeeded(page)
    }

    // categoryIndex: 웹 인덱스(1=결혼식,2=행사,3=외국어)
    func setPros(categoryIndex: Int, items: [HomeProItem]) {
        let page = categoryIndex - 1
        guard page >= 0, page < pageLists.count else { return }
        let list = pageLists[page]
        list.arrangedSubviews.forEach { $0.removeFromSuperview() }
        pageEmpties[page].text = items.isEmpty ? "사회자가 없습니다" : ""
        pageEmpties[page].isHidden = !items.isEmpty
        for item in items.prefix(12) {
            let cell = HomeProCell(item: item)
            cell.onTap = { [weak self] id in self?.delegate?.homeOpenPro(id) }
            list.addArrangedSubview(cell)
        }
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

// MARK: - 카테고리 보더 탭 (전체/결혼식/행사/외국어)
final class HomeCategoryTabsView: UIView {
    var onSelect: ((Int) -> Void)?
    private let row = UIStackView()
    private let underline = UIView()
    private var buttons: [UIButton] = []
    private var underlineCenterX: NSLayoutConstraint?
    private var underlineWidth: NSLayoutConstraint?

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        let border = UIView()
        border.translatesAutoresizingMaskIntoConstraints = false
        border.backgroundColor = UIColor(white: 0.92, alpha: 1)
        addSubview(border)
        row.axis = .horizontal
        row.distribution = .fillEqually
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        underline.translatesAutoresizingMaskIntoConstraints = false
        underline.backgroundColor = UIColor(white: 0.1, alpha: 1)
        underline.layer.cornerRadius = 1.5
        addSubview(underline)
        NSLayoutConstraint.activate([
            row.topAnchor.constraint(equalTo: topAnchor),
            row.leadingAnchor.constraint(equalTo: leadingAnchor),
            row.trailingAnchor.constraint(equalTo: trailingAnchor),
            row.bottomAnchor.constraint(equalTo: bottomAnchor),
            border.leadingAnchor.constraint(equalTo: leadingAnchor),
            border.trailingAnchor.constraint(equalTo: trailingAnchor),
            border.bottomAnchor.constraint(equalTo: bottomAnchor),
            border.heightAnchor.constraint(equalToConstant: 1),
            underline.bottomAnchor.constraint(equalTo: bottomAnchor),
            underline.heightAnchor.constraint(equalToConstant: 2.5),
        ])
    }

    func configure(tabs: [String]) {
        row.arrangedSubviews.forEach { $0.removeFromSuperview() }
        buttons = tabs.enumerated().map { (i, t) in
            let b = UIButton(type: .system)
            b.setTitle(t, for: .normal)
            b.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
            b.setTitleColor(UIColor(white: 0.55, alpha: 1), for: .normal)
            b.tag = i
            b.addTarget(self, action: #selector(tap(_:)), for: .touchUpInside)
            row.addArrangedSubview(b)
            return b
        }
        select(0)
    }

    @objc private func tap(_ b: UIButton) { Haptics.tap(); onSelect?(b.tag) }

    func select(_ index: Int) {
        guard index >= 0, index < buttons.count else { return }
        for (i, b) in buttons.enumerated() {
            b.setTitleColor(i == index ? UIColor(white: 0.1, alpha: 1) : UIColor(white: 0.55, alpha: 1), for: .normal)
            b.titleLabel?.font = .systemFont(ofSize: 14, weight: i == index ? .bold : .semibold)
        }
        let target = buttons[index]
        underlineCenterX?.isActive = false
        underlineWidth?.isActive = false
        underlineCenterX = underline.centerXAnchor.constraint(equalTo: target.centerXAnchor)
        underlineWidth = underline.widthAnchor.constraint(equalTo: target.widthAnchor, multiplier: 0.5)
        underlineCenterX?.isActive = true
        underlineWidth?.isActive = true
        UIView.animate(withDuration: 0.25) { self.layoutIfNeeded() }
    }
}

// MARK: - 홈 사회자 카드 셀
final class HomeProCell: UIControl {
    var onTap: ((String) -> Void)?
    private let proId: String

    init(item: HomeProItem) {
        self.proId = item.id
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .white
        layer.cornerRadius = 16
        layer.cornerCurve = .continuous
        layer.borderWidth = 0.5
        layer.borderColor = UIColor(white: 0.93, alpha: 1).cgColor

        let avatar = UIImageView()
        avatar.translatesAutoresizingMaskIntoConstraints = false
        avatar.contentMode = .scaleAspectFill
        avatar.clipsToBounds = true
        avatar.layer.cornerRadius = 28
        avatar.backgroundColor = UIColor(white: 0.92, alpha: 1)
        avatar.isUserInteractionEnabled = false
        addSubview(avatar)
        NativeChatImageLoader.load(item.image, into: avatar, fallback: NativeChatHeaderView.avatarPlaceholder)

        let name = UILabel()
        name.text = item.name
        name.font = .systemFont(ofSize: 15, weight: .bold)
        name.textColor = UIColor(white: 0.1, alpha: 1)

        let rating = UILabel()
        let ratingText = item.rating > 0 ? String(format: "★ %.1f (%d)", item.rating, item.reviewCount) : "★ 신규"
        rating.text = ratingText
        rating.font = .systemFont(ofSize: 12, weight: .medium)
        rating.textColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)

        let intro = UILabel()
        intro.text = item.intro
        intro.font = .systemFont(ofSize: 12.5)
        intro.textColor = UIColor(white: 0.5, alpha: 1)
        intro.numberOfLines = 1

        let col = UIStackView(arrangedSubviews: [name, rating, intro])
        col.axis = .vertical
        col.spacing = 3
        col.alignment = .leading
        col.translatesAutoresizingMaskIntoConstraints = false
        col.isUserInteractionEnabled = false
        addSubview(col)

        NSLayoutConstraint.activate([
            avatar.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            avatar.centerYAnchor.constraint(equalTo: centerYAnchor),
            avatar.widthAnchor.constraint(equalToConstant: 56),
            avatar.heightAnchor.constraint(equalToConstant: 56),
            col.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 12),
            col.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -12),
            col.centerYAnchor.constraint(equalTo: centerYAnchor),
            heightAnchor.constraint(equalToConstant: 80),
        ])

        addTarget(self, action: #selector(fire), for: .touchUpInside)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    @objc private func fire() { Haptics.tap(); onTap?(proId) }
}

// MARK: - 홈 슬라이드 배너 (페이지 카루셀 + 인디케이터 + 자동전환)
final class NativeHomeBanner: UIView, UIScrollViewDelegate {
    var onTap: ((String) -> Void)?
    private let scroll = UIScrollView()
    private let row = UIStackView()
    private let indicator = UILabel()
    private var banners: [HomeBanner] = []
    private var current = 0
    private var timer: Timer?

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        layer.cornerRadius = 16
        layer.cornerCurve = .continuous
        clipsToBounds = true
        backgroundColor = UIColor(white: 0.95, alpha: 1)

        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.isPagingEnabled = true
        scroll.showsHorizontalScrollIndicator = false
        scroll.delegate = self
        scroll.contentInsetAdjustmentBehavior = .never
        addSubview(scroll)

        row.axis = .horizontal
        row.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(row)

        indicator.translatesAutoresizingMaskIntoConstraints = false
        indicator.font = .systemFont(ofSize: 11, weight: .medium)
        indicator.textColor = .white
        indicator.backgroundColor = UIColor(white: 0, alpha: 0.3)
        indicator.textAlignment = .center
        indicator.layer.cornerRadius = 10
        indicator.clipsToBounds = true
        indicator.isHidden = true
        addSubview(indicator)

        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: topAnchor),
            scroll.leadingAnchor.constraint(equalTo: leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: bottomAnchor),
            row.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            row.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
            row.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor),
            row.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor),
            row.heightAnchor.constraint(equalTo: scroll.frameLayoutGuide.heightAnchor),
            indicator.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            indicator.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -10),
            indicator.heightAnchor.constraint(equalToConstant: 20),
        ])

        scroll.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(handleTap)))
    }

    func setBanners(_ items: [HomeBanner]) {
        row.arrangedSubviews.forEach { $0.removeFromSuperview() }
        banners = items
        indicator.isHidden = items.count <= 1
        for b in items {
            let iv = UIImageView()
            iv.translatesAutoresizingMaskIntoConstraints = false
            iv.contentMode = .scaleAspectFill
            iv.clipsToBounds = true
            iv.backgroundColor = UIColor(white: 0.93, alpha: 1)
            row.addArrangedSubview(iv)
            iv.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor).isActive = true
            NativeChatImageLoader.load(b.image, into: iv, fallback: nil)
        }
        current = 0
        updateIndicator()
        restartTimer()
    }

    private func updateIndicator() {
        guard !banners.isEmpty else { return }
        indicator.text = "  \(current + 1) / \(banners.count)  "
    }

    private func restartTimer() {
        timer?.invalidate()
        guard banners.count > 1 else { return }
        timer = Timer.scheduledTimer(withTimeInterval: 4.0, repeats: true) { [weak self] _ in
            guard let self, self.scroll.bounds.width > 0, self.banners.count > 1 else { return }
            let next = (self.current + 1) % self.banners.count
            self.scroll.setContentOffset(CGPoint(x: CGFloat(next) * self.scroll.bounds.width, y: 0), animated: true)
        }
    }

    func scrollViewDidEndDecelerating(_ sv: UIScrollView) {
        guard sv.bounds.width > 0 else { return }
        current = Int(round(sv.contentOffset.x / sv.bounds.width))
        updateIndicator()
    }
    func scrollViewWillBeginDragging(_ sv: UIScrollView) { restartTimer() }

    @objc private func handleTap() {
        guard current < banners.count else { return }
        let link = banners[current].link
        if !link.isEmpty { Haptics.tap(); onTap?(link) }
    }

    deinit { timer?.invalidate() }
}
