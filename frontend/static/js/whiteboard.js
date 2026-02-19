// === State ===
let ws = null;
let clientId = null;
let username = '';
let currentTool = 'pencil';
let currentColor = '#000000';
let brushSize = 4;
let isDrawing = false;
let startX, startY, lastX, lastY;
let drawingHistory = [];

// === Canvas Setup ===
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const previewCanvas = document.getElementById('preview-canvas');
const pCtx = previewCanvas.getContext('2d');

function resizeCanvas() {
    const container = document.getElementById('canvas-container');
    const w = container.clientWidth;
    const h = container.clientHeight;

    // Save current drawing
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    canvas.width = w;
    canvas.height = h;
    previewCanvas.width = w;
    previewCanvas.height = h;

    // Restore
    ctx.putImageData(imageData, 0, 0);

    setCanvasStyle();
}

function setCanvasStyle() {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// === Join Board ===
function joinBoard() {
    const input = document.getElementById('username-input');
    const name = input.value.trim();
    if (!name) {
        input.focus();
        input.style.borderColor = '#ef4444';
        setTimeout(() => input.style.borderColor = '', 1000);
        return;
    }

    username = name;
    clientId = generateId();

    document.getElementById('join-modal').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('username-display').textContent = '👤 ' + username;

    resizeCanvas();
    connectWebSocket();
}

document.getElementById('username-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinBoard();
});

// === WebSocket ===
function connectWebSocket() {
    const host = window.location.host;
    const url = `ws://${host}/ws/${clientId}?username=${encodeURIComponent(username)}`;

    ws = new WebSocket(url);

    ws.onopen = () => {
        setStatus(true);
        showNotification(`Connected as ${username}`, 'info');
    };

    ws.onclose = () => {
        setStatus(false);
        setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = () => setStatus(false);

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
    };
}

function handleMessage(msg) {
    switch (msg.type) {
        case 'history':
            // Replay all drawing history
            msg.data.forEach(m => {
                if (m.type === 'draw') renderDrawEvent(m);
            });
            break;
        case 'draw':
            renderDrawEvent(msg);
            break;
        case 'clear':
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            showNotification('Board cleared', 'info');
            break;
        case 'user_joined':
            document.getElementById('user-count').textContent = `👥 ${msg.user_count} user${msg.user_count !== 1 ? 's' : ''}`;
            showNotification(`${msg.username} joined`, 'join');
            break;
        case 'user_left':
            document.getElementById('user-count').textContent = `👥 ${msg.user_count} user${msg.user_count !== 1 ? 's' : ''}`;
            showNotification(`${msg.username} left`, 'leave');
            break;
        case 'user_count':
            document.getElementById('user-count').textContent = `👥 ${msg.count} user${msg.count !== 1 ? 's' : ''}`;
            break;
    }
}

function sendMessage(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
    }
}

// === Drawing ===
function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
        return {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top
        };
    }
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

previewCanvas.style.pointerEvents = 'none';
canvas.style.cursor = 'crosshair';

// Mouse events on the canvas container
const canvasContainer = document.getElementById('canvas-container');

canvasContainer.addEventListener('mousedown', startDraw);
canvasContainer.addEventListener('mousemove', draw);
canvasContainer.addEventListener('mouseup', endDraw);
canvasContainer.addEventListener('mouseleave', endDraw);
canvasContainer.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e); }, { passive: false });
canvasContainer.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); }, { passive: false });
canvasContainer.addEventListener('touchend', (e) => { e.preventDefault(); endDraw(e); }, { passive: false });

function startDraw(e) {
    isDrawing = true;
    const pos = getPos(e);
    startX = pos.x;
    startY = pos.y;
    lastX = pos.x;
    lastY = pos.y;

    if (currentTool === 'pencil' || currentTool === 'eraser') {
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    }
}

function draw(e) {
    if (!isDrawing) return;
    const pos = getPos(e);

    if (currentTool === 'pencil' || currentTool === 'eraser') {
        const color = currentTool === 'eraser' ? '#ffffff' : currentColor;
        const size = currentTool === 'eraser' ? brushSize * 4 : brushSize;

        ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();

        // Send segment
        const msg = {
            type: 'draw',
            tool: currentTool,
            color: color,
            size: size,
            fromX: lastX, fromY: lastY,
            toX: pos.x, toY: pos.y,
            eraser: currentTool === 'eraser'
        };
        sendMessage(msg);

        lastX = pos.x;
        lastY = pos.y;
    } else {
        // Shape preview
        pCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        drawShape(pCtx, currentTool, startX, startY, pos.x, pos.y, currentColor, brushSize);
    }
}

function endDraw(e) {
    if (!isDrawing) return;
    isDrawing = false;

    const pos = e.touches ? { x: lastX, y: lastY } : getPos(e);
    pCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    if (currentTool !== 'pencil' && currentTool !== 'eraser') {
        drawShape(ctx, currentTool, startX, startY, pos.x, pos.y, currentColor, brushSize);

        const msg = {
            type: 'draw',
            tool: currentTool,
            color: currentColor,
            size: brushSize,
            fromX: startX, fromY: startY,
            toX: pos.x, toY: pos.y
        };
        sendMessage(msg);
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
}

function drawShape(context, tool, x1, y1, x2, y2, color, size) {
    context.save();
    context.strokeStyle = color;
    context.lineWidth = size;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.globalCompositeOperation = 'source-over';
    context.beginPath();

    switch (tool) {
        case 'line':
            context.moveTo(x1, y1);
            context.lineTo(x2, y2);
            break;
        case 'rect':
            context.rect(x1, y1, x2 - x1, y2 - y1);
            break;
        case 'circle':
            const rx = (x2 - x1) / 2;
            const ry = (y2 - y1) / 2;
            const cx = x1 + rx;
            const cy = y1 + ry;
            context.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
            break;
    }

    context.stroke();
    context.restore();
}

function renderDrawEvent(msg) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (msg.tool === 'pencil' || msg.tool === 'eraser') {
        ctx.globalCompositeOperation = msg.eraser ? 'destination-out' : 'source-over';
        ctx.strokeStyle = msg.color;
        ctx.lineWidth = msg.size;
        ctx.beginPath();
        ctx.moveTo(msg.fromX, msg.fromY);
        ctx.lineTo(msg.toX, msg.toY);
        ctx.stroke();
    } else {
        drawShape(ctx, msg.tool, msg.fromX, msg.fromY, msg.toX, msg.toY, msg.color, msg.size);
    }

    ctx.restore();
}

// === Tools ===
function setTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tool-' + tool).classList.add('active');
    canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
}

function setColor(color) {
    currentColor = color;
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    const swatches = document.querySelectorAll('.swatch');
    swatches.forEach(s => {
        if (s.style.background === color || s.style.backgroundColor === color) {
            s.classList.add('active');
        }
    });
    document.getElementById('color-picker').value = color;
    // If eraser was active and user picks color, switch to pencil
    if (currentTool === 'eraser') setTool('pencil');
}

function setBrushSize(val) {
    brushSize = parseInt(val);
    document.getElementById('size-display').textContent = val + 'px';
}

function clearBoard() {
    if (!confirm('Clear the entire board for everyone?')) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    sendMessage({ type: 'clear' });
}

// === Keyboard Shortcuts ===
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.key.toLowerCase()) {
        case 'p': setTool('pencil'); break;
        case 'e': setTool('eraser'); break;
        case 'l': setTool('line'); break;
        case 'r': setTool('rect'); break;
        case 'c': setTool('circle'); break;
    }
});

// === Status ===
function setStatus(connected) {
    const el = document.getElementById('connection-status');
    if (connected) {
        el.textContent = '🟢 Connected';
        el.className = 'status connected';
    } else {
        el.textContent = '🔴 Reconnecting...';
        el.className = 'status disconnected';
    }
}

// === Notifications ===
function showNotification(text, type = 'info') {
    const container = document.getElementById('notifications');
    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.textContent = text;
    container.appendChild(el);

    setTimeout(() => {
        el.style.animation = 'fadeOut 0.4s ease forwards';
        setTimeout(() => el.remove(), 400);
    }, 3000);
}

// === Utils ===
function generateId() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}
