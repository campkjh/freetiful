import UIKit

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
}

protocol NativeChatBarsDelegate: AnyObject {
    func chatBarsDidTapBack()
    func chatBarsDidTapProfile()
    func chatBarsDidTapMenu()
    func chatBarsDidSend(_ text: String)
    func chatBarsDidTapAttach()
    func chatBarsDidTapQuote()
    func chatBarsDidTapVoice()
}

// 간단한 원격 이미지 로더 (프로필 아바타용)
enum NativeChatImageLoader {
    private static var cache: [String: UIImage] = [:]

    static func load(_ urlString: String, into imageView: UIImageView, fallback: UIImage?) {
        imageView.image = fallback
        let trimmed = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        // 빈 값이거나 SVG(기본 프로필 이미지)면 네이티브 플레이스홀더 유지 — UIImage 는 SVG 디코드 불가
        guard !trimmed.isEmpty, !trimmed.lowercased().hasSuffix(".svg") else { return }
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
        guard let url = URL(string: full) else { return }
        URLSession.shared.dataTask(with: url) { data, _, _ in
            guard let data = data, let image = UIImage(data: data) else { return }
            DispatchQueue.main.async {
                cache[full] = image
                imageView.image = image
            }
        }.resume()
    }
}

// MARK: - 네이티브 채팅 헤더 (뒤로가기 / 프로필 / 메뉴)
final class NativeChatHeaderView: UIView {
    weak var delegate: NativeChatBarsDelegate?

    private let blur = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterial))
    private let backButton = UIButton(type: .system)
    private let profileButton = UIButton(type: .system)
    private let avatar = UIImageView()
    private let onlineDot = UIView()
    private let nameLabel = UILabel()
    private let roleBadge = UILabel()
    private let statusLabel = UILabel()
    private let menuButton = UIButton(type: .system)
    private let hairline = UIView()

    private var currentImageURL = ""

    static let avatarPlaceholder: UIImage? = UIImage(
        systemName: "person.crop.circle.fill",
        withConfiguration: UIImage.SymbolConfiguration(pointSize: 34, weight: .regular)
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

        blur.translatesAutoresizingMaskIntoConstraints = false
        addSubview(blur)

        hairline.translatesAutoresizingMaskIntoConstraints = false
        hairline.backgroundColor = UIColor(white: 0, alpha: 0.08)
        addSubview(hairline)

        var backCfg = UIButton.Configuration.plain()
        backCfg.image = UIImage(systemName: "chevron.left", withConfiguration: UIImage.SymbolConfiguration(pointSize: 19, weight: .semibold))
        backCfg.baseForegroundColor = UIColor(white: 0.13, alpha: 1)
        backCfg.contentInsets = .zero
        backButton.configuration = backCfg
        backButton.translatesAutoresizingMaskIntoConstraints = false
        backButton.addTarget(self, action: #selector(tapBack), for: .touchUpInside)
        addSubview(backButton)

        var menuCfg = UIButton.Configuration.plain()
        menuCfg.image = UIImage(systemName: "ellipsis", withConfiguration: UIImage.SymbolConfiguration(pointSize: 19, weight: .semibold))
        menuCfg.baseForegroundColor = UIColor(white: 0.13, alpha: 1)
        menuCfg.contentInsets = .zero
        menuButton.configuration = menuCfg
        menuButton.translatesAutoresizingMaskIntoConstraints = false
        menuButton.addTarget(self, action: #selector(tapMenu), for: .touchUpInside)
        addSubview(menuButton)

        profileButton.translatesAutoresizingMaskIntoConstraints = false
        profileButton.addTarget(self, action: #selector(tapProfile), for: .touchUpInside)
        addSubview(profileButton)

        avatar.translatesAutoresizingMaskIntoConstraints = false
        avatar.contentMode = .scaleAspectFill
        avatar.clipsToBounds = true
        avatar.layer.cornerRadius = 18
        avatar.backgroundColor = UIColor(white: 0.92, alpha: 1)
        avatar.isUserInteractionEnabled = false
        avatar.image = Self.avatarPlaceholder
        profileButton.addSubview(avatar)

        onlineDot.translatesAutoresizingMaskIntoConstraints = false
        onlineDot.backgroundColor = UIColor(red: 0.20, green: 0.78, blue: 0.35, alpha: 1)
        onlineDot.layer.cornerRadius = 5
        onlineDot.layer.borderWidth = 2
        onlineDot.layer.borderColor = UIColor.white.cgColor
        onlineDot.isHidden = true
        onlineDot.isUserInteractionEnabled = false
        profileButton.addSubview(onlineDot)

        nameLabel.translatesAutoresizingMaskIntoConstraints = false
        nameLabel.font = .systemFont(ofSize: 16, weight: .bold)
        nameLabel.textColor = UIColor(white: 0.1, alpha: 1)
        nameLabel.isUserInteractionEnabled = false
        profileButton.addSubview(nameLabel)

        roleBadge.translatesAutoresizingMaskIntoConstraints = false
        roleBadge.font = .systemFont(ofSize: 10, weight: .bold)
        roleBadge.textAlignment = .center
        roleBadge.layer.cornerRadius = 4
        roleBadge.clipsToBounds = true
        roleBadge.isHidden = true
        roleBadge.isUserInteractionEnabled = false
        profileButton.addSubview(roleBadge)

        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.font = .systemFont(ofSize: 11, weight: .regular)
        statusLabel.textColor = UIColor(white: 0.55, alpha: 1)
        statusLabel.isUserInteractionEnabled = false
        profileButton.addSubview(statusLabel)

        NSLayoutConstraint.activate([
            blur.topAnchor.constraint(equalTo: topAnchor),
            blur.leadingAnchor.constraint(equalTo: leadingAnchor),
            blur.trailingAnchor.constraint(equalTo: trailingAnchor),
            blur.bottomAnchor.constraint(equalTo: bottomAnchor),

            hairline.leadingAnchor.constraint(equalTo: leadingAnchor),
            hairline.trailingAnchor.constraint(equalTo: trailingAnchor),
            hairline.bottomAnchor.constraint(equalTo: bottomAnchor),
            hairline.heightAnchor.constraint(equalToConstant: 0.5),

            backButton.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 6),
            backButton.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
            backButton.widthAnchor.constraint(equalToConstant: 40),
            backButton.heightAnchor.constraint(equalToConstant: 40),

            menuButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -10),
            menuButton.centerYAnchor.constraint(equalTo: backButton.centerYAnchor),
            menuButton.widthAnchor.constraint(equalToConstant: 40),
            menuButton.heightAnchor.constraint(equalToConstant: 40),

            profileButton.leadingAnchor.constraint(equalTo: backButton.trailingAnchor, constant: 4),
            profileButton.trailingAnchor.constraint(equalTo: menuButton.leadingAnchor, constant: -4),
            profileButton.topAnchor.constraint(equalTo: backButton.topAnchor),
            profileButton.bottomAnchor.constraint(equalTo: backButton.bottomAnchor),

            avatar.leadingAnchor.constraint(equalTo: profileButton.leadingAnchor, constant: 2),
            avatar.centerYAnchor.constraint(equalTo: profileButton.centerYAnchor),
            avatar.widthAnchor.constraint(equalToConstant: 36),
            avatar.heightAnchor.constraint(equalToConstant: 36),

            onlineDot.trailingAnchor.constraint(equalTo: avatar.trailingAnchor),
            onlineDot.bottomAnchor.constraint(equalTo: avatar.bottomAnchor),
            onlineDot.widthAnchor.constraint(equalToConstant: 10),
            onlineDot.heightAnchor.constraint(equalToConstant: 10),

            nameLabel.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 10),
            nameLabel.topAnchor.constraint(equalTo: avatar.topAnchor, constant: 1),

            roleBadge.leadingAnchor.constraint(equalTo: nameLabel.trailingAnchor, constant: 5),
            roleBadge.centerYAnchor.constraint(equalTo: nameLabel.centerYAnchor),
            roleBadge.heightAnchor.constraint(equalToConstant: 15),
            roleBadge.trailingAnchor.constraint(lessThanOrEqualTo: profileButton.trailingAnchor),

            statusLabel.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 10),
            statusLabel.topAnchor.constraint(equalTo: nameLabel.bottomAnchor, constant: 1),
            statusLabel.trailingAnchor.constraint(lessThanOrEqualTo: profileButton.trailingAnchor),
        ])

        nameLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
    }

    func apply(_ s: NativeChatState) {
        nameLabel.text = s.name.isEmpty ? "채팅" : s.name
        statusLabel.text = s.statusText
        onlineDot.isHidden = !s.online

        if s.partnerRoleKnown {
            roleBadge.isHidden = false
            roleBadge.text = "  \(s.partnerIsPro ? "사회자" : "고객")  "
            roleBadge.textColor = s.partnerIsPro ? UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1) : UIColor(white: 0.42, alpha: 1)
            roleBadge.backgroundColor = s.partnerIsPro ? UIColor(red: 0.92, green: 0.95, blue: 1.0, alpha: 1) : UIColor(white: 0.95, alpha: 1)
        } else {
            roleBadge.isHidden = true
        }

        if s.imageUrl != currentImageURL {
            currentImageURL = s.imageUrl
            NativeChatImageLoader.load(s.imageUrl, into: avatar, fallback: Self.avatarPlaceholder)
        }
    }

    @objc private func tapBack() { delegate?.chatBarsDidTapBack() }
    @objc private func tapMenu() { delegate?.chatBarsDidTapMenu() }
    @objc private func tapProfile() { delegate?.chatBarsDidTapProfile() }
}

// MARK: - 네이티브 채팅 입력바 (첨부 / 견적 / 입력 / 전송·음성)
final class NativeChatInputBar: UIView, UITextFieldDelegate {
    weak var delegate: NativeChatBarsDelegate?

    private let blur = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterial))
    private let row = UIStackView()
    private let attachButton = UIButton(type: .system)
    private let quoteButton = UIButton(type: .system)
    private let fieldContainer = UIView()
    let textField = UITextField()
    private let sendButton = UIButton(type: .system)
    private let voiceButton = UIButton(type: .system)

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

        blur.translatesAutoresizingMaskIntoConstraints = false
        addSubview(blur)

        var attachCfg = UIButton.Configuration.plain()
        attachCfg.image = UIImage(systemName: "plus", withConfiguration: UIImage.SymbolConfiguration(pointSize: 20, weight: .semibold))
        attachCfg.baseForegroundColor = UIColor(white: 0.3, alpha: 1)
        attachCfg.contentInsets = .zero
        attachButton.configuration = attachCfg
        attachButton.addTarget(self, action: #selector(tapAttach), for: .touchUpInside)

        var quoteCfg = UIButton.Configuration.filled()
        quoteCfg.image = UIImage(systemName: "doc.text", withConfiguration: UIImage.SymbolConfiguration(pointSize: 15, weight: .semibold))
        quoteCfg.baseBackgroundColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
        quoteCfg.baseForegroundColor = .white
        quoteCfg.cornerStyle = .capsule
        quoteCfg.contentInsets = NSDirectionalEdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12)
        quoteButton.configuration = quoteCfg
        quoteButton.isHidden = true
        quoteButton.addTarget(self, action: #selector(tapQuote), for: .touchUpInside)

        fieldContainer.translatesAutoresizingMaskIntoConstraints = false
        fieldContainer.backgroundColor = UIColor(white: 0.93, alpha: 1)
        fieldContainer.layer.cornerRadius = 21
        fieldContainer.layer.borderWidth = 0.5
        fieldContainer.layer.borderColor = UIColor(white: 0.84, alpha: 1).cgColor

        textField.translatesAutoresizingMaskIntoConstraints = false
        textField.placeholder = "메시지"
        textField.font = .systemFont(ofSize: 16)
        textField.returnKeyType = .send
        textField.delegate = self
        textField.enablesReturnKeyAutomatically = true
        textField.addTarget(self, action: #selector(textChanged), for: .editingChanged)
        fieldContainer.addSubview(textField)

        var sendCfg = UIButton.Configuration.filled()
        sendCfg.image = UIImage(systemName: "paperplane.fill", withConfiguration: UIImage.SymbolConfiguration(pointSize: 15, weight: .semibold))
        sendCfg.baseBackgroundColor = UIColor(white: 0.15, alpha: 1)
        sendCfg.baseForegroundColor = .white
        sendCfg.cornerStyle = .capsule
        sendButton.configuration = sendCfg
        sendButton.translatesAutoresizingMaskIntoConstraints = false
        sendButton.isHidden = true
        sendButton.addTarget(self, action: #selector(tapSend), for: .touchUpInside)
        fieldContainer.addSubview(sendButton)

        var voiceCfg = UIButton.Configuration.plain()
        voiceCfg.image = UIImage(systemName: "mic.fill", withConfiguration: UIImage.SymbolConfiguration(pointSize: 17, weight: .regular))
        voiceCfg.baseForegroundColor = UIColor(white: 0.4, alpha: 1)
        voiceCfg.contentInsets = .zero
        voiceButton.configuration = voiceCfg
        voiceButton.translatesAutoresizingMaskIntoConstraints = false
        voiceButton.addTarget(self, action: #selector(tapVoice), for: .touchUpInside)
        fieldContainer.addSubview(voiceButton)

        row.translatesAutoresizingMaskIntoConstraints = false
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 6
        row.addArrangedSubview(attachButton)
        row.addArrangedSubview(quoteButton)
        row.addArrangedSubview(fieldContainer)
        addSubview(row)

        fieldContainer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        fieldContainer.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        attachButton.setContentHuggingPriority(.required, for: .horizontal)
        quoteButton.setContentHuggingPriority(.required, for: .horizontal)

        NSLayoutConstraint.activate([
            blur.topAnchor.constraint(equalTo: topAnchor),
            blur.leadingAnchor.constraint(equalTo: leadingAnchor),
            blur.trailingAnchor.constraint(equalTo: trailingAnchor),
            blur.bottomAnchor.constraint(equalTo: bottomAnchor),

            row.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 10),
            row.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -10),
            row.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            row.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.bottomAnchor, constant: -6),

            attachButton.widthAnchor.constraint(equalToConstant: 42),
            attachButton.heightAnchor.constraint(equalToConstant: 42),
            quoteButton.heightAnchor.constraint(equalToConstant: 42),
            fieldContainer.heightAnchor.constraint(equalToConstant: 42),

            textField.leadingAnchor.constraint(equalTo: fieldContainer.leadingAnchor, constant: 16),
            textField.topAnchor.constraint(equalTo: fieldContainer.topAnchor),
            textField.bottomAnchor.constraint(equalTo: fieldContainer.bottomAnchor),
            textField.trailingAnchor.constraint(equalTo: sendButton.leadingAnchor, constant: -6),

            sendButton.trailingAnchor.constraint(equalTo: fieldContainer.trailingAnchor, constant: -5),
            sendButton.centerYAnchor.constraint(equalTo: fieldContainer.centerYAnchor),
            sendButton.widthAnchor.constraint(equalToConstant: 32),
            sendButton.heightAnchor.constraint(equalToConstant: 32),

            voiceButton.trailingAnchor.constraint(equalTo: fieldContainer.trailingAnchor, constant: -6),
            voiceButton.centerYAnchor.constraint(equalTo: fieldContainer.centerYAnchor),
            voiceButton.widthAnchor.constraint(equalToConstant: 30),
            voiceButton.heightAnchor.constraint(equalToConstant: 30),
        ])
    }

    func apply(_ s: NativeChatState) {
        quoteButton.isHidden = !s.isPro
    }

    private func updateSendVoiceVisibility() {
        let hasText = !(textField.text ?? "").trimmingCharacters(in: .whitespaces).isEmpty
        sendButton.isHidden = !hasText
        voiceButton.isHidden = hasText
    }

    @objc private func textChanged() { updateSendVoiceVisibility() }
    @objc private func tapSend() { commitSend() }
    @objc private func tapAttach() { delegate?.chatBarsDidTapAttach() }
    @objc private func tapQuote() { delegate?.chatBarsDidTapQuote() }
    @objc private func tapVoice() { delegate?.chatBarsDidTapVoice() }

    private func commitSend() {
        let text = (textField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        delegate?.chatBarsDidSend(text)
        textField.text = ""
        updateSendVoiceVisibility()
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        commitSend()
        return false
    }
}
