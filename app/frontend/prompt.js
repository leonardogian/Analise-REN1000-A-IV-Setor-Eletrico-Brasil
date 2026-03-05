/**
 * Lógica do Chat IA (Prompt Livre) usando LangChain Agents via backend FastAPI
 */

document.addEventListener("DOMContentLoaded", () => {
    const chatHistory = document.getElementById('chat-history');
    const chatTextarea = document.getElementById('chat-textarea');
    const btnSendChat = document.getElementById('btn-send-chat');

    // Funções helper para manipulação de DOM
    function addMessage(text, isUser = false) {
        const wrapper = document.createElement('div');
        wrapper.className = 'chat-wrapper';
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = isUser ? 'flex-end' : 'flex-start';

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isUser ? 'user-message' : 'system-message'}`;

        if (isUser) {
            messageDiv.style.cssText = `
                background: linear-gradient(135deg, #8b5cf6, #ec4899); 
                color: white; 
                padding: 1rem 1.5rem; 
                border-radius: 12px; 
                border-bottom-right-radius: 2px; 
                max-width: 80%; 
                box-shadow: 0 4px 12px rgba(236, 72, 153, 0.2);
            `;
            messageDiv.innerHTML = `<div style="font-weight: 600; font-size: 0.85rem; margin-bottom: 0.5rem; color: #fce7f3;">Você</div><div>${escapeHTML(text)}</div>`;
        } else {
            messageDiv.style.cssText = `
                background: rgba(139, 92, 246, 0.2); 
                border: 1px solid rgba(139, 92, 246, 0.4); 
                color: #e2e8f0; 
                padding: 1rem 1.5rem; 
                border-radius: 12px; 
                border-bottom-left-radius: 2px; 
                max-width: 80%; 
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            `;
            // Aplicar parse de markdown simples
            messageDiv.innerHTML = `<div style="font-weight: 600; font-size: 0.85rem; margin-bottom: 0.5rem; color: #a78bfa;">Assistente IA</div><div>${parseMarkdown(text)}</div>`;
        }

        wrapper.appendChild(messageDiv);
        chatHistory.appendChild(wrapper);
        chatHistory.scrollTop = chatHistory.scrollHeight; // Scroll to bottom
    }

    function addLoadingMessage() {
        const wrapper = document.createElement('div');
        wrapper.className = 'chat-wrapper loading-wrapper';
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'flex-start';

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message system-message`;
        messageDiv.style.cssText = `
            background: rgba(139, 92, 246, 0.1); 
            border: 1px dashed rgba(139, 92, 246, 0.4); 
            color: #a78bfa; 
            padding: 1rem 1.5rem; 
            border-radius: 12px; 
            max-width: 80%;
            font-style: italic;
        `;
        messageDiv.innerHTML = `Processando a query através dos agentes e extraindo informações do dataframe... ⏳`;

        wrapper.appendChild(messageDiv);
        chatHistory.appendChild(wrapper);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        return wrapper;
    }

    function removeMessage(wrapperElement) {
        if (wrapperElement && wrapperElement.parentNode) {
            wrapperElement.parentNode.removeChild(wrapperElement);
        }
    }

    // Markdown e HTML Escaping
    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag])
        );
    }

    function parseMarkdown(md) {
        // Bem básico para visualização das respostas da IA
        let html = md.replace(/\*\*(.*?)\*\*/g, '<strong style="color: white;">$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/```(.*?)```/gs, '<pre style="background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 4px; overflow-x: auto;"><code>$1</code></pre>');
        html = html.replace(/`(.*?)`/g, '<code style="background: rgba(255,255,255,0.1); padding: 0.1rem 0.3rem; border-radius: 3px;">$1</code>');
        html = html.replace(/^- (.*)$/gm, '<li style="margin-left: 1.5rem;">$1</li>');
        html = html.replace(/\n\n/g, '<br/><br/>'); // Parágrafos
        html = html.replace(/\n(?!\<li\>)/g, '<br/>'); // Quebras de linha (ignorando listas)
        return html;
    }

    // Call API Backend
    async function sendMessageToAPI(message) {
        const backendUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? `http://127.0.0.1:8000/api/v1/ai-chat`
            : '/api/v1/ai-chat';

        try {
            const response = await fetch(backendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: message })
            });

            if (!response.ok) {
                const errorObj = await response.json().catch(() => ({}));
                throw new Error(errorObj.detail || "Erro na solicitação. O endpoint /api/v1/ai-chat está ativo?");
            }

            const data = await response.json();
            return data.response;
        } catch (error) {
            console.error("Chat API Error:", error);
            // Retorna a mensagem de erro formatada para injetar no chat
            return `**Erro de Conexão:** Não foi possível comunicar com o agente de IA.\n\nDetalhes técnico: \`${error.message}\`. Verifique se o servidor FastAPI está operando e a \`OPENROUTER_API_KEY\` está configurada no backend.`;
        }
    }

    // Controladores de Eventos
    const handleSend = async () => {
        const text = chatTextarea.value.trim();
        if (!text) return;

        // Limpar caixa
        chatTextarea.value = '';
        btnSendChat.disabled = true;
        chatTextarea.disabled = true;

        // Adicionar User Message
        addMessage(text, true);

        // Loading
        const loadingElt = addLoadingMessage();

        // Enviar requisição
        const aiResponse = await sendMessageToAPI(text);

        // Remover Loading e Adicionar IA Response
        removeMessage(loadingElt);
        addMessage(aiResponse, false);

        // Restaurar estado
        btnSendChat.disabled = false;
        chatTextarea.disabled = false;
        chatTextarea.focus();
    };

    btnSendChat.addEventListener('click', handleSend);

    chatTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });
});
