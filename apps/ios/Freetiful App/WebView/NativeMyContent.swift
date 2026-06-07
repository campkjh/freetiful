import UIKit

// 마이페이지 프로필 (웹 브리지 nativeMyProfile)
struct MyProfile {
    let loggedIn: Bool
    let name: String
    let email: String
    let image: String
    let proPending: Bool
}

struct MyMenuItem {
    let asset: String?   // 번들 SVG 에셋명
    let sf: String?      // SF Symbol 대체
    let label: String
    let path: String
    let badge: String?
}

protocol NativeMyContentDelegate: AnyObject {
    func myOpenPath(_ path: String)
    func myLogout()
    func myShowLogin()
}

// 마이페이지 네이티브 본문 (웹 위 전체 덮음)
final class NativeMyContent: UIView {
    weak var delegate: NativeMyContentDelegate?

    private let scrollView = UIScrollView()
    private let stack = UIStackView()

    private let profileCard = UIControl()
    private let avatar = UIImageView()
    private let nameLabel = UILabel()
    private let emailLabel = UILabel()
    private let loginPrompt = UIView()

    private static let sections: [(title: String, items: [MyMenuItem])] = [
        ("설정", [
            MyMenuItem(asset: "my-settings", sf: "person.crop.circle", label: "프로필 설정", path: "/my/settings", badge: nil),
        ]),
        ("나의 활동", [
            MyMenuItem(asset: "my-purchase", sf: "bag", label: "구매 내역", path: "/my/purchase-history", badge: nil),
            MyMenuItem(asset: nil, sf: "clock.arrow.circlepath", label: "결제/환불 내역", path: "/my/payment-history", badge: nil),
        ]),
        ("고객지원", [
            MyMenuItem(asset: "my-support", sf: "headphones", label: "고객센터", path: "/my/support", badge: nil),
            MyMenuItem(asset: "my-faq", sf: "questionmark.circle", label: "FAQ", path: "/my/faq", badge: nil),
            MyMenuItem(asset: "my-announce", sf: "megaphone", label: "공지사항", path: "/my/announcements", badge: nil),
        ]),
        ("기타", [
            MyMenuItem(asset: "my-invite", sf: "gift", label: "친구 초대", path: "/my/invite", badge: "5,000원 이벤트"),
            MyMenuItem(asset: nil, sf: "doc.text", label: "약관 및 정책", path: "/my/terms", badge: nil),
            MyMenuItem(asset: "my-partner", sf: "briefcase", label: "파트너 신청", path: "/pro-register/terms", badge: nil),
        ]),
    ]

    init() {
        super.init(frame: .zero)
        setup()
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setInsets(top: CGFloat, bottom: CGFloat) {
        scrollView.contentInset = UIEdgeInsets(top: top, left: 0, bottom: bottom, right: 0)
        scrollView.verticalScrollIndicatorInsets = UIEdgeInsets(top: top, left: 0, bottom: bottom, right: 0)
    }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .white

        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = true
        scrollView.showsVerticalScrollIndicator = false
        scrollView.contentInsetAdjustmentBehavior = .never
        addSubview(scrollView)

        stack.axis = .vertical
        stack.spacing = 22
        stack.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(stack)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: bottomAnchor),
            stack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 8),
            stack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -32),
        ])

        buildProfileCard()
        buildLoginPrompt()
        for sec in Self.sections { stack.addArrangedSubview(buildSection(sec.title, sec.items)) }
        stack.addArrangedSubview(buildLogout())

        // 기본: 로그인 안 된 상태로 시작
        applyProfile(MyProfile(loggedIn: false, name: "", email: "", image: "", proPending: false))
    }

    // MARK: 데이터
    func setProfile(_ p: MyProfile) { applyProfile(p) }

    private func applyProfile(_ p: MyProfile) {
        profileCard.isHidden = !p.loggedIn
        loginPrompt.isHidden = p.loggedIn
        if p.loggedIn {
            nameLabel.text = p.name.isEmpty ? "회원" : p.name
            emailLabel.text = p.email
            emailLabel.isHidden = p.email.isEmpty
            avatar.image = NativeChatHeaderView.avatarPlaceholder
            if !p.image.isEmpty { NativeChatImageLoader.load(p.image, into: avatar, fallback: NativeChatHeaderView.avatarPlaceholder) }
        }
    }

    // MARK: 빌더
    private func buildProfileCard() {
        profileCard.translatesAutoresizingMaskIntoConstraints = false

        avatar.translatesAutoresizingMaskIntoConstraints = false
        avatar.contentMode = .scaleAspectFill
        avatar.clipsToBounds = true
        avatar.layer.cornerRadius = 28
        avatar.backgroundColor = UIColor(white: 0.93, alpha: 1)
        avatar.isUserInteractionEnabled = false
        profileCard.addSubview(avatar)

        nameLabel.font = .systemFont(ofSize: 17, weight: .bold)
        nameLabel.textColor = UIColor(white: 0.1, alpha: 1)
        emailLabel.font = .systemFont(ofSize: 13)
        emailLabel.textColor = UIColor(white: 0.6, alpha: 1)
        let col = UIStackView(arrangedSubviews: [nameLabel, emailLabel])
        col.axis = .vertical
        col.spacing = 2
        col.alignment = .leading
        col.translatesAutoresizingMaskIntoConstraints = false
        col.isUserInteractionEnabled = false
        profileCard.addSubview(col)

        let chev = UIImageView(image: UIImage(systemName: "chevron.right", withConfiguration: UIImage.SymbolConfiguration(pointSize: 15, weight: .semibold)))
        chev.tintColor = UIColor(white: 0.8, alpha: 1)
        chev.translatesAutoresizingMaskIntoConstraints = false
        chev.isUserInteractionEnabled = false
        profileCard.addSubview(chev)

        NSLayoutConstraint.activate([
            avatar.leadingAnchor.constraint(equalTo: profileCard.leadingAnchor, constant: 16),
            avatar.topAnchor.constraint(equalTo: profileCard.topAnchor, constant: 4),
            avatar.bottomAnchor.constraint(equalTo: profileCard.bottomAnchor, constant: -4),
            avatar.widthAnchor.constraint(equalToConstant: 56),
            avatar.heightAnchor.constraint(equalToConstant: 56),
            col.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 14),
            col.centerYAnchor.constraint(equalTo: avatar.centerYAnchor),
            col.trailingAnchor.constraint(lessThanOrEqualTo: chev.leadingAnchor, constant: -8),
            chev.trailingAnchor.constraint(equalTo: profileCard.trailingAnchor, constant: -16),
            chev.centerYAnchor.constraint(equalTo: avatar.centerYAnchor),
        ])
        profileCard.addAction(UIAction { [weak self] _ in Haptics.tap(); self?.delegate?.myOpenPath("/my/settings") }, for: .touchUpInside)
        stack.addArrangedSubview(profileCard)
    }

    private func buildLoginPrompt() {
        loginPrompt.translatesAutoresizingMaskIntoConstraints = false
        let card = UIView()
        card.translatesAutoresizingMaskIntoConstraints = false
        card.backgroundColor = UIColor(white: 0.97, alpha: 1)
        card.layer.cornerRadius = 16
        card.layer.cornerCurve = .continuous
        loginPrompt.addSubview(card)

        let title = UILabel()
        title.text = "로그인이 필요합니다"
        title.font = .systemFont(ofSize: 16, weight: .bold)
        title.textColor = UIColor(white: 0.1, alpha: 1)
        title.textAlignment = .center
        let sub = UILabel()
        sub.text = "로그인하고 다양한 서비스를 이용해보세요"
        sub.font = .systemFont(ofSize: 13)
        sub.textColor = UIColor(white: 0.6, alpha: 1)
        sub.textAlignment = .center
        let btn = UIButton(type: .system)
        var cfg = UIButton.Configuration.filled()
        cfg.title = "로그인 / 회원가입"
        cfg.baseBackgroundColor = UIColor(white: 0.1, alpha: 1)
        cfg.baseForegroundColor = .white
        cfg.cornerStyle = .large
        cfg.contentInsets = NSDirectionalEdgeInsets(top: 11, leading: 22, bottom: 11, trailing: 22)
        btn.configuration = cfg
        btn.addAction(UIAction { [weak self] _ in Haptics.tap(); self?.delegate?.myShowLogin() }, for: .touchUpInside)

        let col = UIStackView(arrangedSubviews: [title, sub, btn])
        col.axis = .vertical
        col.spacing = 8
        col.alignment = .center
        col.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(col)
        NSLayoutConstraint.activate([
            card.topAnchor.constraint(equalTo: loginPrompt.topAnchor),
            card.bottomAnchor.constraint(equalTo: loginPrompt.bottomAnchor),
            card.leadingAnchor.constraint(equalTo: loginPrompt.leadingAnchor, constant: 16),
            card.trailingAnchor.constraint(equalTo: loginPrompt.trailingAnchor, constant: -16),
            col.topAnchor.constraint(equalTo: card.topAnchor, constant: 22),
            col.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -22),
            col.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            col.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
        ])
        stack.addArrangedSubview(loginPrompt)
    }

    private func buildSection(_ title: String, _ items: [MyMenuItem]) -> UIView {
        let header = UILabel()
        header.text = title
        header.font = .systemFont(ofSize: 13, weight: .semibold)
        header.textColor = UIColor(white: 0.55, alpha: 1)
        let headerWrap = UIView()
        headerWrap.translatesAutoresizingMaskIntoConstraints = false
        header.translatesAutoresizingMaskIntoConstraints = false
        headerWrap.addSubview(header)
        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: headerWrap.topAnchor),
            header.bottomAnchor.constraint(equalTo: headerWrap.bottomAnchor),
            header.leadingAnchor.constraint(equalTo: headerWrap.leadingAnchor, constant: 18),
            header.trailingAnchor.constraint(equalTo: headerWrap.trailingAnchor, constant: -18),
        ])

        let rows = UIStackView()
        rows.axis = .vertical
        rows.spacing = 0
        for item in items { rows.addArrangedSubview(buildRow(item)) }

        let card = UIView()
        card.translatesAutoresizingMaskIntoConstraints = false
        card.backgroundColor = .white
        card.layer.cornerRadius = 16
        card.layer.cornerCurve = .continuous
        card.layer.borderWidth = 0.5
        card.layer.borderColor = UIColor(white: 0.92, alpha: 1).cgColor
        rows.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(rows)
        NSLayoutConstraint.activate([
            rows.topAnchor.constraint(equalTo: card.topAnchor, constant: 4),
            rows.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -4),
            rows.leadingAnchor.constraint(equalTo: card.leadingAnchor),
            rows.trailingAnchor.constraint(equalTo: card.trailingAnchor),
        ])
        let cardWrap = UIView()
        cardWrap.translatesAutoresizingMaskIntoConstraints = false
        cardWrap.addSubview(card)
        NSLayoutConstraint.activate([
            card.topAnchor.constraint(equalTo: cardWrap.topAnchor),
            card.bottomAnchor.constraint(equalTo: cardWrap.bottomAnchor),
            card.leadingAnchor.constraint(equalTo: cardWrap.leadingAnchor, constant: 16),
            card.trailingAnchor.constraint(equalTo: cardWrap.trailingAnchor, constant: -16),
        ])

        let sec = UIStackView(arrangedSubviews: [headerWrap, cardWrap])
        sec.axis = .vertical
        sec.spacing = 8
        return sec
    }

    private func buildRow(_ item: MyMenuItem) -> UIView {
        let row = UIControl()
        row.translatesAutoresizingMaskIntoConstraints = false

        let icon = UIImageView()
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.contentMode = .scaleAspectFit
        icon.isUserInteractionEnabled = false
        if let asset = item.asset, let img = UIImage(named: asset) {
            icon.image = img
        } else if let sf = item.sf {
            icon.image = UIImage(systemName: sf, withConfiguration: UIImage.SymbolConfiguration(pointSize: 18, weight: .regular))
            icon.tintColor = UIColor(white: 0.3, alpha: 1)
        }
        row.addSubview(icon)

        let label = UILabel()
        label.text = item.label
        label.font = .systemFont(ofSize: 15, weight: .medium)
        label.textColor = UIColor(white: 0.15, alpha: 1)
        label.translatesAutoresizingMaskIntoConstraints = false
        label.isUserInteractionEnabled = false
        row.addSubview(label)

        let chev = UIImageView(image: UIImage(systemName: "chevron.right", withConfiguration: UIImage.SymbolConfiguration(pointSize: 13, weight: .semibold)))
        chev.tintColor = UIColor(white: 0.8, alpha: 1)
        chev.translatesAutoresizingMaskIntoConstraints = false
        chev.isUserInteractionEnabled = false
        row.addSubview(chev)

        var trailingRef: NSLayoutXAxisAnchor = chev.leadingAnchor
        if let badgeText = item.badge {
            let badge = PaddingLabel()
            badge.text = badgeText
            badge.font = .systemFont(ofSize: 11, weight: .semibold)
            badge.textColor = UIColor(red: 0.95, green: 0.45, blue: 0.13, alpha: 1)
            badge.backgroundColor = UIColor(red: 1.0, green: 0.93, blue: 0.86, alpha: 1)
            badge.layer.cornerRadius = 7
            badge.clipsToBounds = true
            badge.translatesAutoresizingMaskIntoConstraints = false
            badge.isUserInteractionEnabled = false
            row.addSubview(badge)
            NSLayoutConstraint.activate([
                badge.trailingAnchor.constraint(equalTo: chev.leadingAnchor, constant: -8),
                badge.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            ])
            trailingRef = badge.leadingAnchor
        }

        NSLayoutConstraint.activate([
            row.heightAnchor.constraint(equalToConstant: 52),
            icon.leadingAnchor.constraint(equalTo: row.leadingAnchor, constant: 16),
            icon.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 22),
            icon.heightAnchor.constraint(equalToConstant: 22),
            label.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 12),
            label.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            label.trailingAnchor.constraint(lessThanOrEqualTo: trailingRef, constant: -8),
            chev.trailingAnchor.constraint(equalTo: row.trailingAnchor, constant: -16),
            chev.centerYAnchor.constraint(equalTo: row.centerYAnchor),
        ])
        row.addAction(UIAction { [weak self] _ in Haptics.tap(); self?.delegate?.myOpenPath(item.path) }, for: .touchUpInside)
        return row
    }

    private func buildLogout() -> UIView {
        let row = UIControl()
        row.translatesAutoresizingMaskIntoConstraints = false
        let label = UILabel()
        label.text = "로그아웃"
        label.font = .systemFont(ofSize: 14, weight: .medium)
        label.textColor = UIColor(white: 0.55, alpha: 1)
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        label.isUserInteractionEnabled = false
        row.addSubview(label)
        NSLayoutConstraint.activate([
            row.heightAnchor.constraint(equalToConstant: 44),
            label.centerXAnchor.constraint(equalTo: row.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: row.centerYAnchor),
        ])
        row.addAction(UIAction { [weak self] _ in Haptics.tap(); self?.delegate?.myLogout() }, for: .touchUpInside)
        return row
    }
}
