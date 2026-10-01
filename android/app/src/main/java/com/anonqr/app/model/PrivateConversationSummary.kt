package com.anonqr.app.model

import kotlinx.serialization.Serializable

@Serializable
data class Participant(
    val id: String,
    val nick: String,
    val name: String? = null,
    val avatarUrl: String? = null,
    val avatarColor: String? = null,
    val avatarIcon: String? = null,
    val isOnline: Boolean = false
)

@Serializable
data class PrivateConversationSummary(
    val conversationId: String,
    val otherParticipant: Participant,
    val lastMessage: String? = null,
    val lastMessageAt: Long = 0,
    val lastMessageType: String? = null, // "text" | "audio" | "image"
    val unreadCount: Int = 0,
    val createdAt: Long = 0
)
