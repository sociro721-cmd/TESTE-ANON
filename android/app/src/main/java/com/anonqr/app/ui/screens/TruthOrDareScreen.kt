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
import com.anonqr.app.model.TruthOrDareState
import com.anonqr.app.network.AnonQrWebSocket
import com.anonqr.app.ui.components.AnonQrMascot
import com.anonqr.app.ui.components.MascotVariant
import com.anonqr.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TruthOrDareScreen(
    currentUser: AnonymousUser,
    webSocket: AnonQrWebSocket,
    onBackClick: () -> Unit
) {
    var gameState by remember { mutableStateOf<TruthOrDareState?>(null) }

    LaunchedEffect(Unit) {
        webSocket.truthOrDareStates.collect { state ->
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
                        Text("Verdade ou Desafio", color = TextWhite, fontSize = 16.sp, fontWeight = FontWeight.Black)
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
                border = androidx.compose.foundation.BorderStroke(1.dp, EmeraldPrimary.copy(alpha = 0.4f)),
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(24.dp)
                ) {
                    Text("❤️ MODALIDADE PRESENCIAL", color = EmeraldLight, fontSize = 11.sp, fontWeight = FontWeight.Black)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Verdade ou Desafio", color = TextWhite, fontSize = 22.sp, fontWeight = FontWeight.Black)
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        "O AnônQr sorteia o participante e a pergunta ou desafio presencialmente.",
                        color = TextMuted,
                        fontSize = 12.sp
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    Button(
                        onClick = {
                            webSocket.sendTruthOrDareAction("start_game", "tod_default", currentUser.id)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Iniciar Rodada na Roda", color = TextWhite, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
