import UIKit

// 홈 진입 팝업 — 어드민 배너(placement=popup) 이미지를 하단 시트(4:3, r36)로.
// 웹 모달은 네이티브에서 비활성(가려짐+nav 숨김 부작용)이라 네이티브로 직접 표시.
final class NativePopupModalViewController: UIViewController {
    private let imageURL: String
    private let linkURL: String?
    private let bannerId: String
    var onOpenLink: ((String) -> Void)?

    private static let inset: CGFloat = 8
    private let dimView = UIView()
    private let card = UIView()
    private var cardBottom: NSLayoutConstraint?

    init(bannerId: String, imageURL: String, linkURL: String?) {
        self.bannerId = bannerId
        self.imageURL = imageURL
        self.linkURL = linkURL
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .overFullScreen
        modalTransitionStyle = .crossDissolve
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear

        dimView.translatesAutoresizingMaskIntoConstraints = false
        dimView.backgroundColor = UIColor.black.withAlphaComponent(0)
        dimView.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(close)))
        view.addSubview(dimView)

        card.translatesAutoresizingMaskIntoConstraints = false
        card.backgroundColor = .white
        // 화면 곡률에서 8px 인셋만큼 줄여 동심원 곡률 (아이폰 화면 r - 여백)
        let screenR = (UIScreen.main.value(forKey: "_displayCorner" + "Radius") as? CGFloat) ?? 52
        card.layer.cornerRadius = max(20, screenR - Self.inset)
        card.layer.cornerCurve = .continuous
        card.clipsToBounds = true
        view.addSubview(card)

        // 4:3 이미지 (탭 시 linkURL 이동)
        let imageView = UIImageView()
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        imageView.isUserInteractionEnabled = true
        imageView.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(tapImage)))
        NativeChatImageLoader.load(imageURL, into: imageView, fallback: nil)
        card.addSubview(imageView)

        // 닫기 X
        let closeBtn = UIButton(type: .system)
        closeBtn.translatesAutoresizingMaskIntoConstraints = false
        closeBtn.setImage(UIImage(systemName: "xmark", withConfiguration: UIImage.SymbolConfiguration(pointSize: 16, weight: .bold)), for: .normal)
        closeBtn.tintColor = .black
        closeBtn.backgroundColor = .clear
        closeBtn.addTarget(self, action: #selector(close), for: .touchUpInside)
        card.addSubview(closeBtn)

        let bottom = card.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: 600)
        cardBottom = bottom
        NSLayoutConstraint.activate([
            dimView.topAnchor.constraint(equalTo: view.topAnchor),
            dimView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            dimView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            dimView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            card.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: Self.inset),
            card.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -Self.inset),
            bottom,

            imageView.topAnchor.constraint(equalTo: card.topAnchor),
            imageView.leadingAnchor.constraint(equalTo: card.leadingAnchor),
            imageView.trailingAnchor.constraint(equalTo: card.trailingAnchor),
            imageView.bottomAnchor.constraint(equalTo: card.bottomAnchor),
            imageView.heightAnchor.constraint(equalTo: imageView.widthAnchor, multiplier: 3.0 / 4.0),

            closeBtn.topAnchor.constraint(equalTo: card.topAnchor, constant: 12),
            closeBtn.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -12),
            closeBtn.widthAnchor.constraint(equalToConstant: 34),
            closeBtn.heightAnchor.constraint(equalToConstant: 34),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        cardBottom?.constant = -Self.inset
        UIView.animate(withDuration: 0.42, delay: 0, usingSpringWithDamping: 0.84, initialSpringVelocity: 0.5, options: [.curveEaseOut]) {
            self.view.layoutIfNeeded()
            self.dimView.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        }
    }

    @objc private func close() {
        cardBottom?.constant = 600
        UIView.animate(withDuration: 0.28, animations: {
            self.view.layoutIfNeeded()
            self.dimView.backgroundColor = UIColor.black.withAlphaComponent(0)
        }) { _ in self.dismiss(animated: false) }
    }


    @objc private func tapImage() {
        let link = linkURL
        let cb = onOpenLink
        cardBottom?.constant = 600
        UIView.animate(withDuration: 0.28, animations: {
            self.view.layoutIfNeeded()
            self.dimView.backgroundColor = UIColor.black.withAlphaComponent(0)
        }) { _ in
            self.dismiss(animated: false) {
                if let link = link, !link.isEmpty { cb?(link) }
            }
        }
    }

    // 팝업 배너 조회 후 표시 (런치 시 1회). navigate: linkURL 이동 콜백.
    static func checkAndPresent(from presenter: UIViewController, navigate: @escaping (String) -> Void) {
        guard let url = URL(string: "https://freetiful.com/api/v1/banners?placement=popup") else { return }
        var req = URLRequest(url: url)
        req.cachePolicy = .reloadIgnoringLocalCacheData
        req.timeoutInterval = 12
        URLSession.shared.dataTask(with: req) { data, _, _ in
            guard let data = data,
                  let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]],
                  let b = arr.first,
                  let imageUrl = b["imageUrl"] as? String, !imageUrl.isEmpty else { return }
            let id = (b["id"] as? String) ?? imageUrl
            let until = UserDefaults.standard.double(forKey: "ftPopupHide_\(id)")
            if until > 0, Date().timeIntervalSince1970 < until { return }
            let link = b["linkUrl"] as? String
            DispatchQueue.main.async {
                guard presenter.presentedViewController == nil else { return }
                let modal = NativePopupModalViewController(bannerId: id, imageURL: imageUrl, linkURL: link)
                modal.onOpenLink = navigate
                presenter.present(modal, animated: false)
            }
        }.resume()
    }
}
