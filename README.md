# 🎨 Collaborative Whiteboard

A real-time collaborative whiteboard where multiple users can draw together simultaneously over a local network.

---

## ✨ Features

- **Pencil Tool** – Free-hand drawing
- **Line Tool** – Draw straight lines
- **Rectangle Tool** – Draw rectangles
- **Circle Tool** – Draw ellipses/circles
- **Eraser Tool** – Erase parts of the drawing
- **Color Picker** – 8 preset colors + custom color picker
- **Brush Size** – Adjustable brush/shape stroke size
- **Clear Board** – Clear everything for all users
- **Real-time Sync** – Instant sync via WebSockets
- **Drawing History** – New users see the existing board when they join
- **Join/Leave Notifications** – Know when others join or leave

---

## 📁 Project Structure

```
whiteboard/
├── backend/
│   └── server.py          # FastAPI + WebSocket server
├── frontend/
│   ├── index.html          # Main HTML page
│   └── static/
│       ├── css/
│       │   └── style.css   # Styles
│       └── js/
│           └── whiteboard.js  # Drawing + WebSocket logic
├── requirements.txt        # Python dependencies
└── README.md
```

---

## 🚀 Installation & Running

### Step 1: Install Python dependencies

```bash
pip install -r requirements.txt
```

### Step 2: Start the server

```bash
cd backend
python server.py
```

Or using uvicorn directly:

```bash
uvicorn backend.server:app --host 0.0.0.0 --port 8000
```

### Step 3: Open in browser

On the host machine:

```
http://localhost:8000
```

On other devices (same WiFi/network):

```
http://<your-ip-address>:8000
```

To find your IP address:

- **Windows**: Run `ipconfig` in Command Prompt
- **Mac/Linux**: Run `ifconfig` or `ip addr` in Terminal

---

## 👥 Multi-User Collaboration

1. Start the server on one machine
2. Share your local IP address with others (e.g., `192.168.1.5:8000`)
3. Everyone opens the URL in their browser
4. Enter a name and start drawing!

All drawing actions sync instantly to everyone on the board.

---

## ⌨️ Keyboard Shortcuts

| Key | Tool      |
| --- | --------- |
| `P` | Pencil    |
| `E` | Eraser    |
| `L` | Line      |
| `R` | Rectangle |
| `C` | Circle    |

---

## 📦 Dependencies

- **fastapi** – Web framework
- **uvicorn** – ASGI server
- **websockets** – WebSocket support

No database required. No login system. Works out of the box!
