import SwiftUI
import AVFoundation

struct ContentView: View {
    @State private var isShowingCamera = false
    @State private var showPermissionAlert = false

    var body: some View {
        NavigationView {
            ZStack {
                Color.black.ignoresSafeArea()
                
                VStack(spacing: 40) {
                    Text("📸 RetroShot")
                        .font(.largeTitle)
                        .foregroundColor(.white)
                        .padding(.top, 50)
                    
                    Spacer()
                    
                    Image("camera_mock") // 필름 카메라 이미지
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 280)
                        .opacity(0.8)

                    Spacer()

                    Button(action: {
                        checkCameraPermission()
                    }) {
                        ZStack {
                            Circle()
                                .fill(Color.white)
                                .frame(width: 80, height: 80)
                            Circle()
                                .stroke(Color.gray, lineWidth: 4)
                                .frame(width: 88, height: 88)
                        }
                    }
                    .padding(.bottom, 50)
                }
            }
            .fullScreenCover(isPresented: $isShowingCamera) {
                CameraView()
            }
            .alert("카메라 권한 필요", isPresented: $showPermissionAlert) {
                Button("설정으로 이동") {
                    if let settingsURL = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(settingsURL)
                    }
                }
                Button("취소", role: .cancel) {}
            } message: {
                Text("카메라를 사용하려면 설정에서 카메라 접근 권한을 허용해주세요.")
            }
        }
    }

    private func checkCameraPermission() {
        AVCaptureDevice.requestAccess(for: .video) { granted in
            DispatchQueue.main.async {
                if granted {
                    isShowingCamera = true
                } else {
                    showPermissionAlert = true
                }
            }
        }
    }
}
