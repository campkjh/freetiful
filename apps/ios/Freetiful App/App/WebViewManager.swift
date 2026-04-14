import UIKit
import WebKit

class WebViewManager: NSObject {

    private weak var parent: UIViewController?
    var webView: WKWebView!

    init(parent: UIViewController) {
        self.parent = parent
        super.init()
        setupWebView()
        observePushId()
    }

    private func setupWebView() {

        let contentController = WKUserContentController()

        let metaScript = """
        var meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        document.getElementsByTagName('head')[0].appendChild(meta);
        """

        let userScript = WKUserScript(
            source: metaScript,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )

        contentController.addUserScript(userScript)

        let config = WKWebViewConfiguration()
        config.userContentController = contentController

        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false

        parent?.view.addSubview(webView)

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: parent!.view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: parent!.view.safeAreaLayoutGuide.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: parent!.view.safeAreaLayoutGuide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: parent!.view.safeAreaLayoutGuide.trailingAnchor)
        ])
    }

    func load(url: String) {
        if let url = URL(string: url) {
            webView.load(URLRequest(url: url))
        }
    }

    // 🔥 Push ID 받으면 Bubble로 전달
    private func observePushId() {
        NotificationCenter.default.addObserver(
            forName: .didReceivePushId,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let pushId = notification.object as? String else { return }
            self?.webView.evaluateJavaScript("bubble_fn_savePushId('\(pushId)')")
        }
    }
}
