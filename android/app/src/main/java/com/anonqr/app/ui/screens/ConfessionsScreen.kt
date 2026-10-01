package com.anonqr.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anonqr.app.data.SupabaseManager
import com.anonqr.app.model.Confession
import com.anonqr.app.ui.components.AnonQrMascot
import com.anonqr.app.ui.components.MascotVariant
import com.anonqr.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConfessionsScreen(
    onBackClick: () -> Unit
) {
    var confessions by remember { mutableStateOf<List<Confession>>(emptyList()) }
    var showCreateDialog by remember { mutableStateOf(false) }
    var newConfessionText by remember { mutableStateOf("") }
    var selectedEmoji by remember { mutableStateOf("🕯️") }

    LaunchedEffect(Unit) {
        confessions = SupabaseManager.getConfessions()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        AnonQrMascot(variant = MascotVariant.CONFESSION, size = 28.dp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Mural das Confissões", color = TextWhite, fontSize = 16.sp, fontWeight = FontWeight.Black)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Voltar", tint = TextWhite)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DarkSurface)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showCreateDialog = true },
                containerColor = EmeraldPrimary,
                contentColor = TextWhite
            ) {
                Icon(Icons.Default.Add, contentDescription = "Criar Confissão")
            }
        },
        containerColor = DarkBackground
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Text(
                    text = "“O que você nunca confessaria usando seu nome?”",
                    color = TextMuted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                )
            }

            items(confessions) { confession ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    border = androidx.compose.foundation.BorderStroke(1.dp, DarkBorder),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(confession.mood_emoji, fontSize = 18.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = confession.author_nick ?: "Anônimo",
                                color = EmeraldLight,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = confession.text,
                            color = TextWhite,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Normal
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                IconButton(
                                    onClick = {
                                        // Like Confession
                                    },
                                    modifier = Modifier.size(24.dp)
                                ) {
                                    Icon(
                                        if (confession.is_liked_by_me) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                        contentDescription = "Curtir",
                                        tint = RoseAccent
                                    )
                                }
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("${confession.likes_count}", color = TextMuted, fontSize = 11.sp)
                            }

                            Text(confession.created_at, color = TextDark, fontSize = 10.sp)
                        }
                    }
                }
            }
        }

        if (showCreateDialog) {
            AlertDialog(
                onDismissRequest = { showCreateDialog = false },
                title = { Text("Fazer uma Confissão Anônima", color = TextWhite) },
                text = {
                    Column {
                        OutlinedTextField(
                            value = newConfessionText,
                            onValueChange = { newConfessionText = it },
                            placeholder = { Text("Escreva seu segredo aqui...", color = TextDark) },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (newConfessionText.isNotBlank()) {
                                // Create confession
                                showCreateDialog = false
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary)
                    ) {
                        Text("Publicar")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showCreateDialog = false }) {
                        Text("Cancelar", color = TextMuted)
                    }
                },
                containerColor = DarkCard
            )
        }
    }
}
