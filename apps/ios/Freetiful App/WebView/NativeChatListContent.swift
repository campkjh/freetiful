import UIKit

// 채팅/새요청 리스트 한 행 (웹 window.__freetifulChatList.getRooms() 에서 전달)
struct NativeChatRow {
    let id: String
    let name: String
    let image: String
    let lastMessage: String
    let time: String
    let unread: Int
}

protocol NativeChatListContentDelegate: AnyObject {
    func chatListContentDidSelect(_ id: String)
    func chatListContentDidHide(_ id: String)
}

// 네이티브 리스트 본문 (UITableView) — 글래스 바 아래에서 스크롤
final class NativeChatListContent: UIView, UITableViewDataSource, UITableViewDelegate {
    weak var delegate: NativeChatListContentDelegate?
    let tableView = UITableView(frame: .zero, style: .plain)
    private var rows: [NativeChatRow] = []
    private let emptyLabel = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .white

        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.backgroundColor = .white
        tableView.separatorStyle = .singleLine
        tableView.separatorInset = UIEdgeInsets(top: 0, left: 78, bottom: 0, right: 0)
        tableView.rowHeight = 76
        tableView.dataSource = self
        tableView.delegate = self
        tableView.keyboardDismissMode = .onDrag
        tableView.contentInsetAdjustmentBehavior = .never
        tableView.register(NativeChatRowCell.self, forCellReuseIdentifier: "row")
        addSubview(tableView)

        emptyLabel.translatesAutoresizingMaskIntoConstraints = false
        emptyLabel.text = "아직 대화가 없습니다"
        emptyLabel.font = .systemFont(ofSize: 14)
        emptyLabel.textColor = UIColor(white: 0.6, alpha: 1)
        emptyLabel.isHidden = true
        addSubview(emptyLabel)

        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: topAnchor),
            tableView.leadingAnchor.constraint(equalTo: leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: bottomAnchor),
            emptyLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            emptyLabel.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
    }

    func setInsets(top: CGFloat, bottom: CGFloat) {
        tableView.contentInset = UIEdgeInsets(top: top, left: 0, bottom: bottom, right: 0)
        tableView.verticalScrollIndicatorInsets = UIEdgeInsets(top: top, left: 0, bottom: bottom, right: 0)
    }

    func setRows(_ newRows: [NativeChatRow]) {
        rows = newRows
        emptyLabel.isHidden = !newRows.isEmpty
        tableView.reloadData()
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { rows.count }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "row", for: indexPath) as! NativeChatRowCell
        cell.configure(rows[indexPath.row])
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        guard indexPath.row < rows.count else { return }
        Haptics.tap()
        delegate?.chatListContentDidSelect(rows[indexPath.row].id)
    }

    func tableView(_ tableView: UITableView, trailingSwipeActionsConfigurationForRowAt indexPath: IndexPath) -> UISwipeActionsConfiguration? {
        guard indexPath.row < rows.count else { return nil }
        let id = rows[indexPath.row].id
        let hide = UIContextualAction(style: .destructive, title: "숨김") { [weak self] _, _, done in
            Haptics.tap()
            self?.delegate?.chatListContentDidHide(id)
            done(true)
        }
        hide.backgroundColor = UIColor(white: 0.45, alpha: 1)
        return UISwipeActionsConfiguration(actions: [hide])
    }
}

// MARK: - 행 셀
final class NativeChatRowCell: UITableViewCell {
    private let avatar = UIImageView()
    private let nameLabel = UILabel()
    private let messageLabel = UILabel()
    private let timeLabel = UILabel()
    private let unreadBadge = UILabel()
    private var currentImageURL = ""

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setup()
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setup() {
        selectionStyle = .default
        backgroundColor = .white

        avatar.translatesAutoresizingMaskIntoConstraints = false
        avatar.contentMode = .scaleAspectFill
        avatar.clipsToBounds = true
        avatar.layer.cornerRadius = 25
        avatar.backgroundColor = UIColor(white: 0.92, alpha: 1)
        contentView.addSubview(avatar)

        nameLabel.translatesAutoresizingMaskIntoConstraints = false
        nameLabel.font = .systemFont(ofSize: 15, weight: .bold)
        nameLabel.textColor = UIColor(white: 0.1, alpha: 1)
        contentView.addSubview(nameLabel)

        messageLabel.translatesAutoresizingMaskIntoConstraints = false
        messageLabel.font = .systemFont(ofSize: 13.5)
        messageLabel.textColor = UIColor(white: 0.5, alpha: 1)
        contentView.addSubview(messageLabel)

        timeLabel.translatesAutoresizingMaskIntoConstraints = false
        timeLabel.font = .systemFont(ofSize: 11.5)
        timeLabel.textColor = UIColor(white: 0.65, alpha: 1)
        timeLabel.setContentHuggingPriority(.required, for: .horizontal)
        timeLabel.setContentCompressionResistancePriority(.required, for: .horizontal)
        contentView.addSubview(timeLabel)

        unreadBadge.translatesAutoresizingMaskIntoConstraints = false
        unreadBadge.font = .systemFont(ofSize: 11, weight: .bold)
        unreadBadge.textColor = .white
        unreadBadge.backgroundColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
        unreadBadge.textAlignment = .center
        unreadBadge.layer.cornerRadius = 9
        unreadBadge.clipsToBounds = true
        unreadBadge.isHidden = true
        contentView.addSubview(unreadBadge)

        NSLayoutConstraint.activate([
            avatar.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            avatar.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            avatar.widthAnchor.constraint(equalToConstant: 50),
            avatar.heightAnchor.constraint(equalToConstant: 50),

            nameLabel.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 12),
            nameLabel.topAnchor.constraint(equalTo: avatar.topAnchor, constant: 4),
            nameLabel.trailingAnchor.constraint(lessThanOrEqualTo: timeLabel.leadingAnchor, constant: -8),

            timeLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            timeLabel.centerYAnchor.constraint(equalTo: nameLabel.centerYAnchor),

            messageLabel.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 12),
            messageLabel.topAnchor.constraint(equalTo: nameLabel.bottomAnchor, constant: 4),
            messageLabel.trailingAnchor.constraint(lessThanOrEqualTo: unreadBadge.leadingAnchor, constant: -8),

            unreadBadge.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            unreadBadge.centerYAnchor.constraint(equalTo: messageLabel.centerYAnchor),
            unreadBadge.heightAnchor.constraint(equalToConstant: 18),
            unreadBadge.widthAnchor.constraint(greaterThanOrEqualToConstant: 18),
        ])
    }

    func configure(_ row: NativeChatRow) {
        nameLabel.text = row.name.isEmpty ? "대화" : row.name
        messageLabel.text = row.lastMessage
        timeLabel.text = row.time
        if row.unread > 0 {
            unreadBadge.isHidden = false
            unreadBadge.text = "  \(row.unread)  "
        } else {
            unreadBadge.isHidden = true
        }
        if row.image != currentImageURL {
            currentImageURL = row.image
            NativeChatImageLoader.load(row.image, into: avatar, fallback: NativeChatHeaderView.avatarPlaceholder)
        }
    }
}
