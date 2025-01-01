const pdfUpload = document.getElementById('pdfUpload');
const pdfCanvas = document.getElementById('pdfCanvas');
const signCanvas = document.getElementById('signCanvas');
const canvasContext = pdfCanvas.getContext('2d');
const signCanvasContext = signCanvas.getContext('2d');
const signupload = document.getElementById('signupload');
const saveButton = document.getElementById('saveButton');

let fontSize = 0; // "인"의 폰트 크기 저장
let signatureImage = null; // 서명 이미지 저장
let isDragging = false;
let startX, startY, endX, endY;
let pdfPageImage = null; // PDF 페이지 이미지 저장
let pdfBytes = null; // Store the original PDF bytes

pdfUpload.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
        pdfBytes = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });

        pdfCanvas.width = viewport.width;
        pdfCanvas.height = viewport.height;

        const renderContext = {
            canvasContext: canvasContext,
            viewport: viewport
        };

        await page.render(renderContext).promise;

        // PDF 페이지를 이미지로 저장
        pdfPageImage = new Image();
        pdfPageImage.src = pdfCanvas.toDataURL();
        // 텍스트 내용 추출
        const textContent = await page.getTextContent();

        // "인" 글자의 폰트 크기 찾기
        textContent.items.forEach((item) => {
            if (item.str.includes("인")) {
                const transform = item.transform;
                fontSize = transform[0]; // 폰트 크기 추출
            }
        });
    }
});

// 서명 이미지 로드 및 signCanvas에 표시
signupload.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file && file.type === "image/png") { // PNG 파일만 허용
        signatureImage = new Image();
        signatureImage.src = URL.createObjectURL(file);
        signatureImage.onload = () => {
            // signCanvas 크기 설정
            signCanvas.width = signatureImage.width;
            signCanvas.height = signatureImage.height;

            // signCanvas에 이미지 그리기
            signCanvasContext.clearRect(0, 0, signCanvas.width, signCanvas.height); // 기존 이미지 지우기
            signCanvasContext.drawImage(signatureImage, 0, 0);
        };
    }
});

// 드래그 시작
pdfCanvas.addEventListener('mousedown', (event) => {
    if (signatureImage) {
        isDragging = true;
        const rect = pdfCanvas.getBoundingClientRect();
        startX = event.clientX - rect.left;
        startY = event.clientY - rect.top;
    }
});

// 드래그 중
pdfCanvas.addEventListener('mousemove', (event) => {
    if (isDragging) {
        const rect = pdfCanvas.getBoundingClientRect();
        endX = event.clientX - rect.left;
        endY = event.clientY - rect.top;

        // 드래그 영역 표시
        canvasContext.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
        if (pdfPageImage) {
            canvasContext.drawImage(pdfPageImage, 0, 0); // PDF 페이지 다시 그리기
        }
        canvasContext.strokeStyle = 'red';
        canvasContext.strokeRect(startX, startY, endX - startX, endY - startY);
    }
});

// 드래그 종료
pdfCanvas.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;

        const width = endX - startX;
        const height = endY - startY;

        if (width > 0 && height > 0) {
            // 드래그 영역에 이미지 그리기
            canvasContext.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
            if (pdfPageImage) {
                canvasContext.drawImage(pdfPageImage, 0, 0); // PDF 페이지 다시 그리기
            }
            canvasContext.drawImage(signatureImage, startX, startY, width, height);
        }
    }
});

// Save PDF with signature
saveButton.addEventListener('click', async () => {
    if (!pdfBytes || !signatureImage) return;

    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
    const page = pdfDoc.getPage(0);

    // Convert the signature image to a format that pdf-lib can use
    const signatureImageBytes = await fetch(signatureImage.src).then(res => res.arrayBuffer());
    const signatureImageEmbed = await pdfDoc.embedPng(signatureImageBytes);

    // Calculate the position and size for the signature based on the visible canvas area
    const canvasScaleFactor = pdfCanvas.width / page.getWidth();
    const signatureWidth = (endX - startX) / canvasScaleFactor;
    const signatureHeight = (endY - startY) / canvasScaleFactor;
    const x = startX / canvasScaleFactor;
    const y = page.getHeight() - (startY / canvasScaleFactor) - signatureHeight;

    // Draw the signature on the PDF
    page.drawImage(signatureImageEmbed, {
        x,
        y,
        width: signatureWidth,
        height: signatureHeight,
    });

    // Serialize the PDFDocument to bytes
    const pdfBytesModified = await pdfDoc.save();

    // Create a blob and a link to download the modified PDF
    const blob = new Blob([pdfBytesModified], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'signed-document.pdf';
    a.click();
    URL.revokeObjectURL(url);
});


