import UIKit

// 사회자 리뷰 전체 리스트 (상세 리뷰 섹션 "전체보기" → /pros/:id/reviews)
final class NativeReviewListContent: UIView, UIScrollViewDelegate {
    var onScroll: ((CGFloat) -> Void)?
    private typealias Review = NativeProDetailContent.DisplayReview
    private let scoreLabels = ["경력", "만족도", "위트", "발성", "이미지", "구성력"]
    private let blue = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
    private let gold = UIColor(red: 1.0, green: 0.72, blue: 0.0, alpha: 1)

    private let scroll = UIScrollView()
    private let stack = UIStackView()
    private let spinner = UIActivityIndicatorView(style: .medium)
    private var topInset: CGFloat = 0
    private var loadedId = ""

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setup() {
        backgroundColor = UIColor(red: 0.969, green: 0.973, blue: 0.980, alpha: 1)
        translatesAutoresizingMaskIntoConstraints = false
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.delegate = self
        scroll.contentInsetAdjustmentBehavior = .never
        scroll.alwaysBounceVertical = true
        addSubview(scroll)
        stack.axis = .vertical; stack.spacing = 10; stack.alignment = .fill
        stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(stack)
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.hidesWhenStopped = true
        addSubview(spinner)
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: topAnchor),
            scroll.leadingAnchor.constraint(equalTo: leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: bottomAnchor),
            stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
            stack.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor, constant: -16),
            spinner.centerXAnchor.constraint(equalTo: centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
    }

    func setInsets(top: CGFloat, bottom: CGFloat) {
        topInset = top
        scroll.contentInset = UIEdgeInsets(top: top + 8, left: 0, bottom: bottom + 16, right: 0)
        scroll.verticalScrollIndicatorInsets.top = top
    }
    func scrollToTop() { scroll.setContentOffset(CGPoint(x: 0, y: -scroll.contentInset.top), animated: false) }

    func loadReviews(proId: String) {
        guard proId != loadedId else { return }
        loadedId = proId
        stack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        spinner.startAnimating()
        NativeHomeData.loadProDetail(proId) { [weak self] dict in
            guard let self = self, self.loadedId == proId, let d = dict else { return }
            let api = d["reviews"] as? [[String: Any]] ?? []
            let count = (d["reviewCount"] as? Int) ?? Int((d["reviewCount"] as? Double) ?? 0)
            let rating = (d["avgRating"] as? Double) ?? Double((d["avgRating"] as? Int) ?? 0)
            let reviews = NativeProDetailContent.resolveReviews(api: api, reviewCount: count, rating: rating)
            self.render(reviews: reviews, rating: rating, count: max(count, reviews.count))
        }
    }

    private func render(reviews: [Review], rating: Double, count: Int) {
        spinner.stopAnimating()
        stack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        stack.addArrangedSubview(summaryCard(rating: rating, count: count))
        if reviews.isEmpty {
            stack.addArrangedSubview(emptyCard())
        } else {
            for r in reviews { stack.addArrangedSubview(reviewCard(r)) }
        }
        scrollToTop()
        // 진입 애니메이션
        for (i, v) in stack.arrangedSubviews.enumerated() {
            v.alpha = 0; v.transform = CGAffineTransform(translationX: 0, y: 14)
            UIView.animate(withDuration: 0.45, delay: Double(min(i, 8)) * 0.05, options: [.curveEaseOut]) {
                v.alpha = 1; v.transform = .identity
            }
        }
    }

    private func summaryCard(rating: Double, count: Int) -> UIView {
        let card = whiteCard()
        let col = UIStackView(); col.axis = .vertical; col.spacing = 6; col.alignment = .center
        let big = UILabel(); big.text = String(format: "%.1f", rating); big.font = .systemFont(ofSize: 34, weight: .bold); big.textColor = UIColor(white: 0.1, alpha: 1)
        let starRow = UIStackView(); starRow.axis = .horizontal; starRow.spacing = 2
        let filled = Int(rating.rounded())
        for i in 0..<5 {
            let s = UILabel(); s.text = "★"; s.font = .systemFont(ofSize: 16)
            s.textColor = i < filled ? gold : UIColor(white: 0.85, alpha: 1)
            starRow.addArrangedSubview(s)
        }
        let cnt = UILabel(); cnt.text = "리뷰 \(count)건"; cnt.font = .systemFont(ofSize: 13, weight: .medium); cnt.textColor = UIColor(white: 0.5, alpha: 1)
        col.addArrangedSubview(big); col.addArrangedSubview(starRow); col.addArrangedSubview(cnt)
        pin(col, into: card, inset: 18)
        return card
    }

    private func emptyCard() -> UIView {
        let card = whiteCard()
        let e1 = UILabel(); e1.text = "아직 표시할 리뷰가 없습니다"; e1.font = .systemFont(ofSize: 14, weight: .semibold); e1.textColor = UIColor(white: 0.4, alpha: 1); e1.textAlignment = .center
        let e2 = UILabel(); e2.text = "리뷰가 등록되면 이곳에 바로 보여집니다"; e2.font = .systemFont(ofSize: 12); e2.textColor = UIColor(white: 0.6, alpha: 1); e2.textAlignment = .center
        let c = UIStackView(arrangedSubviews: [e1, e2]); c.axis = .vertical; c.spacing = 4; c.alignment = .center
        pin(c, into: card, inset: 26)
        return card
    }

    private func reviewCard(_ r: Review) -> UIView {
        let card = whiteCard()
        let col = UIStackView(); col.axis = .vertical; col.spacing = 9; col.alignment = .fill

        // 작성자 행
        let av = PaddingLabel()
        av.text = "🚀"; av.font = .systemFont(ofSize: 15); av.textAlignment = .center
        av.backgroundColor = UIColor(white: 0.95, alpha: 1)
        av.layer.cornerRadius = 17; av.clipsToBounds = true
        av.translatesAutoresizingMaskIntoConstraints = false
        av.widthAnchor.constraint(equalToConstant: 34).isActive = true
        av.heightAnchor.constraint(equalToConstant: 34).isActive = true
        let nameL = UILabel(); nameL.text = r.name; nameL.font = .systemFont(ofSize: 14); nameL.textColor = UIColor(white: 0.3, alpha: 1)
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
        let stars = UILabel(); stars.text = starString(r.rating); stars.font = .systemFont(ofSize: 12); stars.textColor = gold
        let rt = UILabel(); rt.text = String(format: "%.1f", r.rating); rt.font = .systemFont(ofSize: 12.5, weight: .bold); rt.textColor = UIColor(white: 0.1, alpha: 1)
        let sep = UILabel(); sep.text = "|"; sep.font = .systemFont(ofSize: 11); sep.textColor = UIColor(white: 0.8, alpha: 1)
        let dt = UILabel(); dt.text = r.date; dt.font = .systemFont(ofSize: 12); dt.textColor = UIColor(white: 0.6, alpha: 1)
        var metaItems: [UIView] = [stars, rt]
        if !r.date.isEmpty { metaItems += [sep, dt] }
        metaItems.append(UIView())
        let metaRow = UIStackView(arrangedSubviews: metaItems); metaRow.axis = .horizontal; metaRow.spacing = 6; metaRow.alignment = .center
        col.addArrangedSubview(metaRow)

        // 점수 칩 (가로 스크롤)
        if !r.scores.isEmpty {
            let wrap = UIStackView(); wrap.axis = .horizontal; wrap.spacing = 4; wrap.alignment = .center
            for label in scoreLabels where r.scores[label] != nil {
                let chip = PaddingLabel()
                chip.attributedText = scoreChipText(label, r.scores[label] ?? 0)
                chip.inset = UIEdgeInsets(top: 2, left: 6, bottom: 2, right: 6)
                chip.backgroundColor = UIColor(white: 0.95, alpha: 1)
                chip.layer.cornerRadius = 5; chip.clipsToBounds = true
                wrap.addArrangedSubview(chip)
            }
            wrap.addArrangedSubview(UIView())
            let s = UIScrollView(); s.showsHorizontalScrollIndicator = false
            s.translatesAutoresizingMaskIntoConstraints = false
            wrap.translatesAutoresizingMaskIntoConstraints = false
            s.addSubview(wrap)
            NSLayoutConstraint.activate([
                wrap.topAnchor.constraint(equalTo: s.contentLayoutGuide.topAnchor),
                wrap.bottomAnchor.constraint(equalTo: s.contentLayoutGuide.bottomAnchor),
                wrap.leadingAnchor.constraint(equalTo: s.contentLayoutGuide.leadingAnchor),
                wrap.trailingAnchor.constraint(equalTo: s.contentLayoutGuide.trailingAnchor),
                wrap.heightAnchor.constraint(equalTo: s.frameLayoutGuide.heightAnchor),
                s.heightAnchor.constraint(equalToConstant: 22),
            ])
            col.addArrangedSubview(s)
        }

        // 본문
        let body = UILabel(); body.text = r.content; body.font = .systemFont(ofSize: 14); body.textColor = UIColor(white: 0.2, alpha: 1); body.numberOfLines = 0
        col.addArrangedSubview(body)

        pin(col, into: card, inset: 16)
        return card
    }

    // MARK: helpers
    private func whiteCard() -> UIView {
        let v = UIView()
        v.backgroundColor = .white
        v.layer.cornerRadius = 18; v.layer.cornerCurve = .continuous
        v.layer.shadowColor = UIColor(red: 0.1, green: 0.15, blue: 0.3, alpha: 1).cgColor
        v.layer.shadowOpacity = 0.05; v.layer.shadowRadius = 10; v.layer.shadowOffset = CGSize(width: 0, height: 4)
        v.translatesAutoresizingMaskIntoConstraints = false
        return v
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

    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        let p = max(0, min(1, (scrollView.contentOffset.y + topInset) / 30))
        onScroll?(p)
    }
}
