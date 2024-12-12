import fitz  # PyMuPDF
from tkinter import Tk, Canvas, filedialog
from PIL import Image, ImageTk
import io

# 글로벌 변수
start_position = None
end_position = None
scale_factor = 2  # DPI 스케일 팩터
rect_id = None  # 드래그 영역의 사각형 ID

def open_pdf():
    global start_position, end_position
    start_position, end_position = None, None  # 변수를 명확히 초기화

    # PDF 파일 열기
    pdf_path = filedialog.askopenfilename(filetypes=[("PDF Files", "*.pdf")])
    if not pdf_path:
        return

    # PDF를 고해상도로 렌더링
    pdf_document = fitz.open(pdf_path)
    page = pdf_document[0]
    pix = page.get_pixmap(dpi=72 * scale_factor)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

    # Tkinter로 이미지 표시
    display_pdf(img, pdf_document, pdf_path, pix.width, pix.height)

def display_pdf(img, pdf_document, pdf_path, width, height):
    global canvas, start_position, end_position, rect_id
    canvas.config(width=width, height=height)  # 캔버스 크기 설정

    # 이미지 표시
    img_tk = ImageTk.PhotoImage(img)
    canvas.create_image(0, 0, anchor="nw", image=img_tk)
    canvas.image = img_tk

    # 마우스 이벤트 처리
    def on_mouse_down(event):
        global start_position, rect_id
        start_position = (event.x, event.y)  # 드래그 시작 좌표 저장
        print(f"Drag started at: {start_position}")
        if rect_id:  # 기존 사각형 제거
            canvas.delete(rect_id)
            rect_id = None

    def on_mouse_drag(event):
        global rect_id
        if start_position:
            x1, y1 = start_position
            x2, y2 = event.x, event.y  # 현재 드래그 위치
            if rect_id:  # 기존 사각형 갱신
                canvas.coords(rect_id, x1, y1, x2, y2)
            else:  # 새로운 사각형 생성
                rect_id = canvas.create_rectangle(x1, y1, x2, y2, outline="red", width=2)

    def on_mouse_up(event):
        global end_position, rect_id
        end_position = (event.x, event.y)  # 드래그 종료 좌표 저장
        print(f"Drag ended at: {end_position}")

        if start_position and end_position:
            add_image_to_pdf_with_preview(canvas, pdf_document, width, height)
        else:
            print("Invalid drag operation.")

    # 이벤트 바인딩
    canvas.bind("<Button-1>", on_mouse_down)  # 드래그 시작
    canvas.bind("<B1-Motion>", on_mouse_drag)  # 드래그 중
    canvas.bind("<ButtonRelease-1>", on_mouse_up)  # 드래그 종료

def update_preview(canvas, pdf_document, width, height):
    """
    현재 PDF 상태를 미리보기로 업데이트
    """
    page = pdf_document[0]
    pix = page.get_pixmap(dpi=72 * scale_factor)  # 고해상도로 렌더링
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

    # Tkinter 캔버스에 새 이미지 표시
    img_tk = ImageTk.PhotoImage(img)
    canvas.create_image(0, 0, anchor="nw", image=img_tk)
    canvas.image = img_tk
    print("Preview updated.")

    save_button = filedialog.Button(root, text="Save PDF", command=lambda: save_pdf(pdf_document))
    save_button.pack()
    #root.bind("<Control-z>", lambda event: undo_last_action()) # 추후 개발을 위함
    root.bind("<Control-s>", lambda event: save_pdf(pdf_document))


def add_image_to_pdf(pdf_document, width, height):
    global start_position, end_position
    if not start_position or not end_position:
        print("No valid drag region selected for image.")
        return

    # 드래그 영역 계산
    x1, y1 = start_position
    x2, y2 = end_position
    x1, x2 = min(x1, x2), max(x1, x2)  # 좌표 정렬
    y1, y2 = min(y1, y2), max(y1, y2)

    # 클릭 좌표를 PDF 좌표로 변환
    x1 /= scale_factor
    y1 /= scale_factor
    x2 /= scale_factor
    y2 /= scale_factor

    # 서명 이미지 삽입
    signature_path = filedialog.askopenfilename(filetypes=[("Image Files", "*.png;*.jpg;*.jpeg")])
    if not signature_path:
        return

    # 서명 이미지 열기
    with Image.open(signature_path) as img:
        # 드래그 영역에 맞게 서명 크기 조정
        sign_width = int(x2 - x1)
        sign_height = int(y2 - y1)
        img_resized = img.resize((sign_width, sign_height), Image.LANCZOS)
        
        # Pillow 이미지를 PyMuPDF 바이트 스트림으로 변환
        img_buffer = io.BytesIO()
        img_resized.save(img_buffer, format="PNG")
        img_bytes = img_buffer.getvalue()

    # PyMuPDF Rect 생성
    signature_rect = fitz.Rect(x1, y1, x2, y2)

    # PDF 첫 번째 페이지에 서명 이미지 삽입
    page = pdf_document[0]
    page.insert_image(signature_rect, stream=img_bytes)

    print(f"Inserted image in {signature_rect}")

def save_pdf(pdf_document):
    """
    PDF 파일을 저장하는 함수
    """
    output_path = filedialog.asksaveasfilename(
        defaultextension=".pdf",
        filetypes=[("PDF Files", "*.pdf")],
        title="Save PDF As"
    )
    if output_path:
        pdf_document.save(output_path)
        print(f"PDF saved as: {output_path}")
    else:
        print("Save operation cancelled.")


def add_image_to_pdf_with_preview(canvas, pdf_document, width, height):
    add_image_to_pdf(pdf_document, width, height)  # 이미지 삽입
    update_preview(canvas, pdf_document, width, height)  # 미리보기 업데이트
    


# Tkinter GUI 생성
root = Tk()
root.title("PDF Signer")

canvas = Canvas(root)
canvas.pack()

# 버튼 추가
open_button = filedialog.Button(root, text="Open PDF", command=open_pdf)
open_button.pack()

root.mainloop()
