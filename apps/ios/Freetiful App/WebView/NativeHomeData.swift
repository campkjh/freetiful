import UIKit

// 홈 데이터 네이티브 직접 호출 (웹 브리지/Vercel 캐시 의존 제거)
enum NativeHomeData {
    private static let base = "https://freetiful.com/api/v1"
    private static var prosCache: [[String: Any]]?
    private static var bizCache: [[String: Any]]?
    private static var bannersCache: [[String: Any]]?

    // MARK: - 디스크 캐시 (콜드스타트 대비 — 직전 데이터 즉시 렌더 후 백그라운드 갱신)
    private static func saveDisk(_ key: String, _ arr: [[String: Any]]) {
        if let data = try? JSONSerialization.data(withJSONObject: arr) {
            UserDefaults.standard.set(data, forKey: "ftHomeV2_\(key)")
        }
    }
    private static func loadDisk(_ key: String) -> [[String: Any]]? {
        guard let data = UserDefaults.standard.data(forKey: "ftHomeV2_\(key)"),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { return nil }
        return obj
    }
    private static func cachedPros() -> [[String: Any]]? { prosCache ?? loadDisk("pros") }
    private static func cachedBiz() -> [[String: Any]]? { bizCache ?? loadDisk("biz") }
    private static func cachedBannersRaw() -> [[String: Any]]? { bannersCache ?? loadDisk("banners") }

    // MARK: - 공개 로더
    static func loadSections(_ done: @escaping (HomeSectionsData) -> Void) {
        // 1) 캐시 즉시 렌더
        if let cp = cachedPros(), !cp.isEmpty {
            let d = deriveSections(pros: cp, biz: cachedBiz() ?? [])
            DispatchQueue.main.async { done(d) }
        }
        // 2) 신선 데이터로 갱신 (실패/빈값이면 캐시 유지)
        fetchPros { pros in
            fetchBusiness { biz in
                guard !pros.isEmpty else { return }
                let d = deriveSections(pros: pros, biz: biz)
                DispatchQueue.main.async { done(d) }
            }
        }
    }

    static func loadBanners(_ done: @escaping ([HomeBanner]) -> Void) {
        if let cb = cachedBannersRaw(), !cb.isEmpty {
            DispatchQueue.main.async { done(parseBanners(cb)) }
        }
        getJSON("\(base)/banners?placement=home") { obj in
            let arr = asArray(obj, keys: ["data", "items"])
            guard !arr.isEmpty else { return }
            bannersCache = arr; saveDisk("banners", arr)
            DispatchQueue.main.async { done(parseBanners(arr)) }
        }
    }
    private static func parseBanners(_ arr: [[String: Any]]) -> [HomeBanner] {
        arr.compactMap { d in
            let img = (d["imageUrl"] as? String) ?? (d["image"] as? String) ?? ""
            guard !img.isEmpty else { return nil }
            return HomeBanner(image: img, link: (d["linkUrl"] as? String) ?? (d["link"] as? String) ?? "")
        }
    }

    static func loadCategory(_ index: Int, _ done: @escaping ([HomeProItem]) -> Void) {
        if let cp = cachedPros(), !cp.isEmpty {
            let items = filterCategory(index, cp).prefix(100).map { proItem($0) }
            DispatchQueue.main.async { done(Array(items)) }
        }
        fetchPros { pros in
            guard !pros.isEmpty else { return }
            let items = filterCategory(index, pros).prefix(100).map { proItem($0) }
            DispatchQueue.main.async { done(Array(items)) }
        }
    }

    // 상세: (1) 디스크 캐시 즉시 → (2) 없으면 홈 리스트의 기본정보로 즉시(헤더/사진/경력/별점) → (3) 신선 상세로 교체
    // done 이 최대 2번 호출될 수 있음(부분→완전). 첫 호출만 애니메이션, 둘째는 교체.
    static func loadProDetail(_ id: String, _ done: @escaping ([String: Any]?) -> Void) {
        var rendered = false
        if let cached = loadDetailDisk(id) {
            rendered = true
            DispatchQueue.main.async { done(cached) }
        } else if let basic = cachedProBasic(id) {
            rendered = true
            DispatchQueue.main.async { done(basic) }
        }
        getJSON("\(base)/discovery/pros/\(id)") { obj in
            guard let d = obj as? [String: Any] else {
                if !rendered { DispatchQueue.main.async { done(nil) } }
                return
            }
            saveDetailDisk(id, d)
            DispatchQueue.main.async { done(d) }
        }
    }
    private static func saveDetailDisk(_ id: String, _ d: [String: Any]) {
        if let data = try? JSONSerialization.data(withJSONObject: d) {
            UserDefaults.standard.set(data, forKey: "ftProDetail_\(id)")
        }
    }
    private static func loadDetailDisk(_ id: String) -> [String: Any]? {
        guard let data = UserDefaults.standard.data(forKey: "ftProDetail_\(id)"),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return obj
    }
    // 프로필 편집 후 호출 — 상세 디스크 캐시/프리페치 기록 비움(다음 조회 신선)
    static func clearDetailCaches() {
        prefetchedIds.removeAll()
        for k in UserDefaults.standard.dictionaryRepresentation().keys where k.hasPrefix("ftProDetail_") {
            UserDefaults.standard.removeObject(forKey: k)
        }
    }
    // 홈 리스트(메모리/디스크) 캐시에서 특정 사회자 기본정보
    static func cachedProBasic(_ id: String) -> [String: Any]? {
        cachedPros()?.first { ($0["id"] as? String) == id }
    }
    // 추천 사회자 (현재 제외, 홈 캐시 재사용 — 추가 네트워크 없음)
    static func recommendedPros(excluding id: String, limit: Int = 10) -> [[String: Any]] {
        guard let arr = cachedPros() else { return [] }
        return Array(arr.filter { ($0["id"] as? String) != id }.prefix(limit))
    }

    // 상위 사회자 상세 프리페치 → 디스크 캐시 워밍(탭 시 상세설명 즉시 렌더)
    private static var prefetchedIds = Set<String>()
    static func prefetchDetails(_ ids: [String], limit: Int = 8) {
        let targets = ids.prefix(limit).filter { !prefetchedIds.contains($0) && loadDetailDisk($0) == nil }
        for id in targets {
            prefetchedIds.insert(id)
            getJSON("\(base)/discovery/pros/\(id)") { obj in
                if let d = obj as? [String: Any] { saveDetailDisk(id, d) }
            }
        }
    }

    static func search(_ query: String, _ done: @escaping ([HomeProItem]) -> Void) {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { DispatchQueue.main.async { done([]) }; return }
        let enc = q.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? q
        getJSON("\(base)/discovery/pros?search=\(enc)&limit=40&withTotal=false") { obj in
            let arr = asArray(obj, keys: ["data", "items"])
            let items = arr.map { proItem($0) }
            DispatchQueue.main.async { done(items) }
        }
    }

    // MARK: - fetch
    private static func fetchPros(_ done: @escaping ([[String: Any]]) -> Void) {
        if let c = prosCache { done(c); return }
        getJSON("\(base)/discovery/pros?limit=100&sort=reviews&withTotal=false") { obj in
            let arr = asArray(obj, keys: ["data", "items"])
            if !arr.isEmpty {
                prosCache = arr; saveDisk("pros", arr)
                // 잠시 후 상위 사회자 상세 프리페치(초기 렌더와 경쟁 방지)
                DispatchQueue.global().asyncAfter(deadline: .now() + 1.5) {
                    prefetchDetails(arr.compactMap { $0["id"] as? String })
                }
            }
            done(arr)
        }
    }
    private static func fetchBusiness(_ done: @escaping ([[String: Any]]) -> Void) {
        if let c = bizCache { done(c); return }
        getJSON("\(base)/business?limit=100") { obj in
            let arr = asArray(obj, keys: ["items", "data"])
            if !arr.isEmpty { bizCache = arr; saveDisk("biz", arr) }
            done(arr)
        }
    }
    private static func getJSON(_ urlStr: String, attempt: Int = 0, _ done: @escaping (Any?) -> Void) {
        guard let url = URL(string: urlStr) else { done(nil); return }
        var req = URLRequest(url: url)
        req.timeoutInterval = 35   // Railway 콜드스타트(~30초) 대비
        req.cachePolicy = .reloadIgnoringLocalCacheData   // URLSession 캐시가 옛 응답(12명/경력없음) 서빙 방지 — 항상 최신
        URLSession.shared.dataTask(with: req) { data, _, _ in
            if let data = data, let obj = try? JSONSerialization.jsonObject(with: data) { done(obj); return }
            if attempt < 2 {   // 콜드스타트 실패 시 재시도(2회)
                DispatchQueue.global().asyncAfter(deadline: .now() + 2.0) { getJSON(urlStr, attempt: attempt + 1, done) }
            } else { done(nil) }
        }.resume()
    }
    private static func asArray(_ obj: Any?, keys: [String]) -> [[String: Any]] {
        if let a = obj as? [[String: Any]] { return a }
        if let d = obj as? [String: Any] {
            for k in keys { if let a = d[k] as? [[String: Any]] { return a } }
        }
        return []
    }

    // MARK: - 파생 (전체 홈 섹션)
    private static let bizCategories = ["웨딩홀", "드레스", "피부과", "스튜디오", "헤어", "메이크업", "스냅"]
    private static func deriveSections(pros: [[String: Any]], biz: [[String: Any]]) -> HomeSectionsData {
        let best = pros.filter { isWedding($0) }
            .sorted { intVal($0["careerYears"]) > intVal($1["careerYears"]) }
            .prefix(3).map { bestPro($0) }
        let morePros = pros.prefix(30).map { proCard($0) }   // 전체 사회자 노출 (이전 9 → 전체)
        var event = pros.filter { isEvent($0) }
        if event.count < 9 {
            let ids = Set(event.compactMap { $0["id"] as? String })
            event += pros.filter { !ids.contains(($0["id"] as? String) ?? "") }
        }
        let eventPros = event.prefix(9).map { proCard($0) }
        // 업체(웨딩파트너)는 웹 큐레이션 브리지(nativeHomeBusiness)로 받음 — API 원본 이미지가 엉뚱해서 여기선 비움
        _ = biz
        return HomeSectionsData(best: Array(best), morePros: Array(morePros), eventPros: Array(eventPros), businessSections: [])
    }

    private static func filterCategory(_ index: Int, _ pros: [[String: Any]]) -> [[String: Any]] {
        switch index {
        case 1: return pros   // 결혼식사회자 = 승인+비숨김 전체 노출
        case 2: return pros.filter { isEvent($0) }
        case 3: return pros.filter { !strArr($0["languages"]).isEmpty }
        default: return pros
        }
    }

    // MARK: - 필터/매핑 헬퍼
    private static func strArr(_ v: Any?) -> [String] {
        if let a = v as? [String] { return a }
        if let a = v as? [Any] { return a.compactMap { $0 as? String } }
        return []
    }
    private static func catNames(_ p: [String: Any]) -> [String] { strArr(p["categories"]).map { $0.lowercased() } }
    private static func tagNames(_ p: [String: Any]) -> [String] { strArr(p["tags"]).map { $0.lowercased() } }
    private static func isWedding(_ p: [String: Any]) -> Bool {
        catNames(p).contains { $0.contains("결혼식") || $0.contains("사회자") || $0.contains("mc") }
    }
    private static func isEvent(_ p: [String: Any]) -> Bool {
        (catNames(p) + tagNames(p)).contains {
            $0.contains("행사") || $0.contains("기업") || $0.contains("컨퍼런스") || $0.contains("컨벤션") || $0.contains("쇼호스트") || $0.contains("event")
        }
    }
    private static func intVal(_ v: Any?) -> Int { (v as? Int) ?? Int((v as? Double) ?? 0) }
    private static func proImg(_ p: [String: Any]) -> String {
        if let s = p["profileImageUrl"] as? String, !s.isEmpty { return s }
        if let a = p["images"] as? [String], let f = a.first { return f }
        if let a = p["images"] as? [[String: Any]], let f = a.first?["imageUrl"] as? String { return f }
        return ""
    }
    private static func proName(_ p: [String: Any]) -> String { (p["name"] as? String) ?? "사회자" }
    private static func proItem(_ p: [String: Any]) -> HomeProItem {
        HomeProItem(id: (p["id"] as? String) ?? "", name: proName(p), image: proImg(p),
                    rating: (p["avgRating"] as? Double) ?? Double(intVal(p["avgRating"])),
                    reviewCount: intVal(p["reviewCount"]),
                    intro: (p["shortIntro"] as? String) ?? (p["mainExperience"] as? String) ?? "",
                    careerYears: intVal(p["careerYears"]),
                    tags: Array(strArr(p["tags"]).prefix(3)))
    }
    private static func bestPro(_ p: [String: Any]) -> HomeBestPro {
        HomeBestPro(id: (p["id"] as? String) ?? "", name: proName(p), image: proImg(p), careerYears: intVal(p["careerYears"]))
    }
    private static func proCard(_ p: [String: Any]) -> HomeProCard {
        HomeProCard(id: (p["id"] as? String) ?? "", name: proName(p), image: proImg(p),
                    careerYears: intVal(p["careerYears"]), tags: Array(strArr(p["tags"]).prefix(3)),
                    isPartner: (p["isFeatured"] as? Bool) ?? (p["showPartnersLogo"] as? Bool) ?? false)
    }
    private static func bizMatches(_ b: [String: Any], _ cat: String) -> Bool {
        let cats = (b["categories"] as? [[String: Any]])?.compactMap { ($0["category"] as? [String: Any])?["name"] as? String } ?? strArr(b["categories"])
        if cats.contains(where: { $0.contains(cat) }) { return true }
        if let bt = b["businessType"] as? String, bt.contains(cat) { return true }
        return false
    }
    private static func bizImg(_ b: [String: Any]) -> String {
        if let a = b["images"] as? [[String: Any]], let f = a.first?["imageUrl"] as? String { return f }
        if let a = b["images"] as? [String], let f = a.first { return f }
        return ""
    }
    private static func bizItem(_ b: [String: Any], popular: Bool) -> HomeBusiness {
        let addr = (b["address"] as? String) ?? (b["region"] as? String) ?? ""
        let loc = addr.split(separator: " ").first.map(String.init) ?? ""
        return HomeBusiness(id: (b["id"] as? String) ?? "",
                            name: (b["businessName"] as? String) ?? (b["name"] as? String) ?? "업체",
                            location: loc, image: bizImg(b),
                            tags: Array(strArr(b["tags"]).prefix(3)), isPopular: popular)
    }
}
