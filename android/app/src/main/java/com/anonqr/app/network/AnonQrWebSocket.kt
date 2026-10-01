package com.anonqr.app.network

import com.anonqr.app.model.AnonymousUser
import com.anonqr.app.model.ChatMessage
import com.anonqr.app.model.ImpostorGameState
import com.anonqr.app.model.TruthOrDareState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

class AnonQrWebSocket {

    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .pingInterval(15, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private val scope = CoroutineScope(Dispatchers.IO)
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    // Shared Flows for Real-Time Event Bus
    private val _chatMessages = MutableSharedFlow<ChatMessage>()
    val chatMessages = _chatMessages.asSharedFlow()

    private val _truthOrDareStates = MutableSharedFlow<TruthOrDareState>()
    val truthOrDareStates = _truthOrDareStates.asSharedFlow()

    private val _impostorStates = MutableSharedFlow<ImpostorGameState>()
    val impostorStates = _impostorStates.asSharedFlow()

    private val _roomParticipantsCount = MutableSharedFlow<Int>()
    val roomParticipantsCount = _roomParticipantsCount.asSharedFlow()

    fun connect(baseUrl: String, roomId: String, user: AnonymousUser, passcode: String? = null) {
        disconnect()

        val wsUrl = baseUrl.replace("http://", "ws://").replace("https://", "wss://") + "/ws"
        val request = Request.Builder().url(wsUrl).build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                // Join Room Payload
                val joinJson = """
                    {
                        "type": "join",
                        "roomId": "$roomId",
                        "accessKey": ${passcode?.let { "\"$it\"" } ?: "null"},
                        "user": {
                            "id": "${user.id}",
                            "name": "${user.name}",
                            "avatarColor": "${user.avatarColor}",
                            "avatarIcon": "${user.avatarIcon}",
                            "nick": ${user.nick?.let { "\"$it\"" } ?: "null"}
                        }
                    }
                """.trimIndent()
                webSocket.send(joinJson)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val root = json.parseToJsonElement(text).jsonObject
                    val type = root["type"]?.jsonPrimitive?.content

                    when (type) {
                        "message" -> {
                            root["message"]?.let { msgElement ->
                                val chatMsg = json.decodeFromJsonElement(ChatMessage.serializer(), msgElement)
                                scope.launch { _chatMessages.emit(chatMsg) }
                            }
                        }
                        "history" -> {
                            root["messages"]?.let { historyElement ->
                                val messages = json.decodeFromJsonElement(
                                    kotlinx.serialization.builtins.ListSerializer(ChatMessage.serializer()),
                                    historyElement
                                )
                                messages.forEach { msg ->
                                    scope.launch { _chatMessages.emit(msg) }
                                }
                            }
                        }
                        "truth_or_dare_state" -> {
                            root["gameState"]?.let { todElement ->
                                val todState = json.decodeFromJsonElement(TruthOrDareState.serializer(), todElement)
                                scope.launch { _truthOrDareStates.emit(todState) }
                            }
                        }
                        "impostor_state" -> {
                            root["gameState"]?.let { impElement ->
                                val impState = json.decodeFromJsonElement(ImpostorGameState.serializer(), impElement)
                                scope.launch { _impostorStates.emit(impState) }
                            }
                        }
                        "presence" -> {
                            val count = root["activeCount"]?.jsonPrimitive?.content?.toIntOrNull() ?: 1
                            scope.launch { _roomParticipantsCount.emit(count) }
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                t.printStackTrace()
            }
        })
    }

    fun sendMessage(roomId: String, user: AnonymousUser, text: String) {
        val payload = """
            {
                "type": "message",
                "roomId": "$roomId",
                "user": {
                    "id": "${user.id}",
                    "name": "${user.name}",
                    "avatarColor": "${user.avatarColor}",
                    "avatarIcon": "${user.avatarIcon}",
                    "nick": ${user.nick?.let { "\"$it\"" } ?: "null"}
                },
                "text": "${text.replace("\"", "\\\"")}"
            }
        """.trimIndent()
        webSocket?.send(payload)
    }

    fun sendTruthOrDareAction(action: String, roomId: String, userId: String, payload: String = "") {
        val jsonPayload = """
            {
                "type": "truth_or_dare_action",
                "action": "$action",
                "roomId": "$roomId",
                "userId": "$userId"
                $payload
            }
        """.trimIndent()
        webSocket?.send(jsonPayload)
    }

    fun sendImpostorAction(action: String, roomId: String, userId: String, payload: String = "") {
        val jsonPayload = """
            {
                "type": "impostor_action",
                "action": "$action",
                "roomId": "$roomId",
                "userId": "$userId"
                $payload
            }
        """.trimIndent()
        webSocket?.send(jsonPayload)
    }

    fun disconnect() {
        webSocket?.close(1000, "User Left")
        webSocket = null
    }
}
