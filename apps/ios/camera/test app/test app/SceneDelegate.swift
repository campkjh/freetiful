import SwiftUI
import UIKit

struct CameraView: UIViewControllerRepresentable {
    @Environment(\.presentationMode) var presentationMode

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.allowsEditing = false
        picker.delegate = context.coordinator

        // iPad 대응: popover 설정
        if UIDevice.current.userInterfaceIdiom == .pad {
            picker.modalPresentationStyle = .popover
            if let popover = picker.popoverPresentationController {
                popover.sourceView = UIView()
                popover.sourceRect = CGRect(x: UIScreen.main.bounds.midX,
                                          y: UIScreen.main.bounds.midY,
                                          width: 0, height: 0)
                popover.permittedArrowDirections = []
            }
        }

        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {
        // 업데이트 로직 필요시 작성
    }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraView

        init(_ parent: CameraView) {
            self.parent = parent
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.presentationMode.wrappedValue.dismiss()
        }

        func imagePickerController(_ picker: UIImagePickerController,
                                  didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            // 이미지 처리 로직 필요시 작성
            parent.presentationMode.wrappedValue.dismiss()
        }
    }
}
