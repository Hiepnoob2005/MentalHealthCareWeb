from google import genai
from flask import Flask, request, jsonify
from flask_cors import CORS # Thêm CORS để frontend có thể gọi API
import os
import logging
import uuid # Thư viện để tạo ID duy nhất cho phiên chat
from dotenv import load_dotenv

# Cấu hình cơ bản
load_dotenv()
logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
# Cho phép tất cả các nguồn gốc (origins) để dễ dàng kiểm tra từ frontend (index.html)
# Trong môi trường production, bạn nên giới hạn chỉ cho phép domain của mình.
CORS(app) 

# --- Cấu hình Gemini ---

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY is required")

genai.configure(api_key=GOOGLE_API_KEY)

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
        model = genai.GenerativeModel(
            model_name="gemini-pro",
            generation_config=GENERATION_CONFIG,
            safety_settings=SAFETY_SETTINGS,
            system_instruction=SYSTEM_INSTRUCTION # Sử dụng System Instruction
        )
        chat = model.start_chat()
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
        # Lấy hoặc tạo phiên chat (duy trì lịch sử)
        chat = get_or_create_chat_session(conversation_id)
        
        # Gửi tin nhắn và nhận phản hồi
        response = chat.send_message(user_message)
        
        # Kiểm tra phản hồi
        if not response.text:
             # Xử lý trường hợp bị chặn hoặc lỗi nội dung
            return jsonify({
                "reply": "Xin lỗi, nội dung của bạn đã bị chặn vì lý do an toàn. Hãy thử diễn đạt lại."
            })
            
        return jsonify({"reply": response.text})

    except Exception as e:
        logging.error(f"Gemini API error: {str(e)}")
        return jsonify({"reply": "Xin lỗi, có lỗi xảy ra khi xử lý yêu cầu của bạn."}), 500


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "model": "gemini-pro"})

if __name__ == "__main__":
    # Đặt cổng là 5000 (mặc định của Flask)
    app.run(debug=True, port=5000)