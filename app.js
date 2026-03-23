// app.js

// State Management
let apiKey = localStorage.getItem('ai_coach_api_key') || '';
let chatHistory = [];
let questionsAttempted = 0;
let totalScore = 0;
let isRecording = false;
let recognition = null;
let currentQuestion = '';

// System Prompt
const SYSTEM_PROMPT = `You are an expert technical interviewer at a FAANG company.
Your goal is to conduct a realistic job interview. 
Ask behavioral (HR), Computer Science fundamentals, or Data Structures & Algorithms (DSA) questions.

For your FIRST QUESTION, simply output the question as plain text. Do not provide any feedback or use JSON. Just ask a single question.

For ALL SUBSEQUENT RESPONSES, you must FIRST evaluate the user's answer, provide a score (out of 10), list strengths and weaknesses, provide the ideal approach, and then ask the next question.
You MUST output this as valid JSON exactly matching this structure:
{
  "score": <number 0-10>,
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "ideal_answer": "...",
  "next_question": "..."
}

Do not provide ANY other text outside the JSON object. Only valid JSON.`;

// DOM Elements
const elements = {
    settingsModal: document.getElementById('settingsModal'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    openSettingsBtn: document.getElementById('openSettingsBtn'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    chatContainer: document.getElementById('chatContainer'),
    userInput: document.getElementById('userInput'),
    sendBtn: document.getElementById('sendBtn'),
    micBtn: document.getElementById('micBtn'),
    micRing: document.getElementById('micRing'),
    typingIndicator: document.getElementById('typingIndicator'),
    statQuestions: document.getElementById('statQuestions'),
    statScore: document.getElementById('statScore')
};

// Initialization
function init() {
    setupEventListeners();
    initSpeechRecognition();

    if (!apiKey) {
        showSettings();
    } else {
        elements.apiKeyInput.value = apiKey;
        addWelcomeMessage();
    }
}

function setupEventListeners() {
    // Auto-resize textarea
    elements.userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight < 160 ? this.scrollHeight : 160) + 'px';
    });

    // Enter to send (Shift+Enter for new line)
    elements.userInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    elements.openSettingsBtn.addEventListener('click', showSettings);
    elements.closeSettingsBtn.addEventListener('click', hideSettings);
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.micBtn.addEventListener('click', toggleRecording);
}

function showSettings() {
    elements.settingsModal.classList.remove('hidden');
    elements.closeSettingsBtn.classList.toggle('hidden', chatHistory.length === 0 && !apiKey);
    
    // Focus input
    setTimeout(() => elements.apiKeyInput.focus(), 100);
}

function hideSettings() {
    if (apiKey) {
        elements.settingsModal.classList.add('hidden');
    }
}

function saveSettings() {
    const key = elements.apiKeyInput.value.trim();
    if (key) {
        apiKey = key;
        localStorage.setItem('ai_coach_api_key', apiKey);
        hideSettings();
        if (chatHistory.length === 0) {
            startInterview();
        }
    } else {
        alert('Please enter a valid OpenAI API Key.');
    }
}

// Speech Recognition
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true; // Keep listening until explicitly stopped
        recognition.interimResults = true;
        
        recognition.onstart = function() {
            isRecording = true;
            elements.micBtn.classList.replace('text-gray-400', 'text-red-500');
            elements.micRing.classList.add('pulse-animation');
            elements.micRing.classList.remove('opacity-0');
        };

        recognition.onresult = function(event) {
            let finalTranscript = '';
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            
            // Append final transcript, and update with interim
            if (finalTranscript) {
                const currentVal = elements.userInput.value;
                elements.userInput.value = currentVal ? currentVal + ' ' + finalTranscript : finalTranscript;
            } else if (interimTranscript) {
                 // For a robust implementation, we'd manage interim state separately
                 // For now, simpler to just append on final or update fully if empty
                 if (!elements.userInput.value) {
                     elements.userInput.value = interimTranscript;
                 }
            }
            
            elements.userInput.style.height = 'auto';
            elements.userInput.style.height = Math.min(elements.userInput.scrollHeight, 160) + 'px';
        };

        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            stopRecording();
        };

        recognition.onend = function() {
            if (isRecording) {
                // Auto-restart if it stops unexpectedly while in recording mode
                recognition.start();
            } else {
                stopRecording();
            }
        };
    } else {
        // Hide mic button if unsupported
        elements.micBtn.closest('.absolute').style.display = 'none';
        console.warn('Speech Recognition API not supported in this browser.');
    }
}

function toggleRecording() {
    if (!recognition) return;
    
    if (isRecording) {
        stopActionRecording(); // Manual stop
    } else {
        recognition.start();
    }
}

function stopActionRecording() {
    isRecording = false;
    if (recognition) recognition.stop();
    stopRecording();
}

function stopRecording() {
    elements.micBtn.classList.replace('text-red-500', 'text-gray-400');
    elements.micRing.classList.remove('pulse-animation');
    elements.micRing.classList.add('opacity-0');
}

// UI Rendering
function addWelcomeMessage() {
    if (chatHistory.length > 0) return;
    
    const welcomeHtml = `
        <div class="whitespace-pre-line text-[15px]">Hello! I am your AI Interview Coach. 
        
        I will act as a FAANG interviewer and ask you technical and behavioral questions. I'll evaluate your answers and provide detailed feedback.
        
        When you're ready, I will ask the first question. Let's begin!</div>
        <button id="startInterviewBtn" class="mt-4 bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 px-4 py-2 rounded-lg text-sm transition-colors shadow-sm font-medium focus:ring-2 focus:ring-blue-500">
            Start Interview
        </button>
    `;
    
    appendMessage('assistant', welcomeHtml, true);
    
    setTimeout(() => {
        document.getElementById('startInterviewBtn')?.addEventListener('click', function() {
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Starting...';
            this.classList.add('opacity-50', 'cursor-not-allowed');
            startInterview();
        });
    }, 100);
}

function appendMessage(role, content, isHtml = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex items-start ${role === 'user' ? 'justify-end' : ''} msg-enter w-full`;

    // Assistant Avatar
    if (role === 'assistant') {
        const iconContainer = document.createElement('div');
        iconContainer.className = 'flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center mr-4 shadow-lg shadow-blue-500/20 mt-1';
        iconContainer.innerHTML = '<i class="fas fa-robot text-white text-md"></i>';
        msgDiv.appendChild(iconContainer);
    }

    const bubbleGroup = document.createElement('div');
    bubbleGroup.className = `flex flex-col ${role === 'user' ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-2xl`;

    const bubbleDiv = document.createElement('div');
    
    if (role === 'user') {
        bubbleDiv.className = 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm px-5 py-3.5 shadow-md break-words text-[15px] leading-relaxed w-full';
        bubbleDiv.textContent = content; // sanitize
        bubbleGroup.appendChild(bubbleDiv);
        msgDiv.appendChild(bubbleGroup);
    } else {
        bubbleDiv.className = 'glass rounded-2xl rounded-tl-sm p-6 shadow-md border-gray-700 w-full overflow-hidden text-gray-200';
        if (isHtml) {
            bubbleDiv.innerHTML = content;
        } else {
            bubbleDiv.textContent = content;
        }
        bubbleGroup.appendChild(bubbleDiv);
        msgDiv.appendChild(bubbleGroup);
    }

    elements.chatContainer.appendChild(msgDiv);
    scrollToBottom();
}

function scrollToBottom() {
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}

// Logic & API
function updateDashboard(score) {
    questionsAttempted++;
    totalScore += score;
    const avgScore = (totalScore / questionsAttempted).toFixed(1);
    
    elements.statQuestions.innerText = questionsAttempted;
    elements.statScore.innerText = `${avgScore}/10`;
    
    // Animation bump
    elements.statScore.parentElement.classList.add('scale-105', 'bg-emerald-500/20');
    setTimeout(() => {
        elements.statScore.parentElement.classList.remove('scale-105', 'bg-emerald-500/20');
    }, 300);
}

function parseFeedback(parsedData) {
    // Update stats
    if (typeof parsedData.score === 'number') {
        updateDashboard(parsedData.score);
    }

    currentQuestion = parsedData.next_question || "Let's move on.";

    const strengthsHtml = Array.isArray(parsedData.strengths) && parsedData.strengths.length > 0 
        ? parsedData.strengths.map(s => `<li class="flex items-start"><i class="fas fa-check text-green-400 mt-1 mr-2 text-xs"></i><span>${s}</span></li>`).join('')
        : '<li class="text-gray-500 italic">None noted.</li>';

    const weaknessesHtml = Array.isArray(parsedData.weaknesses) && parsedData.weaknesses.length > 0
        ? parsedData.weaknesses.map(w => `<li class="flex items-start"><i class="fas fa-arrow-right text-red-400 mt-1 mr-2 text-xs"></i><span>${w}</span></li>`).join('')
        : '<li class="text-gray-500 italic">None noted.</li>';

    const scoreColor = parsedData.score >= 7 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                     : parsedData.score >= 4 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                     : 'text-red-400 bg-red-500/10 border-red-500/20';

    return `
        <div class="space-y-6">
            <!-- Header section (Score) -->
            <div class="flex items-center justify-between border-b border-gray-700/50 pb-4">
                <h3 class="font-bold text-lg text-white">Evaluation</h3>
                <div class="px-3 py-1.5 rounded-xl border font-bold text-sm flex items-center shadow-inner ${scoreColor}">
                    <i class="fas fa-star mr-1.5 opacity-80"></i> Score: ${parsedData.score}/10
                </div>
            </div>
            
            <!-- Strengths & Weaknesses Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-gray-800/40 border border-emerald-500/20 rounded-xl p-4 transition-colors hover:bg-gray-800/60 w-full">
                    <h4 class="text-emerald-400 font-semibold mb-3 flex items-center text-sm uppercase tracking-wider">
                        <i class="fas fa-thumbs-up mr-2"></i> Strengths
                    </h4>
                    <ul class="text-[14px] text-gray-300 space-y-2">
                        ${strengthsHtml}
                    </ul>
                </div>
                <div class="bg-gray-800/40 border border-red-500/20 rounded-xl p-4 transition-colors hover:bg-gray-800/60 w-full">
                    <h4 class="text-red-400 font-semibold mb-3 flex items-center text-sm uppercase tracking-wider">
                        <i class="fas fa-chart-line mr-2"></i> Areas to Improve
                    </h4>
                    <ul class="text-[14px] text-gray-300 space-y-2">
                        ${weaknessesHtml}
                    </ul>
                </div>
            </div>

            <!-- Ideal Answer -->
            <div class="bg-blue-900/10 border border-blue-500/20 rounded-xl p-5 w-full relative overflow-hidden">
                <div class="absolute top-0 left-0 w-1 h-full bg-blue-500/50"></div>
                <h4 class="text-blue-400 font-semibold mb-2 flex items-center text-sm uppercase tracking-wider">
                    <i class="fas fa-lightbulb mr-2"></i> Ideal Approach
                </h4>
                <p class="text-[14.5px] text-gray-300 leading-relaxed whitespace-pre-wrap">${parsedData.ideal_answer || "Not provided."}</p>
            </div>

            <!-- Next Question -->
            <div class="mt-6 pt-5 border-t border-gray-700/50">
                <h4 class="font-bold text-xs uppercase tracking-widest text-gray-500 mb-2 mt-2">Next Question:</h4>
                <p class="text-white text-lg font-medium leading-relaxed">${currentQuestion}</p>
            </div>
        </div>
    `;
}

async function callOpenAI() {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...chatHistory
    ];

    elements.typingIndicator.classList.remove('hidden');

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo', // lightweight, fast
                messages: messages,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'API request failed');
        }

        const data = await response.json();
        let aiResponse = data.choices[0].message.content;

        elements.typingIndicator.classList.add('hidden');
        
        // Add raw text to chat history for context continuity
        chatHistory.push({ role: 'assistant', content: aiResponse });
        
        let displayHtml = '';
        let isHtmlMessage = false;

        if (chatHistory.length === 1) { // 1 because we just pushed
           // First ever question
           displayHtml = `<p class="text-[16px] text-white font-medium leading-relaxed">${aiResponse}</p>`;
           isHtmlMessage = true;
           currentQuestion = aiResponse;
        } else {
           try {
              // Extract JSON from response if surrounded by markdown
              let jsonStr = aiResponse;
              const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                  jsonStr = jsonMatch[0];
              }
              const parsed = JSON.parse(jsonStr);
              displayHtml = parseFeedback(parsed);
              isHtmlMessage = true;
           } catch (e) {
              console.error("Parse error, raw response:", aiResponse, e);
              // Fallback to plain text
              displayHtml = `<div class="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-200 mb-4 whitespace-pre-wrap"><strong>Parse Error:</strong> AI did not return perfect JSON layout. Showing raw output instead.</div><div class="whitespace-pre-wrap">${escapeHtml(aiResponse)}</div>`;
              isHtmlMessage = true;
           }
        }

        // Hide start button if it's there
        const startBtn = document.getElementById('startInterviewBtn');
        if (startBtn) startBtn.parentElement.parentElement.remove();

        appendMessage('assistant', displayHtml, isHtmlMessage);

    } catch (error) {
        elements.typingIndicator.classList.add('hidden');
        console.error(error);
        if (error.message.includes('API key')) {
            apiKey = '';
            localStorage.removeItem('ai_coach_api_key');
            showSettings();
            appendMessage('assistant', `<div class="text-red-400"><i class="fas fa-exclamation-triangle mr-2"></i> Error: Invalid API Key. Please update your settings.</div>`, true);
        } else {
            appendMessage('assistant', `<div class="text-red-400"><i class="fas fa-wifi mr-2"></i> ${escapeHtml(error.message)}</div>`, true);
        }
        // Remove last user message from history on failure so they can retry
        chatHistory.pop();
    }
}

async function startInterview() {
    if (chatHistory.length > 0) return;
    callOpenAI();
}

function sendMessage() {
    if (isRecording) stopActionRecording();
    
    const text = elements.userInput.value.trim();
    if (!text) return;

    elements.userInput.value = '';
    elements.userInput.style.height = 'auto'; // reset height

    appendMessage('user', text);
    chatHistory.push({ role: 'user', content: text });

    callOpenAI();
}

// Utility
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

// Bootstrap
document.addEventListener('DOMContentLoaded', init);
