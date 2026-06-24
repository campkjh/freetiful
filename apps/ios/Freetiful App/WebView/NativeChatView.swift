import UIKit

// 네이티브 버튼/탭 클릭 햅틱 (시뮬레이터는 진동 미표현, 실기기에서 동작)
enum Haptics {
    static func tap() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    static func soft() { UIImpactFeedbackGenerator(style: .soft).impactOccurred() }
}

// 웹 채팅 상세(window.__freetifulChat.getState())에서 전달받는 상태
struct NativeChatState: Equatable {
    var name = ""
    var imageUrl = ""
    var online = false
    var statusText = ""
    var partnerIsPro = false
    var partnerRoleKnown = false
    var isPro = false
    var ready = false
    var muted = false
}

protocol NativeChatBarsDelegate: AnyObject {
    func chatBarsDidTapBack()
    func chatBarsDidTapProfile()
    func chatBarsDidTapMenu()
    func chatBarsDidSend(_ text: String)
    func chatBarsDidTapAttach()
    func chatBarsDidTapQuote()
    func chatBarsDidTapVoice()
    func chatBarsInvokeAttach(_ id: String)
    func chatBarsInvokeMenu(_ id: String, label: String, destructive: Bool)
}

// +/••• 네이티브 글래스 메뉴 항목 (웹 window.__freetifulChatActions 에서 전달)
struct ChatMenuItem {
    let id: String
    let label: String
    let sf: String
    let destructive: Bool
}

// 원격 이미지 로더 (메모리 + 디스크 캐시 — 세션 간 유지로 재다운로드 제거)
enum NativeChatImageLoader {
    private static var cache: [String: UIImage] = [:]
    private static var loadTokenKey: UInt8 = 0
    private static let diskDir: URL = {
        let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("ftImgCache", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()
    private static func stableKey(_ s: String) -> String {
        var h: UInt64 = 1469598103934665603
        for b in s.utf8 { h = (h ^ UInt64(b)) &* 1099511628211 }
        return String(h, radix: 16)
    }
    private static func diskPath(_ full: String) -> URL { diskDir.appendingPathComponent(stableKey(full)) }

    static func load(_ urlString: String, into imageView: UIImageView, fallback: UIImage?) {
        imageView.image = fallback
        let trimmed = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        // 셀 재사용 레이스 가드: imageView 가 요청한 최신 URL 토큰 기록 → 비동기 완료 때 토큰 일치 시에만 반영
        //   (재사용된 셀에 이전 in-flight 로드 결과가 덮어써 '엉뚱한 사진' 뜨던 버그 방지)
        objc_setAssociatedObject(imageView, &loadTokenKey, trimmed, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
        // 빈 값이거나 SVG(기본 프로필 이미지)면 네이티브 플레이스홀더 유지 — UIImage 는 SVG 디코드 불가
        guard !trimmed.isEmpty, !trimmed.lowercased().hasSuffix(".svg") else { return }
        // data: URI (배너 등 인라인 base64) — URLSession 미지원이라 직접 디코드
        if trimmed.hasPrefix("data:") {
            if let comma = trimmed.firstIndex(of: ","),
               let d = Data(base64Encoded: String(trimmed[trimmed.index(after: comma)...]).trimmingCharacters(in: .whitespacesAndNewlines)),
               let img = UIImage(data: d) {
                imageView.image = img
            }
            return
        }
        let full: String
        if trimmed.hasPrefix("http") {
            full = trimmed
        } else if trimmed.hasPrefix("/") {
            full = "https://freetiful.com\(trimmed)"
        } else {
            full = "https://freetiful.com/\(trimmed)"
        }
        if let cached = cache[full] {
            imageView.image = cached
            return
        }
        let path = diskPath(full)
        weak var weakIV = imageView
        DispatchQueue.global(qos: .userInitiated).async {
            // 1) 디스크 캐시 즉시
            if let data = try? Data(contentsOf: path), let image = UIImage(data: data) {
                DispatchQueue.main.async {
                    cache[full] = image
                    if let iv = weakIV, (objc_getAssociatedObject(iv, &loadTokenKey) as? String) == trimmed { iv.image = image }
                }
                return
            }
            // 2) 다운로드 → 디스크+메모리 저장
            guard let url = URL(string: full) else { return }
            URLSession.shared.dataTask(with: url) { data, _, _ in
                guard let data = data, let image = UIImage(data: data) else { return }
                try? data.write(to: path, options: .atomic)
                DispatchQueue.main.async {
                    cache[full] = image
                    if let iv = weakIV, (objc_getAssociatedObject(iv, &loadTokenKey) as? String) == trimmed { iv.image = image }
                }
            }.resume()
        }
    }

    // 셀 재사용 안전 버전 — completion 으로 이미지 전달(호출측이 토큰 검증). nil 이면 실패.
    static func fetch(_ urlString: String, _ completion: @escaping (UIImage?) -> Void) {
        let trimmed = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !trimmed.lowercased().hasSuffix(".svg") else { completion(nil); return }
        let full: String
        if trimmed.hasPrefix("http") { full = trimmed }
        else if trimmed.hasPrefix("/") { full = "https://freetiful.com\(trimmed)" }
        else { full = "https://freetiful.com/\(trimmed)" }
        if let cached = cache[full] { completion(cached); return }
        let path = diskPath(full)
        DispatchQueue.global(qos: .userInitiated).async {
            if let data = try? Data(contentsOf: path), let image = UIImage(data: data) {
                DispatchQueue.main.async { cache[full] = image; completion(image) }
                return
            }
            guard let url = URL(string: full) else { DispatchQueue.main.async { completion(nil) }; return }
            URLSession.shared.dataTask(with: url) { data, _, _ in
                guard let data = data, let image = UIImage(data: data) else { DispatchQueue.main.async { completion(nil) }; return }
                try? data.write(to: path, options: .atomic)
                DispatchQueue.main.async { cache[full] = image; completion(image) }
            }.resume()
        }
    }
}

// MARK: - 네이티브 Liquid Glass 캡슐
final class GlassPill: UIVisualEffectView {
    init(corner: CGFloat) {
        super.init(effect: LiquidGlassEffectFactory.controlEffect())
        translatesAutoresizingMaskIntoConstraints = false
        clipsToBounds = true
        layer.cornerRadius = corner
        layer.cornerCurve = .continuous
        layer.borderWidth = 0.5
        layer.borderColor = UIColor.white.withAlphaComponent(0.22).cgColor
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setContent(_ v: UIView, insets: UIEdgeInsets = .zero) {
        v.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(v)
        NSLayoutConstraint.activate([
            v.topAnchor.constraint(equalTo: contentView.topAnchor, constant: insets.top),
            v.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: insets.left),
            v.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -insets.right),
            v.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -insets.bottom),
        ])
    }
}

// MARK: - 네이티브 채팅 헤더 (플로팅 글래스: 뒤로 / 프로필 / 메뉴)
final class NativeChatHeaderView: UIView {
    weak var delegate: NativeChatBarsDelegate?

    private let backPill = GlassPill(corner: 21)
    private let profilePill = GlassPill(corner: 21)
    private let menuPill = GlassPill(corner: 21)

    private let backButton = UIButton(type: .system)
    private let menuButton = UIButton(type: .system)
    private let profileButton = UIButton(type: .system)
    private let avatar = UIImageView()
    private let onlineDot = UIView()
    private let nameLabel = UILabel()
    private let roleBadge = UILabel()
    private let statusLabel = UILabel()

    private var currentImageURL = ""

    static let avatarPlaceholder: UIImage? = UIImage(
        systemName: "person.crop.circle.fill",
        withConfiguration: UIImage.SymbolConfiguration(pointSize: 30, weight: .regular)
    )?.withTintColor(UIColor(white: 0.78, alpha: 1), renderingMode: .alwaysOriginal)

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
        backgroundColor = .clear

        // 뒤로가기
        var backCfg = UIButton.Configuration.plain()
        backCfg.image = UIImage(systemName: "chevron.left", withConfiguration: UIImage.SymbolConfiguration(pointSize: 18, weight: .semibold))
        backCfg.baseForegroundColor = UIColor(white: 0.13, alpha: 1)
        backButton.configuration = backCfg
        backButton.addTarget(self, action: #selector(tapBack), for: .touchUpInside)
        addSubview(backPill)
        backPill.setContent(backButton)

        // 메뉴
        var menuCfg = UIButton.Configuration.plain()
        menuCfg.image = UIImage(systemName: "ellipsis", withConfiguration: UIImage.SymbolConfiguration(pointSize: 18, weight: .semibold))
        menuCfg.baseForegroundColor = UIColor(white: 0.13, alpha: 1)
        menuButton.configuration = menuCfg
        addSubview(menuPill)
        menuPill.setContent(menuButton)

        // 프로필(아바타+이름+역할+상태)
        addSubview(profilePill)
        profileButton.addTarget(self, action: #selector(tapProfile), for: .touchUpInside)
        profileButton.translatesAutoresizingMaskIntoConstraints = false
        profilePill.setContent(profileButton)

        avatar.translatesAutoresizingMaskIntoConstraints = false
        avatar.contentMode = .scaleAspectFill
        avatar.clipsToBounds = true
        avatar.layer.cornerRadius = 15
        avatar.backgroundColor = UIColor(white: 0.9, alpha: 1)
        avatar.image = Self.avatarPlaceholder
        avatar.isUserInteractionEnabled = false
        profileButton.addSubview(avatar)

        onlineDot.translatesAutoresizingMaskIntoConstraints = false
        onlineDot.backgroundColor = UIColor(red: 0.20, green: 0.78, blue: 0.35, alpha: 1)
        onlineDot.layer.cornerRadius = 4.5
        onlineDot.layer.borderWidth = 2
        onlineDot.layer.borderColor = UIColor.white.cgColor
        onlineDot.isHidden = true
        onlineDot.isUserInteractionEnabled = false
        profileButton.addSubview(onlineDot)

        nameLabel.translatesAutoresizingMaskIntoConstraints = false
        nameLabel.font = .systemFont(ofSize: 15, weight: .bold)
        nameLabel.textColor = UIColor(white: 0.1, alpha: 1)
        nameLabel.isUserInteractionEnabled = false
        nameLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        profileButton.addSubview(nameLabel)

        roleBadge.translatesAutoresizingMaskIntoConstraints = false
        roleBadge.font = .systemFont(ofSize: 9, weight: .bold)
        roleBadge.textAlignment = .center
        roleBadge.layer.cornerRadius = 4
        roleBadge.clipsToBounds = true
        roleBadge.isHidden = true
        roleBadge.isUserInteractionEnabled = false
        roleBadge.setContentCompressionResistancePriority(.required, for: .horizontal)
        profileButton.addSubview(roleBadge)

        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.font = .systemFont(ofSize: 10.5, weight: .regular)
        statusLabel.textColor = UIColor(white: 0.5, alpha: 1)
        statusLabel.isUserInteractionEnabled = false
        profileButton.addSubview(statusLabel)

        NSLayoutConstraint.activate([
            // 펄들은 헤더 하단(상태바 아래)에 떠 있음
            backPill.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            backPill.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -6),
            backPill.widthAnchor.constraint(equalToConstant: 42),
            backPill.heightAnchor.constraint(equalToConstant: 42),

            menuPill.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            menuPill.centerYAnchor.constraint(equalTo: backPill.centerYAnchor),
            menuPill.widthAnchor.constraint(equalToConstant: 42),
            menuPill.heightAnchor.constraint(equalToConstant: 42),

            profilePill.leadingAnchor.constraint(equalTo: backPill.trailingAnchor, constant: 8),
            profilePill.trailingAnchor.constraint(equalTo: menuPill.leadingAnchor, constant: -8),
            profilePill.centerYAnchor.constraint(equalTo: backPill.centerYAnchor),
            profilePill.heightAnchor.constraint(equalToConstant: 42),

            avatar.leadingAnchor.constraint(equalTo: profileButton.leadingAnchor, constant: 6),
            avatar.centerYAnchor.constraint(equalTo: profileButton.centerYAnchor),
            avatar.widthAnchor.constraint(equalToConstant: 30),
            avatar.heightAnchor.constraint(equalToConstant: 30),

            onlineDot.trailingAnchor.constraint(equalTo: avatar.trailingAnchor),
            onlineDot.bottomAnchor.constraint(equalTo: avatar.bottomAnchor),
            onlineDot.widthAnchor.constraint(equalToConstant: 9),
            onlineDot.heightAnchor.constraint(equalToConstant: 9),

            nameLabel.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 8),
            nameLabel.topAnchor.constraint(equalTo: avatar.topAnchor, constant: 0),

            roleBadge.leadingAnchor.constraint(equalTo: nameLabel.trailingAnchor, constant: 5),
            roleBadge.centerYAnchor.constraint(equalTo: nameLabel.centerYAnchor),
            roleBadge.heightAnchor.constraint(equalToConstant: 14),
            roleBadge.trailingAnchor.constraint(lessThanOrEqualTo: profileButton.trailingAnchor, constant: -8),

            statusLabel.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 8),
            statusLabel.topAnchor.constraint(equalTo: nameLabel.bottomAnchor, constant: 1),
            statusLabel.trailingAnchor.constraint(lessThanOrEqualTo: profileButton.trailingAnchor, constant: -8),
        ])
    }

    func apply(_ s: NativeChatState) {
        nameLabel.text = s.name.isEmpty ? "채팅" : s.name
        statusLabel.text = s.statusText
        onlineDot.isHidden = !s.online

        if s.partnerRoleKnown {
            roleBadge.isHidden = false
            roleBadge.text = " \(s.partnerIsPro ? "사회자" : "고객") "
            roleBadge.textColor = s.partnerIsPro ? UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1) : UIColor(white: 0.42, alpha: 1)
            roleBadge.backgroundColor = s.partnerIsPro ? UIColor(red: 0.91, green: 0.95, blue: 1.0, alpha: 1) : UIColor(white: 0.93, alpha: 1)
        } else {
            roleBadge.isHidden = true
        }

        if s.imageUrl != currentImageURL {
            currentImageURL = s.imageUrl
            NativeChatImageLoader.load(s.imageUrl, into: avatar, fallback: Self.avatarPlaceholder)
        }
    }

    // ••• 네이티브 글래스 메뉴 (iOS 26 UIMenu = 글래스/그룹 포커스)
    func setMenuItems(_ items: [ChatMenuItem]) {
        guard !items.isEmpty else {
            menuButton.menu = nil
            menuButton.showsMenuAsPrimaryAction = false
            return
        }
        let actions = items.map { item -> UIAction in
            UIAction(title: item.label,
                     image: UIImage(systemName: item.sf),
                     attributes: item.destructive ? .destructive : []) { [weak self] _ in
                self?.delegate?.chatBarsInvokeMenu(item.id, label: item.label, destructive: item.destructive)
            }
        }
        menuButton.menu = UIMenu(title: "", children: actions)
        menuButton.showsMenuAsPrimaryAction = true
    }

    @objc private func tapBack() { Haptics.tap(); delegate?.chatBarsDidTapBack() }
    @objc private func tapProfile() { Haptics.tap(); delegate?.chatBarsDidTapProfile() }
}

// MARK: - 네이티브 채팅 입력바 (플로팅 글래스: 첨부 / 견적 / 입력+전송·음성)
final class NativeChatInputBar: UIView, UITextViewDelegate {
    weak var delegate: NativeChatBarsDelegate?

    private let row = UIStackView()
    private let attachPill = GlassPill(corner: 23)
    private let quotePill = GlassPill(corner: 23)
    private let fieldPill = GlassPill(corner: 23)

    private let attachButton = UIButton(type: .system)
    private let quoteButton = UIButton(type: .system)
    let textView = UITextView()
    private let placeholderLabel = UILabel()
    private let sendButton = UIButton(type: .system)
    private let voiceButton = UIButton(type: .system)
    private var fieldHeightC: NSLayoutConstraint!
    private let minFieldHeight: CGFloat = 46
    private let maxFieldHeight: CGFloat = 122  // 약 5줄까지 늘어난 뒤 내부 스크롤

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
        backgroundColor = UIColor(red: 0.969, green: 0.973, blue: 0.980, alpha: 1)  // 불투명 — 뒤 웹뷰 비침 방지 (iOS 네이티브만)

        // 첨부 (+)
        var attachCfg = UIButton.Configuration.plain()
        attachCfg.image = UIImage(systemName: "plus", withConfiguration: UIImage.SymbolConfiguration(pointSize: 20, weight: .semibold))
        attachCfg.baseForegroundColor = UIColor(white: 0.25, alpha: 1)
        attachButton.configuration = attachCfg
        attachPill.setContent(attachButton)

        // 견적 (사회자) — 글래스 캡슐 안에 파란 문서 아이콘 (아이콘 전용 = 폭 안정)
        var quoteCfg = UIButton.Configuration.plain()
        quoteCfg.image = UIImage(systemName: "doc.text.fill", withConfiguration: UIImage.SymbolConfiguration(pointSize: 19, weight: .semibold))
        quoteCfg.baseForegroundColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
        quoteButton.configuration = quoteCfg
        quoteButton.addTarget(self, action: #selector(tapQuote), for: .touchUpInside)
        quotePill.isHidden = true
        quotePill.setContent(quoteButton)

        // 입력 필드 (글래스 캡슐) — UITextView 로 멀티라인 자동높이(줄바꿈 시 height 증가)
        textView.translatesAutoresizingMaskIntoConstraints = false
        textView.font = .systemFont(ofSize: 16)
        textView.textColor = UIColor(white: 0.1, alpha: 1)
        textView.backgroundColor = .clear
        textView.delegate = self
        textView.isScrollEnabled = false
        textView.returnKeyType = .send
        textView.textContainerInset = UIEdgeInsets(top: 12, left: 0, bottom: 12, right: 0)
        textView.textContainer.lineFragmentPadding = 0
        fieldPill.contentView.addSubview(textView)

        placeholderLabel.translatesAutoresizingMaskIntoConstraints = false
        placeholderLabel.text = "메시지"
        placeholderLabel.font = .systemFont(ofSize: 16)
        placeholderLabel.textColor = UIColor(white: 0.6, alpha: 1)
        placeholderLabel.isUserInteractionEnabled = false
        fieldPill.contentView.addSubview(placeholderLabel)

        var sendCfg = UIButton.Configuration.filled()
        sendCfg.image = UIImage(systemName: "arrow.up", withConfiguration: UIImage.SymbolConfiguration(pointSize: 16, weight: .bold))
        sendCfg.baseBackgroundColor = UIColor(white: 0.13, alpha: 1)
        sendCfg.baseForegroundColor = .white
        sendCfg.cornerStyle = .capsule
        sendButton.configuration = sendCfg
        sendButton.translatesAutoresizingMaskIntoConstraints = false
        sendButton.isHidden = true
        sendButton.addTarget(self, action: #selector(tapSend), for: .touchUpInside)
        fieldPill.contentView.addSubview(sendButton)

        var voiceCfg = UIButton.Configuration.plain()
        voiceCfg.image = UIImage(systemName: "mic.fill", withConfiguration: UIImage.SymbolConfiguration(pointSize: 17, weight: .regular))
        voiceCfg.baseForegroundColor = UIColor(white: 0.4, alpha: 1)
        voiceButton.configuration = voiceCfg
        voiceButton.translatesAutoresizingMaskIntoConstraints = false
        voiceButton.addTarget(self, action: #selector(tapVoice), for: .touchUpInside)
        fieldPill.contentView.addSubview(voiceButton)

        // 행 구성 — 입력창이 커지면 + / 견적 / 전송 버튼은 하단 정렬 유지
        row.translatesAutoresizingMaskIntoConstraints = false
        row.axis = .horizontal
        row.alignment = .bottom
        row.spacing = 8
        row.addArrangedSubview(attachPill)
        row.addArrangedSubview(quotePill)
        row.addArrangedSubview(fieldPill)
        addSubview(row)

        fieldPill.setContentHuggingPriority(.defaultLow, for: .horizontal)
        fieldPill.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        fieldHeightC = fieldPill.heightAnchor.constraint(equalToConstant: minFieldHeight)

        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            row.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            row.topAnchor.constraint(equalTo: topAnchor, constant: 6),
            row.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.bottomAnchor, constant: -6),

            attachPill.widthAnchor.constraint(equalToConstant: 46),
            attachPill.heightAnchor.constraint(equalToConstant: 46),
            quotePill.widthAnchor.constraint(equalToConstant: 46),
            quotePill.heightAnchor.constraint(equalToConstant: 46),
            fieldHeightC,

            textView.leadingAnchor.constraint(equalTo: fieldPill.contentView.leadingAnchor, constant: 18),
            textView.topAnchor.constraint(equalTo: fieldPill.contentView.topAnchor),
            textView.bottomAnchor.constraint(equalTo: fieldPill.contentView.bottomAnchor),
            textView.trailingAnchor.constraint(equalTo: sendButton.leadingAnchor, constant: -6),

            placeholderLabel.leadingAnchor.constraint(equalTo: textView.leadingAnchor),
            placeholderLabel.centerYAnchor.constraint(equalTo: fieldPill.contentView.centerYAnchor),

            sendButton.trailingAnchor.constraint(equalTo: fieldPill.contentView.trailingAnchor, constant: -5),
            sendButton.bottomAnchor.constraint(equalTo: fieldPill.contentView.bottomAnchor, constant: -5),
            sendButton.widthAnchor.constraint(equalToConstant: 36),
            sendButton.heightAnchor.constraint(equalToConstant: 36),

            voiceButton.trailingAnchor.constraint(equalTo: fieldPill.contentView.trailingAnchor, constant: -7),
            voiceButton.bottomAnchor.constraint(equalTo: fieldPill.contentView.bottomAnchor, constant: -7),
            voiceButton.widthAnchor.constraint(equalToConstant: 32),
            voiceButton.heightAnchor.constraint(equalToConstant: 32),
        ])

        updateSendVoiceVisibility()
    }

    func apply(_ s: NativeChatState) {
        quotePill.isHidden = !s.isPro
    }

    // + 네이티브 글래스 메뉴 (iOS 26 UIMenu = 글래스/그룹 포커스)
    func setAttachItems(_ items: [ChatMenuItem]) {
        guard !items.isEmpty else {
            attachButton.menu = nil
            attachButton.showsMenuAsPrimaryAction = false
            return
        }
        let actions = items.map { item -> UIAction in
            UIAction(title: item.label, image: UIImage(systemName: item.sf)) { [weak self] _ in
                self?.delegate?.chatBarsInvokeAttach(item.id)
            }
        }
        attachButton.menu = UIMenu(title: "", children: actions)
        attachButton.showsMenuAsPrimaryAction = true
    }

    private func updateSendVoiceVisibility() {
        let hasText = !textView.text.trimmingCharacters(in: .whitespaces).isEmpty
        sendButton.isHidden = !hasText
        voiceButton.isHidden = hasText
        placeholderLabel.isHidden = hasText
    }

    // 내용에 맞춰 입력창 높이 재계산 (줄바꿈 시 커지고, 최대 높이 넘으면 내부 스크롤)
    private func recalcHeight() {
        let w = textView.bounds.width
        guard w > 0 else { return }
        let fit = textView.sizeThatFits(CGSize(width: w, height: .greatestFiniteMagnitude)).height
        let target = min(max(ceil(fit), minFieldHeight), maxFieldHeight)
        textView.isScrollEnabled = fit > maxFieldHeight
        if abs(fieldHeightC.constant - target) > 0.5 {
            fieldHeightC.constant = target
            UIView.animate(withDuration: 0.12) { self.superview?.layoutIfNeeded() }
        }
    }

    func textViewDidChange(_ textView: UITextView) {
        updateSendVoiceVisibility()
        recalcHeight()
    }

    // Return 키 = 전송 (줄바꿈은 가로폭 초과 시 자동), Send 버튼도 동일
    func textView(_ textView: UITextView, shouldChangeTextIn range: NSRange, replacementText text: String) -> Bool {
        if text == "\n" { commitSend(); return false }
        return true
    }

    @objc private func tapSend() { commitSend() }
    @objc private func tapQuote() { Haptics.tap(); delegate?.chatBarsDidTapQuote() }
    @objc private func tapVoice() { Haptics.tap(); delegate?.chatBarsDidTapVoice() }

    private func commitSend() {
        let text = textView.text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        Haptics.tap()
        delegate?.chatBarsDidSend(text)
        textView.text = ""
        updateSendVoiceVisibility()
        recalcHeight()
    }
}

// MARK: - 고객 견적 정보 모달 (사회자가 채팅방 ⋮ → '고객 정보 보기')
// 견적서 작성 폼을 닫아도 고객 요청 정보를 다시 볼 수 있도록 ViewController 가 캐시한 Info 로 표시.
final class NativeCustomerRequestModal: UIViewController {
    struct Info {
        var customerName = ""; var customerImage = ""
        var eventName = ""; var eventDate = ""; var eventTime = ""
        var eventLocation = ""; var planLabel = ""; var categoryName = ""
        var memo = ""; var latestAmount = 0
    }
    private let info: Info
    private let dimView = UIView()
    private let card = UIVisualEffectView(effect: LiquidGlassEffectFactory.navigationEffect())

    init(info: Info) {
        self.info = info
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .overFullScreen
        modalTransitionStyle = .crossDissolve
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear

        dimView.translatesAutoresizingMaskIntoConstraints = false
        dimView.backgroundColor = UIColor.black.withAlphaComponent(0.4)
        dimView.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(close)))
        view.addSubview(dimView)

        card.translatesAutoresizingMaskIntoConstraints = false
        card.clipsToBounds = true
        card.layer.cornerRadius = 24
        card.layer.cornerCurve = .continuous
        card.layer.borderWidth = 0.5
        card.layer.borderColor = UIColor.white.withAlphaComponent(0.3).cgColor
        view.addSubview(card)

        let whiteTint = UIView()
        whiteTint.translatesAutoresizingMaskIntoConstraints = false
        whiteTint.backgroundColor = UIColor.white.withAlphaComponent(0.32)
        whiteTint.isUserInteractionEnabled = false
        card.contentView.addSubview(whiteTint)

        let title = UILabel()
        title.text = "고객 견적 정보"
        title.font = .systemFont(ofSize: 18, weight: .bold)
        title.textColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)

        let name = UILabel()
        name.text = info.customerName.isEmpty ? "고객" : info.customerName
        name.font = .systemFont(ofSize: 16, weight: .semibold)
        name.textColor = UIColor(white: 0.1, alpha: 1)

        func row(_ icon: String, _ value: String) -> UIView? {
            let v = value.trimmingCharacters(in: .whitespaces)
            guard !v.isEmpty else { return nil }
            let l = UILabel()
            l.text = "\(icon)  \(v)"
            l.font = .systemFont(ofSize: 14.5)
            l.textColor = UIColor(white: 0.28, alpha: 1)
            l.numberOfLines = 0
            return l
        }
        let dateLine = [info.eventDate, info.eventTime].filter { !$0.isEmpty }.joined(separator: " ")
        let amountStr = info.latestAmount > 0 ? "최근 견적 \(NumberFormatter.localizedString(from: NSNumber(value: info.latestAmount), number: .decimal))원" : ""
        var rows: [UIView] = [title, name]
        rows += [
            row("📋", info.eventName),
            row("📅", dateLine.isEmpty ? "일정 미정" : dateLine),
            row("📍", info.eventLocation.isEmpty ? "장소 미정" : info.eventLocation),
            row("🏷", info.planLabel),
            row("🗂", info.categoryName),
            row("✏️", info.memo),
            row("💰", amountStr),
        ].compactMap { $0 }

        let closeBtn = UIButton(type: .system)
        var cc = UIButton.Configuration.gray()
        cc.title = "닫기"
        cc.cornerStyle = .large
        cc.baseForegroundColor = UIColor(white: 0.2, alpha: 1)
        cc.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16)
        closeBtn.configuration = cc
        closeBtn.addTarget(self, action: #selector(close), for: .touchUpInside)
        rows.append(closeBtn)

        let col = UIStackView(arrangedSubviews: rows)
        col.axis = .vertical
        col.spacing = 11
        col.setCustomSpacing(4, after: title)
        col.setCustomSpacing(16, after: name)
        col.translatesAutoresizingMaskIntoConstraints = false
        card.contentView.addSubview(col)

        NSLayoutConstraint.activate([
            dimView.topAnchor.constraint(equalTo: view.topAnchor),
            dimView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            dimView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            dimView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            card.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            card.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            card.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 28),
            card.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -28),
            whiteTint.topAnchor.constraint(equalTo: card.contentView.topAnchor),
            whiteTint.leadingAnchor.constraint(equalTo: card.contentView.leadingAnchor),
            whiteTint.trailingAnchor.constraint(equalTo: card.contentView.trailingAnchor),
            whiteTint.bottomAnchor.constraint(equalTo: card.contentView.bottomAnchor),
            col.topAnchor.constraint(equalTo: card.contentView.topAnchor, constant: 22),
            col.bottomAnchor.constraint(equalTo: card.contentView.bottomAnchor, constant: -20),
            col.leadingAnchor.constraint(equalTo: card.contentView.leadingAnchor, constant: 20),
            col.trailingAnchor.constraint(equalTo: card.contentView.trailingAnchor, constant: -20),
        ])
    }

    @objc private func close() { dismiss(animated: true) }
}
