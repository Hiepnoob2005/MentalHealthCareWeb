from google import genai
from flask import Flask, request, jsonify
from flask_cors import CORS # Thêm CORS để frontend có thể gọi API
from flask import send_from_directory
import webbrowser
import threading
import os
import logging
import uuid # Thư viện để tạo ID duy nhất cho phiên chat
from dotenv import load_dotenv
from flask import render_template

# Cấu hình cơ bản
load_dotenv()
logging.basicConfig(level=logging.INFO)

# Cho phép tất cả các nguồn gốc (origins) để dễ dàng kiểm tra từ frontend (index.html)
# Trong môi trường production, bạn nên giới hạn chỉ cho phép domain của mình.

# --- Cấu hình Gemini ---

load_dotenv()
api_key_value = os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")

client = genai.Client(api_key=api_key_value)

app = Flask(__name__)
CORS(app)
# Cấu hình cho việc tạo nội dung
GENERATION_CONFIG = {
    "temperature": 0.7,
    "top_p": 0.8,
    "top_k": 40,
    "max_output_tokens": 1000,
}

# Hướng dẫn hệ thống (System Instruction) để định hướng hành vi của AI
SYSTEM_INSTRUCTION = (
    "Bạn là StudentMind Connect AI, một trợ lý hỗ trợ sức khỏe tâm lý cho sinh viên. "
    "Chỉ trả lời nhưng câu hỏi liên quan đến sức khỏe tâm lý, tinh thần."
    "Mục tiêu của bạn là lắng nghe, thấu hiểu và đưa ra các phản hồi đồng cảm, hỗ trợ. "
    "Tuyệt đối không đưa ra lời khuyên y tế, chẩn đoán, hoặc cam kết thay thế chuyên gia. "
    "Nếu gặp tình huống khẩn cấp, hãy đề nghị tìm kiếm sự trợ giúp chuyên nghiệp."
)

# Cấu hình an toàn
SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]

# --- Quản lý Phiên Chat (Chat Session Management) ---
# Dictionary để lưu trữ các đối tượng Chat, sử dụng conversationId làm khóa
chat_sessions = {}

# Hàm helper để lấy hoặc tạo phiên chat mới
def get_or_create_chat_session(conversation_id):
    if conversation_id not in chat_sessions:
        logging.info(f"Tạo phiên chat mới: {conversation_id}")
        # Khởi tạo mô hình và Chat session
        client = genai.Client(api_key=api_key_value)
        chat_sessions[conversation_id] = chat
    return chat_sessions[conversation_id]


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    user_message = data.get("message", "").strip()
    # Nhận conversationId từ frontend
    conversation_id = data.get("conversationId")

    if not user_message or not conversation_id:
        return jsonify({"error": "Message and conversationId are required"}), 400

    try:
            # Gọi API Gemini đúng cú pháp
        response = client.models.generate_content(
            model="models/gemini-2.5-flash",
            contents=user_message
        )

        reply = response.text.strip() if hasattr(response, "text") and response.text else "Xin lỗi, AI chưa thể phản hồi."
        return jsonify({"reply": reply})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"reply": f"Xin lỗi, có lỗi xảy ra khi xử lý: {str(e)}"}), 500

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "model": "gemini-pro"})

@app.route("/")
def home():
    return render_template("index.html")

@app.route('/register_page.html')
def register_page():
    return render_template('register_page.html')

if __name__ == "__main__":
    # Đặt cổng là 5000 (mặc định của Flask)
    app.run(debug=True, port=5000)