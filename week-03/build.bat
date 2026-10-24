@echo off
rem pet.py 를 그림까지 넣어서 dist\hamster-pet.exe 하나로 묶는다.
rem --windowed : 검은 명령 창 없이 펫만 뜨게 한다.
cd /d "%~dp0"
.venv\Scripts\pyinstaller.exe --noconfirm --onefile --windowed --name hamster-pet ^
  --add-data "art\frame-1.png;art" --add-data "art\frame-2.png;art" ^
  --add-data "art\frame-3.png;art" --add-data "art\frame-4.png;art" ^
  pet.py
