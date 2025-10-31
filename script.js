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

// Login Modal Functions
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

// Close modal when clicking outside
document.getElementById("loginModal").addEventListener("click", function (e) {
  if (e.target === this) {
    closeLoginModal();
  }
});

// Handle login form submission
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

  // Here you would normally send the data to your server
  console.log("Form data:", { fullName, phoneNumber, message });

  // Show success message
  alert(
    `Cảm ơn ${fullName}! Chúng tôi đã nhận được yêu cầu của bạn. Chúng tôi sẽ liên hệ với bạn qua số ${phoneNumber} trong thời gian sớm nhất.`
  );

  // Reset form and close modal
  document.getElementById("loginForm").reset();
  closeLoginModal();
}

// Add event listeners to all "Bắt đầu ngay" buttons
document.addEventListener("DOMContentLoaded", function () {
  // Main CTA button in navbar
  const navCTA = document.querySelector(".btn-cta");
  if (navCTA) {
    navCTA.addEventListener("click", function (e) {
      e.preventDefault();
      openLoginModal();
    });
  }

  // Hero section "Đánh giá ngay" button - also opens login first
  const heroAssessBtn = document.querySelector(".btn-primary");
  if (heroAssessBtn) {
    heroAssessBtn.addEventListener("click", function (e) {
      e.preventDefault();
      openLoginModal();
    });
  }

  // Connect buttons on expert cards
  document.querySelectorAll(".btn-connect:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      openLoginModal();
    });
  });
});

// Quick Test functionality
let currentQuestion = 1;
const totalQuestions = 3;

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
  progressFill.style.width = `${(currentQuestion / totalQuestions) * 100}%`;
}

function showTestResults() {
  alert(
    "Cảm ơn bạn đã hoàn thành bài đánh giá! Kết quả sẽ được gửi đến dashboard của bạn."
  );
  currentQuestion = 1;
  document
    .querySelectorAll(".question-card")
    .forEach((card) => card.classList.remove("active"));
  document
    .querySelector('.question-card[data-question="1"]')
    .classList.add("active");
  document
    .querySelectorAll(".answer-option")
    .forEach((opt) => opt.classList.remove("selected"));
  updateProgress();
}

// Chatbot functionality
function toggleChatbot() {
  const chatWindow = document.getElementById("chatbotWindow");
  chatWindow.classList.toggle("active");
}

function sendMessage() {
  const input = document.getElementById("chatInput");
  const message = input.value.trim();

  if (message) {
    addMessage(message, "user");
    input.value = "";

    // Show typing indicator
    showTypingIndicator();

    // Simulate AI response
    setTimeout(() => {
      removeTypingIndicator();
      const responses = [
        "Mình hiểu cảm xúc của bạn. Bạn có thể chia sẻ thêm để mình hỗ trợ tốt hơn không?",
        "Đó là một vấn đề phổ biến ở sinh viên. Bạn có muốn mình kết nối bạn với chuyên gia phù hợp không?",
        "Mình có một số bài viết hữu ích về vấn đề này. Bạn có muốn xem không?",
        "Cảm ơn bạn đã chia sẻ. Dựa trên những gì bạn nói, mình nghĩ bạn nên thử các kỹ thuật thư giãn.",
      ];
      const randomResponse =
        responses[Math.floor(Math.random() * responses.length)];
      addMessage(randomResponse, "bot");
    }, 1500);
  }
}

function handleChatInput(event) {
  if (event.key === "Enter") {
    sendMessage();
  }
}

function addMessage(text, sender) {
  const messagesContainer = document.getElementById("chatMessages");
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

// Category filter for resources
document.querySelectorAll(".category-btn").forEach((btn) => {
  btn.addEventListener("click", function () {
    document
      .querySelectorAll(".category-btn")
      .forEach((b) => b.classList.remove("active"));
    this.classList.add("active");
    // Add filtering logic here
  });
});

// Initialize progress bar
updateProgress();
