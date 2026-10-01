package com.anonqr.app.data

import android.content.Context
import com.anonqr.app.model.AnonymousUser
import java.util.UUID

object IdentityStorage {

    private const val PREFS_NAME = "anonqr_identity_prefs"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_USER_NAME = "user_name"
    private const val KEY_USER_AVATAR_COLOR = "user_avatar_color"
    private const val KEY_USER_AVATAR_ICON = "user_avatar_icon"
    private const val KEY_USER_NICK = "user_nick"

    fun getOrCreateUser(context: Context): AnonymousUser {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        
        val savedId = prefs.getString(KEY_USER_ID, null)
        if (savedId != null) {
            return AnonymousUser(
                id = savedId,
                name = prefs.getString(KEY_USER_NAME, "Usuário Anônimo") ?: "Usuário Anônimo",
                avatarColor = prefs.getString(KEY_USER_AVATAR_COLOR, "#10b981") ?: "#10b981",
                avatarIcon = prefs.getString(KEY_USER_AVATAR_ICON, "User") ?: "User",
                nick = prefs.getString(KEY_USER_NICK, null)
            )
        }

        // Generate a persistent new anonymous identity if it doesn't exist yet
        val newId = UUID.randomUUID().toString()
        val defaultName = "Usuário Anônimo"
        val defaultAvatarColor = "#10b981"
        val defaultAvatarIcon = "User"
        val generatedNick = "Anôn_${(1000..9999).random()}"

        prefs.edit().apply {
            putString(KEY_USER_ID, newId)
            putString(KEY_USER_NAME, defaultName)
            putString(KEY_USER_AVATAR_COLOR, defaultAvatarColor)
            putString(KEY_USER_AVATAR_ICON, defaultAvatarIcon)
            putString(KEY_USER_NICK, generatedNick)
            apply()
        }

        return AnonymousUser(
            id = newId,
            name = defaultName,
            avatarColor = defaultAvatarColor,
            avatarIcon = defaultAvatarIcon,
            nick = generatedNick
        )
    }

    fun updateUserNick(context: Context, newNick: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_USER_NICK, newNick).apply()
    }
}
