import UIKit

protocol NativeHomeContentDelegate: AnyObject {
    func homeOpenWeddingFind()
    func homeOpenEventRequest()
    func homeOpenCategory(_ category: String)
    func homeOpenPro(_ proId: String)
    func homeRequestPros(_ categoryIndex: Int)
    func homeOpenBanner(_ link: String)
    func homeOpenPath(_ path: String)        // 카테고리 아이콘 / 전체보기
    func homeOpenBusiness(_ id: String)
    func homeRequestSections()               // 전체(홈) 섹션 데이터 요청
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
    let careerYears: Int
    var tags: [String] = []
    var youtubeUrl: String = ""
}

// 네이티브 홈 스크린 본문 (웹 홈 위에 전체 덮음) — 완성될 때까지 단계적으로 섹션 추가.
// 현재: 히어로 카드(전문결혼식/전문행사 찾기). 이후: 카테고리 탭/스와이프, 배너, 사회자 리스트.
final class NativeHomeContent: UIView, UIScrollViewDelegate {
    weak var delegate: NativeHomeContentDelegate?
    private let imageBase: String

    // 헤더 탭: 전체(=네이티브 홈) / 결혼식사회자 / 행사사회자 / 외국어사회자
    private let tabTitles = ["전체", "결혼식사회자", "행사사회자", "외국어사회자"]
    private let categoryTabs = HomeCategoryTabsView()
    private let pager = UIScrollView()
    private let pageRow = UIStackView()
    private let homeAll: NativeHomeAllView          // page 0 (전체)
    private var catScrolls: [UIScrollView] = []     // page 1~3 (결혼식/행사/외국어)
    private var catLists: [UIStackView] = []
    private var catEmpties: [UILabel] = []
    private var currentTab = 0
    // 카테고리 탭(1~3)에서 네비바 위에 뜨는 '홈 전체로' 알약 글래스
    private let homePill = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
    private var homePillShown = false

    // 헤더+탭을 하나의 그라데이션 블러로 덮음(웨딩파트너 list 패리티). 콘텐츠는 그 뒤로 스크롤.
    private let tabHeight: CGFloat = 46
    private let topBlur = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterial))
    private let topBlurMask = CAGradientLayer()
    private var topBlurHeight: NSLayoutConstraint!

    private var topInset: CGFloat = 0
    private var bottomInset: CGFloat = 0
    private var tabsTop: NSLayoutConstraint!

    init(imageBase: String) {
        self.imageBase = imageBase
        self.homeAll = NativeHomeAllView(imageBase: imageBase)
        super.init(frame: .zero)
        setup()
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    // top = 글래스 헤더 높이(탭을 헤더 바로 아래 고정), bottom = 하단 탭바 높이
    func setInsets(top: CGFloat, bottom: CGFloat) {
        topInset = top
        bottomInset = bottom
        tabsTop?.constant = top
        topBlurHeight?.constant = top + tabHeight   // 헤더 + 탭바 영역까지 통합 블러
        // 콘텐츠는 탭 아래에서 시작하되, 스크롤 시 탭/헤더 뒤로 지나감
        homeAll.setInsets(top: top + tabHeight, bottom: bottom)
        for s in catScrolls {
            let wasAtTop = s.contentOffset.y <= -s.contentInset.top + 1
            s.contentInset = UIEdgeInsets(top: top + tabHeight, left: 0, bottom: bottom, right: 0)
            s.verticalScrollIndicatorInsets = UIEdgeInsets(top: top + tabHeight, left: 0, bottom: bottom, right: 0)
            if wasAtTop { s.contentOffset.y = -(top + tabHeight) }
        }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        topBlurMask.frame = topBlur.bounds   // CAGradientLayer 는 오토리사이즈 안 됨 → 수동 갱신
    }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .white

        // 좌우 스와이프 페이저 (전체 + 카테고리 3개 = 4페이지) — 전체높이(y=0)에서 시작 → 헤더/탭 뒤로 스크롤
        pager.translatesAutoresizingMaskIntoConstraints = false
        pager.isPagingEnabled = true
        pager.showsHorizontalScrollIndicator = false
        pager.delegate = self
        pager.backgroundColor = .white
        pager.contentInsetAdjustmentBehavior = .never
        addSubview(pager)   // 맨 아래(블러/탭 뒤)

        // 헤더+탭 통합 그라데이션 블러 (페이저 위, 탭 아래) — 웨딩파트너 topBlur 동일. 흰 틴트로 가독성 확보.
        topBlur.translatesAutoresizingMaskIntoConstraints = false
        topBlur.contentView.backgroundColor = UIColor.white.withAlphaComponent(0.45)
        topBlurMask.colors = [
            UIColor.black.cgColor,
            UIColor.black.withAlphaComponent(0.9).cgColor,
            UIColor.clear.cgColor,
        ]
        topBlurMask.locations = [0, 0.55, 1]
        topBlurMask.startPoint = CGPoint(x: 0.5, y: 0)
        topBlurMask.endPoint = CGPoint(x: 0.5, y: 1)
        topBlur.layer.mask = topBlurMask
        topBlur.isUserInteractionEnabled = false
        addSubview(topBlur)

        // 헤더 탭 (상단 고정 — 통합 블러 위에 떠 있는 글래스 알약)
        categoryTabs.translatesAutoresizingMaskIntoConstraints = false
        categoryTabs.backgroundColor = .clear
        categoryTabs.configure(tabs: tabTitles)
        categoryTabs.onSelect = { [weak self] idx in self?.showTab(idx, animated: true) }
        addSubview(categoryTabs)

        tabsTop = categoryTabs.topAnchor.constraint(equalTo: topAnchor, constant: topInset)
        topBlurHeight = topBlur.heightAnchor.constraint(equalToConstant: topInset + tabHeight)

        NSLayoutConstraint.activate([
            pager.topAnchor.constraint(equalTo: topAnchor),
            pager.leadingAnchor.constraint(equalTo: leadingAnchor),
            pager.trailingAnchor.constraint(equalTo: trailingAnchor),
            pager.bottomAnchor.constraint(equalTo: bottomAnchor),

            topBlur.topAnchor.constraint(equalTo: topAnchor),
            topBlur.leadingAnchor.constraint(equalTo: leadingAnchor),
            topBlur.trailingAnchor.constraint(equalTo: trailingAnchor),
            topBlurHeight,

            tabsTop,
            categoryTabs.leadingAnchor.constraint(equalTo: leadingAnchor),
            categoryTabs.trailingAnchor.constraint(equalTo: trailingAnchor),
            categoryTabs.heightAnchor.constraint(equalToConstant: tabHeight),
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

        // page 0 — 전체 (네이티브 홈 본문)
        homeAll.delegate = self
        pageRow.addArrangedSubview(homeAll)
        homeAll.widthAnchor.constraint(equalTo: pager.frameLayoutGuide.widthAnchor).isActive = true

        // page 1~3 — 카테고리 리스트
        for _ in 0..<3 {
            let pageScroll = UIScrollView()
            pageScroll.translatesAutoresizingMaskIntoConstraints = false
            pageScroll.alwaysBounceVertical = true
            pageScroll.showsVerticalScrollIndicator = false
            pageScroll.backgroundColor = .white
            pageScroll.contentInsetAdjustmentBehavior = .never
            pageRow.addArrangedSubview(pageScroll)
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

            catScrolls.append(pageScroll)
            catLists.append(list)
            catEmpties.append(empty)
        }
    }

    // MARK: 데이터
    func setBanners(_ items: [HomeBanner]) { homeAll.setBanners(items) }
    func setSections(_ data: HomeSectionsData) { homeAll.setSections(data) }
    func setBusinessSections(_ sections: [HomeBusinessSection]) { homeAll.setBusinessSections(sections) }

    func loadInitial() {
        // 네이티브가 API 직접 호출 (웹 브리지/Vercel 캐시 무관)
        NativeHomeData.loadSections { [weak self] d in self?.homeAll.setSections(d) }
        NativeHomeData.loadBanners { [weak self] b in self?.homeAll.setBanners(b) }
        for cat in 1...3 {
            NativeHomeData.loadCategory(cat) { [weak self] items in self?.setPros(categoryIndex: cat, items: items) }
        }
    }

    private func ensureHomePill() {
        guard homePill.superview == nil else { return }
        homePill.translatesAutoresizingMaskIntoConstraints = false
        homePill.layer.cornerRadius = 21
        homePill.layer.cornerCurve = .continuous
        homePill.clipsToBounds = true
        homePill.layer.borderWidth = 0.5
        homePill.layer.borderColor = UIColor.white.withAlphaComponent(0.25).cgColor
        homePill.contentView.backgroundColor = UIColor.black.withAlphaComponent(0.55)
        homePill.alpha = 0
        homePill.isHidden = true

        var cfg = UIButton.Configuration.plain()
        cfg.image = UIImage(systemName: "house.fill", withConfiguration: UIImage.SymbolConfiguration(pointSize: 12, weight: .bold))
        cfg.title = "홈 전체"
        cfg.imagePadding = 6
        cfg.baseForegroundColor = .white
        cfg.contentInsets = NSDirectionalEdgeInsets(top: 11, leading: 18, bottom: 11, trailing: 18)
        cfg.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { var o = $0; o.font = .systemFont(ofSize: 13.5, weight: .bold); return o }
        let btn = UIButton(configuration: cfg)
        btn.translatesAutoresizingMaskIntoConstraints = false
        btn.addAction(UIAction { [weak self] _ in
            Haptics.tap()
            self?.showTab(0, animated: true)
        }, for: .touchUpInside)
        homePill.contentView.addSubview(btn)
        addSubview(homePill)
        NSLayoutConstraint.activate([
            homePill.centerXAnchor.constraint(equalTo: centerXAnchor),
            // 하단 네비바(높이 62, 하단 여백 8) 바로 위 8px
            homePill.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.bottomAnchor, constant: -(8 + 62 + 8)),
            homePill.heightAnchor.constraint(equalToConstant: 42),
            btn.topAnchor.constraint(equalTo: homePill.contentView.topAnchor),
            btn.bottomAnchor.constraint(equalTo: homePill.contentView.bottomAnchor),
            btn.leadingAnchor.constraint(equalTo: homePill.contentView.leadingAnchor),
            btn.trailingAnchor.constraint(equalTo: homePill.contentView.trailingAnchor),
        ])
    }
    private func updateHomePill() {
        ensureHomePill()
        let show = currentTab != 0
        guard show != homePillShown else { return }
        homePillShown = show
        if show {
            homePill.isHidden = false
            homePill.transform = CGAffineTransform(translationX: 0, y: 26)
            UIView.animate(withDuration: 0.55, delay: 0.05, usingSpringWithDamping: 0.78, initialSpringVelocity: 0.6, options: [.curveEaseOut]) {
                self.homePill.alpha = 1
                self.homePill.transform = .identity
            }
        } else {
            UIView.animate(withDuration: 0.22, animations: {
                self.homePill.alpha = 0
                self.homePill.transform = CGAffineTransform(translationX: 0, y: 22)
            }) { _ in
                self.homePill.isHidden = true
                self.homePill.transform = .identity
            }
        }
    }

    func showTab(_ tab: Int, animated: Bool) {
        guard tab >= 0, tab < tabTitles.count else { return }
        currentTab = tab
        categoryTabs.select(tab)
        updateHomePill()
        scrollPageToTop(tab)   // 탭 전환 시 목적 페이지를 항상 최상단에서 시작
        let w = pager.bounds.width
        if w > 0 { pager.setContentOffset(CGPoint(x: CGFloat(tab) * w, y: 0), animated: animated) }
    }

    // 좌우 스와이프로 페이저를 끌기 시작하면 이동할 양옆 페이지를 미리 최상단으로 (전환 후 살짝 내려가 보이는 문제 방지)
    func scrollViewWillBeginDragging(_ sv: UIScrollView) {
        guard sv == pager else { return }
        scrollPageToTop(currentTab - 1)
        scrollPageToTop(currentTab + 1)
    }

    func scrollViewDidEndDecelerating(_ sv: UIScrollView) {
        guard sv == pager, pager.bounds.width > 0 else { return }
        let tab = Int(round(pager.contentOffset.x / pager.bounds.width))
        if tab != currentTab {
            currentTab = tab
            categoryTabs.select(tab)
            updateHomePill()   // 카테고리 탭이면 '홈 전체' 알약 등장
            Haptics.tap() // 스와이프 전환 진동
        }
    }

    // 페이지 세로 스크롤을 최상단으로 (탭 0 = 전체 홈, 1~3 = 카테고리)
    private func scrollPageToTop(_ tab: Int) {
        if tab == 0 {
            homeAll.scrollToTop()
        } else {
            let i = tab - 1
            guard i >= 0, i < catScrolls.count else { return }
            let s = catScrolls[i]
            s.setContentOffset(CGPoint(x: 0, y: -s.contentInset.top), animated: false)
        }
    }

    // categoryIndex: 1=결혼식,2=행사,3=외국어
    func setPros(categoryIndex: Int, items: [HomeProItem]) {
        let idx = categoryIndex - 1
        guard idx >= 0, idx < catLists.count else { return }
        let list = catLists[idx]
        list.arrangedSubviews.forEach { $0.removeFromSuperview() }
        catEmpties[idx].text = items.isEmpty ? "사회자가 없습니다" : ""
        catEmpties[idx].isHidden = !items.isEmpty
        for item in items.prefix(100) {
            let cell = HomeProCell(item: item)
            cell.onTap = { [weak self] id in self?.delegate?.homeOpenPro(id) }
            list.addArrangedSubview(cell)
        }
    }
}

// NativeHomeAllView(전체) 액션을 상위 델리게이트로 전달
extension NativeHomeContent: NativeHomeAllDelegate {
    func homeOpenWeddingFind() { delegate?.homeOpenWeddingFind() }
    func homeOpenEventRequest() { delegate?.homeOpenEventRequest() }
    func homeOpenPath(_ path: String) { delegate?.homeOpenPath(path) }
    func homeOpenPro(_ id: String) { delegate?.homeOpenPro(id) }
    func homeOpenBusiness(_ id: String) { delegate?.homeOpenBusiness(id) }
    func homeOpenBanner(_ link: String) { delegate?.homeOpenBanner(link) }
}

// MARK: - 히어로 카드 (정사각형, 배경 이미지 + 흰 그라데이션 + 타이틀 + 프레스 애니메이션)
final class HeroCardView: UIControl {
    var onTap: (() -> Void)?
    private let bg = UIImageView()
    private let overlay = CAGradientLayer()
    private var lastTouchPoint: CGPoint = .zero // 물결(Ripple) 시작점 = 탭 위치
    private var didAutoRipple = false           // 데모: 등장 후 1회 자동 물결

    init(imageURL: String, line1: String, line2: String, showChevron: Bool, badge: String? = nil) {
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

        if let badge = badge {
            let pill = PaddingLabel()
            pill.text = badge
            pill.font = .systemFont(ofSize: 11, weight: .bold)
            pill.textColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
            pill.backgroundColor = UIColor(red: 0.90, green: 0.94, blue: 1.0, alpha: 0.95)
            pill.layer.cornerRadius = 11
            pill.clipsToBounds = true
            pill.translatesAutoresizingMaskIntoConstraints = false
            pill.isUserInteractionEnabled = false
            addSubview(pill)
            NSLayoutConstraint.activate([
                pill.topAnchor.constraint(equalTo: topAnchor, constant: 12),
                pill.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            ])
        }

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
    override func beginTracking(_ touch: UITouch, with event: UIEvent?) -> Bool {
        lastTouchPoint = touch.location(in: self)
        return super.beginTracking(touch, with: event)
    }
    @objc private func fire() {
        Haptics.tap()
        // 애플 Metal 셰이더 물결 — 탭 지점에서 퍼짐. 네비게이션은 물결이 보이도록 살짝 지연(데모).
        playRipple(at: lastTouchPoint == .zero ? CGPoint(x: bounds.midX, y: bounds.midY) : lastTouchPoint)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { [weak self] in self?.onTap?() }
    }
    // 데모: 홈 등장 후 3초마다 카드 중앙에서 자동 물결 반복 (효과 미리보기용 — 확정 시 제거)
    override func didMoveToWindow() {
        super.didMoveToWindow()
        guard window != nil, !didAutoRipple else { return }
        didAutoRipple = true
        Timer.scheduledTimer(withTimeInterval: 3.0, repeats: true) { [weak self] t in
            guard let self else { t.invalidate(); return }
            guard self.window != nil, self.bounds.width > 10 else { return }
            self.playRipple(at: CGPoint(x: self.bounds.midX, y: self.bounds.midY))
        }
    }
}

// MARK: - 카테고리 보더 탭 (전체/결혼식/행사/외국어)
// MARK: - 카테고리 글래스 알약 탭 (전체/결혼식/행사/외국어) — 웨딩파트너 list 패리티
// 블러는 NativeHomeContent.topBlur 가 담당 → 배경 투명, 알약만 글래스. 가로 스크롤로 겹침 방지.
final class HomeCategoryTabsView: UIView {
    var onSelect: ((Int) -> Void)?

    private let tabScroll = UIScrollView()
    private let tabStack = UIStackView()
    private var cells: [(button: UIButton, tint: UIView)] = []
    private var selectedIndex = 0

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .clear

        tabScroll.translatesAutoresizingMaskIntoConstraints = false
        tabScroll.showsHorizontalScrollIndicator = false
        tabScroll.contentInsetAdjustmentBehavior = .never
        addSubview(tabScroll)

        tabStack.axis = .horizontal
        tabStack.spacing = 8
        tabStack.alignment = .center
        tabStack.translatesAutoresizingMaskIntoConstraints = false
        tabScroll.addSubview(tabStack)

        NSLayoutConstraint.activate([
            tabScroll.leadingAnchor.constraint(equalTo: leadingAnchor),
            tabScroll.trailingAnchor.constraint(equalTo: trailingAnchor),
            tabScroll.centerYAnchor.constraint(equalTo: centerYAnchor),
            tabScroll.heightAnchor.constraint(equalToConstant: 36),

            tabStack.topAnchor.constraint(equalTo: tabScroll.contentLayoutGuide.topAnchor),
            tabStack.bottomAnchor.constraint(equalTo: tabScroll.contentLayoutGuide.bottomAnchor),
            tabStack.leadingAnchor.constraint(equalTo: tabScroll.contentLayoutGuide.leadingAnchor, constant: 14),
            tabStack.trailingAnchor.constraint(equalTo: tabScroll.contentLayoutGuide.trailingAnchor, constant: -14),
            tabStack.heightAnchor.constraint(equalTo: tabScroll.heightAnchor),
        ])
    }

    func configure(tabs: [String]) {
        tabStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        cells = tabs.enumerated().map { (i, t) in
            let pill = GlassPill(corner: 16)

            let tint = UIView()
            tint.translatesAutoresizingMaskIntoConstraints = false
            tint.backgroundColor = UIColor(white: 0.1, alpha: 1)   // 선택 시 다크 캡슐
            tint.alpha = 0
            tint.isUserInteractionEnabled = false

            let b = UIButton(type: .system)
            b.translatesAutoresizingMaskIntoConstraints = false
            b.setTitle(t, for: .normal)
            b.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
            b.setTitleColor(UIColor(white: 0.28, alpha: 1), for: .normal)
            b.tag = i
            b.addTarget(self, action: #selector(tap(_:)), for: .touchUpInside)

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
            tabStack.addArrangedSubview(pill)
            return (b, tint)
        }
        selectedIndex = 0
        highlight()
    }

    @objc private func tap(_ b: UIButton) { Haptics.tap(); onSelect?(b.tag) }

    func select(_ index: Int) {
        guard index >= 0, index < cells.count else { return }
        selectedIndex = index
        highlight()
    }

    private func highlight() {
        UIView.animate(withDuration: 0.2) {
            for (i, c) in self.cells.enumerated() {
                let on = i == self.selectedIndex
                c.tint.alpha = on ? 1 : 0
                c.button.setTitleColor(on ? .white : UIColor(white: 0.28, alpha: 1), for: .normal)
            }
        }
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

        // 3:4 프로필 사진 (r20)
        let photo = UIImageView()
        photo.translatesAutoresizingMaskIntoConstraints = false
        photo.contentMode = .scaleAspectFill
        photo.clipsToBounds = true
        photo.layer.cornerRadius = 20
        photo.layer.cornerCurve = .continuous
        photo.backgroundColor = UIColor(white: 0.92, alpha: 1)
        photo.isUserInteractionEnabled = false
        addSubview(photo)
        NativeChatImageLoader.load(item.image, into: photo, fallback: NativeChatHeaderView.avatarPlaceholder)
        // 유튜브 영상 썸네일 배지 (웹 HomeProTabCard 동등)
        addYoutubeBadge(to: self, over: photo, youtubeUrl: item.youtubeUrl)

        let name = UILabel()
        name.text = item.name
        name.font = .systemFont(ofSize: 16, weight: .bold)
        name.textColor = UIColor(white: 0.1, alpha: 1)

        // 경력 태그
        let career = PaddingLabel()
        career.text = item.careerYears > 0 ? "경력 \(item.careerYears)년" : "경력 확인중"
        career.font = .systemFont(ofSize: 11, weight: .semibold)
        career.textColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
        career.backgroundColor = UIColor(red: 0.92, green: 0.95, blue: 1.0, alpha: 1)
        career.layer.cornerRadius = 6
        career.clipsToBounds = true

        let rating = UILabel()
        rating.text = item.rating > 0 ? String(format: "★ %.1f (%d)", item.rating, item.reviewCount) : "★ 신규"
        rating.font = .systemFont(ofSize: 12, weight: .medium)
        rating.textColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)

        let metaRow = UIStackView(arrangedSubviews: [career, rating])
        metaRow.axis = .horizontal
        metaRow.spacing = 6
        metaRow.alignment = .center

        let intro = UILabel()
        intro.text = item.intro
        intro.font = .systemFont(ofSize: 12.5)
        intro.textColor = UIColor(white: 0.5, alpha: 1)
        intro.numberOfLines = 1

        var rows: [UIView] = [name, metaRow]
        if !item.intro.isEmpty { rows.append(intro) }
        if !item.tags.isEmpty {
            let tagsRow = UIStackView()
            tagsRow.axis = .horizontal
            tagsRow.spacing = 4
            tagsRow.alignment = .center
            for t in item.tags.prefix(3) {
                let chip = PaddingLabel()
                chip.text = t
                chip.inset = UIEdgeInsets(top: 2, left: 7, bottom: 2, right: 7)
                chip.font = .systemFont(ofSize: 10.5, weight: .medium)
                chip.textColor = UIColor(white: 0.42, alpha: 1)
                chip.backgroundColor = UIColor(white: 0.94, alpha: 1)
                chip.layer.cornerRadius = 8
                chip.clipsToBounds = true
                tagsRow.addArrangedSubview(chip)
            }
            tagsRow.addArrangedSubview(UIView())   // 좌측 정렬 스페이서
            rows.append(tagsRow)
        }
        let col = UIStackView(arrangedSubviews: rows)
        col.axis = .vertical
        col.spacing = 5
        col.alignment = .leading
        col.translatesAutoresizingMaskIntoConstraints = false
        col.isUserInteractionEnabled = false
        addSubview(col)

        NSLayoutConstraint.activate([
            photo.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            photo.centerYAnchor.constraint(equalTo: centerYAnchor),
            photo.widthAnchor.constraint(equalToConstant: 66),
            photo.heightAnchor.constraint(equalToConstant: 88),   // 3:4
            col.leadingAnchor.constraint(equalTo: photo.trailingAnchor, constant: 14),
            col.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -12),
            col.centerYAnchor.constraint(equalTo: centerYAnchor),
            heightAnchor.constraint(equalToConstant: 118),   // 태그 행 포함
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
    private let indicator = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
    private let indicatorLabel = UILabel()
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

        // 글래스 페이지 인디케이터 (1 / N) — 중앙 정렬
        indicator.translatesAutoresizingMaskIntoConstraints = false
        indicator.layer.cornerRadius = 12; indicator.layer.cornerCurve = .continuous
        indicator.clipsToBounds = true
        indicator.layer.borderWidth = 0.5; indicator.layer.borderColor = UIColor.white.withAlphaComponent(0.4).cgColor
        indicator.contentView.backgroundColor = UIColor(white: 0, alpha: 0.22)
        indicator.isHidden = true
        addSubview(indicator)
        indicatorLabel.translatesAutoresizingMaskIntoConstraints = false
        indicatorLabel.font = .systemFont(ofSize: 11, weight: .semibold)
        indicatorLabel.textColor = .white
        indicatorLabel.textAlignment = .center
        indicator.contentView.addSubview(indicatorLabel)

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
            indicator.heightAnchor.constraint(equalToConstant: 24),
            indicatorLabel.topAnchor.constraint(equalTo: indicator.contentView.topAnchor),
            indicatorLabel.bottomAnchor.constraint(equalTo: indicator.contentView.bottomAnchor),
            indicatorLabel.leadingAnchor.constraint(equalTo: indicator.contentView.leadingAnchor, constant: 11),
            indicatorLabel.trailingAnchor.constraint(equalTo: indicator.contentView.trailingAnchor, constant: -11),
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
        indicatorLabel.text = "\(current + 1) / \(banners.count)"
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
