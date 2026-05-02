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

private final class FreetifulNativeTabBar: UITabBar {
    private let preferredBarHeight: CGFloat = 66
    private let selectionIndicatorInset: CGFloat = 3
    private let glassSurfaceView = UIVisualEffectView(effect: LiquidGlassEffectFactory.navigationEffect())
    private let glassTintView = UIView()
    private let fullHeightSelectionView = UIView()
    private var shouldAnimateNextSelectionLayout = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupGlassSurface()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupGlassSurface()
    }

    override func sizeThatFits(_ size: CGSize) -> CGSize {
        var fittedSize = super.sizeThatFits(size)
        fittedSize.height = preferredBarHeight
        return fittedSize
    }

    override var intrinsicContentSize: CGSize {
        CGSize(width: UIView.noIntrinsicMetric, height: preferredBarHeight)
    }

    override func layoutSubviews() {
        super.layoutSubviews()

        glassSurfaceView.frame = bounds
        glassTintView.frame = glassSurfaceView.bounds
        sendSubviewToBack(glassSurfaceView)

        let tabButtons = subviews
            .filter { String(describing: type(of: $0)).contains("UITabBarButton") }
            .sorted { $0.frame.minX < $1.frame.minX }

        if !tabButtons.isEmpty {
            let itemWidth = bounds.width / CGFloat(tabButtons.count)
            tabButtons.enumerated().forEach { index, button in
                button.frame = CGRect(
                    x: CGFloat(index) * itemWidth,
                    y: 0,
                    width: itemWidth,
                    height: bounds.height
                )
                hideSystemTabButtonChrome(in: button)
            }
        }

        subviews.forEach { subview in
            let typeName = String(describing: type(of: subview))
            if typeName.contains("UIBarBackground") {
                subview.frame = bounds
                subview.isHidden = true
            }
        }

        updateFullHeightSelection(toMatch: tabButtons, animated: shouldAnimateNextSelectionLayout)
        shouldAnimateNextSelectionLayout = false
        stretchSelectionIndicator(toMatch: tabButtons)
    }

    func relayoutSelection(animated: Bool) {
        shouldAnimateNextSelectionLayout = animated
        setNeedsLayout()
        layoutIfNeeded()
    }

    private func hideSystemTabButtonChrome(in button: UIView) {
        button.backgroundColor = .clear
        button.isOpaque = false
        button.tintColor = .clear
        button.layer.backgroundColor = UIColor.clear.cgColor
        button.layer.borderWidth = 0
        button.layer.shadowOpacity = 0
        button.subviews.forEach { view in
            if isSelectionIndicatorView(view) {
                view.isHidden = false
                view.alpha = 1
                return
            }
            view.isHidden = true
            view.alpha = 0
        }
    }

    private func stretchSelectionIndicator(toMatch tabButtons: [UIView]) {
        guard
            let selectedItem,
            let selectedIndex = items?.firstIndex(where: { $0 === selectedItem }),
            selectedIndex >= 0,
            selectedIndex < tabButtons.count
        else { return }

        let targetFrame = tabButtons[selectedIndex].frame.insetBy(
            dx: selectionIndicatorInset,
            dy: selectionIndicatorInset
        )

        for indicatorView in selectionIndicatorViews(in: self) {
            guard indicatorView !== glassSurfaceView else { continue }
            guard let parent = indicatorView.superview else { continue }
            let convertedFrame = convert(targetFrame, to: parent)
            indicatorView.frame = convertedFrame
            indicatorView.layer.cornerRadius = convertedFrame.height / 2
            indicatorView.layer.cornerCurve = .continuous
            indicatorView.clipsToBounds = true
            indicatorView.isHidden = false
            indicatorView.alpha = 1
        }
    }

    private func selectionIndicatorViews(in root: UIView) -> [UIView] {
        root.subviews.flatMap { subview -> [UIView] in
            let nested = selectionIndicatorViews(in: subview)
            return isSelectionIndicatorView(subview) ? [subview] + nested : nested
        }
    }

    private func isSelectionIndicatorView(_ view: UIView) -> Bool {
        let typeName = String(describing: type(of: view))
        if typeName.localizedCaseInsensitiveContains("selection") {
            return true
        }
        guard
            let imageView = view as? UIImageView,
            let image = imageView.image,
            let indicatorImage = selectionIndicatorImage
        else {
            return false
        }

        if image === indicatorImage {
            return true
        }

        let sizeMatchesIndicator = abs(image.size.width - indicatorImage.size.width) < 1 &&
            abs(image.size.height - indicatorImage.size.height) < 1
        let sitsInsideTabButton = sequence(first: imageView.superview, next: { $0?.superview })
            .contains { parent in
                String(describing: type(of: parent)).contains("UITabBarButton")
            }

        return sizeMatchesIndicator && sitsInsideTabButton
    }

    private func updateFullHeightSelection(toMatch tabButtons: [UIView], animated: Bool) {
        guard
            let selectedItem,
            let selectedIndex = items?.firstIndex(where: { $0 === selectedItem }),
            selectedIndex >= 0,
            selectedIndex < tabButtons.count
        else {
            fullHeightSelectionView.alpha = 0
            return
        }

        let targetFrame = tabButtons[selectedIndex].frame.insetBy(
            dx: selectionIndicatorInset,
            dy: selectionIndicatorInset
        )

        let changes = {
            self.fullHeightSelectionView.alpha = 1
            self.fullHeightSelectionView.frame = targetFrame
            self.fullHeightSelectionView.layer.cornerRadius = targetFrame.height / 2
        }

        guard animated, fullHeightSelectionView.alpha > 0 else {
            changes()
            return
        }

        UIView.animate(
            withDuration: 0.32,
            delay: 0,
            usingSpringWithDamping: 0.82,
            initialSpringVelocity: 0.25,
            options: [.allowUserInteraction, .beginFromCurrentState],
            animations: changes
        )
    }

    private func setupGlassSurface() {
        backgroundColor = .clear
        isTranslucent = true
        clipsToBounds = true
        layer.cornerRadius = preferredBarHeight / 2
        layer.cornerCurve = .continuous

        glassSurfaceView.isUserInteractionEnabled = false
        glassSurfaceView.clipsToBounds = true
        glassSurfaceView.layer.cornerRadius = preferredBarHeight / 2
        glassSurfaceView.layer.cornerCurve = .continuous
        glassSurfaceView.layer.borderWidth = 0.5
        glassSurfaceView.layer.borderColor = UIColor.white.withAlphaComponent(0.24).cgColor

        glassTintView.isUserInteractionEnabled = false
        glassTintView.backgroundColor = UIColor.white.withAlphaComponent(0.03)
        glassSurfaceView.contentView.addSubview(glassTintView)
        insertSubview(glassSurfaceView, at: 0)

        fullHeightSelectionView.isUserInteractionEnabled = false
        fullHeightSelectionView.backgroundColor = UIColor(white: 0.88, alpha: 0.68)
        fullHeightSelectionView.clipsToBounds = true
        fullHeightSelectionView.layer.cornerCurve = .continuous
        fullHeightSelectionView.alpha = 0
        insertSubview(fullHeightSelectionView, aboveSubview: glassSurfaceView)
    }
}

private final class FreetifulTabOverlayButton: UIControl {
    private let preferredHeight: CGFloat = 66
    private let iconView = UIImageView()
    private let label = UILabel()
    private var activeColor: UIColor
    private var inactiveColor: UIColor

    init(title: String, icon: UIImage?, activeColor: UIColor, inactiveColor: UIColor) {
        self.activeColor = activeColor
        self.inactiveColor = inactiveColor
        super.init(frame: .zero)
        setup(title: title, icon: icon)
    }

    required init?(coder: NSCoder) {
        activeColor = .systemBlue
        inactiveColor = .systemBlue.withAlphaComponent(0.58)
        super.init(coder: coder)
        setup(title: "", icon: nil)
    }

    override var isSelected: Bool {
        didSet { updateAppearance() }
    }

    override var isHighlighted: Bool {
        didSet {
            UIView.animate(withDuration: 0.14) {
                self.transform = self.isHighlighted ? CGAffineTransform(scaleX: 0.94, y: 0.94) : .identity
            }
        }
    }

    override var intrinsicContentSize: CGSize {
        CGSize(width: UIView.noIntrinsicMetric, height: preferredHeight)
    }

    func setSelectedState(_ selected: Bool, animated: Bool) {
        guard isSelected != selected else { return }
        isSelected = selected

        guard animated, selected else {
            iconView.transform = .identity
            label.transform = .identity
            return
        }

        iconView.transform = CGAffineTransform(scaleX: 0.84, y: 0.84)
        label.transform = CGAffineTransform(translationX: 0, y: 2)
        UIView.animate(
            withDuration: 0.34,
            delay: 0,
            usingSpringWithDamping: 0.68,
            initialSpringVelocity: 0.35,
            options: [.allowUserInteraction, .beginFromCurrentState],
            animations: {
                self.iconView.transform = .identity
                self.label.transform = .identity
            }
        )
    }

    private func setup(title: String, icon: UIImage?) {
        backgroundColor = .clear
        isAccessibilityElement = true
        accessibilityLabel = title

        iconView.translatesAutoresizingMaskIntoConstraints = false
        iconView.image = icon
        iconView.contentMode = .scaleAspectFit
        iconView.tintColor = inactiveColor

        label.translatesAutoresizingMaskIntoConstraints = false
        label.text = title
        label.textAlignment = .center
        label.font = UIFont.systemFont(ofSize: 9, weight: .semibold)
        label.textColor = inactiveColor
        label.adjustsFontSizeToFitWidth = true
        label.minimumScaleFactor = 0.78
        label.lineBreakMode = .byClipping

        addSubview(iconView)
        addSubview(label)

        NSLayoutConstraint.activate([
            heightAnchor.constraint(greaterThanOrEqualToConstant: preferredHeight),

            iconView.centerYAnchor.constraint(equalTo: centerYAnchor, constant: -10),
            iconView.centerXAnchor.constraint(equalTo: centerXAnchor),
            iconView.widthAnchor.constraint(equalToConstant: 18),
            iconView.heightAnchor.constraint(equalToConstant: 18),

            label.topAnchor.constraint(equalTo: iconView.bottomAnchor, constant: 4),
            label.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 1),
            label.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -1),
            label.heightAnchor.constraint(equalToConstant: 15)
        ])
        updateAppearance()
    }

    private func updateAppearance() {
        let color = isSelected ? activeColor : inactiveColor
        iconView.tintColor = color
        label.textColor = color
        label.font = UIFont.systemFont(ofSize: 9, weight: isSelected ? .bold : .semibold)
    }
}

final class LiquidGlassNavigationBar: UIView, UITabBarDelegate {
    weak var delegate: LiquidGlassNavigationBarDelegate?

    private let usesNativeLiquidGlass = LiquidGlassEffectFactory.supportsNativeLiquidGlass
    private let freetifulBlue = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
    private lazy var activeColor = freetifulBlue
    private lazy var inactiveColor = freetifulBlue.withAlphaComponent(0.58)

    private let tabBar = FreetifulNativeTabBar()
    private let tabOverlayStack = UIStackView()
    private let toggleContainerView = UIView()
    private let toggleSurfaceView = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
    private let toggleTintView = UIView()
    private let toggleButton = UIButton(type: .system)
    private let contentStack = UIStackView()

    private var items: [LiquidNavItem] = []
    private var tabButtons: [FreetifulTabOverlayButton] = []
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

    override func layoutSubviews() {
        super.layoutSubviews()
        updateSelectionIndicatorImage()
        tabBar.bringSubviewToFront(tabOverlayStack)
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
        contentStack.alignment = .fill
        contentStack.distribution = .fill
        contentStack.spacing = 10
        contentStack.addArrangedSubview(toggleContainerView)
        contentStack.addArrangedSubview(tabBar)
        addSubview(contentStack)

        NSLayoutConstraint.activate([
            contentStack.topAnchor.constraint(equalTo: topAnchor),
            contentStack.leadingAnchor.constraint(equalTo: leadingAnchor),
            contentStack.trailingAnchor.constraint(equalTo: trailingAnchor),
            contentStack.bottomAnchor.constraint(equalTo: bottomAnchor),

            toggleContainerView.widthAnchor.constraint(equalToConstant: 66),
            toggleContainerView.heightAnchor.constraint(equalToConstant: 66),

            tabBar.heightAnchor.constraint(equalTo: heightAnchor)
        ])
    }

    private func setupNavigationSurface() {
        tabBar.translatesAutoresizingMaskIntoConstraints = false
        tabBar.delegate = self
        tabBar.isUserInteractionEnabled = true
        tabBar.isTranslucent = true
        tabBar.tintColor = activeColor
        tabBar.unselectedItemTintColor = inactiveColor
        tabBar.itemPositioning = .fill
        tabBar.itemSpacing = 0
        tabBar.barTintColor = .clear
        tabBar.backgroundColor = .clear
        tabBar.backgroundImage = UIImage()
        tabBar.shadowImage = UIImage()
        tabBar.clipsToBounds = true
        tabBar.layer.cornerRadius = 33
        tabBar.layer.cornerCurve = .continuous

        let appearance = UITabBarAppearance()
        appearance.configureWithTransparentBackground()
        appearance.backgroundEffect = nil
        appearance.backgroundColor = .clear
        appearance.shadowColor = .clear
        configureTabItemAppearance(appearance.stackedLayoutAppearance)
        configureTabItemAppearance(appearance.inlineLayoutAppearance)
        configureTabItemAppearance(appearance.compactInlineLayoutAppearance)
        tabBar.standardAppearance = appearance
        if #available(iOS 15.0, *) {
            tabBar.scrollEdgeAppearance = appearance
        }

        tabOverlayStack.translatesAutoresizingMaskIntoConstraints = false
        tabOverlayStack.axis = .horizontal
        tabOverlayStack.alignment = .fill
        tabOverlayStack.distribution = .fillEqually
        tabOverlayStack.spacing = 0
        tabOverlayStack.isUserInteractionEnabled = false
        tabBar.addSubview(tabOverlayStack)

        NSLayoutConstraint.activate([
            tabOverlayStack.topAnchor.constraint(equalTo: tabBar.topAnchor),
            tabOverlayStack.leadingAnchor.constraint(equalTo: tabBar.leadingAnchor),
            tabOverlayStack.trailingAnchor.constraint(equalTo: tabBar.trailingAnchor),
            tabOverlayStack.bottomAnchor.constraint(equalTo: tabBar.bottomAnchor)
        ])
    }

    private func setupToggleButton() {
        toggleContainerView.translatesAutoresizingMaskIntoConstraints = false
        toggleContainerView.layer.cornerRadius = 33
        toggleContainerView.layer.cornerCurve = .continuous
        toggleContainerView.clipsToBounds = true
        toggleContainerView.isHidden = true

        toggleSurfaceView.translatesAutoresizingMaskIntoConstraints = false
        toggleSurfaceView.isUserInteractionEnabled = false
        toggleSurfaceView.clipsToBounds = true
        toggleSurfaceView.layer.cornerRadius = 33
        toggleSurfaceView.layer.cornerCurve = .continuous
        toggleSurfaceView.layer.borderWidth = 0.5
        toggleSurfaceView.layer.borderColor = UIColor.white.withAlphaComponent(0.24).cgColor

        toggleTintView.translatesAutoresizingMaskIntoConstraints = false
        toggleTintView.isUserInteractionEnabled = false
        toggleTintView.backgroundColor = UIColor.white.withAlphaComponent(0.03)
        toggleSurfaceView.contentView.addSubview(toggleTintView)
        toggleContainerView.addSubview(toggleSurfaceView)

        toggleButton.translatesAutoresizingMaskIntoConstraints = false
        toggleButton.tintColor = .black
        toggleButton.backgroundColor = .clear
        toggleButton.clipsToBounds = false
        toggleButton.addTarget(self, action: #selector(didTapToggle), for: .touchUpInside)
        toggleContainerView.addSubview(toggleButton)

        NSLayoutConstraint.activate([
            toggleSurfaceView.topAnchor.constraint(equalTo: toggleContainerView.topAnchor),
            toggleSurfaceView.leadingAnchor.constraint(equalTo: toggleContainerView.leadingAnchor),
            toggleSurfaceView.trailingAnchor.constraint(equalTo: toggleContainerView.trailingAnchor),
            toggleSurfaceView.bottomAnchor.constraint(equalTo: toggleContainerView.bottomAnchor),

            toggleTintView.topAnchor.constraint(equalTo: toggleSurfaceView.contentView.topAnchor),
            toggleTintView.leadingAnchor.constraint(equalTo: toggleSurfaceView.contentView.leadingAnchor),
            toggleTintView.trailingAnchor.constraint(equalTo: toggleSurfaceView.contentView.trailingAnchor),
            toggleTintView.bottomAnchor.constraint(equalTo: toggleSurfaceView.contentView.bottomAnchor),

            toggleButton.topAnchor.constraint(equalTo: toggleContainerView.topAnchor),
            toggleButton.leadingAnchor.constraint(equalTo: toggleContainerView.leadingAnchor),
            toggleButton.trailingAnchor.constraint(equalTo: toggleContainerView.trailingAnchor),
            toggleButton.bottomAnchor.constraint(equalTo: toggleContainerView.bottomAnchor)
        ])
    }

    func configure(items: [LiquidNavItem],
                   selectedPath: String,
                   showsModeToggle: Bool,
                   isProMode: Bool) {
        let previousSelectedIndex = self.items.firstIndex(where: isSelected)
        let previousSelectedPath = self.selectedPath
        let changedItems = self.items != items
        self.items = items
        self.selectedPath = selectedPath
        self.showsModeToggle = showsModeToggle
        self.isProMode = isProMode

        if changedItems {
            rebuildTabBarItems()
        }
        updateModeToggle()

        let nextSelectedIndex = self.items.firstIndex(where: isSelected)
        let shouldUpdateSelection = changedItems ||
            previousSelectedIndex != nextSelectedIndex ||
            previousSelectedPath != selectedPath
        guard shouldUpdateSelection else { return }

        let shouldAnimateSelection = !changedItems &&
            previousSelectedIndex != nil &&
            previousSelectedIndex != nextSelectedIndex
        updateSelection(animated: shouldAnimateSelection)
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
        tabOverlayStack.arrangedSubviews.forEach { view in
            tabOverlayStack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }

        tabBar.items = items.enumerated().map { index, item in
            let tabItem = UITabBarItem(title: nil, image: transparentTabIcon(), selectedImage: transparentTabIcon())
            tabItem.tag = index
            tabItem.accessibilityLabel = item.title
            return tabItem
        }

        tabButtons = items.enumerated().map { index, item in
            let button = FreetifulTabOverlayButton(
                title: item.title,
                icon: navIcon(named: item.iconAssetName),
                activeColor: activeColor,
                inactiveColor: inactiveColor
            )
            button.tag = index
            button.isUserInteractionEnabled = false
            tabOverlayStack.addArrangedSubview(button)
            return button
        }
        updateSelectionIndicatorImage()
        tabBar.bringSubviewToFront(tabOverlayStack)
    }

    private func updateModeToggle() {
        toggleContainerView.isHidden = !showsModeToggle
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

    private func updateSelection(animated: Bool) {
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

        let nextItem = tabItems[selectedIndex]
        tabButtons.enumerated().forEach { index, button in
            button.setSelectedState(index == selectedIndex, animated: animated)
        }

        guard tabBar.selectedItem !== nextItem else { return }

        tabBar.selectedItem = nextItem
        tabBar.relayoutSelection(animated: animated)
    }

    private func updateSelectionIndicatorImage() {
        guard !items.isEmpty, tabBar.bounds.width > 0, tabBar.bounds.height > 0 else {
            tabBar.selectionIndicatorImage = nil
            return
        }

        let itemWidth = tabBar.bounds.width / CGFloat(items.count)
        let itemHeight = tabBar.bounds.height
        let capsuleInset: CGFloat = 3
        let size = CGSize(width: itemWidth, height: itemHeight)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = UIScreen.main.scale
        let image = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            let rect = CGRect(origin: .zero, size: size).insetBy(dx: capsuleInset, dy: capsuleInset)
            UIColor(white: 0.88, alpha: 0.68).setFill()
            UIBezierPath(
                roundedRect: rect,
                cornerRadius: rect.height / 2
            ).fill()
        }
        tabBar.selectionIndicatorImage = image.withRenderingMode(.alwaysOriginal)
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
        selectItem(at: item.tag)
    }

    private func selectItem(at index: Int) {
        guard index >= 0, index < items.count else { return }
        let navItem = items[index]
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        selectedPath = navItem.path
        updateSelection(animated: true)
        delegate?.liquidGlassNavigationBar(self, didSelect: navItem)
    }

    @objc private func didTapToggle() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        delegate?.liquidGlassNavigationBarDidTapModeToggle(self)
    }

    private func makeGlassConfiguration(selected: Bool, isToggle: Bool) -> UIButton.Configuration {
        let configuration = UIButton.Configuration.plain()
        var tuned = configuration
        tuned.cornerStyle = .capsule
        tuned.automaticallyUpdateForSelection = true
        tuned.baseBackgroundColor = UIColor.clear
        tuned.background.backgroundColor = selected ? freetifulBlue.withAlphaComponent(0.10) : UIColor.clear
        tuned.background.strokeWidth = isToggle ? 0 : 0.5
        return tuned
    }

    private func configureTabItemAppearance(_ itemAppearance: UITabBarItemAppearance) {
        itemAppearance.normal.iconColor = .clear
        itemAppearance.normal.titleTextAttributes = [
            .foregroundColor: UIColor.clear,
            .font: UIFont.systemFont(ofSize: 1, weight: .regular),
        ]
        itemAppearance.normal.titlePositionAdjustment = UIOffset(horizontal: 0, vertical: 200)
        itemAppearance.selected.iconColor = .clear
        itemAppearance.selected.titleTextAttributes = [
            .foregroundColor: UIColor.clear,
            .font: UIFont.systemFont(ofSize: 1, weight: .regular),
        ]
        itemAppearance.selected.titlePositionAdjustment = UIOffset(horizontal: 0, vertical: 200)
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

    private func transparentTabIcon() -> UIImage {
        let size = CGSize(width: 16, height: 16)
        let image = UIGraphicsImageRenderer(size: size).image { _ in
            UIColor.clear.setFill()
            UIBezierPath(rect: CGRect(origin: .zero, size: size)).fill()
        }
        return image.withRenderingMode(.alwaysOriginal)
    }

}
