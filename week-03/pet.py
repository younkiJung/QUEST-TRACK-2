# 화면 오른쪽 아래 구석에 햄스터 펫을 띄운다.
# 오른쪽 클릭 → "끄기" 로 끈다.
import sys
from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtGui import QPixmap
from PySide6.QtWidgets import QApplication, QLabel, QMenu

ART = Path(__file__).parent / "art"
SIZE = 150   # 펫 크기 (픽셀)
MARGIN = 8   # 화면 가장자리와의 거리


class Pet(QLabel):
    def __init__(self):
        super().__init__()
        # 테두리 없음, 항상 위, 작업 표시줄에 버튼 안 생김
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool)
        self.setAttribute(Qt.WA_TranslucentBackground)

        self.frames = [
            QPixmap(str(ART / f"frame-{i}.png")).scaled(
                SIZE, SIZE, Qt.KeepAspectRatio, Qt.SmoothTransformation
            )
            for i in range(1, 5)
        ]
        self.setPixmap(self.frames[0])
        self.adjustSize()
        self.move_to_corner()

    def move_to_corner(self):
        # 작업 표시줄을 뺀 화면 영역의 오른쪽 아래
        area = self.screen().availableGeometry()
        self.move(area.right() - self.width() - MARGIN, area.bottom() - self.height() - MARGIN)

    def contextMenuEvent(self, event):
        menu = QMenu(self)
        menu.addAction("끄기", QApplication.quit)
        menu.exec(event.globalPos())


if __name__ == "__main__":
    app = QApplication(sys.argv)
    pet = Pet()
    pet.show()
    sys.exit(app.exec())
