function checkPasswordStrength() {
  const password = document.getElementById("password").value;
  const strengthBar = document.getElementById("strengthBar");

  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.match(/[a-z]+/)) strength++;
  if (password.match(/[A-Z]+/)) strength++;
  if (password.match(/[0-9]+/)) strength++;
  if (password.match(/[$@#&!]+/)) strength++;

  strengthBar.className = "password-strength-bar";

  if (strength <= 2) {
    strengthBar.classList.add("strength-weak");
  } else if (strength <= 4) {
    strengthBar.classList.add("strength-medium");
  } else {
    strengthBar.classList.add("strength-strong");
  }
}

function handleRegister(event) {
  event.preventDefault();

  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const terms = document.getElementById("terms").checked;

  if (!terms) {
    alert("Please agree to the Terms of Service and Privacy Policy");
    return false;
  }

  if (password !== confirmPassword) {
    alert("Passwords do not match!");
    return false;
  }

  if (password.length < 8) {
    alert("Password must be at least 8 characters long");
    return false;
  }

  // Simulate registration
  alert("Registration successful! Welcome to Space Dynamic.");

  // In a real application, you would send this data to your server
  // window.location.href = 'index.html';

  return false;
}
