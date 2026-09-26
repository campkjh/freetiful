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
    private let preferredBarHeight: CGFloat = 80
    private let selectionIndicatorInset: CGFloat = 12
    private var selectionIndicatorRenderSize: CGSize = .zero

    /// 안 읽음 빨간 점 — 웹 하단 탭과 같은 6pt #F04452 를 아이콘 오른쪽 위에 직접 그린다
    /// (시스템 뱃지는 빈 글자여도 큰 원이라 웹의 작은 점과 달랐다, 260927)
    var unreadDotIndices: Set<Int> = [] {
        didSet { if oldValue != unreadDotIndices { setNeedsLayout() } }
    }
    private var unreadDots: [UIView] = []
    private let unreadDotColor = UIColor(red: 0xF0 / 255, green: 0x44 / 255, blue: 0x52 / 255, alpha: 1)

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupNativeSurface()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupNativeSurface()
    }

    override func sizeThatFits(_ size: CGSize) -> CGSize {
        var fittedSize = super.sizeThatFits(size)
        fittedSize.height = preferredBarHeight
        return fittedSize
    }

    override var intrinsicContentSize: CGSize {
        CGSize(width: UIView.noIntrinsicMetric, height: preferredBarHeight)
    }

    override var safeAreaInsets: UIEdgeInsets {
        .zero
    }

    override func layoutSubviews() {
        super.layoutSubviews()

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
                button.backgroundColor = .clear
                button.isOpaque = false
                button.clipsToBounds = false
            }
            updateSelectionIndicatorImage(itemWidth: itemWidth)
        }
        layoutUnreadDots(tabButtons)

        subviews.forEach { subview in
            if String(describing: type(of: subview)).contains("UIBarBackground") {
                stretchBackgroundSurface(subview)
                sendSubviewToBack(subview)
            }
        }
    }

    /// 칸마다 아이콘 오른쪽 위에 점. iOS 26 탭바는 속 뷰 구조가 달라(UITabBarButton 없음) 버튼 대신
    /// 26pt 아이콘 그림을 통째로 찾아 칸(너비 ÷ 개수)별로 짝짓고, 못 찾으면 칸 가운데 기준으로 둔다.
    private func layoutUnreadDots(_ buttons: [UIView]) {
        let count = items?.count ?? 0
        while unreadDots.count < count {
            let dot = UIView()
            dot.backgroundColor = unreadDotColor
            dot.layer.cornerRadius = 3
            dot.isUserInteractionEnabled = false
            dot.isAccessibilityElement = false
            addSubview(dot)
            unreadDots.append(dot)
        }
        guard count > 0, !unreadDotIndices.isEmpty else {
            unreadDots.forEach { $0.isHidden = true }
            return
        }
        subviews.forEach { $0.layoutIfNeeded() }
        let itemWidth = bounds.width / CGFloat(count)
        let icons = Self.imageViews(in: self)
            .filter { !$0.isHidden && $0.alpha > 0.01 && abs($0.bounds.width - 26) < 4 && abs($0.bounds.height - 26) < 4 }
            .map { $0.convert($0.bounds, to: self) }
        for (index, dot) in unreadDots.enumerated() {
            guard index < count, unreadDotIndices.contains(index) else {
                dot.isHidden = true
                continue
            }
            let column = CGRect(x: CGFloat(index) * itemWidth, y: 0, width: itemWidth, height: bounds.height)
            let icon = icons.first { column.contains(CGPoint(x: $0.midX, y: $0.midY)) }
                ?? CGRect(x: column.midX - 13, y: bounds.midY - 22, width: 26, height: 26)
            // 웹과 같은 자리: 아이콘 칸 위쪽 끝, 오른쪽으로 4 삐져나오게
            dot.frame = CGRect(x: icon.maxX - 2, y: icon.minY, width: 6, height: 6)
            dot.isHidden = false
            bringSubviewToFront(dot)
        }
    }

    private static func imageViews(in view: UIView) -> [UIImageView] {
        var found: [UIImageView] = []
        for sub in view.subviews {
            if let imageView = sub as? UIImageView, imageView.image != nil { found.append(imageView) }
            found.append(contentsOf: imageViews(in: sub))
        }
        return found
    }

    private func updateSelectionIndicatorImage(itemWidth: CGFloat) {
        let imageSize = CGSize(width: itemWidth, height: preferredBarHeight)
        guard imageSize.width > 0, imageSize.height > 0 else { return }
        guard selectionIndicatorRenderSize != imageSize else { return }

        selectionIndicatorRenderSize = imageSize
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = UIScreen.main.scale
        let image = UIGraphicsImageRenderer(size: imageSize, format: format).image { _ in
            let capsuleRect = CGRect(origin: .zero, size: imageSize).insetBy(
                dx: selectionIndicatorInset,
                dy: selectionIndicatorInset
            )
            UIColor(white: 0, alpha: 0.06).setFill()
            UIBezierPath(
                roundedRect: capsuleRect,
                cornerRadius: 22
            ).fill()
        }

        selectionIndicatorImage = image
    }

    private func stretchBackgroundSurface(_ view: UIView) {
        view.frame = bounds
        view.isHidden = false
        view.alpha = 1
        view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.clipsToBounds = true
        view.layer.cornerRadius = 28
        view.layer.cornerCurve = .continuous
        view.layer.borderWidth = 0.5
        view.layer.borderColor = UIColor.white.withAlphaComponent(0.24).cgColor

        view.subviews.forEach { subview in
            subview.frame = view.bounds
            subview.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            subview.clipsToBounds = true
            subview.layer.cornerRadius = 28
            subview.layer.cornerCurve = .continuous
            fillDescendants(of: subview)
        }
    }

    private func fillDescendants(of view: UIView) {
        view.subviews.forEach { subview in
            subview.frame = view.bounds
            subview.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            subview.clipsToBounds = true
            subview.layer.cornerRadius = 28
            subview.layer.cornerCurve = .continuous
            fillDescendants(of: subview)
        }
    }

    private func setupNativeSurface() {
        backgroundColor = .clear
        isTranslucent = true
        clipsToBounds = true
        layer.cornerRadius = 28
        layer.cornerCurve = .continuous
    }
}

final class LiquidGlassNavigationBar: UIView, UITabBarDelegate {
    weak var delegate: LiquidGlassNavigationBarDelegate?

    private let usesNativeLiquidGlass = LiquidGlassEffectFactory.supportsNativeLiquidGlass
    private let freetifulBlue = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
    // 웹·안드로이드 하단 탭과 같게(260927 사장): 아이콘·글자 모두 쿨그레이 #4E5968,
    // 고른 탭은 색 대신 '채운 아이콘 + 굵은 글자'로 구분(안 고른 탭 = 선 아이콘) — 아이콘 에셋 nav-* / nav-*-active
    private lazy var activeColor = UIColor(red: 0x4E / 255, green: 0x59 / 255, blue: 0x68 / 255, alpha: 1)
    private lazy var inactiveColor = UIColor(red: 0x4E / 255, green: 0x59 / 255, blue: 0x68 / 255, alpha: 1)

    private let tabBar = FreetifulNativeTabBar()
    private let toggleContainerView = UIView()
    private let toggleSurfaceView = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
    private let toggleTintView = UIView()
    private let toggleButton = UIButton(type: .system)
    private let contentStack = UIStackView()

    private var items: [LiquidNavItem] = []
    private var iconCache: [String: UIImage] = [:]
    private var selectedPath = "/main"
    private var isProMode = false
    private var showsModeToggle = false
    private var badges: [String: Int] = [:]

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
        tabBar.setNeedsLayout()
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

            toggleContainerView.widthAnchor.constraint(equalToConstant: 80),
            toggleContainerView.heightAnchor.constraint(equalToConstant: 80),

            tabBar.heightAnchor.constraint(equalTo: heightAnchor)
        ])
    }

    private func setupNavigationSurface() {
        tabBar.translatesAutoresizingMaskIntoConstraints = false
        tabBar.delegate = self
        tabBar.isUserInteractionEnabled = true
        tabBar.tintColor = activeColor
        tabBar.unselectedItemTintColor = inactiveColor
        tabBar.itemPositioning = .fill
        tabBar.itemSpacing = 0
        tabBar.barTintColor = .clear
        tabBar.backgroundColor = .clear
        tabBar.backgroundImage = nil
        tabBar.shadowImage = nil
        tabBar.clipsToBounds = true
        tabBar.layer.cornerRadius = 28
        tabBar.layer.cornerCurve = .continuous

        let appearance = UITabBarAppearance()
        appearance.configureWithDefaultBackground()
        appearance.backgroundColor = UIColor.white.withAlphaComponent(0.03)
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
        toggleContainerView.translatesAutoresizingMaskIntoConstraints = false
        toggleContainerView.layer.cornerRadius = 28
        toggleContainerView.layer.cornerCurve = .continuous
        toggleContainerView.clipsToBounds = true
        toggleContainerView.isHidden = true

        toggleSurfaceView.translatesAutoresizingMaskIntoConstraints = false
        toggleSurfaceView.isUserInteractionEnabled = false
        toggleSurfaceView.clipsToBounds = true
        toggleSurfaceView.layer.cornerRadius = 28
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
        tabBar.items = items.enumerated().map { index, item in
            let icon = navIcon(named: item.iconAssetName)
            let tabItem = UITabBarItem(
                title: item.title,
                image: icon,
                selectedImage: navIcon(named: "\(item.iconAssetName)-active") ?? icon
            )
            tabItem.tag = index
            tabItem.accessibilityLabel = item.title
            tabItem.titlePositionAdjustment = UIOffset(horizontal: 0, vertical: 2)
            tabItem.imageInsets = UIEdgeInsets(top: -1, left: 0, bottom: 1, right: 0)
            return tabItem
        }
        applyBadges()
    }

    /// 웹에서 전달된 미읽음 카운트를 nav 아이템 뱃지에 반영 (id 기준: "requests"=새요청, "chat"=채팅)
    /// 웹 하단 탭처럼 숫자 대신 빨간 점(FreetifulNativeTabBar.unreadDotIndices)
    func setBadges(_ next: [String: Int]) {
        guard badges != next else { return }
        badges = next
        applyBadges()
    }

    private func applyBadges() {
        guard let tabItems = tabBar.items else { return }
        var dots = Set<Int>()
        for (index, item) in items.enumerated() where index < tabItems.count {
            let count = badges[item.id] ?? 0
            tabItems[index].badgeValue = nil
            tabItems[index].accessibilityValue = count > 0 ? "새 알림" : nil
            if count > 0 { dots.insert(index) }
        }
        tabBar.unreadDotIndices = dots
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
        if tabBar.selectedItem !== nextItem {
            tabBar.selectedItem = nextItem
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
        selectItem(at: item.tag, updateNativeSelection: false)
    }

    private func selectItem(at index: Int, updateNativeSelection: Bool = true) {
        guard index >= 0, index < items.count else { return }
        let navItem = items[index]
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        selectedPath = navItem.path
        if updateNativeSelection {
            updateSelection(animated: true)
        }
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
        // 웹 하단 탭 라벨 11px(평소 500 · 고른 탭 600)
        let normalFont = UIFont.systemFont(ofSize: 11, weight: .medium)
        let selectedFont = UIFont.systemFont(ofSize: 11, weight: .semibold)

        itemAppearance.normal.iconColor = inactiveColor
        itemAppearance.normal.titleTextAttributes = [
            .foregroundColor: inactiveColor,
            .font: normalFont,
        ]
        itemAppearance.normal.titlePositionAdjustment = UIOffset(horizontal: 0, vertical: 2)

        itemAppearance.selected.iconColor = activeColor
        itemAppearance.selected.titleTextAttributes = [
            .foregroundColor: activeColor,
            .font: selectedFont,
        ]
        itemAppearance.selected.titlePositionAdjustment = UIOffset(horizontal: 0, vertical: 2)
    }

    private func navIcon(named assetName: String) -> UIImage? {
        if let cached = iconCache[assetName] {
            return cached
        }
        guard let source = UIImage(named: assetName)?.withRenderingMode(.alwaysTemplate) else {
            return nil
        }

        let size = CGSize(width: 26, height: 26)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = UIScreen.main.scale
        let image = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            source.draw(in: CGRect(origin: .zero, size: size))
        }.withRenderingMode(.alwaysTemplate)
        iconCache[assetName] = image
        return image
    }

}
