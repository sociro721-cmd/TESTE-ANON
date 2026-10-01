package com.anonqr.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun ConversarScreen(
    onOpenScannerClick: () -> Unit
) {
    Column(modifier = Modifier.padding(16.dp)) {
        Text("Conversar", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(16.dp))
        Text("Converse sem mostrar quem você é.")
        Spacer(modifier = Modifier.height(24.dp))
        Text("🔎 Encontrar alguém")
        Text("Digite @nick para encontrar alguém", style = MaterialTheme.typography.bodySmall)
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = onOpenScannerClick, modifier = Modifier.fillMaxWidth()) {
            Text("📷 Entrar por QR Code")
        }
    }
}
