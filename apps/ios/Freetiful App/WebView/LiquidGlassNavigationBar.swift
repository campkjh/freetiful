import UIKit

enum LiquidGlassEffectFactory {
    static var supportsNativeLiquidGlass: Bool {
        NSClassFromString("UIGlassEffect") is UIVisualEffect.Type
    }

    static func navigationEffect() -> UIVisualEffect {
        nativeGlassEffect(
            tintColor: UIColor.white.withAlphaComponent(0.08),
            isInteractive: true
        ) ?? UIBlurEffect(style: .systemUltraThinMaterial)
    }

    private static func nativeGlassEffect(tintColor: UIColor, isInteractive: Bool) -> UIVisualEffect? {
        guard let effectClass = NSClassFromString("UIGlassEffect") as? UIVisualEffect.Type else {
            return nil
        }

        let effect = effectClass.init()
        let object = effect as NSObject
        if object.responds(to: NSSelectorFromString("setTintColor:")) {
            object.setValue(tintColor, forKey: "tintColor")
        }
        if object.responds(to: NSSelectorFromString("setInteractive:")) {
            object.setValue(isInteractive, forKey: "interactive")
        }
        return effect
    }
}

struct LiquidNavItem: Equatable {
    let id: String
    let title: String
    let path: String
    let symbolName: String
}

protocol LiquidGlassNavigationBarDelegate: AnyObject {
    func liquidGlassNavigationBar(_ navBar: LiquidGlassNavigationBar, didSelect item: LiquidNavItem)
    func liquidGlassNavigationBarDidTapModeToggle(_ navBar: LiquidGlassNavigationBar)
}

final class LiquidGlassNavigationBar: UIView {
    weak var delegate: LiquidGlassNavigationBarDelegate?

    private let usesNativeLiquidGlass = LiquidGlassEffectFactory.supportsNativeLiquidGlass
    private let activeColor = UIColor(red: 0.07, green: 0.09, blue: 0.14, alpha: 1)
    private let inactiveColor = UIColor(red: 0.58, green: 0.62, blue: 0.68, alpha: 1)

    private let blurView = UIVisualEffectView(effect: LiquidGlassEffectFactory.navigationEffect())
    private let tintView = UIView()
    private let stackView = UIStackView()
    private let toggleButton = UIButton(type: .system)

    private var itemButtons: [String: UIButton] = [:]
    private var items: [LiquidNavItem] = []
    private var selectedPath = "/main"
    private var isProMode = false
    private var showsModeToggle = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }

    private func setupView() {
        translatesAutoresizingMaskIntoConstraints = false
        isAccessibilityElement = false

        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = usesNativeLiquidGlass ? 0.08 : 0.14
        layer.shadowRadius = usesNativeLiquidGlass ? 18 : 28
        layer.shadowOffset = CGSize(width: 0, height: usesNativeLiquidGlass ? 8 : 14)

        blurView.translatesAutoresizingMaskIntoConstraints = false
        blurView.clipsToBounds = true
        blurView.layer.cornerRadius = 30
        blurView.layer.cornerCurve = .continuous
        blurView.layer.borderWidth = usesNativeLiquidGlass ? 0 : 1
        blurView.layer.borderColor = UIColor.white.withAlphaComponent(0.58).cgColor
        addSubview(blurView)

        tintView.translatesAutoresizingMaskIntoConstraints = false
        tintView.backgroundColor = usesNativeLiquidGlass ? .clear : UIColor.white.withAlphaComponent(0.34)
        tintView.isUserInteractionEnabled = false
        blurView.contentView.addSubview(tintView)

        stackView.translatesAutoresizingMaskIntoConstraints = false
        stackView.axis = .horizontal
        stackView.alignment = .center
        stackView.distribution = .fillEqually
        stackView.spacing = 2

        toggleButton.translatesAutoresizingMaskIntoConstraints = false
        toggleButton.tintColor = inactiveColor
        toggleButton.backgroundColor = usesNativeLiquidGlass ? .clear : UIColor.white.withAlphaComponent(0.34)
        toggleButton.layer.cornerRadius = 20
        toggleButton.layer.cornerCurve = .continuous
        toggleButton.addTarget(self, action: #selector(didTapToggle), for: .touchUpInside)
        toggleButton.isHidden = true

        let content = UIStackView(arrangedSubviews: [toggleButton, stackView])
        content.translatesAutoresizingMaskIntoConstraints = false
        content.axis = .horizontal
        content.alignment = .center
        content.spacing = 6
        blurView.contentView.addSubview(content)

        NSLayoutConstraint.activate([
            blurView.topAnchor.constraint(equalTo: topAnchor),
            blurView.leadingAnchor.constraint(equalTo: leadingAnchor),
            blurView.trailingAnchor.constraint(equalTo: trailingAnchor),
            blurView.bottomAnchor.constraint(equalTo: bottomAnchor),

            tintView.topAnchor.constraint(equalTo: blurView.contentView.topAnchor),
            tintView.leadingAnchor.constraint(equalTo: blurView.contentView.leadingAnchor),
            tintView.trailingAnchor.constraint(equalTo: blurView.contentView.trailingAnchor),
            tintView.bottomAnchor.constraint(equalTo: blurView.contentView.bottomAnchor),

            content.topAnchor.constraint(equalTo: blurView.contentView.topAnchor, constant: 6),
            content.leadingAnchor.constraint(equalTo: blurView.contentView.leadingAnchor, constant: 8),
            content.trailingAnchor.constraint(equalTo: blurView.contentView.trailingAnchor, constant: -8),
            content.bottomAnchor.constraint(equalTo: blurView.contentView.bottomAnchor, constant: -6),

            toggleButton.widthAnchor.constraint(equalToConstant: 40),
            toggleButton.heightAnchor.constraint(equalToConstant: 40),
        ])
    }

    func configure(items: [LiquidNavItem],
                   selectedPath: String,
                   showsModeToggle: Bool,
                   isProMode: Bool) {
        let changedItems = self.items != items
        self.items = items
        self.selectedPath = selectedPath
        self.showsModeToggle = showsModeToggle
        self.isProMode = isProMode

        if changedItems {
            rebuildButtons()
        }
        updateModeToggle()
        updateSelection(animated: false)
    }

    func updateSelectedPath(_ path: String, animated: Bool = true) {
        selectedPath = path
        updateSelection(animated: animated)
    }

    func setVisible(_ visible: Bool, animated: Bool) {
        let changes = {
            self.alpha = visible ? 1 : 0
            self.transform = visible ? .identity : CGAffineTransform(translationX: 0, y: 22).scaledBy(x: 0.94, y: 0.94)
        }
        guard animated else {
            changes()
            return
        }
        UIView.animate(
            withDuration: 0.46,
            delay: 0,
            usingSpringWithDamping: 0.82,
            initialSpringVelocity: 0.3,
            options: [.allowUserInteraction, .beginFromCurrentState],
            animations: changes
        )
    }

    private func rebuildButtons() {
        itemButtons.removeAll()
        stackView.arrangedSubviews.forEach {
            stackView.removeArrangedSubview($0)
            $0.removeFromSuperview()
        }

        for item in items {
            let button = UIButton(type: .system)
            button.accessibilityLabel = item.title
            button.tintColor = inactiveColor
            button.tag = items.firstIndex(of: item) ?? 0
            button.addTarget(self, action: #selector(didTapItem(_:)), for: .touchUpInside)
            button.layer.cornerRadius = 18
            button.layer.cornerCurve = .continuous
            button.contentHorizontalAlignment = .center
            button.contentVerticalAlignment = .center
            itemButtons[item.id] = button
            stackView.addArrangedSubview(button)
        }
    }

    private func updateModeToggle() {
        toggleButton.isHidden = !showsModeToggle
        let symbol = isProMode ? "chevron.left" : "chevron.right"
        toggleButton.setImage(UIImage(systemName: symbol, withConfiguration: UIImage.SymbolConfiguration(pointSize: 15, weight: .bold)), for: .normal)
        toggleButton.accessibilityLabel = isProMode ? "일반회원으로 전환" : "프로회원으로 전환"
    }

    private func updateSelection(animated: Bool) {
        for item in items {
            guard let button = itemButtons[item.id] else { continue }
            let selected = isSelected(item)
            applyConfiguration(to: button, item: item, selected: selected)
            let updates = {
                button.backgroundColor = selected ? UIColor.white.withAlphaComponent(0.46) : .clear
                button.tintColor = selected ? self.activeColor : self.inactiveColor
                button.transform = selected ? CGAffineTransform(scaleX: 1.03, y: 1.03) : .identity
            }
            if animated {
                UIView.animate(withDuration: 0.24, delay: 0, options: [.allowUserInteraction, .beginFromCurrentState], animations: updates)
            } else {
                updates()
            }
        }
    }

    private func applyConfiguration(to button: UIButton, item: LiquidNavItem, selected: Bool) {
        var config = UIButton.Configuration.plain()
        config.image = UIImage(systemName: item.symbolName, withConfiguration: UIImage.SymbolConfiguration(pointSize: 19, weight: selected ? .bold : .semibold))
        config.imagePlacement = .top
        config.imagePadding = 2
        config.contentInsets = NSDirectionalEdgeInsets(top: 4, leading: 4, bottom: 3, trailing: 4)

        var attributes = AttributeContainer()
        attributes.font = UIFont.systemFont(ofSize: 9.5, weight: selected ? .bold : .semibold)
        config.attributedTitle = AttributedString(item.title, attributes: attributes)
        config.baseForegroundColor = selected ? activeColor : inactiveColor
        button.configuration = config
    }

    private func isSelected(_ item: LiquidNavItem) -> Bool {
        if item.path == "/main" {
            return selectedPath == "/" || selectedPath == "/main"
        }
        if item.path == "/pro-dashboard" {
            return selectedPath == "/pro-dashboard"
        }
        return selectedPath == item.path || selectedPath.hasPrefix(item.path + "/")
    }

    @objc private func didTapItem(_ sender: UIButton) {
        guard sender.tag >= 0, sender.tag < items.count else { return }
        let item = items[sender.tag]
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        animateTap(sender)
        updateSelectedPath(item.path)
        delegate?.liquidGlassNavigationBar(self, didSelect: item)
    }

    @objc private func didTapToggle() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        animateTap(toggleButton)
        delegate?.liquidGlassNavigationBarDidTapModeToggle(self)
    }

    private func animateTap(_ view: UIView) {
        UIView.animate(withDuration: 0.1, delay: 0, options: [.allowUserInteraction, .beginFromCurrentState]) {
            view.transform = CGAffineTransform(scaleX: 0.9, y: 0.9)
        } completion: { _ in
            UIView.animate(
                withDuration: 0.34,
                delay: 0,
                usingSpringWithDamping: 0.58,
                initialSpringVelocity: 0.7,
                options: [.allowUserInteraction, .beginFromCurrentState]
            ) {
                view.transform = .identity
            }
        }
    }
}
