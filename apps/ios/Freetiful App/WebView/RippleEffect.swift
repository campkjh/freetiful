//
//  RippleEffect.swift
//  Freetiful App
//
//  애플 WWDC24 Ripple(Metal 셰이더) 물결을 UIKit 뷰에 1회 재생하는 브릿지.
//  대상 뷰를 스냅샷 떠서 SwiftUI layerEffect 오버레이로 일렁이게 한 뒤 제거 —
//  원본 뷰 계층은 건드리지 않아 어떤 UIKit 화면에도 붙일 수 있다.
//

import SwiftUI
import UIKit
import CoreHaptics

// MARK: - SwiftUI 물결 오버레이

private struct RippleSnapshotView: View {
    let image: UIImage
    let origin: CGPoint
    let duration: TimeInterval
    var amplitude: CGFloat = 12   // 왜곡 강도(px)
    var frequency: CGFloat = 15   // 물결 촘촘함
    var decay: CGFloat = 8        // 감쇠(클수록 빨리 잦아듦)
    var speed: CGFloat = 1200     // 전파 속도(px/s)
    private let start = Date()

    var body: some View {
        TimelineView(.animation) { tl in
            let t = tl.date.timeIntervalSince(start)
            Image(uiImage: image)
                .resizable()
                .layerEffect(
                    ShaderLibrary.Ripple(
                        .float2(origin),
                        .float(t),
                        .float(amplitude),
                        .float(frequency),
                        .float(decay),
                        .float(speed)
                    ),
                    maxSampleOffset: CGSize(width: amplitude, height: amplitude),
                    isEnabled: t > 0 && t < duration
                )
        }
        .allowsHitTesting(false)
    }
}

// MARK: - "지이잉" 연속 햅틱 (NameDrop 느낌)

extension Haptics {
    private static var engine: CHHapticEngine?

    /// 아이폰 맞대기(NameDrop)처럼 지이잉— 하고 이어지는 연속 진동.
    static func buzz(duration: TimeInterval = 0.5) {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else {
            UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            return
        }
        do {
            if engine == nil { engine = try CHHapticEngine() }
            guard let engine else { return }
            try engine.start()
            // 강도가 차올랐다 잦아드는 연속 이벤트 — 지이잉
            let intensity = CHHapticParameterCurve(parameterID: .hapticIntensityControl, controlPoints: [
                .init(relativeTime: 0, value: 0.35),
                .init(relativeTime: duration * 0.25, value: 1.0),
                .init(relativeTime: duration, value: 0.0),
            ], relativeTime: 0)
            let event = CHHapticEvent(eventType: .hapticContinuous, parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.9),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.45),
            ], relativeTime: 0, duration: duration)
            let pattern = try CHHapticPattern(events: [event], parameterCurves: [intensity])
            try engine.makePlayer(with: pattern).start(atTime: 0)
        } catch {
            UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
        }
    }
}

// MARK: - UIKit 브릿지

extension UIView {
    /// 애플 Metal 셰이더 물결을 이 뷰 위 `point`에서 1회 재생.
    func playRipple(at point: CGPoint, duration: TimeInterval = 1.0,
                    amplitude: CGFloat = 12, frequency: CGFloat = 15,
                    decay: CGFloat = 8, speed: CGFloat = 1200) {
        guard bounds.width > 1, bounds.height > 1 else { return }
        let image = UIGraphicsImageRenderer(bounds: bounds).image { _ in
            drawHierarchy(in: bounds, afterScreenUpdates: false)
        }
        let host = UIHostingController(rootView: RippleSnapshotView(image: image, origin: point, duration: duration, amplitude: amplitude, frequency: frequency, decay: decay, speed: speed))
        host.view.backgroundColor = .clear
        host.view.isUserInteractionEnabled = false
        host.view.frame = bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        host.view.layer.cornerRadius = layer.cornerRadius
        host.view.layer.cornerCurve = layer.cornerCurve
        host.view.clipsToBounds = layer.cornerRadius > 0
        addSubview(host.view)
        // 재생 종료 후 오버레이 제거 (host 는 클로저 캡처로 유지)
        var holder: UIHostingController<RippleSnapshotView>? = host
        // 왜곡이 잦아든 뒤 스냅샷을 크로스페이드로 걷어냄 — 밑에서 내용이 바뀌었어도
        // 뚝 끊기지 않고 새 화면으로 자연스럽게 전환된다.
        DispatchQueue.main.asyncAfter(deadline: .now() + duration) {
            UIView.animate(withDuration: 0.3, animations: {
                holder?.view.alpha = 0
            }, completion: { _ in
                holder?.view.removeFromSuperview()
                holder = nil
            })
        }
    }
}
