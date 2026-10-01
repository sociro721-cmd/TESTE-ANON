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
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val webSocket = AnonQrWebSocket()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initial launch visitor user identity load
        val localVisitor = IdentityStorage.getOrCreateUser(this)

        setContent {
            AnonQrTheme {
                val navController = rememberNavController()
                val scope = rememberCoroutineScope()
                var rooms by remember { mutableStateOf<List<ThemedRoom>>(emptyList()) }
                var selectedRoom by remember { mutableStateOf<ThemedRoom?>(null) }
                
                // Unified state-reactive current user representing visitor or authenticated user
                var activeUser by remember { mutableStateOf<AnonymousUser>(localVisitor) }
                var isRegistered by remember { mutableStateOf(false) }

                // Restore active Supabase session dynamically on start
                LaunchedEffect(Unit) {
                    val profile = SupabaseManager.restoreSession()
                    if (profile != null) {
                        activeUser = AnonymousUser(
                            id = profile.id,
                            name = profile.name ?: "Usuário",
                            avatarColor = "#10B981", // Emerald style
                            avatarIcon = "User",
                            nick = profile.nick,
                            isRegistered = true
                        )
                        isRegistered = true
                        // Sincroniza e força criação de @nick se estiver vazio
                        if (profile.nick.isNullOrEmpty()) {
                            navController.navigate("setup_nick")
                        }
                    } else {
                        // Keep visitor identity
                        activeUser = IdentityStorage.getOrCreateUser(this@MainActivity)
                        isRegistered = false
                    }
                    
                    // Fetch list of rooms dynamically from production database
                    rooms = SupabaseManager.getRooms()
                }

                NavHost(navController = navController, startDestination = "lobby") {
                    composable("lobby") {
                        LobbyScreen(
                            rooms = rooms,
                            currentUser = activeUser,
                            isRegistered = isRegistered,
                            onRoomClick = { room ->
                                selectedRoom = room
                                navController.navigate("chat/${room.id}")
                            },
                            onTruthOrDareClick = { navController.navigate("truth_or_dare") },
                            onImpostorClick = { navController.navigate("impostor") },
                            onMuralClick = { navController.navigate("confessions") },
                            onOpenScannerClick = {
                                // CameraX / MLKit QR Scanner
                            },
                            onLoginClick = {
                                navController.navigate("login")
                            },
                            onLogoutClick = {
                                scope.launch {
                                    SupabaseManager.signOut()
                                    val visitor = IdentityStorage.getOrCreateUser(this@MainActivity)
                                    activeUser = visitor
                                    isRegistered = false
                                }
                            }
                        )
                    }

                    composable("login") {
                        LoginScreen(
                            onLoginSuccess = {
                                scope.launch {
                                    val profile = SupabaseManager.userProfileState.value
                                    if (profile != null) {
                                        activeUser = AnonymousUser(
                                            id = profile.id,
                                            name = profile.name ?: "Usuário",
                                            avatarColor = "#10B981",
                                            avatarIcon = "User",
                                            nick = profile.nick,
                                            isRegistered = true
                                        )
                                        isRegistered = true
                                        if (profile.nick.isNullOrEmpty()) {
                                            navController.navigate("setup_nick") {
                                                popUpTo("lobby") { inclusive = false }
                                            }
                                        } else {
                                            navController.popBackStack("lobby", false)
                                        }
                                    }
                                }
                            },
                            onNavigateToSignUp = { navController.navigate("signup") },
                            onNavigateToForgotPassword = { navController.navigate("forgot_password") },
                            onBackClick = { navController.popBackStack() }
                        )
                    }

                    composable("signup") {
                        SignUpScreen(
                            onSignUpSuccess = {
                                navController.navigate("login") {
                                    popUpTo("signup") { inclusive = true }
                                }
                            },
                            onNavigateToLogin = { navController.navigate("login") },
                            onBackClick = { navController.popBackStack() }
                        )
                    }

                    composable("forgot_password") {
                        ForgotPasswordScreen(
                            onBackClick = { navController.popBackStack() }
                        )
                    }

                    composable("setup_nick") {
                        SetupNickScreen(
                            onSuccess = {
                                scope.launch {
                                    val profile = SupabaseManager.userProfileState.value
                                    if (profile != null) {
                                        activeUser = AnonymousUser(
                                            id = profile.id,
                                            name = profile.name ?: "Usuário",
                                            avatarColor = "#10B981",
                                            avatarIcon = "User",
                                            nick = profile.nick,
                                            isRegistered = true
                                        )
                                        isRegistered = true
                                        navController.popBackStack("lobby", false)
                                    }
                                }
                            },
                            onBackClick = {
                                // Se o usuário cancelar a definição de nick obrigatório, fazemos logout
                                scope.launch {
                                    SupabaseManager.signOut()
                                    val visitor = IdentityStorage.getOrCreateUser(this@MainActivity)
                                    activeUser = visitor
                                    isRegistered = false
                                    navController.popBackStack("lobby", false)
                                }
                            }
                        )
                    }

                    composable("chat/{roomId}") { backStackEntry ->
                        selectedRoom?.let { room ->
                            ChatRoomScreen(
                                room = room,
                                currentUser = activeUser,
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
                            currentUser = activeUser,
                            webSocket = webSocket,
                            onBackClick = { navController.popBackStack() }
                        )
                    }

                    composable("impostor") {
                        ImpostorGameScreen(
                            currentUser = activeUser,
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
