package com.anonqr.app.data

import com.anonqr.app.model.AnonymousUser
import com.anonqr.app.model.UserProfile
import com.anonqr.app.model.Confession
import com.anonqr.app.model.ConfessionComment
import com.anonqr.app.model.ThemedRoom
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.gotrue.Auth
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.gotrue.providers.builtin.Email
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.rpc
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull
import androidx.compose.runtime.mutableStateOf

object SupabaseManager {

    private const val SUPABASE_URL = "https://srclzysflycxyedgmwaz.supabase.co"
    private const val SUPABASE_ANON_KEY = "sb_publishable_3Mbqn0oAgUajihKqht4YpA_WwKeqBCX"

    val client: SupabaseClient by lazy {
        createSupabaseClient(
            supabaseUrl = SUPABASE_URL,
            supabaseKey = SUPABASE_ANON_KEY
        ) {
            install(Postgrest)
            install(Auth)
        }
    }

    // Composable-friendly State of the active authenticated user profile
    val userProfileState = mutableStateOf<UserProfile?>(null)

    // Supabase Auth Action: Sign Up
    suspend fun signUp(email: String, password: String, name: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            client.auth.signUpWith(Email) {
                this.email = email
                this.password = password
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // Supabase Auth Action: Sign In
    suspend fun signIn(email: String, password: String): Result<UserProfile> = withContext(Dispatchers.IO) {
        try {
            client.auth.signInWith(Email) {
                this.email = email
                this.password = password
            }
            val session = client.auth.currentSessionOrNull()
            val userId = session?.user?.id 
                ?: throw Exception("Falha ao recuperar sessão do usuário.")
            
            val profile = fetchProfile(userId)
            val nickStr = session.user?.userMetadata?.get("nick")?.jsonPrimitive?.contentOrNull
                ?: session.user?.userMetadata?.get("username")?.jsonPrimitive?.contentOrNull
                
            val updatedProfile = profile.copy(nick = nickStr)
            withContext(Dispatchers.Main) {
                userProfileState.value = updatedProfile
            }
            Result.success(updatedProfile)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // Supabase Auth Action: Sign Out
    suspend fun signOut(): Boolean = withContext(Dispatchers.IO) {
        try {
            client.auth.signOut()
            withContext(Dispatchers.Main) {
                userProfileState.value = null
            }
            true
        } catch (e: Exception) {
            false
        }
    }

    // Supabase Auth Action: Password Reset (Recuperar Senha)
    suspend fun resetPassword(email: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            client.auth.resetPasswordForEmail(email.trim())
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // Fetch Profile by ID from public.profiles
    suspend fun fetchProfile(userId: String): UserProfile = withContext(Dispatchers.IO) {
        client.postgrest["profiles"]
            .select { filter { eq("id", userId) } }
            .decodeSingle<UserProfile>()
    }

    // Define / Update Nickname via Supabase Auth userMetadata (safe from any database column/schema issue)
    suspend fun definirNickUsuario(nick: String): Result<String> = withContext(Dispatchers.IO) {
        try {
            val session = client.auth.currentSessionOrNull()
            val userId = session?.user?.id 
                ?: throw Exception("Usuário não autenticado.")
            
            val trimmedNick = nick.trim()

            // Update user metadata in Supabase Auth directly using correct SDK v2.5.0 DSL (data { ... })
            client.auth.updateUser {
                data {
                    put("nick", trimmedNick)
                    put("username", trimmedNick)
                }
            }

            // Update local state by copying the new nickname
            val currentProfile = userProfileState.value
            if (currentProfile != null && currentProfile.id == userId) {
                val updatedProfile = currentProfile.copy(nick = trimmedNick)
                withContext(Dispatchers.Main) {
                    userProfileState.value = updatedProfile
                }
            } else {
                // Fetch profile and override with new nick metadata
                val profile = fetchProfile(userId)
                val updatedProfile = profile.copy(nick = trimmedNick)
                withContext(Dispatchers.Main) {
                    userProfileState.value = updatedProfile
                }
            }
            Result.success(trimmedNick)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // Restore Session on Launch if valid
    suspend fun restoreSession(): UserProfile? = withContext(Dispatchers.IO) {
        try {
            val session = client.auth.currentSessionOrNull()
            val userId = session?.user?.id
            if (userId != null) {
                val profile = fetchProfile(userId)
                val nickStr = session.user?.userMetadata?.get("nick")?.jsonPrimitive?.contentOrNull
                    ?: session.user?.userMetadata?.get("username")?.jsonPrimitive?.contentOrNull
                
                val updatedProfile = profile.copy(nick = nickStr)
                withContext(Dispatchers.Main) {
                    userProfileState.value = updatedProfile
                }
                updatedProfile
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    // Fetch rooms from DB with real table 'salas'
    suspend fun getRooms(): List<ThemedRoom> = withContext(Dispatchers.IO) {
        try {
            client.postgrest["salas"].select().decodeList<ThemedRoom>()
        } catch (e: Exception) {
            // Default Fallback Rooms matching Web Version
            listOf(
                ThemedRoom("sala-aberta-1", "Lounge Principal (Bate-Papo Aberto)", "Espaço comunitário aberto para todos conversarem livremente sobre qualquer assunto de forma anônima.", "Bate-Papo Livre", "Sparkles"),
                ThemedRoom("sala-aberta-2", "Desabafos & Histórias Anônimas", "Espaço acolhedor para compartilhar relatos, pedir conselhos e desabafar sem julgamentos.", "Apoio & Emoção", "Lock"),
                ThemedRoom("sala-aberta-3", "Mundo Tech, IA & Curiosidades", "Conversas e novidades sobre tecnologia, inteligência artificial, internet, jogos e futuro.", "Tecnologia", "Terminal")
            )
        }
    }

    suspend fun getConfessions(): List<Confession> = withContext(Dispatchers.IO) {
        try {
            client.postgrest["mural_confessions"].select().decodeList<Confession>()
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun createConfession(text: String, moodEmoji: String, authorNick: String?): Boolean = withContext(Dispatchers.IO) {
        try {
            val body = buildJsonObject {
                put("text", text)
                put("mood_emoji", moodEmoji)
                if (authorNick != null) put("author_nick", authorNick)
            }
            client.postgrest["mural_confessions"].insert(body)
            true
        } catch (e: Exception) {
            false
        }
    }

    suspend fun likeConfession(confessionId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val body = buildJsonObject { put("confession_id", confessionId) }
            client.postgrest["confession_likes"].insert(body)
            true
        } catch (e: Exception) {
            false
        }
    }

    suspend fun getConfessionComments(confessionId: String): List<ConfessionComment> = withContext(Dispatchers.IO) {
        try {
            client.postgrest["confession_comments"]
                .select { filter { eq("confession_id", confessionId) } }
                .decodeList<ConfessionComment>()
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun addConfessionComment(confessionId: String, content: String, authorNick: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val body = buildJsonObject {
                put("confession_id", confessionId)
                put("content", content)
                put("author_nick", authorNick)
            }
            client.postgrest["confession_comments"].insert(body)
            true
        } catch (e: Exception) {
            false
        }
    }
}
