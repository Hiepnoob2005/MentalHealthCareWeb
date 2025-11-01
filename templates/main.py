from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import openai  # optional, only if you use OpenAI API

app = Flask(__name__)
CORS(app)  # allows frontend JS to call the backend

# --- (optional) If you use OpenAI ---
# openai.api_key = "YOUR_API_KEY"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    user_message = data.get("message", "")

    # Example: hardcoded AI logic (replace with real model call)
    if "buồn" in user_message.lower():
        reply = "Mình rất hiểu, đôi khi ai cũng cảm thấy buồn. Bạn có muốn mình gợi ý vài cách thư giãn không?"
    elif "stress" in user_message.lower():
        reply = "Stress học tập là chuyện phổ biến. Mình có vài bài tập thở giúp bạn dễ chịu hơn!"
    else:
        reply = "Mình đang lắng nghe. Bạn có thể kể rõ hơn về cảm xúc hoặc tình huống của bạn được không?"

    # --- (optional) Real AI (if you have API key) ---
    # response = openai.ChatCompletion.create(
    #     model="gpt-3.5-turbo",
    #     messages=[{"role": "user", "content": user_message}]
    # )
    # reply = response["choices"][0]["message"]["content"]

    return jsonify({"reply": reply})


if __name__ == "__main__":
    app.run(debug=True)
