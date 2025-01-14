document.addEventListener('DOMContentLoaded', () => {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    const pdfCanvas = document.getElementById('pdfCanvas');
    const canvasContext = pdfCanvas.getContext('2d');
    const pdfUpload = document.getElementById('pdfUpload');
    const signatureUpload = document.getElementById('signatureUpload');
    const downloadButton = document.getElementById('downloadButton');

    let pdfDocument = null;
    let signatureImage = null;
    let currentPage = 1;
    let startX = 0, startY = 0, signatureSize = 100; // 기본 크기 설정
    const cachedPDFPages = {}; // 캐싱된 PDF 페이지 이미지

    // PDF 업로드
    pdfUpload.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            const pdfData = await file.arrayBuffer();
            pdfDocument = await pdfjsLib.getDocument({ data: pdfData }).promise;
            await cacheAllPages();
            renderCachedPage(currentPage);
        }
    });

    // 서명 업로드
    signatureUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                img.onload = () => {
                    signatureImage = img;
                };
            };
            reader.readAsDataURL(file);
        }
    });

    // PDF 페이지 캐싱
    async function cacheAllPages() {
        if (!pdfDocument) return;
        for (let i = 1; i <= pdfDocument.numPages; i++) {
            const page = await pdfDocument.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });

            const tempCanvas = document.createElement('canvas');
            const tempContext = tempCanvas.getContext('2d');
            tempCanvas.width = viewport.width;
            tempCanvas.height = viewport.height;

            await page.render({ canvasContext: tempContext, viewport }).promise;

            cachedPDFPages[i] = tempCanvas.toDataURL();
        }
    }

    // 캐싱된 페이지 렌더링
    function renderCachedPage(pageNumber) {
        if (cachedPDFPages[pageNumber]) {
            const img = new Image();
            img.src = cachedPDFPages[pageNumber];
            img.onload = () => {
                pdfCanvas.width = img.width;
                pdfCanvas.height = img.height;
                canvasContext.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
                canvasContext.drawImage(img, 0, 0);
            };
        }
    }

    // PDF 캔버스 클릭 이벤트 (모바일 환경)
    pdfCanvas.addEventListener('click', (event) => {
        if (!signatureImage) {
            alert('Upload a signature image first!');
            return;
        }

        const rect = pdfCanvas.getBoundingClientRect();
        startX = (event.clientX - rect.left) * (pdfCanvas.width / rect.width);
        startY = (event.clientY - rect.top) * (pdfCanvas.height / rect.height);

        // 캔버스에 서명 미리보기
        canvasContext.drawImage(signatureImage, startX, startY, signatureSize, signatureSize / 2);
    });

    // 드래그 앤 드롭 (PC 전용)
    if (!isMobile) {
        let isDragging = false;
        let startX, startY;

        pdfCanvas.addEventListener('mousedown', (event) => {
            if (!signatureImage) return;

            isDragging = true;
            const rect = pdfCanvas.getBoundingClientRect();
            startX = (event.clientX - rect.left) * (pdfCanvas.width / rect.width);
            startY = (event.clientY - rect.top) * (pdfCanvas.height / rect.height);
        });

        pdfCanvas.addEventListener('mousemove', (event) => {
            if (!isDragging) return;

            const rect = pdfCanvas.getBoundingClientRect();
            const endX = (event.clientX - rect.left) * (pdfCanvas.width / rect.width);
            const endY = (event.clientY - rect.top) * (pdfCanvas.height / rect.height);

            // 캐싱된 PDF 이미지 유지
            renderCachedPage(currentPage);
            canvasContext.strokeStyle = 'red';
            canvasContext.strokeRect(startX, startY, endX - startX, endY - startY);
        });

        pdfCanvas.addEventListener('mouseup', (event) => {
            if (!isDragging) return;

            isDragging = false;
            const rect = pdfCanvas.getBoundingClientRect();
            const x = (event.clientX - rect.left) * (pdfCanvas.width / rect.width);
            const y = (event.clientY - rect.top) * (pdfCanvas.height / rect.height);

            // 서명 배치
            canvasContext.drawImage(signatureImage, startX, startY, x - startX, y - startY);
        });
    }

    // 다운로드 버튼 이벤트
    document.getElementById('downloadButton').addEventListener('click', async () => {
        if (!pdfDocument || !signatureImage) {
            alert('Please upload both a PDF and a signature!');
            return;
        }

        const pdfBytes = await pdfUpload.files[0].arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
        const page = pdfDoc.getPage(currentPage - 1);

        // 서명 이미지를 PDF에 삽입
        const signatureImageBytes = await fetch(signatureImage.src).then(res => res.arrayBuffer());
        const signatureImageEmbed = await pdfDoc.embedPng(signatureImageBytes);

        const canvasRect = pdfCanvas.getBoundingClientRect();

        // PDF 좌표 변환
        const x = (startX / canvasRect.width) * page.getWidth();
        const y = page.getHeight() - ((startY + signatureSize / 2) / canvasRect.height) * page.getHeight();
        const width = (signatureSize / canvasRect.width) * page.getWidth();
        const height = (signatureSize / 2 / canvasRect.height) * page.getHeight();

        page.drawImage(signatureImageEmbed, {
            x: x,
            y: y,
            width: width,
            height: height,
        });

        // PDF 저장
        const modifiedPdfBytes = await pdfDoc.save();
        const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'signed-document.pdf';
        a.click();

        URL.revokeObjectURL(url);
    });
    
});
