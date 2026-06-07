import UIKit

struct NativeNotification {
    let id: String
    let title: String
    let body: String
    let date: String
    let isRead: Bool
    let url: String
}

protocol NativeNotificationsDelegate: AnyObject {
    func notificationDidTap(_ id: String, url: String)
    func notificationDidDelete(_ id: String)
}

// 알림 화면 네이티브 본문 (웹 위 덮음) — 리스트 + 우→좌 스와이프 삭제
final class NativeNotificationsContent: UIView, UITableViewDataSource, UITableViewDelegate {
    weak var delegate: NativeNotificationsDelegate?
    private let tableView = UITableView()
    private let emptyLabel = UILabel()
    private var items: [NativeNotification] = []

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setInsets(top: CGFloat, bottom: CGFloat) {
        tableView.contentInset = UIEdgeInsets(top: top, left: 0, bottom: bottom, right: 0)
        tableView.verticalScrollIndicatorInsets = UIEdgeInsets(top: top, left: 0, bottom: bottom, right: 0)
    }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = UIColor(red: 0.969, green: 0.973, blue: 0.980, alpha: 1)

        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.backgroundColor = .clear
        tableView.separatorStyle = .none
        tableView.dataSource = self
        tableView.delegate = self
        tableView.contentInsetAdjustmentBehavior = .never
        tableView.register(NotifCell.self, forCellReuseIdentifier: "notif")
        tableView.rowHeight = UITableView.automaticDimension
        tableView.estimatedRowHeight = 88
        addSubview(tableView)

        emptyLabel.text = "알림이 없습니다"
        emptyLabel.font = .systemFont(ofSize: 14)
        emptyLabel.textColor = UIColor(white: 0.6, alpha: 1)
        emptyLabel.textAlignment = .center
        emptyLabel.translatesAutoresizingMaskIntoConstraints = false
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

    func setItems(_ next: [NativeNotification]) {
        items = next
        emptyLabel.isHidden = !next.isEmpty
        tableView.reloadData()
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { items.count }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "notif", for: indexPath) as! NotifCell
        cell.configure(items[indexPath.row])
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let n = items[indexPath.row]
        Haptics.tap()
        delegate?.notificationDidTap(n.id, url: n.url)
    }

    func tableView(_ tableView: UITableView, trailingSwipeActionsConfigurationForRowAt indexPath: IndexPath) -> UISwipeActionsConfiguration? {
        let id = items[indexPath.row].id
        let del = UIContextualAction(style: .destructive, title: "삭제") { [weak self] _, _, done in
            guard let self = self else { done(false); return }
            self.items.remove(at: indexPath.row)
            self.tableView.deleteRows(at: [indexPath], with: .automatic)
            self.emptyLabel.isHidden = !self.items.isEmpty
            self.delegate?.notificationDidDelete(id)
            done(true)
        }
        del.backgroundColor = UIColor(red: 0.93, green: 0.27, blue: 0.27, alpha: 1)
        return UISwipeActionsConfiguration(actions: [del])
    }
}

// MARK: - 알림 셀
final class NotifCell: UITableViewCell {
    private let card = UIView()
    private let dot = UIView()
    private let titleLabel = UILabel()
    private let bodyLabel = UILabel()
    private let dateLabel = UILabel()

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        backgroundColor = .clear
        contentView.backgroundColor = .clear
        selectionStyle = .none

        card.translatesAutoresizingMaskIntoConstraints = false
        card.backgroundColor = .white
        card.layer.cornerRadius = 14
        card.layer.cornerCurve = .continuous
        contentView.addSubview(card)

        dot.translatesAutoresizingMaskIntoConstraints = false
        dot.backgroundColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
        dot.layer.cornerRadius = 3.5
        card.addSubview(dot)

        titleLabel.font = .systemFont(ofSize: 15, weight: .bold)
        titleLabel.textColor = UIColor(white: 0.1, alpha: 1)
        titleLabel.numberOfLines = 1
        bodyLabel.font = .systemFont(ofSize: 13.5)
        bodyLabel.textColor = UIColor(white: 0.4, alpha: 1)
        bodyLabel.numberOfLines = 2
        dateLabel.font = .systemFont(ofSize: 11.5)
        dateLabel.textColor = UIColor(white: 0.65, alpha: 1)

        let col = UIStackView(arrangedSubviews: [titleLabel, bodyLabel, dateLabel])
        col.axis = .vertical
        col.spacing = 4
        col.alignment = .leading
        col.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(col)

        NSLayoutConstraint.activate([
            card.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 5),
            card.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -5),
            card.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 14),
            card.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -14),
            dot.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 14),
            dot.topAnchor.constraint(equalTo: card.topAnchor, constant: 18),
            dot.widthAnchor.constraint(equalToConstant: 7),
            dot.heightAnchor.constraint(equalToConstant: 7),
            col.leadingAnchor.constraint(equalTo: dot.trailingAnchor, constant: 10),
            col.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -14),
            col.topAnchor.constraint(equalTo: card.topAnchor, constant: 14),
            col.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -14),
        ])
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func configure(_ n: NativeNotification) {
        titleLabel.text = n.title
        bodyLabel.text = n.body
        bodyLabel.isHidden = n.body.isEmpty
        dateLabel.text = n.date
        dot.isHidden = n.isRead
        card.backgroundColor = n.isRead ? .white : UIColor(red: 0.96, green: 0.975, blue: 1.0, alpha: 1)
    }
}
