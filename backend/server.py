import json
import uuid
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import Dict, Set
import asyncio
import os

app = FastAPI(title="Collaborative Whiteboard")

# Mount static files
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "../frontend/static")), name="static")

# Store connected clients
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.usernames: Dict[str, str] = {}
        self.draw_history = []  # Store drawing history for new joiners

    async def connect(self, websocket: WebSocket, client_id: str, username: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.usernames[client_id] = username
        
        # Send drawing history to new user
        if self.draw_history:
            await websocket.send_text(json.dumps({
                "type": "history",
                "data": self.draw_history
            }))
        
        # Notify others
        await self.broadcast({
            "type": "user_joined",
            "username": username,
            "user_count": len(self.active_connections)
        }, exclude=client_id)
        
        # Send user count to new user
        await websocket.send_text(json.dumps({
            "type": "user_count",
            "count": len(self.active_connections)
        }))

    def disconnect(self, client_id: str):
        username = self.usernames.get(client_id, "Unknown")
        self.active_connections.pop(client_id, None)
        self.usernames.pop(client_id, None)
        return username

    async def broadcast(self, message: dict, exclude: str = None):
        data = json.dumps(message)
        disconnected = []
        for client_id, connection in self.active_connections.items():
            if client_id != exclude:
                try:
                    await connection.send_text(data)
                except:
                    disconnected.append(client_id)
        for cid in disconnected:
            self.disconnect(cid)

manager = ConnectionManager()

@app.get("/")
async def root():
    return FileResponse(os.path.join(os.path.dirname(__file__), "../frontend/index.html"))

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    username = websocket.query_params.get("username", f"User-{client_id[:4]}")
    await manager.connect(websocket, client_id, username)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "draw":
                # Store in history (limit to last 5000 events)
                manager.draw_history.append(message)
                if len(manager.draw_history) > 5000:
                    manager.draw_history = manager.draw_history[-5000:]
                # Broadcast to all other clients
                await manager.broadcast(message, exclude=client_id)
            
            elif message["type"] == "clear":
                manager.draw_history.clear()
                await manager.broadcast(message, exclude=client_id)
            
            elif message["type"] == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    
    except WebSocketDisconnect:
        username = manager.disconnect(client_id)
        await manager.broadcast({
            "type": "user_left",
            "username": username,
            "user_count": len(manager.active_connections)
        })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
