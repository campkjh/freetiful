import UIKit

// 거절 사유 입력 글래스 모달 (사회자가 새요청 거절 시 — 사유 작성 후 전송해야 거절)
final class NativeRejectModal: UIViewController, UITextViewDelegate {
    var onSubmit: ((String) -> Void)?

    private let card = UIVisualEffectView(effect: UIBlurEffect(style: .systemThickMaterial))
    private let textView = UITextView()
    private let placeholderLabel = UILabel()
    private var cardCenterY: NSLayoutConstraint!

    init() {
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .overFullScreen
        modalTransitionStyle = .crossDissolve
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear

        let dim = UIView()
        dim.translatesAutoresizingMaskIntoConstraints = false
        dim.backgroundColor = UIColor.black.withAlphaComponent(0.4)
        view.addSubview(dim)
        dim.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(cancel)))

        card.translatesAutoresizingMaskIntoConstraints = false
        card.layer.cornerRadius = 24
        card.layer.cornerCurve = .continuous
        card.clipsToBounds = true
        card.layer.borderWidth = 1
        card.layer.borderColor = UIColor.white.withAlphaComponent(0.4).cgColor
        view.addSubview(card)

        let title = UILabel()
        title.text = "거절 사유 작성"
        title.font = .systemFont(ofSize: 18, weight: .bold)
        title.textColor = UIColor(white: 0.1, alpha: 1)

        let subtitle = UILabel()
        subtitle.text = "고객에게 전달됩니다. 정중한 사유를 남겨주세요."
        subtitle.font = .systemFont(ofSize: 13)
        subtitle.textColor = UIColor(white: 0.45, alpha: 1)
        subtitle.numberOfLines = 0

        textView.translatesAutoresizingMaskIntoConstraints = false
        textView.font = .systemFont(ofSize: 15)
        textView.textColor = UIColor(white: 0.1, alpha: 1)
        textView.backgroundColor = UIColor(white: 1, alpha: 0.7)
        textView.layer.cornerRadius = 14
        textView.layer.cornerCurve = .continuous
        textView.textContainerInset = UIEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)
        textView.delegate = self
        textView.heightAnchor.constraint(equalToConstant: 110).isActive = true

        placeholderLabel.text = "예) 죄송하지만 해당 날짜에 이미 예약이 있어 진행이 어렵습니다."
        placeholderLabel.font = .systemFont(ofSize: 14)
        placeholderLabel.textColor = UIColor(white: 0.6, alpha: 1)
        placeholderLabel.numberOfLines = 0
        placeholderLabel.translatesAutoresizingMaskIntoConstraints = false
        textView.addSubview(placeholderLabel)

        let cancelBtn = UIButton(type: .system)
        var cc = UIButton.Configuration.gray()
        cc.title = "취소"
        cc.baseForegroundColor = UIColor(white: 0.3, alpha: 1)
        cc.cornerStyle = .large
        cc.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16)
        cancelBtn.configuration = cc
        cancelBtn.addTarget(self, action: #selector(cancel), for: .touchUpInside)

        let sendBtn = UIButton(type: .system)
        var sc = UIButton.Configuration.filled()
        sc.title = "거절 전송"
        sc.baseBackgroundColor = UIColor(red: 0.93, green: 0.27, blue: 0.27, alpha: 1)
        sc.baseForegroundColor = .white
        sc.cornerStyle = .large
        sc.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16)
        sendBtn.configuration = sc
        sendBtn.addTarget(self, action: #selector(submit), for: .touchUpInside)

        let btnRow = UIStackView(arrangedSubviews: [cancelBtn, sendBtn])
        btnRow.axis = .horizontal
        btnRow.spacing = 10
        btnRow.distribution = .fillEqually

        let col = UIStackView(arrangedSubviews: [title, subtitle, textView, btnRow])
        col.axis = .vertical
        col.spacing = 12
        col.setCustomSpacing(6, after: title)
        col.translatesAutoresizingMaskIntoConstraints = false
        card.contentView.addSubview(col)

        cardCenterY = card.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        NSLayoutConstraint.activate([
            dim.topAnchor.constraint(equalTo: view.topAnchor),
            dim.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            dim.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            dim.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            card.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            cardCenterY,
            card.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 28),
            card.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -28),
            col.topAnchor.constraint(equalTo: card.contentView.topAnchor, constant: 22),
            col.bottomAnchor.constraint(equalTo: card.contentView.bottomAnchor, constant: -20),
            col.leadingAnchor.constraint(equalTo: card.contentView.leadingAnchor, constant: 20),
            col.trailingAnchor.constraint(equalTo: card.contentView.trailingAnchor, constant: -20),
            placeholderLabel.topAnchor.constraint(equalTo: textView.topAnchor, constant: 12),
            placeholderLabel.leadingAnchor.constraint(equalTo: textView.leadingAnchor, constant: 16),
            placeholderLabel.trailingAnchor.constraint(equalTo: textView.trailingAnchor, constant: -16),
        ])

        NotificationCenter.default.addObserver(self, selector: #selector(keyboardChange(_:)), name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        textView.becomeFirstResponder()
    }

    func textViewDidChange(_ tv: UITextView) {
        placeholderLabel.isHidden = !tv.text.isEmpty
    }

    @objc private func keyboardChange(_ note: Notification) {
        guard let frame = (note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue else { return }
        let overlap = max(0, view.bounds.height - frame.origin.y)
        cardCenterY.constant = overlap > 0 ? -overlap / 2 : 0
        UIView.animate(withDuration: 0.25) { self.view.layoutIfNeeded() }
    }

    @objc private func cancel() { view.endEditing(true); dismiss(animated: true) }

    @objc private func submit() {
        let msg = textView.text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !msg.isEmpty else {
            // 사유 미입력 시 흔들기 피드백
            Haptics.tap()
            let anim = CAKeyframeAnimation(keyPath: "transform.translation.x")
            anim.values = [-8, 8, -6, 6, -3, 3, 0]; anim.duration = 0.4
            textView.layer.add(anim, forKey: "shake")
            return
        }
        view.endEditing(true)
        let cb = onSubmit
        dismiss(animated: true) { cb?(msg) }
    }

    deinit { NotificationCenter.default.removeObserver(self) }
}
