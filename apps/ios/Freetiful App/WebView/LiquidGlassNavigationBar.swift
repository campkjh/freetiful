import UIKit

enum LiquidGlassEffectFactory {
    static var supportsNativeLiquidGlass: Bool {
        NSClassFromString("UIGlassEffect") is UIVisualEffect.Type
    }

    static func controlEffect() -> UIVisualEffect {
        nativeGlassEffect(
            tintColor: UIColor.white.withAlphaComponent(0.12),
            isInteractive: true
        ) ?? UIBlurEffect(style: .systemThinMaterial)
    }

    static func navigationEffect() -> UIVisualEffect {
        nativeGlassEffect(
            tintColor: UIColor.white.withAlphaComponent(0.20),
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
    private let inactiveColor = UIColor(red: 0.29, green: 0.32, blue: 0.38, alpha: 0.72)

    private let navEffectView = UIVisualEffectView(effect: LiquidGlassEffectFactory.navigationEffect())
    private let tabStack = UIStackView()
    private let toggleEffectView = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
    private let toggleButton = UIButton(type: .system)
    private let contentStack = UIStackView()

    private var items: [LiquidNavItem] = []
    private var buttons: [UIButton] = []
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
        backgroundColor = .clear
        isAccessibilityElement = false

        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = usesNativeLiquidGlass ? 0.10 : 0.14
        layer.shadowRadius = usesNativeLiquidGlass ? 22 : 28
        layer.shadowOffset = CGSize(width: 0, height: usesNativeLiquidGlass ? 10 : 14)

        setupNavigationSurface()
        setupToggleButton()

        contentStack.translatesAutoresizingMaskIntoConstraints = false
        contentStack.axis = .horizontal
        contentStack.alignment = .center
        contentStack.distribution = .fill
        contentStack.spacing = 8
        contentStack.addArrangedSubview(toggleEffectView)
        contentStack.addArrangedSubview(navEffectView)
        addSubview(contentStack)

        NSLayoutConstraint.activate([
            contentStack.topAnchor.constraint(equalTo: topAnchor),
            contentStack.leadingAnchor.constraint(equalTo: leadingAnchor),
            contentStack.trailingAnchor.constraint(equalTo: trailingAnchor),
            contentStack.bottomAnchor.constraint(equalTo: bottomAnchor),

            toggleEffectView.widthAnchor.constraint(equalToConstant: 44),
            toggleEffectView.heightAnchor.constraint(equalToConstant: 44),

            navEffectView.heightAnchor.constraint(equalTo: heightAnchor)
        ])
    }

    private func setupNavigationSurface() {
        navEffectView.translatesAutoresizingMaskIntoConstraints = false
        navEffectView.clipsToBounds = true
        navEffectView.layer.cornerRadius = 30
        navEffectView.layer.cornerCurve = .continuous

        if !usesNativeLiquidGlass {
            navEffectView.backgroundColor = UIColor.white.withAlphaComponent(0.32)
            navEffectView.layer.borderWidth = 1
            navEffectView.layer.borderColor = UIColor.white.withAlphaComponent(0.58).cgColor
        }

        tabStack.translatesAutoresizingMaskIntoConstraints = false
        tabStack.axis = .horizontal
        tabStack.alignment = .center
        tabStack.distribution = .fillEqually
        tabStack.spacing = 2
        navEffectView.contentView.addSubview(tabStack)

        NSLayoutConstraint.activate([
            tabStack.topAnchor.constraint(equalTo: navEffectView.contentView.topAnchor, constant: 6),
            tabStack.leadingAnchor.constraint(equalTo: navEffectView.contentView.leadingAnchor, constant: 6),
            tabStack.trailingAnchor.constraint(equalTo: navEffectView.contentView.trailingAnchor, constant: -6),
            tabStack.bottomAnchor.constraint(equalTo: navEffectView.contentView.bottomAnchor, constant: -6)
        ])
    }

    private func setupToggleButton() {
        toggleEffectView.translatesAutoresizingMaskIntoConstraints = false
        toggleEffectView.clipsToBounds = true
        toggleEffectView.layer.cornerRadius = 22
        toggleEffectView.layer.cornerCurve = .continuous
        toggleEffectView.isHidden = true

        toggleButton.translatesAutoresizingMaskIntoConstraints = false
        toggleButton.tintColor = inactiveColor
        toggleButton.addTarget(self, action: #selector(didTapToggle), for: .touchUpInside)
        toggleEffectView.contentView.addSubview(toggleButton)

        NSLayoutConstraint.activate([
            toggleButton.topAnchor.constraint(equalTo: toggleEffectView.contentView.topAnchor),
            toggleButton.leadingAnchor.constraint(equalTo: toggleEffectView.contentView.leadingAnchor),
            toggleButton.trailingAnchor.constraint(equalTo: toggleEffectView.contentView.trailingAnchor),
            toggleButton.bottomAnchor.constraint(equalTo: toggleEffectView.contentView.bottomAnchor)
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
        tabStack.arrangedSubviews.forEach { view in
            tabStack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }

        buttons = items.enumerated().map { index, item in
            let button = UIButton(type: .system)
            button.translatesAutoresizingMaskIntoConstraints = false
            button.tag = index
            button.accessibilityLabel = item.title
            button.layer.cornerRadius = 24
            button.layer.cornerCurve = .continuous
            button.clipsToBounds = true
            button.addTarget(self, action: #selector(didTapItem(_:)), for: .touchUpInside)
            button.heightAnchor.constraint(equalToConstant: 48).isActive = true

            var configuration = UIButton.Configuration.plain()
            configuration.title = item.title
            configuration.imagePlacement = .top
            configuration.imagePadding = 1
            configuration.contentInsets = NSDirectionalEdgeInsets(top: 5, leading: 0, bottom: 3, trailing: 0)
            configuration.baseForegroundColor = inactiveColor
            configuration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
                var outgoing = incoming
                outgoing.font = UIFont.systemFont(ofSize: 10, weight: .semibold)
                return outgoing
            }
            button.configuration = configuration
            button.titleLabel?.adjustsFontSizeToFitWidth = true
            button.titleLabel?.minimumScaleFactor = 0.78
            button.titleLabel?.lineBreakMode = .byClipping

            tabStack.addArrangedSubview(button)
            return button
        }
    }

    private func updateModeToggle() {
        toggleEffectView.isHidden = !showsModeToggle
        let symbol = isProMode ? "chevron.left" : "chevron.right"
        toggleButton.setImage(
            UIImage(systemName: symbol, withConfiguration: UIImage.SymbolConfiguration(pointSize: 15, weight: .bold)),
            for: .normal
        )
        toggleButton.accessibilityLabel = isProMode ? "일반회원으로 전환" : "프로회원으로 전환"
    }

    private func updateSelection(animated: Bool) {
        let selectedIndex = items.firstIndex(where: isSelected)
        let updates = {
            self.buttons.enumerated().forEach { index, button in
                guard index < self.items.count else { return }
                let item = self.items[index]
                let isSelected = index == selectedIndex
                var configuration = button.configuration ?? .plain()
                configuration.image = UIImage(
                    systemName: item.symbolName,
                    withConfiguration: UIImage.SymbolConfiguration(
                        pointSize: isSelected ? 19 : 18,
                        weight: isSelected ? .bold : .semibold
                    )
                )
                configuration.baseForegroundColor = isSelected ? self.activeColor : self.inactiveColor
                configuration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
                    var outgoing = incoming
                    outgoing.font = UIFont.systemFont(ofSize: 10, weight: isSelected ? .bold : .semibold)
                    return outgoing
                }
                button.configuration = configuration
                button.backgroundColor = isSelected ? UIColor.white.withAlphaComponent(self.usesNativeLiquidGlass ? 0.30 : 0.44) : .clear
            }
        }

        if animated {
            UIView.transition(
                with: navEffectView,
                duration: 0.18,
                options: [.transitionCrossDissolve, .allowUserInteraction],
                animations: updates
            )
        } else {
            updates()
        }
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
        let navItem = items[sender.tag]
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        animateTap(sender)
        selectedPath = navItem.path
        updateSelection(animated: true)
        delegate?.liquidGlassNavigationBar(self, didSelect: navItem)
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
