import UIKit
import Lottie

// 새요청(사회자 매칭 요청) 한 카드 (웹 window.__freetifulInquiryList.getItems() 에서 전달)
struct NativeInquiryItem {
    let id: String
    let customerId: String
    let matchRequestId: String
    let name: String
    let image: String
    let kindLabel: String
    let isMulti: Bool
    let timeAgo: String
    let category: String
    let parts: [String]
    let dateText: String
    let location: String
    let note: String
}

protocol NativeInquiryContentDelegate: AnyObject {
    func inquiryDidTapChat(_ id: String, customerId: String, matchRequestId: String)
    func inquiryDidTapReject(_ id: String)
    func inquiryDidArchive(_ id: String)
    func inquiryDidPullRefresh()
}

// MARK: - 패딩 라벨 (뱃지/칩용)
final class InquiryPadLabel: UILabel {
    var insets = UIEdgeInsets(top: 4, left: 10, bottom: 4, right: 10)
    override func drawText(in rect: CGRect) { super.drawText(in: rect.inset(by: insets)) }
    override var intrinsicContentSize: CGSize {
        let s = super.intrinsicContentSize
        return CGSize(width: s.width + insets.left + insets.right,
                      height: s.height + insets.top + insets.bottom)
    }
}

// MARK: - 칩 줄바꿈 플로우 뷰 (eventPart 칩)
final class ChipFlowView: UIView {
    private var chipViews: [UIView] = []
    private let hGap: CGFloat = 4
    private let vGap: CGFloat = 4
    private let chipH: CGFloat = 22
    var heightConstraint: NSLayoutConstraint!

    override init(frame: CGRect) {
        super.init(frame: frame)
        translatesAutoresizingMaskIntoConstraints = false
        heightConstraint = heightAnchor.constraint(equalToConstant: 0)
        heightConstraint.priority = .required
        heightConstraint.isActive = true
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setChips(_ parts: [String]) {
        chipViews.forEach { $0.removeFromSuperview() }
        chipViews = parts.map { p in
            let l = InquiryPadLabel()
            l.text = p
            l.font = .systemFont(ofSize: 12, weight: .bold)
            l.textColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
            l.backgroundColor = UIColor(red: 0.918, green: 0.953, blue: 1.0, alpha: 1) // #EAF3FF
            l.insets = UIEdgeInsets(top: 2, left: 10, bottom: 2, right: 10)
            l.layer.cornerRadius = 11
            l.clipsToBounds = true
            addSubview(l)
            return l
        }
        setNeedsLayout()
    }

    func computeHeight(width: CGFloat) -> CGFloat {
        guard !chipViews.isEmpty, width > 0 else { return 0 }
        var x: CGFloat = 0, y: CGFloat = 0
        for v in chipViews {
            let w = v.intrinsicContentSize.width
            if x > 0 && x + w > width { x = 0; y += chipH + vGap }
            x += w + hGap
        }
        return y + chipH
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let width = bounds.width
        guard width > 0 else { return }
        var x: CGFloat = 0, y: CGFloat = 0
        for v in chipViews {
            let w = v.intrinsicContentSize.width
            if x > 0 && x + w > width { x = 0; y += chipH + vGap }
            v.frame = CGRect(x: x, y: y, width: w, height: chipH)
            x += w + hGap
        }
    }
}

// MARK: - 네이티브 새요청 본문 (UITableView)
final class NativeInquiryContent: UIView, UITableViewDataSource, UITableViewDelegate {
    weak var delegate: NativeInquiryContentDelegate?
    let tableView = UITableView(frame: .zero, style: .plain)
    private var items: [NativeInquiryItem] = []
    private let emptyLabel = UILabel()

    // 풀투리프레시
    private let loader = LottieAnimationView(name: "freetiful_loading")
    private var loaderTop: NSLayoutConstraint!
    private var baseTop: CGFloat = 0
    private var refreshing = false
    private var lastHapticStep = 0
    private let pullThreshold: CGFloat = 78
    private let lightHaptic = UIImpactFeedbackGenerator(style: .light)
    private let heavyHaptic = UIImpactFeedbackGenerator(style: .medium)

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = UIColor(red: 0.969, green: 0.973, blue: 0.980, alpha: 1) // #F7F8FA

        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.backgroundColor = .clear
        tableView.separatorStyle = .none
        tableView.rowHeight = UITableView.automaticDimension
        tableView.estimatedRowHeight = 240
        tableView.dataSource = self
        tableView.delegate = self
        tableView.keyboardDismissMode = .onDrag
        tableView.contentInsetAdjustmentBehavior = .never
        tableView.register(NativeInquiryCardCell.self, forCellReuseIdentifier: "card")
        addSubview(tableView)

        emptyLabel.translatesAutoresizingMaskIntoConstraints = false
        emptyLabel.text = "새 요청이 없습니다"
        emptyLabel.font = .systemFont(ofSize: 15, weight: .semibold)
        emptyLabel.textColor = UIColor(white: 0.55, alpha: 1)
        emptyLabel.isHidden = true
        addSubview(emptyLabel)

        loader.translatesAutoresizingMaskIntoConstraints = false
        loader.loopMode = .loop
        loader.contentMode = .scaleAspectFit
        loader.alpha = 0
        addSubview(loader)
        loaderTop = loader.centerYAnchor.constraint(equalTo: topAnchor, constant: 30)

        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: topAnchor),
            tableView.leadingAnchor.constraint(equalTo: leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: bottomAnchor),
            emptyLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            emptyLabel.centerYAnchor.constraint(equalTo: centerYAnchor),
            loaderTop,
            loader.centerXAnchor.constraint(equalTo: centerXAnchor),
            loader.widthAnchor.constraint(equalToConstant: 48),
            loader.heightAnchor.constraint(equalToConstant: 48),
        ])
    }

    func setInsets(top: CGFloat, bottom: CGFloat) {
        baseTop = top
        let extra = refreshing ? pullThreshold : 0
        tableView.contentInset = UIEdgeInsets(top: top + extra, left: 0, bottom: bottom, right: 0)
        tableView.verticalScrollIndicatorInsets = UIEdgeInsets(top: top, left: 0, bottom: bottom, right: 0)
        loaderTop.constant = top + 30
    }

    // MARK: - 풀투리프레시
    func scrollViewDidScroll(_ sv: UIScrollView) {
        let pull = -(sv.contentOffset.y + baseTop)
        if refreshing { return }
        loader.alpha = max(0, min(1, pull / pullThreshold))
        loader.transform = CGAffineTransform(rotationAngle: min(pull, pullThreshold) / pullThreshold * .pi)
            .scaledBy(x: max(0.5, min(1, pull / pullThreshold)), y: max(0.5, min(1, pull / pullThreshold)))
        // 끌수록 진동 두두두둥 (단계별)
        let step = Int(max(0, pull) / 16)
        if step > lastHapticStep, pull < pullThreshold + 30 {
            lastHapticStep = step
            lightHaptic.impactOccurred(intensity: min(1, 0.35 + CGFloat(step) * 0.13))
        } else if step < lastHapticStep {
            lastHapticStep = step
        }
    }
    func scrollViewWillBeginDragging(_ sv: UIScrollView) { lightHaptic.prepare(); heavyHaptic.prepare(); lastHapticStep = 0 }
    func scrollViewDidEndDragging(_ sv: UIScrollView, willDecelerate decelerate: Bool) {
        let pull = -(sv.contentOffset.y + baseTop)
        if pull > pullThreshold && !refreshing { startRefresh() }
    }

    private func startRefresh() {
        refreshing = true
        heavyHaptic.impactOccurred()
        loader.alpha = 1
        loader.transform = .identity
        loader.play()
        UIView.animate(withDuration: 0.25) {
            self.tableView.contentInset.top = self.baseTop + self.pullThreshold
        }
        delegate?.inquiryDidPullRefresh()
        // 안전망: 일정시간 뒤 자동 종료
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak self] in self?.endRefresh() }
    }
    func endRefresh() {
        guard refreshing else { return }
        refreshing = false
        loader.stop()
        UIView.animate(withDuration: 0.3, animations: {
            self.loader.alpha = 0
            self.tableView.contentInset.top = self.baseTop
        })
    }

    func scrollToTop() {
        tableView.setContentOffset(CGPoint(x: 0, y: -tableView.contentInset.top), animated: false)
    }

    func setRows(_ newItems: [NativeInquiryItem]) {
        items = newItems
        emptyLabel.isHidden = !newItems.isEmpty
        if refreshing { DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in self?.endRefresh() } }
        tableView.reloadData()
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { items.count }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "card", for: indexPath) as! NativeInquiryCardCell
        cell.configure(items[indexPath.row])
        cell.onChat = { [weak self] item in self?.delegate?.inquiryDidTapChat(item.id, customerId: item.customerId, matchRequestId: item.matchRequestId) }
        cell.onReject = { [weak self] id in self?.delegate?.inquiryDidTapReject(id) }
        return cell
    }

    // 우→좌 스와이프 → 보관
    func tableView(_ tableView: UITableView, trailingSwipeActionsConfigurationForRowAt indexPath: IndexPath) -> UISwipeActionsConfiguration? {
        guard indexPath.row < items.count else { return nil }
        let id = items[indexPath.row].id
        let archive = UIContextualAction(style: .normal, title: "보관") { [weak self] _, _, done in
            Haptics.tap()
            self?.delegate?.inquiryDidArchive(id)
            done(true)
        }
        archive.backgroundColor = UIColor(white: 0.45, alpha: 1)
        return UISwipeActionsConfiguration(actions: [archive])
    }
}

// MARK: - 카드 셀
final class NativeInquiryCardCell: UITableViewCell {
    var onChat: ((NativeInquiryItem) -> Void)?
    var onReject: ((String) -> Void)?
    private var currentId = ""
    private var current: NativeInquiryItem?
    private var currentImageURL = ""

    private let card = UIView()
    private let avatar = UIImageView()
    private let column = UIStackView()
    private let badge = InquiryPadLabel()
    private let nameLabel = UILabel()
    private let timeLabel = UILabel()
    private let categoryLabel = UILabel()
    private let chips = ChipFlowView()
    private let dateRow = UIStackView()
    private let dateLabel = UILabel()
    private let dateIcon = UIImageView()
    private let locRow = UIStackView()
    private let locLabel = UILabel()
    private let locIcon = UIImageView()
    private let infoStack = UIStackView()
    private let noteLabel = InquiryPadLabel()
    private let rejectButton = UIButton(type: .system)
    private let chatButton = UIButton(type: .system)

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setup()
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setup() {
        selectionStyle = .none
        backgroundColor = .clear
        contentView.backgroundColor = .clear

        // 카드 컨테이너
        card.translatesAutoresizingMaskIntoConstraints = false
        card.backgroundColor = .white
        card.layer.cornerRadius = 24
        card.layer.shadowColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1).cgColor
        card.layer.shadowOpacity = 0.05
        card.layer.shadowRadius = 12
        card.layer.shadowOffset = CGSize(width: 0, height: 6)
        contentView.addSubview(card)

        // 아바타
        avatar.translatesAutoresizingMaskIntoConstraints = false
        avatar.contentMode = .scaleAspectFill
        avatar.clipsToBounds = true
        avatar.layer.cornerRadius = 20
        avatar.backgroundColor = UIColor(white: 0.92, alpha: 1)
        card.addSubview(avatar)

        // 뱃지
        badge.font = .systemFont(ofSize: 11, weight: .bold)
        badge.insets = UIEdgeInsets(top: 4, left: 10, bottom: 4, right: 10)
        badge.layer.cornerRadius = 11
        badge.clipsToBounds = true
        badge.setContentHuggingPriority(.required, for: .horizontal)
        badge.setContentCompressionResistancePriority(.required, for: .horizontal)

        // 이름
        nameLabel.font = .systemFont(ofSize: 16, weight: .bold)
        nameLabel.textColor = UIColor(red: 0.169, green: 0.192, blue: 0.239, alpha: 1) // #2B313D
        nameLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        nameLabel.setContentHuggingPriority(.defaultLow, for: .horizontal)

        // 시간
        timeLabel.font = .systemFont(ofSize: 12)
        timeLabel.textColor = UIColor(red: 0.643, green: 0.671, blue: 0.729, alpha: 1) // #A4ABBA
        timeLabel.setContentHuggingPriority(.required, for: .horizontal)
        timeLabel.setContentCompressionResistancePriority(.required, for: .horizontal)

        let headRow = UIStackView(arrangedSubviews: [badge, nameLabel, timeLabel])
        headRow.axis = .horizontal
        headRow.alignment = .center
        headRow.spacing = 8

        // 카테고리
        categoryLabel.font = .systemFont(ofSize: 14, weight: .semibold)
        categoryLabel.textColor = UIColor(red: 0.306, green: 0.349, blue: 0.408, alpha: 1) // #4E5968
        categoryLabel.numberOfLines = 2

        // 날짜/장소 아이콘+라벨
        configureInfoLine(stack: dateRow, icon: dateIcon, label: dateLabel, sf: "calendar")
        configureInfoLine(stack: locRow, icon: locIcon, label: locLabel, sf: "mappin.and.ellipse")

        infoStack.axis = .vertical
        infoStack.spacing = 4
        infoStack.alignment = .leading
        infoStack.addArrangedSubview(dateRow)
        infoStack.addArrangedSubview(locRow)
        infoStack.translatesAutoresizingMaskIntoConstraints = false

        // 메모
        noteLabel.font = .systemFont(ofSize: 13)
        noteLabel.textColor = UIColor(red: 0.306, green: 0.349, blue: 0.408, alpha: 1)
        noteLabel.numberOfLines = 0
        noteLabel.backgroundColor = UIColor(red: 0.973, green: 0.980, blue: 0.988, alpha: 1) // #F8FAFC
        noteLabel.insets = UIEdgeInsets(top: 10, left: 14, bottom: 10, right: 14)
        noteLabel.layer.cornerRadius = 16
        noteLabel.clipsToBounds = true

        // 우측 컬럼 스택
        column.axis = .vertical
        column.alignment = .fill
        column.spacing = 0
        column.translatesAutoresizingMaskIntoConstraints = false
        column.addArrangedSubview(headRow)
        column.addArrangedSubview(categoryLabel)
        column.addArrangedSubview(chips)
        column.addArrangedSubview(infoStack)
        column.addArrangedSubview(noteLabel)
        column.setCustomSpacing(4, after: headRow)
        column.setCustomSpacing(6, after: categoryLabel)
        column.setCustomSpacing(8, after: chips)
        column.setCustomSpacing(12, after: infoStack)
        card.addSubview(column)

        // 거절/채팅 버튼
        styleButton(rejectButton, title: "거절", bg: UIColor(red: 0.949, green: 0.957, blue: 0.973, alpha: 1), fg: UIColor(red: 0.306, green: 0.349, blue: 0.408, alpha: 1))
        styleButton(chatButton, title: "채팅", bg: UIColor(red: 0.192, green: 0.502, blue: 0.969, alpha: 1), fg: .white)
        rejectButton.addTarget(self, action: #selector(tapReject), for: .touchUpInside)
        chatButton.addTarget(self, action: #selector(tapChat), for: .touchUpInside)
        let buttonRow = UIStackView(arrangedSubviews: [rejectButton, chatButton])
        buttonRow.axis = .horizontal
        buttonRow.distribution = .fillEqually
        buttonRow.spacing = 8
        buttonRow.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(buttonRow)

        let buttonTopToColumn = buttonRow.topAnchor.constraint(equalTo: column.bottomAnchor, constant: 16)
        buttonTopToColumn.priority = .defaultHigh
        NSLayoutConstraint.activate([
            buttonTopToColumn,
            card.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 6),
            card.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -6),
            card.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            card.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),

            avatar.topAnchor.constraint(equalTo: card.topAnchor, constant: 16),
            avatar.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            avatar.widthAnchor.constraint(equalToConstant: 44),
            avatar.heightAnchor.constraint(equalToConstant: 44),

            column.topAnchor.constraint(equalTo: card.topAnchor, constant: 16),
            column.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 12),
            column.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),

            buttonRow.topAnchor.constraint(greaterThanOrEqualTo: avatar.bottomAnchor, constant: 16),
            buttonRow.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            buttonRow.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
            buttonRow.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -16),
            buttonRow.heightAnchor.constraint(equalToConstant: 48),
        ])
    }

    private func configureInfoLine(stack: UIStackView, icon: UIImageView, label: UILabel, sf: String) {
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.image = UIImage(systemName: sf)
        icon.tintColor = UIColor(red: 0.420, green: 0.463, blue: 0.518, alpha: 1) // #6B7684
        icon.contentMode = .scaleAspectFit
        icon.setContentHuggingPriority(.required, for: .horizontal)
        label.font = .systemFont(ofSize: 13, weight: .medium)
        label.textColor = UIColor(red: 0.420, green: 0.463, blue: 0.518, alpha: 1)
        label.numberOfLines = 1
        stack.axis = .horizontal
        stack.alignment = .center
        stack.spacing = 4
        stack.addArrangedSubview(icon)
        stack.addArrangedSubview(label)
        NSLayoutConstraint.activate([
            icon.widthAnchor.constraint(equalToConstant: 14),
            icon.heightAnchor.constraint(equalToConstant: 14),
        ])
    }

    private func styleButton(_ b: UIButton, title: String, bg: UIColor, fg: UIColor) {
        b.setTitle(title, for: .normal)
        b.setTitleColor(fg, for: .normal)
        b.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        b.backgroundColor = bg
        b.layer.cornerRadius = 12
        b.translatesAutoresizingMaskIntoConstraints = false
    }

    @objc private func tapReject() { Haptics.tap(); onReject?(currentId) }
    @objc private func tapChat() { Haptics.tap(); if let c = current { onChat?(c) } }

    func configure(_ item: NativeInquiryItem) {
        currentId = item.id
        current = item
        badge.text = item.kindLabel
        if item.isMulti {
            badge.textColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
            badge.backgroundColor = UIColor(red: 0.918, green: 0.949, blue: 1.0, alpha: 1) // #EAF2FF
        } else {
            badge.textColor = UIColor(red: 0.306, green: 0.349, blue: 0.408, alpha: 1)
            badge.backgroundColor = UIColor(red: 0.949, green: 0.957, blue: 0.973, alpha: 1) // #F2F4F8
        }
        nameLabel.text = item.name
        timeLabel.text = item.timeAgo
        categoryLabel.text = item.category
        categoryLabel.isHidden = item.category.isEmpty

        chips.setChips(item.parts)
        let chipWidth = UIScreen.main.bounds.width - 120
        chips.heightConstraint.constant = chips.computeHeight(width: chipWidth)
        chips.isHidden = item.parts.isEmpty

        dateLabel.text = item.dateText
        dateRow.isHidden = item.dateText.isEmpty
        locLabel.text = item.location
        locRow.isHidden = item.location.isEmpty
        infoStack.isHidden = dateRow.isHidden && locRow.isHidden

        noteLabel.text = item.note
        noteLabel.isHidden = item.note.isEmpty

        if item.image != currentImageURL {
            currentImageURL = item.image
            NativeChatImageLoader.load(item.image, into: avatar, fallback: NativeChatHeaderView.avatarPlaceholder)
        }
    }
}
