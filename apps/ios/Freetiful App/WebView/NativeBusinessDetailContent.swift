import UIKit

// 웨딩파트너(업체) 상세 — 웹 /businesses/[id] 모바일 페이지를 네이티브로 재현
// 갤러리 + 카테고리/이름/태그 + 주소/전화/SNS + 소개 HTML + 전화문의 글래스 CTA
final class NativeBusinessDetailContent: UIView, UIScrollViewDelegate {
    var onScroll: ((CGFloat) -> Void)?
    var onTitle: ((String) -> Void)?

    private let scroll = UIScrollView()
    private let contentStack = UIStackView()
    private var topInset: CGFloat = 0

    // 갤러리
    private let gallery = UIScrollView()
    private var galleryHeight: NSLayoutConstraint?
    private let pageDots = UIStackView()
    private let counter = PaddingLabel3()
    private var imageURLs: [String] = []

    // CTA
    private let cta = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
    private let ctaButton = UIButton(type: .system)
    private let ctaHighlight = CAGradientLayer()
    private var ctaBottom: NSLayoutConstraint?
    private var phoneDigits = ""
    private var loadedId = ""

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setup() {
        backgroundColor = UIColor(red: 0.969, green: 0.973, blue: 0.980, alpha: 1)   // #F7F8FA
        translatesAutoresizingMaskIntoConstraints = false

        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.delegate = self
        scroll.contentInsetAdjustmentBehavior = .never
        scroll.showsVerticalScrollIndicator = true
        addSubview(scroll)

        contentStack.axis = .vertical
        contentStack.spacing = 12
        contentStack.alignment = .fill
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(contentStack)

        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: topAnchor),
            scroll.leadingAnchor.constraint(equalTo: leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: bottomAnchor),
            contentStack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            contentStack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
            contentStack.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor),
            contentStack.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor),
        ])
        setupCTA()
    }

    private func setupCTA() {
        cta.layer.cornerRadius = 28; cta.layer.cornerCurve = .continuous
        cta.contentView.layer.cornerRadius = 28; cta.contentView.layer.cornerCurve = .continuous; cta.contentView.clipsToBounds = true
        cta.layer.borderWidth = 1; cta.layer.borderColor = UIColor.white.withAlphaComponent(0.55).cgColor
        cta.contentView.backgroundColor = UIColor(red: 44/255, green: 83/255, blue: 255/255, alpha: 0.6)
        cta.translatesAutoresizingMaskIntoConstraints = false
        cta.isHidden = true

        ctaHighlight.colors = [UIColor.white.withAlphaComponent(0.35).cgColor, UIColor.white.withAlphaComponent(0).cgColor]
        ctaHighlight.startPoint = CGPoint(x: 0.5, y: 0); ctaHighlight.endPoint = CGPoint(x: 0.5, y: 1)
        cta.contentView.layer.addSublayer(ctaHighlight)

        var c = UIButton.Configuration.plain()
        c.title = "전화 문의"
        c.baseForegroundColor = .white
        c.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer {
            var o = $0; o.font = .systemFont(ofSize: 16.5, weight: .bold); return o
        }
        ctaButton.configuration = c
        ctaButton.translatesAutoresizingMaskIntoConstraints = false
        ctaButton.addTarget(self, action: #selector(tapCall), for: .touchUpInside)
        cta.contentView.addSubview(ctaButton)
        addSubview(cta)

        let bottom = cta.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.bottomAnchor, constant: -10)
        ctaBottom = bottom
        NSLayoutConstraint.activate([
            cta.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            cta.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            cta.heightAnchor.constraint(equalToConstant: 56),
            bottom,
            ctaButton.topAnchor.constraint(equalTo: cta.contentView.topAnchor),
            ctaButton.bottomAnchor.constraint(equalTo: cta.contentView.bottomAnchor),
            ctaButton.leadingAnchor.constraint(equalTo: cta.contentView.leadingAnchor),
            ctaButton.trailingAnchor.constraint(equalTo: cta.contentView.trailingAnchor),
        ])
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        ctaHighlight.frame = CGRect(x: 0, y: 0, width: cta.contentView.bounds.width, height: 26)
    }

    func setInsets(top: CGFloat, bottom: CGFloat) {
        topInset = top
        scroll.contentInset = UIEdgeInsets(top: top, left: 0, bottom: bottom + 80, right: 0)
        scroll.verticalScrollIndicatorInsets.top = top
    }
    func scrollToTop() { scroll.setContentOffset(CGPoint(x: 0, y: -scroll.contentInset.top), animated: false) }

    func loadDetail(id: String) {
        guard id != loadedId else { return }
        loadedId = id
        // 로딩 자리표시
        if contentStack.arrangedSubviews.isEmpty {
            let sk = UIView(); sk.backgroundColor = UIColor(white: 0.93, alpha: 1)
            sk.heightAnchor.constraint(equalToConstant: 260).isActive = true
            contentStack.addArrangedSubview(sk)
        }
        NativeHomeData.loadBizDetail(id) { [weak self] dict in
            guard let self = self, self.loadedId == id, let d = dict else { return }
            self.render(d)
        }
    }

    private func render(_ d: [String: Any]) {
        contentStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        scrollToTop()

        let name = (d["businessName"] as? String) ?? (d["name"] as? String) ?? "업체"
        onTitle?(name)

        // 카테고리
        let cats = (d["categories"] as? [[String: Any]])?.compactMap { ($0["category"] as? [String: Any])?["name"] as? String } ?? []
        let category = cats.first ?? ((d["businessType"] as? String) ?? "웨딩파트너")

        // 이미지
        imageURLs = parseImages(d)
        contentStack.addArrangedSubview(buildGallery())

        // 정보 카드
        contentStack.addArrangedSubview(wrapPad(buildInfo(name: name, category: category, d: d)))

        // 소개
        if let desc = buildDescription((d["descriptionHtml"] as? String) ?? "") {
            contentStack.addArrangedSubview(wrapPad(desc))
        }

        // 전화 CTA
        if let phone = (d["phone"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines), !phone.isEmpty {
            phoneDigits = phone.filter { $0.isNumber || $0 == "+" }
            cta.isHidden = phoneDigits.isEmpty
        } else {
            cta.isHidden = true
        }

        // 진입 애니메이션 (섹션 스태거 fade+rise)
        for (i, v) in contentStack.arrangedSubviews.enumerated() {
            v.alpha = 0
            v.transform = CGAffineTransform(translationX: 0, y: 16)
            UIView.animate(withDuration: 0.5, delay: Double(i) * 0.06, options: [.curveEaseOut]) {
                v.alpha = 1; v.transform = .identity
            }
        }
        if !cta.isHidden {
            cta.alpha = 0
            UIView.animate(withDuration: 0.5, delay: 0.2, options: [.curveEaseOut]) { self.cta.alpha = 1 }
        }
    }

    private func parseImages(_ d: [String: Any]) -> [String] {
        if let a = d["images"] as? [[String: Any]] {
            return a.compactMap { $0["imageUrl"] as? String }.filter { !$0.isEmpty }
        }
        if let a = d["images"] as? [String] { return a.filter { !$0.isEmpty } }
        return []
    }

    // MARK: - 갤러리 (페이징 + 닷 + 카운터)
    private func buildGallery() -> UIView {
        let holder = UIView()
        holder.translatesAutoresizingMaskIntoConstraints = false

        gallery.subviews.forEach { $0.removeFromSuperview() }
        gallery.isPagingEnabled = true
        gallery.showsHorizontalScrollIndicator = false
        gallery.delegate = self
        gallery.translatesAutoresizingMaskIntoConstraints = false
        gallery.backgroundColor = UIColor(white: 0.93, alpha: 1)
        holder.addSubview(gallery)

        let w = UIScreen.main.bounds.width
        let h = round(w * 0.68)   // 약 3:2
        galleryHeight?.isActive = false
        let gh = gallery.heightAnchor.constraint(equalToConstant: h)
        gh.isActive = true
        galleryHeight = gh

        let row = UIStackView(); row.axis = .horizontal; row.spacing = 0
        row.translatesAutoresizingMaskIntoConstraints = false
        gallery.addSubview(row)
        NSLayoutConstraint.activate([
            row.topAnchor.constraint(equalTo: gallery.contentLayoutGuide.topAnchor),
            row.bottomAnchor.constraint(equalTo: gallery.contentLayoutGuide.bottomAnchor),
            row.leadingAnchor.constraint(equalTo: gallery.contentLayoutGuide.leadingAnchor),
            row.trailingAnchor.constraint(equalTo: gallery.contentLayoutGuide.trailingAnchor),
            row.heightAnchor.constraint(equalTo: gallery.heightAnchor),
        ])

        let urls = imageURLs.isEmpty ? [""] : imageURLs
        for src in urls.prefix(15) {
            let iv = UIImageView()
            iv.contentMode = .scaleAspectFill
            iv.clipsToBounds = true
            iv.backgroundColor = UIColor(white: 0.93, alpha: 1)
            iv.translatesAutoresizingMaskIntoConstraints = false
            iv.widthAnchor.constraint(equalToConstant: w).isActive = true
            NativeChatImageLoader.load(src, into: iv, fallback: nil)
            row.addArrangedSubview(iv)
        }

        NSLayoutConstraint.activate([
            gallery.topAnchor.constraint(equalTo: holder.topAnchor),
            gallery.leadingAnchor.constraint(equalTo: holder.leadingAnchor),
            gallery.trailingAnchor.constraint(equalTo: holder.trailingAnchor),
            gallery.bottomAnchor.constraint(equalTo: holder.bottomAnchor),
        ])

        // 페이지 닷
        pageDots.arrangedSubviews.forEach { $0.removeFromSuperview() }
        pageDots.axis = .horizontal; pageDots.spacing = 6; pageDots.alignment = .center
        pageDots.translatesAutoresizingMaskIntoConstraints = false
        let count = min(15, max(1, imageURLs.count))
        if count > 1 {
            for i in 0..<count {
                let dot = UIView()
                dot.backgroundColor = UIColor.white.withAlphaComponent(i == 0 ? 1 : 0.5)
                dot.layer.cornerRadius = 3
                dot.translatesAutoresizingMaskIntoConstraints = false
                dot.widthAnchor.constraint(equalToConstant: 6).isActive = true
                dot.heightAnchor.constraint(equalToConstant: 6).isActive = true
                pageDots.addArrangedSubview(dot)
            }
            holder.addSubview(pageDots)
            NSLayoutConstraint.activate([
                pageDots.centerXAnchor.constraint(equalTo: holder.centerXAnchor),
                pageDots.bottomAnchor.constraint(equalTo: holder.bottomAnchor, constant: -14),
            ])
        }

        // 카운터 배지
        if imageURLs.count > 1 {
            counter.text = "1 / \(imageURLs.count)"
            counter.font = .systemFont(ofSize: 11, weight: .semibold)
            counter.textColor = .white
            counter.backgroundColor = UIColor.black.withAlphaComponent(0.45)
            counter.textInsets = UIEdgeInsets(top: 4, left: 9, bottom: 4, right: 9)
            counter.layer.cornerRadius = 11; counter.clipsToBounds = true
            counter.translatesAutoresizingMaskIntoConstraints = false
            holder.addSubview(counter)
            NSLayoutConstraint.activate([
                counter.trailingAnchor.constraint(equalTo: holder.trailingAnchor, constant: -12),
                counter.bottomAnchor.constraint(equalTo: holder.bottomAnchor, constant: -12),
            ])
        }
        return holder
    }

    // MARK: - 정보 카드
    private func buildInfo(name: String, category: String, d: [String: Any]) -> UIView {
        let card = glassCard()
        let col = UIStackView(); col.axis = .vertical; col.spacing = 4; col.alignment = .fill

        let catL = UILabel()
        catL.text = category
        catL.font = .systemFont(ofSize: 12, weight: .bold)
        catL.textColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
        col.addArrangedSubview(catL)

        let nameL = UILabel()
        nameL.text = name
        nameL.font = .systemFont(ofSize: 22, weight: .bold)
        nameL.textColor = UIColor(white: 0.1, alpha: 1)
        nameL.numberOfLines = 0
        col.addArrangedSubview(nameL)
        col.setCustomSpacing(12, after: nameL)

        // 태그 (파란 pill)
        let tags = parseTags(d)
        if !tags.isEmpty {
            col.addArrangedSubview(flowTags(tags))
            col.setCustomSpacing(16, after: col.arrangedSubviews.last!)
        }

        // 주소
        if let addr = (d["address"] as? String), !addr.isEmpty {
            let detail = (d["addressDetail"] as? String) ?? ""
            col.addArrangedSubview(infoRow(symbol: "mappin.and.ellipse", title: addr, subtitle: detail.isEmpty ? nil : detail))
        }
        // 전화
        if let phone = (d["phone"] as? String), !phone.isEmpty {
            col.addArrangedSubview(infoRow(symbol: "phone.fill", title: phone, subtitle: nil, tint: true))
        }

        // SNS 칩
        let snsRow = UIStackView(); snsRow.axis = .horizontal; snsRow.spacing = 8; snsRow.alignment = .center
        if let ig = (d["instagramUrl"] as? String), !ig.isEmpty { snsRow.addArrangedSubview(snsChip("Instagram", url: ig)) }
        if let web = (d["websiteUrl"] as? String), !web.isEmpty { snsRow.addArrangedSubview(snsChip("웹사이트", url: web)) }
        if !snsRow.arrangedSubviews.isEmpty {
            snsRow.addArrangedSubview(UIView())
            col.setCustomSpacing(14, after: col.arrangedSubviews.last!)
            col.addArrangedSubview(snsRow)
        }

        pin(col, into: card, inset: 18)
        return card
    }

    private func parseTags(_ d: [String: Any]) -> [String] {
        if let a = d["tags"] as? [String] { return Array(a.prefix(6)) }
        if let a = d["tags"] as? [Any] { return Array(a.compactMap { $0 as? String }.prefix(6)) }
        return []
    }

    private func infoRow(symbol: String, title: String, subtitle: String?, tint: Bool = false) -> UIView {
        let row = UIStackView(); row.axis = .horizontal; row.spacing = 9; row.alignment = .top
        let icon = UIImageView(image: UIImage(systemName: symbol, withConfiguration: UIImage.SymbolConfiguration(pointSize: 14, weight: .regular)))
        icon.tintColor = UIColor(white: 0.62, alpha: 1)
        icon.setContentHuggingPriority(.required, for: .horizontal)
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.widthAnchor.constraint(equalToConstant: 18).isActive = true
        let iconWrap = UIView(); iconWrap.translatesAutoresizingMaskIntoConstraints = false
        iconWrap.addSubview(icon)
        NSLayoutConstraint.activate([
            icon.topAnchor.constraint(equalTo: iconWrap.topAnchor, constant: 2),
            icon.leadingAnchor.constraint(equalTo: iconWrap.leadingAnchor),
            icon.trailingAnchor.constraint(equalTo: iconWrap.trailingAnchor),
            icon.bottomAnchor.constraint(lessThanOrEqualTo: iconWrap.bottomAnchor),
        ])
        row.addArrangedSubview(iconWrap)

        let texts = UIStackView(); texts.axis = .vertical; texts.spacing = 2
        let t = UILabel(); t.text = title; t.font = .systemFont(ofSize: 14, weight: tint ? .medium : .regular)
        t.textColor = tint ? UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1) : UIColor(white: 0.27, alpha: 1)
        t.numberOfLines = 0
        texts.addArrangedSubview(t)
        if let sub = subtitle {
            let s = UILabel(); s.text = sub; s.font = .systemFont(ofSize: 12); s.textColor = UIColor(white: 0.6, alpha: 1); s.numberOfLines = 0
            texts.addArrangedSubview(s)
        }
        row.addArrangedSubview(texts)
        return row
    }

    private func snsChip(_ title: String, url: String) -> UIView {
        let b = UIButton(type: .system)
        var c = UIButton.Configuration.plain()
        c.title = title
        c.image = UIImage(systemName: title == "Instagram" ? "camera" : "globe", withConfiguration: UIImage.SymbolConfiguration(pointSize: 12, weight: .medium))
        c.imagePadding = 5
        c.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12)
        c.baseForegroundColor = UIColor(white: 0.35, alpha: 1)
        c.background.backgroundColor = UIColor(white: 0.95, alpha: 1)
        c.background.cornerRadius = 12
        c.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer {
            var o = $0; o.font = .systemFont(ofSize: 12, weight: .medium); return o
        }
        b.configuration = c
        b.addAction(UIAction { _ in
            guard let u = URL(string: url) else { return }
            UIApplication.shared.open(u)
        }, for: .touchUpInside)
        return b
    }

    // MARK: - 소개
    private func buildDescription(_ html: String) -> UIView? {
        let text = NativeHelpContent.htmlToText(html)
        let imgs = extractImageSrcs(html)
        guard !text.isEmpty || !imgs.isEmpty else { return nil }
        let card = glassCard()
        let col = UIStackView(); col.axis = .vertical; col.spacing = 12; col.alignment = .fill
        let h = UILabel(); h.text = "소개"; h.font = .systemFont(ofSize: 16, weight: .bold); h.textColor = UIColor(white: 0.12, alpha: 1)
        col.addArrangedSubview(h)
        if !text.isEmpty {
            let b = UILabel(); b.text = text; b.font = .systemFont(ofSize: 14.5); b.textColor = UIColor(white: 0.3, alpha: 1); b.numberOfLines = 0
            col.addArrangedSubview(b)
        }
        for src in imgs.prefix(15) {
            let iv = BizAspectImageView()
            iv.contentMode = .scaleAspectFill
            iv.clipsToBounds = true
            iv.layer.cornerRadius = 10; iv.layer.cornerCurve = .continuous
            iv.backgroundColor = UIColor(white: 0.95, alpha: 1)
            NativeChatImageLoader.load(src, into: iv, fallback: nil)
            col.addArrangedSubview(iv)
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

    @objc private func tapCall() {
        guard !phoneDigits.isEmpty, let url = URL(string: "tel://\(phoneDigits)") else { return }
        Haptics.tap()
        UIApplication.shared.open(url)
    }

    // MARK: - 글래스/레이아웃 헬퍼
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
        // 간단 2줄 flow (가로 스택 래핑)
        let outer = UIStackView(); outer.axis = .vertical; outer.spacing = 6; outer.alignment = .leading
        var line = UIStackView(); line.axis = .horizontal; line.spacing = 6
        var lineW: CGFloat = 0
        let maxW = UIScreen.main.bounds.width - 32 - 36
        for t in tags.prefix(6) {
            let chip = PaddingLabel3()
            chip.text = t
            chip.font = .systemFont(ofSize: 11, weight: .bold)
            chip.textColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
            chip.backgroundColor = UIColor(red: 0.949, green: 0.969, blue: 1, alpha: 1)   // #F2F7FF
            chip.textInsets = UIEdgeInsets(top: 4, left: 10, bottom: 4, right: 10)
            chip.layer.cornerRadius = 11; chip.clipsToBounds = true
            let cw = chip.intrinsicContentSize.width + 6
            if lineW + cw > maxW, !line.arrangedSubviews.isEmpty {
                outer.addArrangedSubview(line)
                line = UIStackView(); line.axis = .horizontal; line.spacing = 6
                lineW = 0
            }
            line.addArrangedSubview(chip)
            lineW += cw
        }
        if !line.arrangedSubviews.isEmpty { outer.addArrangedSubview(line) }
        return outer
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
        if let glass = parent as? UIVisualEffectView {
            glass.contentView.addSubview(v)
            NSLayoutConstraint.activate([
                v.topAnchor.constraint(equalTo: glass.contentView.topAnchor, constant: inset),
                v.bottomAnchor.constraint(equalTo: glass.contentView.bottomAnchor, constant: -inset),
                v.leadingAnchor.constraint(equalTo: glass.contentView.leadingAnchor, constant: inset),
                v.trailingAnchor.constraint(equalTo: glass.contentView.trailingAnchor, constant: -inset),
            ])
        } else {
            parent.addSubview(v)
            NSLayoutConstraint.activate([
                v.topAnchor.constraint(equalTo: parent.topAnchor, constant: inset),
                v.bottomAnchor.constraint(equalTo: parent.bottomAnchor, constant: -inset),
                v.leadingAnchor.constraint(equalTo: parent.leadingAnchor, constant: inset),
                v.trailingAnchor.constraint(equalTo: parent.trailingAnchor, constant: -inset),
            ])
        }
    }

    // MARK: - Scroll
    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        if scrollView == gallery {
            let w = UIScreen.main.bounds.width
            guard w > 0 else { return }
            let page = Int(round(scrollView.contentOffset.x / w))
            for (i, dot) in pageDots.arrangedSubviews.enumerated() {
                dot.backgroundColor = UIColor.white.withAlphaComponent(i == page ? 1 : 0.5)
            }
            if imageURLs.count > 1 { counter.text = "\(min(max(page + 1, 1), imageURLs.count)) / \(imageURLs.count)" }
            return
        }
        // 본문 스크롤 → 백헤더 글래스 진행도 (갤러리 높이 기준)
        let h = galleryHeight?.constant ?? 240
        let y = scrollView.contentOffset.y + topInset
        let p = max(0, min(1, y / max(1, h - topInset - 8)))
        onScroll?(p)
    }
}

// 소개 이미지 비율 유지
private final class BizAspectImageView: UIImageView {
    private var aspect: NSLayoutConstraint?
    override var image: UIImage? {
        didSet {
            guard let img = image, img.size.width > 0 else { return }
            let ratio = min(2.0, img.size.height / img.size.width)
            aspect?.isActive = false
            let c = heightAnchor.constraint(equalTo: widthAnchor, multiplier: ratio)
            c.priority = .required
            c.isActive = true
            aspect = c
            setNeedsLayout()
        }
    }
}
