import UIKit

// 네이티브 글래스 견적서 작성 폼 (UIKit)
// 발송 로직은 웹(window.__freetifulChatActions.submitQuote)을 재사용 — 여기선 입력만 모음.
final class NativeQuoteFormViewController: UIViewController, UITextFieldDelegate {

    struct Defaults {
        var eventName = ""
        var eventDate = ""      // yyyy-MM-dd
        var eventTime = ""      // HH:mm
        var eventLocation = ""
        var planLabel = ""
        var planPrice = 0
    }

    // 발송 시 { customAmount, eventName, eventDate, eventTime, eventLocation }
    var onSubmit: (([String: String]) -> Void)?

    private let defaults: Defaults

    private let dimView = UIView()
    private let card = UIVisualEffectView(effect: LiquidGlassEffectFactory.navigationEffect())
    private var cardBottom: NSLayoutConstraint?

    private let amountField = UITextField()
    private let nameField = UITextField()
    private let datePicker = UIDatePicker()
    private let timePicker = UIDatePicker()
    private let locationField = UITextField()
    private let totalLabel = UILabel()
    private let sendButton = UIButton(type: .system)

    private static let dateFmt: DateFormatter = { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX"); return f }()
    private static let timeFmt: DateFormatter = { let f = DateFormatter(); f.dateFormat = "HH:mm"; f.locale = Locale(identifier: "en_US_POSIX"); return f }()

    init(defaults: Defaults) {
        self.defaults = defaults
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

        let grabber = UIView()
        grabber.translatesAutoresizingMaskIntoConstraints = false
        grabber.backgroundColor = UIColor(white: 0.6, alpha: 0.6)
        grabber.layer.cornerRadius = 2.5
        card.contentView.addSubview(grabber)

        let title = UILabel()
        title.translatesAutoresizingMaskIntoConstraints = false
        title.text = "견적서 작성"
        title.font = .systemFont(ofSize: 19, weight: .bold)
        title.textColor = UIColor(white: 0.08, alpha: 1)
        card.contentView.addSubview(title)

        let amountCaption = makeCaption("견적 금액")
        configField(amountField, placeholder: "직접 입력 시 선택 플랜 금액 대신 적용")
        amountField.keyboardType = .numberPad
        amountField.addTarget(self, action: #selector(amountChanged), for: .editingChanged)

        let infoCaption = makeCaption("행사 정보")
        configField(nameField, placeholder: "행사명 (예: 김철수·이영희 결혼식)")
        nameField.text = defaults.eventName

        styleDatePicker(datePicker, mode: .date)
        styleDatePicker(timePicker, mode: .time)
        if let d = Self.dateFmt.date(from: defaults.eventDate) { datePicker.date = d }
        if let t = Self.timeFmt.date(from: defaults.eventTime) { timePicker.date = t }

        let dateRow = UIStackView(arrangedSubviews: [labeled("행사일", datePicker), labeled("시간", timePicker)])
        dateRow.translatesAutoresizingMaskIntoConstraints = false
        dateRow.axis = .horizontal
        dateRow.distribution = .fillEqually
        dateRow.spacing = 10

        configField(locationField, placeholder: "행사 장소 (예: 그랜드 워커힐 서울)")
        locationField.text = defaults.eventLocation

        totalLabel.translatesAutoresizingMaskIntoConstraints = false
        totalLabel.font = .systemFont(ofSize: 20, weight: .bold)
        totalLabel.textColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
        totalLabel.textAlignment = .right

        let totalCaption = makeCaption(defaults.planLabel.isEmpty ? "총 견적" : "총 견적 · \(defaults.planLabel)")
        totalCaption.setContentHuggingPriority(.defaultLow, for: .horizontal)
        let totalRow = UIStackView(arrangedSubviews: [totalCaption, totalLabel])
        totalRow.translatesAutoresizingMaskIntoConstraints = false
        totalRow.axis = .horizontal
        totalRow.alignment = .center

        var sendCfg = UIButton.Configuration.filled()
        sendCfg.title = "견적서 발송"
        sendCfg.baseBackgroundColor = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
        sendCfg.baseForegroundColor = .white
        sendCfg.cornerStyle = .large
        sendCfg.attributedTitle = AttributedString("견적서 발송", attributes: AttributeContainer([.font: UIFont.systemFont(ofSize: 16, weight: .bold)]))
        sendButton.configuration = sendCfg
        sendButton.translatesAutoresizingMaskIntoConstraints = false
        sendButton.addTarget(self, action: #selector(tapSend), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [
            amountCaption, amountField,
            spacer(8), infoCaption, nameField, dateRow, locationField,
            spacer(10), totalRow,
            spacer(12), sendButton,
        ])
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 8
        stack.setCustomSpacing(6, after: amountCaption)
        stack.setCustomSpacing(6, after: infoCaption)
        card.contentView.addSubview(stack)

        NSLayoutConstraint.activate([
            dimView.topAnchor.constraint(equalTo: view.topAnchor),
            dimView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            dimView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            dimView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            card.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            card.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            grabber.topAnchor.constraint(equalTo: card.contentView.topAnchor, constant: 8),
            grabber.centerXAnchor.constraint(equalTo: card.contentView.centerXAnchor),
            grabber.widthAnchor.constraint(equalToConstant: 38),
            grabber.heightAnchor.constraint(equalToConstant: 5),

            title.topAnchor.constraint(equalTo: grabber.bottomAnchor, constant: 12),
            title.leadingAnchor.constraint(equalTo: card.contentView.leadingAnchor, constant: 20),

            stack.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 16),
            stack.leadingAnchor.constraint(equalTo: card.contentView.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: card.contentView.trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(equalTo: card.contentView.safeAreaLayoutGuide.bottomAnchor, constant: -16),

            amountField.heightAnchor.constraint(equalToConstant: 50),
            nameField.heightAnchor.constraint(equalToConstant: 50),
            locationField.heightAnchor.constraint(equalToConstant: 50),
            sendButton.heightAnchor.constraint(equalToConstant: 54),
        ])

        // 슬라이드 업을 위해 카드 bottom 을 화면 아래에서 시작
        cardBottom = card.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: 600)
        cardBottom?.isActive = true

        updateTotal()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        cardBottom?.constant = 0
        UIView.animate(withDuration: 0.36, delay: 0, usingSpringWithDamping: 0.86, initialSpringVelocity: 0.4, options: [.allowUserInteraction]) {
            self.dimView.backgroundColor = UIColor.black.withAlphaComponent(0.4)
            self.view.layoutIfNeeded()
        }
    }

    // MARK: - helpers
    private func makeCaption(_ text: String) -> UILabel {
        let l = UILabel()
        l.translatesAutoresizingMaskIntoConstraints = false
        l.text = text
        l.font = .systemFont(ofSize: 12, weight: .bold)
        l.textColor = UIColor(white: 0.55, alpha: 1)
        return l
    }

    private func spacer(_ h: CGFloat) -> UIView {
        let v = UIView()
        v.translatesAutoresizingMaskIntoConstraints = false
        v.heightAnchor.constraint(equalToConstant: h).isActive = true
        v.backgroundColor = .clear
        return v
    }

    private func configField(_ f: UITextField, placeholder: String) {
        f.translatesAutoresizingMaskIntoConstraints = false
        f.placeholder = placeholder
        f.font = .systemFont(ofSize: 16)
        f.textColor = UIColor(white: 0.1, alpha: 1)
        f.backgroundColor = UIColor.white.withAlphaComponent(0.55)
        f.layer.cornerRadius = 14
        f.layer.cornerCurve = .continuous
        f.layer.borderWidth = 0.5
        f.layer.borderColor = UIColor.white.withAlphaComponent(0.5).cgColor
        f.leftView = UIView(frame: CGRect(x: 0, y: 0, width: 14, height: 1))
        f.leftViewMode = .always
        f.rightView = UIView(frame: CGRect(x: 0, y: 0, width: 14, height: 1))
        f.rightViewMode = .always
        f.delegate = self
    }

    private func styleDatePicker(_ p: UIDatePicker, mode: UIDatePicker.Mode) {
        p.translatesAutoresizingMaskIntoConstraints = false
        p.datePickerMode = mode
        p.preferredDatePickerStyle = .compact
        p.locale = Locale(identifier: "ko_KR")
        if mode == .date { p.minimumDate = Date() }
    }

    private func labeled(_ caption: String, _ control: UIView) -> UIView {
        let c = makeCaption(caption)
        let wrap = UIStackView(arrangedSubviews: [c, control])
        wrap.axis = .vertical
        wrap.alignment = .leading
        wrap.spacing = 4
        wrap.translatesAutoresizingMaskIntoConstraints = false
        return wrap
    }

    private func currentAmount() -> Int {
        let digits = (amountField.text ?? "").filter { $0.isNumber }
        if let n = Int(digits), n > 0 { return n }
        return defaults.planPrice
    }

    private func updateTotal() {
        let amt = currentAmount()
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        let str = formatter.string(from: NSNumber(value: amt)) ?? "\(amt)"
        totalLabel.text = "\(str)원"
    }

    @objc private func amountChanged() { updateTotal() }

    @objc private func dismissSelf() {
        view.endEditing(true)
        cardBottom?.constant = 600
        UIView.animate(withDuration: 0.28, animations: {
            self.dimView.backgroundColor = UIColor.black.withAlphaComponent(0)
            self.view.layoutIfNeeded()
        }, completion: { _ in self.dismiss(animated: false) })
    }

    @objc private func tapSend() {
        view.endEditing(true)
        let payload: [String: String] = [
            "customAmount": (amountField.text ?? "").filter { $0.isNumber },
            "eventName": nameField.text ?? "",
            "eventDate": Self.dateFmt.string(from: datePicker.date),
            "eventTime": Self.timeFmt.string(from: timePicker.date),
            "eventLocation": locationField.text ?? "",
        ]
        onSubmit?(payload)
        dismissSelf()
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        textField.resignFirstResponder()
        return true
    }
}
