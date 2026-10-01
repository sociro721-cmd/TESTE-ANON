package com.anonqr.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.*
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.anonqr.app.data.SupabaseManager
import com.anonqr.app.model.AnonymousUser
import com.anonqr.app.model.ThemedRoom
import com.anonqr.app.network.AnonQrWebSocket
import com.anonqr.app.ui.screens.*
import com.anonqr.app.data.IdentityStorage
import com.anonqr.app.ui.theme.AnonQrTheme

class MainActivity : ComponentActivity() {

    private val webSocket = AnonQrWebSocket()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Retrieve or generate the persistent anonymous identity profile
        val currentUser = IdentityStorage.getOrCreateUser(this)

        setContent {
            AnonQrTheme {
                val navController = rememberNavController()
                var rooms by remember { mutableStateOf<List<ThemedRoom>>(emptyList()) }
                var selectedRoom by remember { mutableStateOf<ThemedRoom?>(null) }

                LaunchedEffect(Unit) {
                    rooms = SupabaseManager.getRooms()
                }

                NavHost(navController = navController, startDestination = "lobby") {
                    composable("lobby") {
                        LobbyScreen(
                            rooms = rooms,
                            onRoomClick = { room ->
                                selectedRoom = room
                                navController.navigate("chat/${room.id}")
                            },
                            onTruthOrDareClick = { navController.navigate("truth_or_dare") },
                            onImpostorClick = { navController.navigate("impostor") },
                            onMuralClick = { navController.navigate("confessions") },
                            onOpenScannerClick = {
                                // CameraX / MLKit QR Scanner
                            }
                        )
                    }

                    composable("chat/{roomId}") { backStackEntry ->
                        selectedRoom?.let { room ->
                            ChatRoomScreen(
                                room = room,
                                currentUser = currentUser,
                                webSocket = webSocket,
                                onBackClick = { navController.popBackStack() }
                            )
                        }
                    }

                    composable("confessions") {
                        ConfessionsScreen(
                            onBackClick = { navController.popBackStack() }
                        )
                    }

                    composable("truth_or_dare") {
                        TruthOrDareScreen(
                            currentUser = currentUser,
                            webSocket = webSocket,
                            onBackClick = { navController.popBackStack() }
                        )
                    }

                    composable("impostor") {
                        ImpostorGameScreen(
                            currentUser = currentUser,
                            webSocket = webSocket,
                            onBackClick = { navController.popBackStack() }
                        )
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        webSocket.disconnect()
    }
}
