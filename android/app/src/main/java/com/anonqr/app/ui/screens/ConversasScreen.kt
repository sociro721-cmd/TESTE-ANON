package com.anonqr.app.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.anonqr.app.model.PrivateConversationSummary
import com.anonqr.app.ui.viewmodel.PrivateConversationsViewModel

@Composable
fun ConversasScreen(
    viewModel: PrivateConversationsViewModel,
    onConversationClick: (PrivateConversationSummary) -> Unit
) {
    val conversations by viewModel.conversations.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Conversas", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(16.dp))

        if (isLoading) {
            CircularProgressIndicator()
        } else if (conversations.isEmpty()) {
            Text("Você ainda não tem conversas.")
            Spacer(modifier = Modifier.height(16.dp))
            Button(onClick = { /* Navigate to find someone */ }) {
                Text("Encontrar alguém")
            }
        } else {
            LazyColumn {
                items(conversations) { conv ->
                    ConversationItem(conv, onClick = { onConversationClick(conv) })
                }
            }
        }
    }
}

@Composable
fun ConversationItem(conversation: PrivateConversationSummary, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(8.dp).clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(modifier = Modifier.size(48.dp), color = MaterialTheme.colorScheme.primaryContainer, shape = MaterialTheme.shapes.medium) {}
        Spacer(modifier = Modifier.width(16.dp))
        Column {
            Text(conversation.otherParticipant.nick, style = MaterialTheme.typography.titleMedium)
            Text(conversation.lastMessage ?: "Sem mensagens", style = MaterialTheme.typography.bodyMedium)
        }
    }
}
