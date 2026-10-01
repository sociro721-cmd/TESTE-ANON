package com.anonqr.app.model

import kotlinx.serialization.Serializable

@Serializable
data class AnonymousUser(
    val id: String,
    val name: String,
    val avatarColor: String,
    val avatarIcon: String = "User",
    val nick: String? = null,
    val isRegistered: Boolean = false
)

@Serializable
data class ThemedRoom(
    val id: String,
    val name: String,
    val description: String,
    val category: String,
    val iconName: String,
    val isEncrypted: Boolean = true,
    val isPermanent: Boolean = true,
    val isOpenRoom: Boolean = true,
    val activeParticipantsCount: Int = 0,
    val expiresAt: Long? = null,
    val hasPasscode: Boolean = false
)

@Serializable
data class ChatMessage(
    val id: String,
    val roomId: String,
    val userId: String,
    val userName: String,
    val userAvatarColor: String,
    val userAvatarIcon: String = "User",
    val text: String,
    val timestamp: Long,
    val isSystem: Boolean = false,
    val userNick: String? = null
)

@Serializable
data class Confession(
    val id: String,
    val text: String,
    val mood_emoji: String = "🕯️",
    val likes_count: Int = 0,
    val comments_count: Int = 0,
    val created_at: String,
    val user_id: String? = null,
    val author_nick: String? = null,
    val is_liked_by_me: Boolean = false
)

@Serializable
data class ConfessionComment(
    val id: String,
    val confession_id: String,
    val author_nick: String,
    val content: String,
    val created_at: String
)

@Serializable
data class TruthOrDarePlayer(
    val id: String,
    val originalName: String,
    val gameNick: String,
    val avatarColor: String,
    val isReady: Boolean = false,
    val isHost: Boolean = false,
    val truthsAnswered: Int = 0,
    val daresCompleted: Int = 0
)

@Serializable
data class TruthOrDareContent(
    val id: String,
    val type: String, // "truth" or "dare"
    val level: String, // "light", "intense", "heavy"
    val content: String
)

@Serializable
data class TruthOrDareState(
    val roomId: String,
    val hostId: String,
    val phase: String, // "lobby", "choosing_player", "selecting_type", "round_active", "finished"
    val activePlayerId: String? = null,
    val selectedType: String? = null,
    val currentContent: TruthOrDareContent? = null,
    val truthsCount: Int = 0,
    val daresCount: Int = 0
)

@Serializable
data class ImpostorPlayer(
    val id: String,
    val originalName: String,
    val gameNick: String,
    val avatarColor: String,
    val isReady: Boolean = false,
    val isHost: Boolean = false,
    val isImpostor: Boolean? = null,
    val hasVoted: Boolean = false
)

@Serializable
data class ImpostorScenario(
    val id: String,
    val name: String,
    val icon: String
)

@Serializable
data class ImpostorGameState(
    val roomId: String,
    val hostId: String,
    val phase: String,
    val players: List<ImpostorPlayer> = emptyList(),
    val scenario: ImpostorScenario? = null,
    val scenarioOptions: List<ImpostorScenario> = emptyList(),
    val currentRound: Int = 1,
    val speakingOrder: List<String> = emptyList(),
    val currentSpeakerIndex: Int = 0,
    val currentPromptSuggestion: String? = null,
    val mostVotedPlayerId: String? = null,
    val winner: String? = null
)
