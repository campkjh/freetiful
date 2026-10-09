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

    /// 비즈 바(261009 사장 '비즈 푸터는 이렇게 디자인해줘 ios만') — 견본(토스)처럼 흰 기운이 도는 보통 유리(regular).
    /// iOS 26 유리엔 흰 tint 를 준다(261009 검증) — 어두운 사진 위에선 맨 유리가 중간 회색으로 가라앉아 쿨그레이 글자 · 고른 캡슐이
    /// 잘 안 보였다(대비 약 3:1). 견본 알약은 무엇 위에서든 하얗다. 흰 화면 위 모양은 그대로
    /// iOS 26 전엔 밝은 블러(기기가 다크 모드여도 흰 웹 위에 뜨니 밝게) — 흰 덧칠 · 가는 테두리는 BizGlassTabBar 가 얹는다
    /// interactive = 누르면 유리가 스스로 출렁이는지(동그란 단추만 — 알약까지 출렁이면 탭 하나 누를 때 바 전체가 부푼다)
    static func bizSurfaceEffect(interactive: Bool) -> UIVisualEffect {
        nativeGlassEffect(
            tintColor: UIColor.white.withAlphaComponent(0.6),
            isInteractive: interactive,
            style: .regular
        ) ?? UIBlurEffect(style: .systemThinMaterialLight)
    }

    private enum NativeGlassStyle: Int {
        case regular = 0
        case clear = 1
    }

    private static func nativeGlassEffect(tintColor: UIColor?,
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
        if let tintColor, object.responds(to: NSSelectorFromString("setTintColor:")) {
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
    /// 비즈 바 왼쪽 동그란 ← 단추(261009 사장 '비즈 푸터는 이렇게 디자인해줘 ios만')
    func liquidGlassNavigationBarDidTapBack(_ navBar: LiquidGlassNavigationBar)
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

/// 비즈 화면 하단 바(261009 사장 '비즈 푸터는 이렇게 디자인해줘 ios만' — 토스 앱 하단 견본을 옮김).
///  · [◯ ←] [ 홈 · 뉴스·소식 · 비즈문의 · 기업소개 ] — 왼쪽에 떨어진 동그란 유리 단추(뒤로), 오른쪽 큰 유리 알약 하나에 탭 4개(아이콘 위 · 글자 아래).
///  · 고른 탭 = 칸 뒤 옅은 회색 둥근 캡슐(아이콘+글자를 감싸는 크기) + 채운 아이콘 · 진한 글자, 안 고른 탭 = 선 아이콘 · 쿨그레이.
///  · 둘 다 화면 아래에서 떠 있다. 크기는 견본(402pt 폭 화면) 실측 비율 — 좌우 여백 19 · 단추↔알약 7 · 높이 56(단추 지름 = 알약 높이) ·
///    화면 아래에서 19 띄움 · 캡슐 = 알약 위아래 4 안쪽(높이 48) · 칸보다 좌우 3씩 넓게.
///  · iOS 26 = 시스템 리퀴드 글래스(UIGlassEffect regular), 그 전 = 밝은 블러 + 흰 덧칠 + 가는 테두리.
///  · 일반 탭(홈 · 웨딩숲 · 매칭 · 채팅 · 마이)은 이 뷰를 안 쓴다 — 시스템 탭바(FreetifulNativeTabBar) 그대로.
private final class BizGlassTabBar: UIView {
    struct Item: Equatable {
        let title: String
        let icon: UIImage?
        let selectedIcon: UIImage?
    }

    var onSelect: ((Int) -> Void)?
    var onBack: (() -> Void)?

    // 바깥 뷰(LiquidGlassNavigationBar)는 화면 좌우 6 안쪽 · 화면 맨 아래에 붙어 있어 그 기준 값(화면 기준 19 = 6 + 13)
    private let barHeight: CGFloat = 56
    private let sideInset: CGFloat = 13
    private let backToPillGap: CGFloat = 7
    private let homeIndicatorGap: CGFloat = 19   // 홈 인디케이터 기기: 화면 아래에서 19 띄움(견본)
    private let flatBottomGap: CGFloat = 8       // 홈 버튼 기기(아래 안전영역 0): 웹 아래 빈칸(66)보다 덜 덮게 8 만
    private let pillPaddingX: CGFloat = 8        // 알약 안 좌우 — 탭 칸은 이 안을 등분
    private let capsuleInset: CGFloat = 4        // 캡슐은 알약 가장자리에서 4 안쪽
    private let capsuleOverhang: CGFloat = 3     // 캡슐은 칸보다 좌우 3씩 넓다(견본 캡슐 78 > 칸 72)

    private let usesNativeGlass = LiquidGlassEffectFactory.supportsNativeLiquidGlass
    private let backSurface = UIVisualEffectView(effect: LiquidGlassEffectFactory.bizSurfaceEffect(interactive: true))
    private let pillSurface = UIVisualEffectView(effect: LiquidGlassEffectFactory.bizSurfaceEffect(interactive: false))
    private let backTint = UIView()
    private let pillTint = UIView()
    private let backButton = UIButton(type: .custom)
    private let backArrowView = UIImageView()
    private let selectionCapsule = UIView()
    /// 캡슐 + 탭 칸을 담는 묶음 — VoiceOver 에 '탭 막대'로 알린다(.tabBar → '탭, 4개 중 n번째'. 시스템 탭바가 주던 안내, 261009 검증)
    private let tabsContainer = UIView()
    private var buttons: [BizGlassTabButton] = []
    private var items: [Item] = []
    private var selectedIndex: Int?
    // 마지막 배치의 단추 · 알약 자리(누름 축소 transform 과 상관없는 원래 자리) — 터치 판정용
    private var backFrame: CGRect = .zero
    private var pillFrame: CGRect = .zero
    private let touchSlop: CGFloat = 6   // 단추 · 알약 둘레 이만큼은 빗나가도 바가 받는다

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        backgroundColor = .clear
        // 웹(흰 화면) 위에 뜨는 바 — 기기가 다크 모드여도 견본처럼 밝은 유리 · 진한 글자
        overrideUserInterfaceStyle = .light

        [backSurface, pillSurface].forEach { surface in
            surface.clipsToBounds = !usesNativeGlass   // iOS 26 유리는 가장자리 빛이 모양 밖으로 살짝 번진다 — 자르지 않는다
            surface.layer.cornerCurve = .continuous
            // 견본은 그림자 대신 아주 옅은 회색 테두리로 가장자리가 보인다(흰 화면 위 흰 유리) — 두 버전 모두 가는 테두리
            surface.layer.borderWidth = 0.5
            surface.layer.borderColor = UIColor(white: 0, alpha: 0.07).cgColor
            addSubview(surface)
        }
        // iOS 26 전: 블러만으론 회색기가 돌아 견본의 흰 알약이 안 된다 — 흰 덧칠
        [(backTint, backSurface), (pillTint, pillSurface)].forEach { tint, surface in
            tint.isUserInteractionEnabled = false
            tint.backgroundColor = UIColor.white.withAlphaComponent(usesNativeGlass ? 0 : 0.62)
            tint.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            surface.contentView.addSubview(tint)
        }

        tabsContainer.backgroundColor = .clear
        tabsContainer.isAccessibilityElement = false
        tabsContainer.accessibilityTraits = .tabBar
        pillSurface.contentView.addSubview(tabsContainer)

        selectionCapsule.isUserInteractionEnabled = false
        selectionCapsule.backgroundColor = UIColor(white: 0, alpha: 0.06)   // 견본 캡슐 #EFEFEF(흰 바탕 위)
        selectionCapsule.layer.cornerCurve = .continuous
        selectionCapsule.alpha = 0
        tabsContainer.addSubview(selectionCapsule)

        // ← 화살표 — 견본처럼 진한 #191F28 · 가는 선. 단추 그림(setImage)은 누를 때 어두워져 그림만 따로 얹는다
        backArrowView.image = UIImage(
            systemName: "arrow.left",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 19, weight: .medium)
        )
        backArrowView.tintColor = UIColor(red: 0x19 / 255, green: 0x1F / 255, blue: 0x28 / 255, alpha: 1)
        backArrowView.contentMode = .center
        backArrowView.isUserInteractionEnabled = false
        backButton.addSubview(backArrowView)
        backButton.accessibilityLabel = "뒤로"
        // 큰 글씨(손쉬운 사용 크기)에서 길게 누르면 가운데 크게 보여 주기 — 시스템 탭바와 같게(261009 검증)
        backButton.showsLargeContentViewer = true
        backButton.largeContentTitle = "뒤로"
        backButton.largeContentImage = backArrowView.image
        backButton.scalesLargeContentImage = true
        backButton.addTarget(self, action: #selector(didTapBack), for: .touchUpInside)
        backButton.addTarget(self, action: #selector(backPressDown), for: [.touchDown, .touchDragEnter])
        backButton.addTarget(self, action: #selector(backPressUp), for: [.touchUpInside, .touchUpOutside, .touchCancel, .touchDragExit])
        backSurface.contentView.addSubview(backButton)

        addInteraction(UILargeContentViewerInteraction(delegate: self))
    }

    override func safeAreaInsetsDidChange() {
        super.safeAreaInsetsDidChange()
        setNeedsLayout()
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        setNeedsLayout()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let hasHomeIndicator = (window?.safeAreaInsets.bottom ?? 0) > 0
        let bottomGap = hasHomeIndicator ? homeIndicatorGap : flatBottomGap
        let y = max(0, bounds.height - bottomGap - barHeight)

        backFrame = CGRect(x: sideInset, y: y, width: barHeight, height: barHeight)
        let pillX = backFrame.maxX + backToPillGap
        pillFrame = CGRect(x: pillX, y: y, width: max(0, bounds.width - sideInset - pillX), height: barHeight)
        // 누름 축소(transform) 중엔 frame 대신 bounds · center 로 — 크기가 틀어지지 않게
        backSurface.bounds = CGRect(origin: .zero, size: backFrame.size)
        backSurface.center = CGPoint(x: backFrame.midX, y: backFrame.midY)
        pillSurface.frame = pillFrame
        [backSurface, pillSurface].forEach { applyCapsuleShape($0) }

        backTint.frame = backSurface.contentView.bounds
        pillTint.frame = pillSurface.contentView.bounds
        tabsContainer.frame = pillSurface.contentView.bounds
        backButton.frame = backSurface.contentView.bounds
        backArrowView.frame = backButton.bounds
        layoutTabs()
    }

    private func applyCapsuleShape(_ view: UIView) {
        view.layer.cornerRadius = view.bounds.height / 2
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            view.cornerConfiguration = .capsule()
        }
        #endif
    }

    private var columnWidth: CGFloat {
        guard !buttons.isEmpty else { return 0 }
        return max(0, pillSurface.bounds.width - pillPaddingX * 2) / CGFloat(buttons.count)
    }

    private func layoutTabs() {
        let width = columnWidth
        for (index, button) in buttons.enumerated() {
            button.frame = CGRect(x: pillPaddingX + CGFloat(index) * width, y: 0, width: width, height: barHeight)
        }
        updateCapsuleFrame()
    }

    private func capsuleFrame(for index: Int) -> CGRect {
        let width = columnWidth + capsuleOverhang * 2
        let height = barHeight - capsuleInset * 2
        let minX = capsuleInset
        let maxX = pillSurface.bounds.width - capsuleInset - width
        let x = min(max(pillPaddingX + CGFloat(index) * columnWidth - capsuleOverhang, minX), max(minX, maxX))
        return CGRect(x: x, y: capsuleInset, width: width, height: height)
    }

    private func updateCapsuleFrame() {
        guard let selectedIndex, selectedIndex < buttons.count else {
            selectionCapsule.alpha = 0
            return
        }
        let frame = capsuleFrame(for: selectedIndex)
        selectionCapsule.frame = frame
        selectionCapsule.layer.cornerRadius = frame.height / 2
        selectionCapsule.alpha = 1
    }

    func setItems(_ next: [Item]) {
        guard next != items else { return }
        items = next
        buttons.forEach { $0.removeFromSuperview() }
        buttons = next.enumerated().map { index, item in
            let button = BizGlassTabButton(item: item)
            button.tag = index
            button.addTarget(self, action: #selector(didTapTab(_:)), for: .touchUpInside)
            tabsContainer.addSubview(button)
            return button
        }
        tabsContainer.accessibilityElements = buttons
        if let selectedIndex, selectedIndex >= next.count { self.selectedIndex = nil }
        applySelectionState()
        setNeedsLayout()
    }

    func setSelectedIndex(_ index: Int?, animated: Bool) {
        let next = index.flatMap { $0 >= 0 && $0 < buttons.count ? $0 : nil }
        guard next != selectedIndex else { return }
        let previous = selectedIndex
        selectedIndex = next
        applySelectionState()
        guard let next else {
            UIView.animate(withDuration: animated ? 0.18 : 0) { self.selectionCapsule.alpha = 0 }
            return
        }
        let target = capsuleFrame(for: next)
        // 고른 탭이 옮겨 갈 때만 캡슐이 미끄러진다(견본 · 시스템 탭바처럼). 처음 고를 땐 그 자리에 바로
        guard animated, previous != nil, window != nil, selectionCapsule.alpha > 0.01 else {
            UIView.performWithoutAnimation { updateCapsuleFrame() }
            return
        }
        UIView.animate(
            withDuration: 0.42,
            delay: 0,
            usingSpringWithDamping: 0.78,
            initialSpringVelocity: 0.2,
            options: [.allowUserInteraction, .beginFromCurrentState],
            animations: {
                self.selectionCapsule.frame = target
                self.selectionCapsule.layer.cornerRadius = target.height / 2
            }
        )
    }

    private func applySelectionState() {
        for (index, button) in buttons.enumerated() {
            button.isSelected = index == selectedIndex
        }
    }

    @objc private func didTapTab(_ sender: BizGlassTabButton) {
        onSelect?(sender.tag)
    }

    @objc private func didTapBack() {
        onBack?()
    }

    // 누름 표시 — iOS 26 은 상호작용 유리(isInteractive)가 스스로 눌림을 그린다. 그 전 버전만 살짝 줄였다 되돌린다
    @objc private func backPressDown() {
        guard !usesNativeGlass else { return }
        UIView.animate(withDuration: 0.12, delay: 0, options: [.allowUserInteraction, .beginFromCurrentState]) {
            self.backSurface.transform = CGAffineTransform(scaleX: 0.92, y: 0.92)
        }
    }

    @objc private func backPressUp() {
        guard !usesNativeGlass else { return }
        UIView.animate(withDuration: 0.36, delay: 0, usingSpringWithDamping: 0.6, initialSpringVelocity: 0.4,
                       options: [.allowUserInteraction, .beginFromCurrentState]) {
            self.backSurface.transform = .identity
        }
    }

    /// 터치 판정(261009 검증 — 단추 · 알약을 살짝 빗나간 탭이 바 아래 웹 링크를 누르던 것).
    ///  · 단추 · 알약과 그 둘레 6, 둘 사이 틈(같은 높이대)까지는 바가 받는다 — 가까운 쪽 단추 · 탭으로 보낸다(틈은 가운데에서 나눔).
    ///    알약 안 좌우 여백(칸 밖)도 가장 가까운 탭으로. UIControl 은 손 뗀 자리가 칸 둘레 몇십 pt 안이면 눌림으로 치니
    ///    빗나간 탭도 그 칸을 누른 게 된다.
    ///  · 그 밖(바 위쪽 띠 · 화면 아래 띄운 자리 대부분)만 아래 웹으로 넘긴다
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard !isHidden, alpha > 0.01, isUserInteractionEnabled else { return nil }
        if let hit = super.hitTest(point, with: event), hit !== self, hit !== tabsContainer { return hit }
        return slopTarget(at: point)
    }

    private func slopTarget(at point: CGPoint) -> UIView? {
        guard !backFrame.isEmpty, !pillFrame.isEmpty,
              backFrame.union(pillFrame).insetBy(dx: -touchSlop, dy: -touchSlop).contains(point) else { return nil }
        if point.x < (backFrame.maxX + pillFrame.minX) / 2 { return backButton }
        let x = point.x - pillFrame.minX   // 탭 칸 frame 은 알약 기준 좌표
        return buttons.min { abs($0.frame.midX - x) < abs($1.frame.midX - x) } ?? self
    }
}

// 큰 글씨 설정에서 탭 · ← 를 길게 누르면 가운데 크게 보여 주고, 그 위에서 손을 떼면 누른 것으로 친다(시스템 탭바와 같게, 261009 검증)
extension BizGlassTabBar: UILargeContentViewerInteractionDelegate {
    func largeContentViewerInteraction(_ interaction: UILargeContentViewerInteraction,
                                       itemAt point: CGPoint) -> UILargeContentViewerItem? {
        var view = hitTest(point, with: nil)
        while let current = view, current !== self {
            if current.showsLargeContentViewer { return current }
            view = current.superview
        }
        return nil
    }

    func largeContentViewerInteraction(_ interaction: UILargeContentViewerInteraction,
                                       didEndOn item: UILargeContentViewerItem?,
                                       at point: CGPoint) {
        (item as? UIControl)?.sendActions(for: .touchUpInside)
    }
}

/// 비즈 바의 탭 한 칸 — 아이콘 26(템플릿) 위 · 글자 11 아래. 평소 = 선 아이콘 · #4E5968 · 보통 굵기,
/// 고름 = 채운 아이콘 · #333D4B(한 단계 진하게) · 굵게(261009 사장 '비즈 푸터는 이렇게 디자인해줘 ios만').
/// 누르면 아이콘이 쫀득하게 출렁인다 — 웹 비즈 탭바(bizTabJelly)와 같은 값.
private final class BizGlassTabButton: UIControl {
    private static let normalColor = UIColor(red: 0x4E / 255, green: 0x59 / 255, blue: 0x68 / 255, alpha: 1)
    private static let selectedColor = UIColor(red: 0x33 / 255, green: 0x3D / 255, blue: 0x4B / 255, alpha: 1)
    private static let iconSize: CGFloat = 26
    private static let iconTop: CGFloat = 7.5        // 견본: 아이콘 가운데가 알약 위에서 20.5, 글자 가운데가 40.5
    private static let labelCenterY: CGFloat = 40.5

    private let item: BizGlassTabBar.Item
    private let iconView = UIImageView()
    private let titleLabel = UILabel()

    init(item: BizGlassTabBar.Item) {
        self.item = item
        super.init(frame: .zero)
        isAccessibilityElement = true
        accessibilityLabel = item.title
        accessibilityTraits = .button
        showsLargeContentViewer = true
        largeContentTitle = item.title
        scalesLargeContentImage = true

        iconView.contentMode = .scaleAspectFit
        iconView.isUserInteractionEnabled = false
        addSubview(iconView)

        titleLabel.text = item.title
        titleLabel.textAlignment = .center
        titleLabel.adjustsFontSizeToFitWidth = true
        titleLabel.minimumScaleFactor = 0.8
        titleLabel.isUserInteractionEnabled = false
        addSubview(titleLabel)

        addTarget(self, action: #selector(pressDown), for: .touchDown)
        applyState()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var isSelected: Bool {
        didSet { if oldValue != isSelected { applyState() } }
    }

    private func applyState() {
        let color = isSelected ? Self.selectedColor : Self.normalColor
        iconView.image = (isSelected ? (item.selectedIcon ?? item.icon) : item.icon)
        largeContentImage = iconView.image
        iconView.tintColor = color
        titleLabel.textColor = color
        titleLabel.font = UIFont.systemFont(ofSize: 11, weight: isSelected ? .semibold : .medium)
        accessibilityTraits = isSelected ? [.button, .selected] : .button
        setNeedsLayout()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let size = Self.iconSize
        // 출렁임(transform) 중에도 자리가 틀어지지 않게 bounds · center 로.
        // 출렁임 기준점 = 웹 transform-origin 50% 60%(아래쪽을 조금 더 붙잡고 늘어난다) — center 는 그 기준점 자리
        iconView.layer.anchorPoint = CGPoint(x: 0.5, y: 0.6)
        iconView.bounds = CGRect(x: 0, y: 0, width: size, height: size)
        iconView.center = CGPoint(x: bounds.midX, y: Self.iconTop + size * 0.6)
        let labelHeight = ceil(titleLabel.font.lineHeight)
        titleLabel.frame = CGRect(x: 2, y: Self.labelCenterY - labelHeight / 2, width: max(0, bounds.width - 4), height: labelHeight)
    }

    @objc private func pressDown() {
        guard !UIAccessibility.isReduceMotionEnabled else { return }
        let jelly = CAKeyframeAnimation(keyPath: "transform")
        let scales: [(CGFloat, CGFloat)] = [(1, 1), (1.3, 0.82), (0.88, 1.1), (1.1, 0.95), (0.96, 1.03), (1.02, 0.99), (1, 1)]
        jelly.values = scales.map { NSValue(caTransform3D: CATransform3DMakeScale($0.0, $0.1, 1)) }
        jelly.keyTimes = [0, 0.22, 0.40, 0.56, 0.70, 0.84, 1]
        jelly.duration = 0.64
        jelly.calculationMode = .linear
        iconView.layer.removeAnimation(forKey: "jelly")
        iconView.layer.add(jelly, forKey: "jelly")
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
    /// 비즈 화면 바(261009 사장 '비즈 푸터는 이렇게 디자인해줘 ios만') — 비즈 모드에서만 보이고 그동안 위 시스템 탭바(contentStack)는 숨는다
    private let bizBar = BizGlassTabBar()
    private var isBizStyle = false
    private let toggleContainerView = UIView()
    private let toggleSurfaceView = UIVisualEffectView(effect: LiquidGlassEffectFactory.controlEffect())
    private let toggleTintView = UIView()
    private let toggleButton = UIButton(type: .system)
    private let contentStack = UIStackView()

    private var items: [LiquidNavItem] = []
    private var iconCache: [String: UIImage] = [:]
    private var selectedPath = "/main"
    /// 웹이 '어느 탭인지'를 직접 알려 주는 탭 묶음(비즈 탭바 data-active-tab)은 경로 대신 이 id 로 고른다.
    /// 비즈 탭 경로는 /biz · /biz/news 처럼 서로 앞부분이 겹쳐 경로 비교(hasPrefix)로는 홈이 늘 같이 골라지고,
    /// /biz/history 처럼 기업소개 묶음에 드는 화면도 경로만으론 못 맞춘다(261009 사장 'iOS 비즈 네비게이션바'). nil = 경로로 고름
    private var selectedItemId: String?
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

        bizBar.translatesAutoresizingMaskIntoConstraints = false
        bizBar.isHidden = true
        bizBar.onSelect = { [weak self] index in self?.selectItem(at: index) }
        bizBar.onBack = { [weak self] in
            guard let self = self else { return }
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            self.delegate?.liquidGlassNavigationBarDidTapBack(self)
        }
        addSubview(bizBar)

        NSLayoutConstraint.activate([
            contentStack.topAnchor.constraint(equalTo: topAnchor),
            contentStack.leadingAnchor.constraint(equalTo: leadingAnchor),
            contentStack.trailingAnchor.constraint(equalTo: trailingAnchor),
            contentStack.bottomAnchor.constraint(equalTo: bottomAnchor),

            toggleContainerView.widthAnchor.constraint(equalToConstant: 80),
            toggleContainerView.heightAnchor.constraint(equalToConstant: 80),

            tabBar.heightAnchor.constraint(equalTo: heightAnchor),

            bizBar.topAnchor.constraint(equalTo: topAnchor),
            bizBar.leadingAnchor.constraint(equalTo: leadingAnchor),
            bizBar.trailingAnchor.constraint(equalTo: trailingAnchor),
            bizBar.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    /// 묶음 모양 바꾸기 — 비즈면 비즈 바(동그란 ← + 유리 알약), 아니면 지금까지의 시스템 탭바.
    /// 그림자도 견본에 맞춘다 — 토스 바는 흰 화면 위에서 그림자가 거의 안 보이고 가는 테두리만 보인다(실측: 바 바로 밑도 흰색).
    /// iOS 26 은 유리가 스스로 띄워 보이니 그림자 없음, 그 전 버전은 아주 옅게. 일반 탭바는 원래 값 그대로
    private func applyBarStyle() {
        contentStack.isHidden = isBizStyle
        bizBar.isHidden = !isBizStyle
        if isBizStyle {
            layer.shadowOpacity = usesNativeLiquidGlass ? 0 : 0.05
            layer.shadowRadius = 10
            layer.shadowOffset = CGSize(width: 0, height: 3)
        } else {
            layer.shadowOpacity = usesNativeLiquidGlass ? 0.10 : 0.14
            layer.shadowRadius = usesNativeLiquidGlass ? 22 : 28
            layer.shadowOffset = CGSize(width: 0, height: usesNativeLiquidGlass ? 10 : 14)
        }
    }

    // 비즈 모드: 비즈 바(BizGlassTabBar.hitTest)가 안 받은 곳(바 위쪽 띠 · 아래 띄운 자리 대부분)은 아래 웹으로 넘긴다(일반 탭바는 예전 그대로)
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let hit = super.hitTest(point, with: event)
        if isBizStyle, hit === self { return nil }
        return hit
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
                   selectedItemId: String? = nil,
                   showsModeToggle: Bool,
                   isProMode: Bool,
                   isBizStyle: Bool = false) {
        let previousSelectedIndex = self.items.firstIndex(where: isSelected)
        let previousSelectedPath = self.selectedPath
        let previousSelectedItemId = self.selectedItemId
        let changedItems = self.items != items
        let changedStyle = self.isBizStyle != isBizStyle
        self.items = items
        self.selectedPath = selectedPath
        self.selectedItemId = selectedItemId
        self.showsModeToggle = showsModeToggle
        self.isProMode = isProMode
        self.isBizStyle = isBizStyle

        if changedItems {
            rebuildTabBarItems()
        }
        if changedItems || changedStyle {
            // 비즈 바 칸은 비즈 모드일 때만 채운다(일반 모드에선 비워 둔다 — 숨어 있어도 칸을 들고 있지 않게)
            bizBar.setItems(isBizStyle ? items.map { item in
                BizGlassTabBar.Item(
                    title: item.title,
                    icon: navIcon(named: item.iconAssetName),
                    selectedIcon: navIcon(named: "\(item.iconAssetName)-active")
                )
            } : [])
            applyBarStyle()
        }
        updateModeToggle()

        let nextSelectedIndex = self.items.firstIndex(where: isSelected)
        let shouldUpdateSelection = changedItems ||
            changedStyle ||
            previousSelectedIndex != nextSelectedIndex ||
            previousSelectedPath != selectedPath ||
            previousSelectedItemId != selectedItemId
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
        // 비즈 바: 고른 칸 뒤 캡슐이 미끄러져 옮겨 간다(묶음이 막 바뀐 때 · 숨은 동안은 그 자리에 바로)
        bizBar.setSelectedIndex(isBizStyle ? selectedIndex : nil, animated: animated && isBizStyle && alpha > 0.01)
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
        if let selectedItemId {
            return item.id == selectedItemId
        }
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
        if selectedItemId != nil { selectedItemId = navItem.id }   // id 로 고르는 묶음(비즈)이면 누른 탭 id 로
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
