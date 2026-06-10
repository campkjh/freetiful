import UIKit

protocol NativeCategoryListDelegate: AnyObject {
    func categoryListDidSelect(path: String)
}

// 홈 카테고리 아이콘 → 네이티브 리스트 (사회자 카테고리 / 웨딩파트너 카테고리)
// 웹 /pros?category=, /businesses?category= 모바일 리스트를 네이티브로 재현
final class NativeCategoryListContent: UIView {
    enum Mode { case pro, business }

    weak var delegate: NativeCategoryListDelegate?

    private let table = UITableView(frame: .zero, style: .plain)
    private let spinner = UIActivityIndicatorView(style: .medium)
    private let emptyLabel = UILabel()

    private var mode: Mode = .pro
    private var category = ""
    private var sort = "popular"
    private var lastKey = ""
    private var proRows: [CategoryProItem] = []
    private var bizRows: [CategoryBizItem] = []
    private var animatedRows = Set<Int>()

    // 헤더(카운트 + 정렬)
    private let header = UIView()
    private let countLabel = UILabel()
    private let sortButton = UIButton(type: .system)

    // 웨딩파트너 글래스 카테고리 탭 + 검색
    private let bizCategories = ["전체", "웨딩홀", "드레스", "피부과", "스튜디오", "헤어", "메이크업", "스냅"]
    private let tabBarBg = UIVisualEffectView(effect: LiquidGlassEffectFactory.navigationEffect())
    private let tabScroll = UIScrollView()
    private let tabStack = UIStackView()
    private var tabCells: [(cat: String, button: UIButton, tint: UIView)] = []
    private let searchBar = UIVisualEffectView(effect: LiquidGlassEffectFactory.navigationEffect())
    private let searchField = UITextField()
    private var tabBarTop: NSLayoutConstraint!
    private let topBarHeight: CGFloat = 54
    private var baseTopInset: CGFloat = 0
    private var baseBottomInset: CGFloat = 0
    private var searching = false
    private var reloadSeq = 0
    private let blue = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setup() {
        backgroundColor = UIColor(red: 0.969, green: 0.973, blue: 0.980, alpha: 1)   // #F7F8FA
        translatesAutoresizingMaskIntoConstraints = false

        table.translatesAutoresizingMaskIntoConstraints = false
        table.backgroundColor = .clear
        table.separatorStyle = .none
        table.dataSource = self
        table.delegate = self
        table.showsVerticalScrollIndicator = true
        table.contentInsetAdjustmentBehavior = .never
        table.register(CategoryProCell.self, forCellReuseIdentifier: "pro")
        table.register(CategoryBizCell.self, forCellReuseIdentifier: "biz")
        addSubview(table)

        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.hidesWhenStopped = true
        addSubview(spinner)

        emptyLabel.text = "조건에 맞는 항목이 없습니다"
        emptyLabel.font = .systemFont(ofSize: 14, weight: .medium)
        emptyLabel.textColor = UIColor(white: 0.6, alpha: 1)
        emptyLabel.textAlignment = .center
        emptyLabel.isHidden = true
        emptyLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(emptyLabel)

        NSLayoutConstraint.activate([
            table.topAnchor.constraint(equalTo: topAnchor),
            table.leadingAnchor.constraint(equalTo: leadingAnchor),
            table.trailingAnchor.constraint(equalTo: trailingAnchor),
            table.bottomAnchor.constraint(equalTo: bottomAnchor),
            spinner.centerXAnchor.constraint(equalTo: centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: centerYAnchor),
            emptyLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            emptyLabel.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
        buildHeader()
        buildTabBar()
        buildSearchBar()
    }

    // 웨딩파트너 글래스 카테고리 탭바
    private func buildTabBar() {
        tabBarBg.translatesAutoresizingMaskIntoConstraints = false
        tabBarBg.isHidden = true
        tabBarBg.layer.borderWidth = 0.5
        tabBarBg.layer.borderColor = UIColor(white: 0.88, alpha: 0.6).cgColor
        addSubview(tabBarBg)

        tabScroll.translatesAutoresizingMaskIntoConstraints = false
        tabScroll.showsHorizontalScrollIndicator = false
        tabScroll.contentInsetAdjustmentBehavior = .never
        tabBarBg.contentView.addSubview(tabScroll)

        tabStack.axis = .horizontal; tabStack.spacing = 8; tabStack.alignment = .center
        tabStack.translatesAutoresizingMaskIntoConstraints = false
        tabScroll.addSubview(tabStack)

        // 채팅/새요청 탭과 동일 디자인 — 글래스 캡슐 + 활성=짙은 틴트·흰 글자
        for (i, cat) in bizCategories.enumerated() {
            let pill = GlassPill(corner: 16)
            let tint = UIView()
            tint.translatesAutoresizingMaskIntoConstraints = false
            tint.backgroundColor = UIColor(white: 0.1, alpha: 1)
            tint.alpha = 0
            tint.isUserInteractionEnabled = false
            let b = UIButton(type: .system)
            b.translatesAutoresizingMaskIntoConstraints = false
            b.setTitle(cat, for: .normal)
            b.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
            b.tag = i
            b.addTarget(self, action: #selector(tapTab(_:)), for: .touchUpInside)
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
            tabCells.append((cat, b, tint))
            tabStack.addArrangedSubview(pill)
        }

        tabBarTop = tabBarBg.topAnchor.constraint(equalTo: topAnchor, constant: 0)
        NSLayoutConstraint.activate([
            tabBarTop,
            tabBarBg.leadingAnchor.constraint(equalTo: leadingAnchor),
            tabBarBg.trailingAnchor.constraint(equalTo: trailingAnchor),
            tabBarBg.heightAnchor.constraint(equalToConstant: topBarHeight),
            tabScroll.leadingAnchor.constraint(equalTo: tabBarBg.contentView.leadingAnchor),
            tabScroll.trailingAnchor.constraint(equalTo: tabBarBg.contentView.trailingAnchor),
            tabScroll.centerYAnchor.constraint(equalTo: tabBarBg.contentView.centerYAnchor),
            tabScroll.heightAnchor.constraint(equalToConstant: 36),
            tabStack.topAnchor.constraint(equalTo: tabScroll.contentLayoutGuide.topAnchor),
            tabStack.bottomAnchor.constraint(equalTo: tabScroll.contentLayoutGuide.bottomAnchor),
            tabStack.leadingAnchor.constraint(equalTo: tabScroll.contentLayoutGuide.leadingAnchor, constant: 14),
            tabStack.trailingAnchor.constraint(equalTo: tabScroll.contentLayoutGuide.trailingAnchor, constant: -14),
            tabStack.heightAnchor.constraint(equalTo: tabScroll.heightAnchor),
        ])
    }

    private func buildSearchBar() {
        searchBar.translatesAutoresizingMaskIntoConstraints = false
        searchBar.isHidden = true
        searchBar.layer.borderWidth = 0.5
        searchBar.layer.borderColor = UIColor(white: 0.88, alpha: 0.6).cgColor
        addSubview(searchBar)

        // 글래스 인풋 캡슐
        let field = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
        field.translatesAutoresizingMaskIntoConstraints = false
        field.layer.cornerRadius = 18; field.layer.cornerCurve = .continuous
        field.contentView.layer.cornerRadius = 18; field.contentView.clipsToBounds = true
        field.contentView.backgroundColor = UIColor.white.withAlphaComponent(0.5)
        field.layer.borderWidth = 1; field.layer.borderColor = UIColor.white.withAlphaComponent(0.7).cgColor
        searchBar.contentView.addSubview(field)

        let mag = UIImageView(image: UIImage(systemName: "magnifyingglass", withConfiguration: UIImage.SymbolConfiguration(pointSize: 14, weight: .semibold)))
        mag.tintColor = UIColor(white: 0.5, alpha: 1)
        mag.translatesAutoresizingMaskIntoConstraints = false
        field.contentView.addSubview(mag)

        searchField.placeholder = "웨딩파트너 검색"
        searchField.font = .systemFont(ofSize: 15)
        searchField.textColor = UIColor(white: 0.1, alpha: 1)
        searchField.clearButtonMode = .whileEditing
        searchField.returnKeyType = .search
        searchField.autocorrectionType = .no
        searchField.translatesAutoresizingMaskIntoConstraints = false
        searchField.addTarget(self, action: #selector(searchChanged), for: .editingChanged)
        searchField.delegate = self
        field.contentView.addSubview(searchField)

        let cancel = UIButton(type: .system)
        var cc = UIButton.Configuration.plain()
        cc.title = "취소"
        cc.contentInsets = NSDirectionalEdgeInsets(top: 4, leading: 6, bottom: 4, trailing: 4)
        cc.baseForegroundColor = UIColor(white: 0.3, alpha: 1)
        cancel.configuration = cc
        cancel.translatesAutoresizingMaskIntoConstraints = false
        cancel.setContentHuggingPriority(.required, for: .horizontal)
        cancel.addAction(UIAction { [weak self] _ in self?.toggleSearch() }, for: .touchUpInside)
        searchBar.contentView.addSubview(cancel)

        NSLayoutConstraint.activate([
            searchBar.leadingAnchor.constraint(equalTo: leadingAnchor),
            searchBar.trailingAnchor.constraint(equalTo: trailingAnchor),
            searchBar.topAnchor.constraint(equalTo: tabBarBg.topAnchor),
            searchBar.heightAnchor.constraint(equalToConstant: topBarHeight),
            cancel.trailingAnchor.constraint(equalTo: searchBar.contentView.trailingAnchor, constant: -10),
            cancel.centerYAnchor.constraint(equalTo: searchBar.contentView.centerYAnchor),
            field.leadingAnchor.constraint(equalTo: searchBar.contentView.leadingAnchor, constant: 14),
            field.trailingAnchor.constraint(equalTo: cancel.leadingAnchor, constant: -8),
            field.centerYAnchor.constraint(equalTo: searchBar.contentView.centerYAnchor),
            field.heightAnchor.constraint(equalToConstant: 38),
            mag.leadingAnchor.constraint(equalTo: field.contentView.leadingAnchor, constant: 12),
            mag.centerYAnchor.constraint(equalTo: field.contentView.centerYAnchor),
            searchField.leadingAnchor.constraint(equalTo: mag.trailingAnchor, constant: 8),
            searchField.trailingAnchor.constraint(equalTo: field.contentView.trailingAnchor, constant: -12),
            searchField.centerYAnchor.constraint(equalTo: field.contentView.centerYAnchor),
        ])
    }

    @objc private func tapTab(_ b: UIButton) {
        Haptics.tap()
        selectTab(bizCategories[b.tag])
    }
    private func selectTab(_ cat: String) {
        let apiCat = cat == "전체" ? "" : cat
        guard apiCat != category || searching else { return }
        if searching { exitSearchUI() }
        category = apiCat
        bizRows = []
        highlightTabs()
        table.reloadData()
        scrollToTop()
        reload()
    }
    private func highlightTabs() {
        UIView.animate(withDuration: 0.2) {
            for (cat, b, tint) in self.tabCells {
                let on = (cat == "전체" ? "" : cat) == self.category && !self.searching
                tint.alpha = on ? 1 : 0
                b.setTitleColor(on ? .white : UIColor(white: 0.28, alpha: 1), for: .normal)
            }
        }
    }

    // 검색 토글 (헤더 검색 버튼 → 호출)
    func toggleSearch() {
        guard mode == .business else { return }
        if searching {
            exitSearchUI()
            bizRows = []
            highlightTabs()
            table.reloadData()
            reload()
        } else {
            searching = true
            searchBar.isHidden = false
            tabBarBg.isHidden = true
            searchBar.alpha = 0
            UIView.animate(withDuration: 0.2) { self.searchBar.alpha = 1 }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { self.searchField.becomeFirstResponder() }
        }
    }
    private func exitSearchUI() {
        searching = false
        searchField.text = ""
        searchField.resignFirstResponder()
        searchBar.isHidden = true
        tabBarBg.isHidden = (mode != .business)
    }
    @objc private func searchChanged() {
        let q = searchField.text ?? ""
        let seq = reloadSeq + 1; reloadSeq = seq
        if q.trimmingCharacters(in: .whitespaces).isEmpty { bizRows = []; applyLoaded(); return }
        NativeHomeData.searchBiz(q) { [weak self] items in
            guard let self = self, seq == self.reloadSeq else { return }
            self.bizRows = items; self.applyLoaded()
        }
    }

    private func buildHeader() {
        header.frame = CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: 46)
        header.backgroundColor = .clear

        countLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        countLabel.textColor = UIColor(white: 0.45, alpha: 1)
        countLabel.translatesAutoresizingMaskIntoConstraints = false
        header.addSubview(countLabel)

        var cfg = UIButton.Configuration.plain()
        cfg.image = UIImage(systemName: "arrow.up.arrow.down", withConfiguration: UIImage.SymbolConfiguration(pointSize: 11, weight: .semibold))
        cfg.imagePadding = 4
        cfg.contentInsets = NSDirectionalEdgeInsets(top: 4, leading: 6, bottom: 4, trailing: 6)
        sortButton.configuration = cfg
        sortButton.tintColor = UIColor(white: 0.3, alpha: 1)
        sortButton.translatesAutoresizingMaskIntoConstraints = false
        sortButton.showsMenuAsPrimaryAction = true
        header.addSubview(sortButton)

        NSLayoutConstraint.activate([
            countLabel.leadingAnchor.constraint(equalTo: header.leadingAnchor, constant: 18),
            countLabel.centerYAnchor.constraint(equalTo: header.centerYAnchor),
            sortButton.trailingAnchor.constraint(equalTo: header.trailingAnchor, constant: -12),
            sortButton.centerYAnchor.constraint(equalTo: header.centerYAnchor),
        ])
        updateSortMenu()
    }

    private let sortOptions: [(String, String)] = [("추천순", "popular"), ("평점순", "avg_rating"), ("리뷰순", "review_count"), ("경력순", "experience")]
    private func updateSortMenu() {
        let actions = sortOptions.map { opt in
            UIAction(title: opt.0, state: sort == opt.1 ? .on : .off) { [weak self] _ in
                guard let self = self, self.sort != opt.1 else { return }
                self.sort = opt.1
                self.updateSortMenu()
                Haptics.tap()
                self.reload()
            }
        }
        sortButton.menu = UIMenu(title: "정렬", children: actions)
        sortButton.configuration?.title = sortOptions.first { $0.1 == sort }?.0 ?? "추천순"
        sortButton.configuration?.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer {
            var o = $0; o.font = .systemFont(ofSize: 13, weight: .semibold); return o
        }
    }

    func setInsets(top: CGFloat, bottom: CGFloat) {
        baseTopInset = top
        baseBottomInset = bottom
        tabBarTop?.constant = top
        applyTableInsets()
    }
    private func applyTableInsets() {
        let extra: CGFloat = (mode == .business) ? topBarHeight : 0   // 탭바/검색바 높이
        let top = baseTopInset + extra
        table.contentInset = UIEdgeInsets(top: top, left: 0, bottom: baseBottomInset, right: 0)
        table.verticalScrollIndicatorInsets.top = top
        table.verticalScrollIndicatorInsets.bottom = baseBottomInset
    }

    func scrollToTop() {
        let top = -table.contentInset.top
        table.setContentOffset(CGPoint(x: 0, y: top), animated: false)
    }

    // 프로필 수정 등 — 다음 진입 시 신선 재로딩 강제
    func invalidate() { lastKey = "" }

    // 외부(웹 경로 변경)에서 진입 시 호출 — 같은 내비게이션 키면 재설정 안 함(탭 선택 유지)
    func configure(mode: Mode, category: String) {
        let key = "\(mode)|\(category)"
        if key == lastKey { return }
        lastKey = key
        self.mode = mode
        self.category = category
        self.sort = "popular"
        proRows = []; bizRows = []
        animatedRows.removeAll()
        if searching { exitSearchUI() }
        table.tableHeaderView = mode == .pro ? header : nil   // 정렬은 사회자만(웹 동일)
        tabBarBg.isHidden = (mode != .business)               // 글래스 카테고리 탭은 웨딩파트너만
        if mode == .business { highlightTabs() }
        updateSortMenu()
        applyTableInsets()
        table.reloadData()
        scrollToTop()
        reload()
    }

    private func reload() {
        emptyLabel.isHidden = true
        if (mode == .pro ? proRows.isEmpty : bizRows.isEmpty) { spinner.startAnimating() }
        animatedRows.removeAll()
        let seq = reloadSeq + 1; reloadSeq = seq
        if mode == .pro {
            NativeHomeData.loadProCategory(category: category, sort: sort) { [weak self] items in
                guard let self = self, seq == self.reloadSeq else { return }
                self.proRows = items
                self.applyLoaded()
            }
        } else {
            NativeHomeData.loadBizCategory(category: category) { [weak self] items in
                guard let self = self, seq == self.reloadSeq else { return }
                self.bizRows = items
                self.applyLoaded()
            }
        }
    }

    private func applyLoaded() {
        spinner.stopAnimating()
        let n = mode == .pro ? proRows.count : bizRows.count
        countLabel.text = mode == .pro ? "사회자 \(n)명" : "웨딩파트너 \(n)곳"
        emptyLabel.isHidden = n > 0
        table.reloadData()
    }
}

// MARK: - DataSource / Delegate
extension NativeCategoryListContent: UITableViewDataSource, UITableViewDelegate {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        mode == .pro ? proRows.count : bizRows.count
    }
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        if mode == .pro {
            let cell = tableView.dequeueReusableCell(withIdentifier: "pro", for: indexPath) as! CategoryProCell
            cell.configure(proRows[indexPath.row])
            return cell
        } else {
            let cell = tableView.dequeueReusableCell(withIdentifier: "biz", for: indexPath) as! CategoryBizCell
            cell.configure(bizRows[indexPath.row])
            return cell
        }
    }
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        Haptics.tap()
        let path: String
        if mode == .pro { path = "/pros/\(proRows[indexPath.row].id)" }
        else { path = "/businesses/\(bizRows[indexPath.row].id)" }
        delegate?.categoryListDidSelect(path: path)
    }
    func tableView(_ tableView: UITableView, willDisplay cell: UITableViewCell, forRowAt indexPath: IndexPath) {
        guard !animatedRows.contains(indexPath.row) else { return }
        animatedRows.insert(indexPath.row)
        cell.alpha = 0
        cell.transform = CGAffineTransform(translationX: 0, y: 14)
        UIView.animate(withDuration: 0.42, delay: Double(min(indexPath.row, 7)) * 0.035, options: [.curveEaseOut]) {
            cell.alpha = 1
            cell.transform = .identity
        }
    }
    func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
        if searching { searchField.resignFirstResponder() }
    }
}

extension NativeCategoryListContent: UITextFieldDelegate {
    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        textField.resignFirstResponder()
        return true
    }
}

// MARK: - 사회자 카드 셀
private final class CategoryProCell: UITableViewCell {
    private let thumb = UIImageView()
    private let nameL = UILabel()
    private let topPill = PaddingLabel3()
    private let starL = UILabel()
    private let ratingL = UILabel()
    private let introL = UILabel()
    private let tagRow = UIStackView()
    private var imgToken = ""

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        backgroundColor = .clear
        selectionStyle = .none

        let card = UIView()
        card.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(card)

        thumb.translatesAutoresizingMaskIntoConstraints = false
        thumb.contentMode = .scaleAspectFill
        thumb.clipsToBounds = true
        thumb.layer.cornerRadius = 10
        thumb.backgroundColor = UIColor(white: 0.93, alpha: 1)
        card.addSubview(thumb)

        nameL.font = .systemFont(ofSize: 16, weight: .bold)
        nameL.textColor = UIColor(white: 0.1, alpha: 1)
        nameL.numberOfLines = 1
        nameL.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(nameL)

        topPill.text = ""
        topPill.font = .systemFont(ofSize: 10, weight: .bold)
        topPill.textColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
        topPill.backgroundColor = UIColor(red: 0.917, green: 0.952, blue: 1, alpha: 1)   // #EAF3FF
        topPill.textInsets = UIEdgeInsets(top: 2, left: 7, bottom: 2, right: 7)
        topPill.layer.cornerRadius = 9
        topPill.clipsToBounds = true
        topPill.translatesAutoresizingMaskIntoConstraints = false
        topPill.setContentHuggingPriority(.required, for: .horizontal)
        topPill.setContentCompressionResistancePriority(.required, for: .horizontal)
        card.addSubview(topPill)

        let starRow = UIStackView(arrangedSubviews: [starL, ratingL])
        starRow.axis = .horizontal; starRow.spacing = 3; starRow.alignment = .center
        starRow.translatesAutoresizingMaskIntoConstraints = false
        starL.font = .systemFont(ofSize: 13)
        ratingL.font = .systemFont(ofSize: 13, weight: .bold)
        card.addSubview(starRow)

        introL.font = .systemFont(ofSize: 13)
        introL.textColor = UIColor(white: 0.42, alpha: 1)
        introL.numberOfLines = 2
        introL.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(introL)

        tagRow.axis = .horizontal; tagRow.spacing = 4; tagRow.alignment = .center
        tagRow.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(tagRow)

        NSLayoutConstraint.activate([
            card.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 6),
            card.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -6),
            card.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            card.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),

            thumb.leadingAnchor.constraint(equalTo: card.leadingAnchor),
            thumb.topAnchor.constraint(equalTo: card.topAnchor),
            thumb.widthAnchor.constraint(equalToConstant: 105),
            thumb.heightAnchor.constraint(equalToConstant: 140),
            thumb.bottomAnchor.constraint(lessThanOrEqualTo: card.bottomAnchor),

            nameL.topAnchor.constraint(equalTo: thumb.topAnchor, constant: 2),
            nameL.leadingAnchor.constraint(equalTo: thumb.trailingAnchor, constant: 12),

            topPill.centerYAnchor.constraint(equalTo: nameL.centerYAnchor),
            topPill.leadingAnchor.constraint(greaterThanOrEqualTo: nameL.trailingAnchor, constant: 6),
            topPill.trailingAnchor.constraint(equalTo: card.trailingAnchor),

            starRow.topAnchor.constraint(equalTo: nameL.bottomAnchor, constant: 6),
            starRow.leadingAnchor.constraint(equalTo: nameL.leadingAnchor),

            introL.topAnchor.constraint(equalTo: starRow.bottomAnchor, constant: 8),
            introL.leadingAnchor.constraint(equalTo: nameL.leadingAnchor),
            introL.trailingAnchor.constraint(equalTo: card.trailingAnchor),

            tagRow.leadingAnchor.constraint(equalTo: nameL.leadingAnchor),
            tagRow.bottomAnchor.constraint(lessThanOrEqualTo: thumb.bottomAnchor, constant: -2),
            tagRow.topAnchor.constraint(greaterThanOrEqualTo: introL.bottomAnchor, constant: 6),
        ])
        nameL.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func prepareForReuse() {
        super.prepareForReuse()
        thumb.image = nil
        thumb.backgroundColor = UIColor(white: 0.93, alpha: 1)
        imgToken = ""
    }

    func configure(_ p: CategoryProItem) {
        nameL.text = "\(p.category) \(p.name)"
        let isTop = (1...10).contains(p.rank)
        topPill.text = isTop ? "TOP \(p.rank)" : ""
        topPill.isHidden = !isTop

        let gold = UIColor(red: 1, green: 0.72, blue: 0, alpha: 1)
        let starText = NSMutableAttributedString(string: "★ ", attributes: [.foregroundColor: gold, .font: UIFont.systemFont(ofSize: 13)])
        starL.attributedText = starText
        let rt = NSMutableAttributedString(string: String(format: "%.1f", p.rating), attributes: [.foregroundColor: UIColor(white: 0.1, alpha: 1), .font: UIFont.systemFont(ofSize: 13, weight: .bold)])
        rt.append(NSAttributedString(string: " (\(p.reviewCount))", attributes: [.foregroundColor: UIColor(white: 0.6, alpha: 1), .font: UIFont.systemFont(ofSize: 13)]))
        ratingL.attributedText = rt

        introL.text = "“\(p.intro.isEmpty ? "프리티풀 인증 사회자입니다" : p.intro)”"

        tagRow.arrangedSubviews.forEach { $0.removeFromSuperview() }
        if p.careerYears > 0 { tagRow.addArrangedSubview(makeTag("경력 \(p.careerYears)년", strong: true)) }
        let regionTags = p.isNationwide ? ["전국가능"] : Array(p.regions.prefix(2))
        for t in regionTags { tagRow.addArrangedSubview(makeTag(t, strong: false)) }

        let token = p.id + p.image
        imgToken = token
        thumb.image = nil
        NativeChatImageLoader.fetch(p.image) { [weak self] img in
            guard let self = self, self.imgToken == token, let img = img else { return }
            self.thumb.image = img
        }
    }

    private func makeTag(_ text: String, strong: Bool) -> UIView {
        let l = PaddingLabel3()
        l.text = text
        l.font = .systemFont(ofSize: 10, weight: strong ? .semibold : .medium)
        l.textColor = strong ? UIColor(white: 0.38, alpha: 1) : UIColor(white: 0.5, alpha: 1)
        l.backgroundColor = UIColor(white: 0.94, alpha: 1)
        l.textInsets = UIEdgeInsets(top: 3, left: 6, bottom: 3, right: 6)
        l.layer.cornerRadius = 5
        l.clipsToBounds = true
        return l
    }
}

// MARK: - 웨딩파트너 카드 셀
private final class CategoryBizCell: UITableViewCell {
    private let thumb = UIImageView()
    private let titleL = UILabel()
    private let subL = UILabel()
    private let tagRow = UIStackView()
    private var imgToken = ""

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        backgroundColor = .clear
        selectionStyle = .none

        thumb.translatesAutoresizingMaskIntoConstraints = false
        thumb.contentMode = .scaleAspectFill
        thumb.clipsToBounds = true
        thumb.layer.cornerRadius = 12
        thumb.backgroundColor = UIColor(white: 0.93, alpha: 1)
        contentView.addSubview(thumb)

        titleL.font = .systemFont(ofSize: 15, weight: .bold)
        titleL.textColor = UIColor(white: 0.1, alpha: 1)
        titleL.numberOfLines = 2
        titleL.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(titleL)

        subL.font = .systemFont(ofSize: 12)
        subL.textColor = UIColor(white: 0.5, alpha: 1)
        subL.numberOfLines = 1
        subL.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(subL)

        tagRow.axis = .horizontal; tagRow.spacing = 4; tagRow.alignment = .center
        tagRow.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(tagRow)

        NSLayoutConstraint.activate([
            thumb.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            thumb.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 10),
            thumb.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -10),
            thumb.widthAnchor.constraint(equalToConstant: 120),
            thumb.heightAnchor.constraint(equalToConstant: 120),

            titleL.topAnchor.constraint(equalTo: thumb.topAnchor, constant: 2),
            titleL.leadingAnchor.constraint(equalTo: thumb.trailingAnchor, constant: 12),
            titleL.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),

            subL.topAnchor.constraint(equalTo: titleL.bottomAnchor, constant: 4),
            subL.leadingAnchor.constraint(equalTo: titleL.leadingAnchor),
            subL.trailingAnchor.constraint(equalTo: titleL.trailingAnchor),

            tagRow.topAnchor.constraint(equalTo: subL.bottomAnchor, constant: 8),
            tagRow.leadingAnchor.constraint(equalTo: titleL.leadingAnchor),
            tagRow.trailingAnchor.constraint(lessThanOrEqualTo: titleL.trailingAnchor),
        ])
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func prepareForReuse() {
        super.prepareForReuse()
        thumb.image = nil
        thumb.backgroundColor = UIColor(white: 0.93, alpha: 1)
        imgToken = ""
    }

    func configure(_ b: CategoryBizItem) {
        titleL.text = b.title
        subL.text = "\(b.region) · \(b.category)"
        tagRow.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for t in b.tags.prefix(3) {
            let l = PaddingLabel3()
            l.text = t
            l.font = .systemFont(ofSize: 10, weight: .medium)
            l.textColor = UIColor(red: 0.306, green: 0.349, blue: 0.408, alpha: 1)   // #4E5968
            l.backgroundColor = UIColor(red: 0.949, green: 0.957, blue: 0.965, alpha: 1)   // #F2F4F6
            l.textInsets = UIEdgeInsets(top: 3, left: 7, bottom: 3, right: 7)
            l.layer.cornerRadius = 5
            l.clipsToBounds = true
            tagRow.addArrangedSubview(l)
        }

        let token = b.id + b.image
        imgToken = token
        thumb.image = nil
        NativeChatImageLoader.fetch(b.image) { [weak self] img in
            guard let self = self, self.imgToken == token, let img = img else { return }
            self.thumb.image = img
        }
    }
}

// PaddingLabel3 는 NativeSearchContent.swift 에 정의됨 (textInsets API 동일) — 재사용
