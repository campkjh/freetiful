import UIKit

// 채팅 본문 한 메시지 (웹 window.__freetifulChat.getMessages() 에서 전달)
struct NativeChatMessage {
    let id: String
    let mine: Bool
    let content: String
    let imageUrl: String
    let type: String
    let createdAt: String
    let isRead: Bool
    let replyName: String
    let replyContent: String
    let reaction: String
    let pending: Bool
}

protocol NativeChatMessagesDelegate: AnyObject {
    // 꾹눌러 글래스 컨텍스트 메뉴 액션
    func chatMessagesReply(_ id: String)
    func chatMessagesAnnounce(_ id: String)
    func chatMessagesPartialCopy(_ id: String)
    func chatMessagesReact(_ id: String, emoji: String)
}

// 네이티브 채팅 본문 (UITableView) — 글래스 헤더 아래 / 입력바 위
final class NativeChatMessagesView: UIView, UITableViewDataSource, UITableViewDelegate {
    weak var delegate: NativeChatMessagesDelegate?
    let tableView = UITableView(frame: .zero, style: .plain)
    private var messages: [NativeChatMessage] = []
    private let emptyLabel = UILabel()

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = UIColor(red: 0.969, green: 0.973, blue: 0.980, alpha: 1) // #F7F8FA

        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.backgroundColor = .clear
        tableView.separatorStyle = .none
        tableView.rowHeight = UITableView.automaticDimension
        tableView.estimatedRowHeight = 60
        tableView.dataSource = self
        tableView.delegate = self
        tableView.keyboardDismissMode = .interactive
        tableView.contentInsetAdjustmentBehavior = .never
        tableView.showsVerticalScrollIndicator = true
        tableView.register(NativeChatBubbleCell.self, forCellReuseIdentifier: "bubble")
        tableView.register(NativeChatImageCell.self, forCellReuseIdentifier: "image")
        addSubview(tableView)

        emptyLabel.translatesAutoresizingMaskIntoConstraints = false
        emptyLabel.text = "대화를 시작해보세요"
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

    func setMessages(_ next: [NativeChatMessage], forceScroll: Bool) {
        let wasNearBottom = isNearBottom()
        let grew = next.count > messages.count
        messages = next
        emptyLabel.isHidden = !next.isEmpty
        tableView.reloadData()
        if forceScroll || grew || wasNearBottom {
            DispatchQueue.main.async { [weak self] in self?.scrollToBottom(animated: !forceScroll) }
        }
    }

    private func isNearBottom() -> Bool {
        let offsetY = tableView.contentOffset.y
        let maxY = tableView.contentSize.height - tableView.bounds.height + tableView.contentInset.bottom
        return offsetY >= maxY - 160
    }

    func scrollToBottom(animated: Bool) {
        guard !messages.isEmpty else { return }
        let last = IndexPath(row: messages.count - 1, section: 0)
        tableView.scrollToRow(at: last, at: .bottom, animated: animated)
    }

    // 꾹눌러 네이티브 글래스 컨텍스트 메뉴 (블러 + 리프트 프리뷰 자동)
    func tableView(_ tableView: UITableView, contextMenuConfigurationForRowAt indexPath: IndexPath, point: CGPoint) -> UIContextMenuConfiguration? {
        guard indexPath.row < messages.count else { return nil }
        let m = messages[indexPath.row]
        return UIContextMenuConfiguration(identifier: indexPath as NSIndexPath, previewProvider: nil) { [weak self] _ in
            guard let self else { return nil }
            let emojis = ["❤️", "👍", "😂", "😮", "😢", "🙏"].map { e in
                UIAction(title: e) { _ in Haptics.tap(); self.delegate?.chatMessagesReact(m.id, emoji: e) }
            }
            let react = UIMenu(title: "이모지 답장", image: UIImage(systemName: "face.smiling"), children: emojis)
            let reply = UIAction(title: "답장", image: UIImage(systemName: "arrowshape.turn.up.left")) { _ in
                self.delegate?.chatMessagesReply(m.id)
            }
            var actions: [UIMenuElement] = [react, reply]
            if m.type == "text" {
                let copy = UIAction(title: "복사", image: UIImage(systemName: "doc.on.doc")) { _ in
                    UIPasteboard.general.string = m.content
                }
                let partial = UIAction(title: "부분 복사", image: UIImage(systemName: "text.viewfinder")) { _ in
                    self.delegate?.chatMessagesPartialCopy(m.id)
                }
                let announce = UIAction(title: "공지로 등록", image: UIImage(systemName: "megaphone")) { _ in
                    self.delegate?.chatMessagesAnnounce(m.id)
                }
                actions.append(contentsOf: [copy, partial, announce])
            }
            return UIMenu(title: "", children: actions)
        }
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { messages.count }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let m = messages[indexPath.row]
        if m.type == "image" && !m.imageUrl.isEmpty {
            let cell = tableView.dequeueReusableCell(withIdentifier: "image", for: indexPath) as! NativeChatImageCell
            cell.configure(m)
            return cell
        }
        let cell = tableView.dequeueReusableCell(withIdentifier: "bubble", for: indexPath) as! NativeChatBubbleCell
        cell.configure(m)
        return cell
    }
}

// MARK: - 말풍선 셀
final class NativeChatBubbleCell: UITableViewCell {
    private let bubble = UIView()
    private let bubbleStack = UIStackView()
    private let messageLabel = UILabel()
    private let timeLabel = UILabel()
    private let replyBar = UIView()
    private let replyLabel = UILabel()
    private var leadingC: NSLayoutConstraint!
    private var trailingC: NSLayoutConstraint!
    private var timeLeadingC: NSLayoutConstraint!
    private var timeTrailingC: NSLayoutConstraint!

    fileprivate static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "a h:mm"
        return f
    }()
    fileprivate static let isoParser = ISO8601DateFormatter()
    fileprivate static let isoParserFrac: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setup()
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setup() {
        selectionStyle = .none
        backgroundColor = .clear
        contentView.backgroundColor = .clear

        bubble.translatesAutoresizingMaskIntoConstraints = false
        bubble.layer.cornerRadius = 18
        bubble.layer.cornerCurve = .continuous
        contentView.addSubview(bubble)

        replyBar.translatesAutoresizingMaskIntoConstraints = false
        replyBar.layer.cornerRadius = 8
        replyLabel.translatesAutoresizingMaskIntoConstraints = false
        replyLabel.font = .systemFont(ofSize: 12)
        replyLabel.numberOfLines = 2
        replyBar.addSubview(replyLabel)

        messageLabel.font = .systemFont(ofSize: 15.5)
        messageLabel.numberOfLines = 0

        bubbleStack.translatesAutoresizingMaskIntoConstraints = false
        bubbleStack.axis = .vertical
        bubbleStack.spacing = 6
        bubbleStack.alignment = .fill
        bubbleStack.addArrangedSubview(replyBar)
        bubbleStack.addArrangedSubview(messageLabel)
        bubble.addSubview(bubbleStack)

        timeLabel.translatesAutoresizingMaskIntoConstraints = false
        timeLabel.font = .systemFont(ofSize: 10.5)
        timeLabel.textColor = UIColor(white: 0.6, alpha: 1)
        contentView.addSubview(timeLabel)

        let maxWidth = bubble.widthAnchor.constraint(lessThanOrEqualToConstant: UIScreen.main.bounds.width * 0.72)
        maxWidth.priority = .required

        leadingC = bubble.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 14)
        trailingC = bubble.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -14)
        timeLeadingC = timeLabel.leadingAnchor.constraint(equalTo: bubble.leadingAnchor, constant: 2)
        timeTrailingC = timeLabel.trailingAnchor.constraint(equalTo: bubble.trailingAnchor, constant: -2)

        NSLayoutConstraint.activate([
            bubble.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 4),
            maxWidth,

            bubbleStack.topAnchor.constraint(equalTo: bubble.topAnchor, constant: 8),
            bubbleStack.bottomAnchor.constraint(equalTo: bubble.bottomAnchor, constant: -8),
            bubbleStack.leadingAnchor.constraint(equalTo: bubble.leadingAnchor, constant: 13),
            bubbleStack.trailingAnchor.constraint(equalTo: bubble.trailingAnchor, constant: -13),

            replyLabel.topAnchor.constraint(equalTo: replyBar.topAnchor, constant: 5),
            replyLabel.bottomAnchor.constraint(equalTo: replyBar.bottomAnchor, constant: -5),
            replyLabel.leadingAnchor.constraint(equalTo: replyBar.leadingAnchor, constant: 8),
            replyLabel.trailingAnchor.constraint(equalTo: replyBar.trailingAnchor, constant: -8),

            timeLabel.topAnchor.constraint(equalTo: bubble.bottomAnchor, constant: 2),
            timeLabel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -4),
        ])
    }

    func configure(_ m: NativeChatMessage) {
        let mine = m.mine
        bubble.backgroundColor = mine
            ? UIColor(red: 0.192, green: 0.502, blue: 0.969, alpha: 1) // #3180F7
            : UIColor(white: 0.92, alpha: 1)
        messageLabel.textColor = mine ? .white : UIColor(white: 0.1, alpha: 1)
        messageLabel.text = displayText(m)
        bubble.alpha = m.pending ? 0.6 : 1.0

        let hasReply = !m.replyContent.isEmpty
        replyBar.isHidden = !hasReply
        if hasReply {
            replyBar.backgroundColor = mine ? UIColor(white: 1, alpha: 0.22) : UIColor(white: 0.82, alpha: 1)
            replyLabel.textColor = mine ? UIColor(white: 1, alpha: 0.92) : UIColor(white: 0.35, alpha: 1)
            let name = m.replyName.isEmpty ? "" : "\(m.replyName)\n"
            replyLabel.text = "\(name)\(m.replyContent)"
        }

        let reactionPrefix = m.reaction.isEmpty ? "" : "\(m.reaction) "
        timeLabel.text = reactionPrefix + formatTime(m.createdAt)

        leadingC.isActive = false
        trailingC.isActive = false
        timeLeadingC.isActive = false
        timeTrailingC.isActive = false
        if mine {
            trailingC.isActive = true
            timeTrailingC.isActive = true
        } else {
            leadingC.isActive = true
            timeLeadingC.isActive = true
        }
    }

    private func displayText(_ m: NativeChatMessage) -> String {
        switch m.type {
        case "text": return m.content
        case "image": return "[사진]"
        case "file": return m.content.isEmpty ? "[파일]" : "[파일] \(m.content)"
        case "audio": return "[음성 메시지]"
        case "location": return "[위치]"
        case "quotation", "quote": return "[견적서]"
        default: return m.content.isEmpty ? "[메시지]" : m.content
        }
    }

    private func formatTime(_ iso: String) -> String {
        guard !iso.isEmpty else { return "" }
        let date = NativeChatBubbleCell.isoParserFrac.date(from: iso)
            ?? NativeChatBubbleCell.isoParser.date(from: iso)
        guard let date else { return "" }
        return NativeChatBubbleCell.timeFormatter.string(from: date)
    }
}

// MARK: - 이미지 말풍선 셀
final class NativeChatImageCell: UITableViewCell {
    private let photo = UIImageView()
    private let timeLabel = UILabel()
    private var leadingC: NSLayoutConstraint!
    private var trailingC: NSLayoutConstraint!
    private var timeLeadingC: NSLayoutConstraint!
    private var timeTrailingC: NSLayoutConstraint!
    private var currentURL = ""

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setup()
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setup() {
        selectionStyle = .none
        backgroundColor = .clear
        contentView.backgroundColor = .clear

        photo.translatesAutoresizingMaskIntoConstraints = false
        photo.contentMode = .scaleAspectFill
        photo.clipsToBounds = true
        photo.layer.cornerRadius = 16
        photo.layer.cornerCurve = .continuous
        photo.backgroundColor = UIColor(white: 0.90, alpha: 1)
        contentView.addSubview(photo)

        timeLabel.translatesAutoresizingMaskIntoConstraints = false
        timeLabel.font = .systemFont(ofSize: 10.5)
        timeLabel.textColor = UIColor(white: 0.6, alpha: 1)
        contentView.addSubview(timeLabel)

        leadingC = photo.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 14)
        trailingC = photo.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -14)
        timeLeadingC = timeLabel.leadingAnchor.constraint(equalTo: photo.leadingAnchor, constant: 2)
        timeTrailingC = timeLabel.trailingAnchor.constraint(equalTo: photo.trailingAnchor, constant: -2)

        NSLayoutConstraint.activate([
            photo.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 4),
            photo.widthAnchor.constraint(equalToConstant: 220),
            photo.heightAnchor.constraint(equalToConstant: 220),
            timeLabel.topAnchor.constraint(equalTo: photo.bottomAnchor, constant: 2),
            timeLabel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -4),
        ])
    }

    func configure(_ m: NativeChatMessage) {
        if m.imageUrl != currentURL {
            currentURL = m.imageUrl
            photo.image = nil
            NativeChatImageLoader.load(m.imageUrl, into: photo, fallback: nil)
        }
        photo.alpha = m.pending ? 0.6 : 1.0
        let reactionPrefix = m.reaction.isEmpty ? "" : "\(m.reaction) "
        timeLabel.text = reactionPrefix + NativeChatImageCell.formatTime(m.createdAt)

        leadingC.isActive = false
        trailingC.isActive = false
        timeLeadingC.isActive = false
        timeTrailingC.isActive = false
        if m.mine {
            trailingC.isActive = true
            timeTrailingC.isActive = true
        } else {
            leadingC.isActive = true
            timeLeadingC.isActive = true
        }
    }

    private static func formatTime(_ iso: String) -> String {
        guard !iso.isEmpty else { return "" }
        let date = NativeChatBubbleCell.isoParserFrac.date(from: iso)
            ?? NativeChatBubbleCell.isoParser.date(from: iso)
        guard let date else { return "" }
        return NativeChatBubbleCell.timeFormatter.string(from: date)
    }
}
