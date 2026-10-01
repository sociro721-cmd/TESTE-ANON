package com.anonqr.app.network

import com.anonqr.app.model.AnonymousUser
import com.anonqr.app.model.PrivateConversationSummary
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.*
import java.util.concurrent.TimeUnit

class PrivateChatWebSocket(private val baseUrl: String) {

    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .pingInterval(15, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private val scope = CoroutineScope(Dispatchers.IO)
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    private val _conversationsList = MutableSharedFlow<List<PrivateConversationSummary>>()
    val conversationsList = _conversationsList.asSharedFlow()

    fun connect(user: AnonymousUser) {
        val wsUrl = baseUrl.replace("http://", "ws://").replace("https://", "wss://") + "/ws"
        val request = Request.Builder().url(wsUrl).build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                val payload = """
                    {
                        "type": "private_list_conversations",
                        "user": {
                            "id": "${user.id}",
                            "name": "${user.name}",
                            "nick": "${user.nick ?: ""}",
                            "avatarColor": "${user.avatarColor}",
                            "avatarIcon": "${user.avatarIcon}"
                        }
                    }
                """.trimIndent()
                webSocket.send(payload)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val root = json.parseToJsonElement(text).jsonObject
                    val type = root["type"]?.jsonPrimitive?.content
                    if (type == "private_conversations_list") {
                        root["conversations"]?.let { convElement ->
                            val list = json.decodeFromJsonElement(
                                ListSerializer(PrivateConversationSummary.serializer()),
                                convElement
                            )
                            scope.launch { _conversationsList.emit(list) }
                        }
                    }
                } catch (e: Exception) { e.printStackTrace() }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                t.printStackTrace()
                // Simple reconnection attempt after delay
                scope.launch {
                    kotlinx.coroutines.delay(3000)
                    connect(user)
                }
            }
        })
    }

    fun disconnect() {
        webSocket?.close(1000, "User Left")
        webSocket = null
    }
}
