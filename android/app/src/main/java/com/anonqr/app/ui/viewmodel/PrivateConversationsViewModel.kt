package com.anonqr.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.anonqr.app.model.AnonymousUser
import com.anonqr.app.model.PrivateConversationSummary
import com.anonqr.app.network.PrivateChatWebSocket
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class PrivateConversationsViewModel(baseUrl: String) : ViewModel() {
    private val webSocket = PrivateChatWebSocket(baseUrl)
    
    private val _conversations = MutableStateFlow<List<PrivateConversationSummary>>(emptyList())
    val conversations: StateFlow<List<PrivateConversationSummary>> = _conversations

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading

    fun connect(user: AnonymousUser) {
        _isLoading.value = true
        webSocket.connect(user)
        viewModelScope.launch {
            webSocket.conversationsList.collect {
                _conversations.value = it
                _isLoading.value = false
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        webSocket.disconnect()
    }
}
