import UIKit
import ObjectiveC

enum LiquidGlassEffectFactory {
    static var supportsNativeLiquidGlass: Bool {
        NSClassFromString("UIGlassEffect") is UIVisualEffect.Type
    }

    static func controlEffect() -> UIVisualEffect {
        nativeGlassEffect(
            tintColor: UIColor.white.withAlphaComponent(0.03),
            isInteractive: true,
            style: .clear
        ) ?? UIBlurEffect(style: .systemThinMaterial)
    }

    static func navigationEffect() -> UIVisualEffect {
        nativeGlassEffect(
            tintColor: UIColor.white.withAlphaComponent(0.03),
            isInteractive: true,
            style: .clear
        ) ?? UIBlurEffect(style: .systemUltraThinMaterial)
    }

    private enum NativeGlassStyle: Int {
        case regular = 0
        case clear = 1
    }

    private static func nativeGlassEffect(tintColor: UIColor,
                                          isInteractive: Bool,
                                          style: NativeGlassStyle) -> UIVisualEffect? {
        guard let effectClass = NSClassFromString("UIGlassEffect") as? UIVisualEffect.Type else {
            return nil
        }

        let effect: UIVisualEffect
        let styleSelector = NSSelectorFromString("effectWithStyle:")
        if
            let method = class_getClassMethod(effectClass, styleSelector)
        {
            typealias EffectWithStyle = @convention(c) (AnyClass, Selector, Int) -> UIVisualEffect
            let implementation = method_getImplementation(method)
            let makeEffect = unsafeBitCast(implementation, to: EffectWithStyle.self)
            effect = makeEffect(effectClass, styleSelector, style.rawValue)
        } else {
            effect = effectClass.init()
        }

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
    let iconAssetName: String
}

protocol LiquidGlassNavigationBarDelegate: AnyObject {
    func liquidGlassNavigationBar(_ navBar: LiquidGlassNavigationBar, didSelect item: LiquidNavItem)
    func liquidGlassNavigationBarDidTapModeToggle(_ navBar: LiquidGlassNavigationBar)
}

final class LiquidGlassNavigationBar: UIView, UITabBarDelegate {
    weak var delegate: LiquidGlassNavigationBarDelegate?

    private let usesNativeLiquidGlass = LiquidGlassEffectFactory.supportsNativeLiquidGlass
    private let freetifulBlue = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
    private lazy var activeColor = freetifulBlue
    private lazy var inactiveColor = freetifulBlue.withAlphaComponent(0.58)

    private let tabBar = UITabBar()
    private let toggleButton = UIButton(type: .system)
    private let contentStack = UIStackView()

    private var items: [LiquidNavItem] = []
    private var iconCache: [String: UIImage] = [:]
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
        contentStack.spacing = 10
        contentStack.addArrangedSubview(toggleButton)
        contentStack.addArrangedSubview(tabBar)
        addSubview(contentStack)

        NSLayoutConstraint.activate([
            contentStack.topAnchor.constraint(equalTo: topAnchor),
            contentStack.leadingAnchor.constraint(equalTo: leadingAnchor),
            contentStack.trailingAnchor.constraint(equalTo: trailingAnchor),
            contentStack.bottomAnchor.constraint(equalTo: bottomAnchor),

            toggleButton.widthAnchor.constraint(equalToConstant: 66),
            toggleButton.heightAnchor.constraint(equalToConstant: 66),

            tabBar.heightAnchor.constraint(equalTo: heightAnchor)
        ])
    }

    private func setupNavigationSurface() {
        tabBar.translatesAutoresizingMaskIntoConstraints = false
        tabBar.delegate = self
        tabBar.isTranslucent = true
        tabBar.tintColor = activeColor
        tabBar.unselectedItemTintColor = inactiveColor
        tabBar.itemPositioning = .fill
        tabBar.itemSpacing = 0
        tabBar.barTintColor = .clear
        tabBar.backgroundColor = UIColor.white.withAlphaComponent(0.03)
        tabBar.backgroundImage = UIImage()
        tabBar.shadowImage = UIImage()
        tabBar.clipsToBounds = true
        tabBar.layer.cornerRadius = 33
        tabBar.layer.cornerCurve = .continuous

        let appearance = UITabBarAppearance()
        appearance.configureWithTransparentBackground()
        appearance.backgroundEffect = nil
        appearance.backgroundColor = UIColor.white.withAlphaComponent(0.03)
        appearance.selectionIndicatorTintColor = UIColor.white.withAlphaComponent(0.03)
        appearance.shadowColor = .clear
        configureTabItemAppearance(appearance.stackedLayoutAppearance)
        configureTabItemAppearance(appearance.inlineLayoutAppearance)
        configureTabItemAppearance(appearance.compactInlineLayoutAppearance)
        tabBar.standardAppearance = appearance
        if #available(iOS 15.0, *) {
            tabBar.scrollEdgeAppearance = appearance
        }
    }

    private func setupToggleButton() {
        toggleButton.translatesAutoresizingMaskIntoConstraints = false
        toggleButton.tintColor = .black
        toggleButton.layer.cornerRadius = 33
        toggleButton.layer.cornerCurve = .continuous
        toggleButton.clipsToBounds = true
        toggleButton.isHidden = true
        toggleButton.addTarget(self, action: #selector(didTapToggle), for: .touchUpInside)
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
            rebuildTabBarItems()
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

    private func rebuildTabBarItems() {
        tabBar.items = items.enumerated().map { index, item in
            let icon = navIcon(named: item.iconAssetName)
            let tabItem = UITabBarItem(title: item.title, image: icon, selectedImage: icon)
            tabItem.tag = index
            tabItem.accessibilityLabel = item.title
            tabItem.imageInsets = UIEdgeInsets(top: -4, left: 0, bottom: 4, right: 0)
            return tabItem
        }
    }

    private func updateModeToggle() {
        toggleButton.isHidden = !showsModeToggle
        let symbol = isProMode ? "chevron.left" : "chevron.right"
        var configuration = makeGlassConfiguration(selected: false, isToggle: true)
        configuration.image = UIImage(
            systemName: symbol,
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 13, weight: .bold)
        )
        configuration.baseForegroundColor = .black
        configuration.imagePadding = 0
        configuration.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0)
        toggleButton.configuration = configuration
        toggleButton.accessibilityLabel = isProMode ? "일반회원으로 전환" : "프로회원으로 전환"
    }

    private func updateSelection(animated _: Bool) {
        let selectedIndex = items.firstIndex(where: isSelected)
        guard
            let selectedIndex,
            let tabItems = tabBar.items,
            selectedIndex >= 0,
            selectedIndex < tabItems.count
        else {
            tabBar.selectedItem = nil
            return
        }
        tabBar.selectedItem = tabItems[selectedIndex]
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
        delegate?.liquidGlassNavigationBarDidTapModeToggle(self)
    }

    private func makeGlassConfiguration(selected: Bool, isToggle: Bool) -> UIButton.Configuration {
        let configuration: UIButton.Configuration
        if #available(iOS 26.0, *) {
            configuration = selected ? .prominentClearGlass() : .clearGlass()
        } else {
            configuration = .plain()
        }

        var tuned = configuration
        tuned.cornerStyle = .capsule
        tuned.automaticallyUpdateForSelection = true
        if !usesNativeLiquidGlass {
            tuned.background.backgroundColor = selected ? freetifulBlue.withAlphaComponent(0.10) : UIColor.white.withAlphaComponent(isToggle ? 0.06 : 0.02)
        }
        return tuned
    }

    private func configureTabItemAppearance(_ itemAppearance: UITabBarItemAppearance) {
        itemAppearance.normal.iconColor = inactiveColor
        itemAppearance.normal.titleTextAttributes = [
            .foregroundColor: inactiveColor,
            .font: UIFont.systemFont(ofSize: 9, weight: .semibold),
        ]
        itemAppearance.normal.titlePositionAdjustment = UIOffset(horizontal: 0, vertical: 4)
        itemAppearance.selected.iconColor = activeColor
        itemAppearance.selected.titleTextAttributes = [
            .foregroundColor: activeColor,
            .font: UIFont.systemFont(ofSize: 9, weight: .bold),
        ]
        itemAppearance.selected.titlePositionAdjustment = UIOffset(horizontal: 0, vertical: 4)
    }

    private func navIcon(named assetName: String) -> UIImage? {
        if let cached = iconCache[assetName] {
            return cached
        }
        guard let source = UIImage(named: assetName)?.withRenderingMode(.alwaysTemplate) else {
            return nil
        }

        let size = CGSize(width: 16, height: 16)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = UIScreen.main.scale
        let image = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            source.draw(in: CGRect(origin: .zero, size: size))
        }.withRenderingMode(.alwaysTemplate)
        iconCache[assetName] = image
        return image
    }
}
