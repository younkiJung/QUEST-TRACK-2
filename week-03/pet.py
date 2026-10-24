# 화면 오른쪽 아래 구석에 햄스터 펫을 띄운다.
# 키를 누를 때마다 ②, ③ 을 번갈아 보여 주고, 잠깐 멈추면 ① 로 돌아간다.
# 오른쪽 클릭 → "끄기" 로 끈다.
import sys
from pathlib import Path

from pynput import keyboard
from PySide6.QtCore import QObject, Qt, QTimer, Signal
from PySide6.QtGui import QPixmap
from PySide6.QtWidgets import QApplication, QLabel, QMenu

ART = Path(__file__).parent / "art"
SIZE = 150      # 펫 크기 (픽셀)
MARGIN = 8      # 화면 가장자리와의 거리
REST_MS = 300   # 이만큼 안 누르면 ① 로 돌아감 (밀리초)


class KeyBell(QObject):
    """키가 눌렸다는 사실만 알려 주는 종. 어떤 키인지는 받지도 남기지도 않는다."""
    rang = Signal()

    def __init__(self):
        super().__init__()
        # 어떤 키인지는 버리고 종만 울린다. (pynput 은 다른 줄에서 돌아서 Signal 로 넘긴다)
        self.listener = keyboard.Listener(on_press=lambda _: self.rang.emit())
        self.listener.daemon = True
        self.listener.start()

    def stop(self):
        self.listener.stop()


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

        self.left_hand = True  # 다음에 ② 를 보여 줄 차례인지
        self.rest_timer = QTimer(self, singleShot=True, interval=REST_MS)
        self.rest_timer.timeout.connect(lambda: self.setPixmap(self.frames[0]))

    def on_key(self):
        self.setPixmap(self.frames[1] if self.left_hand else self.frames[2])
        self.left_hand = not self.left_hand
        self.rest_timer.start()

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
    bell = KeyBell()
    bell.rang.connect(pet.on_key)
    app.aboutToQuit.connect(bell.stop)
    sys.exit(app.exec())
