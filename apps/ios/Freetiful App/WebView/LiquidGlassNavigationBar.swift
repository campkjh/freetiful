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

final class LiquidGlassNavigationBar: UIView, UITabBarDelegate {
    weak var delegate: LiquidGlassNavigationBarDelegate?

    private let usesNativeLiquidGlass = LiquidGlassEffectFactory.supportsNativeLiquidGlass
    private let activeColor = UIColor(red: 0.07, green: 0.09, blue: 0.14, alpha: 1)
    private let inactiveColor = UIColor(red: 0.58, green: 0.62, blue: 0.68, alpha: 1)

    private let tabBar = UITabBar()
    private let toggleEffectView = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
    private let toggleButton = UIButton(type: .system)
    private let contentStack = UIStackView()

    private var items: [LiquidNavItem] = []
    private var tabItems: [UITabBarItem] = []
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
        layer.shadowOpacity = usesNativeLiquidGlass ? 0.08 : 0.14
        layer.shadowRadius = usesNativeLiquidGlass ? 18 : 28
        layer.shadowOffset = CGSize(width: 0, height: usesNativeLiquidGlass ? 8 : 14)

        setupTabBar()
        setupToggleButton()

        contentStack.translatesAutoresizingMaskIntoConstraints = false
        contentStack.axis = .horizontal
        contentStack.alignment = .center
        contentStack.distribution = .fill
        contentStack.spacing = 8
        contentStack.addArrangedSubview(toggleEffectView)
        contentStack.addArrangedSubview(tabBar)
        addSubview(contentStack)

        NSLayoutConstraint.activate([
            contentStack.topAnchor.constraint(equalTo: topAnchor),
            contentStack.leadingAnchor.constraint(equalTo: leadingAnchor),
            contentStack.trailingAnchor.constraint(equalTo: trailingAnchor),
            contentStack.bottomAnchor.constraint(equalTo: bottomAnchor),

            toggleEffectView.widthAnchor.constraint(equalToConstant: 44),
            toggleEffectView.heightAnchor.constraint(equalToConstant: 44),

            tabBar.heightAnchor.constraint(equalTo: heightAnchor)
        ])
    }

    private func setupTabBar() {
        tabBar.translatesAutoresizingMaskIntoConstraints = false
        tabBar.delegate = self
        tabBar.isTranslucent = true
        tabBar.tintColor = activeColor
        tabBar.unselectedItemTintColor = inactiveColor
        tabBar.itemPositioning = .automatic
        tabBar.backgroundColor = .clear
        tabBar.barTintColor = .clear

        if !usesNativeLiquidGlass {
            applyFallbackTabBarAppearance()
            tabBar.clipsToBounds = true
            tabBar.layer.cornerRadius = 30
            tabBar.layer.cornerCurve = .continuous
            tabBar.layer.borderWidth = 1
            tabBar.layer.borderColor = UIColor.white.withAlphaComponent(0.58).cgColor
        }
    }

    private func applyFallbackTabBarAppearance() {
        if #available(iOS 13.0, *) {
            let appearance = UITabBarAppearance()
            appearance.configureWithTransparentBackground()
            appearance.backgroundEffect = UIBlurEffect(style: .systemUltraThinMaterial)
            appearance.backgroundColor = UIColor.white.withAlphaComponent(0.34)
            appearance.shadowColor = .clear

            let itemAppearance = UITabBarItemAppearance()
            itemAppearance.normal.iconColor = inactiveColor
            itemAppearance.normal.titleTextAttributes = [
                .foregroundColor: inactiveColor,
                .font: UIFont.systemFont(ofSize: 10, weight: .semibold)
            ]
            itemAppearance.selected.iconColor = activeColor
            itemAppearance.selected.titleTextAttributes = [
                .foregroundColor: activeColor,
                .font: UIFont.systemFont(ofSize: 10, weight: .bold)
            ]

            appearance.stackedLayoutAppearance = itemAppearance
            appearance.inlineLayoutAppearance = itemAppearance
            appearance.compactInlineLayoutAppearance = itemAppearance
            tabBar.standardAppearance = appearance
            if #available(iOS 15.0, *) {
                tabBar.scrollEdgeAppearance = appearance
            }
        } else {
            tabBar.backgroundImage = UIImage()
            tabBar.shadowImage = UIImage()
        }
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
            rebuildTabItems()
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

    private func rebuildTabItems() {
        tabItems = items.enumerated().map { index, item in
            let image = UIImage(
                systemName: item.symbolName,
                withConfiguration: UIImage.SymbolConfiguration(pointSize: 19, weight: .semibold)
            )
            let selectedImage = UIImage(
                systemName: item.symbolName,
                withConfiguration: UIImage.SymbolConfiguration(pointSize: 19, weight: .bold)
            )
            let tabItem = UITabBarItem(title: item.title, image: image, selectedImage: selectedImage)
            tabItem.tag = index
            tabItem.accessibilityLabel = item.title
            return tabItem
        }
        tabBar.setItems(tabItems, animated: false)
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
        guard let selectedIndex = items.firstIndex(where: isSelected), selectedIndex < tabItems.count else {
            tabBar.selectedItem = nil
            return
        }

        let selectedItem = tabItems[selectedIndex]
        if animated {
            UIView.transition(with: tabBar, duration: 0.18, options: [.transitionCrossDissolve, .allowUserInteraction]) {
                self.tabBar.selectedItem = selectedItem
            }
        } else {
            tabBar.selectedItem = selectedItem
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

    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        guard item.tag >= 0, item.tag < items.count else { return }
        let navItem = items[item.tag]
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        selectedPath = navItem.path
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
