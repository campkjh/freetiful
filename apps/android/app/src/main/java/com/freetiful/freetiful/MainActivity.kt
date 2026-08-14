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
import androidx.activity.addCallback
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

    private lateinit var webView: WebView
    private lateinit var loadingView: LottieAnimationView
    private lateinit var googleSignInClient: GoogleSignInClient

    private val GOOGLE_LOGIN_CODE = 1001
    private val FILE_CHOOSER_CODE = 2001

    // 웹 ImageUploader가 최대 10장까지만 받으므로 사진 선택기도 동일하게 제한
    private val MAX_PICK_IMAGES = 10

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
        registerBackHandler()

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

    /**
     * 뒤로가기 처리 — 어떤 경우에도 앱을 종료하지 않는다.
     * targetSdk 36부터는 predictive back이 기본 활성화라 Activity.onBackPressed() 오버라이드가
     * 더 이상 호출되지 않는다(뒤로가기가 WebView 히스토리를 건너뛰고 바로 앱 종료).
     * OnBackPressedDispatcher는 신/구 방식 모두에서 호출되므로 여기로 옮긴다.
     */
    private fun registerBackHandler() {
        onBackPressedDispatcher.addCallback(this) {
            if (!::webView.isInitialized) return@addCallback

            val currentUrl = webView.url ?: ""
            when {
                webView.canGoBack() -> webView.goBack()
                // 뒤로 갈 히스토리가 없는 경우(푸시/딥링크로 cold start 진입 등) — 종료하지 않고 상위 화면으로
                currentUrl.contains("/chat/") -> navigateToInternalPath("/chat")
                !isHomeUrl(currentUrl) -> navigateToInternalPath("/main")
                // 홈에서 더 뒤로 갈 곳이 없으면 아무것도 하지 않는다.
                // finish()도 moveTaskToBack()도 하지 않으므로 뒤로가기로는 앱이 화면에서 사라지지 않는다.
                // (앱을 닫는 건 홈 버튼·최근앱 등 사용자가 직접 하는 동작으로만)
                else -> Unit
            }
        }
    }

    private fun isHomeUrl(url: String): Boolean {
        val path = try {
            Uri.parse(url).path.orEmpty()
        } catch (_: Exception) {
            ""
        }
        return path.isEmpty() || path == "/" || path == "/main"
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
                                cameraImageUri = null

                                return openFileChooser(fileChooserParams)
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

    // ---------------- 파일/사진 선택 ----------------
    /**
     * input[type=file] 의 accept / capture 속성에 맞춰 알맞은 선택기를 띄운다.
     *  - capture 지정(카메라 버튼) → 카메라 바로 실행
     *  - accept 가 image, video 계열뿐 → 시스템 사진 선택기(갤러리)
     *  - 그 외(문서 등) → 파일 탐색기
     * 예전에는 항상 ACTION_GET_CONTENT를 띄워 '사진'을 눌러도 파일 탐색기가 나왔다.
     */
    private fun openFileChooser(params: WebChromeClient.FileChooserParams?): Boolean {
        val visualMime = visualMimeFilter(params?.acceptTypes)
        val allowMultiple = params?.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE

        if (params?.isCaptureEnabled == true && visualMime != null && launchCamera()) return true

        val intent = if (visualMime != null) {
            buildVisualPickerIntent(visualMime, allowMultiple)
        } else {
            Intent(Intent.ACTION_GET_CONTENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = params?.acceptTypes?.firstOrNull { it.isNotBlank() } ?: "*/*"
                if (allowMultiple) putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            }
        }

        return try {
            startActivityForResult(intent, FILE_CHOOSER_CODE)
            true
        } catch (e: Exception) {
            android.util.Log.e("FILE_CHOOSER", "선택기 실행 실패: ${e.message}", e)
            // 콜백을 남겨두면 해당 input이 영구히 먹통이 되므로 반드시 비워준다
            filePathCallback?.onReceiveValue(null)
            filePathCallback = null
            true
        }
    }

    // accept 가 사진·동영상만 요구하면 그에 맞는 MIME 문자열, 그 외에는 null.
    // 사진과 동영상을 모두 받는 경우는 와일드카드로 표시한다.
    private fun visualMimeFilter(acceptTypes: Array<String>?): String? {
        val types = acceptTypes?.filter { it.isNotBlank() }.orEmpty()
        if (types.isEmpty()) return null
        if (types.any { !it.startsWith("image/") && !it.startsWith("video/") }) return null

        val hasImage = types.any { it.startsWith("image/") }
        val hasVideo = types.any { it.startsWith("video/") }
        return when {
            hasImage && hasVideo -> "*/*"
            hasImage -> "image/*"
            hasVideo -> "video/*"
            else -> null
        }
    }

    private fun buildVisualPickerIntent(mime: String, allowMultiple: Boolean): Intent {
        // Android 13+ 시스템 사진 선택기 — 권한 없이 카메라 롤을 그대로 보여준다
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            return Intent(MediaStore.ACTION_PICK_IMAGES).apply {
                if (mime != "*/*") type = mime
                if (allowMultiple) {
                    putExtra(
                        MediaStore.EXTRA_PICK_IMAGES_MAX,
                        minOf(MAX_PICK_IMAGES, MediaStore.getPickImagesMaxLimit())
                    )
                }
            }
        }

        // Android 12 이하 — 갤러리 앱 직접 호출(반환 URI에 임시 읽기 권한이 붙어 저장소 권한 불필요)
        val collection = if (mime.startsWith("video/")) {
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI
        } else {
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        }
        return Intent(Intent.ACTION_PICK).apply {
            setDataAndType(collection, if (mime == "*/*") "image/*" else mime)
            if (allowMultiple) putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        }
    }

    /** capture 지정 input — 카메라 실행. 실패하면 false를 돌려 일반 선택기로 폴백한다 */
    private fun launchCamera(): Boolean {
        return try {
            val contentValues = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, "freetiful_${System.currentTimeMillis()}.jpg")
                put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
            }
            val uri = contentResolver.insert(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                contentValues
            ) ?: return false

            cameraImageUri = uri
            startActivityForResult(
                Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT, uri),
                FILE_CHOOSER_CODE
            )
            true
        } catch (e: Exception) {
            android.util.Log.e("FILE_CHOOSER", "카메라 실행 실패: ${e.message}", e)
            cameraImageUri = null
            false
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
            val clipData = data?.clipData
            val result: Array<Uri>? = if (resultCode != RESULT_OK) {
                null
            } else if (clipData != null && clipData.itemCount > 0) {
                // 사진 선택기 다중 선택
                Array(clipData.itemCount) { clipData.getItemAt(it).uri }
            } else if (data?.data != null) {
                arrayOf(data.data!!)
            } else {
                cameraImageUri?.let { arrayOf(it) }
            }

            // 카메라를 취소했으면 미리 만들어 둔 빈 MediaStore 항목을 지운다
            if (result == null) {
                cameraImageUri?.let {
                    try {
                        contentResolver.delete(it, null, null)
                    } catch (e: Exception) {
                        android.util.Log.w("FILE_CHOOSER", "빈 사진 항목 삭제 실패: ${e.message}")
                    }
                }
            }
            cameraImageUri = null

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
