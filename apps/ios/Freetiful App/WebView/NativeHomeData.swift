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
        // 2) 신선 데이터로 갱신 — 사회자 로드되면 즉시 렌더.
        //    업체는 deriveSections 에서 안 쓰이므로(웹 브리지로 받음) 기다리지 않음 → 초기 로드 가속.
        fetchPros { pros in
            guard !pros.isEmpty else { return }
            let d = deriveSections(pros: pros, biz: cachedBiz() ?? [])
            DispatchQueue.main.async { done(d) }
        }
        // 업체 캐시는 병렬로 워밍만 (렌더 블로킹 안 함)
        fetchBusiness { _ in }
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
    // 프로필 편집 후 호출 — 상세 디스크 캐시/프리페치 기록 + 홈 리스트 메모리 캐시 비움(다음 조회 신선)
    // prosCache 메모리를 비워야 fetchPros 의 단락(short-circuit)이 풀려 홈/카테고리 리스트가 새 데이터로 갱신됨
    static func clearDetailCaches() {
        prefetchLock.lock(); prefetchedIds.removeAll(); prefetchLock.unlock()
        prosCache = nil
        UserDefaults.standard.removeObject(forKey: "ftHomeV2_pros")   // 리스트 디스크 캐시 — 옛 기본정보(옛 사진) 폴백 방지
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
    private static let prefetchLock = NSLock()   // prefetchedIds 동시 접근 보호(백그라운드 스레드 레이스 방지)
    static func prefetchDetails(_ ids: [String], limit: Int = 8) {
        // contains/insert 를 락으로 원자적으로 — 동시 호출 시 Set 버퍼 손상(SIGABRT) 방지
        var targets: [String] = []
        prefetchLock.lock()
        for id in ids.prefix(limit) where !prefetchedIds.contains(id) {
            if loadDetailDisk(id) == nil {
                prefetchedIds.insert(id)
                targets.append(id)
            }
        }
        prefetchLock.unlock()
        for id in targets {
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
                // 잠시 후 상위 사회자 상세 프리페치(초기 렌더 + 새요청/채팅 직접 fetch 와 경쟁 방지)
                DispatchQueue.global().asyncAfter(deadline: .now() + 6.0) {
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
        case 2: return pros   // 행사사회자 = 결혼식사회자와 동일(전체)
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

    // MARK: - 카테고리 리스트 (홈 카테고리 아이콘 → 네이티브 리스트)
    static func loadProCategory(category: String, sort: String, _ done: @escaping ([CategoryProItem]) -> Void) {
        if let cp = cachedPros(), !cp.isEmpty {
            DispatchQueue.main.async { done(mapProCategory(cp, category: category, sort: sort)) }
        }
        fetchPros { pros in
            guard !pros.isEmpty else { return }
            DispatchQueue.main.async { done(mapProCategory(pros, category: category, sort: sort)) }
        }
    }
    private static func mapProCategory(_ pros: [[String: Any]], category: String, sort: String) -> [CategoryProItem] {
        let c = category.lowercased()
        var filtered = pros
        if c.contains("외국어") || c.contains("통역") || c.contains("foreign") {
            filtered = pros.filter { !strArr($0["languages"]).isEmpty }
        }
        // 행사사회자 = 결혼식사회자와 동일(승인 전체 노출)
        switch sort {
        case "avg_rating": filtered.sort { dblVal($0["avgRating"]) > dblVal($1["avgRating"]) }
        case "review_count": filtered.sort { intVal($0["reviewCount"]) > intVal($1["reviewCount"]) }
        case "experience": filtered.sort { intVal($0["careerYears"]) > intVal($1["careerYears"]) }
        default: break   // popular = fetch 순서(추천)
        }
        return filtered.prefix(120).enumerated().map { catProItem($1, rank: $0 + 1) }
    }
    private static func dblVal(_ v: Any?) -> Double { (v as? Double) ?? Double(intVal(v)) }
    private static func catProItem(_ p: [String: Any], rank: Int) -> CategoryProItem {
        CategoryProItem(
            id: (p["id"] as? String) ?? "", name: proName(p), image: proImg(p),
            intro: (p["shortIntro"] as? String) ?? (p["mainExperience"] as? String) ?? "",
            rating: dblVal(p["avgRating"]), reviewCount: intVal(p["reviewCount"]),
            careerYears: intVal(p["careerYears"]),
            category: strArr(p["categories"]).first ?? "사회자",
            regions: strArr(p["regions"]), languages: strArr(p["languages"]),
            isNationwide: (p["isNationwide"] as? Bool) ?? false,
            rank: rank)
    }

    static func loadBizCategory(category: String, _ done: @escaping ([CategoryBizItem]) -> Void) {
        // 1) 디스크 캐시 즉시 렌더 (재진입 시 바로 표시) — done 최대 2회(캐시→신선)
        let cacheKey = "ftBizCat_\(category.isEmpty ? "all" : category)"
        if let data = UserDefaults.standard.data(forKey: cacheKey),
           let cached = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]], !cached.isEmpty {
            let items = cached.prefix(80).map { catBizItem($0) }
            DispatchQueue.main.async { done(Array(items)) }
        }
        // 2) 신선 데이터로 갱신
        let enc = category.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? category
        let url = category.isEmpty ? "\(base)/business?limit=80" : "\(base)/business?category=\(enc)&limit=80"
        getJSON(url) { obj in
            var arr = asArray(obj, keys: ["items", "data"])
            // 백엔드 카테고리 스코핑 실패 시 전체에서 클라 필터(웹과 동일한 폴백)
            if arr.isEmpty, !category.isEmpty, let c = cachedBiz() {
                arr = c.filter { bizMatches($0, category) }
            }
            if !arr.isEmpty, let data = try? JSONSerialization.data(withJSONObject: Array(arr.prefix(80))) {
                UserDefaults.standard.set(data, forKey: cacheKey)
            }
            let items = arr.prefix(80).map { catBizItem($0) }
            DispatchQueue.main.async { done(Array(items)) }
        }
    }
    private static func catBizItem(_ b: [String: Any]) -> CategoryBizItem {
        let addr = (b["address"] as? String) ?? ""
        let region = addr.split(separator: " ").prefix(2).joined(separator: " ")
        let cats = (b["categories"] as? [[String: Any]])?.compactMap { ($0["category"] as? [String: Any])?["name"] as? String } ?? strArr(b["categories"])
        let catLabel = cats.isEmpty ? ((b["businessType"] as? String) ?? "웨딩파트너") : cats.joined(separator: " · ")
        return CategoryBizItem(
            id: (b["id"] as? String) ?? "",
            title: (b["businessName"] as? String) ?? (b["name"] as? String) ?? "업체",
            region: region.isEmpty ? "전국" : region, category: catLabel, image: bizImg(b),
            tags: Array(strArr(b["tags"]).prefix(3)))
    }

    // 웨딩파트너 검색
    static func searchBiz(_ query: String, _ done: @escaping ([CategoryBizItem]) -> Void) {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { DispatchQueue.main.async { done([]) }; return }
        let enc = q.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? q
        getJSON("\(base)/business?search=\(enc)&limit=60") { obj in
            let arr = asArray(obj, keys: ["items", "data"])
            let items = arr.prefix(60).map { catBizItem($0) }
            DispatchQueue.main.async { done(items) }
        }
    }

    // ─── 고우선순위 전용 세션 — 홈 이미지/프리페치 트래픽과 분리(시작 직후 대역폭 경쟁 회피) ───
    private static let prioritySession: URLSession = {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.timeoutIntervalForRequest = 15
        cfg.waitsForConnectivity = true
        return URLSession(configuration: cfg)
    }()
    private static func authedGET(_ urlStr: String, token: String, _ done: @escaping (Int, Any?) -> Void) {
        guard let url = URL(string: urlStr) else { done(0, nil); return }
        var req = URLRequest(url: url)
        req.cachePolicy = .reloadIgnoringLocalCacheData
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let started = Date()
        let task = prioritySession.dataTask(with: req) { data, resp, err in
            let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
            let ms = Int(Date().timeIntervalSince(started) * 1000)
            NSLog("[ft.perf] GET %@ → %d (%dms)%@", url.path, code, ms, err != nil ? " err=\(err!.localizedDescription)" : "")
            guard let data = data, code == 200, let obj = try? JSONSerialization.jsonObject(with: data) else {
                done(code, nil); return
            }
            done(code, obj)
        }
        task.priority = URLSessionTask.highPriority
        task.resume()
    }

    private static func isUUID(_ s: String) -> Bool {
        return UUID(uuidString: s) != nil
    }

    // 사회자가 매칭요청 기반으로 채팅방 직접 생성 (웹뷰 JS/캐시 우회 — 새요청 fetch 와 동일 고속 세션)
    static func createRoomAsPro(customerUserId: String, matchRequestId: String, token: String, _ done: @escaping (String?) -> Void) {
        guard !token.isEmpty, isUUID(customerUserId), let url = URL(string: "\(base)/chat/rooms/pro-initiate") else {
            DispatchQueue.main.async { done(nil) }; return
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.cachePolicy = .reloadIgnoringLocalCacheData
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var bodyDict: [String: Any] = ["customerUserId": customerUserId]
        // matchRequestId 는 UUID 일 때만 전송 — 옛 캐시의 비정형 값이 @IsUUID 검증에 걸려
        // 400 나던 문제 방지(없어도 방 생성됨)
        if isUUID(matchRequestId) { bodyDict["matchRequestId"] = matchRequestId }
        req.httpBody = try? JSONSerialization.data(withJSONObject: bodyDict)
        let started = Date()
        let task = prioritySession.dataTask(with: req) { data, resp, _ in
            let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
            let ms = Int(Date().timeIntervalSince(started) * 1000)
            NSLog("[ft.perf] POST /chat/rooms/pro-initiate → %d (%dms)", code, ms)
            var roomId: String? = nil
            if let data = data, (200...299).contains(code),
               let obj = try? JSONSerialization.jsonObject(with: data) {
                if let dict = obj as? [String: Any] {
                    roomId = (dict["id"] as? String) ?? ((dict["data"] as? [String: Any])?["id"] as? String)
                }
            }
            DispatchQueue.main.async { done(roomId) }
        }
        task.priority = URLSessionTask.highPriority
        task.resume()
    }

    // 오래된 캐시 행(customerId 없음)도 빠른 직접 경로로 처리:
    // 고속 직접 세션으로 목록 재조회 → 해당 delivery 의 customerId/matchRequestId 해석 → 방생성.
    // (느린 웹 폴백/getProRequests-콜드 경로를 타지 않게)
    static func openChatResolving(deliveryId: String, token: String, _ done: @escaping (String?) -> Void) {
        guard !token.isEmpty, !deliveryId.isEmpty else { DispatchQueue.main.async { done(nil) }; return }
        authedGET("\(base)/match/pro/requests?limit=100", token: token) { _, obj in
            guard let arr = obj as? [[String: Any]],
                  let d = arr.first(where: { ($0["id"] as? String) == deliveryId }) else {
                DispatchQueue.main.async { done(nil) }; return
            }
            let mr = d["matchRequest"] as? [String: Any] ?? [:]
            let customerId = ((mr["user"] as? [String: Any])?["id"] as? String) ?? ""
            let matchRequestId = (d["matchRequestId"] as? String) ?? (mr["id"] as? String) ?? ""
            guard !customerId.isEmpty else { DispatchQueue.main.async { done(nil) }; return }
            createRoomAsPro(customerUserId: customerId, matchRequestId: matchRequestId, token: token, done)
        }
    }

    // ─── 새요청(매칭 딜리버리) 직접 fetch — 웹뷰 로드/페이지 마운트 대기 없이 즉시 ───
    // 행 형태는 웹 inquiries 페이지의 네이티브 매핑과 동일 (applyInquiryRows 가 그대로 소비)
    static func loadProInquiries(token: String, _ done: @escaping ([[String: Any]]?) -> Void) {
        guard !token.isEmpty else { DispatchQueue.main.async { done(nil) }; return }
        authedGET("\(base)/match/pro/requests?limit=100", token: token) { _, obj in
            guard let arr = obj as? [[String: Any]] else { DispatchQueue.main.async { done(nil) }; return }
            // 전체 탭 기준: pending/viewed 만 (보관 탭은 웹 브리지가 정확히 처리)
            let rows = arr
                .filter { ["pending", "viewed"].contains(($0["status"] as? String) ?? "") }
                .map { inquiryRow($0) }
            DispatchQueue.main.async { done(rows) }
        }
    }
    private static func inquiryRow(_ d: [String: Any]) -> [String: Any] {
        let mr = d["matchRequest"] as? [String: Any] ?? [:]
        let raw = mr["rawUserInput"] as? [String: Any] ?? [:]
        let user = mr["user"] as? [String: Any] ?? [:]
        let kind = (mr["type"] as? String) == "single" ? "single" : "multi"
        let catName = ((mr["category"] as? [String: Any])?["name"] as? String) ?? (raw["categoryName"] as? String) ?? "사회자 요청"
        let evCat = ((mr["eventCategory"] as? [String: Any])?["name"] as? String) ?? (raw["eventType"] as? String) ?? ""
        let eventDate = (mr["eventDate"] as? String) ?? (raw["date"] as? String)
        let eventTime = (raw["timeStart"] as? String) ?? (mr["eventTime"] as? String)
        let eventPart = (raw["eventPart"] as? String) ?? ""
        return [
            "id": (d["id"] as? String) ?? "",
            "customerId": (user["id"] as? String) ?? "",
            "matchRequestId": (d["matchRequestId"] as? String) ?? (mr["id"] as? String) ?? "",
            "name": (user["name"] as? String) ?? "고객",
            "image": (user["profileImageUrl"] as? String) ?? "/images/default-profile.png",
            "kind": kind,
            "isMulti": kind == "multi",
            "kindLabel": kind == "multi" ? "모두에게" : "개인요청",
            "timeAgo": inquiryTimeAgo(d["deliveredAt"] as? String),
            "category": [catName, evCat].filter { !$0.isEmpty }.joined(separator: " · "),
            "parts": eventPart.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty },
            "dateText": "\(inquiryFormatDate(eventDate)) \(inquiryFormatTime(eventTime))".trimmingCharacters(in: .whitespaces),
            "location": (mr["eventLocation"] as? String) ?? (raw["location"] as? String) ?? "",
            "note": (raw["note"] as? String) ?? "",
        ]
    }
    private static func parseISODate(_ s: String?) -> Date? {
        guard let s = s, !s.isEmpty else { return nil }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = iso.date(from: s) { return d }
        iso.formatOptions = [.withInternetDateTime]
        if let d = iso.date(from: s) { return d }
        let df = DateFormatter(); df.dateFormat = "yyyy-MM-dd"; df.locale = Locale(identifier: "en_US_POSIX")
        return df.date(from: String(s.prefix(10)))
    }
    private static func inquiryTimeAgo(_ s: String?) -> String {
        guard let d = parseISODate(s) else { return "" }
        let min = Int(Date().timeIntervalSince(d) / 60)
        if min < 1 { return "방금" }
        if min < 60 { return "\(min)분 전" }
        let hr = min / 60
        if hr < 24 { return "\(hr)시간 전" }
        let days = hr / 24
        if days < 7 { return "\(days)일 전" }
        let c = Calendar.current.dateComponents([.month, .day], from: d)
        return "\(c.month ?? 0)/\(c.day ?? 0)"
    }
    private static func inquiryFormatDate(_ s: String?) -> String {
        guard let d = parseISODate(s) else { return "일시 미정" }
        let weekdays = ["일", "월", "화", "수", "목", "금", "토"]
        let c = Calendar.current.dateComponents([.month, .day, .weekday], from: d)
        return "\(c.month ?? 0)/\(c.day ?? 0) (\(weekdays[((c.weekday ?? 1) - 1) % 7]))"
    }
    private static func inquiryFormatTime(_ s: String?) -> String {
        guard let s = s, !s.isEmpty else { return "" }
        if s.range(of: "^\\d{2}:\\d{2}$", options: .regularExpression) != nil { return s }
        if let m = s.range(of: "T\\d{2}:\\d{2}", options: .regularExpression) {
            return String(s[s.index(m.lowerBound, offsetBy: 1)..<m.upperBound])
        }
        guard let d = parseISODate(s) else { return s }
        let c = Calendar.current.dateComponents([.hour, .minute], from: d)
        return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    }

    // ─── 채팅 리스트 직접 fetch — 웹뷰/페이지 마운트 대기 없이 즉시 (rooms 콜드 5~10s 도 프리워밍으로 흡수) ───
    static func loadChatRooms(token: String, _ done: @escaping ([[String: Any]]?) -> Void) {
        guard !token.isEmpty else { DispatchQueue.main.async { done(nil) }; return }
        authedGET("\(base)/chat/rooms?limit=50&withTotal=false", token: token) { _, obj in
            guard obj != nil else { DispatchQueue.main.async { done(nil) }; return }
            let arr = asArray(obj, keys: ["data", "items"])
            // 최신 메시지 순 정렬 (웹 리스트와 동일)
            let rows = arr.map { chatRow($0) }.sorted { ($0["time"] as? String ?? "") > ($1["time"] as? String ?? "") }
            DispatchQueue.main.async { done(rows) }
        }
    }
    private static func chatRow(_ r: [String: Any]) -> [String: Any] {
        let other = r["otherUser"] as? [String: Any] ?? [:]
        let last = r["lastMessage"] as? [String: Any]
        var preview = ((last?["content"] as? String) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if preview.isEmpty, let t = last?["type"] as? String {
            switch t {
            case "image": preview = "사진을 보냈습니다"
            case "file": preview = "파일을 보냈습니다"
            case "location": preview = "위치를 공유했습니다"
            case "audio": preview = "음성 메시지를 보냈습니다"
            case "system": preview = "안내 메시지"
            default: preview = ""
            }
        }
        return [
            "id": (r["id"] as? String) ?? "",
            "name": (other["name"] as? String) ?? "",
            "image": (other["profileImageUrl"] as? String) ?? "",
            "lastMessage": preview,
            "time": (r["lastMessageAt"] as? String) ?? "",
            "unread": (r["unreadCount"] as? Int) ?? Int((r["unreadCount"] as? Double) ?? 0),
        ]
    }

    // 업체(웨딩파트너) 상세 — 디스크 캐시 즉시 → 신선 교체
    static func loadBizDetail(_ id: String, _ done: @escaping ([String: Any]?) -> Void) {
        var rendered = false
        if let data = UserDefaults.standard.data(forKey: "ftBizDetail_\(id)"),
           let cached = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            rendered = true
            DispatchQueue.main.async { done(cached) }
        }
        getJSON("\(base)/business/\(id)") { obj in
            guard let d = obj as? [String: Any] else {
                if !rendered { DispatchQueue.main.async { done(nil) } }
                return
            }
            if let data = try? JSONSerialization.data(withJSONObject: d) {
                UserDefaults.standard.set(data, forKey: "ftBizDetail_\(id)")
            }
            DispatchQueue.main.async { done(d) }
        }
    }
}

// MARK: - 카테고리 리스트 모델
struct CategoryProItem {
    let id: String
    let name: String
    let image: String
    let intro: String
    let rating: Double
    let reviewCount: Int
    let careerYears: Int
    let category: String
    let regions: [String]
    let languages: [String]
    let isNationwide: Bool
    let rank: Int
}
struct CategoryBizItem {
    let id: String
    let title: String
    let region: String
    let category: String
    let image: String
    let tags: [String]
}
