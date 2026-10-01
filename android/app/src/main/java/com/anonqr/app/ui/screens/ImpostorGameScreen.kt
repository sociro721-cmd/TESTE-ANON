package com.anonqr.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anonqr.app.model.AnonymousUser
import com.anonqr.app.model.ImpostorGameState
import com.anonqr.app.network.AnonQrWebSocket
import com.anonqr.app.ui.components.AnonQrMascot
import com.anonqr.app.ui.components.MascotVariant
import com.anonqr.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ImpostorGameScreen(
    currentUser: AnonymousUser,
    webSocket: AnonQrWebSocket,
    onBackClick: () -> Unit
) {
    var gameState by remember { mutableStateOf<ImpostorGameState?>(null) }

    LaunchedEffect(Unit) {
        webSocket.impostorStates.collect { state ->
            gameState = state
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        AnonQrMascot(variant = MascotVariant.GAME, size = 28.dp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Ache o Impostor", color = TextWhite, fontSize = 16.sp, fontWeight = FontWeight.Black)
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
        containerColor = DarkBackground
    ) { paddingValues ->
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(24.dp)
        ) {
            Card(
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                border = androidx.compose.foundation.BorderStroke(1.dp, PurplePrimary.copy(alpha = 0.4f)),
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(24.dp)
                ) {
                    Text("🎭 MISTÉRIO & DEDUÇÃO", color = PurpleLight, fontSize = 11.sp, fontWeight = FontWeight.Black)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Ache o Impostor", color = TextWhite, fontSize = 22.sp, fontWeight = FontWeight.Black)
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        "Todos sabem o cenário. Menos um. Converse, observe e descubra quem está fingindo!",
                        color = TextMuted,
                        fontSize = 12.sp
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    Button(
                        onClick = {
                            webSocket.sendImpostorAction("start_game", "imp_default", currentUser.id)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PurplePrimary),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Criar Sala do Impostor", color = TextWhite, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
