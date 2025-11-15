const btn = document.getElementById("connectBtn");
const linkDiv = document.getElementById("meetingLink");
const messages = document.getElementById("expertChatMessages");

btn.onclick = async () => {
  btn.textContent = "⏳ Creating meeting...";
  try {
    const res = await fetch("/create_meeting");
    const data = await res.json();

    if (data.join_url) {
      btn.textContent = "✅ Meeting Ready";

      // Put link under the button (optional)
      linkDiv.innerHTML = `<a href="${data.join_url}" target="_blank">Join Meeting</a>`;

      // ⭐ Send the link as a chat message
      const msg = document.createElement("div");
      msg.classList.add("message", "user");
      msg.innerHTML = `<span>Zoom Meeting: <a href="${data.join_url}" target="_blank">${data.join_url}</a></span>`;

      messages.appendChild(msg);

      // Auto-scroll to bottom
      messages.scrollTop = messages.scrollHeight;
    } else {
      linkDiv.textContent = "Failed to create meeting.";
      btn.textContent = "Create a Zoom Meeting";
    }
  } catch (err) {
    linkDiv.textContent = "Error connecting to server.";
    btn.textContent = "Create a Zoom Meeting";
  }
};
