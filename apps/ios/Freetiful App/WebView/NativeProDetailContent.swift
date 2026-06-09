import UIKit

protocol NativeProDetailDelegate: AnyObject {
    func proDetailInquiry(_ id: String)
}

// 사회자 상세 네이티브 (1단계) — 사진 카루셀 + 정보 글래스 카드 + 소개 + 서비스 + 리뷰 + 글래스 문의 CTA
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

    // CTA
    private let ctaBar = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
    private let ctaButton = UIButton(type: .system)

    private var proId = ""
    private var topInset: CGFloat = 0
    private var contentTop: NSLayoutConstraint!

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setInsets(top: CGFloat, bottom: CGFloat) {
        topInset = top
        contentTop?.constant = -top   // 카루셀은 상단(노치/백헤더 뒤)까지 확장
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

        // CTA 바
        ctaBar.translatesAutoresizingMaskIntoConstraints = false
        ctaBar.layer.cornerRadius = 26
        ctaBar.layer.cornerCurve = .continuous
        ctaBar.clipsToBounds = true
        ctaBar.layer.borderWidth = 1
        ctaBar.layer.borderColor = UIColor.white.withAlphaComponent(0.4).cgColor
        addSubview(ctaBar)
        var cfg = UIButton.Configuration.filled()
        cfg.title = "문의하기"
        cfg.baseBackgroundColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
        cfg.baseForegroundColor = .white
        cfg.cornerStyle = .capsule
        cfg.contentInsets = NSDirectionalEdgeInsets(top: 14, leading: 20, bottom: 14, trailing: 20)
        ctaButton.configuration = cfg
        ctaButton.titleLabel?.font = .systemFont(ofSize: 16, weight: .bold)
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
            ctaButton.topAnchor.constraint(equalTo: ctaBar.contentView.topAnchor, constant: 4),
            ctaButton.bottomAnchor.constraint(equalTo: ctaBar.contentView.bottomAnchor, constant: -4),
            ctaButton.leadingAnchor.constraint(equalTo: ctaBar.contentView.leadingAnchor, constant: 6),
            ctaButton.trailingAnchor.constraint(equalTo: ctaBar.contentView.trailingAnchor, constant: -6),
        ])
    }

    @objc private func ctaTapped() { Haptics.tap(); delegate?.proDetailInquiry(proId) }

    func loadDetail(id: String) {
        proId = id
        loadingLabel.isHidden = false
        contentStack.isHidden = true
        ctaBar.isHidden = true
        NativeHomeData.loadProDetail(id) { [weak self] d in
            guard let self = self else { return }
            guard let d = d else { self.loadingLabel.text = "불러오지 못했습니다"; return }
            self.render(d)
        }
    }

    private func render(_ d: [String: Any]) {
        loadingLabel.isHidden = true
        contentStack.isHidden = false
        ctaBar.isHidden = false
        contentStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        scrollView.contentOffset = CGPoint(x: 0, y: -topInset)

        // 데이터
        let user = d["user"] as? [String: Any]
        let name = (user?["name"] as? String) ?? "사회자"
        let career = intVal(d["careerYears"])
        let rating = (d["avgRating"] as? Double) ?? Double(intVal(d["avgRating"]))
        let reviewCount = intVal(d["reviewCount"])
        let responseRate = intVal(d["responseRate"])
        let tags = strArr(d["tagList"]).isEmpty ? strArr(d["tags"]) : strArr(d["tagList"])
        let category = strArr(d["categoryNames"]).first ?? "사회자"
        let regions = strArr(d["regionNames"]).joined(separator: ", ")
        let images = imageUrls(d["images"])
        let intro = NativeHelpContent.htmlToText((d["detailHtml"] as? String) ?? "")
        let shortIntro = (d["shortIntro"] as? String) ?? (d["mainExperience"] as? String) ?? ""
        let services = d["services"] as? [[String: Any]] ?? []
        let reviews = d["reviews"] as? [[String: Any]] ?? []

        // 1) 사진 카루셀
        contentStack.addArrangedSubview(buildCarousel(images))

        // 2) 정보 글래스 카드
        contentStack.addArrangedSubview(wrapPad(buildInfoCard(name: name, category: category, regions: regions,
            career: career, rating: rating, reviewCount: reviewCount, responseRate: responseRate, tags: tags, shortIntro: shortIntro)))

        // 3) 소개
        if !intro.isEmpty {
            contentStack.addArrangedSubview(wrapPad(buildSection(title: "사회자 소개", body: intro)))
        }
        // 4) 서비스
        if !services.isEmpty {
            contentStack.addArrangedSubview(wrapPad(buildServices(services)))
        }
        // 5) 리뷰
        contentStack.addArrangedSubview(wrapPad(buildReviews(reviews, rating: rating, count: reviewCount)))
    }

    // MARK: - 섹션 빌더
    private func buildCarousel(_ images: [String]) -> UIView {
        let holder = UIView()
        let w = UIScreen.main.bounds.width
        let h = w * 1.15
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
        dotViews.forEach { $0.removeFromSuperview() }
        dotViews = []
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
    }

    private func buildInfoCard(name: String, category: String, regions: String, career: Int, rating: Double,
                               reviewCount: Int, responseRate: Int, tags: [String], shortIntro: String) -> UIView {
        let card = glassCard()
        let nameLabel = UILabel()
        nameLabel.text = name
        nameLabel.font = .systemFont(ofSize: 22, weight: .bold)
        nameLabel.textColor = UIColor(white: 0.1, alpha: 1)
        let sub = UILabel()
        sub.text = [category, regions.isEmpty ? nil : regions].compactMap { $0 }.joined(separator: " · ")
        sub.font = .systemFont(ofSize: 13, weight: .medium)
        sub.textColor = UIColor(white: 0.5, alpha: 1)
        // 통계 행
        let stats = UIStackView()
        stats.axis = .horizontal; stats.distribution = .fillEqually; stats.spacing = 8
        stats.addArrangedSubview(statBox(career > 0 ? "\(career)년" : "신규", "경력"))
        stats.addArrangedSubview(statBox(rating > 0 ? String(format: "%.1f", rating) : "-", "평점(\(reviewCount))"))
        stats.addArrangedSubview(statBox(responseRate > 0 ? "\(responseRate)%" : "-", "응답률"))
        let col = UIStackView(arrangedSubviews: [nameLabel, sub, stats])
        col.axis = .vertical; col.spacing = 8
        col.setCustomSpacing(14, after: sub)
        if !shortIntro.isEmpty {
            let si = UILabel()
            si.text = shortIntro
            si.font = .systemFont(ofSize: 13.5)
            si.textColor = UIColor(white: 0.35, alpha: 1)
            si.numberOfLines = 0
            col.addArrangedSubview(si)
        }
        if !tags.isEmpty {
            let tagWrap = flowTags(tags)
            col.addArrangedSubview(tagWrap)
        }
        pin(col, into: card, inset: 18)
        return card
    }

    private func buildSection(title: String, body: String) -> UIView {
        let card = glassCard()
        let t = UILabel(); t.text = title; t.font = .systemFont(ofSize: 16, weight: .bold); t.textColor = UIColor(white: 0.12, alpha: 1)
        let b = UILabel(); b.text = body; b.font = .systemFont(ofSize: 14.5); b.textColor = UIColor(white: 0.35, alpha: 1); b.numberOfLines = 0
        let col = UIStackView(arrangedSubviews: [t, b]); col.axis = .vertical; col.spacing = 10
        pin(col, into: card, inset: 18)
        return card
    }

    private func buildServices(_ services: [[String: Any]]) -> UIView {
        let card = glassCard()
        let t = UILabel(); t.text = "제공 서비스"; t.font = .systemFont(ofSize: 16, weight: .bold); t.textColor = UIColor(white: 0.12, alpha: 1)
        let col = UIStackView(arrangedSubviews: [t]); col.axis = .vertical; col.spacing = 12
        for s in services where (s["isActive"] as? Bool) ?? true {
            let title = (s["title"] as? String) ?? "서비스"
            let desc = (s["description"] as? String) ?? ""
            let price = intVal(s["basePrice"])
            let row = UIView()
            let nameL = UILabel(); nameL.text = title; nameL.font = .systemFont(ofSize: 14.5, weight: .semibold); nameL.textColor = UIColor(white: 0.15, alpha: 1)
            let descL = UILabel(); descL.text = desc; descL.font = .systemFont(ofSize: 12.5); descL.textColor = UIColor(white: 0.5, alpha: 1); descL.numberOfLines = 0
            let priceL = UILabel(); priceL.text = price > 0 ? "\(price.formattedWon)원" : "문의"; priceL.font = .systemFont(ofSize: 14, weight: .bold); priceL.textColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
            priceL.setContentHuggingPriority(.required, for: .horizontal)
            let left = UIStackView(arrangedSubviews: [nameL, descL]); left.axis = .vertical; left.spacing = 3
            left.translatesAutoresizingMaskIntoConstraints = false
            priceL.translatesAutoresizingMaskIntoConstraints = false
            row.addSubview(left); row.addSubview(priceL)
            NSLayoutConstraint.activate([
                left.topAnchor.constraint(equalTo: row.topAnchor), left.bottomAnchor.constraint(equalTo: row.bottomAnchor),
                left.leadingAnchor.constraint(equalTo: row.leadingAnchor),
                priceL.leadingAnchor.constraint(greaterThanOrEqualTo: left.trailingAnchor, constant: 8),
                priceL.trailingAnchor.constraint(equalTo: row.trailingAnchor),
                priceL.centerYAnchor.constraint(equalTo: left.centerYAnchor),
            ])
            col.addArrangedSubview(divider())
            col.addArrangedSubview(row)
        }
        pin(col, into: card, inset: 18)
        return card
    }

    private func buildReviews(_ reviews: [[String: Any]], rating: Double, count: Int) -> UIView {
        let card = glassCard()
        let t = UILabel()
        t.text = "리뷰 \(count > 0 ? "\(count)" : "")"
        t.font = .systemFont(ofSize: 16, weight: .bold); t.textColor = UIColor(white: 0.12, alpha: 1)
        let col = UIStackView(arrangedSubviews: [t]); col.axis = .vertical; col.spacing = 12
        if reviews.isEmpty {
            let empty = UILabel(); empty.text = "아직 등록된 리뷰가 없습니다"; empty.font = .systemFont(ofSize: 13.5); empty.textColor = UIColor(white: 0.55, alpha: 1)
            col.addArrangedSubview(empty)
        } else {
            for r in reviews.prefix(10) {
                let rl = UILabel()
                let stars = intVal(r["rating"]) > 0 ? String(repeating: "★", count: min(5, intVal(r["rating"]))) : "★★★★★"
                rl.text = stars
                rl.font = .systemFont(ofSize: 12); rl.textColor = UIColor(red: 1.0, green: 0.7, blue: 0.0, alpha: 1)
                let cl = UILabel(); cl.text = (r["content"] as? String) ?? ""; cl.font = .systemFont(ofSize: 13.5); cl.textColor = UIColor(white: 0.3, alpha: 1); cl.numberOfLines = 0
                let rc = UIStackView(arrangedSubviews: [rl, cl]); rc.axis = .vertical; rc.spacing = 5
                col.addArrangedSubview(divider())
                col.addArrangedSubview(rc)
            }
        }
        pin(col, into: card, inset: 18)
        return card
    }

    // MARK: - 헬퍼
    private func glassCard() -> UIView {
        let v = UIView()
        v.backgroundColor = .white
        v.layer.cornerRadius = 18
        v.layer.cornerCurve = .continuous
        v.translatesAutoresizingMaskIntoConstraints = false
        return v
    }
    private func statBox(_ value: String, _ label: String) -> UIView {
        let box = UIView()
        box.backgroundColor = UIColor(red: 0.96, green: 0.97, blue: 1.0, alpha: 1)
        box.layer.cornerRadius = 12
        let v = UILabel(); v.text = value; v.font = .systemFont(ofSize: 16, weight: .bold); v.textColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1); v.textAlignment = .center
        let l = UILabel(); l.text = label; l.font = .systemFont(ofSize: 10.5); l.textColor = UIColor(white: 0.5, alpha: 1); l.textAlignment = .center
        let c = UIStackView(arrangedSubviews: [v, l]); c.axis = .vertical; c.spacing = 2; c.alignment = .center
        pin(c, into: box, inset: 10)
        return box
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

private extension Int {
    var formattedWon: String {
        let f = NumberFormatter(); f.numberStyle = .decimal
        return f.string(from: NSNumber(value: self)) ?? "\(self)"
    }
}
