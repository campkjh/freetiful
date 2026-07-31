package com.freetiful.freetiful

import android.content.pm.PackageManager
import android.util.Base64
import java.security.MessageDigest
import com.kakao.sdk.auth.model.OAuthToken
import android.content.ContentValues
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.view.View
import android.view.WindowInsets
import android.webkit.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import com.airbnb.lottie.LottieAnimationView
import com.airbnb.lottie.LottieDrawable
import com.google.android.gms.auth.api.signin.*
import com.google.android.gms.common.api.ApiException
import com.kakao.sdk.common.KakaoSdk
import com.kakao.sdk.user.UserApiClient
import com.navercorp.nid.NaverIdLoginSDK
import com.navercorp.nid.oauth.OAuthLoginCallback
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import com.onesignal.OneSignal   // ✅ 추가

class MainActivity : ComponentActivity() {

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else if (::webView.isInitialized) {
            // 뒤로 갈 히스토리가 없을 때 — 푸시 알림으로 채팅방에 cold start 진입한 경우
            // 앱 종료 대신 채팅 목록으로 이동
            val currentUrl = webView.url ?: ""
            if (currentUrl.contains("/chat/")) {
                navigateToInternalPath("/chat")
            } else {
                super.onBackPressed()
            }
        } else {
            super.onBackPressed()
        }
    }
    private lateinit var webView: WebView
    private lateinit var loadingView: LottieAnimationView
    private lateinit var googleSignInClient: GoogleSignInClient

    private val GOOGLE_LOGIN_CODE = 1001
    private val FILE_CHOOSER_CODE = 2001

    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var cameraImageUri: Uri? = null
    private var pendingPushPath: String? = null
    private var pendingWebViewPermissionRequest: PermissionRequest? = null

    // 마이크 권한 요청 런처 — 승인되면 저장된 WebView PermissionRequest에 grant 호출
    private val requestAudioPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        val pending = pendingWebViewPermissionRequest
        pendingWebViewPermissionRequest = null
        if (isGranted && pending != null) pending.grant(pending.resources)
        else pending?.deny()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pendingPushPath = consumePushTarget(intent)

        if (android.os.Build.VERSION.SDK_INT >= 33) {
            requestPermissions(
                arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
                1001
            )
        }

        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        KakaoSdk.init(this, "c0c3d8d54694eea9e142783494004639")
        printKeyHash()

        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestIdToken("919806921995-suf7sp42qgt60th8ip0cb1mj8a6st91t.apps.googleusercontent.com")
            .build()

        googleSignInClient = GoogleSignIn.getClient(this, gso)

        NaverIdLoginSDK.initialize(
            this,
            "cnaly_pSLgjMyP3Itds_",
            "dmDCW1zGye",
            "Freetiful"
        )

        setContent { MainScreen() }
    }

    // 🔥 OneSignal v5: Player ID(구독 ID) 조회
    private fun getPlayerId(): String {
        return OneSignal.User.pushSubscription.id ?: ""
    }

    @Composable
    fun MainScreen() {

        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { context ->

                FrameLayout(context).apply {

                    // 상하단 system bar 영역을 직접 padding으로 비워둠.
                    // Android Chromium WebView는 env(safe-area-inset-bottom)을 안정적으로 채워주지 않아
                    // 웹 CSS .pb-safe만으로는 제스처 nav bar에 가려지는 케이스 발생.
                    setOnApplyWindowInsetsListener { view, insets ->
                        val sysBars = insets.getInsets(WindowInsets.Type.systemBars())
                        view.setPadding(sysBars.left, sysBars.top, sysBars.right, sysBars.bottom)
                        insets
                    }

                    webView = WebView(context).apply {

                        isLongClickable = false
                        setOnLongClickListener { true }
                        isHapticFeedbackEnabled = false

                        settings.apply {
                            javaScriptEnabled = true
                            domStorageEnabled = true
                            textZoom = 100
                            useWideViewPort = true
                            loadWithOverviewMode = true
                            allowFileAccess = true
                            allowContentAccess = true
                            // iOS 와 동등한 자동 미디어 재생 정책
                            mediaPlaybackRequiresUserGesture = false
                        }

                        webChromeClient = object : WebChromeClient() {

                            // WebView에서 getUserMedia 호출 시 마이크 권한 허용
                            override fun onPermissionRequest(request: PermissionRequest?) {
                                request ?: return
                                val audioGranted = ContextCompat.checkSelfPermission(
                                    this@MainActivity,
                                    android.Manifest.permission.RECORD_AUDIO
                                ) == android.content.pm.PackageManager.PERMISSION_GRANTED

                                if (audioGranted) {
                                    request.grant(request.resources)
                                } else {
                                    // 권한 미승인: WebView 요청 저장 후 시스템 권한 다이얼로그 표시
                                    // requestAudioPermission 결과에서 승인되면 grant 호출
                                    pendingWebViewPermissionRequest = request
                                    requestAudioPermission.launch(android.Manifest.permission.RECORD_AUDIO)
                                }
                            }

                            override fun onShowFileChooser(
                                webView: WebView?,
                                filePathCallback: ValueCallback<Array<Uri>>?,
                                fileChooserParams: FileChooserParams?
                            ): Boolean {

                                this@MainActivity.filePathCallback?.onReceiveValue(null)
                                this@MainActivity.filePathCallback = filePathCallback

                                val takePictureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)

                                val contentValues = ContentValues().apply {
                                    put(MediaStore.Images.Media.TITLE, "temp_image")
                                }

                                cameraImageUri = contentResolver.insert(
                                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                                    contentValues
                                )

                                takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri)

                                val galleryIntent = Intent(Intent.ACTION_GET_CONTENT)
                                galleryIntent.addCategory(Intent.CATEGORY_OPENABLE)
                                galleryIntent.type = "image/*"

                                val chooserIntent = Intent(Intent.ACTION_CHOOSER)
                                chooserIntent.putExtra(Intent.EXTRA_INTENT, galleryIntent)
                                chooserIntent.putExtra(Intent.EXTRA_TITLE, "이미지 선택")
                                chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(takePictureIntent))

                                startActivityForResult(chooserIntent, FILE_CHOOSER_CODE)
                                return true
                            }
                        }

                        addJavascriptInterface(WebAppInterface(), "Android")

                        webViewClient = object : WebViewClient() {

                            override fun shouldOverrideUrlLoading(
                                view: WebView?,
                                request: WebResourceRequest?
                            ): Boolean {

                                val url = request?.url.toString()

                                if (url.startsWith("intent://")) {
                                    try {
                                        val intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                                        startActivity(intent)
                                    } catch (e: Exception) {
                                        e.printStackTrace()
                                    }
                                    return true
                                }

                                if (url.contains("play.google.com")) {
                                    try {
                                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                        startActivity(intent)
                                    } catch (e: Exception) {
                                        view?.loadUrl(url)
                                    }
                                    return true
                                }

                                return false
                            }

                            override fun onPageStarted(
                                view: WebView?,
                                url: String?,
                                favicon: android.graphics.Bitmap?
                            ) {
                                showLoading()
                            }

                            override fun onPageFinished(view: WebView?, url: String?) {
                                super.onPageFinished(view, url)
                                // iOS의 WKUserScript와 동등: viewport-fit=cover + 터치 보정
                                view?.evaluateJavascript("""
                                    (function(){
                                      var m=document.querySelector('meta[name="viewport"]');
                                      if(!m){ m=document.createElement('meta'); m.name='viewport'; document.head.appendChild(m); }
                                      m.content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
                                      document.documentElement.style.webkitUserSelect='none';
                                      document.documentElement.style.webkitTouchCallout='none';
                                    })();
                                """.trimIndent(), null)
                                hideLoading()
                            }
                        }

                        val initialPath = pendingPushPath ?: "/main"
                        pendingPushPath = null
                        loadUrl(buildWebUrl(initialPath))
                    }

                    addView(webView)

                    loadingView = LottieAnimationView(context).apply {
                        setAnimation(R.raw.loading)
                        repeatCount = LottieDrawable.INFINITE
                        playAnimation()
                        layoutParams = FrameLayout.LayoutParams(200, 200).apply {
                            gravity = android.view.Gravity.CENTER
                        }
                    }

                    addView(loadingView)
                }
            }
        )
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val targetPath = consumePushTarget(intent) ?: return
        navigateToInternalPath(targetPath)
    }

    private fun consumePushTarget(intent: Intent?): String? {
        return normalizeInternalPath(
            intent?.getStringExtra("push_target_path")
                ?: intent?.dataString
                ?: PushDeepLinkStore.consume()
        )
    }

    private fun normalizeInternalPath(rawValue: String?): String? {
        val raw = rawValue?.trim().orEmpty()
        if (raw.isEmpty()) return null
        if (raw.startsWith("/")) return raw

        return try {
            val uri = Uri.parse(raw)
            when (uri.scheme?.lowercase()) {
                "http", "https" -> {
                    val host = uri.host?.lowercase()
                    if (host == "freetiful.com" || host == "www.freetiful.com") {
                        val path = uri.path?.takeIf { it.isNotBlank() } ?: "/"
                        if (uri.query.isNullOrBlank()) path else "$path?${uri.query}"
                    } else null
                }
                "freetiful" -> {
                    val host = uri.host.orEmpty()
                    val path = buildString {
                        if (host.isNotBlank()) append("/").append(host)
                        append(uri.path.orEmpty())
                    }.ifBlank { "/notifications" }
                    if (uri.query.isNullOrBlank()) path else "$path?${uri.query}"
                }
                else -> "/$raw"
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun buildWebUrl(path: String): String {
        return if (path.startsWith("http://") || path.startsWith("https://")) path else "https://freetiful.com$path"
    }

    private fun navigateToInternalPath(path: String) {
        if (!::webView.isInitialized) {
            pendingPushPath = path
            return
        }
        runOnUiThread {
            val safePath = JSONObject.quote(path)
            val safeUrl = JSONObject.quote(buildWebUrl(path))
            webView.evaluateJavascript(
                """
                (function() {
                  if (typeof window.__freetifulNavigate === 'function') {
                    window.__freetifulNavigate($safePath);
                  } else {
                    window.location.href = $safeUrl;
                  }
                })();
                """.trimIndent(),
                null
            )
        }
    }

    private fun showLoading() {
        loadingView.visibility = View.VISIBLE
        loadingView.playAnimation()
    }

    private fun hideLoading() {
        loadingView.animate()
            .alpha(0f)
            .setDuration(400)
            .withEndAction {
                loadingView.visibility = View.GONE
                loadingView.alpha = 1f
            }
            .start()
    }

    private fun printKeyHash() {
        try {
            val info = packageManager.getPackageInfo(
                packageName,
                PackageManager.GET_SIGNING_CERTIFICATES
            )

            val signingInfo = info.signingInfo ?: return
            val signatures = signingInfo.apkContentsSigners

            for (signature in signatures) {
                val md = MessageDigest.getInstance("SHA")
                md.update(signature.toByteArray())
                val keyHash = Base64.encodeToString(md.digest(), Base64.NO_WRAP)
                android.util.Log.e("KAKAO_KEYHASH", keyHash)
            }

        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // ---------------- Google ----------------
    private fun startGoogleLogin() {
        startActivityForResult(googleSignInClient.signInIntent, GOOGLE_LOGIN_CODE)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == GOOGLE_LOGIN_CODE) {
            val task = GoogleSignIn.getSignedInAccountFromIntent(data)
            try {
                val account = task.getResult(ApiException::class.java)
                val idToken = account.idToken ?: return
                // iOS와 동일: /auth/login/google 로 idToken 전달 → JWT 받아 localStorage 주입
                callAPI("/auth/login/google", JSONObject().put("idToken", idToken))
            } catch (e: ApiException) {
                android.util.Log.e("LOGIN", "Google login failed: ${e.statusCode}")
            }
        }

        if (requestCode == FILE_CHOOSER_CODE) {
            var result: Array<Uri>? = null
            if (resultCode == RESULT_OK) {
                if (data == null || data.data == null) {
                    cameraImageUri?.let { result = arrayOf(it) }
                } else {
                    result = arrayOf(data.data!!)
                }
            }
            filePathCallback?.onReceiveValue(result)
            filePathCallback = null
        }
    }

    // ---------------- Kakao ----------------
    private fun startKakaoLogin() {
        val callback: (OAuthToken?, Throwable?) -> Unit = { token, error ->
            if (token != null) {
                // iOS와 동일: Kakao 액세스 토큰을 /auth/login/kakao/native 로 전달
                callAPI("/auth/login/kakao/native", JSONObject().put("accessToken", token.accessToken))
            } else if (error != null) {
                android.util.Log.e("LOGIN", "Kakao login failed: ${error.message}")
            }
        }

        if (UserApiClient.instance.isKakaoTalkLoginAvailable(this)) {
            UserApiClient.instance.loginWithKakaoTalk(this, callback = callback)
        } else {
            UserApiClient.instance.loginWithKakaoAccount(this, callback = callback)
        }
    }

    // ---------------- Naver ----------------
    private fun startNaverLogin() {
        NaverIdLoginSDK.logout()

        NaverIdLoginSDK.authenticate(this, object : OAuthLoginCallback {
            override fun onSuccess() {
                val accessToken = NaverIdLoginSDK.getAccessToken() ?: return
                // iOS와 동일: Naver 액세스 토큰을 /auth/login/naver/native 로 전달
                callAPI("/auth/login/naver/native", JSONObject().put("accessToken", accessToken))
            }
            override fun onFailure(httpStatus: Int, message: String) {
                android.util.Log.e("LOGIN", "Naver onFailure: $httpStatus $message")
            }
            override fun onError(errorCode: Int, message: String) {
                android.util.Log.e("LOGIN", "Naver onError: $errorCode $message")
            }
        })
    }

    // ---------------- 공통: 백엔드 → JWT 수신 → localStorage 주입 ----------------
    /**
     * iOS ViewController.callAPI()와 동등.
     * 소셜 토큰을 백엔드 auth/login 네이티브 엔드포인트에 POST → JWT+user 응답.
     * 성공 시 OneSignal.login(userId) + WebView localStorage('prettyful-auth') 주입.
     * 이로써 이후 앱 재실행 시 Zustand persist가 복원 → 자동로그인 완성.
     */
    private fun callAPI(endpoint: String, body: JSONObject) {
        android.util.Log.d("callAPI", "→ POST $endpoint body_keys=${body.keys().asSequence().toList()}")
        Thread {
            try {
                val url = URL("https://freetiful.com/api/v1$endpoint")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                conn.connectTimeout = 15_000
                conn.readTimeout = 15_000
                conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }

                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val responseText = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
                android.util.Log.d("callAPI", "← $endpoint HTTP=$code body=${responseText.take(200)}")
                if (code !in 200..299) {
                    android.util.Log.e("callAPI", "HTTP 실패 $code from $endpoint")
                    return@Thread
                }

                val json = JSONObject(responseText)
                val user = json.getJSONObject("user")
                val tokens = json.getJSONObject("tokens")
                val userId = user.getString("id")
                val accessToken = tokens.getString("accessToken")
                val refreshToken = tokens.getString("refreshToken")
                android.util.Log.d("callAPI", "✓ 파싱 성공 userId=$userId")

                runOnUiThread {
                    OneSignal.login(userId)
                    android.util.Log.d("ONESIGNAL_ID", "OneSignal.login($userId)")
                    injectJWT(accessToken, refreshToken, user.toString())
                }
            } catch (e: Exception) {
                android.util.Log.e("callAPI", "예외: ${e.javaClass.simpleName}: ${e.message}", e)
            }
        }.start()
    }

    /**
     * iOS의 injectJWT()와 동등 — Zustand persist의 localStorage 키('prettyful-auth')에
     * JWT를 직접 써 넣고 /main으로 이동. 다음 실행 시 자동로그인 복원.
     */
    private fun injectJWT(accessToken: String, refreshToken: String, userJSON: String) {
        fun esc(s: String) = s.replace("\\", "\\\\").replace("'", "\\'")
        val js = """
            (function() {
              try {
                var auth = { state: { user: $userJSON, accessToken: '${esc(accessToken)}', refreshToken: '${esc(refreshToken)}' }, version: 0 };
                localStorage.setItem('prettyful-auth', JSON.stringify(auth));
                var saved = localStorage.getItem('prettyful-auth');
                window.location.href = 'https://freetiful.com/main';
                return 'OK len=' + (saved ? saved.length : 0);
              } catch(e) { return 'ERR:' + e.message; }
            })();
        """.trimIndent()
        android.util.Log.d("injectJWT", "→ evaluateJavascript 시작 (JWT 길이 access=${accessToken.length}, refresh=${refreshToken.length})")
        if (::webView.isInitialized) {
            webView.evaluateJavascript(js) { result ->
                android.util.Log.d("injectJWT", "← JS 결과: $result")
            }
        } else {
            android.util.Log.e("injectJWT", "webView 미초기화!")
        }
    }

    inner class WebAppInterface {
        @JavascriptInterface fun kakaoLogin() { runOnUiThread { startKakaoLogin() } }
        @JavascriptInterface fun googleLogin() { runOnUiThread { startGoogleLogin() } }
        @JavascriptInterface fun naverLogin() { runOnUiThread { startNaverLogin() } }

        /**
         * 웹(자동로그인/세션복원/로그인 성공 시)이 userId 넘기면
         * OneSignal external_id에 강제 매핑 → 서버가 external_id로 푸시 쏠 때 작동.
         * iOS의 webkit.messageHandlers.oneSignalLogin과 동등.
         */
        @JavascriptInterface
        fun oneSignalLogin(userId: String) {
            val clean = userId.replace("<", "").replace(">", "").trim()
            if (clean.isEmpty()) return
            android.util.Log.d("ONESIGNAL_ID", "oneSignalLogin($clean)")
            runOnUiThread { OneSignal.login(clean) }

            // Player ID 확보되면 웹으로도 돌려줘서 서버 /push/onesignal/register 저장
            val playerId = getPlayerId()
            if (playerId.isNotEmpty() && ::webView.isInitialized) {
                webView.post {
                    webView.evaluateJavascript(
                        """
                        (function() {
                          var payload = { playerId: ${JSONObject.quote(playerId)}, subscriptionId: ${JSONObject.quote(playerId)}, platform: 'Android' };
                          if (window.freetifulSavePushId) window.freetifulSavePushId(payload);
                          else if (window.bubble_fn_savePushId) window.bubble_fn_savePushId(payload);
                          if (window.freetifulFlushOneSignalPlayerId) window.freetifulFlushOneSignalPlayerId();
                        })();
                        """.trimIndent(),
                        null
                    )
                }
            }
        }

        @JavascriptInterface fun pushLogin(userId: String) = oneSignalLogin(userId)
        @JavascriptInterface fun setOneSignalExternalId(userId: String) = oneSignalLogin(userId)

        /** 로그아웃 시 external_id 해제 */
        @JavascriptInterface
        fun oneSignalLogout() {
            android.util.Log.d("ONESIGNAL_ID", "oneSignalLogout")
            runOnUiThread { OneSignal.logout() }
        }
    }
}
