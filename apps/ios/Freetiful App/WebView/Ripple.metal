//
//  Ripple.metal
//  Freetiful App
//
//  애플 WWDC24 "Create custom visual effects with SwiftUI" 공식 Ripple 셰이더.
//  탭 지점(origin)에서 사인파가 감쇠하며 퍼지는 물결 왜곡 + 마루/골 하이라이트.
//

#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

[[ stitchable ]]
half4 Ripple(float2 position, SwiftUI::Layer layer, float2 origin, float time,
             float amplitude, float frequency, float decay, float speed) {
    // 현재 픽셀과 물결 시작점 사이 거리
    float distance = length(position - origin);
    // 물결이 이 픽셀에 도달하는 데 걸리는 시간
    float delay = distance / speed;

    time -= delay;
    time = max(0.0, time);

    // 지수 감쇠하는 사인파
    float rippleAmount = amplitude * sin(frequency * time) * exp(-decay * time);

    float2 n = normalize(position - origin);
    float2 newPosition = position + rippleAmount * n;

    half4 color = layer.sample(newPosition);
    // 마루는 밝게, 골은 어둡게 — 물빛 하이라이트
    color.rgb += 0.3 * (rippleAmount / amplitude) * color.a;

    return color;
}
