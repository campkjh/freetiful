import UIKit

protocol NativeSearchDelegate: AnyObject {
    func searchDidTapPro(_ id: String)
    func searchDidCancel()
}

// 검색 화면 네이티브 — 글래스 검색바 + (빈 상태) 최근검색어/프리티풀 소개/오늘의 추천 사회자 + (입력 시) 결과
final class NativeSearchContent: UIView, UITextFieldDelegate {
    weak var delegate: NativeSearchDelegate?

    private let searchPill = GlassPill(corner: 21)
    private let field = UITextField()
    private let cancelButton = UIButton(type: .system)
    private let scrollView = UIScrollView()
    private let contentStack = UIStackView()

    // 빈 상태 섹션
    private let emptyContainer = UIStackView()
    private let recentWrap = UIStackView()
    private let recentChips = UIStackView()
    private let introCard = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterial))
    private let introLabel = UILabel()
    private let recommendWrap = UIStackView()
    private let recommendRow = UIStackView()

    // 결과
    private let resultsStack = UIStackView()
    private let emptyResultLabel = UILabel()

    private var debounce: DispatchWorkItem?

    private let recentKey = "ftRecentSearches"
    private let introIdxKey = "ftIntroIdx"
    private let introMessages = [
        "프리티풀은 전문 결혼식 사회자 매칭 플랫폼입니다.\n검증된 사회자만 엄선해 소개합니다.",
        "인생에서 가장 빛나는 순간,\n프리티풀이 검증한 전문 사회자와 함께하세요.",
        "수백 건의 실제 후기로 검증된\n결혼식 사회자를 프리티풀에서 만나보세요.",
        "당신의 예식에 어울리는 단 한 사람,\n프리티풀이 직접 검증해 추천합니다.",
        "전문성과 진정성을 갖춘 결혼식 사회자,\n프리티풀에서 합리적으로 만나보세요.",
        "잊지 못할 예식의 시작은 좋은 사회자부터.\n프리티풀이 그 만남을 책임집니다.",
    ]

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setInsets(top: CGFloat, bottom: CGFloat) {
        scrollView.contentInset = UIEdgeInsets(top: 0, left: 0, bottom: bottom, right: 0)
        scrollView.verticalScrollIndicatorInsets = UIEdgeInsets(top: 0, left: 0, bottom: bottom, right: 0)
    }

    func focus() { field.becomeFirstResponder() }
    func resignSearch() { field.resignFirstResponder() }

    // 화면 표시 시: 소개 문구 회전 + 최근검색어/추천 갱신
    func prepareForShow() {
        rotateIntro()
        reloadRecent()
        loadRecommended()
        showEmptyState()
    }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = UIColor(red: 0.97, green: 0.975, blue: 0.98, alpha: 1)

        // 검색바
        let magnifier = UIImageView(image: UIImage(systemName: "magnifyingglass", withConfiguration: UIImage.SymbolConfiguration(pointSize: 15, weight: .semibold)))
        magnifier.tintColor = UIColor(white: 0.55, alpha: 1)
        magnifier.setContentHuggingPriority(.required, for: .horizontal)
        field.placeholder = "사회자 이름·지역·키워드로 검색"
        field.font = .systemFont(ofSize: 15, weight: .medium)
        field.textColor = UIColor(white: 0.1, alpha: 1)
        field.returnKeyType = .search
        field.clearButtonMode = .whileEditing
        field.autocorrectionType = .no
        field.delegate = self
        field.addTarget(self, action: #selector(textChanged), for: .editingChanged)
        let barRow = UIStackView(arrangedSubviews: [magnifier, field])
        barRow.axis = .horizontal; barRow.spacing = 8; barRow.alignment = .center
        searchPill.setContent(barRow, insets: UIEdgeInsets(top: 0, left: 14, bottom: 0, right: 12))
        searchPill.setContentHuggingPriority(.defaultLow, for: .horizontal)
        searchPill.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        var cc = UIButton.Configuration.plain()
        cc.title = "취소"; cc.baseForegroundColor = UIColor(white: 0.3, alpha: 1)
        cc.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 6, bottom: 0, trailing: 0)
        cancelButton.configuration = cc
        cancelButton.setContentHuggingPriority(.required, for: .horizontal)
        cancelButton.setContentCompressionResistancePriority(.required, for: .horizontal)
        cancelButton.addTarget(self, action: #selector(cancel), for: .touchUpInside)

        let barStack = UIStackView(arrangedSubviews: [searchPill, cancelButton])
        barStack.axis = .horizontal
        barStack.spacing = 6
        barStack.alignment = .fill
        barStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(barStack)

        // 스크롤 + 콘텐츠
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = true
        scrollView.keyboardDismissMode = .onDrag
        scrollView.showsVerticalScrollIndicator = false
        scrollView.contentInsetAdjustmentBehavior = .never
        addSubview(scrollView)
        contentStack.axis = .vertical; contentStack.spacing = 22
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(contentStack)

        buildEmptyState()
        buildResults()
        contentStack.addArrangedSubview(emptyContainer)
        contentStack.addArrangedSubview(resultsStack)

        NSLayoutConstraint.activate([
            barStack.topAnchor.constraint(equalTo: safeAreaLayoutGuide.topAnchor, constant: 8), // 항상 안전영역 아래
            barStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
            barStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            barStack.heightAnchor.constraint(equalToConstant: 42),
            scrollView.topAnchor.constraint(equalTo: barStack.bottomAnchor, constant: 12),
            scrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: bottomAnchor),
            contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            contentStack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor),
            contentStack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -24),
        ])
    }

    // MARK: 빈 상태 빌드
    private func buildEmptyState() {
        emptyContainer.axis = .vertical
        emptyContainer.spacing = 24

        // 최근 검색어
        recentWrap.axis = .vertical; recentWrap.spacing = 12
        let recentHeader = UIStackView()
        recentHeader.axis = .horizontal
        let recentTitle = sectionTitle("최근 검색어")
        let clearBtn = UIButton(type: .system)
        clearBtn.setTitle("지우기", for: .normal)
        clearBtn.setTitleColor(UIColor(white: 0.55, alpha: 1), for: .normal)
        clearBtn.titleLabel?.font = .systemFont(ofSize: 13, weight: .medium)
        clearBtn.addTarget(self, action: #selector(clearRecent), for: .touchUpInside)
        let spacer = UIView(); spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        recentHeader.addArrangedSubview(recentTitle)
        recentHeader.addArrangedSubview(spacer)
        recentHeader.addArrangedSubview(clearBtn)
        let chipScroll = UIScrollView()
        chipScroll.showsHorizontalScrollIndicator = false
        chipScroll.translatesAutoresizingMaskIntoConstraints = false
        recentChips.axis = .horizontal; recentChips.spacing = 8
        recentChips.translatesAutoresizingMaskIntoConstraints = false
        chipScroll.addSubview(recentChips)
        NSLayoutConstraint.activate([
            recentChips.topAnchor.constraint(equalTo: chipScroll.contentLayoutGuide.topAnchor),
            recentChips.bottomAnchor.constraint(equalTo: chipScroll.contentLayoutGuide.bottomAnchor),
            recentChips.leadingAnchor.constraint(equalTo: chipScroll.contentLayoutGuide.leadingAnchor, constant: 16),
            recentChips.trailingAnchor.constraint(equalTo: chipScroll.contentLayoutGuide.trailingAnchor, constant: -16),
            recentChips.heightAnchor.constraint(equalTo: chipScroll.frameLayoutGuide.heightAnchor),
            chipScroll.heightAnchor.constraint(equalToConstant: 34),
        ])
        wrapPad(recentHeader, into: recentWrap)
        recentWrap.addArrangedSubview(chipScroll)
        emptyContainer.addArrangedSubview(recentWrap)

        // 프리티풀 소개 글래스 카드
        introCard.translatesAutoresizingMaskIntoConstraints = false
        introCard.layer.cornerRadius = 20
        introCard.layer.cornerCurve = .continuous
        introCard.clipsToBounds = true
        introCard.layer.borderWidth = 1
        introCard.layer.borderColor = UIColor.white.withAlphaComponent(0.5).cgColor
        introLabel.numberOfLines = 0
        introLabel.font = .systemFont(ofSize: 15.5, weight: .semibold)
        introLabel.textColor = UIColor(red: 0.16, green: 0.18, blue: 0.24, alpha: 1)
        introLabel.textAlignment = .center
        introLabel.translatesAutoresizingMaskIntoConstraints = false
        let badge = PaddingLabel3()
        badge.text = "FREETIFUL"
        badge.font = .systemFont(ofSize: 10.5, weight: .heavy)
        badge.textColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
        badge.backgroundColor = UIColor(red: 0.91, green: 0.95, blue: 1.0, alpha: 1)
        badge.textInsets = UIEdgeInsets(top: 4, left: 9, bottom: 4, right: 9)
        badge.layer.cornerRadius = 9; badge.clipsToBounds = true
        badge.translatesAutoresizingMaskIntoConstraints = false
        let introCol = UIStackView(arrangedSubviews: [badge, introLabel])
        introCol.axis = .vertical; introCol.spacing = 12; introCol.alignment = .center
        introCol.translatesAutoresizingMaskIntoConstraints = false
        introCard.contentView.addSubview(introCol)
        NSLayoutConstraint.activate([
            introCol.topAnchor.constraint(equalTo: introCard.contentView.topAnchor, constant: 22),
            introCol.bottomAnchor.constraint(equalTo: introCard.contentView.bottomAnchor, constant: -22),
            introCol.leadingAnchor.constraint(equalTo: introCard.contentView.leadingAnchor, constant: 20),
            introCol.trailingAnchor.constraint(equalTo: introCard.contentView.trailingAnchor, constant: -20),
        ])
        let introHolder = UIView()
        introHolder.addSubview(introCard)
        NSLayoutConstraint.activate([
            introCard.topAnchor.constraint(equalTo: introHolder.topAnchor),
            introCard.bottomAnchor.constraint(equalTo: introHolder.bottomAnchor),
            introCard.leadingAnchor.constraint(equalTo: introHolder.leadingAnchor, constant: 16),
            introCard.trailingAnchor.constraint(equalTo: introHolder.trailingAnchor, constant: -16),
        ])
        emptyContainer.addArrangedSubview(introHolder)

        // 오늘의 추천 사회자
        recommendWrap.axis = .vertical; recommendWrap.spacing = 12
        wrapPad(sectionTitle("오늘의 추천 사회자"), into: recommendWrap)
        let recScroll = UIScrollView()
        recScroll.showsHorizontalScrollIndicator = false
        recScroll.translatesAutoresizingMaskIntoConstraints = false
        recommendRow.axis = .horizontal; recommendRow.spacing = 12
        recommendRow.translatesAutoresizingMaskIntoConstraints = false
        recScroll.addSubview(recommendRow)
        NSLayoutConstraint.activate([
            recommendRow.topAnchor.constraint(equalTo: recScroll.contentLayoutGuide.topAnchor),
            recommendRow.bottomAnchor.constraint(equalTo: recScroll.contentLayoutGuide.bottomAnchor),
            recommendRow.leadingAnchor.constraint(equalTo: recScroll.contentLayoutGuide.leadingAnchor, constant: 16),
            recommendRow.trailingAnchor.constraint(equalTo: recScroll.contentLayoutGuide.trailingAnchor, constant: -16),
            recommendRow.heightAnchor.constraint(equalTo: recScroll.frameLayoutGuide.heightAnchor),
            recScroll.heightAnchor.constraint(equalToConstant: 196),
        ])
        recommendWrap.addArrangedSubview(recScroll)
        emptyContainer.addArrangedSubview(recommendWrap)
    }

    private func buildResults() {
        resultsStack.axis = .vertical
        resultsStack.spacing = 10
        resultsStack.isLayoutMarginsRelativeArrangement = true
        resultsStack.layoutMargins = UIEdgeInsets(top: 0, left: 14, bottom: 0, right: 14)
        emptyResultLabel.text = "검색 결과가 없습니다"
        emptyResultLabel.font = .systemFont(ofSize: 14)
        emptyResultLabel.textColor = UIColor(white: 0.6, alpha: 1)
        emptyResultLabel.textAlignment = .center
        emptyResultLabel.isHidden = true
        resultsStack.addArrangedSubview(emptyResultLabel)
        resultsStack.isHidden = true
    }

    // MARK: 토글
    private func showEmptyState() {
        emptyContainer.isHidden = false
        resultsStack.isHidden = true
    }
    private func showResults() {
        emptyContainer.isHidden = true
        resultsStack.isHidden = false
    }

    // MARK: 데이터
    private func rotateIntro() {
        var idx = UserDefaults.standard.integer(forKey: introIdxKey)
        introLabel.text = introMessages[idx % introMessages.count]
        idx += 1
        UserDefaults.standard.set(idx, forKey: introIdxKey)
    }

    private func loadRecommended() {
        NativeHomeData.loadCategory(1) { [weak self] items in
            guard let self = self else { return }
            self.recommendRow.arrangedSubviews.forEach { $0.removeFromSuperview() }
            for item in items.prefix(12) {
                let card = RecommendProCard(item: item)
                card.onTap = { [weak self] id in self?.commitSearchTap(id) }
                self.recommendRow.addArrangedSubview(card)
            }
            self.recommendWrap.isHidden = items.isEmpty
        }
    }

    // MARK: 최근 검색어
    private func reloadRecent() {
        let recents = (UserDefaults.standard.array(forKey: recentKey) as? [String]) ?? []
        recentChips.arrangedSubviews.forEach { $0.removeFromSuperview() }
        recentWrap.isHidden = recents.isEmpty
        for term in recents {
            recentChips.addArrangedSubview(makeChip(term))
        }
    }
    private func addRecent(_ term: String) {
        let t = term.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return }
        var recents = (UserDefaults.standard.array(forKey: recentKey) as? [String]) ?? []
        recents.removeAll { $0 == t }
        recents.insert(t, at: 0)
        if recents.count > 10 { recents = Array(recents.prefix(10)) }
        UserDefaults.standard.set(recents, forKey: recentKey)
    }
    @objc private func clearRecent() {
        UserDefaults.standard.removeObject(forKey: recentKey)
        reloadRecent()
    }
    private func removeRecent(_ term: String) {
        var recents = (UserDefaults.standard.array(forKey: recentKey) as? [String]) ?? []
        recents.removeAll { $0 == term }
        UserDefaults.standard.set(recents, forKey: recentKey)
        reloadRecent()
    }

    private func makeChip(_ term: String) -> UIView {
        let chip = UIView()
        chip.backgroundColor = .white
        chip.layer.cornerRadius = 17
        chip.layer.borderWidth = 1
        chip.layer.borderColor = UIColor(white: 0.9, alpha: 1).cgColor
        let label = UILabel()
        label.text = term
        label.font = .systemFont(ofSize: 13.5, weight: .medium)
        label.textColor = UIColor(white: 0.25, alpha: 1)
        let x = UIImageView(image: UIImage(systemName: "xmark", withConfiguration: UIImage.SymbolConfiguration(pointSize: 10, weight: .semibold)))
        x.tintColor = UIColor(white: 0.6, alpha: 1)
        let row = UIStackView(arrangedSubviews: [label, x])
        row.axis = .horizontal; row.spacing = 6; row.alignment = .center
        row.translatesAutoresizingMaskIntoConstraints = false
        chip.addSubview(row)
        NSLayoutConstraint.activate([
            row.topAnchor.constraint(equalTo: chip.topAnchor, constant: 7),
            row.bottomAnchor.constraint(equalTo: chip.bottomAnchor, constant: -7),
            row.leadingAnchor.constraint(equalTo: chip.leadingAnchor, constant: 14),
            row.trailingAnchor.constraint(equalTo: chip.trailingAnchor, constant: -12),
        ])
        let tap = UITapGestureRecognizer(target: self, action: #selector(chipTapped(_:)))
        chip.addGestureRecognizer(tap)
        chip.accessibilityLabel = term
        return chip
    }
    @objc private func chipTapped(_ g: UITapGestureRecognizer) {
        guard let chip = g.view, let term = chip.accessibilityLabel else { return }
        if g.location(in: chip).x > chip.bounds.width - 40 {   // 오른쪽 X 영역 → 삭제
            removeRecent(term)
        } else {
            field.text = term
            showResults()
            runSearch(term)
            field.resignFirstResponder()
        }
    }

    // MARK: 검색
    @objc private func textChanged() {
        let q = field.text ?? ""
        debounce?.cancel()
        if q.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            showEmptyState()
            return
        }
        showResults()
        let work = DispatchWorkItem { [weak self] in self?.runSearch(q) }
        debounce = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3, execute: work)
    }
    private func runSearch(_ q: String) {
        NativeHomeData.search(q) { [weak self] items in self?.renderResults(items) }
    }
    private func renderResults(_ items: [HomeProItem]) {
        resultsStack.arrangedSubviews.forEach { if $0 != emptyResultLabel { $0.removeFromSuperview() } }
        let hasQuery = !((field.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        if items.isEmpty {
            emptyResultLabel.isHidden = !hasQuery
            return
        }
        emptyResultLabel.isHidden = true
        for item in items {
            let cell = HomeProCell(item: item)
            cell.onTap = { [weak self] id in self?.commitSearchTap(id) }
            resultsStack.addArrangedSubview(cell)
        }
    }
    private func commitSearchTap(_ id: String) {
        addRecent(field.text ?? "")
        delegate?.searchDidTapPro(id)
    }

    func textFieldShouldReturn(_ tf: UITextField) -> Bool {
        addRecent(tf.text ?? "")
        reloadRecent()
        tf.resignFirstResponder()
        return true
    }
    @objc private func cancel() {
        field.text = ""; showEmptyState(); field.resignFirstResponder()
        delegate?.searchDidCancel()
    }

    // MARK: 헬퍼
    private func sectionTitle(_ t: String) -> UILabel {
        let l = UILabel()
        l.text = t
        l.font = .systemFont(ofSize: 17, weight: .bold)
        l.textColor = UIColor(red: 0.13, green: 0.15, blue: 0.20, alpha: 1)
        return l
    }
    private func wrapPad(_ v: UIView, into stack: UIStackView) {
        let holder = UIView()
        v.translatesAutoresizingMaskIntoConstraints = false
        holder.addSubview(v)
        NSLayoutConstraint.activate([
            v.topAnchor.constraint(equalTo: holder.topAnchor),
            v.bottomAnchor.constraint(equalTo: holder.bottomAnchor),
            v.leadingAnchor.constraint(equalTo: holder.leadingAnchor, constant: 16),
            v.trailingAnchor.constraint(equalTo: holder.trailingAnchor, constant: -16),
        ])
        stack.addArrangedSubview(holder)
    }
}

// 추천 사회자 카드 (3:4 이미지 + 이름 + 경력)
final class RecommendProCard: UIControl {
    var onTap: ((String) -> Void)?
    private let id: String
    init(item: HomeProItem) {
        self.id = item.id
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        let photo = UIImageView()
        photo.translatesAutoresizingMaskIntoConstraints = false
        photo.contentMode = .scaleAspectFill
        photo.clipsToBounds = true
        photo.layer.cornerRadius = 16
        photo.layer.cornerCurve = .continuous
        photo.backgroundColor = UIColor(white: 0.94, alpha: 1)
        NativeChatImageLoader.load(item.image, into: photo, fallback: NativeChatHeaderView.avatarPlaceholder)
        addSubview(photo)
        let name = UILabel()
        name.text = item.name
        name.font = .systemFont(ofSize: 14, weight: .bold)
        name.textColor = UIColor(white: 0.12, alpha: 1)
        let career = UILabel()
        career.text = item.careerYears > 0 ? "경력 \(item.careerYears)년" : "신규"
        career.font = .systemFont(ofSize: 12, weight: .medium)
        career.textColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
        let col = UIStackView(arrangedSubviews: [photo, name, career])
        col.axis = .vertical; col.spacing = 5; col.alignment = .leading
        col.setCustomSpacing(8, after: photo)
        col.translatesAutoresizingMaskIntoConstraints = false
        addSubview(col)
        NSLayoutConstraint.activate([
            col.topAnchor.constraint(equalTo: topAnchor),
            col.bottomAnchor.constraint(equalTo: bottomAnchor),
            col.leadingAnchor.constraint(equalTo: leadingAnchor),
            col.trailingAnchor.constraint(equalTo: trailingAnchor),
            widthAnchor.constraint(equalToConstant: 124),
            photo.widthAnchor.constraint(equalToConstant: 124),
            photo.heightAnchor.constraint(equalToConstant: 152),
        ])
        addTarget(self, action: #selector(tapped), for: .touchUpInside)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    @objc private func tapped() { Haptics.tap(); onTap?(id) }
}

final class PaddingLabel3: UILabel {
    var textInsets = UIEdgeInsets.zero
    override func drawText(in rect: CGRect) { super.drawText(in: rect.inset(by: textInsets)) }
    override var intrinsicContentSize: CGSize {
        let s = super.intrinsicContentSize
        return CGSize(width: s.width + textInsets.left + textInsets.right, height: s.height + textInsets.top + textInsets.bottom)
    }
}
