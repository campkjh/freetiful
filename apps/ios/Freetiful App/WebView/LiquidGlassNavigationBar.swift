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
    let symbolName: String
}

protocol LiquidGlassNavigationBarDelegate: AnyObject {
    func liquidGlassNavigationBar(_ navBar: LiquidGlassNavigationBar, didSelect item: LiquidNavItem)
    func liquidGlassNavigationBarDidTapModeToggle(_ navBar: LiquidGlassNavigationBar)
}

final class LiquidGlassNavigationBar: UIView {
    weak var delegate: LiquidGlassNavigationBarDelegate?

    private let usesNativeLiquidGlass = LiquidGlassEffectFactory.supportsNativeLiquidGlass
    private let freetifulBlue = UIColor(red: 0.19, green: 0.50, blue: 0.97, alpha: 1)
    private lazy var activeColor = freetifulBlue
    private lazy var inactiveColor = freetifulBlue.withAlphaComponent(0.58)

    private let navEffectView = UIVisualEffectView(effect: LiquidGlassEffectFactory.navigationEffect())
    private let selectionBubbleView = UIView()
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

    override func layoutSubviews() {
        super.layoutSubviews()
        updateSelectionBubble(animated: false)
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
            navEffectView.backgroundColor = UIColor.white.withAlphaComponent(0.03)
            navEffectView.layer.borderWidth = 1
            navEffectView.layer.borderColor = UIColor.white.withAlphaComponent(0.12).cgColor
        }

        selectionBubbleView.backgroundColor = freetifulBlue.withAlphaComponent(0.14)
        selectionBubbleView.isUserInteractionEnabled = false
        selectionBubbleView.alpha = 0
        selectionBubbleView.layer.cornerCurve = .continuous
        selectionBubbleView.layer.shadowColor = freetifulBlue.cgColor
        selectionBubbleView.layer.shadowOpacity = 0.14
        selectionBubbleView.layer.shadowRadius = 10
        selectionBubbleView.layer.shadowOffset = CGSize(width: 0, height: 4)
        navEffectView.contentView.addSubview(selectionBubbleView)

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
            configuration.contentInsets = NSDirectionalEdgeInsets(top: 6, leading: 0, bottom: 4, trailing: 0)
            configuration.baseForegroundColor = inactiveColor
            configuration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
                var outgoing = incoming
                outgoing.font = UIFont.systemFont(ofSize: 9, weight: .semibold)
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
            UIImage(systemName: symbol, withConfiguration: UIImage.SymbolConfiguration(pointSize: 13, weight: .bold)),
            for: .normal
        )
        toggleButton.tintColor = activeColor
        toggleButton.accessibilityLabel = isProMode ? "일반회원으로 전환" : "프로회원으로 전환"
    }

    private func updateSelection(animated: Bool) {
        let selectedIndex = items.firstIndex(where: isSelected)
        buttons.enumerated().forEach { index, button in
            guard index < items.count else { return }
            let item = items[index]
            let isSelected = index == selectedIndex
            var configuration = button.configuration ?? .plain()
            configuration.image = UIImage(
                systemName: item.symbolName,
                withConfiguration: UIImage.SymbolConfiguration(
                    pointSize: isSelected ? 16 : 15,
                    weight: isSelected ? .bold : .semibold
                )
            )
            configuration.baseForegroundColor = isSelected ? activeColor : inactiveColor
            configuration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
                var outgoing = incoming
                outgoing.font = UIFont.systemFont(ofSize: 9, weight: isSelected ? .bold : .semibold)
                return outgoing
            }
            button.configuration = configuration
            button.backgroundColor = .clear
        }
        updateSelectionBubble(animated: animated)
    }

    private func updateSelectionBubble(animated: Bool) {
        guard
            let selectedIndex = items.firstIndex(where: isSelected),
            selectedIndex < buttons.count,
            buttons[selectedIndex].superview != nil
        else {
            selectionBubbleView.alpha = 0
            return
        }

        let button = buttons[selectedIndex]
        let targetFrame = button.convert(button.bounds.insetBy(dx: 1, dy: 1), to: navEffectView.contentView)
        let changes = {
            self.selectionBubbleView.frame = targetFrame
            self.selectionBubbleView.layer.cornerRadius = targetFrame.height / 2
            self.selectionBubbleView.alpha = 1
        }

        guard animated, selectionBubbleView.alpha > 0 else {
            changes()
            return
        }

        UIView.animate(
            withDuration: 0.42,
            delay: 0,
            usingSpringWithDamping: 0.72,
            initialSpringVelocity: 0.62,
            options: [.allowUserInteraction, .beginFromCurrentState],
            animations: changes
        )
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
