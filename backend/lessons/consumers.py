import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer

# A simple in-memory store for room state
# In production, you would use Redis, but this works perfectly for now.
ROOM_MEMORY = {}

# Video & Audio sync message types — excluded from chat/lesson history (they are volatile)
VIDEO_MSG_TYPES = {"VIDEO_PLAY", "VIDEO_PAUSE", "VIDEO_SEEK", "VIDEO_SYNC"}
AUDIO_MSG_TYPES = {"AUDIO_PLAY", "AUDIO_PAUSE", "AUDIO_SYNC", "AUDIO_STATE"}


class LessonConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['id']
        self.room_group_name = f"lesson_{self.room_id}"

        # 1. Initialize Room Memory if it doesn't exist
        if self.room_id not in ROOM_MEMORY:
            ROOM_MEMORY[self.room_id] = {
                "history": [],         # Chat & Event History
                "zone_state": {},      # Current Game State (Matches, Drawings)
                "video_state": None,   # Latest video position: {"state": "playing"|"paused", "t": float}
                "audio_state": None,   # Latest audio position: {"state": "playing"|"paused", "t": float}
            }

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

        # 2. Send History Dump (Restores Chat & Slide Position)
        await self.send_json({
            "type": "history_dump",
            "data": ROOM_MEMORY[self.room_id]["history"]
        })

        # 3. Send Zone State (Restores Drag & Drop / Drawings)
        if ROOM_MEMORY[self.room_id]["zone_state"]:
             await self.send_json({
                "type": "ZONE_STATE_UPDATE",
                "payload": ROOM_MEMORY[self.room_id]["zone_state"]
            })

        # 4. Send Video State
        if ROOM_MEMORY[self.room_id]["video_state"]:
            await self.send_json({
                "type": "VIDEO_STATE",
                "payload": ROOM_MEMORY[self.room_id]["video_state"]
            })
            
        # 5. Send Audio State (late joining students)
        if ROOM_MEMORY[self.room_id]["audio_state"]:
            await self.send_json({
                "type": "AUDIO_STATE",
                "payload": ROOM_MEMORY[self.room_id]["audio_state"]
            })

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # --- RECEIVE MESSAGES FROM FRONTEND ---
    async def receive_json(self, content):
        msg_type = content.get("type")
        payload = content.get("payload", {})

        # Save to history — skip volatile video/audio sync events
        if msg_type not in VIDEO_MSG_TYPES and msg_type not in AUDIO_MSG_TYPES and self.room_id in ROOM_MEMORY:
            ROOM_MEMORY[self.room_id]["history"].append(content)
            ROOM_MEMORY[self.room_id]["history"] = ROOM_MEMORY[self.room_id]["history"][-50:]

        # HANDLER 1: Chat Messages
        if msg_type == "chat_message":
            await self.channel_layer.group_send(self.room_group_name, {
                "type": "broadcast_standard_message",
                "content": content
            })

        # HANDLER 2: Teacher Changed Slide
        elif msg_type == "lesson_update":
            # Clear volatile states when moving to a new slide
            if self.room_id in ROOM_MEMORY:
                ROOM_MEMORY[self.room_id]["zone_state"] = {}
                ROOM_MEMORY[self.room_id]["video_state"] = None
                ROOM_MEMORY[self.room_id]["audio_state"] = None

            await self.channel_layer.group_send(self.room_group_name, {
                "type": "broadcast_standard_message",
                "content": content
            })

        # HANDLER 3: Interactive Zone
        elif msg_type == "ZONE_ACTION":
            if self.room_id in ROOM_MEMORY:
                ROOM_MEMORY[self.room_id]["zone_state"].update(payload)
            await self.channel_layer.group_send(self.room_group_name, {
                "type": "broadcast_zone_update",
                "payload": ROOM_MEMORY[self.room_id]["zone_state"]
            })

        # HANDLER 4: Clear Board
        elif msg_type == "clear_board":
            if self.room_id in ROOM_MEMORY:
                ROOM_MEMORY[self.room_id]["zone_state"] = {}
            await self.channel_layer.group_send(self.room_group_name, {
                "type": "broadcast_zone_update",
                "payload": {}
            })

        # --- VIDEO SYNC ---
        elif msg_type in VIDEO_MSG_TYPES:
            if self.room_id in ROOM_MEMORY:
                state = payload.get("state")
                if msg_type == "VIDEO_PLAY": state = "playing"
                if msg_type == "VIDEO_PAUSE": state = "paused"
                
                ROOM_MEMORY[self.room_id]["video_state"] = {
                    "state": state or "paused",
                    "t": payload.get("t", 0),
                }
            await self.channel_layer.group_send(self.room_group_name, {
                "type": "broadcast_standard_message",
                "content": content,
            })

        # --- AUDIO SYNC (NEW) ---
        elif msg_type in AUDIO_MSG_TYPES:
            if self.room_id in ROOM_MEMORY:
                state = payload.get("state")
                if msg_type == "AUDIO_PLAY": state = "playing"
                if msg_type == "AUDIO_PAUSE": state = "paused"
                
                ROOM_MEMORY[self.room_id]["audio_state"] = {
                    "state": state or "paused",
                    "t": payload.get("t", 0),
                }
            await self.channel_layer.group_send(self.room_group_name, {
                "type": "broadcast_standard_message",
                "content": content,
            })

    # --- BROADCAST METHODS ---
    async def broadcast_standard_message(self, event):
        await self.send_json(event["content"])

    async def broadcast_zone_update(self, event):
        await self.send_json({
            "type": "ZONE_STATE_UPDATE",
            "payload": event["payload"]
        })
