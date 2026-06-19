import UIKit

// 사회자 문의하기 네이티브 글래스 폼
// 로그인: 행사일 + 1부/2부 + 장소 / 비로그인: + 이름·전화번호(제출 시 자동 회원가입+로그인 유지)
final class NativeProInquiryFormViewController: UIViewController, UITextFieldDelegate {

    var onSubmit: (([String: String]) -> Void)?

    private let loggedIn: Bool
    private let proName: String

    private let dimView = UIView()
    private let card = UIVisualEffectView(effect: LiquidGlassEffectFactory.navigationEffect())
    private var cardBottom: NSLayoutConstraint?
    private var colBottom: NSLayoutConstraint?

    private let nameField = UITextField()
    private let phoneField = UITextField()
    private let datePicker = UIDatePicker()
    private let partControl = UISegmentedControl(items: ["1부", "2부", "협의"])
    private let locationField = UITextField()
    private let sendButton = UIButton(type: .system)

    private static let dateFmt: DateFormatter = { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX"); return f }()

    init(loggedIn: Bool, proName: String) {
        self.loggedIn = loggedIn
        self.proName = proName
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .overFullScreen
        modalTransitionStyle = .crossDissolve
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear

        dimView.translatesAutoresizingMaskIntoConstraints = false
        dimView.backgroundColor = UIColor.black.withAlphaComponent(0.0)
        dimView.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(dismissSelf)))
        view.addSubview(dimView)

        card.translatesAutoresizingMaskIntoConstraints = false
        card.clipsToBounds = true
        card.layer.cornerRadius = 28
        card.layer.cornerCurve = .continuous
        card.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        card.layer.borderWidth = 0.5
        card.layer.borderColor = UIColor.white.withAlphaComponent(0.22).cgColor
        view.addSubview(card)

        let whiteTint = UIView()
        whiteTint.translatesAutoresizingMaskIntoConstraints = false
        whiteTint.backgroundColor = UIColor.white.withAlphaComponent(0.22)
        whiteTint.isUserInteractionEnabled = false
        card.contentView.addSubview(whiteTint)

        let grabber = UIView()
        grabber.translatesAutoresizingMaskIntoConstraints = false
        grabber.backgroundColor = UIColor(white: 0.6, alpha: 0.6)
        grabber.layer.cornerRadius = 2.5
        card.contentView.addSubview(grabber)

        let title = UILabel()
        title.text = "\(proName.isEmpty ? "사회자" : proName) 사회자에게 문의"
        title.font = .systemFont(ofSize: 19, weight: .bold)
        title.textColor = UIColor(white: 0.08, alpha: 1)

        let subtitle = UILabel()
        subtitle.text = loggedIn
            ? "행사 정보를 알려주시면 사회자가 확인 후 채팅으로 연락드려요"
            : "연락처를 남겨주시면 자동으로 가입되고, 사회자가 확인 후 연락드려요"
        subtitle.font = .systemFont(ofSize: 13)
        subtitle.textColor = UIColor(white: 0.42, alpha: 1)
        subtitle.numberOfLines = 0

        configField(nameField, placeholder: "이름")
        configField(phoneField, placeholder: "전화번호 (010-0000-0000)")
        phoneField.keyboardType = .phonePad
        configField(locationField, placeholder: "행사 장소 (미정이면 비워두세요)")

        datePicker.datePickerMode = .date
        datePicker.preferredDatePickerStyle = .compact
        datePicker.locale = Locale(identifier: "ko_KR")
        datePicker.minimumDate = Date()
        datePicker.date = Calendar.current.date(byAdding: .day, value: 14, to: Date()) ?? Date()

        partControl.selectedSegmentIndex = 2
        partControl.selectedSegmentTintColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
        partControl.setTitleTextAttributes([.foregroundColor: UIColor.white, .font: UIFont.systemFont(ofSize: 14, weight: .semibold)], for: .selected)
        partControl.setTitleTextAttributes([.foregroundColor: UIColor(white: 0.35, alpha: 1), .font: UIFont.systemFont(ofSize: 14, weight: .medium)], for: .normal)

        var sendCfg = UIButton.Configuration.filled()
        sendCfg.title = "문의 보내기"
        sendCfg.baseBackgroundColor = UIColor(red: 44/255, green: 83/255, blue: 255/255, alpha: 1)
        sendCfg.baseForegroundColor = .white
        sendCfg.cornerStyle = .large
        sendCfg.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { var o = $0; o.font = .systemFont(ofSize: 16.5, weight: .bold); return o }
        sendButton.configuration = sendCfg
        sendButton.addTarget(self, action: #selector(tapSend), for: .touchUpInside)

        var rows: [UIView] = []
        if !loggedIn {
            rows.append(labeled("이름", nameField))
            rows.append(labeled("전화번호", phoneField))
        }
        let dateRow = UIStackView(arrangedSubviews: [labeled("행사일", datePicker), labeled("행사 구분", partControl)])
        dateRow.axis = .horizontal; dateRow.spacing = 12; dateRow.distribution = .fillEqually
        rows.append(dateRow)
        rows.append(labeled("행사 장소", locationField))

        let col = UIStackView(arrangedSubviews: [title, subtitle] + rows + [sendButton])
        col.axis = .vertical
        col.spacing = 14
        col.setCustomSpacing(6, after: title)
        col.setCustomSpacing(18, after: subtitle)
        col.translatesAutoresizingMaskIntoConstraints = false
        card.contentView.addSubview(col)

        let bottom = card.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: 420)
        cardBottom = bottom
        NSLayoutConstraint.activate([
            dimView.topAnchor.constraint(equalTo: view.topAnchor),
            dimView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            dimView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            dimView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            card.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            card.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bottom,
            whiteTint.topAnchor.constraint(equalTo: card.contentView.topAnchor),
            whiteTint.leadingAnchor.constraint(equalTo: card.contentView.leadingAnchor),
            whiteTint.trailingAnchor.constraint(equalTo: card.contentView.trailingAnchor),
            whiteTint.bottomAnchor.constraint(equalTo: card.contentView.bottomAnchor),
            grabber.topAnchor.constraint(equalTo: card.contentView.topAnchor, constant: 10),
            grabber.centerXAnchor.constraint(equalTo: card.contentView.centerXAnchor),
            grabber.widthAnchor.constraint(equalToConstant: 44),
            grabber.heightAnchor.constraint(equalToConstant: 5),
            col.topAnchor.constraint(equalTo: card.contentView.topAnchor, constant: 32),
            col.leadingAnchor.constraint(equalTo: card.contentView.leadingAnchor, constant: 20),
            col.trailingAnchor.constraint(equalTo: card.contentView.trailingAnchor, constant: -20),
            sendButton.heightAnchor.constraint(equalToConstant: 54),
        ])
        // 콘텐츠 하단은 (세이프에어리어 가이드가 아닌) 카드 실제 하단에 고정 → 키보드 시 카드 들어올려도 콘텐츠 높이 안 변함(점프 방지)
        let colB = col.bottomAnchor.constraint(equalTo: card.contentView.bottomAnchor, constant: -16)
        colBottom = colB
        colB.isActive = true

        NotificationCenter.default.addObserver(self, selector: #selector(keyboardWillChange(_:)), name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        cardBottom?.constant = 0
        colBottom?.constant = -(16 + view.safeAreaInsets.bottom)   // 휴식 상태: 홈 인디케이터 여백 확보
        UIView.animate(withDuration: 0.32, delay: 0, options: [.curveEaseOut]) {
            self.view.layoutIfNeeded()
            self.dimView.backgroundColor = UIColor.black.withAlphaComponent(0.35)
        }
    }

    @objc private func keyboardWillChange(_ note: Notification) {
        guard let frame = (note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue else { return }
        let local = view.convert(frame, from: nil)
        let overlap = max(0, view.bounds.height - local.minY)
        let up = overlap > 0
        // 카드를 키보드 위 12pt 까지 들어올리고, 콘텐츠 하단여백은 키보드 유무에 맞춤(세이프에어리어 붕괴 점프 방지)
        cardBottom?.constant = up ? -(overlap + 12) : 0
        colBottom?.constant = up ? -16 : -(16 + view.safeAreaInsets.bottom)
        let dur = (note.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double) ?? 0.25
        let curve = (note.userInfo?[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt) ?? UInt(UIView.AnimationCurve.easeInOut.rawValue)
        UIView.animate(withDuration: dur, delay: 0, options: UIView.AnimationOptions(rawValue: curve << 16)) { self.view.layoutIfNeeded() }
    }

    private func configField(_ f: UITextField, placeholder: String) {
        f.placeholder = placeholder
        f.font = .systemFont(ofSize: 16)
        f.textColor = UIColor(white: 0.08, alpha: 1)
        f.backgroundColor = UIColor.white.withAlphaComponent(0.72)
        f.layer.cornerRadius = 13
        f.layer.cornerCurve = .continuous
        f.layer.borderWidth = 1
        f.layer.borderColor = UIColor.white.withAlphaComponent(0.8).cgColor
        f.leftView = UIView(frame: CGRect(x: 0, y: 0, width: 14, height: 10))
        f.leftViewMode = .always
        f.heightAnchor.constraint(equalToConstant: 48).isActive = true
        f.delegate = self
    }

    private func labeled(_ caption: String, _ control: UIView) -> UIView {
        let cap = UILabel()
        cap.text = caption
        cap.font = .systemFont(ofSize: 12, weight: .semibold)
        cap.textColor = UIColor(white: 0.45, alpha: 1)
        let col = UIStackView(arrangedSubviews: [cap, control])
        col.axis = .vertical
        col.spacing = 6
        col.alignment = .fill
        return col
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool { textField.resignFirstResponder(); return true }

    @objc private func dismissSelf() {
        cardBottom?.constant = 420
        UIView.animate(withDuration: 0.25, animations: {
            self.view.layoutIfNeeded()
            self.dimView.backgroundColor = UIColor.black.withAlphaComponent(0)
        }) { _ in self.dismiss(animated: false) }
    }

    @objc private func tapSend() {
        view.endEditing(true)
        if !loggedIn {
            let name = (nameField.text ?? "").trimmingCharacters(in: .whitespaces)
            let digits = (phoneField.text ?? "").filter { $0.isNumber }
            if name.isEmpty { shake(nameField); return }
            if digits.count < 9 { shake(phoneField); return }
        }
        let part: String
        switch partControl.selectedSegmentIndex {
        case 0: part = "1부"
        case 1: part = "2부"
        default: part = ""
        }
        let payload: [String: String] = [
            "name": (nameField.text ?? "").trimmingCharacters(in: .whitespaces),
            "phone": (phoneField.text ?? "").filter { $0.isNumber },
            "date": Self.dateFmt.string(from: datePicker.date),
            "time": "협의",
            "part": part,
            "location": (locationField.text ?? "").trimmingCharacters(in: .whitespaces),
        ]
        let submit = onSubmit
        cardBottom?.constant = 420
        UIView.animate(withDuration: 0.25, animations: {
            self.view.layoutIfNeeded()
            self.dimView.backgroundColor = UIColor.black.withAlphaComponent(0)
        }) { _ in
            self.dismiss(animated: false) { submit?(payload) }
        }
    }

    private func shake(_ v: UIView) {
        let a = CAKeyframeAnimation(keyPath: "transform.translation.x")
        a.values = [0, -8, 8, -6, 6, -3, 3, 0]
        a.duration = 0.4
        v.layer.add(a, forKey: "shake")
        v.becomeFirstResponder()
    }
}
