package com.anonqr.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun JogosScreen(
    onTruthOrDareClick: () -> Unit,
    onImpostorClick: () -> Unit
) {
    Column(modifier = Modifier.padding(16.dp)) {
        Text("Jogos", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = onTruthOrDareClick, modifier = Modifier.fillMaxWidth()) { Text("Verdade ou Desafio") }
        Spacer(modifier = Modifier.height(8.dp))
        Button(onClick = onImpostorClick, modifier = Modifier.fillMaxWidth()) { Text("Ache o Impostor") }
    }
}
