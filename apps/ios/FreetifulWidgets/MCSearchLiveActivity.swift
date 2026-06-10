import ActivityKit
import WidgetKit
import SwiftUI

// 다이나믹 아일랜드 + 잠금화면 — "사회자 찾는 중" 라이브 액티비티
struct MCSearchLiveActivity: Widget {
    private let brandBlue = Color(red: 49/255, green: 130/255, blue: 246/255)

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: MCSearchAttributes.self) { context in
            // 잠금화면 / 배너
            HStack(spacing: 12) {
                searchIcon(size: 38)
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.state.statusText)
                        .font(.system(size: 15, weight: .bold))
                    Text(context.attributes.categoryLabel)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(timerInterval: context.attributes.startedAt...context.attributes.startedAt.addingTimeInterval(3600), countsDown: false)
                    .font(.system(size: 12, weight: .semibold).monospacedDigit())
                    .foregroundStyle(brandBlue)
            }
            .padding(14)
            .activityBackgroundTint(Color(.systemBackground).opacity(0.85))
            .activitySystemActionForegroundColor(brandBlue)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    searchIcon(size: 34)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: context.attributes.startedAt...context.attributes.startedAt.addingTimeInterval(3600), countsDown: false)
                        .font(.system(size: 13, weight: .semibold).monospacedDigit())
                        .foregroundStyle(brandBlue)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 2) {
                        Text(context.state.statusText)
                            .font(.system(size: 15, weight: .bold))
                        Text("딱 맞는 \(context.attributes.categoryLabel)를 찾고 있어요")
                            .font(.system(size: 12))
                            .foregroundStyle(.secondary)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ProgressView()
                        .progressViewStyle(.linear)
                        .tint(brandBlue)
                        .padding(.horizontal, 6)
                        .padding(.bottom, 2)
                }
            } compactLeading: {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(brandBlue)
            } compactTrailing: {
                Text(timerInterval: context.attributes.startedAt...context.attributes.startedAt.addingTimeInterval(3600), countsDown: false)
                    .font(.system(size: 12, weight: .semibold).monospacedDigit())
                    .foregroundStyle(brandBlue)
                    .frame(maxWidth: 52)
                    .minimumScaleFactor(0.7)
            } minimal: {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(brandBlue)
            }
            .keylineTint(brandBlue)
        }
    }

    @ViewBuilder
    private func searchIcon(size: CGFloat) -> some View {
        ZStack {
            Circle().fill(brandBlue.opacity(0.16))
            Image(systemName: "magnifyingglass")
                .font(.system(size: size * 0.45, weight: .bold))
                .foregroundStyle(brandBlue)
        }
        .frame(width: size, height: size)
    }
}
