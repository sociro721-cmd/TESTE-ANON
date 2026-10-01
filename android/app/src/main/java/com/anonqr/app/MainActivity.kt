package com.anonqr.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.anonqr.app.data.SupabaseManager
import com.anonqr.app.model.AnonymousUser
import com.anonqr.app.network.AnonQrWebSocket
import com.anonqr.app.ui.screens.*
import com.anonqr.app.data.IdentityStorage
import com.anonqr.app.ui.theme.AnonQrTheme
import com.anonqr.app.ui.viewmodel.PrivateConversationsViewModel
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val webSocket = AnonQrWebSocket()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val localVisitor = IdentityStorage.getOrCreateUser(this)

        setContent {
            AnonQrTheme {
                val navController = rememberNavController()
                val scope = rememberCoroutineScope()
                var activeUser by remember { mutableStateOf<AnonymousUser>(localVisitor) }
                var isRegistered by remember { mutableStateOf(false) }
                
                val privateChatViewModel = remember { PrivateConversationsViewModel("https://ais-dev-uzqsbrhixrffej4ryo3e5f-366292061410.us-west2.run.app") }

                LaunchedEffect(Unit) {
                    val profile = SupabaseManager.restoreSession()
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
                    } else {
                        activeUser = IdentityStorage.getOrCreateUser(this@MainActivity)
                        isRegistered = false
                    }
                }
                
                LaunchedEffect(isRegistered, activeUser) {
                    if (isRegistered) {
                        privateChatViewModel.connect(activeUser)
                    }
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
                            ConversarScreen(onOpenScannerClick = { /* Scanner */ })
                        }
                        composable("conversas") {
                            if (isRegistered) {
                                ConversasScreen(
                                    viewModel = privateChatViewModel,
                                    onConversationClick = { conv -> navController.navigate("chat_private/${conv.conversationId}") }
                                )
                            } else {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text("Entre na sua conta para acessar suas conversas.")
                                    Button(onClick = { navController.navigate("login") }) { Text("Entrar") }
                                }
                            }
                        }
                        composable("perfil") {
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
                                 Button(onClick = { 
                                     scope.launch { 
                                         SupabaseManager.signOut() 
                                         activeUser = IdentityStorage.getOrCreateUser(this@MainActivity)
                                         isRegistered = false
                                     }
                                 }, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) {
                                     Text("Sair")
                                 }
                             }
                        }
                        // Chat privado 1x1 preparado
                        composable("chat_private/{conversationId}") { 
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text("Chat Privado: ${it.arguments?.getString("conversationId")}")
                            }
                        }
                        // Auth routes preserved
                        composable("login") { /* ... */ }
                        composable("signup") { /* ... */ }
                        composable("setup_nick") { /* ... */ }
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
