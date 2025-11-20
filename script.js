const validCredentials = {
    "200203659": "S@ndi{3691}",
    "201000521": "K@lyan$9772#",
    "guest": "8snl@2504"
  };

  document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value;

    const validPassword = validCredentials[username];

    if (validPassword && validPassword === passwordInput) {
      // Redirect to home.html
      sessionStorage.setItem('isLoggedIn', 'true');
      window.location.href = 'home.html';
    } else {
      document.getElementById('errorMsg').innerText = 'Invalid credentials. Please try again.';
    }
  });