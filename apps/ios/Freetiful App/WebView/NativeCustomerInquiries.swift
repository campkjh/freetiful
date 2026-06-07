import UIKit

struct NativeInquiryCard {
    let id: String
    let proName: String
    let proImage: String
    let status: String      // 요청중 / 요청승인 / 거래완료
    let category: String
    let date: String
    let location: String
    let link: String
    let hasRoom: Bool
}

protocol NativeCustomerInquiriesDelegate: AnyObject {
    func customerInquiryDidTap(_ link: String, hasRoom: Bool)
    func customerInquiryDidArchive(_ id: String)
    func customerInquiryDidUnarchive(_ id: String)
}

// 고객 문의목록 네이티브 — 상태 카드 + 문의내역/보관함 탭 + 스와이프 보관
final class NativeCustomerInquiries: UIView, UITableViewDataSource, UITableViewDelegate {
    weak var delegate: NativeCustomerInquiriesDelegate?

    private let segment = UISegmentedControl(items: ["문의 내역", "보관함"])
    private let tableView = UITableView()
    private let emptyLabel = UILabel()
    private var active: [NativeInquiryCard] = []
    private var archived: [NativeInquiryCard] = []
    private var segTop: NSLayoutConstraint!

    private var current: [NativeInquiryCard] { segment.selectedSegmentIndex == 0 ? active : archived }

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setInsets(top: CGFloat, bottom: CGFloat) {
        segTop?.constant = top
        tableView.contentInset = UIEdgeInsets(top: 0, left: 0, bottom: bottom, right: 0)
        tableView.verticalScrollIndicatorInsets = UIEdgeInsets(top: 0, left: 0, bottom: bottom, right: 0)
    }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = UIColor(red: 0.969, green: 0.973, blue: 0.980, alpha: 1)

        segment.translatesAutoresizingMaskIntoConstraints = false
        segment.selectedSegmentIndex = 0
        segment.addTarget(self, action: #selector(segmentChanged), for: .valueChanged)
        addSubview(segment)

        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.backgroundColor = .clear
        tableView.separatorStyle = .none
        tableView.dataSource = self
        tableView.delegate = self
        tableView.contentInsetAdjustmentBehavior = .never
        tableView.register(InquiryCardCell.self, forCellReuseIdentifier: "inq")
        tableView.rowHeight = UITableView.automaticDimension
        tableView.estimatedRowHeight = 110
        addSubview(tableView)

        emptyLabel.font = .systemFont(ofSize: 14)
        emptyLabel.textColor = UIColor(white: 0.6, alpha: 1)
        emptyLabel.textAlignment = .center
        emptyLabel.numberOfLines = 0
        emptyLabel.translatesAutoresizingMaskIntoConstraints = false
        emptyLabel.isHidden = true
        addSubview(emptyLabel)

        segTop = segment.topAnchor.constraint(equalTo: topAnchor, constant: 0)
        NSLayoutConstraint.activate([
            segTop,
            segment.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            segment.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            segment.heightAnchor.constraint(equalToConstant: 36),
            tableView.topAnchor.constraint(equalTo: segment.bottomAnchor, constant: 8),
            tableView.leadingAnchor.constraint(equalTo: leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: bottomAnchor),
            emptyLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            emptyLabel.topAnchor.constraint(equalTo: tableView.topAnchor, constant: 80),
            emptyLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 32),
            emptyLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -32),
        ])
    }

    func setData(active: [NativeInquiryCard], archived: [NativeInquiryCard]) {
        self.active = active
        self.archived = archived
        reload()
    }

    private func reload() {
        let isArchive = segment.selectedSegmentIndex == 1
        emptyLabel.isHidden = !current.isEmpty
        emptyLabel.text = isArchive ? "보관한 문의가 없습니다" : "아직 문의한 사회자가 없습니다"
        tableView.reloadData()
    }

    @objc private func segmentChanged() { Haptics.tap(); reload() }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { current.count }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "inq", for: indexPath) as! InquiryCardCell
        cell.configure(current[indexPath.row])
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let c = current[indexPath.row]
        Haptics.tap()
        delegate?.customerInquiryDidTap(c.link, hasRoom: c.hasRoom)
    }

    func tableView(_ tableView: UITableView, trailingSwipeActionsConfigurationForRowAt indexPath: IndexPath) -> UISwipeActionsConfiguration? {
        let isArchive = segment.selectedSegmentIndex == 1
        let card = current[indexPath.row]
        let action = UIContextualAction(style: .normal, title: isArchive ? "보관 해제" : "보관") { [weak self] _, _, done in
            guard let self = self else { done(false); return }
            if isArchive {
                self.archived.removeAll { $0.id == card.id }
                self.delegate?.customerInquiryDidUnarchive(card.id)
            } else {
                self.active.removeAll { $0.id == card.id }
                self.delegate?.customerInquiryDidArchive(card.id)
            }
            self.tableView.deleteRows(at: [indexPath], with: .automatic)
            self.emptyLabel.isHidden = !self.current.isEmpty
            done(true)
        }
        action.backgroundColor = isArchive ? UIColor(red: 0.4, green: 0.45, blue: 0.55, alpha: 1)
                                           : UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
        return UISwipeActionsConfiguration(actions: [action])
    }
}

// MARK: - 문의 카드 셀
final class InquiryCardCell: UITableViewCell {
    private let card = UIView()
    private let photo = UIImageView()
    private let nameLabel = UILabel()
    private let categoryLabel = UILabel()
    private let dateLabel = UILabel()
    private let badge = PaddingLabel2()

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        backgroundColor = .clear
        contentView.backgroundColor = .clear
        selectionStyle = .none

        card.translatesAutoresizingMaskIntoConstraints = false
        card.backgroundColor = .white
        card.layer.cornerRadius = 18
        card.layer.cornerCurve = .continuous
        contentView.addSubview(card)

        photo.translatesAutoresizingMaskIntoConstraints = false
        photo.contentMode = .scaleAspectFill
        photo.clipsToBounds = true
        photo.layer.cornerRadius = 14
        photo.layer.cornerCurve = .continuous
        photo.backgroundColor = UIColor(white: 0.95, alpha: 1)
        card.addSubview(photo)

        nameLabel.font = .systemFont(ofSize: 16, weight: .bold)
        nameLabel.textColor = UIColor(red: 0.17, green: 0.19, blue: 0.24, alpha: 1)
        categoryLabel.font = .systemFont(ofSize: 13, weight: .medium)
        categoryLabel.textColor = UIColor(white: 0.6, alpha: 1)
        dateLabel.font = .systemFont(ofSize: 12)
        dateLabel.textColor = UIColor(white: 0.7, alpha: 1)

        badge.font = .systemFont(ofSize: 12, weight: .bold)
        badge.textInsets = UIEdgeInsets(top: 4, left: 9, bottom: 4, right: 9)
        badge.layer.cornerRadius = 11
        badge.clipsToBounds = true
        badge.setContentHuggingPriority(.required, for: .horizontal)

        let textCol = UIStackView(arrangedSubviews: [nameLabel, categoryLabel, dateLabel])
        textCol.axis = .vertical
        textCol.spacing = 3
        textCol.alignment = .leading
        textCol.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(textCol)
        card.addSubview(badge)
        badge.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            card.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 6),
            card.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -6),
            card.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 14),
            card.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -14),
            photo.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 14),
            photo.centerYAnchor.constraint(equalTo: card.centerYAnchor),
            photo.widthAnchor.constraint(equalToConstant: 56),
            photo.heightAnchor.constraint(equalToConstant: 56),
            textCol.leadingAnchor.constraint(equalTo: photo.trailingAnchor, constant: 12),
            textCol.centerYAnchor.constraint(equalTo: card.centerYAnchor),
            textCol.topAnchor.constraint(greaterThanOrEqualTo: card.topAnchor, constant: 16),
            textCol.bottomAnchor.constraint(lessThanOrEqualTo: card.bottomAnchor, constant: -16),
            badge.topAnchor.constraint(equalTo: card.topAnchor, constant: 16),
            badge.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -14),
            badge.leadingAnchor.constraint(greaterThanOrEqualTo: textCol.trailingAnchor, constant: 8),
        ])
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func configure(_ c: NativeInquiryCard) {
        nameLabel.text = c.proName
        categoryLabel.text = c.category
        dateLabel.text = c.date
        dateLabel.isHidden = c.date.isEmpty
        badge.text = c.status
        switch c.status {
        case "거래완료":
            badge.textColor = UIColor(red: 0.082, green: 0.6, blue: 0.278, alpha: 1)
            badge.backgroundColor = UIColor(red: 0.918, green: 0.969, blue: 0.937, alpha: 1)
        case "요청승인":
            badge.textColor = UIColor(red: 0.192, green: 0.502, blue: 0.969, alpha: 1)
            badge.backgroundColor = UIColor(red: 0.918, green: 0.953, blue: 1.0, alpha: 1)
        default:
            badge.textColor = UIColor(red: 0.4, green: 0.45, blue: 0.52, alpha: 1)
            badge.backgroundColor = UIColor(red: 0.949, green: 0.957, blue: 0.965, alpha: 1)
        }
        NativeChatImageLoader.load(c.proImage, into: photo, fallback: NativeChatHeaderView.avatarPlaceholder)
    }
}

// 패딩 라벨 (배지)
final class PaddingLabel2: UILabel {
    var textInsets = UIEdgeInsets.zero
    override func drawText(in rect: CGRect) { super.drawText(in: rect.inset(by: textInsets)) }
    override var intrinsicContentSize: CGSize {
        let s = super.intrinsicContentSize
        return CGSize(width: s.width + textInsets.left + textInsets.right, height: s.height + textInsets.top + textInsets.bottom)
    }
}
