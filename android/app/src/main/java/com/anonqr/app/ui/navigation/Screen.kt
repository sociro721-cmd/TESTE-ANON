package com.anonqr.app.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Message
import androidx.compose.material.icons.filled.Person
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    object Conversar : Screen("conversar", "Conversar", Icons.Default.Chat)
    object Conversas : Screen("conversas", "Conversas", Icons.Default.Message)
    object Perfil : Screen("perfil", "Perfil", Icons.Default.Person)
}
