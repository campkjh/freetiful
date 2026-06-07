import UIKit

protocol NativeHomeContentDelegate: AnyObject {
    func homeOpenWeddingFind()
    func homeOpenEventRequest()
    func homeOpenCategory(_ category: String)
    func homeOpenPro(_ proId: String)
    func homeRequestPros(_ categoryIndex: Int)
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
    private let scrollView = UIScrollView()
    private let stack = UIStackView()
    private let imageBase: String

    // 카테고리 탭 + 좌우 스와이프 페이저
    private let categories = ["전체", "결혼식사회자", "행사사회자", "외국어사회자"]
    private let categoryTabs = HomeCategoryTabsView()
    private let pager = UIScrollView()
    private let pageRow = UIStackView()
    private var pageLists: [UIStackView] = []
    private var pageEmpties: [UILabel] = []
    private var pagerHeight: NSLayoutConstraint!
    private var currentPage = 0
    private var requestedPages = Set<Int>()

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
        buildCategorySection()
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

    // MARK: - 카테고리 탭 + 좌우 스와이프 페이저
    private func buildCategorySection() {
        categoryTabs.configure(tabs: categories)
        categoryTabs.onSelect = { [weak self] idx in self?.scrollTo(page: idx, animated: true) }
        stack.addArrangedSubview(categoryTabs)
        categoryTabs.heightAnchor.constraint(equalToConstant: 46).isActive = true

        pager.translatesAutoresizingMaskIntoConstraints = false
        pager.isPagingEnabled = true
        pager.showsHorizontalScrollIndicator = false
        pager.delegate = self
        pager.contentInsetAdjustmentBehavior = .never
        stack.addArrangedSubview(pager)
        pagerHeight = pager.heightAnchor.constraint(equalToConstant: 420)
        pagerHeight.isActive = true

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

        for _ in categories {
            let pageContainer = UIView()
            pageContainer.translatesAutoresizingMaskIntoConstraints = false
            pageContainer.widthAnchor.constraint(equalTo: pager.frameLayoutGuide.widthAnchor).isActive = true

            let list = UIStackView()
            list.axis = .vertical
            list.spacing = 10
            list.translatesAutoresizingMaskIntoConstraints = false
            pageContainer.addSubview(list)

            let empty = UILabel()
            empty.text = "불러오는 중…"
            empty.font = .systemFont(ofSize: 14)
            empty.textColor = UIColor(white: 0.6, alpha: 1)
            empty.textAlignment = .center
            empty.translatesAutoresizingMaskIntoConstraints = false
            pageContainer.addSubview(empty)

            NSLayoutConstraint.activate([
                list.topAnchor.constraint(equalTo: pageContainer.topAnchor, constant: 4),
                list.leadingAnchor.constraint(equalTo: pageContainer.leadingAnchor),
                list.trailingAnchor.constraint(equalTo: pageContainer.trailingAnchor),
                empty.centerXAnchor.constraint(equalTo: pageContainer.centerXAnchor),
                empty.topAnchor.constraint(equalTo: pageContainer.topAnchor, constant: 44),
            ])
            pageRow.addArrangedSubview(pageContainer)
            pageLists.append(list)
            pageEmpties.append(empty)
        }
    }

    // 표시 시점에 호출 — 첫 카테고리 데이터 요청
    func loadInitial() {
        requestPageIfNeeded(0)
    }

    func scrollTo(page: Int, animated: Bool) {
        guard page >= 0, page < categories.count else { return }
        let w = pager.bounds.width
        if w > 0 { pager.setContentOffset(CGPoint(x: CGFloat(page) * w, y: 0), animated: animated) }
        currentPage = page
        categoryTabs.select(page)
        requestPageIfNeeded(page)
    }

    private func requestPageIfNeeded(_ page: Int) {
        guard !requestedPages.contains(page) else { return }
        requestedPages.insert(page)
        delegate?.homeRequestPros(page)
    }

    func scrollViewDidEndDecelerating(_ sv: UIScrollView) {
        guard sv == pager, pager.bounds.width > 0 else { return }
        let page = Int(round(pager.contentOffset.x / pager.bounds.width))
        if page != currentPage {
            currentPage = page
            categoryTabs.select(page)
            Haptics.tap() // 스와이프 시 진동
        }
        requestPageIfNeeded(page)
    }

    func setPros(categoryIndex: Int, items: [HomeProItem]) {
        guard categoryIndex >= 0, categoryIndex < pageLists.count else { return }
        let list = pageLists[categoryIndex]
        list.arrangedSubviews.forEach { $0.removeFromSuperview() }
        pageEmpties[categoryIndex].text = items.isEmpty ? "사회자가 없습니다" : ""
        pageEmpties[categoryIndex].isHidden = !items.isEmpty
        for item in items.prefix(8) {
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
