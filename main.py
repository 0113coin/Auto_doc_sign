import fitz  # PyMuPDF
from tkinter import Tk, Canvas, filedialog
from PIL import Image, ImageTk
import io

# 글로벌 변수
click_position = None
scale_factor = 2  # 해상도 스케일 팩터

def open_pdf():
    global click_position
    # PDF 파일 열기
    pdf_path = filedialog.askopenfilename(filetypes=[("PDF Files", "*.pdf")])
    if not pdf_path:
        return

    # PDF를 고해상도로 렌더링 (첫 페이지)
    pdf_document = fitz.open(pdf_path)
    page = pdf_document[0]
    pix = page.get_pixmap(dpi=72 * scale_factor)  # 기본 DPI(72) * 스케일 팩터
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

    # Tkinter로 이미지 표시
    display_pdf(img, pdf_document, pdf_path, pix.width, pix.height)

def display_pdf(img, pdf_document, pdf_path, width, height):
    global canvas, click_position
    # Tkinter 캔버스 크기 조정
    canvas.config(width=width, height=height)

    # 이미지 표시
    img_tk = ImageTk.PhotoImage(img)
    canvas.create_image(0, 0, anchor="nw", image=img_tk)
    canvas.image = img_tk

    # 마우스 클릭 이벤트 처리
    def on_click(event):
        global click_position
        click_position = (event.x, event.y)  # 클릭한 좌표 저장
        print(f"Clicked at: {click_position}")
        add_signature_to_pdf(pdf_document, pdf_path, width, height)

    canvas.bind("<Button-1>", on_click)

def add_signature_to_pdf(pdf_document, pdf_path, width, height):
    global click_position
    if click_position is None:
        print("No position selected.")
        return

    # 서명 이미지 삽입
    signature_path = filedialog.askopenfilename(filetypes=[("Image Files", "*.png;*.jpg;*.jpeg")])
    if not signature_path:
        return

    # 서명 이미지 열기
    with Image.open(signature_path) as img:
        # Pillow 이미지 객체를 바이트 스트림으로 변환
        img_buffer = io.BytesIO()
        img.save(img_buffer, format="PNG")
        img_bytes = img_buffer.getvalue()

    page = pdf_document[0]

    # 클릭 좌표를 스케일 팩터로 조정
    x, y = click_position
    x /= scale_factor
    y /= scale_factor

    # 서명 위치와 크기 설정
    width, height = 200, 100  # 서명 크기 (수정 가능)
    rect = fitz.Rect(x, y, x + width, y + height)

    # 서명 이미지 삽입
    page.insert_image(rect, stream=img_bytes)

    # 수정된 PDF 저장
    output_path = filedialog.asksaveasfilename(defaultextension=".pdf", filetypes=[("PDF Files", "*.pdf")])
    if output_path:
        pdf_document.save(output_path)
        print(f"Signed PDF saved as: {output_path}")

# Tkinter GUI 생성
root = Tk()
root.title("PDF Signer")

canvas = Canvas(root)
canvas.pack()

# 버튼 추가
open_button = filedialog.Button(root, text="Open PDF", command=open_pdf)
open_button.pack()

root.mainloop()
