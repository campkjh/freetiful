package com.freetiful.freetiful

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.animation.AlphaAnimation
import android.widget.ImageView
import androidx.activity.addCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

class SplashActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        splashScreen.setKeepOnScreenCondition { false }
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_splash)

        // 스플래시가 떠 있는 동안 뒤로가기를 눌러도 앱이 홈 화면으로 빠져나가지 않게 막는다.
        // (MainActivity 와 동일한 정책 — 뒤로가기로는 앱이 종료·이탈되지 않는다)
        onBackPressedDispatcher.addCallback(this) { }

        val logo = findViewById<ImageView>(R.id.logoImage)

        // ✅ 자연스러운 페이드인 애니메이션
        val fadeIn = AlphaAnimation(0f, 1f).apply {
            duration = 900
            fillAfter = true
        }
        logo.startAnimation(fadeIn)

        // ✅ 2초 후 메인으로 전환
        Handler(Looper.getMainLooper()).postDelayed({
            startActivity(Intent(this, MainActivity::class.java))
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
            finish()
        }, 2000)
    }
}
