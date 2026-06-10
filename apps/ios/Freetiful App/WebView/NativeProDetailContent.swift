import UIKit

protocol NativeProDetailDelegate: AnyObject {
    func proDetailInquiry(_ id: String)
    func proDetailOpen(_ id: String)
    func proDetailOpenReviews(_ id: String)
}

// MARK: - 레이더 차트 (웹 RadarChart 동일 — 6축 헥사곤)
final class RadarChartView: UIView {
    var scores: [Double] = [] { didSet { setNeedsDisplay() } }
    var labels: [String] = [] { didSet { setNeedsDisplay() } }
    var empty = false { didSet { setNeedsDisplay() } }
    private let blue = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
    private let grid = UIColor(red: 0.898, green: 0.906, blue: 0.922, alpha: 1) // #E5E7EB

    override init(frame: CGRect) { super.init(frame: frame); backgroundColor = .clear; isOpaque = false; clipsToBounds = false }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func point(_ i: Int, _ scale: CGFloat, _ r: CGFloat, _ c: CGPoint) -> CGPoint {
        let n = max(1, labels.count)
        let angle = CGFloat.pi * 2 * CGFloat(i) / CGFloat(n) - CGFloat.pi / 2
        return CGPoint(x: c.x + cos(angle) * r * scale, y: c.y + sin(angle) * r * scale)
    }

    override func draw(_ rect: CGRect) {
        let n = labels.count
        guard n > 0 else { return }
        let c = CGPoint(x: rect.midX, y: rect.midY)
        let r = min(rect.width, rect.height) / 2 - 24   // 라벨 공간 확보

        // 그리드 헥사곤
        grid.setStroke()
        for scale in [0.2, 0.4, 0.6, 0.8, 1.0] as [CGFloat] {
            let p = UIBezierPath()
            for i in 0..<n {
                let pt = point(i, scale, r, c)
                if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
            }
            p.close(); p.lineWidth = 0.8; p.stroke()
        }
        // 축선
        for i in 0..<n {
            let p = UIBezierPath(); p.move(to: c); p.addLine(to: point(i, 1, r, c)); p.lineWidth = 0.8; p.stroke()
        }
        // 데이터 폴리곤
        let fill = empty ? UIColor(white: 0.61, alpha: 0.18) : blue.withAlphaComponent(0.2)
        let stroke = empty ? UIColor(white: 0.61, alpha: 1) : blue
        let dp = UIBezierPath()
        for i in 0..<n {
            let v = empty ? 3.0 : (i < scores.count ? scores[i] : 0)
            let pt = point(i, CGFloat(v) / 5.0, r, c)
            if i == 0 { dp.move(to: pt) } else { dp.addLine(to: pt) }
        }
        dp.close()
        fill.setFill(); dp.fill()
        stroke.setStroke(); dp.lineWidth = 2; dp.lineJoinStyle = .round
        if empty { dp.setLineDash([4, 4], count: 2, phase: 0) }
        dp.stroke()
        // 데이터 점
        if !empty {
            stroke.setFill()
            for i in 0..<n where i < scores.count {
                let pt = point(i, CGFloat(scores[i]) / 5.0, r, c)
                UIBezierPath(ovalIn: CGRect(x: pt.x - 3, y: pt.y - 3, width: 6, height: 6)).fill()
            }
        }
        // 라벨
        let labelColor = empty ? UIColor(white: 0.61, alpha: 1) : UIColor(white: 0.42, alpha: 1)
        let attrs: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 11, weight: .semibold), .foregroundColor: labelColor]
        for i in 0..<n {
            let pt = point(i, 1.30, r, c)
            let s = labels[i] as NSString
            let sz = s.size(withAttributes: attrs)
            s.draw(at: CGPoint(x: pt.x - sz.width / 2, y: pt.y - sz.height / 2), withAttributes: attrs)
        }
    }
}

// MARK: - 추천 카드 (id 보유 탭 가능 컨트롤)
private final class RecoCardButton: UIControl {
    var proIdRef = ""
}

// MARK: - 종횡비 자동 이미지뷰 (상세설명 포트폴리오 이미지 — 로드된 이미지 비율로 높이 결정)
private final class AspectImageView: UIImageView {
    private var aspect: NSLayoutConstraint?
    override var image: UIImage? {
        didSet {
            guard let img = image, img.size.width > 0 else { return }
            let ratio = min(2.0, img.size.height / img.size.width)   // 너무 긴 이미지 방지
            aspect?.isActive = false
            let c = heightAnchor.constraint(equalTo: widthAnchor, multiplier: ratio)
            c.priority = .required
            c.isActive = true
            aspect = c
            setNeedsLayout()   // 동기 전체 레이아웃 강제 안 함 — 다음 사이클에 배치 처리(이미지별 thrashing 방지)
        }
    }
}

// MARK: - 섹션 탭바 (인라인=흰배경+보더 / 플로팅=글래스, 인디케이터 슬라이드 애니메이션)
final class DetailTabBar: UIView {
    var onTap: ((Int) -> Void)?
    private let stack = UIStackView()
    private let indicator = UIView()
    private var buttons: [UIButton] = []
    private(set) var activeIndex = 0
    private let blue = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
    private let inactive = UIColor(white: 0.6, alpha: 1)

    init(glass: Bool) {
        super.init(frame: .zero)
        if glass {
            let fx = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
            fx.contentView.backgroundColor = UIColor.white.withAlphaComponent(0.5)
            fx.translatesAutoresizingMaskIntoConstraints = false
            addSubview(fx)
            NSLayoutConstraint.activate([
                fx.topAnchor.constraint(equalTo: topAnchor), fx.bottomAnchor.constraint(equalTo: bottomAnchor),
                fx.leadingAnchor.constraint(equalTo: leadingAnchor), fx.trailingAnchor.constraint(equalTo: trailingAnchor),
            ])
        } else {
            backgroundColor = .white
        }
        // 하단 보더 (얇은 회색)
        let border = UIView(); border.backgroundColor = UIColor(white: 0.89, alpha: 1)
        border.translatesAutoresizingMaskIntoConstraints = false
        addSubview(border)
        stack.axis = .horizontal; stack.distribution = .fillEqually
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        addSubview(indicator)
        indicator.backgroundColor = blue; indicator.layer.cornerRadius = 1
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor), stack.bottomAnchor.constraint(equalTo: bottomAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor), stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            border.leadingAnchor.constraint(equalTo: leadingAnchor), border.trailingAnchor.constraint(equalTo: trailingAnchor),
            border.bottomAnchor.constraint(equalTo: bottomAnchor), border.heightAnchor.constraint(equalToConstant: 1),
        ])
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func configure(_ titles: [String]) {
        buttons.forEach { $0.removeFromSuperview() }; buttons = []
        for (i, t) in titles.enumerated() {
            let b = UIButton(type: .system)
            b.setTitle(t, for: .normal)
            b.titleLabel?.font = .systemFont(ofSize: 15, weight: .semibold)
            b.tag = i
            b.addTarget(self, action: #selector(tap(_:)), for: .touchUpInside)
            buttons.append(b); stack.addArrangedSubview(b)
        }
        activeIndex = 0
        setNeedsLayout(); layoutIfNeeded()
        applyColors()
    }
    @objc private func tap(_ s: UIButton) { onTap?(s.tag) }

    func setActive(_ index: Int, animated: Bool) {
        guard index >= 0, index < buttons.count, index != activeIndex || !animated else {
            if index == activeIndex { return }; return
        }
        activeIndex = index
        applyColors()
        let target = indicatorFrame(index)
        if animated {
            UIView.animate(withDuration: 0.4, delay: 0, options: [.curveEaseInOut]) { self.indicator.frame = target }
        } else { indicator.frame = target }
    }
    private func applyColors() {
        for (i, b) in buttons.enumerated() { b.setTitleColor(i == activeIndex ? blue : inactive, for: .normal) }
    }
    private func indicatorFrame(_ index: Int) -> CGRect {
        let n = max(1, buttons.count)
        let segW = bounds.width / CGFloat(n)
        return CGRect(x: CGFloat(index) * segW + segW * 0.2, y: bounds.height - 2.5, width: segW * 0.6, height: 2.5)
    }
    override func layoutSubviews() {
        super.layoutSubviews()
        indicator.frame = indicatorFrame(activeIndex)
    }
}

// MARK: - 그라데이션 스윕 텍스트 (#B0B8C1 → 파란 그라데이션 통과 → #191F28, 한 줄씩 고급스럽게)
final class GradientSweepLabel: UILabel {
    var sweepDelay: CFTimeInterval = 0
    private let gradient = CAGradientLayer()
    private let textMask = CATextLayer()
    private var animated = false

    override init(frame: CGRect) { super.init(frame: frame); setupSweep() }
    required init?(coder: NSCoder) { super.init(coder: coder); setupSweep() }

    private func setupSweep() {
        textColor = .clear   // 베이스 텍스트 숨김 — 그라데이션으로 표현
        numberOfLines = 0
        let dark = UIColor(red: 25/255, green: 31/255, blue: 40/255, alpha: 1)     // #191F28
        let blue = UIColor(red: 49/255, green: 130/255, blue: 246/255, alpha: 1)   // #3182F6
        let gray = UIColor(red: 176/255, green: 184/255, blue: 193/255, alpha: 1)  // #B0B8C1
        gradient.colors = [dark.cgColor, blue.cgColor, gray.cgColor]
        gradient.startPoint = CGPoint(x: 0, y: 0.5)
        gradient.endPoint = CGPoint(x: 1, y: 0.5)
        gradient.locations = [-0.45, -0.2, 0.0]   // 시작: 전부 회색
        layer.addSublayer(gradient)
        textMask.contentsScale = UIScreen.main.scale
        textMask.isWrapped = true
        textMask.truncationMode = .none
        textMask.alignmentMode = .left
        gradient.mask = textMask
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        gradient.frame = bounds
        textMask.frame = bounds
        textMask.string = NSAttributedString(string: text ?? "", attributes: [.font: font as Any, .foregroundColor: UIColor.black])
        if !animated, bounds.width > 1 { animated = true; runSweep() }
    }

    private func runSweep() {
        let a = CABasicAnimation(keyPath: "locations")
        a.fromValue = [-0.45, -0.2, 0.0]
        a.toValue = [1.0, 1.2, 1.45]
        a.duration = 1.15
        a.beginTime = CACurrentMediaTime() + sweepDelay
        a.fillMode = .both
        a.isRemovedOnCompletion = false
        a.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        gradient.add(a, forKey: "sweep")
    }
}

// MARK: - 접기/펼치기 콘텐츠 (긴 서비스 설명 — 기본 접힘 + 글래스 펼쳐보기 버튼 + 애니메이션)
final class CollapsibleContent: UIView {
    private let clipper = UIView()
    private let fade = UIView()
    private let fadeGradient = CAGradientLayer()
    private let toggle = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
    private let toggleLabel = UILabel()
    private let chevron = UIImageView()
    private var cap: NSLayoutConstraint!
    private let collapsedH: CGFloat
    private var expanded = false
    private let blue = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)

    init(content: UIView, collapsedHeight: CGFloat = 340) {
        collapsedH = collapsedHeight
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        clipper.clipsToBounds = true
        clipper.translatesAutoresizingMaskIntoConstraints = false
        addSubview(clipper)
        content.translatesAutoresizingMaskIntoConstraints = false
        clipper.addSubview(content)

        fade.translatesAutoresizingMaskIntoConstraints = false
        fade.isUserInteractionEnabled = false
        fadeGradient.colors = [UIColor.white.withAlphaComponent(0).cgColor, UIColor.white.cgColor]
        fade.layer.addSublayer(fadeGradient)
        addSubview(fade)

        // 글래스 펼쳐보기 버튼
        toggle.translatesAutoresizingMaskIntoConstraints = false
        toggle.layer.cornerRadius = 19; toggle.layer.cornerCurve = .continuous; toggle.clipsToBounds = true
        toggle.layer.borderWidth = 1; toggle.layer.borderColor = UIColor.white.withAlphaComponent(0.6).cgColor
        toggle.contentView.backgroundColor = blue.withAlphaComponent(0.10)
        toggleLabel.text = "더보기"; toggleLabel.font = .systemFont(ofSize: 13.5, weight: .bold); toggleLabel.textColor = blue
        chevron.image = UIImage(systemName: "chevron.down", withConfiguration: UIImage.SymbolConfiguration(pointSize: 11, weight: .bold))
        chevron.tintColor = blue
        let row = UIStackView(arrangedSubviews: [toggleLabel, chevron]); row.axis = .horizontal; row.spacing = 5; row.alignment = .center
        row.translatesAutoresizingMaskIntoConstraints = false
        row.isUserInteractionEnabled = false
        toggle.contentView.addSubview(row)
        addSubview(toggle)
        toggle.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(tapToggle)))

        cap = clipper.heightAnchor.constraint(lessThanOrEqualToConstant: collapsedH)
        cap.isActive = true
        let fitBottom = clipper.bottomAnchor.constraint(equalTo: content.bottomAnchor); fitBottom.priority = .defaultHigh; fitBottom.isActive = true

        NSLayoutConstraint.activate([
            clipper.topAnchor.constraint(equalTo: topAnchor),
            clipper.leadingAnchor.constraint(equalTo: leadingAnchor),
            clipper.trailingAnchor.constraint(equalTo: trailingAnchor),
            content.topAnchor.constraint(equalTo: clipper.topAnchor),
            content.leadingAnchor.constraint(equalTo: clipper.leadingAnchor),
            content.trailingAnchor.constraint(equalTo: clipper.trailingAnchor),
            fade.leadingAnchor.constraint(equalTo: leadingAnchor),
            fade.trailingAnchor.constraint(equalTo: trailingAnchor),
            fade.bottomAnchor.constraint(equalTo: clipper.bottomAnchor),
            fade.heightAnchor.constraint(equalToConstant: 56),
            toggle.topAnchor.constraint(equalTo: clipper.bottomAnchor, constant: 10),
            toggle.centerXAnchor.constraint(equalTo: centerXAnchor),
            toggle.heightAnchor.constraint(equalToConstant: 38),
            toggle.bottomAnchor.constraint(equalTo: bottomAnchor),
            row.centerXAnchor.constraint(equalTo: toggle.contentView.centerXAnchor),
            row.centerYAnchor.constraint(equalTo: toggle.contentView.centerYAnchor),
            row.leadingAnchor.constraint(greaterThanOrEqualTo: toggle.contentView.leadingAnchor, constant: 18),
        ])
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() {
        super.layoutSubviews()
        fadeGradient.frame = fade.bounds
        // 더보기 버튼은 항상 표시(접힘일 때), 펼치면 페이드만 숨김
        fade.isHidden = expanded
    }

    @objc private func tapToggle() {
        Haptics.tap()
        expanded.toggle()
        cap.isActive = !expanded
        toggleLabel.text = expanded ? "접기" : "더보기"
        UIView.animate(withDuration: 0.34, delay: 0, options: [.curveEaseInOut]) {
            self.chevron.transform = self.expanded ? CGAffineTransform(rotationAngle: .pi) : .identity
            self.fade.alpha = self.expanded ? 0 : 1
            self.superview?.superview?.superview?.layoutIfNeeded()
        } completion: { _ in self.setNeedsLayout() }
    }
}

// 사회자 상세 네이티브 — 사진 카루셀 + 정보 + 서비스설명 + 추천 + 리뷰(레이더) + FAQ + 글래스 CTA
final class NativeProDetailContent: UIView, UIScrollViewDelegate {
    weak var delegate: NativeProDetailDelegate?

    private let scrollView = UIScrollView()
    private let contentStack = UIStackView()
    private let loadingLabel = UILabel()

    // 카루셀
    private let carousel = UIScrollView()
    private let carouselRow = UIStackView()
    private let pageDots = UIStackView()
    private var dotViews: [UIView] = []
    private let pageBadge = UILabel()
    // 히어로 캐러셀(가운데 크게 + 양옆 peek + 스와이프 시 스무스 스케일)
    private var carouselItems: [UIView] = []
    private var carItemW: CGFloat = 0
    private var carSpacing: CGFloat = 12
    private var carHeight: CGFloat = 0
    private var carLeftInset: CGFloat = 0
    private let carMinScale: CGFloat = 0.9
    private var carPeek = false

    // CTA (글래스)
    private let ctaBar = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
    private let ctaButton = UIButton(type: .system)
    private let ctaHighlight = CAGradientLayer()

    private let blue = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
    private var proId = ""
    private var hasContent = false
    private var topInset: CGFloat = 0
    private var contentTop: NSLayoutConstraint!

    // 섹션 탭 (인라인 + 스티키 글래스)
    private let inlineTabBar = DetailTabBar(glass: false)
    private let floatingTabBar = DetailTabBar(glass: true)
    private var floatingTop: NSLayoutConstraint!
    private var tabSections: [UIView] = []        // 탭 인덱스 → 섹션 뷰
    private var inlineTabHolder: UIView?          // 인라인 탭바의 스택 내 위치(스티키 임계점 계산)
    private var isAutoScrolling = false
    private var youtubeURLString = ""
    var onScroll: ((CGFloat) -> Void)?   // 헤더 글래스 진행도(0=히어로 위, 1=히어로 가림)

    private let scoreLabels = ["경력", "만족도", "위트", "발성", "이미지", "구성력"]

    // 표시 리뷰 모델
    struct DisplayReview {
        let name: String; let rating: Double; let date: String
        let scores: [String: Double]; let content: String; let badge: String
    }

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setInsets(top: CGFloat, bottom: CGFloat) {
        topInset = top
        contentTop?.constant = -top
        scrollView.contentInset = UIEdgeInsets(top: top, left: 0, bottom: 96, right: 0)
        scrollView.verticalScrollIndicatorInsets = UIEdgeInsets(top: top, left: 0, bottom: 96, right: 0)
        scrollView.contentOffset = CGPoint(x: 0, y: -top)
        floatingTop?.constant = top   // 스티키 탭바를 헤더 바로 아래에
    }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = UIColor(red: 0.969, green: 0.973, blue: 0.980, alpha: 1)

        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = true
        scrollView.showsVerticalScrollIndicator = false
        scrollView.contentInsetAdjustmentBehavior = .never
        scrollView.delegate = self
        addSubview(scrollView)

        contentStack.axis = .vertical
        contentStack.spacing = 12
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(contentStack)

        loadingLabel.text = "불러오는 중…"
        loadingLabel.font = .systemFont(ofSize: 14)
        loadingLabel.textColor = UIColor(white: 0.6, alpha: 1)
        loadingLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(loadingLabel)

        // CTA 바 — 글래스 캡슐 (블루 틴트 + 상단 하이라이트 + 화이트 보더)
        ctaBar.translatesAutoresizingMaskIntoConstraints = false
        ctaBar.layer.cornerRadius = 28
        ctaBar.layer.cornerCurve = .continuous
        ctaBar.clipsToBounds = true
        ctaBar.layer.borderWidth = 1
        ctaBar.layer.borderColor = UIColor.white.withAlphaComponent(0.55).cgColor
        addSubview(ctaBar)
        // #2C53FF @ 60% 글래스
        ctaBar.contentView.backgroundColor = UIColor(red: 44/255, green: 83/255, blue: 255/255, alpha: 0.6)
        // 상단 유리 하이라이트
        ctaHighlight.colors = [UIColor.white.withAlphaComponent(0.45).cgColor, UIColor.white.withAlphaComponent(0.0).cgColor]
        ctaHighlight.startPoint = CGPoint(x: 0.5, y: 0)
        ctaHighlight.endPoint = CGPoint(x: 0.5, y: 1)
        ctaBar.contentView.layer.addSublayer(ctaHighlight)

        var cfg = UIButton.Configuration.plain()
        cfg.title = "이 사회자에게 문의하기"
        cfg.baseForegroundColor = .white
        cfg.contentInsets = NSDirectionalEdgeInsets(top: 14, leading: 20, bottom: 14, trailing: 20)
        cfg.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
            var out = incoming
            out.font = .systemFont(ofSize: 16.5, weight: .bold)   // weight 700
            out.foregroundColor = .white
            return out
        }
        ctaButton.configuration = cfg
        ctaButton.translatesAutoresizingMaskIntoConstraints = false
        ctaButton.addTarget(self, action: #selector(ctaTapped), for: .touchUpInside)
        ctaBar.contentView.addSubview(ctaButton)

        // 스티키 글래스 탭바 (헤더가 인라인 탭을 가리면 표출)
        floatingTabBar.translatesAutoresizingMaskIntoConstraints = false
        floatingTabBar.alpha = 0
        floatingTabBar.isHidden = true
        floatingTabBar.onTap = { [weak self] i in self?.scrollToSection(i) }
        inlineTabBar.onTap = { [weak self] i in self?.scrollToSection(i) }
        addSubview(floatingTabBar)
        floatingTop = floatingTabBar.topAnchor.constraint(equalTo: topAnchor, constant: 0)

        contentTop = contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor)
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: bottomAnchor),
            contentTop,
            contentStack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor),
            contentStack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -24),
            loadingLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            loadingLabel.centerYAnchor.constraint(equalTo: centerYAnchor),
            ctaBar.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            ctaBar.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            ctaBar.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.bottomAnchor, constant: -10),
            ctaBar.heightAnchor.constraint(equalToConstant: 56),
            ctaButton.topAnchor.constraint(equalTo: ctaBar.contentView.topAnchor),
            ctaButton.bottomAnchor.constraint(equalTo: ctaBar.contentView.bottomAnchor),
            ctaButton.leadingAnchor.constraint(equalTo: ctaBar.contentView.leadingAnchor),
            ctaButton.trailingAnchor.constraint(equalTo: ctaBar.contentView.trailingAnchor),
            floatingTop,
            floatingTabBar.leadingAnchor.constraint(equalTo: leadingAnchor),
            floatingTabBar.trailingAnchor.constraint(equalTo: trailingAnchor),
            floatingTabBar.heightAnchor.constraint(equalToConstant: 50),
        ])
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        ctaHighlight.frame = CGRect(x: 0, y: 0, width: ctaBar.bounds.width, height: ctaBar.bounds.height * 0.55)
    }

    @objc private func ctaTapped() { Haptics.tap(); delegate?.proDetailInquiry(proId) }
    @objc private func recoTapped(_ sender: RecoCardButton) { Haptics.tap(); delegate?.proDetailOpen(sender.proIdRef) }

    // 프로필 수정 등으로 캐시가 무효화됐을 때 — 다음 진입 시 신선 재로딩 강제
    func invalidate() {
        hasContent = false
        proId = ""
    }
    func loadDetail(id: String) {
        if id == proId && hasContent { return }   // 이미 같은 사회자 표시 중 — 깜빡임/클로버 방지
        proId = id
        hasContent = false
        loadingLabel.text = "불러오는 중…"
        loadingLabel.isHidden = false
        contentStack.isHidden = true
        ctaBar.isHidden = true
        NativeHomeData.loadProDetail(id) { [weak self] d in
            guard let self = self, self.proId == id else { return }
            guard let d = d else { if !self.hasContent { self.loadingLabel.text = "불러오지 못했습니다" }; return }
            let animated = !self.hasContent
            self.render(d, animated: animated)
            self.hasContent = true
        }
    }

    private func render(_ d: [String: Any], animated: Bool) {
        // 에러/부분 응답(이름·이미지 전무)이 이미 표시된 정상 콘텐츠를 덮어쓰지 않도록 방어
        let guardName = ((d["user"] as? [String: Any])?["name"] as? String) ?? (d["name"] as? String) ?? ""
        if hasContent && guardName.isEmpty && imageUrls(d["images"]).isEmpty { return }
        loadingLabel.isHidden = true
        contentStack.isHidden = false
        ctaBar.isHidden = false
        let prevOffset = scrollView.contentOffset
        contentStack.arrangedSubviews.forEach { $0.removeFromSuperview() }

        // ── 데이터 (상세 또는 리스트-부분 dict 모두 대응) ──
        let user = d["user"] as? [String: Any]
        let name = (user?["name"] as? String) ?? (d["name"] as? String) ?? "사회자"
        let rating = (d["avgRating"] as? Double) ?? Double(intVal(d["avgRating"]))
        let reviewCount = intVal(d["reviewCount"])
        let tags = strArr(d["tagList"]).isEmpty ? strArr(d["tags"]) : strArr(d["tagList"])
        let category = strArr(d["categoryNames"]).first ?? strArr(d["categories"]).first ?? "사회자"
        let images = imageUrls(d["images"])
        let detailHtml = (d["detailHtml"] as? String) ?? ""
        let apiFaqs: [(String, String)] = (d["faqs"] as? [[String: Any]])?.compactMap { f in
            guard let q = (f["question"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines), !q.isEmpty,
                  let a = (f["answer"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines), !a.isEmpty else { return nil }
            return (q, a)
        } ?? []
        let apiReviews = d["reviews"] as? [[String: Any]] ?? []
        let avatar = (user?["profileImageUrl"] as? String) ?? (d["profileImageUrl"] as? String) ?? images.first ?? ""
        let isFeatured = (d["isFeatured"] as? Bool) ?? true
        let mainExp = (d["mainExperience"] as? String) ?? ""
        let responseRate = intVal(d["responseRate"])
        youtubeURLString = (d["youtubeUrl"] as? String) ?? ""

        // 표시 리뷰: API 본문 있으면 사용, 없으면 웹과 동일한 레거시 폴백 생성
        let displayReviews = Self.resolveReviews(api: apiReviews, reviewCount: reviewCount, rating: rating)
        // 점수: 표시 리뷰의 6축 평균, 없으면 avgRating 폴백
        let ratingFallback = (reviewCount > 0 && rating > 0) ? min(5, max(0, rating)) : 0
        let scoreValues: [Double] = scoreLabels.map { label in
            let vals = displayReviews.compactMap { $0.scores[label] }.filter { $0 > 0 }
            return vals.isEmpty ? ratingFallback : vals.reduce(0, +) / Double(vals.count)
        }
        let hasAnyScore = scoreValues.contains { $0 > 0 }
        let potential = Int((scoreValues.reduce(0) { $0 + $1 * 20 }).rounded())

        // ── 섹션 (추천은 맨 아래) ──
        contentStack.addArrangedSubview(buildCarousel(images))
        contentStack.addArrangedSubview(wrapPad(buildInfo(avatar: avatar, category: category, name: name,
            isFeatured: isFeatured, tags: tags, rating: rating, reviewCount: reviewCount, mainExp: mainExp)))

        // 섹션 탭바 (인라인) — 스크롤로 헤더에 가리면 스티키 글래스 탭으로 표출
        let inlineHolder = UIView()
        inlineTabBar.translatesAutoresizingMaskIntoConstraints = false
        inlineHolder.addSubview(inlineTabBar)
        NSLayoutConstraint.activate([
            inlineTabBar.topAnchor.constraint(equalTo: inlineHolder.topAnchor),
            inlineTabBar.bottomAnchor.constraint(equalTo: inlineHolder.bottomAnchor),
            inlineTabBar.leadingAnchor.constraint(equalTo: inlineHolder.leadingAnchor),
            inlineTabBar.trailingAnchor.constraint(equalTo: inlineHolder.trailingAnchor),
            inlineTabBar.heightAnchor.constraint(equalToConstant: 50),
        ])
        inlineTabHolder = inlineHolder
        contentStack.addArrangedSubview(inlineHolder)

        var titles: [String] = []
        tabSections = []
        if let desc = buildDescription(detailHtml, videoId: youtubeID(youtubeURLString)) {
            let w = wrapPad(desc); contentStack.addArrangedSubview(w)
            titles.append("서비스 설명"); tabSections.append(w)
        }
        let infoSec = wrapPad(buildProfileInfo(avatar: avatar, name: name, category: category,
            rating: rating, reviewCount: reviewCount, responseRate: responseRate, youtube: youtubeURLString))
        contentStack.addArrangedSubview(infoSec)
        titles.append("사회자 정보"); tabSections.append(infoSec)

        let reviewSec = wrapPad(buildReviews(displayReviews, rating: rating, count: reviewCount,
            scores: scoreValues, potential: potential, hasAnyScore: hasAnyScore))
        contentStack.addArrangedSubview(reviewSec)
        titles.append("리뷰 (\(reviewCount))"); tabSections.append(reviewSec)

        contentStack.addArrangedSubview(wrapPad(buildFaq(category: category,
            hasVideo: !youtubeURLString.isEmpty, custom: apiFaqs)))
        let recos = NativeHomeData.recommendedPros(excluding: proId, limit: 10)
        if !recos.isEmpty {
            contentStack.addArrangedSubview(buildRecommend(recos))
        }

        inlineTabBar.configure(titles)
        floatingTabBar.configure(titles)
        floatingTabBar.isHidden = true; floatingTabBar.alpha = 0

        layoutIfNeeded()
        updateCarouselScale()   // 레이아웃 직후 가운데 카드 1.0·양옆 축소 초기 적용
        if animated {
            let secs = contentStack.arrangedSubviews
            for (i, sec) in secs.enumerated() {
                sec.alpha = 0
                sec.transform = CGAffineTransform(translationX: 0, y: i == 0 ? 0 : 18)
            }
            for (i, sec) in secs.enumerated() {
                UIView.animate(withDuration: 0.55, delay: i == 0 ? 0 : 0.06 + Double(i) * 0.07, options: [.curveEaseOut]) {
                    sec.alpha = 1; sec.transform = .identity
                }
            }
            ctaBar.alpha = 0
            ctaBar.transform = CGAffineTransform(translationX: 0, y: 36)
            UIView.animate(withDuration: 0.5, delay: 0.25, options: [.curveEaseOut]) {
                self.ctaBar.alpha = 1; self.ctaBar.transform = .identity
            }
            scrollView.contentOffset = CGPoint(x: 0, y: -topInset)
        } else {
            // 재렌더(신선 데이터) — 애니메이션/점프 없이 자연스럽게 교체
            contentStack.arrangedSubviews.forEach { $0.alpha = 1; $0.transform = .identity }
            ctaBar.alpha = 1; ctaBar.transform = .identity
            scrollView.contentOffset = prevOffset
        }
    }

    // MARK: - 카루셀
    private func buildCarousel(_ images: [String]) -> UIView {
        let holder = UIView()
        let w = UIScreen.main.bounds.width
        let imgs = images.isEmpty ? [""] : images
        // 활성 카드 좌측정렬(살짝 왼쪽 여백) + 다음 카드 크게 peek. 1장이면 풀폭.
        carPeek = imgs.count > 1
        let itemW = carPeek ? round(w * 0.70) : w
        let h = carPeek ? round(w * 1.06) : w
        let leftInset: CGFloat = carPeek ? 18 : 0
        carItemW = itemW; carHeight = h; carLeftInset = leftInset
        carousel.translatesAutoresizingMaskIntoConstraints = false
        carousel.isPagingEnabled = false
        carousel.decelerationRate = .fast
        carousel.clipsToBounds = false   // 양옆 peek 카드가 보이도록
        carousel.showsHorizontalScrollIndicator = false
        carousel.delegate = self
        carousel.contentInsetAdjustmentBehavior = .never
        carousel.contentInset = UIEdgeInsets(top: 0, left: leftInset, bottom: 0, right: carPeek ? max(0, w - itemW - leftInset) : 0)
        carouselRow.arrangedSubviews.forEach { $0.removeFromSuperview() }
        carouselItems = []
        carouselRow.axis = .horizontal
        carouselRow.spacing = carPeek ? carSpacing : 0
        carouselRow.alignment = .center
        carouselRow.translatesAutoresizingMaskIntoConstraints = false
        carousel.addSubview(carouselRow)
        holder.addSubview(carousel)
        for u in imgs {
            let iv = UIImageView()
            iv.contentMode = .scaleAspectFill
            iv.clipsToBounds = true
            iv.layer.cornerRadius = carPeek ? 48 : 0
            iv.layer.cornerCurve = .continuous
            iv.backgroundColor = UIColor(white: 0.93, alpha: 1)
            iv.translatesAutoresizingMaskIntoConstraints = false
            NativeChatImageLoader.load(u, into: iv, fallback: NativeChatHeaderView.avatarPlaceholder)
            carouselRow.addArrangedSubview(iv)
            iv.widthAnchor.constraint(equalToConstant: itemW).isActive = true
            iv.heightAnchor.constraint(equalToConstant: h).isActive = true
            carouselItems.append(iv)
        }
        // 페이지 닷
        dotViews.forEach { $0.removeFromSuperview() }; dotViews = []
        pageDots.arrangedSubviews.forEach { $0.removeFromSuperview() }
        pageDots.axis = .horizontal; pageDots.spacing = 6
        pageDots.translatesAutoresizingMaskIntoConstraints = false
        if imgs.count > 1 {
            for i in 0..<imgs.count {
                let dot = UIView()
                dot.backgroundColor = i == 0 ? .white : UIColor.white.withAlphaComponent(0.5)
                dot.layer.cornerRadius = 3
                dot.translatesAutoresizingMaskIntoConstraints = false
                dot.widthAnchor.constraint(equalToConstant: 6).isActive = true
                dot.heightAnchor.constraint(equalToConstant: 6).isActive = true
                dotViews.append(dot)
                pageDots.addArrangedSubview(dot)
            }
            holder.addSubview(pageDots)
        }
        NSLayoutConstraint.activate([
            carousel.topAnchor.constraint(equalTo: holder.topAnchor, constant: carPeek ? 22 : 0),   // 상단에서 살짝 내림
            carousel.leadingAnchor.constraint(equalTo: holder.leadingAnchor),
            carousel.trailingAnchor.constraint(equalTo: holder.trailingAnchor),
            carousel.bottomAnchor.constraint(equalTo: holder.bottomAnchor),
            carousel.heightAnchor.constraint(equalToConstant: h),
            carouselRow.topAnchor.constraint(equalTo: carousel.contentLayoutGuide.topAnchor),
            carouselRow.bottomAnchor.constraint(equalTo: carousel.contentLayoutGuide.bottomAnchor),
            carouselRow.leadingAnchor.constraint(equalTo: carousel.contentLayoutGuide.leadingAnchor),
            carouselRow.trailingAnchor.constraint(equalTo: carousel.contentLayoutGuide.trailingAnchor),
            carouselRow.heightAnchor.constraint(equalTo: carousel.frameLayoutGuide.heightAnchor),
        ])
        if imgs.count > 1 {
            NSLayoutConstraint.activate([
                pageDots.centerXAnchor.constraint(equalTo: holder.centerXAnchor),
                pageDots.bottomAnchor.constraint(equalTo: holder.bottomAnchor, constant: -14),
            ])
        }
        DispatchQueue.main.async { [weak self] in self?.updateCarouselScale() }
        return holder
    }

    // 가운데 카드는 1.0, 양옆 카드는 carMinScale 까지 스무스 축소 (스크롤 위치 기반)
    private func updateCarouselScale() {
        guard carPeek, carItemW > 0 else { return }
        let step = carItemW + carSpacing
        let focus = carousel.contentOffset.x + carLeftInset   // 활성 카드 leading 의 컨텐츠 x
        for (i, item) in carouselItems.enumerated() {
            let itemLead = CGFloat(i) * step
            let t = min(1, abs(itemLead - focus) / step)
            let scale = 1 - t * (1 - carMinScale)
            item.transform = CGAffineTransform(scaleX: scale, y: scale)
        }
    }
    private func carouselIndex(forOffsetX x: CGFloat) -> Int {
        let step = carItemW + carSpacing
        let idx = Int(((x + carLeftInset) / step).rounded())
        return max(0, min(carouselItems.count - 1, idx))
    }
    private func carouselOffsetX(forIndex i: Int) -> CGFloat {
        let step = carItemW + carSpacing
        return CGFloat(i) * step - carLeftInset
    }
    func scrollViewWillEndDragging(_ sv: UIScrollView, withVelocity velocity: CGPoint, targetContentOffset: UnsafeMutablePointer<CGPoint>) {
        guard sv == carousel, carPeek else { return }
        let i = carouselIndex(forOffsetX: targetContentOffset.pointee.x)
        targetContentOffset.pointee.x = carouselOffsetX(forIndex: i)
    }

    func scrollViewDidScroll(_ sv: UIScrollView) {
        if sv == carousel {
            updateCarouselScale()
            guard carousel.bounds.width > 0, dotViews.count > 1 else { return }
            let page = carPeek ? carouselIndex(forOffsetX: carousel.contentOffset.x)
                               : Int(round(carousel.contentOffset.x / carousel.bounds.width))
            for (i, dot) in dotViews.enumerated() {
                dot.backgroundColor = i == page ? .white : UIColor.white.withAlphaComponent(0.5)
            }
            return
        }
        guard sv == scrollView else { return }
        updateStickyTabs()
        let heroH = carHeight > 0 ? carHeight : UIScreen.main.bounds.width
        onScroll?(max(0, min(1, (scrollView.contentOffset.y + topInset) / (heroH * 0.6))))
    }

    private func updateStickyTabs() {
        guard let holder = inlineTabHolder, !tabSections.isEmpty, scrollView.bounds.height > 0 else { return }
        let inlineY = holder.convert(holder.bounds, to: scrollView).minY
        let show = scrollView.contentOffset.y >= inlineY - topInset
        if show && floatingTabBar.isHidden {
            floatingTabBar.isHidden = false
            bringSubviewToFront(floatingTabBar)
            UIView.animate(withDuration: 0.2) { self.floatingTabBar.alpha = 1 }
        } else if !show && !floatingTabBar.isHidden {
            UIView.animate(withDuration: 0.2, animations: { self.floatingTabBar.alpha = 0 }) { _ in
                if self.floatingTabBar.alpha == 0 { self.floatingTabBar.isHidden = true }
            }
        }
        guard !isAutoScrolling else { return }
        let probe = scrollView.contentOffset.y + topInset + 56
        var active = 0
        for (i, sec) in tabSections.enumerated() where sec.convert(sec.bounds, to: scrollView).minY <= probe { active = i }
        inlineTabBar.setActive(active, animated: true)
        floatingTabBar.setActive(active, animated: true)
    }

    private func scrollToSection(_ index: Int) {
        guard index >= 0, index < tabSections.count else { return }
        Haptics.tap()
        let sec = tabSections[index]
        let y = sec.convert(sec.bounds, to: scrollView).minY - topInset - 50
        isAutoScrolling = true
        inlineTabBar.setActive(index, animated: true)
        floatingTabBar.setActive(index, animated: true)
        scrollView.setContentOffset(CGPoint(x: 0, y: max(y, -topInset)), animated: true)
    }

    func scrollViewDidEndScrollingAnimation(_ sv: UIScrollView) {
        if sv == scrollView { isAutoScrolling = false; updateStickyTabs() }
    }

    // MARK: - 정보 (프로필 + 태그 + 별점 + 주요경력)
    private func buildInfo(avatar: String, category: String, name: String, isFeatured: Bool, tags: [String],
                           rating: Double, reviewCount: Int, mainExp: String) -> UIView {
        let col = UIStackView(); col.axis = .vertical; col.spacing = 8; col.alignment = .fill

        let av = UIImageView()
        av.contentMode = .scaleAspectFill; av.clipsToBounds = true
        av.layer.cornerRadius = 11; av.layer.cornerCurve = .continuous
        av.backgroundColor = UIColor(white: 0.93, alpha: 1)
        av.translatesAutoresizingMaskIntoConstraints = false
        av.widthAnchor.constraint(equalToConstant: 40).isActive = true
        av.heightAnchor.constraint(equalToConstant: 40).isActive = true
        NativeChatImageLoader.load(avatar, into: av, fallback: NativeChatHeaderView.avatarPlaceholder)
        let nameL = UILabel()
        nameL.text = "\(category) \(name)"
        nameL.font = .systemFont(ofSize: 18, weight: .bold)
        nameL.textColor = UIColor(white: 0.1, alpha: 1)
        let leftRow = UIStackView(arrangedSubviews: [av, nameL]); leftRow.axis = .horizontal; leftRow.spacing = 10; leftRow.alignment = .center
        let proRow = UIStackView(arrangedSubviews: [leftRow]); proRow.axis = .horizontal; proRow.alignment = .center
        if isFeatured {
            let badge = PaddingLabel()
            badge.text = "✓ 인증 사회자"
            badge.inset = UIEdgeInsets(top: 4, left: 9, bottom: 4, right: 9)
            badge.font = .systemFont(ofSize: 11, weight: .bold)
            badge.textColor = blue
            badge.backgroundColor = blue.withAlphaComponent(0.1)
            badge.layer.cornerRadius = 11; badge.clipsToBounds = true
            badge.setContentHuggingPriority(.required, for: .horizontal)
            proRow.addArrangedSubview(UIView())
            proRow.addArrangedSubview(badge)
        }
        col.addArrangedSubview(proRow)

        if !tags.isEmpty { col.addArrangedSubview(flowTags(tags)) }

        // 별점
        let starRow = UIStackView(); starRow.axis = .horizontal; starRow.spacing = 3; starRow.alignment = .center
        let filled = Int(rating.rounded())
        for i in 0..<5 {
            let s = UILabel(); s.text = "★"; s.font = .systemFont(ofSize: 15)
            s.textColor = i < filled ? UIColor(red: 1.0, green: 0.72, blue: 0.0, alpha: 1) : UIColor(white: 0.85, alpha: 1)
            starRow.addArrangedSubview(s)
        }
        let rl = UILabel(); rl.text = String(format: "%.1f", rating); rl.font = .systemFont(ofSize: 16, weight: .bold); rl.textColor = UIColor(white: 0.1, alpha: 1)
        let cl = UILabel(); cl.text = "(\(reviewCount))"; cl.font = .systemFont(ofSize: 14); cl.textColor = UIColor(white: 0.6, alpha: 1)
        starRow.setCustomSpacing(8, after: starRow.arrangedSubviews.last!)
        starRow.addArrangedSubview(rl); starRow.addArrangedSubview(cl); starRow.addArrangedSubview(UIView())
        col.addArrangedSubview(starRow)
        col.setCustomSpacing(14, after: starRow)

        // 주요 경력 — 제목·불릿 없이 그라데이션 텍스트만, 한 줄씩 줄바꿈
        let lines = mainExp.split(whereSeparator: { $0 == "\n" || $0 == "/" }).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        if !lines.isEmpty {
            let cc = UIView()
            cc.backgroundColor = UIColor(red: 0.969, green: 0.98, blue: 1.0, alpha: 1)
            cc.layer.cornerRadius = 32; cc.layer.cornerCurve = .continuous
            cc.layer.borderWidth = 1; cc.layer.borderColor = UIColor(white: 0.93, alpha: 1).cgColor
            let ul = UIStackView(); ul.axis = .vertical; ul.spacing = 6
            for (i, line) in lines.prefix(6).enumerated() {
                let tx = GradientSweepLabel()
                tx.text = line
                tx.font = .systemFont(ofSize: 16, weight: .semibold)
                tx.numberOfLines = 0
                tx.sweepDelay = 0.4 + Double(i) * 0.22   // 한 줄씩 순차
                ul.addArrangedSubview(tx)
            }
            pin(ul, into: cc, inset: 18)
            col.addArrangedSubview(cc)
        }
        return col
    }

    // 사회자 정보 (프로필 요약 + 연락/응답 + 영상)
    private func buildProfileInfo(avatar: String, name: String, category: String, rating: Double,
                                  reviewCount: Int, responseRate: Int, youtube: String) -> UIView {
        let gold = UIColor(red: 1.0, green: 0.72, blue: 0.0, alpha: 1)
        let card = glassCard()
        let col = UIStackView(); col.axis = .vertical; col.spacing = 14; col.alignment = .fill
        let t = UILabel(); t.text = "사회자 정보"; t.font = .systemFont(ofSize: 18, weight: .bold); t.textColor = UIColor(white: 0.1, alpha: 1)
        col.addArrangedSubview(t)

        let av = UIImageView()
        av.contentMode = .scaleAspectFill; av.clipsToBounds = true
        av.layer.cornerRadius = 12; av.layer.cornerCurve = .continuous
        av.backgroundColor = UIColor(white: 0.93, alpha: 1)
        av.translatesAutoresizingMaskIntoConstraints = false
        av.widthAnchor.constraint(equalToConstant: 56).isActive = true
        av.heightAnchor.constraint(equalToConstant: 56).isActive = true
        NativeChatImageLoader.load(avatar, into: av, fallback: NativeChatHeaderView.avatarPlaceholder)
        let nameL = UILabel(); nameL.text = "\(category) \(name)"; nameL.font = .systemFont(ofSize: 15, weight: .bold); nameL.textColor = UIColor(white: 0.1, alpha: 1)
        let star = UILabel(); star.text = "★"; star.font = .systemFont(ofSize: 12); star.textColor = gold
        let rl = UILabel(); rl.text = "\(String(format: "%.1f", rating)) (\(reviewCount))"; rl.font = .systemFont(ofSize: 12.5, weight: .semibold); rl.textColor = UIColor(white: 0.2, alpha: 1)
        let ratingRow = UIStackView(arrangedSubviews: [star, rl, UIView()]); ratingRow.axis = .horizontal; ratingRow.spacing = 4; ratingRow.alignment = .center
        let c1 = UILabel(); c1.text = "연락 가능 시간 · 평일·주말 09:00~21:00"; c1.font = .systemFont(ofSize: 11.5); c1.textColor = UIColor(white: 0.55, alpha: 1)
        let c2 = UILabel(); c2.text = responseRate > 0 ? "평균 응답률 \(responseRate)% · 보통 1시간 이내" : "평균 응답 시간 · 보통 1시간 이내"; c2.font = .systemFont(ofSize: 11.5); c2.textColor = UIColor(white: 0.55, alpha: 1)
        let right = UIStackView(arrangedSubviews: [nameL, ratingRow, c1, c2]); right.axis = .vertical; right.spacing = 3; right.alignment = .fill
        right.setCustomSpacing(5, after: ratingRow)
        let row = UIStackView(arrangedSubviews: [av, right]); row.axis = .horizontal; row.spacing = 14; row.alignment = .center
        col.addArrangedSubview(row)
        _ = youtube   // 영상은 서비스 설명 섹션으로 이동(중복 방지)
        pin(col, into: card, inset: 18)
        return card
    }

    private func videoThumb(_ videoId: String) -> UIView {
        let wrap = UIView()
        let img = UIImageView()
        img.contentMode = .scaleAspectFill; img.clipsToBounds = true
        img.layer.cornerRadius = 12; img.layer.cornerCurve = .continuous
        img.backgroundColor = .black
        img.translatesAutoresizingMaskIntoConstraints = false
        NativeChatImageLoader.load("https://img.youtube.com/vi/\(videoId)/hqdefault.jpg", into: img, fallback: nil)
        wrap.addSubview(img)
        let play = UILabel(); play.text = "▶"; play.font = .systemFont(ofSize: 18); play.textColor = UIColor(white: 0.1, alpha: 1)
        play.textAlignment = .center
        play.backgroundColor = UIColor.white.withAlphaComponent(0.92)
        play.layer.cornerRadius = 24; play.clipsToBounds = true
        play.translatesAutoresizingMaskIntoConstraints = false
        wrap.addSubview(play)
        NSLayoutConstraint.activate([
            img.topAnchor.constraint(equalTo: wrap.topAnchor), img.bottomAnchor.constraint(equalTo: wrap.bottomAnchor),
            img.leadingAnchor.constraint(equalTo: wrap.leadingAnchor), img.trailingAnchor.constraint(equalTo: wrap.trailingAnchor),
            img.heightAnchor.constraint(equalTo: img.widthAnchor, multiplier: 9.0 / 16.0),
            play.centerXAnchor.constraint(equalTo: wrap.centerXAnchor), play.centerYAnchor.constraint(equalTo: wrap.centerYAnchor),
            play.widthAnchor.constraint(equalToConstant: 48), play.heightAnchor.constraint(equalToConstant: 48),
        ])
        wrap.isUserInteractionEnabled = true
        wrap.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(videoTapped)))
        return wrap
    }
    @objc private func videoTapped() {
        guard let url = URL(string: youtubeURLString) else { return }
        UIApplication.shared.open(url)
    }
    private func youtubeID(_ url: String) -> String? {
        guard !url.isEmpty else { return nil }
        for marker in ["v=", "youtu.be/", "embed/"] {
            if let r = url.range(of: marker) {
                let id = url[r.upperBound...].prefix { $0 != "&" && $0 != "?" && $0 != "/" }
                if !id.isEmpty { return String(id) }
            }
        }
        return nil
    }

    // 서비스 설명 — detailHtml 의 텍스트 + 이미지 모두 렌더 (웹 dangerouslySetInnerHTML 대응)
    private func buildDescription(_ html: String, videoId: String?) -> UIView? {
        let text = NativeHelpContent.htmlToText(html)
        let imgs = extractImageSrcs(html)
        guard !text.isEmpty || !imgs.isEmpty || videoId != nil else { return nil }
        let card = glassCard()
        let col = UIStackView(); col.axis = .vertical; col.spacing = 12; col.alignment = .fill
        let t = UILabel(); t.text = "서비스 설명"; t.font = .systemFont(ofSize: 16, weight: .bold); t.textColor = UIColor(white: 0.12, alpha: 1)
        col.addArrangedSubview(t)
        // 진행 영상 (있으면 상단에 prominent)
        if let vid = videoId {
            let vt = UILabel(); vt.text = "진행 영상"; vt.font = .systemFont(ofSize: 14, weight: .bold); vt.textColor = UIColor(white: 0.2, alpha: 1)
            col.addArrangedSubview(vt)
            col.setCustomSpacing(8, after: vt)
            col.addArrangedSubview(videoThumb(vid))
        }
        // 본문(텍스트+이미지)은 길어서 기본 접힘 — 펼쳐보기 버튼
        let body = UIStackView(); body.axis = .vertical; body.spacing = 12; body.alignment = .fill
        if !text.isEmpty {
            let b = UILabel(); b.text = text; b.font = .systemFont(ofSize: 14.5); b.textColor = UIColor(white: 0.3, alpha: 1); b.numberOfLines = 0
            b.setContentHuggingPriority(.required, for: .vertical)
            body.addArrangedSubview(b)
        }
        for src in imgs.prefix(15) {
            let iv = AspectImageView()
            iv.contentMode = .scaleAspectFill
            iv.clipsToBounds = true
            iv.layer.cornerRadius = 10; iv.layer.cornerCurve = .continuous
            iv.backgroundColor = UIColor(white: 0.95, alpha: 1)
            NativeChatImageLoader.load(src, into: iv, fallback: nil)
            body.addArrangedSubview(iv)
        }
        if !body.arrangedSubviews.isEmpty {
            col.addArrangedSubview(CollapsibleContent(content: body))
        }
        pin(col, into: card, inset: 18)
        return card
    }
    private func extractImageSrcs(_ html: String) -> [String] {
        var result: [String] = []
        guard let re = try? NSRegularExpression(pattern: "<img[^>]+src=[\"']([^\"']+)[\"']", options: [.caseInsensitive]) else { return [] }
        let ns = html as NSString
        re.enumerateMatches(in: html, range: NSRange(location: 0, length: ns.length)) { m, _, _ in
            if let m = m, m.numberOfRanges > 1 { result.append(ns.substring(with: m.range(at: 1))) }
        }
        return result
    }

    // MARK: - 추천 사회자 (홈 캐시 재사용 — 가로 스크롤, 3:4 카드)
    private func buildRecommend(_ pros: [[String: Any]]) -> UIView {
        let col = UIStackView(); col.axis = .vertical; col.spacing = 14; col.alignment = .fill
        let title = UILabel(); title.numberOfLines = 2
        let att = NSMutableAttributedString(string: "프리티풀", attributes: [.foregroundColor: blue, .font: UIFont.systemFont(ofSize: 17, weight: .bold)])
        att.append(NSAttributedString(string: "의 다른\n검증된 사회자를 살펴보세요", attributes: [.foregroundColor: UIColor(white: 0.1, alpha: 1), .font: UIFont.systemFont(ofSize: 17, weight: .bold)]))
        title.attributedText = att
        let titleWrap = UIView(); pinH(title, into: titleWrap, inset: 16)

        let scroll = UIScrollView(); scroll.showsHorizontalScrollIndicator = false
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.contentInset = UIEdgeInsets(top: 0, left: 16, bottom: 0, right: 16)
        let row = UIStackView(); row.axis = .horizontal; row.spacing = 12; row.alignment = .top
        row.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(row)
        for p in pros { row.addArrangedSubview(recoCard(p)) }
        NSLayoutConstraint.activate([
            row.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            row.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
            row.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor),
            row.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor),
            row.heightAnchor.constraint(equalTo: scroll.frameLayoutGuide.heightAnchor),
            scroll.heightAnchor.constraint(equalToConstant: 230),
        ])
        col.addArrangedSubview(titleWrap)
        col.addArrangedSubview(scroll)
        return col
    }

    private func recoCard(_ p: [String: Any]) -> UIView {
        let card = RecoCardButton()
        card.proIdRef = (p["id"] as? String) ?? ""
        card.addTarget(self, action: #selector(recoTapped(_:)), for: .touchUpInside)
        card.translatesAutoresizingMaskIntoConstraints = false
        card.widthAnchor.constraint(equalToConstant: 130).isActive = true

        let img = UIImageView()
        img.contentMode = .scaleAspectFill; img.clipsToBounds = true
        img.layer.cornerRadius = 12; img.layer.cornerCurve = .continuous
        img.backgroundColor = UIColor(white: 0.94, alpha: 1)
        img.isUserInteractionEnabled = false
        img.translatesAutoresizingMaskIntoConstraints = false
        let url = (p["profileImageUrl"] as? String) ?? imageUrls(p["images"]).first ?? ""
        NativeChatImageLoader.load(url, into: img, fallback: NativeChatHeaderView.avatarPlaceholder)

        let badge = makePartnersBadge(height: 13)
        let badgeWrap = UIStackView(arrangedSubviews: [badge, UIView()]); badgeWrap.axis = .horizontal

        let cat = strArr(p["categories"]).first ?? strArr(p["categoryNames"]).first ?? "사회자"
        let nm = (p["name"] as? String) ?? ((p["user"] as? [String: Any])?["name"] as? String) ?? "사회자"
        let nameL = UILabel(); nameL.text = "\(cat) \(nm)"; nameL.font = .systemFont(ofSize: 13, weight: .semibold)
        nameL.textColor = UIColor(white: 0.1, alpha: 1); nameL.numberOfLines = 1

        let rating = (p["avgRating"] as? Double) ?? Double(intVal(p["avgRating"]))
        let rc = intVal(p["reviewCount"])
        let starRow = UIStackView(); starRow.axis = .horizontal; starRow.spacing = 1; starRow.alignment = .center
        let star = UILabel(); star.text = "★"; star.font = .systemFont(ofSize: 10); star.textColor = UIColor(red: 1.0, green: 0.72, blue: 0.0, alpha: 1)
        let rl = UILabel(); rl.text = String(format: "%.1f", rating); rl.font = .systemFont(ofSize: 11, weight: .bold); rl.textColor = UIColor(white: 0.1, alpha: 1)
        let cl = UILabel(); cl.text = "(\(rc))"; cl.font = .systemFont(ofSize: 10); cl.textColor = UIColor(white: 0.6, alpha: 1)
        starRow.addArrangedSubview(star); starRow.setCustomSpacing(3, after: star)
        starRow.addArrangedSubview(rl); starRow.addArrangedSubview(cl); starRow.addArrangedSubview(UIView())

        let info = UIStackView(arrangedSubviews: [badgeWrap, nameL, starRow]); info.axis = .vertical; info.spacing = 3; info.alignment = .fill
        info.isUserInteractionEnabled = false
        let stack = UIStackView(arrangedSubviews: [img, info]); stack.axis = .vertical; stack.spacing = 6; stack.alignment = .fill
        stack.isUserInteractionEnabled = false
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: card.topAnchor),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor),
            img.heightAnchor.constraint(equalTo: img.widthAnchor, multiplier: 4.0 / 3.0),
        ])
        return card
    }

    // MARK: - 리뷰 (별점 + 레이더/포텐셜 + 목록/빈상태)
    private func buildReviews(_ reviews: [DisplayReview], rating: Double, count: Int,
                              scores: [Double], potential: Int, hasAnyScore: Bool) -> UIView {
        let card = glassCard()
        let col = UIStackView(); col.axis = .vertical; col.spacing = 14; col.alignment = .fill

        let t = UILabel(); t.text = "리뷰"; t.font = .systemFont(ofSize: 18, weight: .bold); t.textColor = UIColor(white: 0.1, alpha: 1)
        let allBtn = UIButton(type: .system)
        var abcfg = UIButton.Configuration.plain()
        abcfg.title = "전체보기"
        abcfg.image = UIImage(systemName: "chevron.right", withConfiguration: UIImage.SymbolConfiguration(pointSize: 11, weight: .semibold))
        abcfg.imagePlacement = .trailing; abcfg.imagePadding = 2
        abcfg.baseForegroundColor = UIColor(white: 0.5, alpha: 1)
        abcfg.contentInsets = .zero
        var abattr = AttributedString("전체보기"); abattr.font = .systemFont(ofSize: 13, weight: .medium)
        abcfg.attributedTitle = abattr
        allBtn.configuration = abcfg
        allBtn.setContentHuggingPriority(.required, for: .horizontal)
        allBtn.addAction(UIAction { [weak self] _ in Haptics.tap(); self.map { $0.delegate?.proDetailOpenReviews($0.proId) } }, for: .touchUpInside)
        let titleRow = UIStackView(arrangedSubviews: [t, UIView(), allBtn]); titleRow.axis = .horizontal; titleRow.alignment = .center
        col.addArrangedSubview(titleRow)

        // 큰 별점 행
        let starRow = UIStackView(); starRow.axis = .horizontal; starRow.spacing = 2; starRow.alignment = .center
        let filled = Int(rating.rounded())
        for i in 0..<5 {
            let s = UILabel(); s.text = "★"; s.font = .systemFont(ofSize: 18)
            s.textColor = i < filled ? UIColor(red: 1.0, green: 0.72, blue: 0.0, alpha: 1) : UIColor(white: 0.85, alpha: 1)
            starRow.addArrangedSubview(s)
        }
        let big = UILabel(); big.text = String(format: "%.1f", rating); big.font = .systemFont(ofSize: 24, weight: .bold); big.textColor = UIColor(white: 0.1, alpha: 1)
        let cnt = UILabel(); cnt.text = "(\(count))"; cnt.font = .systemFont(ofSize: 14); cnt.textColor = UIColor(white: 0.6, alpha: 1)
        starRow.setCustomSpacing(8, after: starRow.arrangedSubviews.last!)
        starRow.addArrangedSubview(big); starRow.addArrangedSubview(cnt); starRow.addArrangedSubview(UIView())
        col.addArrangedSubview(starRow)

        // 포텐셜 + 레이더
        col.addArrangedSubview(buildPotentialBlock(scores: scores, potential: potential, hasAnyScore: hasAnyScore))

        // 전체 리뷰 N건
        let listTitle = UILabel(); listTitle.text = "전체 리뷰 \(count)건"; listTitle.font = .systemFont(ofSize: 15, weight: .bold); listTitle.textColor = UIColor(white: 0.1, alpha: 1)
        col.addArrangedSubview(listTitle)

        if reviews.isEmpty {
            let box = UIView(); box.backgroundColor = UIColor(white: 0.97, alpha: 1); box.layer.cornerRadius = 14; box.layer.cornerCurve = .continuous
            let e1 = UILabel(); e1.text = "아직 표시할 리뷰가 없습니다"; e1.font = .systemFont(ofSize: 14, weight: .semibold); e1.textColor = UIColor(white: 0.4, alpha: 1); e1.textAlignment = .center
            let e2 = UILabel(); e2.text = "리뷰가 등록되면 이곳에 바로 보여집니다"; e2.font = .systemFont(ofSize: 12); e2.textColor = UIColor(white: 0.6, alpha: 1); e2.textAlignment = .center
            let ec = UIStackView(arrangedSubviews: [e1, e2]); ec.axis = .vertical; ec.spacing = 4; ec.alignment = .center
            pin(ec, into: box, inset: 22)
            col.addArrangedSubview(box)
        } else {
            for r in reviews.prefix(10) {
                col.addArrangedSubview(divider())
                col.addArrangedSubview(reviewCard(r))
            }
        }
        pin(col, into: card, inset: 18)
        return card
    }

    private func reviewCard(_ r: DisplayReview) -> UIView {
        let col = UIStackView(); col.axis = .vertical; col.spacing = 9; col.alignment = .fill

        // 작성자 행 (아바타 이모지 + 이름 + 배지)
        let av = PaddingLabel()
        av.text = "🚀"; av.font = .systemFont(ofSize: 14); av.textAlignment = .center
        av.backgroundColor = UIColor(white: 0.95, alpha: 1)
        av.layer.cornerRadius = 16; av.clipsToBounds = true
        av.translatesAutoresizingMaskIntoConstraints = false
        av.widthAnchor.constraint(equalToConstant: 32).isActive = true
        av.heightAnchor.constraint(equalToConstant: 32).isActive = true
        let nameL = UILabel(); nameL.text = r.name; nameL.font = .systemFont(ofSize: 13.5); nameL.textColor = UIColor(white: 0.35, alpha: 1)
        let topRow = UIStackView(arrangedSubviews: [av, nameL]); topRow.axis = .horizontal; topRow.spacing = 8; topRow.alignment = .center
        if !r.badge.isEmpty {
            let b = PaddingLabel()
            b.text = r.badge
            b.inset = UIEdgeInsets(top: 2, left: 7, bottom: 2, right: 7)
            b.font = .systemFont(ofSize: 10, weight: .medium)
            b.textColor = UIColor(white: 0.5, alpha: 1)
            b.backgroundColor = UIColor(white: 0.95, alpha: 1)
            b.layer.cornerRadius = 8; b.clipsToBounds = true
            b.setContentHuggingPriority(.required, for: .horizontal)
            topRow.addArrangedSubview(UIView())
            topRow.addArrangedSubview(b)
        } else {
            topRow.addArrangedSubview(UIView())
        }
        col.addArrangedSubview(topRow)

        // 별점 + 날짜
        let stars = UILabel(); stars.text = starString(r.rating); stars.font = .systemFont(ofSize: 12); stars.textColor = UIColor(red: 1.0, green: 0.72, blue: 0.0, alpha: 1)
        let rt = UILabel(); rt.text = String(format: "%.1f", r.rating); rt.font = .systemFont(ofSize: 12.5, weight: .bold); rt.textColor = UIColor(white: 0.1, alpha: 1)
        let sep = UILabel(); sep.text = "|"; sep.font = .systemFont(ofSize: 11); sep.textColor = UIColor(white: 0.8, alpha: 1)
        let dt = UILabel(); dt.text = r.date; dt.font = .systemFont(ofSize: 12); dt.textColor = UIColor(white: 0.6, alpha: 1)
        let metaRow = UIStackView(arrangedSubviews: [stars, rt, sep, dt, UIView()]); metaRow.axis = .horizontal; metaRow.spacing = 6; metaRow.alignment = .center
        col.addArrangedSubview(metaRow)

        // 점수 칩
        if !r.scores.isEmpty {
            let wrap = UIStackView(); wrap.axis = .horizontal; wrap.spacing = 4; wrap.alignment = .center
            for label in scoreLabels where r.scores[label] != nil {
                let chip = PaddingLabel()
                let v = r.scores[label] ?? 0
                chip.attributedText = scoreChipText(label, v)
                chip.inset = UIEdgeInsets(top: 2, left: 6, bottom: 2, right: 6)
                chip.backgroundColor = UIColor(white: 0.95, alpha: 1)
                chip.layer.cornerRadius = 5; chip.clipsToBounds = true
                wrap.addArrangedSubview(chip)
            }
            wrap.addArrangedSubview(UIView())
            let scroll = UIScrollView(); scroll.showsHorizontalScrollIndicator = false
            scroll.translatesAutoresizingMaskIntoConstraints = false
            wrap.translatesAutoresizingMaskIntoConstraints = false
            scroll.addSubview(wrap)
            NSLayoutConstraint.activate([
                wrap.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
                wrap.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
                wrap.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor),
                wrap.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor),
                wrap.heightAnchor.constraint(equalTo: scroll.frameLayoutGuide.heightAnchor),
                scroll.heightAnchor.constraint(equalToConstant: 22),
            ])
            col.addArrangedSubview(scroll)
        }

        // 본문
        let body = UILabel(); body.text = r.content; body.font = .systemFont(ofSize: 13.5); body.textColor = UIColor(white: 0.2, alpha: 1); body.numberOfLines = 0
        col.addArrangedSubview(body)
        return col
    }

    private func starString(_ rating: Double) -> String {
        let full = Int(rating)
        let half = rating - Double(full) >= 0.5
        var s = String(repeating: "★", count: full)
        if half { s += "⯨" }
        let empty = 5 - full - (half ? 1 : 0)
        if empty > 0 { s += String(repeating: "☆", count: empty) }
        return s
    }
    private func scoreChipText(_ label: String, _ value: Double) -> NSAttributedString {
        let s = NSMutableAttributedString(string: "\(label) ", attributes: [.font: UIFont.systemFont(ofSize: 10, weight: .medium), .foregroundColor: UIColor(white: 0.4, alpha: 1)])
        s.append(NSAttributedString(string: String(format: "%.1f", value), attributes: [.font: UIFont.systemFont(ofSize: 10, weight: .bold), .foregroundColor: blue]))
        return s
    }

    // MARK: - 리뷰 해석 (웹 buildReviewFallbacks 동일 — API 본문 없으면 레거시 폴백)
    static func resolveReviews(api: [[String: Any]], reviewCount: Int, rating: Double) -> [DisplayReview] {
        let keymap: [(String, String)] = [("경력","ratingExperience"),("만족도","ratingSatisfaction"),("위트","ratingWit"),("발성","ratingVoice"),("이미지","ratingAppearance"),("구성력","ratingComposition")]
        let mapped: [DisplayReview] = api.compactMap { r in
            let content = (((r["content"] as? String) ?? (r["comment"] as? String) ?? (r["body"] as? String)) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !content.isEmpty else { return nil }
            var sc: [String: Double] = [:]
            for (label, key) in keymap { if let v = numD(r[key]), v > 0 { sc[label] = v } }
            let name: String
            if (r["isAnonymous"] as? Bool) == true { name = "익명" }
            else if let n = (r["reviewer"] as? [String: Any])?["name"] as? String, !n.isEmpty { name = String(n.prefix(2)) + "********" }
            else { name = "고객" }
            return DisplayReview(name: name, rating: numD(r["avgRating"]) ?? 5, date: "", scores: sc, content: content, badge: "")
        }
        if !mapped.isEmpty { return mapped }
        let take = min(reviewCount, legacyReviews.count)
        guard take > 0 else { return [] }
        let profile = rating > 0 ? min(5, max(1, (rating * 10).rounded() / 10)) : legacyReviews[0].rating
        return legacyReviews.prefix(take).enumerated().map { (i, r) in
            DisplayReview(name: r.name, rating: i == 0 ? profile : min(profile, r.rating), date: r.date, scores: r.scores, content: r.content, badge: r.badge)
        }
    }
    private static func numD(_ v: Any?) -> Double? {
        if let d = v as? Double { return d }; if let i = v as? Int { return Double(i) }; if let s = v as? String { return Double(s) }; return nil
    }
    // 웹 LEGACY_REVIEW_FALLBACKS 동일
    private static let legacyReviews: [DisplayReview] = [
        DisplayReview(name: "나른********", rating: 5, date: "26.02.09",
            scores: ["경력": 5, "만족도": 5, "구성력": 5, "위트": 4.5, "발성": 5, "이미지": 5],
            content: "상담과정부터 행사 진행, 마무리까지 모두 빠르고 친절하게 응대해 주셨어요! 진행도 상황에 맞게 톤 바꿔가시면서 잘 진행해 주셨습니다!", badge: "대행사/에이전시"),
        DisplayReview(name: "행복한신부", rating: 5, date: "26.01.15",
            scores: ["경력": 5, "만족도": 5, "구성력": 4.5, "위트": 5, "발성": 5, "이미지": 5],
            content: "결혼식 진행이 정말 매끄러웠어요. 하객분들 모두 칭찬하셨고, 예식 흐름을 자연스럽게 이끌어 주셔서 든든했습니다.", badge: "개인"),
        DisplayReview(name: "이벤트기획", rating: 4.8, date: "25.12.20",
            scores: ["경력": 5, "만족도": 4.5, "구성력": 5, "위트": 4.5, "발성": 5, "이미지": 4.5],
            content: "기업 행사 사회자로 섭외했는데 사전 커뮤니케이션도 빠르고 현장 분위기 조율이 좋았습니다. 다음 행사에도 다시 요청드리고 싶어요.", badge: "Biz·기업"),
        DisplayReview(name: "웨딩플래너", rating: 5, date: "25.11.05",
            scores: ["경력": 5, "만족도": 5, "구성력": 5, "위트": 5, "발성": 5, "이미지": 5],
            content: "플래너 입장에서도 진행이 안정적이라 안심됐습니다. 신랑신부 요청사항을 잘 반영해 주셨고 하객 반응도 좋았습니다.", badge: "대행사/에이전시"),
        DisplayReview(name: "스트********", rating: 4.9, date: "25.06.10",
            scores: ["경력": 4.5, "만족도": 5, "구성력": 5, "위트": 5, "발성": 4.5, "이미지": 5],
            content: "행사 시작 전부터 끝까지 꼼꼼하게 챙겨주셨고 돌발 상황도 차분하게 정리해 주셔서 만족스러웠습니다.", badge: "개인"),
    ]

    private func buildPotentialBlock(scores: [Double], potential: Int, hasAnyScore: Bool) -> UIView {
        let block = UIView()
        block.backgroundColor = UIColor(red: 0.976, green: 0.980, blue: 0.984, alpha: 1) // gray-50
        block.layer.cornerRadius = 16; block.layer.cornerCurve = .continuous

        let leftCol = UIStackView(); leftCol.axis = .vertical; leftCol.spacing = 6; leftCol.alignment = .leading
        let lbl = UILabel(); lbl.text = "총 포텐셜점수"; lbl.font = .systemFont(ofSize: 11, weight: .bold); lbl.textColor = UIColor(white: 0.5, alpha: 1)
        let score = UILabel()
        score.text = hasAnyScore ? "\(potential)점" : "—"
        score.font = .systemFont(ofSize: 28, weight: .bold)
        score.textColor = hasAnyScore ? blue : UIColor(white: 0.8, alpha: 1)
        leftCol.addArrangedSubview(lbl)
        leftCol.addArrangedSubview(score)
        // 점수 칩 (label value) — 2개씩 행
        if hasAnyScore {
            var rowStack: UIStackView? = nil
            for (i, label) in scoreLabels.enumerated() {
                if i % 2 == 0 {
                    let rs = UIStackView(); rs.axis = .horizontal; rs.spacing = 5; rs.alignment = .center
                    rowStack = rs; leftCol.addArrangedSubview(rs)
                }
                rowStack?.addArrangedSubview(scoreChip(label, i < scores.count ? scores[i] : 0))
                if i % 2 == 1 { rowStack?.addArrangedSubview(UIView()) }
            }
            leftCol.setCustomSpacing(10, after: score)
        }

        let radar = RadarChartView()
        radar.labels = scoreLabels
        radar.scores = scores
        radar.empty = !hasAnyScore
        radar.translatesAutoresizingMaskIntoConstraints = false
        radar.widthAnchor.constraint(equalToConstant: 150).isActive = true
        radar.heightAnchor.constraint(equalToConstant: 150).isActive = true
        radar.setContentHuggingPriority(.required, for: .horizontal)
        radar.setContentCompressionResistancePriority(.required, for: .horizontal)

        let h = UIStackView(arrangedSubviews: [leftCol, radar]); h.axis = .horizontal; h.spacing = 6; h.alignment = .center
        pin(h, into: block, inset: 16)
        return block
    }

    private func scoreChip(_ label: String, _ value: Double) -> UIView {
        let chip = UIView()
        chip.backgroundColor = .white
        chip.layer.cornerRadius = 13; chip.layer.cornerCurve = .continuous
        chip.layer.shadowColor = UIColor.black.cgColor
        chip.layer.shadowOpacity = 0.06; chip.layer.shadowRadius = 2; chip.layer.shadowOffset = CGSize(width: 0, height: 1)
        let l = UILabel(); l.text = label; l.font = .systemFont(ofSize: 10, weight: .medium); l.textColor = UIColor(white: 0.4, alpha: 1)
        let v = UILabel(); v.text = String(format: "%.1f", value); v.font = .systemFont(ofSize: 10, weight: .bold); v.textColor = blue
        let s = UIStackView(arrangedSubviews: [l, v]); s.axis = .horizontal; s.spacing = 3; s.alignment = .center
        s.isLayoutMarginsRelativeArrangement = true
        s.layoutMargins = UIEdgeInsets(top: 4, left: 8, bottom: 4, right: 8)
        s.translatesAutoresizingMaskIntoConstraints = false
        chip.addSubview(s)
        NSLayoutConstraint.activate([
            s.topAnchor.constraint(equalTo: chip.topAnchor), s.bottomAnchor.constraint(equalTo: chip.bottomAnchor),
            s.leadingAnchor.constraint(equalTo: chip.leadingAnchor), s.trailingAnchor.constraint(equalTo: chip.trailingAnchor),
        ])
        chip.setContentHuggingPriority(.required, for: .horizontal)
        return chip
    }

    // MARK: - FAQ (아코디언 — 사회자가 등록한 FAQ 우선, 없으면 기본 3개)
    private func buildFaq(category: String, hasVideo: Bool, custom: [(String, String)]) -> UIView {
        let card = glassCard()
        let t = UILabel(); t.text = "FAQ"; t.font = .systemFont(ofSize: 18, weight: .bold); t.textColor = UIColor(white: 0.1, alpha: 1)
        let col = UIStackView(arrangedSubviews: [t]); col.axis = .vertical; col.spacing = 0; col.alignment = .fill
        col.setCustomSpacing(6, after: t)
        let faqs: [(String, String)] = custom.isEmpty ? [
            ("\(category) 섭외는 어떻게 진행되나요?", "문의하기로 장소와 행사 성격을 알려주시면 사회자가 가능 여부와 견적을 확인해 답변드립니다. 이후 결제와 사전 미팅을 통해 진행 방향을 조율합니다."),
            ("행사 전 준비 자료는 언제 전달하면 되나요?", "행사 개요, 식순, 요청 멘트, 참고 대본이 있다면 전달해 주세요. 결혼식은 보통 본식 한 달 전후로 사전 질문지를 기반으로 대본을 맞춰갑니다."),
            ("진행 영상이나 포트폴리오는 어디에서 볼 수 있나요?", hasVideo ? "상세페이지의 영상 섹션에서 대표 진행 영상을 확인할 수 있습니다." : "등록된 영상이 없는 경우 문의하기로 참고 포트폴리오를 요청할 수 있습니다."),
        ] : custom
        for (i, f) in faqs.enumerated() {
            if i > 0 { col.addArrangedSubview(divider()) }
            col.addArrangedSubview(faqItem(question: f.0, answer: f.1))
        }
        pin(col, into: card, inset: 18)
        return card
    }

    private func faqItem(question: String, answer: String) -> UIView {
        let item = FaqItemView(question: question, answer: answer)
        return item
    }

    // MARK: - 헬퍼
    // 파트너스 뱃지 (첨부 SVG 로고 — 칩 없이 풀어서)
    private func makePartnersBadge(height: CGFloat) -> UIView {
        let img = UIImageView(image: UIImage(named: "partners-badge")?.withRenderingMode(.alwaysOriginal))
        img.contentMode = .scaleAspectFit
        img.translatesAutoresizingMaskIntoConstraints = false
        img.heightAnchor.constraint(equalToConstant: height).isActive = true
        img.widthAnchor.constraint(equalTo: img.heightAnchor, multiplier: 148.0 / 44.0).isActive = true
        return img
    }
    private func glassCard() -> UIView {
        let v = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
        v.layer.cornerRadius = 32; v.layer.cornerCurve = .continuous
        v.contentView.layer.cornerRadius = 32; v.contentView.layer.cornerCurve = .continuous; v.contentView.clipsToBounds = true
        v.contentView.backgroundColor = UIColor.white.withAlphaComponent(0.55)
        v.layer.borderWidth = 1; v.layer.borderColor = UIColor.white.withAlphaComponent(0.7).cgColor
        v.layer.shadowColor = UIColor(red: 0.1, green: 0.15, blue: 0.3, alpha: 1).cgColor
        v.layer.shadowOpacity = 0.06; v.layer.shadowRadius = 12; v.layer.shadowOffset = CGSize(width: 0, height: 5)
        v.translatesAutoresizingMaskIntoConstraints = false
        return v
    }
    private func flowTags(_ tags: [String]) -> UIView {
        let row = UIStackView(); row.axis = .horizontal; row.spacing = 6; row.alignment = .center
        for t in tags.prefix(5) {
            let chip = PaddingLabel()
            chip.text = t
            chip.inset = UIEdgeInsets(top: 3, left: 8, bottom: 3, right: 8)
            chip.font = .systemFont(ofSize: 11, weight: .medium)
            chip.textColor = UIColor(white: 0.42, alpha: 1)
            chip.backgroundColor = UIColor(white: 0.94, alpha: 1)
            chip.layer.cornerRadius = 9; chip.clipsToBounds = true
            row.addArrangedSubview(chip)
        }
        row.addArrangedSubview(UIView())
        return row
    }
    private func divider() -> UIView {
        let d = UIView(); d.backgroundColor = UIColor(white: 0.93, alpha: 1)
        d.translatesAutoresizingMaskIntoConstraints = false
        d.heightAnchor.constraint(equalToConstant: 1).isActive = true
        return d
    }
    private func wrapPad(_ v: UIView) -> UIView {
        let holder = UIView()
        v.translatesAutoresizingMaskIntoConstraints = false
        holder.addSubview(v)
        NSLayoutConstraint.activate([
            v.topAnchor.constraint(equalTo: holder.topAnchor),
            v.bottomAnchor.constraint(equalTo: holder.bottomAnchor),
            v.leadingAnchor.constraint(equalTo: holder.leadingAnchor, constant: 16),
            v.trailingAnchor.constraint(equalTo: holder.trailingAnchor, constant: -16),
        ])
        return holder
    }
    private func pinH(_ v: UIView, into parent: UIView, inset: CGFloat) {
        v.translatesAutoresizingMaskIntoConstraints = false
        parent.addSubview(v)
        NSLayoutConstraint.activate([
            v.topAnchor.constraint(equalTo: parent.topAnchor),
            v.bottomAnchor.constraint(equalTo: parent.bottomAnchor),
            v.leadingAnchor.constraint(equalTo: parent.leadingAnchor, constant: inset),
            v.trailingAnchor.constraint(equalTo: parent.trailingAnchor, constant: -inset),
        ])
    }
    private func pin(_ v: UIView, into parent: UIView, inset: CGFloat) {
        let host = (parent as? UIVisualEffectView)?.contentView ?? parent
        v.translatesAutoresizingMaskIntoConstraints = false
        host.addSubview(v)
        NSLayoutConstraint.activate([
            v.topAnchor.constraint(equalTo: host.topAnchor, constant: inset),
            v.bottomAnchor.constraint(equalTo: host.bottomAnchor, constant: -inset),
            v.leadingAnchor.constraint(equalTo: host.leadingAnchor, constant: inset),
            v.trailingAnchor.constraint(equalTo: host.trailingAnchor, constant: -inset),
        ])
    }
    private func intVal(_ v: Any?) -> Int { (v as? Int) ?? Int((v as? Double) ?? 0) }
    private func strArr(_ v: Any?) -> [String] {
        if let a = v as? [String] { return a }
        if let a = v as? [Any] { return a.compactMap { $0 as? String } }
        return []
    }
    private func imageUrls(_ v: Any?) -> [String] {
        if let arr = v as? [[String: Any]] {
            return arr.sorted { intVal($0["displayOrder"]) < intVal($1["displayOrder"]) }
                .compactMap { $0["imageUrl"] as? String }
        }
        if let arr = v as? [String] { return arr }
        return []
    }
}

// MARK: - FAQ 아코디언 아이템
private final class FaqItemView: UIView {
    private let answerLabel = UILabel()
    private let chevron = UILabel()
    private var open = false
    init(question: String, answer: String) {
        super.init(frame: .zero)
        let blue = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
        let q = UILabel(); q.numberOfLines = 0
        let qa = NSMutableAttributedString(string: "Q. ", attributes: [.foregroundColor: blue, .font: UIFont.systemFont(ofSize: 14.5, weight: .bold)])
        qa.append(NSAttributedString(string: question, attributes: [.foregroundColor: UIColor(white: 0.1, alpha: 1), .font: UIFont.systemFont(ofSize: 14.5, weight: .bold)]))
        q.attributedText = qa
        chevron.text = "⌄"; chevron.font = .systemFont(ofSize: 16, weight: .bold); chevron.textColor = UIColor(white: 0.6, alpha: 1)
        chevron.setContentHuggingPriority(.required, for: .horizontal)
        let qRow = UIStackView(arrangedSubviews: [q, chevron]); qRow.axis = .horizontal; qRow.spacing = 8; qRow.alignment = .center

        answerLabel.numberOfLines = 0
        let aa = NSMutableAttributedString(string: "A. ", attributes: [.foregroundColor: UIColor(white: 0.55, alpha: 1), .font: UIFont.systemFont(ofSize: 13.5)])
        aa.append(NSAttributedString(string: answer, attributes: [.foregroundColor: UIColor(white: 0.35, alpha: 1), .font: UIFont.systemFont(ofSize: 13.5)]))
        answerLabel.attributedText = aa
        answerLabel.isHidden = true

        let col = UIStackView(arrangedSubviews: [qRow, answerLabel]); col.axis = .vertical; col.spacing = 10
        col.isLayoutMarginsRelativeArrangement = true
        col.layoutMargins = UIEdgeInsets(top: 14, left: 0, bottom: 14, right: 0)
        col.translatesAutoresizingMaskIntoConstraints = false
        addSubview(col)
        NSLayoutConstraint.activate([
            col.topAnchor.constraint(equalTo: topAnchor), col.bottomAnchor.constraint(equalTo: bottomAnchor),
            col.leadingAnchor.constraint(equalTo: leadingAnchor), col.trailingAnchor.constraint(equalTo: trailingAnchor),
        ])
        let tap = UITapGestureRecognizer(target: self, action: #selector(toggle))
        addGestureRecognizer(tap)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    @objc private func toggle() {
        open.toggle()
        UIView.animate(withDuration: 0.25) {
            self.answerLabel.isHidden = !self.open
            self.chevron.transform = self.open ? CGAffineTransform(rotationAngle: .pi) : .identity
            self.superview?.superview?.layoutIfNeeded()
        }
    }
}
