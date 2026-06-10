import ActivityKit
import Foundation

// 위젯 익스텐션의 MCSearchAttributes 와 동일 정의 — Live Activity 매칭은 타입명+Codable 형태 기준
struct MCSearchAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var statusText: String
    }
    var categoryLabel: String
    var startedAt: Date
}

// 사회자 찾기 라이브 액티비티 (다이나믹 아일랜드) 시작/종료
enum MCSearchActivity {
    static func start(category: String) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        endAll()   // 기존 검색 액티비티 교체
        let attrs = MCSearchAttributes(categoryLabel: category.isEmpty ? "결혼식 사회자" : category, startedAt: Date())
        let state = MCSearchAttributes.ContentState(statusText: "사회자 찾는 중")
        let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(60 * 60))   // 1시간 후 자동 흐림
        _ = try? Activity<MCSearchAttributes>.request(attributes: attrs, content: content, pushType: nil)
    }

    static func endAll() {
        for activity in Activity<MCSearchAttributes>.activities {
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
    }
}
