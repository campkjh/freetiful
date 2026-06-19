import UIKit

// MARK: - 데이터 모델 (웹 브리지 nativeHomeSections 페이로드)
struct HomeBestPro {
    let id: String
    let name: String
    let image: String
    let careerYears: Int
}
struct HomeProCard {
    let id: String
    let name: String
    let image: String
    let careerYears: Int
    let tags: [String]
    let isPartner: Bool
}
struct HomeBusiness {
    let id: String
    let name: String
    let location: String
    let image: String
    let tags: [String]
    let isPopular: Bool
}
struct HomeBusinessSection {
    let category: String
    let items: [HomeBusiness]
}
struct HomeSectionsData {
    let best: [HomeBestPro]
    let morePros: [HomeProCard]
    let eventPros: [HomeProCard]
    let businessSections: [HomeBusinessSection]   // 웨딩홀,드레스,피부과,스튜디오,헤어,메이크업,스냅
}

// 홈 전체 탭에서 발생하는 액션
protocol NativeHomeAllDelegate: AnyObject {
    func homeOpenWeddingFind()
    func homeOpenEventRequest()
    func homeOpenPath(_ path: String)       // 카테고리 아이콘 / 전체보기 (웹 라우팅)
    func homeOpenPro(_ id: String)
    func homeOpenBusiness(_ id: String)
    func homeOpenBanner(_ link: String)
}

// MARK: - 전체(홈) 네이티브 본문 — 웹 홈과 동일 구성
final class NativeHomeAllView: UIView, UIScrollViewDelegate {
    weak var delegate: NativeHomeAllDelegate?
    var onScroll: ((CGFloat) -> Void)?   // 세로 스크롤량(top inset 보정) — 탭 글래스 전환용
    private let imageBase: String

    private let scrollView = UIScrollView()
    private let stack = UIStackView()

    // 섹션 뷰
    private let banner = NativeHomeBanner()
    private let bestPodium = HomeBestPodium()
    private let moreGrid = HomeProGrid()
    private let eventGrid = HomeProGrid()
    private let businessContainer = UIStackView()   // 웨딩파트너 섹션들(동적)

    init(imageBase: String) {
        self.imageBase = imageBase
        super.init(frame: .zero)
        setup()
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setInsets(top: CGFloat, bottom: CGFloat) {
        // .never 라 인셋 변경 시 contentOffset 자동보정 안 됨 → 최상단이면 새 top 으로 스냅(초기 진입 시 콘텐츠가 탭 뒤로 올라붙는 문제 방지)
        let wasAtTop = scrollView.contentOffset.y <= -scrollView.contentInset.top + 1
        scrollView.contentInset = UIEdgeInsets(top: top, left: 0, bottom: bottom, right: 0)
        scrollView.verticalScrollIndicatorInsets = UIEdgeInsets(top: top, left: 0, bottom: bottom, right: 0)
        if wasAtTop { scrollView.contentOffset.y = -top }
    }

    func scrollToTop() {
        scrollView.setContentOffset(CGPoint(x: 0, y: -scrollView.contentInset.top), animated: false)
    }

    func scrollViewDidScroll(_ sv: UIScrollView) {
        onScroll?(sv.contentOffset.y + sv.contentInset.top)
    }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .white

        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = true
        scrollView.showsVerticalScrollIndicator = false
        scrollView.contentInsetAdjustmentBehavior = .never
        scrollView.delegate = self
        addSubview(scrollView)

        stack.axis = .vertical
        stack.spacing = 22
        stack.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(stack)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: bottomAnchor),
            stack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 14),
            stack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -24),
        ])

        // 1) 히어로 카드
        stack.addArrangedSubview(padded(buildHeroRow(), h: 16))

        // 2) 카테고리 아이콘 그리드
        let icons = HomeCategoryIcons(imageBase: imageBase)
        icons.onSelect = { [weak self] path in self?.delegate?.homeOpenPath(path) }
        stack.addArrangedSubview(padded(icons, h: 10))

        // 3) 배너
        banner.onTap = { [weak self] link in self?.delegate?.homeOpenBanner(link) }
        let bannerWrap = padded(banner, h: 16)
        stack.addArrangedSubview(bannerWrap)
        banner.heightAnchor.constraint(equalTo: banner.widthAnchor, multiplier: 300.0 / 1170.0).isActive = true

        // 4) BEST 결혼식 사회자 (포디움)
        let bestHeader = HomeSectionHeader(title: "BEST 결혼식 사회자", subtitle: "검증된 인기 사회자", trophyURL: "\(imageBase)/images/trophy.png")
        bestHeader.onMore = { [weak self] in self?.delegate?.homeOpenPath("/pros") }
        bestPodium.onSelect = { [weak self] id in self?.delegate?.homeOpenPro(id) }
        stack.addArrangedSubview(padded(stackV([bestHeader, bestPodium], spacing: 14), h: 16))

        // 5) 프리티풀의 더 많은 사회자 (3×3 그리드)
        let moreHeader = HomeSectionHeader(title: "프리티풀의 더 많은 사회자", subtitle: "고객 만족도가 높은 사회자를 만나보세요")
        moreHeader.onMore = { [weak self] in self?.delegate?.homeOpenPath("/pros") }
        moreGrid.onSelect = { [weak self] id in self?.delegate?.homeOpenPro(id) }
        stack.addArrangedSubview(padded(stackV([moreHeader, moreGrid], spacing: 14), h: 16))

        // 6) 프리티풀의 행사 사회자 (그리드)
        let eventHeader = HomeSectionHeader(title: "프리티풀의 행사 사회자", subtitle: "기업행사와 컨퍼런스에 어울리는 사회자를 만나보세요")
        eventHeader.onMore = { [weak self] in self?.delegate?.homeOpenPath("/pros?category=전문행사사회자") }
        eventGrid.onSelect = { [weak self] id in self?.delegate?.homeOpenPro(id) }
        stack.addArrangedSubview(padded(stackV([eventHeader, eventGrid], spacing: 14), h: 16))

        // 7) 웨딩파트너 섹션들 (웨딩홀·드레스·피부과·스튜디오·헤어·메이크업·스냅 — 동적)
        businessContainer.axis = .vertical
        businessContainer.spacing = 22
        stack.addArrangedSubview(businessContainer)
    }

    // MARK: 데이터 주입
    func setBanners(_ items: [HomeBanner]) { banner.setBanners(items) }

    func setSections(_ data: HomeSectionsData) {
        bestPodium.setPros(Array(data.best.prefix(3)))
        moreGrid.setItems(Array(data.morePros.prefix(9)))
        eventGrid.setItems(Array(data.eventPros.prefix(9)))
        if !data.businessSections.isEmpty { setBusinessSections(data.businessSections) }
    }

    // 웨딩파트너 섹션 (웹 큐레이션 브리지에서 받음 — 웨딩홀→드레스→피부과→스튜디오→헤어→메이크업→스냅)
    func setBusinessSections(_ sections: [HomeBusinessSection]) {
        businessContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for sec in sections {
            let carousel = HomeBusinessCarousel()
            carousel.onSelect = { [weak self] id in self?.delegate?.homeOpenBusiness(id) }
            carousel.setItems(sec.items)
            let header = HomeSectionHeader(title: sec.category, subtitle: "프리티풀이 엄선한 \(sec.category) 업체를 만나보세요")
            let cat = sec.category
            header.onMore = { [weak self] in self?.delegate?.homeOpenPath("/businesses?category=\(cat)") }
            let wrap = UIStackView(arrangedSubviews: [padded(header, h: 16), carousel])
            wrap.axis = .vertical
            wrap.spacing = 12
            businessContainer.addArrangedSubview(wrap)
        }
    }

    // MARK: 빌더 헬퍼
    private func buildHeroRow() -> UIView {
        let row = UIStackView()
        row.axis = .horizontal
        row.distribution = .fillEqually
        row.spacing = 12
        let wedding = HeroCardView(imageURL: "\(imageBase)/images/category-icons/wedding-mc.png",
                                   line1: "전문결혼식", line2: "사회자 찾기", showChevron: true, badge: "빠른무료견적")
        wedding.onTap = { [weak self] in self?.delegate?.homeOpenWeddingFind() }
        let event = HeroCardView(imageURL: "\(imageBase)/images/category-icons/event-mc.png",
                                 line1: "전문행사", line2: "사회자 찾기", showChevron: false, badge: nil)
        event.onTap = { [weak self] in self?.delegate?.homeOpenEventRequest() }
        row.addArrangedSubview(wedding)
        row.addArrangedSubview(event)
        return row
    }

    private func stackV(_ views: [UIView], spacing: CGFloat) -> UIStackView {
        let s = UIStackView(arrangedSubviews: views)
        s.axis = .vertical
        s.spacing = spacing
        return s
    }

    // 좌우 패딩 래퍼
    private func padded(_ view: UIView, h: CGFloat) -> UIView {
        let wrap = UIView()
        wrap.translatesAutoresizingMaskIntoConstraints = false
        view.translatesAutoresizingMaskIntoConstraints = false
        wrap.addSubview(view)
        NSLayoutConstraint.activate([
            view.topAnchor.constraint(equalTo: wrap.topAnchor),
            view.bottomAnchor.constraint(equalTo: wrap.bottomAnchor),
            view.leadingAnchor.constraint(equalTo: wrap.leadingAnchor, constant: h),
            view.trailingAnchor.constraint(equalTo: wrap.trailingAnchor, constant: -h),
        ])
        return wrap
    }
}

// MARK: - 섹션 헤더 (트로피? + 타이틀 + 서브타이틀 + 전체보기)
final class HomeSectionHeader: UIView {
    var onMore: (() -> Void)?

    init(title: String, subtitle: String, trophyURL: String? = nil) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        let titleLabel: UILabel
        if trophyURL != nil {
            // 트로피 근처(왼쪽)=골드 → 오른쪽=검정 그라데이션
            let g = GradientTextLabel()
            g.text = title
            g.font = .systemFont(ofSize: 18, weight: .bold)
            g.gradientColors = [
                UIColor(red: 0.85, green: 0.62, blue: 0.13, alpha: 1).cgColor,   // 골드
                UIColor(white: 0.1, alpha: 1).cgColor,                            // 검정
            ]
            g.gradientLocations = [0.0, 0.62]
            titleLabel = g
        } else {
            let l = UILabel()
            l.text = title
            l.font = .systemFont(ofSize: 18, weight: .bold)
            l.textColor = UIColor(white: 0.1, alpha: 1)
            titleLabel = l
        }

        let subtitleLabel = UILabel()
        subtitleLabel.text = subtitle
        subtitleLabel.font = .systemFont(ofSize: 12.5)
        subtitleLabel.textColor = UIColor(white: 0.6, alpha: 1)

        let textCol = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel])
        textCol.axis = .vertical
        textCol.spacing = 3

        let leading = UIStackView()
        leading.axis = .horizontal
        leading.spacing = 8
        leading.alignment = .center
        if let trophyURL = trophyURL {
            let trophy = UIImageView()
            trophy.translatesAutoresizingMaskIntoConstraints = false
            trophy.contentMode = .scaleAspectFit
            NativeChatImageLoader.load(trophyURL, into: trophy, fallback: nil)
            trophy.widthAnchor.constraint(equalToConstant: 40).isActive = true
            trophy.heightAnchor.constraint(equalToConstant: 40).isActive = true
            leading.addArrangedSubview(trophy)
        }
        leading.addArrangedSubview(textCol)

        let more = UIButton(type: .system)
        var cfg = UIButton.Configuration.plain()
        cfg.title = "전체보기"
        cfg.image = UIImage(systemName: "chevron.right", withConfiguration: UIImage.SymbolConfiguration(pointSize: 11, weight: .semibold))
        cfg.imagePlacement = .trailing
        cfg.imagePadding = 2
        cfg.baseForegroundColor = UIColor(white: 0.55, alpha: 1)
        cfg.contentInsets = .zero
        var attr = AttributedString("전체보기")
        attr.font = .systemFont(ofSize: 13, weight: .medium)
        cfg.attributedTitle = attr
        more.configuration = cfg
        more.setContentHuggingPriority(.required, for: .horizontal)
        more.addAction(UIAction { [weak self] _ in Haptics.tap(); self?.onMore?() }, for: .touchUpInside)

        let row = UIStackView(arrangedSubviews: [leading, more])
        row.axis = .horizontal
        row.alignment = .center
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        NSLayoutConstraint.activate([
            row.topAnchor.constraint(equalTo: topAnchor),
            row.bottomAnchor.constraint(equalTo: bottomAnchor),
            row.leadingAnchor.constraint(equalTo: leadingAnchor),
            row.trailingAnchor.constraint(equalTo: trailingAnchor),
        ])
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

// MARK: - 카테고리 아이콘 그리드 (2행 × 5열)
final class HomeCategoryIcons: UIView {
    var onSelect: ((String) -> Void)?
    private let imageBase: String

    private static let items: [(label: String, icon: String, href: String)] = [
        ("결혼식사회자", "wedding-mc.png", "/pros?category=결혼식사회자"),
        ("행사사회자", "event-mc.png", "/pros?category=전문행사사회자"),
        ("외국어사회자", "foreign-mc.png", "/pros?category=외국어사회자"),
        ("웨딩홀", "wedding-hall.png", "/businesses?category=웨딩홀"),
        ("드레스", "dress.png", "/businesses?category=드레스"),
        ("피부과", "derma.png", "/businesses?category=피부과"),
        ("스튜디오", "studio.png", "/businesses?category=스튜디오"),
        ("헤어", "hair.png", "/businesses?category=헤어"),
        ("메이크업", "makeup.png", "/businesses?category=메이크업"),
        ("스냅", "snap.png", "/businesses?category=스냅"),
    ]

    init(imageBase: String) {
        self.imageBase = imageBase
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        let col = UIStackView()
        col.axis = .vertical
        col.spacing = 14
        col.distribution = .fillEqually
        col.translatesAutoresizingMaskIntoConstraints = false
        addSubview(col)
        NSLayoutConstraint.activate([
            col.topAnchor.constraint(equalTo: topAnchor),
            col.bottomAnchor.constraint(equalTo: bottomAnchor),
            col.leadingAnchor.constraint(equalTo: leadingAnchor),
            col.trailingAnchor.constraint(equalTo: trailingAnchor),
        ])

        for rowItems in [Array(Self.items[0..<5]), Array(Self.items[5..<10])] {
            let row = UIStackView()
            row.axis = .horizontal
            row.distribution = .fillEqually
            row.spacing = 6
            for item in rowItems {
                row.addArrangedSubview(makeIcon(item))
            }
            col.addArrangedSubview(row)
        }
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func makeIcon(_ item: (label: String, icon: String, href: String)) -> UIView {
        let container = UIControl()
        container.translatesAutoresizingMaskIntoConstraints = false

        let iconWrap = UIView()
        iconWrap.translatesAutoresizingMaskIntoConstraints = false
        iconWrap.backgroundColor = .clear   // 회색 배경/라운드 제거
        iconWrap.isUserInteractionEnabled = false
        container.addSubview(iconWrap)

        let iv = UIImageView()
        iv.translatesAutoresizingMaskIntoConstraints = false
        iv.contentMode = .scaleAspectFit
        iv.isUserInteractionEnabled = false
        iconWrap.addSubview(iv)
        NativeChatImageLoader.load("\(imageBase)/images/category-icons/\(item.icon)", into: iv, fallback: nil)

        let label = UILabel()
        label.text = item.label
        label.font = .systemFont(ofSize: 11.5, weight: .medium)
        label.textColor = UIColor(white: 0.25, alpha: 1)
        label.textAlignment = .center
        label.numberOfLines = 1
        label.adjustsFontSizeToFitWidth = true
        label.minimumScaleFactor = 0.8
        label.translatesAutoresizingMaskIntoConstraints = false
        label.isUserInteractionEnabled = false
        container.addSubview(label)

        NSLayoutConstraint.activate([
            iconWrap.topAnchor.constraint(equalTo: container.topAnchor),
            iconWrap.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            iconWrap.widthAnchor.constraint(equalToConstant: 60),
            iconWrap.heightAnchor.constraint(equalToConstant: 60),
            iv.topAnchor.constraint(equalTo: iconWrap.topAnchor),
            iv.bottomAnchor.constraint(equalTo: iconWrap.bottomAnchor),
            iv.leadingAnchor.constraint(equalTo: iconWrap.leadingAnchor),
            iv.trailingAnchor.constraint(equalTo: iconWrap.trailingAnchor),
            label.topAnchor.constraint(equalTo: iconWrap.bottomAnchor, constant: 6),
            label.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            label.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            label.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])
        container.addAction(UIAction { [weak self] _ in Haptics.tap(); self?.onSelect?(item.href) }, for: .touchUpInside)
        return container
    }
}

// MARK: - BEST 포디움 (top 3)
final class HomeBestPodium: UIView {
    var onSelect: ((String) -> Void)?
    private let row = UIStackView()

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        row.axis = .horizontal
        row.distribution = .fillEqually
        row.alignment = .top
        row.spacing = 8
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        NSLayoutConstraint.activate([
            row.topAnchor.constraint(equalTo: topAnchor),
            row.bottomAnchor.constraint(equalTo: bottomAnchor),
            row.leadingAnchor.constraint(equalTo: leadingAnchor),
            row.trailingAnchor.constraint(equalTo: trailingAnchor),
        ])
    }

    func setPros(_ pros: [HomeBestPro]) {
        row.arrangedSubviews.forEach { $0.removeFromSuperview() }
        guard pros.count >= 3 else {
            // 3명 미만이면 순서대로만
            for (i, p) in pros.enumerated() { row.addArrangedSubview(makeCell(p, rank: i + 1)) }
            return
        }
        // 2위(좌) - 1위(중앙) - 3위(우)
        row.addArrangedSubview(makeCell(pros[1], rank: 2))
        row.addArrangedSubview(makeCell(pros[0], rank: 1))
        row.addArrangedSubview(makeCell(pros[2], rank: 3))
    }

    private func rankColor(_ rank: Int) -> UIColor {
        switch rank {
        case 1: return UIColor(red: 0.98, green: 0.75, blue: 0.14, alpha: 1)   // gold
        case 2: return UIColor(red: 0.74, green: 0.76, blue: 0.80, alpha: 1)   // silver
        default: return UIColor(red: 0.80, green: 0.50, blue: 0.20, alpha: 1)  // bronze
        }
    }

    private func makeCell(_ pro: HomeBestPro, rank: Int) -> UIView {
        let cell = UIControl()
        cell.translatesAutoresizingMaskIntoConstraints = false

        let imgWrap = UIView()
        imgWrap.translatesAutoresizingMaskIntoConstraints = false
        imgWrap.isUserInteractionEnabled = false

        let img = PillImageView()               // 짧은 변 절반으로 코너반경 자동 → 정확한 알약
        img.translatesAutoresizingMaskIntoConstraints = false
        img.contentMode = .scaleAspectFill
        img.clipsToBounds = true
        img.layer.borderWidth = 2              // 보더 얇게
        img.layer.borderColor = rankColor(rank).cgColor
        img.backgroundColor = UIColor(white: 0.93, alpha: 1)
        imgWrap.addSubview(img)
        NativeChatImageLoader.load(pro.image, into: img, fallback: NativeChatHeaderView.avatarPlaceholder)

        // 순위 메달 (원본 SVG) — 이미지 하단 중앙
        let medal = UIImageView(image: UIImage(named: "best-medal-\(rank)"))
        medal.translatesAutoresizingMaskIntoConstraints = false
        medal.contentMode = .scaleAspectFit
        imgWrap.addSubview(medal)

        let name = UILabel()
        name.text = pro.name
        name.font = .systemFont(ofSize: 14, weight: .bold)
        name.textColor = UIColor(white: 0.1, alpha: 1)
        name.textAlignment = .center

        let career = UILabel()
        career.text = pro.careerYears > 0 ? "경력 \(pro.careerYears)년" : "경력 확인중"
        career.font = .systemFont(ofSize: 12)
        career.textColor = UIColor(white: 0.6, alpha: 1)
        career.textAlignment = .center

        let col = UIStackView(arrangedSubviews: [imgWrap, name, career])
        col.axis = .vertical
        col.spacing = 8
        col.alignment = .fill
        col.translatesAutoresizingMaskIntoConstraints = false
        col.isUserInteractionEnabled = false
        cell.addSubview(col)

        let topOffset: CGFloat = rank == 1 ? 0 : 24  // 1등만 살짝 위로 (카드 크기는 동일)
        NSLayoutConstraint.activate([
            col.topAnchor.constraint(equalTo: cell.topAnchor, constant: topOffset),
            col.leadingAnchor.constraint(equalTo: cell.leadingAnchor),
            col.trailingAnchor.constraint(equalTo: cell.trailingAnchor),
            col.bottomAnchor.constraint(equalTo: cell.bottomAnchor),
            img.topAnchor.constraint(equalTo: imgWrap.topAnchor),
            img.bottomAnchor.constraint(equalTo: imgWrap.bottomAnchor),
            img.leadingAnchor.constraint(equalTo: imgWrap.leadingAnchor),
            img.trailingAnchor.constraint(equalTo: imgWrap.trailingAnchor),
            imgWrap.heightAnchor.constraint(equalToConstant: 172),   // 알약 height 더 길게 (1·2·3 동일)
            medal.centerXAnchor.constraint(equalTo: imgWrap.centerXAnchor),
            medal.centerYAnchor.constraint(equalTo: img.bottomAnchor),   // 보더 위에 위치
            medal.widthAnchor.constraint(equalToConstant: 30),           // 메달 조금 더 크게
            medal.heightAnchor.constraint(equalToConstant: 19),
        ])
        cell.addAction(UIAction { [weak self] _ in Haptics.tap(); self?.onSelect?(pro.id) }, for: .touchUpInside)
        return cell
    }
}

// MARK: - 업체(웨딩홀/드레스) 가로 캐러셀
final class HomeBusinessCarousel: UIView {
    var onSelect: ((String) -> Void)?
    private let scroll = UIScrollView()
    private let row = UIStackView()

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.showsHorizontalScrollIndicator = false
        scroll.contentInsetAdjustmentBehavior = .never
        scroll.contentInset = UIEdgeInsets(top: 0, left: 16, bottom: 0, right: 16)
        scroll.clipsToBounds = false
        addSubview(scroll)
        row.axis = .horizontal
        row.spacing = 12
        row.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(row)
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: topAnchor),
            scroll.bottomAnchor.constraint(equalTo: bottomAnchor),
            scroll.leadingAnchor.constraint(equalTo: leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: trailingAnchor),
            row.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            row.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
            row.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor),
            row.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor),
            row.heightAnchor.constraint(equalTo: scroll.frameLayoutGuide.heightAnchor),
        ])
    }

    func setItems(_ items: [HomeBusiness]) {
        row.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for item in items {
            let card = HomeBusinessCard(item: item)
            card.onTap = { [weak self] id in self?.onSelect?(id) }
            row.addArrangedSubview(card)
            card.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor, multiplier: 0.78).isActive = true
        }
    }
}

final class HomeBusinessCard: UIControl {
    var onTap: ((String) -> Void)?
    private let bizId: String

    init(item: HomeBusiness) {
        self.bizId = item.id
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        let img = UIImageView()
        img.translatesAutoresizingMaskIntoConstraints = false
        img.contentMode = .scaleAspectFill
        img.clipsToBounds = true
        img.layer.cornerRadius = 20
        img.layer.cornerCurve = .continuous
        img.backgroundColor = UIColor(white: 0.93, alpha: 1)
        img.isUserInteractionEnabled = false
        addSubview(img)
        NativeChatImageLoader.load(item.image, into: img, fallback: nil)

        // 로고 배지 (좌상단, 이름 첫 글자)
        let logo = UILabel()
        logo.text = String(item.name.prefix(1))
        logo.font = .systemFont(ofSize: 14, weight: .bold)
        logo.textColor = UIColor(white: 0.2, alpha: 1)
        logo.textAlignment = .center
        logo.backgroundColor = .white
        logo.layer.cornerRadius = 16
        logo.clipsToBounds = true
        logo.translatesAutoresizingMaskIntoConstraints = false
        logo.isUserInteractionEnabled = false
        addSubview(logo)

        let name = UILabel()
        name.text = item.name
        name.font = .systemFont(ofSize: 15.5, weight: .semibold)
        name.textColor = UIColor(white: 0.1, alpha: 1)
        name.numberOfLines = 1

        let loc = UILabel()
        loc.text = "📍 \(item.location)"
        loc.font = .systemFont(ofSize: 12.5)
        loc.textColor = UIColor(white: 0.5, alpha: 1)

        let tagRow = UIStackView()
        tagRow.axis = .horizontal
        tagRow.spacing = 5
        for t in item.tags.prefix(3) { tagRow.addArrangedSubview(makeTag(t, popular: t == "인기")) }

        let col = UIStackView(arrangedSubviews: [name, loc, tagRow])
        col.axis = .vertical
        col.spacing = 5
        col.alignment = .leading
        col.translatesAutoresizingMaskIntoConstraints = false
        col.isUserInteractionEnabled = false
        addSubview(col)

        NSLayoutConstraint.activate([
            img.topAnchor.constraint(equalTo: topAnchor),
            img.leadingAnchor.constraint(equalTo: leadingAnchor),
            img.trailingAnchor.constraint(equalTo: trailingAnchor),
            img.heightAnchor.constraint(equalTo: img.widthAnchor, multiplier: 0.5),  // 2:1
            logo.topAnchor.constraint(equalTo: img.topAnchor, constant: 8),
            logo.leadingAnchor.constraint(equalTo: img.leadingAnchor, constant: 8),
            logo.widthAnchor.constraint(equalToConstant: 32),
            logo.heightAnchor.constraint(equalToConstant: 32),
            col.topAnchor.constraint(equalTo: img.bottomAnchor, constant: 8),
            col.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 2),
            col.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -2),
            col.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        if item.isPopular {
            let pop = makeTag("인기", popular: true)
            pop.translatesAutoresizingMaskIntoConstraints = false
            addSubview(pop)
            NSLayoutConstraint.activate([
                pop.topAnchor.constraint(equalTo: img.topAnchor, constant: 8),
                pop.trailingAnchor.constraint(equalTo: img.trailingAnchor, constant: -8),
            ])
        }
        addAction(UIAction { [weak self] _ in Haptics.tap(); self?.onTap?(self?.bizId ?? "") }, for: .touchUpInside)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func makeTag(_ text: String, popular: Bool) -> UIView {
        let l = PaddingLabel()
        l.text = text
        l.font = .systemFont(ofSize: 11, weight: .medium)
        l.textColor = popular ? UIColor(red: 0.95, green: 0.45, blue: 0.13, alpha: 1) : UIColor(white: 0.45, alpha: 1)
        l.backgroundColor = popular ? UIColor(red: 1.0, green: 0.93, blue: 0.86, alpha: 1) : UIColor(white: 0.95, alpha: 1)
        l.layer.cornerRadius = 5
        l.clipsToBounds = true
        return l
    }
}

// MARK: - 사회자 그리드 (3열)
final class HomeProGrid: UIView {
    var onSelect: ((String) -> Void)?
    private let col = UIStackView()

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        col.axis = .vertical
        col.spacing = 16
        col.translatesAutoresizingMaskIntoConstraints = false
        addSubview(col)
        NSLayoutConstraint.activate([
            col.topAnchor.constraint(equalTo: topAnchor),
            col.bottomAnchor.constraint(equalTo: bottomAnchor),
            col.leadingAnchor.constraint(equalTo: leadingAnchor),
            col.trailingAnchor.constraint(equalTo: trailingAnchor),
        ])
    }

    func setItems(_ items: [HomeProCard]) {
        col.arrangedSubviews.forEach { $0.removeFromSuperview() }
        var i = 0
        while i < items.count {
            let rowItems = Array(items[i..<min(i + 3, items.count)])
            let row = UIStackView()
            row.axis = .horizontal
            row.distribution = .fillEqually
            row.alignment = .top
            row.spacing = 8
            for item in rowItems {
                let card = HomeProGridCard(item: item)
                card.onTap = { [weak self] id in self?.onSelect?(id) }
                row.addArrangedSubview(card)
            }
            // 마지막 행 빈칸 채우기 (3열 정렬 유지)
            for _ in rowItems.count..<3 { row.addArrangedSubview(UIView()) }
            col.addArrangedSubview(row)
            i += 3
        }
    }
}

final class HomeProGridCard: UIControl {
    var onTap: ((String) -> Void)?
    private let proId: String

    init(item: HomeProCard) {
        self.proId = item.id
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        let img = UIImageView()
        img.translatesAutoresizingMaskIntoConstraints = false
        img.contentMode = .scaleAspectFill
        img.clipsToBounds = true
        img.layer.cornerRadius = 20
        img.layer.cornerCurve = .continuous
        img.backgroundColor = UIColor(white: 0.93, alpha: 1)
        img.isUserInteractionEnabled = false
        addSubview(img)
        NativeChatImageLoader.load(item.image, into: img, fallback: NativeChatHeaderView.avatarPlaceholder)

        let name = UILabel()
        name.text = "사회자 \(item.name)"
        name.font = .systemFont(ofSize: 13.5, weight: .bold)
        name.textColor = UIColor(white: 0.1, alpha: 1)
        name.numberOfLines = 1

        let career = PaddingLabel()
        career.text = item.careerYears > 0 ? "경력\(item.careerYears)년" : "경력 확인중"
        career.font = .systemFont(ofSize: 11, weight: .semibold)
        career.textColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
        career.backgroundColor = UIColor(red: 0.92, green: 0.95, blue: 1.0, alpha: 1)
        career.layer.cornerRadius = 5
        career.clipsToBounds = true

        let col = UIStackView(arrangedSubviews: [name, career])
        col.axis = .vertical
        col.spacing = 4
        col.alignment = .leading
        col.translatesAutoresizingMaskIntoConstraints = false
        col.isUserInteractionEnabled = false
        addSubview(col)

        // 파트너스 뱃지 — 경력 아래, 칩 없이 로고만(풀어서)
        if item.isPartner {
            let partnerBadge = UIImageView(image: UIImage(named: "partners-badge")?.withRenderingMode(.alwaysOriginal))
            partnerBadge.contentMode = .scaleAspectFit
            partnerBadge.translatesAutoresizingMaskIntoConstraints = false
            partnerBadge.heightAnchor.constraint(equalToConstant: 15).isActive = true
            partnerBadge.widthAnchor.constraint(equalTo: partnerBadge.heightAnchor, multiplier: 148.0 / 44.0).isActive = true
            col.addArrangedSubview(partnerBadge)
            col.setCustomSpacing(6, after: career)
        }

        NSLayoutConstraint.activate([
            img.topAnchor.constraint(equalTo: topAnchor),
            img.leadingAnchor.constraint(equalTo: leadingAnchor),
            img.trailingAnchor.constraint(equalTo: trailingAnchor),
            img.heightAnchor.constraint(equalTo: img.widthAnchor, multiplier: 1.3),  // 3:4 약간 세로
            col.topAnchor.constraint(equalTo: img.bottomAnchor, constant: 7),
            col.leadingAnchor.constraint(equalTo: leadingAnchor),
            col.trailingAnchor.constraint(equalTo: trailingAnchor),
            col.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        addAction(UIAction { [weak self] _ in Haptics.tap(); self?.onTap?(self?.proId ?? "") }, for: .touchUpInside)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

// MARK: - 알약(필) 이미지뷰 — 짧은 변의 절반으로 코너반경 자동 설정 (마름모 방지)
final class PillImageView: UIImageView {
    override func layoutSubviews() {
        super.layoutSubviews()
        layer.cornerCurve = .circular
        layer.cornerRadius = min(bounds.width, bounds.height) / 2
    }
}

// MARK: - 패딩 라벨 (태그/배지용)
final class PaddingLabel: UILabel {
    var inset = UIEdgeInsets(top: 3, left: 7, bottom: 3, right: 7)
    override func drawText(in rect: CGRect) { super.drawText(in: rect.inset(by: inset)) }
    override var intrinsicContentSize: CGSize {
        let s = super.intrinsicContentSize
        return CGSize(width: s.width + inset.left + inset.right, height: s.height + inset.top + inset.bottom)
    }
}

// MARK: - 정적 가로 그라데이션 텍스트 (트로피 근처=골드 → 검정)
final class GradientTextLabel: UILabel {
    var gradientColors: [CGColor] = [] { didSet { gradient.colors = gradientColors } }
    var gradientLocations: [NSNumber]? { didSet { gradient.locations = gradientLocations } }
    private let gradient = CAGradientLayer()
    private let textMask = CATextLayer()
    override init(frame: CGRect) { super.init(frame: frame); setupG() }
    required init?(coder: NSCoder) { super.init(coder: coder); setupG() }
    private func setupG() {
        textColor = .clear
        gradient.startPoint = CGPoint(x: 0, y: 0.5)
        gradient.endPoint = CGPoint(x: 1, y: 0.5)
        layer.addSublayer(gradient)
        textMask.contentsScale = UIScreen.main.scale
        textMask.isWrapped = true
        textMask.alignmentMode = .left
        gradient.mask = textMask
    }
    override func layoutSubviews() {
        super.layoutSubviews()
        gradient.frame = bounds
        textMask.frame = bounds
        textMask.string = NSAttributedString(string: text ?? "", attributes: [.font: font as Any, .foregroundColor: UIColor.black])
    }
}
