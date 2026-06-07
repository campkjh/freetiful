import UIKit

protocol NativeSearchDelegate: AnyObject {
    func searchDidTapPro(_ id: String)
    func searchDidCancel()
}

// 검색 화면 네이티브 — 글래스 검색바 + 결과(사회자 카드) 리스트
final class NativeSearchContent: UIView, UITextFieldDelegate {
    weak var delegate: NativeSearchDelegate?

    private let searchPill = GlassPill(corner: 21)
    private let field = UITextField()
    private let cancelButton = UIButton(type: .system)
    private let scrollView = UIScrollView()
    private let stack = UIStackView()
    private let emptyLabel = UILabel()
    private var debounce: DispatchWorkItem?
    private var barTop: NSLayoutConstraint!

    override init(frame: CGRect) { super.init(frame: frame); setup() }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setInsets(top: CGFloat, bottom: CGFloat) {
        barTop?.constant = top
        scrollView.contentInset = UIEdgeInsets(top: 0, left: 0, bottom: bottom, right: 0)
        scrollView.verticalScrollIndicatorInsets = UIEdgeInsets(top: 0, left: 0, bottom: bottom, right: 0)
    }

    func focus() { field.becomeFirstResponder() }
    func resignSearch() { field.resignFirstResponder() }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .white

        // 검색바
        let magnifier = UIImageView(image: UIImage(systemName: "magnifyingglass", withConfiguration: UIImage.SymbolConfiguration(pointSize: 15, weight: .semibold)))
        magnifier.tintColor = UIColor(white: 0.55, alpha: 1)
        magnifier.setContentHuggingPriority(.required, for: .horizontal)

        field.placeholder = "어떤 사회자를 찾으시나요?"
        field.font = .systemFont(ofSize: 15, weight: .medium)
        field.textColor = UIColor(white: 0.1, alpha: 1)
        field.returnKeyType = .search
        field.clearButtonMode = .whileEditing
        field.autocorrectionType = .no
        field.delegate = self
        field.addTarget(self, action: #selector(textChanged), for: .editingChanged)

        let barRow = UIStackView(arrangedSubviews: [magnifier, field])
        barRow.axis = .horizontal
        barRow.spacing = 8
        barRow.alignment = .center
        searchPill.setContent(barRow, insets: UIEdgeInsets(top: 0, left: 14, bottom: 0, right: 12))
        addSubview(searchPill)

        var cc = UIButton.Configuration.plain()
        cc.title = "취소"
        cc.baseForegroundColor = UIColor(white: 0.3, alpha: 1)
        cc.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 6, bottom: 0, trailing: 0)
        cancelButton.configuration = cc
        cancelButton.setContentHuggingPriority(.required, for: .horizontal)
        cancelButton.addTarget(self, action: #selector(cancel), for: .touchUpInside)
        addSubview(cancelButton)

        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = true
        scrollView.keyboardDismissMode = .onDrag
        scrollView.showsVerticalScrollIndicator = false
        scrollView.contentInsetAdjustmentBehavior = .never
        addSubview(scrollView)

        stack.axis = .vertical
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(stack)

        emptyLabel.text = "사회자 이름·지역·키워드로 검색해 보세요"
        emptyLabel.font = .systemFont(ofSize: 14)
        emptyLabel.textColor = UIColor(white: 0.6, alpha: 1)
        emptyLabel.textAlignment = .center
        emptyLabel.numberOfLines = 0
        emptyLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(emptyLabel)

        barTop = searchPill.topAnchor.constraint(equalTo: topAnchor, constant: 0)
        NSLayoutConstraint.activate([
            barTop,
            searchPill.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
            searchPill.heightAnchor.constraint(equalToConstant: 42),
            cancelButton.leadingAnchor.constraint(equalTo: searchPill.trailingAnchor, constant: 4),
            cancelButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            cancelButton.centerYAnchor.constraint(equalTo: searchPill.centerYAnchor),

            scrollView.topAnchor.constraint(equalTo: searchPill.bottomAnchor, constant: 8),
            scrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: bottomAnchor),
            stack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 6),
            stack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 14),
            stack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -14),
            stack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -24),
            emptyLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            emptyLabel.topAnchor.constraint(equalTo: scrollView.topAnchor, constant: 60),
            emptyLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 32),
            emptyLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -32),
        ])
    }

    @objc private func textChanged() {
        let q = field.text ?? ""
        debounce?.cancel()
        if q.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            render([]); emptyLabel.text = "사회자 이름·지역·키워드로 검색해 보세요"; emptyLabel.isHidden = false
            return
        }
        let work = DispatchWorkItem { [weak self] in
            NativeHomeData.search(q) { [weak self] items in self?.render(items) }
        }
        debounce = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3, execute: work)
    }

    private func render(_ items: [HomeProItem]) {
        stack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        let hasQuery = !((field.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        if items.isEmpty {
            emptyLabel.isHidden = false
            emptyLabel.text = hasQuery ? "검색 결과가 없습니다" : "사회자 이름·지역·키워드로 검색해 보세요"
            return
        }
        emptyLabel.isHidden = true
        for item in items {
            let cell = HomeProCell(item: item)
            cell.onTap = { [weak self] id in self?.delegate?.searchDidTapPro(id) }
            stack.addArrangedSubview(cell)
        }
    }

    func textFieldShouldReturn(_ tf: UITextField) -> Bool { tf.resignFirstResponder(); return true }
    @objc private func cancel() {
        field.text = ""; render([]); field.resignFirstResponder()
        delegate?.searchDidCancel()
    }
}
