document.addEventListener('DOMContentLoaded', () => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

    const pdfUpload = document.getElementById('pdfUpload');
    const signatureUpload = document.getElementById('signatureUpload');
    const pdfCanvas = document.getElementById('pdfCanvas');
    const canvasContext = pdfCanvas.getContext('2d');
    const pageControls = document.getElementById('pageControls'); // 페이지 컨트롤 영역

    let pdfDocument = null;
    let signatureImage = null;
    let isDragging = false;
    let startX = 0, startY = 0, endX = 0, endY = 0;
    let pdfSignatureInfo = null;
    let currentPage = 1;
    let totalPages = 0;
    let currentRangeStart = 2; // 현재 페이지 범위의 시작
    const PAGE_RANGE = 5; // 한번에 표시할 페이지 수

    let cachedPDFImages = {}; // 각 페이지별 PDF 이미지를 캐싱

    // PDF 업로드 및 렌더링
    pdfUpload.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            const pdfData = await file.arrayBuffer();
            pdfDocument = await pdfjsLib.getDocument({ data: pdfData }).promise;
            totalPages = pdfDocument.numPages;
            cachedPDFImages = {}; // 캐시 초기화
            renderPageNumbers();
            renderPDF(currentPage);
        }
    });

    // 페이지 번호 버튼 생성
    function renderPageNumbers() {
        pageControls.innerHTML = '';

        // 항상 1번 페이지 버튼 추가
        const firstButton = document.createElement('button');
        firstButton.textContent = '1';
        if (currentPage === 1) {
            firstButton.classList.add('active');
        }
        firstButton.addEventListener('click', () => {
            currentPage = 1;
            renderPDF(currentPage);
            renderPageNumbers(); // 버튼 상태 업데이트
        });
        pageControls.appendChild(firstButton);

        // 간격 추가
        if (currentRangeStart > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            pageControls.appendChild(ellipsis);
        }

        // 현재 범위의 페이지 버튼 추가
        for (let i = currentRangeStart; i < currentRangeStart + PAGE_RANGE && i <= totalPages; i++) {
            const button = document.createElement('button');
            button.textContent = i;

            if (i === currentPage) {
                button.classList.add('active');
            }

            button.addEventListener('click', () => {
                currentPage = i;
                renderPDF(currentPage);
                renderPageNumbers(); // 버튼 상태 업데이트
            });

            pageControls.appendChild(button);
        }

        // 다음 버튼 추가
        if (currentRangeStart + PAGE_RANGE <= totalPages) {
            const nextButton = document.createElement('button');
            nextButton.textContent = '▶';
            nextButton.addEventListener('click', () => {
                currentRangeStart = Math.min(totalPages - PAGE_RANGE + 2, currentRangeStart + PAGE_RANGE);
                renderPageNumbers();
            });
            pageControls.appendChild(nextButton);
        }
    }

    // PDF를 이미지로 렌더링하여 캐싱
    async function renderPDFToImage(pageNumber) {
        if (cachedPDFImages[pageNumber]) {
            return cachedPDFImages[pageNumber];
        }

        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });

        const tempCanvas = document.createElement('canvas');
        const tempContext = tempCanvas.getContext('2d');
        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;

        await page.render({ canvasContext: tempContext, viewport }).promise;
        const img = new Image();
        img.src = tempCanvas.toDataURL();
        cachedPDFImages[pageNumber] = img;
        return img;
    }

    // PDF 렌더링 함수
    async function renderPDF(pageNumber) {
        const cachedImage = await renderPDFToImage(pageNumber);

        // A4 크기에 맞춰 캔버스 크기 고정
        pdfCanvas.width = cachedImage.width;
        pdfCanvas.height = cachedImage.height;

        canvasContext.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
        canvasContext.drawImage(cachedImage, 0, 0);

        // 드래그 후 서명 미리보기
        if (pdfSignatureInfo && signatureImage && pdfSignatureInfo.page === pageNumber) {
            const { x, y, width, height } = pdfSignatureInfo;
            canvasContext.drawImage(signatureImage, x, y, width, height);
        }
    }

    // 서명 이미지 업로드
    signatureUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                img.onload = () => {
                    signatureImage = img;
                    console.log('Signature image loaded.');
                };
            };
            reader.readAsDataURL(file);
        }
    });

    // 드래그 시작
    pdfCanvas.addEventListener('mousedown', (event) => {
        if (!pdfDocument || !signatureImage) {
            alert('Upload both a PDF and a signature file first!');
            return;
        }

        isDragging = true;
        const rect = pdfCanvas.getBoundingClientRect();
        startX = (event.clientX - rect.left) * (pdfCanvas.width / rect.width);
        startY = (event.clientY - rect.top) * (pdfCanvas.height / rect.height);
    });

    // 드래그 중
    pdfCanvas.addEventListener('mousemove', (event) => {
        if (!isDragging) return;

        const rect = pdfCanvas.getBoundingClientRect();
        endX = (event.clientX - rect.left) * (pdfCanvas.width / rect.width);
        endY = (event.clientY - rect.top) * (pdfCanvas.height / rect.height);

        // PDF 캐시된 이미지 유지하며 드래그 영역 표시
        canvasContext.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
        canvasContext.drawImage(cachedPDFImages[currentPage], 0, 0);
        canvasContext.strokeStyle = 'red';
        canvasContext.lineWidth = 2;
        canvasContext.strokeRect(startX, startY, endX - startX, endY - startY);
    });

    // 드래그 종료
    pdfCanvas.addEventListener('mouseup', () => {
        if (!isDragging) return;

        isDragging = false;

        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);

        if (width > 0 && height > 0) {
            pdfSignatureInfo = {
                page: currentPage,
                x: Math.min(startX, endX),
                y: Math.min(startY, endY),
                width: width,
                height: height,
            };
            renderPDF(currentPage);
        }
    });

    // PDF 다운로드 기능 추가
    document.getElementById('downloadButton').addEventListener('click', async () => {
        if (!pdfDocument || !pdfSignatureInfo || !signatureImage) {
            alert('Please upload a PDF and place a signature before downloading.');
            return;
        }

        const pdfBytes = await pdfUpload.files[0].arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
        const page = pdfDoc.getPage(pdfSignatureInfo.page - 1);

        // 서명 이미지를 PDF에 삽입
        const signatureImageBytes = await fetch(signatureImage.src).then(res => res.arrayBuffer());
        const signatureImageEmbed = await pdfDoc.embedPng(signatureImageBytes);

        const { x, y, width, height } = pdfSignatureInfo;

        // PDF 좌표 변환 (원본 해상도 기준)
        const pdfHeight = page.getSize().height;
        page.drawImage(signatureImageEmbed, {
            x,
            y: pdfHeight - y - height, // PDF 좌표는 좌하단 원점
            width,
            height,
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
