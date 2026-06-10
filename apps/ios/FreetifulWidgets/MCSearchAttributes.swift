import ActivityKit
import Foundation

// 사회자 찾기 Live Activity 속성 — 앱 타깃의 동일 구조체와 이름/필드 일치(매칭은 타입명+Codable 형태로 이뤄짐)
struct MCSearchAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var statusText: String   // 예: "사회자 찾는 중"
    }
    var categoryLabel: String    // 예: "결혼식 사회자"
    var startedAt: Date
}
