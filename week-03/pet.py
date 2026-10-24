# 화면 오른쪽 아래 구석에 햄스터 펫을 띄운다.
# 키를 누를 때마다 ②, ③ 을 번갈아 보여 주고, 잠깐 멈추면 ① 로 돌아간다.
# 10초 동안 안 누르면 ④ 로 졸고, 펫 아래에 누른 횟수를 보여 준다. (끄면 0, 파일에 안 남김)
# 오른쪽 클릭 → "끄기" 로 끈다.
import sys
from pathlib import Path

from pynput import keyboard
from PySide6.QtCore import QObject, Qt, QTimer, Signal
from PySide6.QtGui import QPixmap
from PySide6.QtWidgets import QApplication, QLabel, QMenu, QVBoxLayout, QWidget

ART = Path(__file__).parent / "art"
SIZE = 150         # 펫 크기 (픽셀)
MARGIN = 8         # 화면 가장자리와의 거리
REST_MS = 300      # 이만큼 안 누르면 ① 로 돌아감 (밀리초)
SLEEP_MS = 10_000  # 이만큼 안 누르면 ④ 로 졺 (밀리초)


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


class Pet(QWidget):
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
        # 위: 햄스터 그림, 아래: 누른 횟수
        self.face = QLabel()
        self.face.setPixmap(self.frames[0])
        self.count = 0
        self.count_label = QLabel()
        self.count_label.setAlignment(Qt.AlignCenter)
        self.count_label.setStyleSheet(
            "background: rgba(255, 255, 255, 210); color: #333; border-radius: 9px;"
            "padding: 2px 10px; font-size: 12px; font-weight: bold;"
        )
        self.show_count()

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(2)
        layout.addWidget(self.face)
        layout.addWidget(self.count_label, alignment=Qt.AlignHCenter)
        self.adjustSize()
        self.move_to_corner()

        self.left_hand = True  # 다음에 ② 를 보여 줄 차례인지
        self.rest_timer = QTimer(self, singleShot=True, interval=REST_MS)
        self.rest_timer.timeout.connect(lambda: self.face.setPixmap(self.frames[0]))
        self.sleep_timer = QTimer(self, singleShot=True, interval=SLEEP_MS)
        self.sleep_timer.timeout.connect(lambda: self.face.setPixmap(self.frames[3]))
        self.sleep_timer.start()

    def on_key(self):
        self.face.setPixmap(self.frames[1] if self.left_hand else self.frames[2])
        self.left_hand = not self.left_hand
        self.rest_timer.start()
        self.sleep_timer.start()
        self.count += 1
        self.show_count()

    def show_count(self):
        self.count_label.setText(f"오늘 {self.count:,}타")

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
