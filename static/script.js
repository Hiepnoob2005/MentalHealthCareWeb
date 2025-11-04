// --- Global Initializations & DOM Loading ---
document.addEventListener("DOMContentLoaded", function () {
    // 1. Khởi tạo Conversation ID cho Chatbot
    const currentConversationId = getConversationId();
    console.log(`Chatbot Session ID: ${currentConversationId}`);

    // 2. Gán Event Listeners
    initializeScrollEffects();
    initializeCTAListeners();
    initializeLoginModalListeners();
    initializeQuickTestListeners();
    initializeChatbotListeners();
    initializeResourceFilters();
    
    // Khởi tạo thanh tiến độ cho Quick Test
    updateProgress();
});

// --- Navigation and Scrolling ---
function initializeScrollEffects() {
    // Smooth scroll for navigation links
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener("click", function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute("href"));
            if (target) {
                target.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
            }
        });
    });

    // Navbar scroll effect
    window.addEventListener("scroll", function () {
        const navbar = document.querySelector(".navbar");
        if (window.scrollY > 50) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }
    });
}

// --- Login Modal Functions ---
function openLoginModal() {
    const modal = document.getElementById("loginModal");
    modal.classList.add("active");
    document.body.style.overflow = "hidden"; // Prevent scrolling when modal is open
}

function closeLoginModal() {
    const modal = document.getElementById("loginModal");
    modal.classList.remove("active");
    document.body.style.overflow = "auto"; // Re-enable scrolling
}

function initializeLoginModalListeners() {
    const loginModal = document.getElementById("loginModal");
    if (loginModal) {
        // Close modal when clicking outside
        loginModal.addEventListener("click", function (e) {
            if (e.target === this) {
                closeLoginModal();
            }
        });
        // Gắn hàm xử lý submit form
        const loginForm = document.getElementById("loginForm");
        if (loginForm) {
            loginForm.addEventListener("submit", handleLoginSubmit);
        }
    }
}

function initializeCTAListeners() {
    // Add event listeners to all buttons that should open the login modal
    const ctaSelectors = [
        ".btn-cta", // Main CTA button in navbar
        ".btn-primary", // Hero section "Đánh giá ngay"
        ".btn-connect:not([disabled])" // Connect buttons on expert cards
    ];

    ctaSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach((btn) => {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                openLoginModal();
            });
        });
    });
}

function handleLoginSubmit(event) {
    event.preventDefault();

    const fullName = document.getElementById("fullName").value;
    const phoneNumber = document.getElementById("phoneNumber").value;
    const message = document.getElementById("message").value;

    // Validate phone number (Vietnamese phone format)
    const phoneRegex = /^(0[3|5|7|8|9])+([0-9]{8})$/;
    if (!phoneRegex.test(phoneNumber)) {
        alert("Vui lòng nhập số điện thoại hợp lệ!");
        return;
    }

    // Gửi dữ liệu form đến server (cần triển khai logic phía server)
    console.log("Form data submitted:", { fullName, phoneNumber, message });

    // Show success message
    alert(
        `Cảm ơn ${fullName}! Chúng tôi đã nhận được yêu cầu của bạn. Chúng tôi sẽ liên hệ với bạn qua số ${phoneNumber} trong thời gian sớm nhất.`
    );

    // Reset form and close modal
    document.getElementById("loginForm").reset();
    closeLoginModal();
}


// --- Quick Test functionality ---
let currentQuestion = 1;
const totalQuestions = 3;

function initializeQuickTestListeners() {
    // Không cần gán sự kiện ở đây nếu các nút Next/Prev gọi trực tiếp hàm
    // trong HTML (ví dụ: onclick="nextQuestion()").
}

function selectAnswer(element) {
    const options = element.parentElement.querySelectorAll(".answer-option");
    options.forEach((opt) => opt.classList.remove("selected"));
    element.classList.add("selected");
}

function nextQuestion() {
    if (currentQuestion < totalQuestions) {
        document
            .querySelector(`.question-card[data-question="${currentQuestion}"]`)
            .classList.remove("active");
        currentQuestion++;
        document
            .querySelector(`.question-card[data-question="${currentQuestion}"]`)
            .classList.add("active");
        updateProgress();
    } else {
        showTestResults();
    }
}

function prevQuestion() {
    if (currentQuestion > 1) {
        document
            .querySelector(`.question-card[data-question="${currentQuestion}"]`)
            .classList.remove("active");
        currentQuestion--;
        document
            .querySelector(`.question-card[data-question="${currentQuestion}"]`)
            .classList.add("active");
        updateProgress();
    }
}

function updateProgress() {
    const progressFill = document.getElementById("progressFill");
    if (progressFill) {
        progressFill.style.width = `${(currentQuestion / totalQuestions) * 100}%`;
    }
}

function showTestResults() {
    alert(
        "Cảm ơn bạn đã hoàn thành bài đánh giá! Kết quả sẽ được gửi đến dashboard của bạn."
    );
    currentQuestion = 1;
    document
        .querySelectorAll(".question-card")
        .forEach((card) => card.classList.remove("active"));
    // Đảm bảo thẻ câu hỏi đầu tiên luôn được kích hoạt lại
    const firstQuestion = document.querySelector('.question-card[data-question="1"]');
    if (firstQuestion) {
        firstQuestion.classList.add("active");
    }
    document
        .querySelectorAll(".answer-option")
        .forEach((opt) => opt.classList.remove("selected"));
    updateProgress();
}


// --- Chatbot functionality (Integrated Gemini AI) ---

// Quản lý phiên chat (Conversation ID)
function getConversationId() {
    let conversationId = localStorage.getItem('gemini-chat-session-id');
    if (!conversationId) {
        // Tạo ID duy nhất nếu chưa tồn tại
        conversationId = self.crypto.randomUUID(); 
        localStorage.setItem('gemini-chat-session-id', conversationId);
    }
    return conversationId;
}

function toggleChatbot() {
    const chatWindow = document.getElementById("chatbotWindow");
    if (chatWindow) {
        chatWindow.classList.toggle("active");
    }
}

function addMessageToChat(text, sender) { // Đổi tên hàm từ 'addMessage'
    const messagesContainer = document.getElementById("chatMessages");
    if (!messagesContainer) return;

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = sender === "bot" ? "AI" : "You";

    const content = document.createElement("div");
    content.className = "message-content";
    content.textContent = text;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    messagesContainer.appendChild(messageDiv);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById("chatMessages");
    if (!messagesContainer) return;

    const typingDiv = document.createElement("div");
    typingDiv.className = "message bot typing-message";
    typingDiv.innerHTML = `
                <div class="message-avatar">AI</div>
                <div class="typing-indicator">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                </div>
            `;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTypingIndicator() {
    const typingMessage = document.querySelector(".typing-message");
    if (typingMessage) {
        typingMessage.remove();
    }
}

async function handleSendMessage(event) {
    if (event) event.preventDefault(); // Ngăn chặn submit form nếu được gọi từ form

    const input = document.getElementById("chatInput");
    const message = input.value.trim();
    const conversationId = getConversationId();

    if (!message) return;

    // 1. Hiển thị tin nhắn người dùng
    addMessageToChat(message, "user");
    input.value = ""; // Xóa nội dung input

    // 2. Hiển thị chỉ báo "đang gõ"
    showTypingIndicator();

    try {
        // 3. Gửi tin nhắn đến API backend Flask (cổng 5000)
        const response = await fetch("http://127.0.0.1:5000/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                message: message,
                conversationId: conversationId // Gửi ID phiên chat để duy trì ngữ cảnh
            }),
        });

        if (!response.ok) {
            // Xử lý lỗi HTTP (ví dụ: 404, 500)
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // 4. Xóa chỉ báo và hiển thị phản hồi AI
        removeTypingIndicator();
        addMessageToChat(data.reply, "bot");

    } catch (err) {
        removeTypingIndicator();
        console.error("Lỗi kết nối Gemini API:", err);
        addMessageToChat("Xin lỗi, hệ thống AI đang gặp sự cố. Vui lòng thử lại hoặc kiểm tra server backend.", "bot");
    }
}

function handleChatInputKey(event) {
    // Xử lý Enter key (không phải Shift+Enter)
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault(); 
        handleSendMessage();
    }
}

function initializeChatbotListeners() {
    const chatInput = document.getElementById("chatInput");
    const sendButton = document.getElementById("sendButton"); 
    const toggleButton = document.getElementById("chatbotToggle"); // Giả định có nút toggle

    if (chatInput) {
        chatInput.addEventListener('keypress', handleChatInputKey);
    }
    
    // Gắn sự kiện cho nút gửi (nếu có)
    if (sendButton) {
        sendButton.addEventListener('click', handleSendMessage);
    }

    // Gắn sự kiện cho nút toggle (nếu có)
    if (toggleButton) {
        toggleButton.addEventListener('click', toggleChatbot);
    }
}

// --- Category filter for resources ---
function initializeResourceFilters() {
    document.querySelectorAll(".category-btn").forEach((btn) => {
        btn.addEventListener("click", function () {
            document
                .querySelectorAll(".category-btn")
                .forEach((b) => b.classList.remove("active"));
            this.classList.add("active");
            // Add actual filtering logic here (cần triển khai logic lọc tài nguyên)
        });
    });
}