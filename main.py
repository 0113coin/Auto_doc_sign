from flask import Flask, request, send_file
import fitz  # PyMuPDF
import io

app = Flask(__name__)

@app.route('/upload', methods=['POST'])
def upload_pdf():
    pdf_file = request.files['file']
    signature_file = request.files['signature']
    x1, y1, x2, y2 = map(float, request.form['coords'].split(","))

    pdf_document = fitz.open("pdf", pdf_file.read())
    page = pdf_document[0]
    rect = fitz.Rect(x1, y1, x2, y2)

    # 서명 이미지 추가
    with io.BytesIO(signature_file.read()) as sig_buf:
        page.insert_image(rect, stream=sig_buf)

    output = io.BytesIO()
    pdf_document.save(output)
    output.seek(0)
    return send_file(output, mimetype="application/pdf", as_attachment=True, download_name="signed.pdf")
