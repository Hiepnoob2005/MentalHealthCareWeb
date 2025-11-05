function checkPasswordStrength() {
  const password = document.getElementById('password').value;
  const strengthBar = document.getElementById('strengthBar');

  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.match(/[a-z]+/)) strength++;
  if (password.match(/[A-Z]+/)) strength++;
  if (password.match(/[0-9]+/)) strength++;
  if (password.match(/[$@#&!]+/)) strength++;

  strengthBar.className = 'password-strength-bar';

  if (strength <= 2) {
    strengthBar.classList.add('strength-weak');
  } else if (strength <= 4) {
    strengthBar.classList.add('strength-medium');
  } else {
    strengthBar.classList.add('strength-strong');
  }
}

async function handleRegister(event) {
  event.preventDefault();

  // Lấy thêm username và email từ form
  const username = document.getElementById('username').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const terms = document.getElementById('terms').checked;

  // --- Validation phía Client (Giữ nguyên) ---
  if (!terms) {
    alert('Please agree to the Terms of Service and Privacy Policy');
    return false;
  }

  if (password !== confirmPassword) {
    alert('Passwords do not match!');
    return false;
  }

  if (password.length < 8) {
    alert('Password must be at least 8 characters long');
    return false;
  }

  // --- Gửi dữ liệu đến Backend Flask ---

  // 1. Chuẩn bị dữ liệu JSON
  const registrationData = {
    username: username,
    email: email,
    password: password
  };

  // 2. Gọi API bằng fetch
  try {
    // Server Flask chạy ở cổng 5000
    const response = await fetch('http://localhost:5000/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(registrationData)
    });

    const result = await response.json();

    // 3. Xử lý phản hồi từ server
    if (response.ok) { // response.ok là true khi status là 200-299 (201 của bạn là ok)
      alert(result.message); // "Tạo tài khoản thành công!"

      // (Tùy chọn) Chuyển hướng đến trang đăng nhập
      window.location.href = '/';
    } else {
      // Hiển thị lỗi từ server (ví dụ: "Email đã tồn tại!")
      alert(result.message);
    }

  } catch (error) {
    // Xử lý lỗi mạng (ví dụ: server Flask chưa chạy)
    console.error('Lỗi đăng ký:', error);
    alert('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
  }

  return false;
}