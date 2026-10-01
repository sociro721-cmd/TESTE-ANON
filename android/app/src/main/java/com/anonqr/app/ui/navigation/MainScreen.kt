package com.anonqr.app.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.anonqr.app.model.AnonymousUser
import com.anonqr.app.model.ThemedRoom
import com.anonqr.app.ui.screens.*

@Composable
fun MainScreen(
    rooms: List<ThemedRoom>,
    currentUser: AnonymousUser,
    isRegistered: Boolean,
    onRoomClick: (ThemedRoom) -> Unit,
    onTruthOrDareClick: () -> Unit,
    onImpostorClick: () -> Unit,
    onMuralClick: () -> Unit,
    onOpenScannerClick: () -> Unit,
    onLoginClick: () -> Unit,
    onLogoutClick: () -> Unit
) {
    val navController = rememberNavController()
    val items = listOf(Screen.Conversar, Screen.Jogos, Screen.Confissoes, Screen.Perfil)

    Scaffold(
        bottomBar = {
            NavigationBar {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination
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
        // NavHost logic would go here, linking routes to screens
    }
}
