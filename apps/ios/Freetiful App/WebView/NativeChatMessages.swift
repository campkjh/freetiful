import UIKit
import CoreMotion
import AVFoundation

// 디바이스 모션(자이로) 공유 제공 — 견적 카드 사진 3D 틸트용
final class MotionTilt {
    static let shared = MotionTilt()
    private let mgr = CMMotionManager()
    private var refRoll: Double?
    private(set) var roll: Double = 0   // 기준 자세 대비 (좌우)
    private(set) var pitch: Double = 0  // 기준 자세 대비 (앞뒤)
    private init() {}

    func start() {
        guard mgr.isDeviceMotionAvailable, !mgr.isDeviceMotionActive else { return }
        mgr.deviceMotionUpdateInterval = 1.0 / 50.0
        var refPitch: Double?
        mgr.startDeviceMotionUpdates(to: .main) { [weak self] motion, _ in
            guard let self = self, let m = motion else { return }
            if self.refRoll == nil { self.refRoll = m.attitude.roll }
            if refPitch == nil { refPitch = m.attitude.pitch }
            let dRoll = m.attitude.roll - (self.refRoll ?? 0)
            let dPitch = m.attitude.pitch - (refPitch ?? 0)
            // 저역통과 필터로 스무스하게
            self.roll += (dRoll - self.roll) * 0.18
            self.pitch += (dPitch - self.pitch) * 0.18
            NotificationCenter.default.post(name: .motionTilt, object: nil)
        }
    }
}
extension Notification.Name { static let motionTilt = Notification.Name("ftMotionTilt") }

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
    let systemKind: String
    let quoteAmount: Int
    let quoteTitle: String
    let quoteDate: String
    let quoteTime: String
    let quoteLocation: String
    let quotationId: String
    var quoteEventName: String = ""
    var quotePlanLabel: String = ""
    var quoteProImage: String = ""
    var quoteIsLatest: Bool = false
    var uploadProgress: Double = -1   // -1 = 업로드 아님, 0~100 = 업로드 진행중
    var uploadBytesTotal: Double = 0  // 원본 용량(byte) — "X.X / Y.Y MB" 표기용
    var uploadFailed: Bool = false    // 업로드 실패 → 재전송/삭제 버튼 표시
    var fileName: String = ""         // 파일 메시지 표시용 파일명
}

protocol NativeChatMessagesDelegate: AnyObject {
    // 꾹눌러 글래스 컨텍스트 메뉴 액션
    func chatMessagesReply(_ id: String)
    func chatMessagesAnnounce(_ id: String)
    func chatMessagesPartialCopy(_ id: String)
    func chatMessagesReact(_ id: String, emoji: String)
    // 견적 카드 탭 → 결제
    func chatMessagesQuoteTap(_ quotationId: String)
    // 이미지 탭 → 전체화면 확대
    func chatMessagesImageTap(_ url: String)
    // 동영상 탭 → 플레이어
    func chatMessagesVideoTap(_ url: String)
    // 업로드 실패 미디어 — 재전송 / 삭제
    func chatMessagesRetryMedia(_ id: String)
    func chatMessagesDeleteMedia(_ id: String)
    // 파일 탭 → 다운로드 후 미리보기/공유 (fileName 으로 저장돼 PDF 등 타입 인식)
    func chatMessagesFileTap(_ url: String, fileName: String)
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
        backgroundColor = .white // 웹 채팅방과 같은 흰 바탕

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
        tableView.register(NativeChatVideoCell.self, forCellReuseIdentifier: "video")
        tableView.register(NativeChatFileCell.self, forCellReuseIdentifier: "file")
        tableView.register(NativeChatQuoteCell.self, forCellReuseIdentifier: "quote")
        tableView.register(NativeChatSystemCell.self, forCellReuseIdentifier: "system")
        addSubview(tableView)

        // 메시지 영역(다른 곳) 탭 시 키보드 내림 — 셀 탭은 막지 않음(cancelsTouchesInView=false)
        let dismissTap = UITapGestureRecognizer(target: self, action: #selector(dismissKeyboardTap))
        dismissTap.cancelsTouchesInView = false
        tableView.addGestureRecognizer(dismissTap)

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

    @objc private func dismissKeyboardTap() { window?.endEditing(true) }

    private var pendingAnimIds = Set<String>()
    private var animatedIds = Set<String>()

    // 낙관(pending) 메시지가 동일 내용의 실제 메시지와 인접하면 제거 → 전송 시 2개 표시 방지
    private static func dedupOptimistic(_ list: [NativeChatMessage]) -> [NativeChatMessage] {
        var result: [NativeChatMessage] = []
        for m in list {
            if let last = result.last,
               last.mine == m.mine, last.content == m.content, last.type == m.type, last.imageUrl == m.imageUrl,
               last.pending != m.pending {
                // 인접 낙관+실제 중복 — 실제(비pending) 유지
                if last.pending && !m.pending { result[result.count - 1] = m }
                continue
            }
            result.append(m)
        }
        return result
    }

    func setMessages(_ rawNext: [NativeChatMessage], forceScroll: Bool) {
        let next = Self.dedupOptimistic(rawNext)
        let wasNearBottom = isNearBottom()
        let grew = next.count > messages.count
        // 새로 추가된 메시지만 등장 애니메이션 대상으로 표시 (첫 로드는 제외)
        if !messages.isEmpty {
            let prevIds = Set(messages.map { $0.id })
            pendingAnimIds = Set(next.map { $0.id }).subtracting(prevIds)
        } else {
            pendingAnimIds = []
        }
        messages = next
        emptyLabel.isHidden = !next.isEmpty
        tableView.reloadData()
        if forceScroll || grew || wasNearBottom {
            DispatchQueue.main.async { [weak self] in self?.scrollToBottom(animated: !forceScroll) }
        }
    }

    // iMessage식 등장 애니메이션 — 새 메시지가 보일 때 스프링 팝
    func tableView(_ tableView: UITableView, willDisplay cell: UITableViewCell, forRowAt indexPath: IndexPath) {
        guard indexPath.row < messages.count else { return }
        let id = messages[indexPath.row].id
        guard pendingAnimIds.contains(id), !animatedIds.contains(id) else { return }
        animatedIds.insert(id)
        if animatedIds.count > 400 { animatedIds.removeAll() }
        cell.alpha = 0
        cell.contentView.transform = CGAffineTransform(translationX: 0, y: 16).scaledBy(x: 0.95, y: 0.95)
        UIView.animate(withDuration: 0.42, delay: 0, usingSpringWithDamping: 0.74,
                       initialSpringVelocity: 0.5, options: [.allowUserInteraction]) {
            cell.alpha = 1
            cell.contentView.transform = .identity
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

    func scrollToTop(animated: Bool) {
        guard !messages.isEmpty else { return }
        tableView.scrollToRow(at: IndexPath(row: 0, section: 0), at: .top, animated: animated)
    }

    // 대화 내용 검색 — 일치 메시지 개수 반환, 첫 일치로 스크롤(셀 하이라이트 플래시)
    @discardableResult
    func searchScroll(_ query: String) -> Int {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return 0 }
        let hits = messages.enumerated().filter { $0.element.content.lowercased().contains(q) }
        guard let first = hits.first else { return 0 }
        let ip = IndexPath(row: first.offset, section: 0)
        tableView.scrollToRow(at: ip, at: .middle, animated: true)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { [weak self] in
            guard let cell = self?.tableView.cellForRow(at: ip) else { return }
            let flash = UIView(frame: cell.contentView.bounds)
            flash.backgroundColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 0.14)
            flash.layer.cornerRadius = 12
            flash.isUserInteractionEnabled = false
            cell.contentView.addSubview(flash)
            UIView.animate(withDuration: 0.9, delay: 0.25, options: [], animations: { flash.alpha = 0 }) { _ in flash.removeFromSuperview() }
        }
        return hits.count
    }

    // 꾹눌러 네이티브 글래스 컨텍스트 메뉴 (블러 + 리프트 프리뷰 자동)
    func tableView(_ tableView: UITableView, contextMenuConfigurationForRowAt indexPath: IndexPath, point: CGPoint) -> UIContextMenuConfiguration? {
        guard indexPath.row < messages.count else { return nil }
        let m = messages[indexPath.row]
        if m.type == "system" { return nil } // 시스템/견적 메시지엔 컨텍스트 메뉴 없음
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
        if m.type == "system" {
            if m.systemKind == "quote" {
                let cell = tableView.dequeueReusableCell(withIdentifier: "quote", for: indexPath) as! NativeChatQuoteCell
                cell.configure(m)
                cell.onTap = { [weak self] qid in self?.delegate?.chatMessagesQuoteTap(qid) }
                return cell
            }
            let cell = tableView.dequeueReusableCell(withIdentifier: "system", for: indexPath) as! NativeChatSystemCell
            cell.configure(m)
            return cell
        }
        if m.type == "image" && !m.imageUrl.isEmpty {
            let cell = tableView.dequeueReusableCell(withIdentifier: "image", for: indexPath) as! NativeChatImageCell
            cell.configure(m)
            cell.onTap = { [weak self] url in self?.delegate?.chatMessagesImageTap(url) }
            cell.onRetry = { [weak self] id in self?.delegate?.chatMessagesRetryMedia(id) }
            cell.onDelete = { [weak self] id in self?.delegate?.chatMessagesDeleteMedia(id) }
            return cell
        }
        if m.type == "video" {
            let cell = tableView.dequeueReusableCell(withIdentifier: "video", for: indexPath) as! NativeChatVideoCell
            cell.configure(m)
            cell.onTap = { [weak self] url in self?.delegate?.chatMessagesVideoTap(url) }
            cell.onRetry = { [weak self] id in self?.delegate?.chatMessagesRetryMedia(id) }
            cell.onDelete = { [weak self] id in self?.delegate?.chatMessagesDeleteMedia(id) }
            return cell
        }
        if m.type == "file" {
            let cell = tableView.dequeueReusableCell(withIdentifier: "file", for: indexPath) as! NativeChatFileCell
            cell.configure(m)
            cell.onTap = { [weak self] url, name in self?.delegate?.chatMessagesFileTap(url, fileName: name) }
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
            : UIColor(red: 0.949, green: 0.953, blue: 0.961, alpha: 1) // #F2F3F5
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
        case "video": return "[동영상]"
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

// MARK: - 업로드 진행 오버레이 (카톡식: 딤드 + 원형 게이지 + MB)
final class ChatUploadOverlay: UIView {
    private let track = CAShapeLayer()
    private let ring = CAShapeLayer()
    private let pctLabel = UILabel()
    private let mbLabel = UILabel()
    private let radius: CGFloat = 22

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setup() {
        isUserInteractionEnabled = false
        backgroundColor = UIColor(white: 0, alpha: 0.42)
        layer.cornerRadius = 16
        layer.cornerCurve = .continuous
        clipsToBounds = true

        track.fillColor = UIColor.clear.cgColor
        track.strokeColor = UIColor(white: 1, alpha: 0.30).cgColor
        track.lineWidth = 4
        layer.addSublayer(track)

        ring.fillColor = UIColor.clear.cgColor
        ring.strokeColor = UIColor.white.cgColor
        ring.lineWidth = 4
        ring.lineCap = .round
        ring.strokeEnd = 0
        layer.addSublayer(ring)

        pctLabel.font = .systemFont(ofSize: 13, weight: .bold)
        pctLabel.textColor = .white
        pctLabel.textAlignment = .center
        pctLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(pctLabel)

        mbLabel.font = .systemFont(ofSize: 10, weight: .medium)
        mbLabel.textColor = UIColor(white: 1, alpha: 0.85)
        mbLabel.textAlignment = .center
        mbLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(mbLabel)

        NSLayoutConstraint.activate([
            pctLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            pctLabel.centerYAnchor.constraint(equalTo: centerYAnchor),  // % 는 원 정중앙
            mbLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            mbLabel.topAnchor.constraint(equalTo: centerYAnchor, constant: radius + 10),  // MB 는 원 아래(겹침 방지)
        ])
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let center = CGPoint(x: bounds.midX, y: bounds.midY)
        let path = UIBezierPath(arcCenter: center, radius: radius, startAngle: -.pi / 2, endAngle: .pi * 1.5, clockwise: true)
        track.path = path.cgPath
        ring.path = path.cgPath
    }

    func update(progress: Double, totalBytes: Double) {
        let p = max(0, min(100, progress)) / 100.0
        ring.strokeEnd = CGFloat(p)
        pctLabel.text = "\(Int(progress.rounded()))%"
        if totalBytes > 0 {
            let mb = totalBytes / 1_048_576.0
            mbLabel.isHidden = false
            mbLabel.text = String(format: "%.1f / %.1f MB", mb * p, mb)
        } else {
            mbLabel.isHidden = true
        }
    }
}

// MARK: - 업로드 실패 오버레이 (카톡식: 재전송 / 삭제)
final class ChatFailedOverlay: UIView {
    var onRetry: (() -> Void)?
    var onDelete: (() -> Void)?
    private let retryBtn = UIButton(type: .system)
    private let deleteBtn = UIButton(type: .system)

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setup() {
        backgroundColor = UIColor(white: 0, alpha: 0.5)
        layer.cornerRadius = 16
        layer.cornerCurve = .continuous
        clipsToBounds = true

        let icon = UIImageView(image: UIImage(systemName: "exclamationmark.triangle.fill"))
        icon.tintColor = UIColor(red: 1.0, green: 0.45, blue: 0.4, alpha: 1)
        icon.contentMode = .scaleAspectFit
        icon.translatesAutoresizingMaskIntoConstraints = false

        let label = UILabel()
        label.text = "전송 실패"
        label.font = .systemFont(ofSize: 12, weight: .semibold)
        label.textColor = .white
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false

        configureSmallButton(retryBtn, title: "재전송", sf: "arrow.clockwise", filled: true)
        configureSmallButton(deleteBtn, title: "삭제", sf: "trash", filled: false)
        retryBtn.addTarget(self, action: #selector(tapRetry), for: .touchUpInside)
        deleteBtn.addTarget(self, action: #selector(tapDelete), for: .touchUpInside)

        let btnRow = UIStackView(arrangedSubviews: [retryBtn, deleteBtn])
        btnRow.axis = .horizontal
        btnRow.spacing = 8

        let stack = UIStackView(arrangedSubviews: [icon, label, btnRow])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 7
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            icon.widthAnchor.constraint(equalToConstant: 26),
            icon.heightAnchor.constraint(equalToConstant: 26),
            stack.centerXAnchor.constraint(equalTo: centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
    }

    private func configureSmallButton(_ b: UIButton, title: String, sf: String, filled: Bool) {
        var cfg = UIButton.Configuration.filled()
        cfg.image = UIImage(systemName: sf, withConfiguration: UIImage.SymbolConfiguration(pointSize: 11, weight: .semibold))
        cfg.imagePadding = 4
        cfg.cornerStyle = .capsule
        cfg.contentInsets = NSDirectionalEdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 12)
        cfg.baseBackgroundColor = filled ? .white : UIColor(white: 1, alpha: 0.22)
        cfg.baseForegroundColor = filled ? UIColor(white: 0.1, alpha: 1) : .white
        var ac = AttributeContainer()
        ac.font = .systemFont(ofSize: 12, weight: .semibold)
        cfg.attributedTitle = AttributedString(title, attributes: ac)
        b.configuration = cfg
        b.translatesAutoresizingMaskIntoConstraints = false
    }

    @objc private func tapRetry() { Haptics.tap(); onRetry?() }
    @objc private func tapDelete() { Haptics.tap(); onDelete?() }
}

// MARK: - 이미지 말풍선 셀
final class NativeChatImageCell: UITableViewCell {
    var onTap: ((String) -> Void)?
    var onRetry: ((String) -> Void)?
    var onDelete: ((String) -> Void)?
    private let photo = UIImageView()
    private let timeLabel = UILabel()
    private var leadingC: NSLayoutConstraint!
    private var trailingC: NSLayoutConstraint!
    private var timeLeadingC: NSLayoutConstraint!
    private var timeTrailingC: NSLayoutConstraint!
    private var currentURL = ""
    private var msgId = ""
    private let uploadOverlay = ChatUploadOverlay()
    private let failedOverlay = ChatFailedOverlay()

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
        photo.isUserInteractionEnabled = true
        photo.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(handleTap)))
        contentView.addSubview(photo)

        uploadOverlay.translatesAutoresizingMaskIntoConstraints = false
        uploadOverlay.isHidden = true
        contentView.addSubview(uploadOverlay)

        failedOverlay.translatesAutoresizingMaskIntoConstraints = false
        failedOverlay.isHidden = true
        failedOverlay.onRetry = { [weak self] in guard let self = self else { return }; self.onRetry?(self.msgId) }
        failedOverlay.onDelete = { [weak self] in guard let self = self else { return }; self.onDelete?(self.msgId) }
        contentView.addSubview(failedOverlay)

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
            uploadOverlay.leadingAnchor.constraint(equalTo: photo.leadingAnchor),
            uploadOverlay.trailingAnchor.constraint(equalTo: photo.trailingAnchor),
            uploadOverlay.topAnchor.constraint(equalTo: photo.topAnchor),
            uploadOverlay.bottomAnchor.constraint(equalTo: photo.bottomAnchor),
            failedOverlay.leadingAnchor.constraint(equalTo: photo.leadingAnchor),
            failedOverlay.trailingAnchor.constraint(equalTo: photo.trailingAnchor),
            failedOverlay.topAnchor.constraint(equalTo: photo.topAnchor),
            failedOverlay.bottomAnchor.constraint(equalTo: photo.bottomAnchor),
            timeLabel.topAnchor.constraint(equalTo: photo.bottomAnchor, constant: 2),
            timeLabel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -4),
        ])
    }

    @objc private func handleTap() {
        guard !currentURL.isEmpty else { return }
        Haptics.tap()
        onTap?(currentURL)
    }

    func configure(_ m: NativeChatMessage) {
        msgId = m.id
        if m.imageUrl != currentURL {
            currentURL = m.imageUrl
            photo.image = nil
            NativeChatImageLoader.load(m.imageUrl, into: photo, fallback: nil)
        }
        let uploading = m.uploadProgress >= 0 && m.uploadProgress < 100
        uploadOverlay.isHidden = !uploading || m.uploadFailed
        if uploading { uploadOverlay.update(progress: m.uploadProgress, totalBytes: m.uploadBytesTotal) }
        failedOverlay.isHidden = !m.uploadFailed
        photo.alpha = (uploading || m.uploadFailed) ? 1.0 : (m.pending ? 0.6 : 1.0)
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

// MARK: - 동영상 말풍선 셀 (포스터 + 재생버튼, 탭 → 플레이어)
final class NativeChatVideoCell: UITableViewCell {
    var onTap: ((String) -> Void)?
    var onRetry: ((String) -> Void)?
    var onDelete: ((String) -> Void)?
    private let photo = UIImageView()
    private let playIcon = UIImageView()
    private let timeLabel = UILabel()
    private var leadingC: NSLayoutConstraint!
    private var trailingC: NSLayoutConstraint!
    private var timeLeadingC: NSLayoutConstraint!
    private var timeTrailingC: NSLayoutConstraint!
    private var currentURL = ""
    private var msgId = ""
    private var isUploading = false
    private let uploadOverlay = ChatUploadOverlay()
    private let failedOverlay = ChatFailedOverlay()
    private static var posterCache: [String: UIImage] = [:]
    // /uploads 미디어는 Vercel(CDN) 경유 대신 Railway 원본에서 — 포스터 생성(AVAssetImageGenerator)도
    // Range 응답에 의존하므로 CDN 캐시 변수를 제거해 "썸네일 안 뜨는 영상" 케이스를 줄인다.
    static let mediaBase = "https://affectionate-smile-production-6535.up.railway.app"

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
        photo.backgroundColor = UIColor(white: 0.82, alpha: 1)
        photo.isUserInteractionEnabled = true
        photo.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(handleTap)))
        contentView.addSubview(photo)

        playIcon.translatesAutoresizingMaskIntoConstraints = false
        playIcon.image = UIImage(systemName: "play.circle.fill")
        playIcon.tintColor = UIColor(white: 1, alpha: 0.95)
        playIcon.contentMode = .scaleAspectFit
        playIcon.isUserInteractionEnabled = false
        playIcon.layer.shadowColor = UIColor.black.cgColor
        playIcon.layer.shadowOpacity = 0.35
        playIcon.layer.shadowRadius = 6
        playIcon.layer.shadowOffset = .zero
        contentView.addSubview(playIcon)

        uploadOverlay.translatesAutoresizingMaskIntoConstraints = false
        uploadOverlay.isHidden = true
        contentView.addSubview(uploadOverlay)

        failedOverlay.translatesAutoresizingMaskIntoConstraints = false
        failedOverlay.isHidden = true
        failedOverlay.onRetry = { [weak self] in guard let self = self else { return }; self.onRetry?(self.msgId) }
        failedOverlay.onDelete = { [weak self] in guard let self = self else { return }; self.onDelete?(self.msgId) }
        contentView.addSubview(failedOverlay)

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
            playIcon.centerXAnchor.constraint(equalTo: photo.centerXAnchor),
            playIcon.centerYAnchor.constraint(equalTo: photo.centerYAnchor),
            playIcon.widthAnchor.constraint(equalToConstant: 54),
            playIcon.heightAnchor.constraint(equalToConstant: 54),
            uploadOverlay.leadingAnchor.constraint(equalTo: photo.leadingAnchor),
            uploadOverlay.trailingAnchor.constraint(equalTo: photo.trailingAnchor),
            uploadOverlay.topAnchor.constraint(equalTo: photo.topAnchor),
            uploadOverlay.bottomAnchor.constraint(equalTo: photo.bottomAnchor),
            failedOverlay.leadingAnchor.constraint(equalTo: photo.leadingAnchor),
            failedOverlay.trailingAnchor.constraint(equalTo: photo.trailingAnchor),
            failedOverlay.topAnchor.constraint(equalTo: photo.topAnchor),
            failedOverlay.bottomAnchor.constraint(equalTo: photo.bottomAnchor),
            timeLabel.topAnchor.constraint(equalTo: photo.bottomAnchor, constant: 2),
            timeLabel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -4),
        ])
    }

    @objc private func handleTap() {
        guard !currentURL.isEmpty else { return }
        // 업로드 중이거나 아직 로컬(data:/blob:) 미리보기 상태면 재생 불가 — 탭 무시.
        // (AVPlayer 가 data URL 을 못 열어 "재생 안 됨" 으로 보이던 문제)
        if isUploading || currentURL.hasPrefix("data:") || currentURL.hasPrefix("blob:") { return }
        Haptics.tap()
        onTap?(currentURL)
    }

    func configure(_ m: NativeChatMessage) {
        msgId = m.id
        let url = m.imageUrl.isEmpty ? m.content : m.imageUrl
        if url != currentURL {
            currentURL = url
            photo.image = nil
            photo.backgroundColor = UIColor(white: 0.82, alpha: 1)
            loadPoster(url)
        }
        failedOverlay.isHidden = !m.uploadFailed
        let uploading = m.uploadProgress >= 0 && m.uploadProgress < 100
        isUploading = uploading
        uploadOverlay.isHidden = !uploading || m.uploadFailed
        playIcon.isHidden = uploading || m.uploadFailed   // 업로드 중/실패 시 재생버튼 숨김
        if uploading { uploadOverlay.update(progress: m.uploadProgress, totalBytes: m.uploadBytesTotal) }
        photo.alpha = (uploading || m.uploadFailed) ? 1.0 : (m.pending ? 0.6 : 1.0)
        let reactionPrefix = m.reaction.isEmpty ? "" : "\(m.reaction) "
        timeLabel.text = reactionPrefix + NativeChatVideoCell.formatTime(m.createdAt)

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

    private func loadPoster(_ urlString: String) {
        let trimmed = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        // data:video 는 포스터 생성 불가 → 회색 배경 + 재생아이콘만 유지(곧 서버 /uploads URL 로 교체됨)
        if trimmed.hasPrefix("data:") || trimmed.hasPrefix("blob:") { return }
        let full: String
        if trimmed.hasPrefix("http") { full = trimmed }
        else if trimmed.hasPrefix("/uploads/") { full = "\(NativeChatVideoCell.mediaBase)\(trimmed)" }
        else if trimmed.hasPrefix("/") { full = "https://freetiful.com\(trimmed)" }
        else { full = "https://freetiful.com/\(trimmed)" }

        if let cached = NativeChatVideoCell.posterCache[full] { photo.image = cached; return }
        guard let url = URL(string: full) else { return }
        let want = currentURL
        // 원격(/uploads) 자산은 동기 copyCGImage 가 트랙 미로딩으로 nil 나기 일쑤 →
        // 트랙을 비동기 로딩하는 generateCGImageAsynchronously(iOS16+) 로 생성. 허용오차를 둬 키프레임 빨리 잡음.
        let asset = AVURLAsset(url: url, options: [AVURLAssetPreferPreciseDurationAndTimingKey: false])
        let gen = AVAssetImageGenerator(asset: asset)
        gen.appliesPreferredTrackTransform = true
        gen.maximumSize = CGSize(width: 440, height: 440)
        gen.requestedTimeToleranceBefore = CMTime(seconds: 1.5, preferredTimescale: 600)
        gen.requestedTimeToleranceAfter = CMTime(seconds: 1.5, preferredTimescale: 600)
        let time = CMTime(seconds: 0.0, preferredTimescale: 600)
        let apply: (CGImage?) -> Void = { [weak self] cg in
            let img = cg.map { UIImage(cgImage: $0) }
            DispatchQueue.main.async {
                guard let self = self else { return }
                if let img = img { NativeChatVideoCell.posterCache[full] = img }
                if self.currentURL == want, let img = img { self.photo.image = img }
            }
        }
        if #available(iOS 16.0, *) {
            gen.generateCGImageAsynchronously(for: time) { cg, _, _ in apply(cg) }
        } else {
            DispatchQueue.global(qos: .userInitiated).async {
                apply(try? gen.copyCGImage(at: time, actualTime: nil))
            }
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

// MARK: - 파일 말풍선 셀 (문서 아이콘 + 파일명, 탭 → 열기)
final class NativeChatFileCell: UITableViewCell {
    var onTap: ((String, String) -> Void)?
    private let bubble = UIView()
    private let icon = UIImageView()
    private let nameLabel = UILabel()
    private let timeLabel = UILabel()
    private var fileURL = ""
    private var fileDisplayName = ""
    private var leadingC: NSLayoutConstraint!
    private var trailingC: NSLayoutConstraint!
    private var timeLeadingC: NSLayoutConstraint!
    private var timeTrailingC: NSLayoutConstraint!

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
        bubble.layer.cornerRadius = 20
        bubble.layer.cornerCurve = .continuous
        bubble.isUserInteractionEnabled = true
        bubble.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(handleTap)))
        contentView.addSubview(bubble)

        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.image = UIImage(systemName: "doc.fill")
        icon.contentMode = .scaleAspectFit
        icon.setContentHuggingPriority(.required, for: .horizontal)
        icon.setContentCompressionResistancePriority(.required, for: .horizontal)
        bubble.addSubview(icon)

        nameLabel.translatesAutoresizingMaskIntoConstraints = false
        nameLabel.font = .systemFont(ofSize: 15, weight: .medium)
        nameLabel.numberOfLines = 2
        bubble.addSubview(nameLabel)

        timeLabel.translatesAutoresizingMaskIntoConstraints = false
        timeLabel.font = .systemFont(ofSize: 10.5)
        timeLabel.textColor = UIColor(white: 0.6, alpha: 1)
        contentView.addSubview(timeLabel)

        leadingC = bubble.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 14)
        trailingC = bubble.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -14)
        timeLeadingC = timeLabel.leadingAnchor.constraint(equalTo: bubble.leadingAnchor, constant: 2)
        timeTrailingC = timeLabel.trailingAnchor.constraint(equalTo: bubble.trailingAnchor, constant: -2)

        NSLayoutConstraint.activate([
            bubble.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 4),
            bubble.widthAnchor.constraint(lessThanOrEqualToConstant: 260),
            icon.leadingAnchor.constraint(equalTo: bubble.leadingAnchor, constant: 14),
            icon.centerYAnchor.constraint(equalTo: bubble.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 20),
            icon.heightAnchor.constraint(equalToConstant: 22),
            nameLabel.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 10),
            nameLabel.trailingAnchor.constraint(equalTo: bubble.trailingAnchor, constant: -14),
            nameLabel.topAnchor.constraint(equalTo: bubble.topAnchor, constant: 12),
            nameLabel.bottomAnchor.constraint(equalTo: bubble.bottomAnchor, constant: -12),
            timeLabel.topAnchor.constraint(equalTo: bubble.bottomAnchor, constant: 2),
            timeLabel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -4),
        ])
    }

    @objc private func handleTap() {
        guard !fileURL.isEmpty else { return }
        Haptics.tap()
        onTap?(fileURL, fileDisplayName)
    }

    func configure(_ m: NativeChatMessage) {
        fileURL = m.content
        fileDisplayName = m.fileName
        nameLabel.text = m.fileName.isEmpty ? "파일" : m.fileName
        if m.mine {
            bubble.backgroundColor = UIColor(red: 0.192, green: 0.502, blue: 0.969, alpha: 1) // #3180F7
            icon.tintColor = .white
            nameLabel.textColor = .white
        } else {
            bubble.backgroundColor = UIColor(red: 0.949, green: 0.953, blue: 0.961, alpha: 1) // #F2F3F5
            icon.tintColor = UIColor(red: 0.192, green: 0.502, blue: 0.969, alpha: 1) // #3180F7
            nameLabel.textColor = UIColor(white: 0.1, alpha: 1)
        }
        timeLabel.text = NativeChatFileCell.formatTime(m.createdAt)

        leadingC.isActive = false; trailingC.isActive = false
        timeLeadingC.isActive = false; timeTrailingC.isActive = false
        if m.mine { trailingC.isActive = true; timeTrailingC.isActive = true }
        else { leadingC.isActive = true; timeLeadingC.isActive = true }
    }

    private static func formatTime(_ iso: String) -> String {
        guard !iso.isEmpty else { return "" }
        let date = NativeChatBubbleCell.isoParserFrac.date(from: iso)
            ?? NativeChatBubbleCell.isoParser.date(from: iso)
        guard let date else { return "" }
        return NativeChatBubbleCell.timeFormatter.string(from: date)
    }
}

// MARK: - 견적서 카드 셀 (중앙 카드, 탭 → 결제)
final class NativeChatQuoteCell: UITableViewCell {
    var onTap: ((String) -> Void)?
    private var quotationId = ""
    private let card = UIView()
    private let photoWrap = UIView()
    private let photo = UIImageView()
    private let blue = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
    private let planPill = PaddingLabel()
    private let eventLabel = UILabel()
    private let amountLabel = UILabel()
    private let payBar = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
    private let payLabel = UILabel()
    private let statusChip = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
    private let statusLabel = UILabel()

    private static let amountFormatter: NumberFormatter = {
        let f = NumberFormatter(); f.numberStyle = .decimal; f.groupingSeparator = ","; return f
    }()

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier); setup()
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setup() {
        selectionStyle = .none
        backgroundColor = .clear; contentView.backgroundColor = .clear

        // 카드 컨테이너 제거 — 투명 (사진 + 텍스트만)
        card.translatesAutoresizingMaskIntoConstraints = false
        card.backgroundColor = .clear
        contentView.addSubview(card)

        // 사회자 프로필 사진 카드 (좌) — 살짝 기울인 3D 느낌 + 그림자
        photoWrap.translatesAutoresizingMaskIntoConstraints = false
        photoWrap.layer.shadowColor = UIColor.black.cgColor
        photoWrap.layer.shadowOpacity = 0.18; photoWrap.layer.shadowRadius = 10; photoWrap.layer.shadowOffset = CGSize(width: 0, height: 8)
        card.addSubview(photoWrap)
        // 자이로(디바이스 모션) 3D 틸트
        MotionTilt.shared.start()
        NotificationCenter.default.addObserver(self, selector: #selector(onMotion), name: .motionTilt, object: nil)
        applyTilt()
        photo.translatesAutoresizingMaskIntoConstraints = false
        photo.contentMode = .scaleAspectFill; photo.clipsToBounds = true
        photo.layer.cornerRadius = 14; photo.layer.cornerCurve = .continuous
        photo.backgroundColor = UIColor(white: 0.91, alpha: 1)
        photoWrap.addSubview(photo)

        // "견적서" 라벨
        planPill.font = .systemFont(ofSize: 12, weight: .bold)
        planPill.textColor = blue
        planPill.backgroundColor = blue.withAlphaComponent(0.10)
        planPill.layer.cornerRadius = 8; planPill.clipsToBounds = true
        planPill.inset = UIEdgeInsets(top: 3, left: 9, bottom: 3, right: 9)
        planPill.setContentHuggingPriority(.required, for: .horizontal)

        eventLabel.font = .systemFont(ofSize: 15, weight: .medium)
        eventLabel.textColor = UIColor(white: 0.1, alpha: 1); eventLabel.numberOfLines = 2

        amountLabel.font = .systemFont(ofSize: 20, weight: .bold)
        amountLabel.textColor = UIColor(white: 0.05, alpha: 1)

        // 결제 버튼 (글래스, 고객 최신 견적만)
        payBar.translatesAutoresizingMaskIntoConstraints = false
        payBar.layer.cornerRadius = 13; payBar.layer.cornerCurve = .continuous; payBar.clipsToBounds = true
        payBar.layer.borderWidth = 1; payBar.layer.borderColor = UIColor.white.withAlphaComponent(0.5).cgColor
        payBar.contentView.backgroundColor = UIColor(red: 44/255, green: 83/255, blue: 255/255, alpha: 0.55)
        payLabel.text = "결제하기"; payLabel.font = .systemFont(ofSize: 13.5, weight: .bold); payLabel.textColor = .white; payLabel.textAlignment = .center
        payLabel.translatesAutoresizingMaskIntoConstraints = false
        payBar.contentView.addSubview(payLabel)
        NSLayoutConstraint.activate([
            payLabel.topAnchor.constraint(equalTo: payBar.contentView.topAnchor, constant: 8),
            payLabel.bottomAnchor.constraint(equalTo: payBar.contentView.bottomAnchor, constant: -8),
            payLabel.leadingAnchor.constraint(equalTo: payBar.contentView.leadingAnchor, constant: 24),
            payLabel.trailingAnchor.constraint(equalTo: payBar.contentView.trailingAnchor, constant: -24),
        ])
        payBar.setContentHuggingPriority(.required, for: .horizontal)

        // 상태 칩 (결제 대기 중 / 만료된 견적) — 글래스
        statusChip.translatesAutoresizingMaskIntoConstraints = false
        statusChip.layer.cornerRadius = 14; statusChip.layer.cornerCurve = .continuous; statusChip.clipsToBounds = true
        statusChip.layer.borderWidth = 1; statusChip.layer.borderColor = UIColor.white.withAlphaComponent(0.5).cgColor
        statusLabel.font = .systemFont(ofSize: 12.5, weight: .bold); statusLabel.textAlignment = .center
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusChip.contentView.addSubview(statusLabel)
        NSLayoutConstraint.activate([
            statusLabel.topAnchor.constraint(equalTo: statusChip.contentView.topAnchor, constant: 7),
            statusLabel.bottomAnchor.constraint(equalTo: statusChip.contentView.bottomAnchor, constant: -7),
            statusLabel.leadingAnchor.constraint(equalTo: statusChip.contentView.leadingAnchor, constant: 14),
            statusLabel.trailingAnchor.constraint(equalTo: statusChip.contentView.trailingAnchor, constant: -14),
        ])
        statusChip.setContentHuggingPriority(.required, for: .horizontal)

        let rightStack = UIStackView(arrangedSubviews: [planPill, eventLabel, amountLabel, payBar, statusChip])
        rightStack.axis = .vertical; rightStack.spacing = 5; rightStack.alignment = .leading
        rightStack.setCustomSpacing(9, after: amountLabel)
        rightStack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(rightStack)

        NSLayoutConstraint.activate([
            card.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 6),
            card.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -6),
            card.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 14),
            card.trailingAnchor.constraint(lessThanOrEqualTo: contentView.trailingAnchor, constant: -40),
            card.widthAnchor.constraint(lessThanOrEqualToConstant: 330),
            photoWrap.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 6),
            photoWrap.topAnchor.constraint(equalTo: card.topAnchor, constant: 14),
            photoWrap.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -14),
            photoWrap.widthAnchor.constraint(equalToConstant: 100),
            photoWrap.heightAnchor.constraint(equalToConstant: 150),
            photo.topAnchor.constraint(equalTo: photoWrap.topAnchor),
            photo.bottomAnchor.constraint(equalTo: photoWrap.bottomAnchor),
            photo.leadingAnchor.constraint(equalTo: photoWrap.leadingAnchor),
            photo.trailingAnchor.constraint(equalTo: photoWrap.trailingAnchor),
            rightStack.leadingAnchor.constraint(equalTo: photoWrap.trailingAnchor, constant: 18),
            rightStack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -10),
            rightStack.centerYAnchor.constraint(equalTo: card.centerYAnchor),
            rightStack.topAnchor.constraint(greaterThanOrEqualTo: card.topAnchor, constant: 14),
            payBar.heightAnchor.constraint(equalToConstant: 36),
        ])

        let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap))
        card.addGestureRecognizer(tap); card.isUserInteractionEnabled = true
    }

    @objc private func handleTap() {
        guard !quotationId.isEmpty else { return }
        Haptics.tap(); onTap?(quotationId)
    }

    @objc private func onMotion() { applyTilt() }
    private func applyTilt() {
        let gain = 0.7
        let ry = (-14.0 * .pi / 180) + max(-0.55, min(0.55, MotionTilt.shared.roll)) * gain
        let rx = (5.0 * .pi / 180) - max(-0.55, min(0.55, MotionTilt.shared.pitch)) * gain
        var t = CATransform3DIdentity
        t.m34 = -1.0 / 760
        t = CATransform3DRotate(t, ry, 0, 1, 0)
        t = CATransform3DRotate(t, rx, 1, 0, 0)
        CATransaction.begin(); CATransaction.setDisableActions(true)
        photoWrap.layer.transform = t
        CATransaction.commit()
    }
    deinit { NotificationCenter.default.removeObserver(self) }

    func configure(_ m: NativeChatMessage) {
        quotationId = m.quotationId
        let amountStr = NativeChatQuoteCell.amountFormatter.string(from: NSNumber(value: m.quoteAmount)) ?? "\(m.quoteAmount)"
        amountLabel.text = "\(amountStr)원"
        eventLabel.text = m.quoteEventName.isEmpty ? "행사 진행" : m.quoteEventName
        planPill.text = "견적서"
        NativeChatImageLoader.load(m.quoteProImage, into: photo, fallback: NativeChatHeaderView.avatarPlaceholder)
        if m.mine {
            payBar.isHidden = true; statusChip.isHidden = false
            statusLabel.text = "결제 대기 중"
            statusLabel.textColor = UIColor(red: 0.78, green: 0.48, blue: 0.0, alpha: 1)
            statusChip.contentView.backgroundColor = UIColor(red: 1.0, green: 0.78, blue: 0.30, alpha: 0.28)
        } else if m.quoteIsLatest {
            statusChip.isHidden = true; payBar.isHidden = false
        } else {
            payBar.isHidden = true; statusChip.isHidden = false
            statusLabel.text = "만료된 견적"
            statusLabel.textColor = UIColor(white: 0.45, alpha: 1)
            statusChip.contentView.backgroundColor = UIColor(white: 0.6, alpha: 0.22)
        }
    }
}

// MARK: - 전체화면 이미지 뷰어 (탭하여 확대/줌/닫기)
final class NativeImageViewer: UIViewController, UIScrollViewDelegate {
    private let scrollView = UIScrollView()
    private let imageView = UIImageView()
    private let urlString: String

    init(url: String) {
        self.urlString = url
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .overFullScreen
        modalTransitionStyle = .crossDissolve
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        scrollView.frame = view.bounds
        scrollView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        scrollView.delegate = self
        scrollView.minimumZoomScale = 1
        scrollView.maximumZoomScale = 4
        scrollView.showsHorizontalScrollIndicator = false
        scrollView.showsVerticalScrollIndicator = false
        scrollView.contentInsetAdjustmentBehavior = .never
        view.addSubview(scrollView)

        imageView.frame = scrollView.bounds
        imageView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        imageView.contentMode = .scaleAspectFit
        scrollView.addSubview(imageView)
        NativeChatImageLoader.load(urlString, into: imageView, fallback: nil)

        let tap = UITapGestureRecognizer(target: self, action: #selector(dismissSelf))
        let dbl = UITapGestureRecognizer(target: self, action: #selector(doubleTap(_:)))
        dbl.numberOfTapsRequired = 2
        tap.require(toFail: dbl)
        scrollView.addGestureRecognizer(tap)
        scrollView.addGestureRecognizer(dbl)

        let close = UIButton(type: .system)
        close.setImage(UIImage(systemName: "xmark", withConfiguration: UIImage.SymbolConfiguration(pointSize: 17, weight: .bold)), for: .normal)
        close.tintColor = .white
        close.backgroundColor = UIColor(white: 0, alpha: 0.4)
        close.layer.cornerRadius = 20
        close.translatesAutoresizingMaskIntoConstraints = false
        close.addTarget(self, action: #selector(dismissSelf), for: .touchUpInside)
        view.addSubview(close)
        NSLayoutConstraint.activate([
            close.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            close.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            close.widthAnchor.constraint(equalToConstant: 40),
            close.heightAnchor.constraint(equalToConstant: 40),
        ])
    }

    func viewForZooming(in scrollView: UIScrollView) -> UIView? { imageView }
    @objc private func dismissSelf() { dismiss(animated: true) }
    @objc private func doubleTap(_ gr: UITapGestureRecognizer) {
        scrollView.setZoomScale(scrollView.zoomScale > 1 ? 1 : 2.5, animated: true)
    }
}

// MARK: - 시스템 안내 메시지 셀 (중앙 회색 텍스트)
final class NativeChatSystemCell: UITableViewCell {
    private let label = UILabel()

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        selectionStyle = .none
        backgroundColor = .clear
        contentView.backgroundColor = .clear
        label.translatesAutoresizingMaskIntoConstraints = false
        label.font = .systemFont(ofSize: 12, weight: .medium)
        label.textColor = UIColor(white: 0.55, alpha: 1)
        label.textAlignment = .center
        label.numberOfLines = 0
        contentView.addSubview(label)
        NSLayoutConstraint.activate([
            label.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
            label.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -8),
            label.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 40),
            label.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -40),
        ])
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func configure(_ m: NativeChatMessage) {
        let text = !m.quoteTitle.isEmpty ? m.quoteTitle : (!m.content.isEmpty ? m.content : "안내 메시지")
        label.text = text
    }
}
