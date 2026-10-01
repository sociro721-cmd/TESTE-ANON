package com.anonqr.app.data

import com.anonqr.app.model.AnonymousUser
import com.anonqr.app.model.Confession
import com.anonqr.app.model.ConfessionComment
import com.anonqr.app.model.ThemedRoom
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

object SupabaseManager {

    private const val SUPABASE_URL = "https://your-supabase-project.supabase.co"
    private const val SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

    val client: SupabaseClient by lazy {
        createSupabaseClient(
            supabaseUrl = SUPABASE_URL,
            supabaseKey = SUPABASE_ANON_KEY
        ) {
            install(Postgrest)
        }
    }

    suspend fun getRooms(): List<ThemedRoom> = withContext(Dispatchers.IO) {
        try {
            client.postgrest["salas_produtos"].select().decodeList<ThemedRoom>()
        } catch (e: Exception) {
            // Default Fallback Rooms matching Web Version
            listOf(
                ThemedRoom("geral", "Papo Furado & Geral", "Conversa livre e sem compromisso sobre qualquer assunto.", "Geral", "Sparkles"),
                ThemedRoom("desabafos", "Desabafos & Apoio", "Um espaço seguro para compartilhar o que está no peito.", "Apoio & Emoção", "Lock"),
                ThemedRoom("cinema", "Cine & Séries", "Discussão sem spoilers sobre os lançamentos da semana.", "Cultura & Arte", "Film"),
                ThemedRoom("tech", "Devs & Tecnologia", "Código, café, IA, gadgets e automações.", "Tecnologia", "Terminal")
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
