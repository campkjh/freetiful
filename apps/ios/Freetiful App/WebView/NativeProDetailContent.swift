import UIKit

protocol NativeProDetailDelegate: AnyObject {
    func proDetailInquiry(_ id: String)
    func proDetailOpen(_ id: String)
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

    // CTA (글래스)
    private let ctaBar = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
    private let ctaButton = UIButton(type: .system)
    private let ctaHighlight = CAGradientLayer()

    private let blue = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
    private var proId = ""
    private var hasContent = false
    private var topInset: CGFloat = 0
    private var contentTop: NSLayoutConstraint!

    private let scoreLabels = ["경력", "만족도", "위트", "발성", "이미지", "구성력"]
    private let scoreKeys = ["ratingExperience", "ratingSatisfaction", "ratingWit", "ratingVoice", "ratingAppearance", "ratingComposition"]

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setInsets(top: CGFloat, bottom: CGFloat) {
        topInset = top
        contentTop?.constant = -top
        scrollView.contentInset = UIEdgeInsets(top: top, left: 0, bottom: 96, right: 0)
        scrollView.verticalScrollIndicatorInsets = UIEdgeInsets(top: top, left: 0, bottom: 96, right: 0)
        scrollView.contentOffset = CGPoint(x: 0, y: -top)
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
        ctaBar.contentView.backgroundColor = blue.withAlphaComponent(0.20)
        // 상단 유리 하이라이트
        ctaHighlight.colors = [UIColor.white.withAlphaComponent(0.45).cgColor, UIColor.white.withAlphaComponent(0.0).cgColor]
        ctaHighlight.startPoint = CGPoint(x: 0.5, y: 0)
        ctaHighlight.endPoint = CGPoint(x: 0.5, y: 1)
        ctaBar.contentView.layer.addSublayer(ctaHighlight)

        var cfg = UIButton.Configuration.plain()
        cfg.title = "이 사회자에게 문의하기"
        cfg.baseForegroundColor = UIColor(red: 0.10, green: 0.34, blue: 0.86, alpha: 1)
        cfg.contentInsets = NSDirectionalEdgeInsets(top: 14, leading: 20, bottom: 14, trailing: 20)
        ctaButton.configuration = cfg
        ctaButton.titleLabel?.font = .systemFont(ofSize: 16.5, weight: .bold)
        ctaButton.translatesAutoresizingMaskIntoConstraints = false
        ctaButton.addTarget(self, action: #selector(ctaTapped), for: .touchUpInside)
        ctaBar.contentView.addSubview(ctaButton)

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
        ])
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        ctaHighlight.frame = CGRect(x: 0, y: 0, width: ctaBar.bounds.width, height: ctaBar.bounds.height * 0.55)
    }

    @objc private func ctaTapped() { Haptics.tap(); delegate?.proDetailInquiry(proId) }
    @objc private func recoTapped(_ sender: RecoCardButton) { Haptics.tap(); delegate?.proDetailOpen(sender.proIdRef) }

    func loadDetail(id: String) {
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
        let intro = NativeHelpContent.htmlToText((d["detailHtml"] as? String) ?? "")
        let reviews = d["reviews"] as? [[String: Any]] ?? []
        let avatar = (user?["profileImageUrl"] as? String) ?? (d["profileImageUrl"] as? String) ?? images.first ?? ""
        let isFeatured = (d["isFeatured"] as? Bool) ?? true
        let mainExp = (d["mainExperience"] as? String) ?? ""

        // 점수 (리뷰별 6축 평균, 없으면 avgRating 폴백 — 웹과 동일)
        let ratingFallback = (reviewCount > 0 && rating > 0) ? min(5, max(0, rating)) : 0
        let scoreValues: [Double] = scoreKeys.map { key in
            let vals = reviews.compactMap { dbl($0[key]) }.filter { $0 > 0 }
            return vals.isEmpty ? ratingFallback : vals.reduce(0, +) / Double(vals.count)
        }
        let hasAnyScore = scoreValues.contains { $0 > 0 }
        let potential = Int((scoreValues.reduce(0) { $0 + $1 * 20 }).rounded())

        // ── 섹션 (웹 모바일 순서) ──
        contentStack.addArrangedSubview(buildCarousel(images))
        contentStack.addArrangedSubview(wrapPad(buildInfo(avatar: avatar, category: category, name: name,
            isFeatured: isFeatured, tags: tags, rating: rating, reviewCount: reviewCount, mainExp: mainExp)))
        if !intro.isEmpty {
            contentStack.addArrangedSubview(wrapPad(buildSection(title: "서비스 설명", body: intro)))
        }
        let recos = NativeHomeData.recommendedPros(excluding: proId, limit: 10)
        if !recos.isEmpty {
            contentStack.addArrangedSubview(buildRecommend(recos))
        }
        contentStack.addArrangedSubview(wrapPad(buildReviews(reviews, rating: rating, count: reviewCount,
            scores: scoreValues, potential: potential, hasAnyScore: hasAnyScore)))
        contentStack.addArrangedSubview(wrapPad(buildFaq(category: category, hasVideo: (d["youtubeUrl"] as? String)?.isEmpty == false)))

        layoutIfNeeded()
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
        let h = w
        carousel.translatesAutoresizingMaskIntoConstraints = false
        carousel.isPagingEnabled = true
        carousel.showsHorizontalScrollIndicator = false
        carousel.delegate = self
        carousel.contentInsetAdjustmentBehavior = .never
        carouselRow.arrangedSubviews.forEach { $0.removeFromSuperview() }
        carouselRow.axis = .horizontal
        carouselRow.translatesAutoresizingMaskIntoConstraints = false
        carousel.addSubview(carouselRow)
        holder.addSubview(carousel)
        let imgs = images.isEmpty ? [""] : images
        for u in imgs {
            let iv = UIImageView()
            iv.contentMode = .scaleAspectFill
            iv.clipsToBounds = true
            iv.backgroundColor = UIColor(white: 0.93, alpha: 1)
            iv.translatesAutoresizingMaskIntoConstraints = false
            NativeChatImageLoader.load(u, into: iv, fallback: NativeChatHeaderView.avatarPlaceholder)
            carouselRow.addArrangedSubview(iv)
            iv.widthAnchor.constraint(equalToConstant: w).isActive = true
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
            // 1/N 배지
            pageBadge.text = "1 / \(imgs.count)"
            pageBadge.font = .systemFont(ofSize: 11, weight: .semibold)
            pageBadge.textColor = .white
            pageBadge.backgroundColor = UIColor.black.withAlphaComponent(0.45)
            pageBadge.textAlignment = .center
            pageBadge.layer.cornerRadius = 11; pageBadge.clipsToBounds = true
            pageBadge.translatesAutoresizingMaskIntoConstraints = false
            holder.addSubview(pageBadge)
        }
        NSLayoutConstraint.activate([
            carousel.topAnchor.constraint(equalTo: holder.topAnchor),
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
                pageBadge.trailingAnchor.constraint(equalTo: holder.trailingAnchor, constant: -12),
                pageBadge.bottomAnchor.constraint(equalTo: holder.bottomAnchor, constant: -12),
                pageBadge.heightAnchor.constraint(equalToConstant: 22),
                pageBadge.widthAnchor.constraint(greaterThanOrEqualToConstant: 44),
            ])
        }
        return holder
    }

    func scrollViewDidScroll(_ sv: UIScrollView) {
        guard sv == carousel, carousel.bounds.width > 0, dotViews.count > 1 else { return }
        let page = Int(round(carousel.contentOffset.x / carousel.bounds.width))
        for (i, dot) in dotViews.enumerated() {
            dot.backgroundColor = i == page ? .white : UIColor.white.withAlphaComponent(0.5)
        }
        pageBadge.text = "\(min(dotViews.count, max(1, page + 1))) / \(dotViews.count)"
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

        // 주요 경력 카드
        let lines = mainExp.split(whereSeparator: { $0 == "\n" || $0 == "/" }).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        if !lines.isEmpty {
            let cc = UIView()
            cc.backgroundColor = UIColor(red: 0.969, green: 0.98, blue: 1.0, alpha: 1)
            cc.layer.cornerRadius = 12; cc.layer.cornerCurve = .continuous
            cc.layer.borderWidth = 1; cc.layer.borderColor = UIColor(white: 0.93, alpha: 1).cgColor
            let t = UILabel(); t.text = "주요 경력"; t.font = .systemFont(ofSize: 11, weight: .bold); t.textColor = blue
            let ul = UIStackView(arrangedSubviews: [t]); ul.axis = .vertical; ul.spacing = 4
            ul.setCustomSpacing(7, after: t)
            for line in lines.prefix(5) {
                let dot = UILabel(); dot.text = "•"; dot.font = .systemFont(ofSize: 13); dot.textColor = blue
                dot.setContentHuggingPriority(.required, for: .horizontal)
                let tx = UILabel(); tx.text = line; tx.font = .systemFont(ofSize: 13); tx.textColor = UIColor(white: 0.2, alpha: 1); tx.numberOfLines = 0
                let r = UIStackView(arrangedSubviews: [dot, tx]); r.axis = .horizontal; r.spacing = 6; r.alignment = .firstBaseline
                ul.addArrangedSubview(r)
            }
            pin(ul, into: cc, inset: 14)
            col.addArrangedSubview(cc)
        }
        return col
    }

    private func buildSection(title: String, body: String) -> UIView {
        let card = glassCard()
        let t = UILabel(); t.text = title; t.font = .systemFont(ofSize: 16, weight: .bold); t.textColor = UIColor(white: 0.12, alpha: 1)
        let b = UILabel(); b.text = body; b.font = .systemFont(ofSize: 14.5); b.textColor = UIColor(white: 0.35, alpha: 1); b.numberOfLines = 0
        let col = UIStackView(arrangedSubviews: [t, b]); col.axis = .vertical; col.spacing = 10
        pin(col, into: card, inset: 18)
        return card
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

        let badge = PaddingLabel()
        badge.text = "✓ Partners"
        badge.inset = UIEdgeInsets(top: 2, left: 6, bottom: 2, right: 6)
        badge.font = .systemFont(ofSize: 9, weight: .bold)
        badge.textColor = blue
        badge.backgroundColor = UIColor(red: 0.918, green: 0.953, blue: 1.0, alpha: 1)
        badge.layer.cornerRadius = 8; badge.clipsToBounds = true
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
    private func buildReviews(_ reviews: [[String: Any]], rating: Double, count: Int,
                              scores: [Double], potential: Int, hasAnyScore: Bool) -> UIView {
        let card = glassCard()
        let col = UIStackView(); col.axis = .vertical; col.spacing = 14; col.alignment = .fill

        let t = UILabel(); t.text = "리뷰"; t.font = .systemFont(ofSize: 18, weight: .bold); t.textColor = UIColor(white: 0.1, alpha: 1)
        col.addArrangedSubview(t)

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

        let realReviews = reviews.filter { !(((($0["content"] as? String) ?? (($0["comment"] as? String))) ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) }
        if realReviews.isEmpty {
            let box = UIView(); box.backgroundColor = UIColor(white: 0.97, alpha: 1); box.layer.cornerRadius = 14; box.layer.cornerCurve = .continuous
            let e1 = UILabel(); e1.text = "아직 표시할 리뷰가 없습니다"; e1.font = .systemFont(ofSize: 14, weight: .semibold); e1.textColor = UIColor(white: 0.4, alpha: 1); e1.textAlignment = .center
            let e2 = UILabel(); e2.text = "리뷰가 등록되면 이곳에 바로 보여집니다"; e2.font = .systemFont(ofSize: 12); e2.textColor = UIColor(white: 0.6, alpha: 1); e2.textAlignment = .center
            let ec = UIStackView(arrangedSubviews: [e1, e2]); ec.axis = .vertical; ec.spacing = 4; ec.alignment = .center
            pin(ec, into: box, inset: 22)
            col.addArrangedSubview(box)
        } else {
            for r in realReviews.prefix(10) {
                let rv = intVal(r["rating"]) > 0 ? intVal(r["rating"]) : Int(dbl(r["avgRating"]) ?? 5)
                let stars = UILabel(); stars.text = String(repeating: "★", count: min(5, max(1, rv))); stars.font = .systemFont(ofSize: 12); stars.textColor = UIColor(red: 1.0, green: 0.72, blue: 0.0, alpha: 1)
                let body = UILabel(); body.text = ((r["content"] as? String) ?? (r["comment"] as? String)) ?? ""; body.font = .systemFont(ofSize: 13.5); body.textColor = UIColor(white: 0.25, alpha: 1); body.numberOfLines = 0
                let rc = UIStackView(arrangedSubviews: [stars, body]); rc.axis = .vertical; rc.spacing = 5
                col.addArrangedSubview(divider()); col.addArrangedSubview(rc)
            }
        }
        pin(col, into: card, inset: 18)
        return card
    }

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

    // MARK: - FAQ (아코디언 — 기본 3개)
    private func buildFaq(category: String, hasVideo: Bool) -> UIView {
        let card = glassCard()
        let t = UILabel(); t.text = "FAQ"; t.font = .systemFont(ofSize: 18, weight: .bold); t.textColor = UIColor(white: 0.1, alpha: 1)
        let col = UIStackView(arrangedSubviews: [t]); col.axis = .vertical; col.spacing = 0; col.alignment = .fill
        col.setCustomSpacing(6, after: t)
        let faqs: [(String, String)] = [
            ("\(category) 섭외는 어떻게 진행되나요?", "문의하기로 장소와 행사 성격을 알려주시면 사회자가 가능 여부와 견적을 확인해 답변드립니다. 이후 결제와 사전 미팅을 통해 진행 방향을 조율합니다."),
            ("행사 전 준비 자료는 언제 전달하면 되나요?", "행사 개요, 식순, 요청 멘트, 참고 대본이 있다면 전달해 주세요. 결혼식은 보통 본식 한 달 전후로 사전 질문지를 기반으로 대본을 맞춰갑니다."),
            ("진행 영상이나 포트폴리오는 어디에서 볼 수 있나요?", hasVideo ? "상세페이지의 영상 섹션에서 대표 진행 영상을 확인할 수 있습니다." : "등록된 영상이 없는 경우 문의하기로 참고 포트폴리오를 요청할 수 있습니다."),
        ]
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
    private func glassCard() -> UIView {
        let v = UIView()
        v.backgroundColor = .white
        v.layer.cornerRadius = 14; v.layer.cornerCurve = .continuous
        v.layer.borderWidth = 1; v.layer.borderColor = UIColor(white: 0.91, alpha: 1).cgColor
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
        v.translatesAutoresizingMaskIntoConstraints = false
        parent.addSubview(v)
        NSLayoutConstraint.activate([
            v.topAnchor.constraint(equalTo: parent.topAnchor, constant: inset),
            v.bottomAnchor.constraint(equalTo: parent.bottomAnchor, constant: -inset),
            v.leadingAnchor.constraint(equalTo: parent.leadingAnchor, constant: inset),
            v.trailingAnchor.constraint(equalTo: parent.trailingAnchor, constant: -inset),
        ])
    }
    private func intVal(_ v: Any?) -> Int { (v as? Int) ?? Int((v as? Double) ?? 0) }
    private func dbl(_ v: Any?) -> Double? {
        if let d = v as? Double { return d }
        if let i = v as? Int { return Double(i) }
        if let s = v as? String { return Double(s) }
        return nil
    }
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
