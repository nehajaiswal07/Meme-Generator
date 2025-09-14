document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const canvas = document.getElementById('memeCanvas');
    const ctx = canvas.getContext('2d');
    const imageUpload = document.getElementById('imageUpload');
    const templateSelect = document.getElementById('templateSelect');
    const webcamBtn = document.getElementById('webcamBtn');
    const webcamContainer = document.querySelector('.webcam-container');
    const webcamVideo = document.getElementById('webcam');
    const captureBtn = document.getElementById('captureBtn');
    const addTextBtn = document.getElementById('addTextBtn');
    const textColor = document.getElementById('textColor');
    const outlineColor = document.getElementById('outlineColor');
    const outlineWidth = document.getElementById('outlineWidth');
    const fontSize = document.getElementById('fontSize');
    const fontSizeValue = document.getElementById('fontSizeValue');
    const fontFamily = document.getElementById('fontFamily');
    const drawBtn = document.getElementById('drawBtn');
    const eraseBtn = document.getElementById('eraseBtn');
    const brushSize = document.getElementById('brushSize');
    const brushColor = document.getElementById('brushColor');
    const clearDrawingBtn = document.getElementById('clearDrawingBtn');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const shareTwitter = document.getElementById('shareTwitter');
    const shareFacebook = document.getElementById('shareFacebook');
    const shareReddit = document.getElementById('shareReddit');
    const downloadBtn = document.getElementById('downloadBtn');
    const saveTemplateBtn = document.getElementById('saveTemplateBtn');
    const toast = new bootstrap.Toast(document.getElementById('toast'));

    // State variables
    let image = null;
    let texts = [];
    let drawings = [];
    let currentDrawing = [];
    let isDrawing = false;
    let isErasing = false;
    let currentFilter = 'none';
    let history = [];
    let historyIndex = -1;
    let isDraggingText = false;
    let draggedTextIndex = -1;
    let dragOffsetX, dragOffsetY;
    let stream = null;

    // Preloaded templates
    const templates = {
        doge: 'https://i.imgflip.com/4/1bij.jpg',
        grumpycat: 'https://i.imgflip.com/8k0sa.jpg',
        distractedbf: 'https://i.imgflip.com/9vct.jpg'
    };

    // Initialize
    updateFontSizeDisplay();
    disableUndoRedo();
    setupCanvas();

    // Event Listeners
    imageUpload.addEventListener('change', handleImageUpload);
    templateSelect.addEventListener('change', handleTemplateSelect);
    webcamBtn.addEventListener('click', toggleWebcam);
    captureBtn.addEventListener('click', captureWebcam);
    addTextBtn.addEventListener('click', addText);
    textColor.addEventListener('input', redrawMeme);
    outlineColor.addEventListener('input', redrawMeme);
    outlineWidth.addEventListener('input', redrawMeme);
    fontSize.addEventListener('input', updateFontSize);
    fontFamily.addEventListener('change', redrawMeme);
    drawBtn.addEventListener('click', () => setDrawingMode(true));
    eraseBtn.addEventListener('click', () => setDrawingMode(false));
    brushSize.addEventListener('input', updateBrushPreview);
    brushColor.addEventListener('input', updateBrushPreview);
    clearDrawingBtn.addEventListener('click', clearDrawings);
    filterBtns.forEach(btn => btn.addEventListener('click', applyFilter));
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    shareTwitter.addEventListener('click', () => shareMeme('twitter'));
    shareFacebook.addEventListener('click', () => shareMeme('facebook'));
    shareReddit.addEventListener('click', () => shareMeme('reddit'));
    downloadBtn.addEventListener('click', downloadMeme);
    saveTemplateBtn.addEventListener('click', saveTemplate);

    // Canvas mouse events
    canvas.addEventListener('mousedown', startDrawingOrDragging);
    canvas.addEventListener('mousemove', drawOrDrag);
    canvas.addEventListener('mouseup', endDrawingOrDragging);
    canvas.addEventListener('mouseout', endDrawingOrDragging);
    canvas.addEventListener('dblclick', handleDoubleClick);

    // ===== Core Functions =====

    function setupCanvas() {
        // Set initial canvas background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        saveState();
    }

    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                loadImage(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    }

    function handleTemplateSelect(e) {
        const template = templates[e.target.value];
        if (template) loadImage(template);
    }

    async function toggleWebcam() {
        if (stream) {
            // Turn off webcam
            stream.getTracks().forEach(track => track.stop());
            stream = null;
            webcamContainer.classList.add('d-none');
            webcamBtn.innerHTML = '<i class="bi bi-camera"></i> Take Snapshot';
            webcamBtn.classList.remove('btn-danger');
            webcamBtn.classList.add('btn-outline-primary');
        } else {
            // Turn on webcam
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
                webcamVideo.srcObject = stream;
                webcamContainer.classList.remove('d-none');
                webcamBtn.innerHTML = '<i class="bi bi-camera-video-off"></i> Close Webcam';
                webcamBtn.classList.remove('btn-outline-primary');
                webcamBtn.classList.add('btn-danger');
            } catch (err) {
                showToast('Error accessing webcam: ' + err.message, 'error');
            }
        }
    }

    function captureWebcam() {
        if (!stream) return;
        
        // Create temporary canvas to capture video frame
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = webcamVideo.videoWidth;
        tempCanvas.height = webcamVideo.videoHeight;
        tempCtx.drawImage(webcamVideo, 0, 0, tempCanvas.width, tempCanvas.height);
        
        // Load the captured image to main canvas
        loadImage(tempCanvas.toDataURL('image/png'));
        showToast('Webcam snapshot captured!', 'success');
    }

    function loadImage(src) {
        image = new Image();
        image.onload = () => {
            // Resize canvas to match image dimensions
            canvas.width = image.width;
            canvas.height = image.height;
            saveState();
            redrawMeme();
        };
        image.onerror = () => {
            showToast('Error loading image', 'error');
        };
        image.src = src;
    }

    function addText() {
        const newText = {
            content: "Double-click to edit",
            x: canvas.width / 2,
            y: canvas.height / 2,
            color: textColor.value,
            fontSize: parseInt(fontSize.value),
            fontFamily: fontFamily.value,
            outlineColor: outlineColor.value,
            outlineWidth: parseInt(outlineWidth.value)
        };
        texts.push(newText);
        saveState();
        redrawMeme();
    }

    function redrawMeme() {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Apply filter
        applyCanvasFilter();
        
        // Draw image
        if (image) {
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        }
        
        // Draw all texts
        texts.forEach(text => {
            drawTextWithOutline(text);
        });
        
        // Redraw all drawings
        redrawAllDrawings();
    }

    function drawTextWithOutline(text) {
        ctx.font = `${text.fontSize}px ${text.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Draw text outline
        if (text.outlineWidth > 0) {
            ctx.lineWidth = text.outlineWidth;
            ctx.strokeStyle = text.outlineColor;
            ctx.strokeText(text.content, text.x, text.y);
        }
        
        // Draw text fill
        ctx.fillStyle = text.color;
        ctx.fillText(text.content, text.x, text.y);
    }

    function applyCanvasFilter() {
        switch (currentFilter) {
            case 'grayscale':
                ctx.filter = 'grayscale(100%)';
                break;
            case 'sepia':
                ctx.filter = 'sepia(100%)';
                break;
            case 'blur':
                ctx.filter = 'blur(5px)';
                break;
            case 'invert':
                ctx.filter = 'invert(100%)';
                break;
            default:
                ctx.filter = 'none';
        }
    }

    // ===== Drawing Functions =====

    function setDrawingMode(drawing) {
        isDrawing = drawing;
        isErasing = !drawing;
        
        if (isDrawing) {
            drawBtn.classList.add('active');
            eraseBtn.classList.remove('active');
            canvas.style.cursor = 'crosshair';
        } else {
            drawBtn.classList.remove('active');
            eraseBtn.classList.add('active');
            canvas.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 16 16\'><circle cx=\'8\' cy=\'8\' r=\'8\' fill=\'white\' stroke=\'black\'/></svg>") 8 8, auto';
        }
    }

    function startDrawingOrDragging(e) {
        const pos = getMousePos(canvas, e);
        
        // First check if we're clicking on text to drag it
        const clickedTextIndex = getTextAtPosition(pos.x, pos.y);
        if (clickedTextIndex !== -1) {
            isDraggingText = true;
            draggedTextIndex = clickedTextIndex;
            dragOffsetX = pos.x - texts[clickedTextIndex].x;
            dragOffsetY = pos.y - texts[clickedTextIndex].y;
            canvas.style.cursor = 'grabbing';
            return;
        }
        
        // Otherwise, start drawing
        if (isDrawing || isErasing) {
            isDrawing = true;
            currentDrawing = [];
            currentDrawing.push({
                x: pos.x,
                y: pos.y,
                size: parseInt(brushSize.value),
                color: isErasing ? '#ffffff' : brushColor.value,
                isErasing
            });
        }
    }

    function drawOrDrag(e) {
        const pos = getMousePos(canvas, e);
        
        if (isDraggingText && draggedTextIndex !== -1) {
            texts[draggedTextIndex].x = pos.x - dragOffsetX;
            texts[draggedTextIndex].y = pos.y - dragOffsetY;
            redrawMeme();
            return;
        }
        
        if (isDrawing) {
            currentDrawing.push({
                x: pos.x,
                y: pos.y,
                size: parseInt(brushSize.value),
                color: isErasing ? '#ffffff' : brushColor.value,
                isErasing
            });
            drawCurrentStroke();
        }
    }

    function endDrawingOrDragging() {
        if (isDraggingText) {
            isDraggingText = false;
            draggedTextIndex = -1;
            canvas.style.cursor = 'crosshair';
            saveState();
            return;
        }
        
        if (isDrawing) {
            isDrawing = false;
            if (currentDrawing.length > 1) {
                drawings.push([...currentDrawing]);
                saveState();
            }
            currentDrawing = [];
        }
    }

    function drawCurrentStroke() {
        if (currentDrawing.length < 2) return;
        
        const lastPoint = currentDrawing[currentDrawing.length - 2];
        const currentPoint = currentDrawing[currentDrawing.length - 1];
        
        ctx.beginPath();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = currentPoint.color;
        ctx.lineWidth = currentPoint.size;
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(currentPoint.x, currentPoint.y);
        ctx.stroke();
    }

    function redrawAllDrawings() {
        drawings.forEach(stroke => {
            if (stroke.length < 2) return;
            
            ctx.beginPath();
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.strokeStyle = stroke[0].color;
            ctx.lineWidth = stroke[0].size;
            ctx.moveTo(stroke[0].x, stroke[0].y);
            
            for (let i = 1; i < stroke.length; i++) {
                ctx.lineTo(stroke[i].x, stroke[i].y);
            }
            
            ctx.stroke();
        });
    }

    function clearDrawings() {
        drawings = [];
        saveState();
        redrawMeme();
        showToast('Drawings cleared', 'success');
    }

    // ===== Text Editing =====

    function handleDoubleClick(e) {
        const pos = getMousePos(canvas, e);
        const textIndex = getTextAtPosition(pos.x, pos.y);
        
        if (textIndex !== -1) {
            const newText = prompt('Edit text:', texts[textIndex].content);
            if (newText !== null) {
                texts[textIndex].content = newText;
                saveState();
                redrawMeme();
            }
        }
    }

    function getTextAtPosition(x, y) {
        for (let i = texts.length - 1; i >= 0; i--) {
            const text = texts[i];
            ctx.font = `${text.fontSize}px ${text.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const metrics = ctx.measureText(text.content);
            const textWidth = metrics.width;
            const textHeight = text.fontSize;
            
            if (
                x >= text.x - textWidth/2 &&
                x <= text.x + textWidth/2 &&
                y >= text.y - textHeight/2 &&
                y <= text.y + textHeight/2
            ) {
                return i;
            }
        }
        return -1;
    }

    // ===== Filters =====

    function applyFilter(e) {
        currentFilter = e.target.dataset.filter;
        filterBtns.forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        saveState();
        redrawMeme();
    }

    // ===== Undo/Redo =====

    function saveState() {
        // Remove future states if we're not at the latest
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }
        
        history.push({
            image: image ? image.src : null,
            texts: JSON.parse(JSON.stringify(texts)),
            drawings: JSON.parse(JSON.stringify(drawings)),
            filter: currentFilter
        });
        historyIndex++;
        disableUndoRedo();
    }

    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            loadState();
        }
    }

    function redo() {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            loadState();
        }
    }

    function loadState() {
        const state = history[historyIndex];
        
        if (state.image) {
            loadImage(state.image);
        } else {
            image = null;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        texts = JSON.parse(JSON.stringify(state.texts));
        drawings = JSON.parse(JSON.stringify(state.drawings));
        currentFilter = state.filter;
        
        // Update active filter button
        filterBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === currentFilter);
        });
        
        disableUndoRedo();
        redrawMeme();
    }

    function disableUndoRedo() {
        undoBtn.disabled = historyIndex <= 0;
        redoBtn.disabled = historyIndex >= history.length - 1;
    }

    // ===== Sharing & Export =====

    function shareMeme(platform) {
        if (!image && texts.length === 0 && drawings.length === 0) {
            showToast('Create a meme first!', 'error');
            return;
        }
        
        canvas.toBlob(blob => {
            const file = new File([blob], 'meme.png', { type: 'image/png' });
            const formData = new FormData();
            formData.append('file', file);
            
            // For demo purposes, we'll just open share URLs
            const text = encodeURIComponent("Check out this meme I made!");
            const url = encodeURIComponent(window.location.href);
            
            let shareUrl;
            switch (platform) {
                case 'twitter':
                    shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
                    break;
                case 'facebook':
                    shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
                    break;
                case 'reddit':
                    shareUrl = `https://www.reddit.com/submit?url=${url}&title=${text}`;
                    break;
                default:
                    return;
            }
            
            window.open(shareUrl, '_blank');
        }, 'image/png');
    }

    function downloadMeme() {
        if (!image && texts.length === 0 && drawings.length === 0) {
            showToast('Create a meme first!', 'error');
            return;
        }
        
        const link = document.createElement('a');
        link.download = 'meme.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('Meme downloaded!', 'success');
    }

    function saveTemplate() {
        if (!image && texts.length === 0) {
            showToast('Add an image or text first!', 'error');
            return;
        }
        
        const template = {
            image: image ? image.src : null,
            texts: JSON.parse(JSON.stringify(texts)),
            timestamp: new Date().toISOString()
        };
        
        // Save to localStorage
        let savedTemplates = JSON.parse(localStorage.getItem('memeTemplates')) || [];
        savedTemplates.push(template);
        localStorage.setItem('memeTemplates', JSON.stringify(savedTemplates));
        
        showToast('Template saved!', 'success');
    }

    // ===== Utilities =====

    function getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
    }

    function updateFontSize() {
        fontSizeValue.textContent = `${fontSize.value}px`;
        if (texts.length > 0) {
            texts[texts.length - 1].fontSize = parseInt(fontSize.value);
            redrawMeme();
        }
    }

    function updateFontSizeDisplay() {
        fontSizeValue.textContent = `${fontSize.value}px`;
    }

    function updateBrushPreview() {
        // Could add a brush preview UI element
    }

    function showToast(message, type = 'info') {
        const toastBody = document.querySelector('.toast-body');
        toastBody.textContent = message;
        
        const toastHeader = document.querySelector('.toast-header');
        toastHeader.className = 'toast-header';
        
        switch (type) {
            case 'success':
                toastHeader.classList.add('bg-success', 'text-white');
                break;
            case 'error':
                toastHeader.classList.add('bg-danger', 'text-white');
                break;
            case 'warning':
                toastHeader.classList.add('bg-warning');
                break;
            default:
                toastHeader.classList.add('bg-primary', 'text-white');
        }
        
        toast.show();
    }
});



