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

                val navController = rememberNavController()
                
                // Fetch list of rooms dynamically from production database
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

                Scaffold(
                    bottomBar = {
                        NavigationBar {
                            val navBackStackEntry by navController.currentBackStackEntryAsState()
                            val currentDestination = navBackStackEntry?.destination
                            val items = listOf(
                                com.anonqr.app.ui.navigation.Screen.Conversar,
                                com.anonqr.app.ui.navigation.Screen.Conversas,
                                com.anonqr.app.ui.navigation.Screen.Perfil
                            )
                            items.forEach { screen ->
                                NavigationBarItem(
                                    icon = { Icon(screen.icon, contentDescription = null) },
                                    label = { Text(screen.title) },
                                    selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true,
                                    onClick = {
                                        navController.navigate(screen.route) {
                                            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                            launchSingleTop = true
                                            restoreState = true
                                        }
                                    }
                                )
                            }
                        }
                    }
                ) { innerPadding ->
                    NavHost(
                        navController = navController,
                        startDestination = "conversar",
                        modifier = Modifier.padding(innerPadding)
                    ) {
                        composable("conversar") {
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
                                onOpenScannerClick = { /* Scanner */ },
                                onLoginClick = { navController.navigate("login") },
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
                        
                        composable("conversas") {
                            // Tela de conversas vazia
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text("Conversas", style = MaterialTheme.typography.headlineMedium)
                                Spacer(modifier = Modifier.height(16.dp))
                                Text("Suas conversas privadas aparecerão aqui.")
                            }
                        }

                        composable("perfil") {
                             // Perfil screen implementation
                             Column(modifier = Modifier.padding(16.dp)) {
                                 Text("Perfil", style = MaterialTheme.typography.headlineMedium)
                                 Spacer(modifier = Modifier.height(16.dp))
                                 Text("Nome: ${activeUser.name}")
                                 Text("Nick: ${activeUser.nick ?: "Não definido"}")
                                 Spacer(modifier = Modifier.height(16.dp))
                                 Button(onClick = { /* Minhas compras */ }, modifier = Modifier.fillMaxWidth()) {
                                     Text("Minhas compras")
                                 }
                                 Spacer(modifier = Modifier.height(8.dp))
                                 Button(onClick = { /* Sair */ }, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) {
                                     Text("Sair")
                                 }
                             }
                        }
                        
                        // Remaining routes: chat, jogos, confissoes, etc.
                        composable("chat/{roomId}") { /* ... */ }
                        composable("truth_or_dare") { TruthOrDareScreen(/* ... */) }
                        composable("impostor") { ImpostorGameScreen(/* ... */) }
                        composable("confessions") { ConfessionsScreen(/* ... */) }

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
