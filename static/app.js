// Initialize icons
lucide.createIcons();

// State
let currentPersona = "Dr. Focus: ADHD Assessment";
let messages = [];
let isTyping = false;

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const therapistBtns = document.querySelectorAll('.therapist-btn');
const headerName = document.getElementById('header-name');
const headerAvatar = document.getElementById('header-avatar');
const clearChatBtn = document.getElementById('clear-chat-btn');
const micBtn = document.getElementById('mic-btn');
const audioToggleBtn = document.getElementById('audio-toggle-btn');
const audioIcon = document.getElementById('audio-icon');

// Report DOM Elements
const generateReportBtn = document.getElementById('generate-report-btn');
const reportModal = document.getElementById('report-modal');
const closeReportBtn = document.getElementById('close-report-btn');
const reportLoading = document.getElementById('report-loading');
const reportMarkdown = document.getElementById('report-markdown');
const downloadReportBtn = document.getElementById('download-report-btn');

// Speech Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    
    recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                messageInput.value += event.results[i][0].transcript + ' ';
            }
        }
        sendBtn.disabled = messageInput.value.trim() === '';
        messageInput.style.height = 'auto';
        messageInput.style.height = (messageInput.scrollHeight) + 'px';
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        stopRecording();
    };
    
    recognition.onend = () => {
        if (isRecording) {
            stopRecording();
        }
    };
} else {
    micBtn.style.display = 'none';
}

function stopRecording() {
    isRecording = false;
    micBtn.classList.remove('recording');
    if (recognition) recognition.stop();
}

function toggleRecording() {
    if (!recognition) return;
    
    if (isRecording) {
        stopRecording();
    } else {
        isRecording = true;
        micBtn.classList.add('recording');
        recognition.start();
    }
}

if (micBtn) {
    micBtn.addEventListener('click', toggleRecording);
}

// TTS Setup
let isAudioEnabled = false;

function toggleAudio() {
    isAudioEnabled = !isAudioEnabled;
    if (isAudioEnabled) {
        audioIcon.setAttribute('data-lucide', 'volume-2');
        audioToggleBtn.classList.add('active');
    } else {
        audioIcon.setAttribute('data-lucide', 'volume-x');
        audioToggleBtn.classList.remove('active');
        window.speechSynthesis.cancel();
    }
    lucide.createIcons({ root: audioToggleBtn });
}

if (audioToggleBtn) {
    audioToggleBtn.addEventListener('click', toggleAudio);
    // Initialize default icon
    audioIcon.setAttribute('data-lucide', 'volume-x');
}

function speakText(text) {
    if (!isAudioEnabled || !window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    
    // Clean simple markdown formatting
    const cleanText = text.replace(/[*_#]/g, '');
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    
    window.speechSynthesis.speak(utterance);
}

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    // Set initial greeting
    setGreeting();
    
    // Auto-resize textarea
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if(this.value.trim() === '') {
            sendBtn.disabled = true;
        } else {
            sendBtn.disabled = false;
        }
    });

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });
});

function getTherapistDetails(persona) {
    return { name: "Dr. Focus", avatarClass: "aria-avatar", initial: "F" };
}

function setGreeting() {
    chatMessages.innerHTML = '';
    messages = [];
    const details = getTherapistDetails(currentPersona);
    
    let greeting = "Hello, I'm Dr. Focus. I'm an AI designed to help you explore your experiences with attention, focus, and organization. To get started, what made you decide to take this assessment today?";

    appendMessage('assistant', greeting, details);
    speakText(greeting);
    
    // We add the greeting to the message history so the LLM knows it has already asked Q1.
    messages.push({ role: 'assistant', content: greeting });
}

// Event Listeners
therapistBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        therapistBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        currentPersona = btn.dataset.persona;
        const details = getTherapistDetails(currentPersona);
        
        // Update header
        headerName.textContent = details.name;
        headerAvatar.className = `avatar ${details.avatarClass}`;
        headerAvatar.textContent = details.initial;
        
        // Reset chat
        setGreeting();
    });
});

clearChatBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the conversation?')) {
        setGreeting();
    }
});

// Chat handling
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isTyping) return;
    
    const content = messageInput.value.trim();
    if (!content) return;

    // Add user message
    appendMessage('user', content);
    messages.push({ role: 'user', content });
    
    // Reset input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.disabled = true;
    
    if (isRecording) {
        stopRecording();
    }

    // Show typing
    isTyping = true;
    showTypingIndicator();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: messages,
                persona: currentPersona
            })
        });

        removeTypingIndicator();
        isTyping = false;

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to fetch response');
        }

        const data = await response.json();
        
        // Add assistant message
        const assistantContent = data.response;
        const analysis = data.internal_analysis;
        
        messages.push({ role: 'assistant', content: assistantContent });
        appendMessage('assistant', assistantContent, getTherapistDetails(currentPersona), analysis);
        speakText(assistantContent);
        
        if (data.suggest_early_end) {
            const notice = document.createElement('div');
            notice.className = 'system-notice';
            notice.innerHTML = '<i data-lucide="info" style="margin-bottom:-4px; margin-right:6px;"></i> Dr. Focus has gathered enough information. You may click <b>Generate Report</b> in the sidebar whenever you are ready.';
            chatMessages.appendChild(notice);
            lucide.createIcons({ root: notice });
            scrollToBottom();
        }

    } catch (error) {
        removeTypingIndicator();
        isTyping = false;
        
        let errorMsg = error.message;
        
        appendMessage('assistant', `**Error:** ${errorMsg}`, getTherapistDetails(currentPersona));
    }
});

function appendMessage(role, content, details = null, analysis = null) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${role}`;

    let avatarHtml = '';
    if (role === 'user') {
        avatarHtml = `<div class="message-avatar"><div class="avatar user-avatar"><i data-lucide="user" style="width: 20px; height: 20px;"></i></div></div>`;
    } else {
        avatarHtml = `<div class="message-avatar"><div class="avatar ${details.avatarClass}">${details.initial}</div></div>`;
    }

    let htmlContent = '';
    if (analysis && role === 'assistant') {
        htmlContent += `<details class="thought-bubble">
            <summary><i data-lucide="cpu" style="width:16px; height:16px;"></i> Dr. Focus is thinking...</summary>
            <div class="thought-bubble-content">${marked.parse(analysis)}</div>
        </details>`;
    }
    htmlContent += marked.parse(content);

    wrapper.innerHTML = `
        ${avatarHtml}
        <div class="message-content">
            ${htmlContent}
        </div>
    `;

    chatMessages.appendChild(wrapper);
    lucide.createIcons({ root: wrapper });
    
    scrollToBottom();
}

function showTypingIndicator() {
    const details = getTherapistDetails(currentPersona);
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper assistant`;
    wrapper.id = 'typing-indicator-wrapper';

    wrapper.innerHTML = `
        <div class="message-avatar">
            <div class="avatar ${details.avatarClass}">${details.initial}</div>
        </div>
        <div class="message-content" style="padding: 12px 16px;">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;

    chatMessages.appendChild(wrapper);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator-wrapper');
    if (indicator) {
        indicator.remove();
    }
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Report Logic
function openReportModal() {
    reportModal.classList.add('active');
}
function closeReportModal() {
    reportModal.classList.remove('active');
}

closeReportBtn.addEventListener('click', closeReportModal);
reportModal.addEventListener('click', (e) => {
    if (e.target === reportModal) closeReportModal();
});

generateReportBtn.addEventListener('click', async () => {
    if (messages.length < 3) {
        alert("Please have a slightly longer conversation before generating a report.");
        return;
    }
    
    openReportModal();
    reportLoading.style.display = 'block';
    reportMarkdown.style.display = 'none';
    
    try {
        const response = await fetch('/api/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: messages, persona: currentPersona })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to fetch report');
        }
        
        const data = await response.json();
        const htmlContent = marked.parse(data.report);
        
        reportMarkdown.innerHTML = htmlContent;
        reportLoading.style.display = 'none';
        reportMarkdown.style.display = 'block';
        
        // Setup download button
        downloadReportBtn.onclick = () => {
            const blob = new Blob([data.report], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'clinical_report.md';
            a.click();
            URL.revokeObjectURL(url);
        };
        
    } catch (error) {
        reportLoading.style.display = 'none';
        reportMarkdown.style.display = 'block';
        reportMarkdown.innerHTML = `<p style="color: #ef4444;">Error generating report: ${error.message}</p>`;
    }
});
